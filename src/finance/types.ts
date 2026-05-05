// Domain model for IMPORTACIONESDAVILA — auto parts importer in Ecuador.
// All monetary values are in USD. All dates are ISO yyyy-mm-dd.

export type Category =
  | 'Motor'
  | 'Suspension'
  | 'Frenos'
  | 'Electrico'
  | 'Carroceria'
  | 'Transmision'
  | 'Filtros'
  | 'Lubricantes'

export type Zone = 'Quito' | 'Guayaquil' | 'Cuenca' | 'Manta' | 'Ambato'

export type SalesRep = {
  id: string
  name: string
  zone: Zone
}

export type Product = {
  sku: string
  description: string
  category: Category
  brand: string
  weightKg: number
  volumeM3: number
  unitCost: number
  unitPrice: number
  imageHint: string
}

export type Invoice = {
  id: string
  date: string
  customer: string
  zone: Zone
  repId: string
  category: Category
  sku: string
  units: number
  unitPrice: number
  unitCost: number
  paidStatus: 'paid' | 'pending' | 'overdue'
  daysToCollect: number
}

export type PurchaseOrder = {
  id: string
  date: string
  supplier: string
  originPort: string
  category: Category
  sku: string
  units: number
  unitCost: number
  freightCost: number
  dutiesCost: number
  // Stochastic stage durations (days)
  productionDays: number
  oceanDays: number
  customsDays: number
  inlandDays: number
  stage:
    | 'production'
    | 'ocean'
    | 'customs'
    | 'inland'
    | 'received'
}

export type StockSnapshot = {
  sku: string
  onHand: number
  reorderPoint: number
  weeklyDemand: number
  weeksOfCover: number
  abcClass: 'A' | 'B' | 'C'
  velocityScore: number // 0..1
  stockoutProb: number // 0..1
}

export type FinancialStatements = {
  // Operating
  revenue: number
  cogs: number
  opex: number
  depreciation: number
  // Tax
  effectiveTaxRate: number
  // Balance sheet snippets
  cash: number
  excessCash: number
  receivables: number
  inventory: number
  ppe: number
  operatingLeases: number
  payables: number
  accruals: number
  shortDebt: number
  longDebt: number
  equity: number
}

export type WaccInputs = {
  riskFreeRate: number
  countryRiskPremium: number // Ecuador
  equityRiskPremium: number
  beta: number
  costOfDebt: number
  taxRate: number
  debtWeight: number
  equityWeight: number
}

export type MacroSnapshot = {
  inflation: number
  gdpAuto: number
  countryRisk: number
  fxRisk: number
}

export type Competitor = {
  name: string
  marketShare: number
  avgPrice: number
  notes: string
}

export type Warehouse = {
  warehouseId: string
  locationId: string
  description: string
  active: boolean
  parentLocationId?: string
}

export type CustomerMaster = {
  id: string
  name: string
  zone?: string
  segment?: string
  creditLimit?: number
  paymentTerms?: number
}

export type SupplierMaster = {
  id: string
  name: string
  country?: string
  category?: string
  paymentTerms?: number
}

export type ReferenceTable = {
  id: string
  name: string
  rowCount: number
  columns: string[]
  sample: Record<string, string>[] // up to ~50 rows for preview
}

export type CashTransaction = {
  id: string
  date: string
  type: string // TranType: e.g. 'Payment', 'Receipt', 'Transfer', 'Cash Sale'
  reference: string
  branch?: string
  branchName?: string
  cashAccount?: string
  description?: string
  customerSupplier?: string
  amount: number // signed (positive = inflow, negative = outflow)
  currency?: string
  status?: string
}

export type Dataset = {
  products: Product[]
  reps: SalesRep[]
  invoices: Invoice[]
  purchases: PurchaseOrder[]
  stock: StockSnapshot[]
  financials: FinancialStatements
  wacc: WaccInputs
  macro: MacroSnapshot
  competitors: Competitor[]
  warehouses: Warehouse[]
  customers: CustomerMaster[]
  suppliers: SupplierMaster[]
  cashTransactions: CashTransaction[]
  references: ReferenceTable[]
}

export type DateRange = {
  from: string
  to: string
}

export type DrillPath = {
  category?: Category
  zone?: Zone
  repId?: string
  sku?: string
  invoiceId?: string
}
