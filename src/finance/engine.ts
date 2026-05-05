import type {
  DateRange,
  Dataset,
  DrillPath,
  FinancialStatements,
  Invoice,
  WaccInputs,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// McKinsey "Operating Approach" finance engine.
// References: Koller / Goedhart / Wessels — Valuation: Measuring and Managing
// the Value of Companies. All ratios use *operating* invested capital, not
// the accounting balance sheet, and NOPAT cleans out financing effects.
// ─────────────────────────────────────────────────────────────────────────────

export type FinanceSnapshot = {
  revenue: number
  cogs: number
  grossProfit: number
  grossMargin: number
  opex: number
  ebitda: number
  ebit: number
  nopat: number
  investedCapital: number
  roic: number
  wacc: number
  eva: number
  cfroi: number
  // Decomposition
  effectiveTaxRate: number
  capitalTurnover: number
  operatingMargin: number
  // Auxiliary
  excessCashAdjustment: number
  capitalizedLeases: number
}

const formula = {
  nopat: 'NOPAT = EBIT \\times (1 - t_{op})',
  investedCapital:
    'IC = (Op.Assets - Excess\\,Cash) + Cap.Leases - Op.Liabilities',
  roic: 'ROIC = \\dfrac{NOPAT}{Invested\\,Capital}',
  wacc:
    'WACC = w_e\\,k_e + w_d\\,k_d(1 - t)\\;,\\;k_e = r_f + \\beta\\,ERP + CRP',
  eva: 'EVA = (ROIC - WACC) \\times Invested\\,Capital',
  cfroi:
    'CFROI = \\dfrac{Gross\\,CashFlow_{infl.adj}}{Gross\\,Investment_{infl.adj}}',
} as const

export const FormulaTeX = formula

// ─────────────────────────────────────────────────────────────────────────────
// 1. NOPAT — strip out interest tax shield and use the operating tax rate.
// ─────────────────────────────────────────────────────────────────────────────
function computeNopat(fs: FinancialStatements) {
  const ebit = fs.revenue - fs.cogs - fs.opex - fs.depreciation
  const operatingTax = ebit * fs.effectiveTaxRate
  const nopat = ebit - operatingTax
  return { ebit, nopat }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Invested Capital — operating approach.
//    Strip excess cash; capitalize operating leases (8x annual rent proxy);
//    deduct non-interest-bearing operating liabilities.
// ─────────────────────────────────────────────────────────────────────────────
function computeInvestedCapital(fs: FinancialStatements) {
  const operatingCash = Math.max(0, fs.cash - fs.excessCash)
  const capitalizedLeases = fs.operatingLeases * 8
  const operatingAssets =
    operatingCash + fs.receivables + fs.inventory + fs.ppe + capitalizedLeases
  const operatingLiabilities = fs.payables + fs.accruals
  return {
    investedCapital: operatingAssets - operatingLiabilities,
    excessCashAdjustment: fs.excessCash,
    capitalizedLeases,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. WACC with Ecuador country risk premium baked into cost of equity.
// ─────────────────────────────────────────────────────────────────────────────
export function computeWacc(w: WaccInputs): number {
  const ke = w.riskFreeRate + w.beta * w.equityRiskPremium + w.countryRiskPremium
  const kd = w.costOfDebt * (1 - w.taxRate)
  return w.equityWeight * ke + w.debtWeight * kd
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CFROI — inflation-adjusted gross cash flow over gross investment.
// ─────────────────────────────────────────────────────────────────────────────
function computeCfroi(fs: FinancialStatements, inflation: number) {
  const grossCashFlow = fs.revenue - fs.cogs - fs.opex // pre-D&A
  const grossInvestment = fs.ppe + fs.inventory + fs.receivables - fs.payables
  if (grossInvestment <= 0) return 0
  // Bring to real terms by deflating one period.
  const real = grossCashFlow / (1 + inflation)
  return real / grossInvestment
}

export function computeFinanceSnapshot(ds: Dataset): FinanceSnapshot {
  const fs = ds.financials
  const { ebit, nopat } = computeNopat(fs)
  const { investedCapital, excessCashAdjustment, capitalizedLeases } =
    computeInvestedCapital(fs)
  const wacc = computeWacc(ds.wacc)
  const roic = investedCapital > 0 ? nopat / investedCapital : 0
  const eva = (roic - wacc) * investedCapital
  const cfroi = computeCfroi(fs, ds.macro.inflation)
  const grossProfit = fs.revenue - fs.cogs
  const ebitda = ebit + fs.depreciation
  const operatingMargin = fs.revenue > 0 ? ebit / fs.revenue : 0
  const capitalTurnover = investedCapital > 0 ? fs.revenue / investedCapital : 0
  return {
    revenue: fs.revenue,
    cogs: fs.cogs,
    grossProfit,
    grossMargin: fs.revenue > 0 ? grossProfit / fs.revenue : 0,
    opex: fs.opex,
    ebitda,
    ebit,
    nopat,
    investedCapital,
    roic,
    wacc,
    eva,
    cfroi,
    effectiveTaxRate: fs.effectiveTaxRate,
    capitalTurnover,
    operatingMargin,
    excessCashAdjustment,
    capitalizedLeases,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Drill-down helpers — operate on invoices.
// ─────────────────────────────────────────────────────────────────────────────
export function filterInvoices(
  invoices: Invoice[],
  range: DateRange | null,
  drill: DrillPath,
): Invoice[] {
  return invoices.filter((i) => {
    if (range && (i.date < range.from || i.date > range.to)) return false
    if (drill.category && i.category !== drill.category) return false
    if (drill.zone && i.zone !== drill.zone) return false
    if (drill.repId && i.repId !== drill.repId) return false
    if (drill.sku && i.sku !== drill.sku) return false
    if (drill.invoiceId && i.id !== drill.invoiceId) return false
    return true
  })
}

export type RevenueBucket = {
  key: string
  label: string
  revenue: number
  cogs: number
  margin: number
  units: number
}

export function aggregateBy<K extends keyof Invoice>(
  invoices: Invoice[],
  key: K,
  labeler?: (k: Invoice[K]) => string,
): RevenueBucket[] {
  const map = new Map<string, RevenueBucket>()
  for (const inv of invoices) {
    const k = String(inv[key])
    const existing = map.get(k) || {
      key: k,
      label: labeler ? labeler(inv[key]) : k,
      revenue: 0,
      cogs: 0,
      margin: 0,
      units: 0,
    }
    existing.revenue += inv.units * inv.unitPrice
    existing.cogs += inv.units * inv.unitCost
    existing.units += inv.units
    map.set(k, existing)
  }
  for (const v of map.values()) {
    v.margin = v.revenue > 0 ? (v.revenue - v.cogs) / v.revenue : 0
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
}

export type MonthlySeries = {
  month: string
  revenue: number
  cogs: number
  units: number
  invoices: number
}

export function monthlySeries(invoices: Invoice[]): MonthlySeries[] {
  const map = new Map<string, MonthlySeries>()
  for (const inv of invoices) {
    const m = inv.date.slice(0, 7)
    const e = map.get(m) || { month: m, revenue: 0, cogs: 0, units: 0, invoices: 0 }
    e.revenue += inv.units * inv.unitPrice
    e.cogs += inv.units * inv.unitCost
    e.units += inv.units
    e.invoices += 1
    map.set(m, e)
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
}

// ─────────────────────────────────────────────────────────────────────────────
// Volume vs price decomposition — "real growth vs inflation/FX".
// ─────────────────────────────────────────────────────────────────────────────
export type GrowthDecomposition = {
  prevRevenue: number
  currRevenue: number
  totalGrowth: number
  volumeEffect: number
  priceEffect: number
  mixEffect: number
}

export function decomposeGrowth(invoices: Invoice[]): GrowthDecomposition {
  const series = monthlySeries(invoices)
  if (series.length < 12) {
    return {
      prevRevenue: 0,
      currRevenue: 0,
      totalGrowth: 0,
      volumeEffect: 0,
      priceEffect: 0,
      mixEffect: 0,
    }
  }
  const half = Math.floor(series.length / 2)
  const prev = series.slice(0, half)
  const curr = series.slice(half)
  const sum = (s: MonthlySeries[], k: keyof MonthlySeries) =>
    s.reduce((a, b) => a + (b[k] as number), 0)
  const prevR = sum(prev, 'revenue')
  const currR = sum(curr, 'revenue')
  const prevU = sum(prev, 'units')
  const currU = sum(curr, 'units')
  const prevP = prevR / Math.max(1, prevU)
  const currP = currR / Math.max(1, currU)
  // Hybrid index: ΔV at prev price + ΔP at curr volume; residual = mix.
  const volumeEffect = (currU - prevU) * prevP
  const priceEffect = (currP - prevP) * currU
  const mixEffect = currR - prevR - volumeEffect - priceEffect
  return {
    prevRevenue: prevR,
    currRevenue: currR,
    totalGrowth: prevR > 0 ? (currR - prevR) / prevR : 0,
    volumeEffect,
    priceEffect,
    mixEffect,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cash conversion cycle — using AR / AP / Inventory days.
// ─────────────────────────────────────────────────────────────────────────────
export type CashCycle = {
  daysSalesOutstanding: number
  daysInventoryOutstanding: number
  daysPayableOutstanding: number
  cashConversionCycle: number
}

export function computeCashCycle(fs: FinancialStatements): CashCycle {
  const dso = fs.revenue > 0 ? (fs.receivables / fs.revenue) * 365 : 0
  const dio = fs.cogs > 0 ? (fs.inventory / fs.cogs) * 365 : 0
  const dpo = fs.cogs > 0 ? (fs.payables / fs.cogs) * 365 : 0
  return {
    daysSalesOutstanding: dso,
    daysInventoryOutstanding: dio,
    daysPayableOutstanding: dpo,
    cashConversionCycle: dso + dio - dpo,
  }
}
