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

type Rand = () => number

function makePick(rand: Rand) {
  return <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]
}

function makeRange(rand: Rand) {
  return (min: number, max: number): number => min + rand() * (max - min)
}

function buildProducts(rand: Rand): Product[] {
  const pick = makePick(rand)
  const range = makeRange(rand)
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

function buildInvoices(rand: Rand, products: Product[], reps: SalesRep[]): Invoice[] {
  const pick = makePick(rand)
  const range = makeRange(rand)
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

function buildPurchases(rand: Rand, products: Product[]): PurchaseOrder[] {
  const pick = makePick(rand)
  const range = makeRange(rand)
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

function buildStock(rand: Rand, products: Product[], invoices: Invoice[]): StockSnapshot[] {
  const range = makeRange(rand)
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

function buildCashTransactions(
  rand: Rand,
  invoices: Invoice[],
  purchases: PurchaseOrder[],
): import('./types').CashTransaction[] {
  const range = makeRange(rand)
  const out: import('./types').CashTransaction[] = []
  const accounts = ['1101 Banco Pichincha', '1102 Banco Guayaquil', '1103 Caja Chica']
  const branches: { id: string; name: string }[] = [
    { id: '01', name: 'Quito' },
    { id: '02', name: 'Guayaquil' },
    { id: '03', name: 'Cuenca' },
  ]
  let counter = 1
  // Inflows: ~95% of invoices generate a paid receipt within their cycle.
  for (const inv of invoices) {
    if (rand() > 0.95) continue
    const total = inv.units * inv.unitPrice
    const dateMs =
      new Date(inv.date).getTime() + Math.round(range(2, 35)) * 86400000
    const branch = branches[Math.floor(rand() * branches.length)]
    out.push({
      id: `CT-${counter.toString().padStart(5, '0')}`,
      date: new Date(dateMs).toISOString().slice(0, 10),
      type: 'AR Receipt',
      reference: `RCT-${counter.toString().padStart(4, '0')}`,
      branch: branch.id,
      branchName: branch.name,
      cashAccount: accounts[Math.floor(rand() * 2)],
      description: `Cobro factura ${inv.id}`,
      customerSupplier: inv.customer,
      amount: +total.toFixed(2),
      currency: 'USD',
      status: 'Released',
    })
    counter++
  }
  // Outflows: each PO triggers a vendor payment scheduled near arrival.
  // Apply 30% deposit on order. The 70% saldo only fires for POs that have
  // already cleared customs — those still in production/ocean/customs only
  // show the deposit, which is realistic.
  for (const po of purchases) {
    const value = po.units * po.unitCost + po.freightCost + po.dutiesCost
    const branch = branches[Math.floor(rand() * branches.length)]
    const orderTime = new Date(po.date).getTime()
    // 30% deposit at order
    out.push({
      id: `CT-${counter.toString().padStart(5, '0')}`,
      date: new Date(orderTime).toISOString().slice(0, 10),
      type: 'AP Payment',
      reference: `PMT-${counter.toString().padStart(4, '0')}`,
      branch: branch.id,
      branchName: branch.name,
      cashAccount: accounts[Math.floor(rand() * 2)],
      description: `Anticipo 30% PO ${po.id}`,
      customerSupplier: po.supplier,
      amount: -+(value * 0.3).toFixed(2),
      currency: 'USD',
      status: 'Released',
    })
    counter++
    // 70% only when the PO has reached inland or received stage.
    if (po.stage === 'inland' || po.stage === 'received') {
      const clearTime =
        orderTime + (po.productionDays + po.oceanDays + po.customsDays) * 86400000
      out.push({
        id: `CT-${counter.toString().padStart(5, '0')}`,
        date: new Date(clearTime).toISOString().slice(0, 10),
        type: 'AP Payment',
        reference: `PMT-${counter.toString().padStart(4, '0')}`,
        branch: branch.id,
        branchName: branch.name,
        cashAccount: accounts[Math.floor(rand() * 2)],
        description: `Saldo 70% PO ${po.id}`,
        customerSupplier: po.supplier,
        amount: -+(value * 0.7).toFixed(2),
        currency: 'USD',
        status: 'Released',
      })
      counter++
    }
  }
  // Sprinkle operating outflows: payroll, services, taxes (smaller scale to
  // keep the demo cash-positive).
  const operatingTypes: { type: string; range: [number, number]; party: string }[] = [
    { type: 'AP Payment', range: [3500, 6500], party: 'Nómina mensual' },
    { type: 'AP Payment', range: [220, 700], party: 'Empresa Eléctrica' },
    { type: 'AP Payment', range: [1100, 2200], party: 'SRI — IVA mensual' },
    { type: 'AP Payment', range: [180, 420], party: 'Servicios varios' },
  ]
  const start = new Date('2025-01-01').getTime()
  for (let m = 0; m < 16; m++) {
    for (const op of operatingTypes) {
      const dateMs = start + (m * 30 + Math.floor(rand() * 25)) * 86400000
      const branch = branches[Math.floor(rand() * branches.length)]
      out.push({
        id: `CT-${counter.toString().padStart(5, '0')}`,
        date: new Date(dateMs).toISOString().slice(0, 10),
        type: op.type,
        reference: `OP-${counter.toString().padStart(4, '0')}`,
        branch: branch.id,
        branchName: branch.name,
        cashAccount: accounts[Math.floor(rand() * 2)],
        description: op.party,
        customerSupplier: op.party,
        amount: -+range(op.range[0], op.range[1]).toFixed(2),
        currency: 'USD',
        status: 'Released',
      })
      counter++
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
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
  // Fresh PRNG on every call so SSR and client always see identical data,
  // even if the module is re-used across multiple server requests.
  const rand: Rand = mulberry32(42)
  const products = buildProducts(rand)
  const reps = buildReps()
  const invoices = buildInvoices(rand, products, reps)
  const purchases = buildPurchases(rand, products)
  const stock = buildStock(rand, products, invoices)
  const financials = buildFinancials(invoices)
  const cashTransactions = buildCashTransactions(rand, invoices, purchases)
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
    cashTransactions,
    journalEntries: [],
    landedCosts: [],
    payments: [],
    purchaseInvoices: [],
    inventoryTransfers: [],
    references: [],
  }
}
