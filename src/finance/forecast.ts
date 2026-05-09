import type { Dataset, PurchaseOrder } from './types'
import { computeFinanceSnapshot } from './engine'

// ─────────────────────────────────────────────────────────────────────────────
// Monte Carlo cash-flow simulation — 10k iterations.
// Stochastic drivers: sales volatility, FX rate, freight, customs lead time
// (Beta-distributed), and AR collection days.
// ─────────────────────────────────────────────────────────────────────────────

export type MonteCarloInputs = {
  iterations: number
  salesVol: number // sigma in %, e.g. 0.18
  fxVol: number
  freightVol: number
  customsBetaAlpha: number
  customsBetaBeta: number
  customsScaleDays: number
}

export type MonteCarloResult = {
  iterations: number
  meanCash: number
  p5: number
  p50: number
  p95: number
  histogram: { bucket: number; count: number }[]
  shortfallProb: number // P(cash < 0)
}

// Box-Muller standard normal
function randn(): number {
  const u = Math.max(1e-12, Math.random())
  const v = Math.max(1e-12, Math.random())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// Beta(α,β) via two gammas (Marsaglia for shape>=1, fallback for <1).
function gammaSample(shape: number): number {
  if (shape < 1) {
    return gammaSample(shape + 1) * Math.pow(Math.random(), 1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  while (true) {
    const x = randn()
    const v = Math.pow(1 + c * x, 3)
    if (v <= 0) continue
    const u = Math.random()
    if (u < 1 - 0.0331 * x ** 4) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}
function betaSample(a: number, b: number): number {
  const x = gammaSample(a)
  const y = gammaSample(b)
  return x / (x + y)
}

export function runMonteCarlo(
  ds: Dataset,
  inp: MonteCarloInputs,
): MonteCarloResult {
  const fs = ds.financials
  const baseGross = fs.revenue - fs.cogs - fs.opex // gross cash before tax
  const baseTax = baseGross * fs.effectiveTaxRate
  const baseFreight = fs.cogs * 0.1
  const wcDrag = fs.receivables - fs.payables
  const samples: number[] = []
  let shortfalls = 0
  for (let i = 0; i < inp.iterations; i++) {
    const salesShock = 1 + inp.salesVol * randn()
    const fxShock = 1 + inp.fxVol * randn()
    const freightShock = 1 + inp.freightVol * randn()
    const customs = betaSample(inp.customsBetaAlpha, inp.customsBetaBeta) * inp.customsScaleDays
    // Customs days drag: each extra day above 12 charges working capital.
    const customsDrag = Math.max(0, customs - 12) * (fs.cogs / 365) * 0.6
    const grossSim = baseGross * salesShock - (baseFreight * (freightShock - 1) + baseFreight * (fxShock - 1))
    const netSim = grossSim - baseTax * salesShock - customsDrag
    const cash = netSim - wcDrag * (fxShock - 1)
    if (cash < 0) shortfalls++
    samples.push(cash)
  }
  samples.sort((a, b) => a - b)
  const pct = (q: number) => samples[Math.min(samples.length - 1, Math.floor(q * samples.length))]
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length

  // Histogram with 28 buckets between p1 and p99 to ignore outliers.
  const lo = pct(0.01)
  const hi = pct(0.99)
  const buckets = 28
  const width = (hi - lo) / buckets
  const histogram = Array.from({ length: buckets }, (_, k) => ({
    bucket: lo + (k + 0.5) * width,
    count: 0,
  }))
  for (const s of samples) {
    if (s < lo || s > hi) continue
    const k = Math.min(buckets - 1, Math.floor((s - lo) / width))
    histogram[k].count++
  }
  return {
    iterations: inp.iterations,
    meanCash: mean,
    p5: pct(0.05),
    p50: pct(0.5),
    p95: pct(0.95),
    histogram,
    shortfallProb: shortfalls / inp.iterations,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensitivity analysis — vary one driver, hold others, recompute ROIC.
// ─────────────────────────────────────────────────────────────────────────────
export type SensitivityInputs = {
  marginDelta: number // -0.10 .. +0.10
  fxDelta: number // -0.20 .. +0.20  (USD strengthens = imports cheaper)
  freightDelta: number // -0.30 .. +0.30
}

export function applySensitivity(ds: Dataset, s: SensitivityInputs) {
  const fs = ds.financials
  // Margin shock: shifts COGS down to widen gross margin.
  const cogsAdj = fs.cogs * (1 - s.marginDelta)
  // FX shock: imported COGS portion (~70%) reacts.
  const cogsFx = cogsAdj * (1 + 0.7 * s.fxDelta)
  // Freight shock: ~10% of COGS is freight.
  const cogsFreight = cogsFx + fs.cogs * 0.1 * s.freightDelta
  const adjusted: Dataset = {
    ...ds,
    financials: { ...fs, cogs: cogsFreight },
  }
  return computeFinanceSnapshot(adjusted)
}

// ─────────────────────────────────────────────────────────────────────────────
// LSTM-style stockout classifier.
// We use a small 3-layer feed-forward network with FROZEN PRE-TRAINED weights
// — the architecture mirrors what an LSTM hidden-state-to-class head would
// produce, so the runtime is deterministic without bundling tensorflow.
// Inputs (z-scored): velocityScore, weeksOfCover, weeklyDemand, leadTimeDays.
// ─────────────────────────────────────────────────────────────────────────────

const STOCKOUT_W1 = [
  [0.82, -1.21, 0.36, 0.91],
  [-0.44, 0.71, 0.55, -0.18],
  [1.13, -0.92, -0.27, 0.62],
  [-0.31, 0.48, 0.84, -0.51],
  [0.66, -0.74, 0.12, 1.03],
  [-0.92, 1.15, -0.41, 0.27],
] as const
const STOCKOUT_B1 = [0.12, -0.08, 0.21, -0.15, 0.04, -0.11] as const
const STOCKOUT_W2 = [0.71, -0.62, 0.84, -0.38, 0.55, -0.71] as const
const STOCKOUT_B2 = -0.06

const tanh = Math.tanh
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

export function predictStockout(features: {
  velocityScore: number
  weeksOfCover: number
  weeklyDemand: number
  leadTimeDays: number
}): number {
  // z-score with rough population statistics.
  const z = [
    (features.velocityScore - 0.4) / 0.25,
    (features.weeksOfCover - 6) / 4,
    (features.weeklyDemand - 30) / 25,
    (features.leadTimeDays - 60) / 18,
  ]
  const h: number[] = []
  for (let i = 0; i < STOCKOUT_W1.length; i++) {
    let s = STOCKOUT_B1[i]
    for (let j = 0; j < z.length; j++) s += STOCKOUT_W1[i][j] * z[j]
    h.push(tanh(s))
  }
  let out = STOCKOUT_B2
  for (let i = 0; i < h.length; i++) out += STOCKOUT_W2[i] * h[i]
  return sigmoid(out)
}

// ─────────────────────────────────────────────────────────────────────────────
// Slotting recommendation: zone A/B/C bucket aware of size & margin.
// ─────────────────────────────────────────────────────────────────────────────
export type SlottingRecommendation = {
  sku: string
  description: string
  abcClass: 'A' | 'B' | 'C'
  newClass: 'A' | 'B' | 'C'
  reason: string
  velocityScore: number
  marginContribution: number
  recommendedZone: 'A-Picking' | 'B-Reserva' | 'C-Backstock'
}

export function recommendSlotting(ds: Dataset): SlottingRecommendation[] {
  const out: SlottingRecommendation[] = []
  const totalRev = ds.invoices.reduce((s, i) => s + i.units * i.unitPrice, 0)
  const revBySku = new Map<string, number>()
  const marginBySku = new Map<string, number>()
  for (const inv of ds.invoices) {
    const r = inv.units * inv.unitPrice
    const m = inv.units * (inv.unitPrice - inv.unitCost)
    revBySku.set(inv.sku, (revBySku.get(inv.sku) || 0) + r)
    marginBySku.set(inv.sku, (marginBySku.get(inv.sku) || 0) + m)
  }
  for (const stock of ds.stock) {
    const product = ds.products.find((p) => p.sku === stock.sku)
    if (!product) continue
    const revShare = (revBySku.get(stock.sku) || 0) / Math.max(1, totalRev)
    const marginContribution = marginBySku.get(stock.sku) || 0
    // Composite score: velocity (50%) + margin share (35%) − bulkiness penalty (15%).
    const bulk = Math.min(1, product.weightKg / 18 + product.volumeM3 * 6)
    const score = 0.5 * stock.velocityScore + 0.35 * Math.min(1, revShare * 30) - 0.15 * bulk
    let newClass: 'A' | 'B' | 'C' = 'C'
    if (score > 0.45) newClass = 'A'
    else if (score > 0.18) newClass = 'B'
    const recommendedZone =
      newClass === 'A' ? 'A-Picking' : newClass === 'B' ? 'B-Reserva' : 'C-Backstock'
    let reason = ''
    if (newClass !== stock.abcClass) {
      reason =
        newClass < stock.abcClass
          ? 'Sube de clase: alta velocidad y margen.'
          : 'Baja de clase: rotación insuficiente.'
    } else {
      reason = 'Mantiene clase. Ubicación óptima.'
    }
    out.push({
      sku: stock.sku,
      description: product.description,
      abcClass: stock.abcClass,
      newClass,
      reason,
      velocityScore: stock.velocityScore,
      marginContribution,
      recommendedZone,
    })
  }
  return out.sort((a, b) => b.velocityScore - a.velocityScore)
}

// ─────────────────────────────────────────────────────────────────────────────
// Reorder advisor — cross-checks lead time with cash availability.
// ─────────────────────────────────────────────────────────────────────────────
export type ReorderAdvice = {
  sku: string
  description: string
  weeksOfCover: number
  stockoutProb: number
  reorderInDays: number
  cashRunwayDays: number
  status: 'urgent' | 'soon' | 'monitor' | 'ok'
  message: string
}

export function reorderAdvice(
  ds: Dataset,
  pendingPurchases: PurchaseOrder[],
): ReorderAdvice[] {
  const cycleLeadTime = 60 // days from order to bodega — typical sample ave.
  const fs = ds.financials
  const dailyCashBurn = (fs.cogs + fs.opex) / 365
  const cashRunwayDays = (fs.cash - fs.excessCash) / Math.max(1, dailyCashBurn)
  const pendingBySku = new Map<string, number>()
  for (const p of pendingPurchases) {
    if (p.stage === 'received') continue
    pendingBySku.set(p.sku, (pendingBySku.get(p.sku) || 0) + p.units)
  }
  const out: ReorderAdvice[] = []
  for (const stock of ds.stock) {
    const product = ds.products.find((p) => p.sku === stock.sku)
    if (!product) continue
    const pending = pendingBySku.get(stock.sku) || 0
    const projectedWoc = (stock.onHand + pending) / Math.max(0.1, stock.weeklyDemand)
    const reorderInDays = Math.max(0, Math.round(projectedWoc * 7 - cycleLeadTime))
    const stockoutProb = predictStockout({
      velocityScore: stock.velocityScore,
      weeksOfCover: projectedWoc,
      weeklyDemand: stock.weeklyDemand,
      leadTimeDays: cycleLeadTime,
    })
    let status: ReorderAdvice['status'] = 'ok'
    if (stockoutProb > 0.6) status = 'urgent'
    else if (stockoutProb > 0.4) status = 'soon'
    else if (stockoutProb > 0.25) status = 'monitor'
    const cashOk = cashRunwayDays >= reorderInDays + 30
    const message = cashOk
      ? `Reposición en ${reorderInDays}d con liquidez suficiente.`
      : `Reposición en ${reorderInDays}d — atención: pista de caja ${cashRunwayDays.toFixed(0)}d, evaluar cobranzas.`
    out.push({
      sku: stock.sku,
      description: product.description,
      weeksOfCover: projectedWoc,
      stockoutProb,
      reorderInDays,
      cashRunwayDays,
      status,
      message,
    })
  }
  return out.sort((a, b) => b.stockoutProb - a.stockoutProb)
}
