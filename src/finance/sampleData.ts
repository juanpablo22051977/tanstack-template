import type {
  Category,
  Competitor,
  Dataset,
  FinancialStatements,
  Invoice,
  MacroSnapshot,
  Product,
  PurchaseOrder,
  SalesRep,
  StockSnapshot,
  WaccInputs,
  Zone,
} from './types'

const CATEGORIES: Category[] = [
  'Motor',
  'Suspension',
  'Frenos',
  'Electrico',
  'Carroceria',
  'Transmision',
  'Filtros',
  'Lubricantes',
]

const ZONES: Zone[] = ['Quito', 'Guayaquil', 'Cuenca', 'Manta', 'Ambato']

const BRANDS = ['Bosch', 'Denso', 'NGK', 'Mahle', 'SKF', 'Valeo', 'Brembo']

const SUPPLIERS = [
  'Shanghai AutoParts Co.',
  'Bosch Korea',
  'NGK Japan',
  'TaiwanCarParts Inc.',
  'Mexico Industrial Auto',
]

const ORIGIN_PORTS = ['Shanghai', 'Busan', 'Yokohama', 'Kaohsiung', 'Manzanillo']

// Deterministic pseudo-random so the demo remains stable between renders.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(42)

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

function range(min: number, max: number): number {
  return min + rand() * (max - min)
}

function buildProducts(): Product[] {
  const out: Product[] = []
  for (const cat of CATEGORIES) {
    for (let i = 0; i < 8; i++) {
      const cost = +range(15, 220).toFixed(2)
      const margin = range(0.28, 0.62)
      const price = +(cost / (1 - margin)).toFixed(2)
      const code = `${cat.slice(0, 3).toUpperCase()}-${(i + 1).toString().padStart(3, '0')}`
      out.push({
        sku: code,
        description: `${cat} ${pick(BRANDS)} ref. ${1000 + Math.floor(rand() * 8999)}`,
        category: cat,
        brand: pick(BRANDS),
        weightKg: +range(0.2, 18).toFixed(2),
        volumeM3: +range(0.001, 0.12).toFixed(4),
        unitCost: cost,
        unitPrice: price,
        imageHint: cat,
      })
    }
  }
  return out
}

function buildReps(): SalesRep[] {
  const names = [
    'Carla Mendoza',
    'Andrés Vélez',
    'Luis Paredes',
    'María Cabrera',
    'Diego Salazar',
    'Sofía Andrade',
    'Pablo Jaramillo',
    'Lucía Robalino',
    'Jorge Peña',
    'Verónica Sosa',
  ]
  return names.map((name, i) => ({
    id: `rep-${i + 1}`,
    name,
    zone: ZONES[i % ZONES.length],
  }))
}

function buildInvoices(products: Product[], reps: SalesRep[]): Invoice[] {
  const out: Invoice[] = []
  // 18 months of invoices, ~40 per month — chunky enough for analytics.
  const start = new Date('2024-11-01').getTime()
  const day = 24 * 60 * 60 * 1000
  for (let m = 0; m < 18; m++) {
    const monthlyCount = 38 + Math.floor(rand() * 14)
    // Seasonality bump for Filtros + Lubricantes in months Apr-Aug.
    const month = (10 + m) % 12
    const seasonal = month >= 3 && month <= 7 ? 1.18 : 0.92
    for (let i = 0; i < monthlyCount; i++) {
      const product = pick(products)
      const rep = pick(reps)
      const unitsBase = product.unitPrice > 100 ? range(1, 6) : range(2, 18)
      const units = Math.max(1, Math.round(unitsBase * seasonal))
      const dateMs = start + m * 30 * day + Math.floor(rand() * 28) * day
      const days = Math.round(range(2, 75))
      const status: Invoice['paidStatus'] =
        days <= 30 ? 'paid' : days <= 60 ? 'pending' : 'overdue'
      out.push({
        id: `INV-${(out.length + 1).toString().padStart(5, '0')}`,
        date: new Date(dateMs).toISOString().slice(0, 10),
        customer: `Taller ${pick(['Norte', 'Sur', 'Centro', 'Express', 'Premium'])} ${Math.floor(rand() * 200)}`,
        zone: rep.zone,
        repId: rep.id,
        category: product.category,
        sku: product.sku,
        units,
        unitPrice: +(product.unitPrice * range(0.92, 1.05)).toFixed(2),
        unitCost: product.unitCost,
        paidStatus: status,
        daysToCollect: days,
      })
    }
  }
  return out
}

function buildPurchases(products: Product[]): PurchaseOrder[] {
  const out: PurchaseOrder[] = []
  const start = new Date('2025-09-01').getTime()
  const day = 24 * 60 * 60 * 1000
  for (let i = 0; i < 22; i++) {
    const product = pick(products)
    const units = 80 + Math.floor(rand() * 420)
    // Beta-ish distribution for customs (skewed to ~12 days, tail to 35)
    const customsDays = Math.round(8 + Math.pow(rand(), 2.4) * 27)
    const ageDays = Math.floor(rand() * 110)
    const totalLead = 30 + 25 + customsDays + 5
    let stage: PurchaseOrder['stage'] = 'received'
    if (ageDays < 30) stage = 'production'
    else if (ageDays < 30 + 25) stage = 'ocean'
    else if (ageDays < 30 + 25 + customsDays) stage = 'customs'
    else if (ageDays < totalLead) stage = 'inland'
    out.push({
      id: `PO-${(i + 1).toString().padStart(4, '0')}`,
      date: new Date(start - ageDays * day).toISOString().slice(0, 10),
      supplier: pick(SUPPLIERS),
      originPort: pick(ORIGIN_PORTS),
      category: product.category,
      sku: product.sku,
      units,
      unitCost: product.unitCost,
      freightCost: +(units * product.unitCost * range(0.06, 0.14)).toFixed(2),
      dutiesCost: +(units * product.unitCost * range(0.18, 0.32)).toFixed(2),
      productionDays: 25 + Math.floor(rand() * 12),
      oceanDays: 22 + Math.floor(rand() * 12),
      customsDays,
      inlandDays: 3 + Math.floor(rand() * 6),
      stage,
    })
  }
  return out
}

function buildStock(products: Product[], invoices: Invoice[]): StockSnapshot[] {
  const demandBySku = new Map<string, number>()
  for (const inv of invoices) {
    demandBySku.set(inv.sku, (demandBySku.get(inv.sku) || 0) + inv.units)
  }
  const totalDemand = Array.from(demandBySku.values()).reduce((a, b) => a + b, 0)
  return products.map((p) => {
    const totalUnits = demandBySku.get(p.sku) || 0
    const weeklyDemand = totalUnits / 78 // ~18 months in weeks
    const onHand = Math.max(0, Math.round(weeklyDemand * range(1.5, 9)))
    const reorderPoint = Math.round(weeklyDemand * 4)
    const share = totalUnits / Math.max(1, totalDemand)
    const velocityScore = Math.min(1, share * 90)
    const abcClass: StockSnapshot['abcClass'] =
      velocityScore > 0.55 ? 'A' : velocityScore > 0.25 ? 'B' : 'C'
    const weeksOfCover = weeklyDemand > 0 ? onHand / weeklyDemand : 99
    const stockoutProb = Math.max(0, Math.min(1, 1 - weeksOfCover / 8))
    return {
      sku: p.sku,
      onHand,
      reorderPoint,
      weeklyDemand: +weeklyDemand.toFixed(2),
      weeksOfCover: +weeksOfCover.toFixed(1),
      abcClass,
      velocityScore: +velocityScore.toFixed(3),
      stockoutProb: +stockoutProb.toFixed(3),
    }
  })
}

function buildFinancials(invoices: Invoice[]): FinancialStatements {
  const revenue = invoices.reduce((s, i) => s + i.units * i.unitPrice, 0)
  const cogs = invoices.reduce((s, i) => s + i.units * i.unitCost, 0)
  return {
    revenue: +revenue.toFixed(2),
    cogs: +cogs.toFixed(2),
    opex: +(revenue * 0.18).toFixed(2),
    depreciation: +(revenue * 0.022).toFixed(2),
    effectiveTaxRate: 0.25,
    cash: +(revenue * 0.06).toFixed(2),
    excessCash: +(revenue * 0.025).toFixed(2),
    receivables: +(revenue * 0.14).toFixed(2),
    inventory: +(cogs * 0.32).toFixed(2),
    ppe: +(revenue * 0.18).toFixed(2),
    operatingLeases: +(revenue * 0.05).toFixed(2),
    payables: +(cogs * 0.11).toFixed(2),
    accruals: +(revenue * 0.04).toFixed(2),
    shortDebt: +(revenue * 0.08).toFixed(2),
    longDebt: +(revenue * 0.16).toFixed(2),
    equity: +(revenue * 0.34).toFixed(2),
  }
}

const DEFAULT_WACC: WaccInputs = {
  riskFreeRate: 0.045,
  countryRiskPremium: 0.062,
  equityRiskPremium: 0.055,
  beta: 1.15,
  costOfDebt: 0.092,
  taxRate: 0.25,
  debtWeight: 0.42,
  equityWeight: 0.58,
}

const DEFAULT_MACRO: MacroSnapshot = {
  inflation: 0.034,
  gdpAuto: 0.021,
  countryRisk: 0.062,
  fxRisk: 0.018,
}

const DEFAULT_COMPETITORS: Competitor[] = [
  { name: 'AutoRepuestos Andinos', marketShare: 0.18, avgPrice: 142, notes: 'Líder en Frenos' },
  { name: 'Mega Parts EC', marketShare: 0.14, avgPrice: 138, notes: 'Fuerte en Costa' },
  { name: 'ImportAuto SA', marketShare: 0.11, avgPrice: 151, notes: 'Premium' },
  { name: 'Davila (nosotros)', marketShare: 0.16, avgPrice: 144, notes: 'Cobertura nacional' },
]

export function buildSampleDataset(): Dataset {
  const products = buildProducts()
  const reps = buildReps()
  const invoices = buildInvoices(products, reps)
  const purchases = buildPurchases(products)
  const stock = buildStock(products, invoices)
  const financials = buildFinancials(invoices)
  return {
    products,
    reps,
    invoices,
    purchases,
    stock,
    financials,
    wacc: DEFAULT_WACC,
    macro: DEFAULT_MACRO,
    competitors: DEFAULT_COMPETITORS,
    warehouses: [],
    customers: [],
    suppliers: [],
    cashTransactions: [],
    references: [],
  }
}
