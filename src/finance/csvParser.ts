import type {
  CashTransaction,
  Category,
  CustomerMaster,
  Invoice,
  Product,
  PurchaseOrder,
  ReferenceTable,
  StockSnapshot,
  SupplierMaster,
  Warehouse,
  Zone,
} from './types'

// Lightweight CSV — handles quoted fields and embedded commas.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') {
        inQuotes = false
      } else {
        cur += c
      }
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',' || c === ';' || c === '\t') {
        row.push(cur)
        cur = ''
      } else if (c === '\n' || c === '\r') {
        if (cur.length > 0 || row.length > 0) {
          row.push(cur)
          rows.push(row)
        }
        row = []
        cur = ''
        if (c === '\r' && text[i + 1] === '\n') i++
      } else cur += c
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur)
    rows.push(row)
  }
  return rows
}

// ─────────────────────────────────────────────────────────────────────────────
// Header alias dictionaries — Spanish + English. Keys are the canonical
// internal field names; values are the recognised aliases (after normalize).
// ─────────────────────────────────────────────────────────────────────────────

const INVOICE_ALIASES: Record<string, string[]> = {
  date: ['date', 'fecha', 'fecha_emision', 'emision', 'fecha_factura'],
  invoiceId: ['invoice', 'invoice_id', 'factura', 'numero', 'comprobante', 'no_factura', 'nro'],
  customer: ['customer', 'cliente', 'razon_social', 'nombre_cliente'],
  zone: ['zone', 'zona', 'ciudad', 'region', 'provincia'],
  repId: ['rep', 'rep_id', 'vendedor', 'agente', 'cod_vendedor'],
  category: ['category', 'categoria', 'linea', 'familia', 'grupo'],
  sku: ['sku', 'codigo', 'producto', 'item', 'cod_item'],
  units: ['units', 'unidades', 'cantidad', 'qty', 'cant'],
  unitPrice: ['unit_price', 'precio', 'precio_unitario', 'pvp', 'pu'],
  unitCost: ['unit_cost', 'costo', 'costo_unitario', 'cu'],
  daysToCollect: ['days_to_collect', 'dias_cobro', 'plazo', 'dias'],
  paidStatus: ['status', 'estado', 'paid_status', 'cobrado'],
}

const PURCHASE_ALIASES: Record<string, string[]> = {
  date: ['date', 'fecha', 'fecha_orden', 'fecha_po'],
  poId: ['po', 'po_id', 'orden', 'numero_po', 'orden_compra'],
  supplier: ['supplier', 'proveedor', 'vendor', 'fabricante'],
  originPort: ['origin', 'puerto', 'origen', 'puerto_origen', 'port'],
  category: ['category', 'categoria', 'linea', 'familia'],
  sku: ['sku', 'codigo', 'producto', 'item'],
  units: ['units', 'unidades', 'cantidad', 'qty'],
  unitCost: ['unit_cost', 'costo', 'costo_unitario', 'fob'],
  freightCost: ['freight', 'flete', 'freight_cost', 'costo_flete'],
  dutiesCost: ['duties', 'aranceles', 'nacionalizacion', 'duties_cost'],
  productionDays: ['production_days', 'dias_produccion'],
  oceanDays: ['ocean_days', 'dias_transito', 'dias_maritimo'],
  customsDays: ['customs_days', 'dias_aduana'],
  inlandDays: ['inland_days', 'dias_inland', 'dias_terrestre'],
  stage: ['stage', 'etapa', 'estado_orden'],
}

const PRODUCT_ALIASES: Record<string, string[]> = {
  sku: ['sku', 'codigo', 'cod_item', 'item', 'producto'],
  description: ['description', 'descripcion', 'nombre', 'detalle'],
  category: ['category', 'categoria', 'linea', 'familia', 'grupo'],
  brand: ['brand', 'marca'],
  weightKg: ['weight', 'peso', 'peso_kg', 'weight_kg'],
  volumeM3: ['volume', 'volumen', 'volumen_m3', 'volume_m3'],
  unitCost: ['unit_cost', 'costo', 'costo_unitario'],
  unitPrice: ['unit_price', 'precio', 'precio_unitario', 'pvp'],
}

const STOCK_ALIASES: Record<string, string[]> = {
  sku: ['sku', 'codigo', 'cod_item', 'item', 'producto'],
  onHand: ['on_hand', 'stock', 'existencia', 'disponible', 'inventario'],
  reorderPoint: ['reorder_point', 'punto_reorden', 'min', 'minimo'],
  weeklyDemand: ['weekly_demand', 'demanda_semanal', 'demanda'],
}

const WAREHOUSE_ALIASES: Record<string, string[]> = {
  warehouseId: ['warehouseid', 'warehouse_id', 'almacen_id', 'almacen', 'cod_almacen', 'bodega', 'bodega_id'],
  locationId: ['locationid', 'location_id', 'ubicacion', 'ubicacion_id', 'loc_id'],
  description: ['description', 'descripcion', 'descripcion_2', 'description_2', 'nombre', 'detalle'],
  active: ['active', 'activo', 'estado', 'enabled'],
  parentLocationId: [
    'inlocation_locationid',
    'parent_location',
    'parent_locationid',
    'ubicacion_padre',
  ],
}

const CUSTOMER_ALIASES: Record<string, string[]> = {
  id: ['customerid', 'customer_id', 'cliente_id', 'cod_cliente', 'codigo_cliente', 'no_cliente', 'ruc', 'cedula'],
  name: ['name', 'nombre', 'razon_social', 'cliente_nombre', 'nombre_cliente', 'customer_name'],
  zone: ['zone', 'zona', 'ciudad', 'provincia', 'region'],
  segment: ['segment', 'segmento', 'tipo', 'categoria_cliente'],
  creditLimit: ['credit_limit', 'limite_credito', 'cupo'],
  paymentTerms: ['payment_terms', 'plazo', 'dias_credito', 'terms'],
}

const SUPPLIER_ALIASES: Record<string, string[]> = {
  id: ['supplierid', 'supplier_id', 'proveedor_id', 'cod_proveedor', 'no_proveedor', 'ruc', 'vendor_id'],
  name: ['name', 'nombre', 'razon_social', 'proveedor_nombre', 'nombre_proveedor', 'supplier_name', 'vendor_name'],
  country: ['country', 'pais', 'origen'],
  category: ['category', 'categoria', 'rubro'],
  paymentTerms: ['payment_terms', 'plazo', 'dias_pago', 'terms'],
}

const CASH_TRANSACTION_ALIASES: Record<string, string[]> = {
  id: ['tranid', 'tran_id', 'transactionid', 'transaction_id', 'id', 'noctran'],
  date: ['date', 'fecha', 'trandate', 'tran_date', 'transactiondate', 'fecha_tran', 'fecha_transaccion', 'docdate'],
  type: ['trantype', 'tran_type', 'type', 'tipo', 'tipotrans', 'tipo_transaccion', 'doctype', 'tipo_doc'],
  reference: ['referencenbr', 'reference_nbr', 'referenceno', 'referencia', 'reference', 'docnbr', 'doc_nbr', 'numero', 'no_documento'],
  branch: ['branch', 'sucursal', 'branchid', 'branch_id', 'cod_sucursal'],
  branchName: ['branchname', 'branch_name', 'sucursal_nombre', 'nombre_sucursal'],
  cashAccount: ['cashaccount', 'cash_account', 'cuenta_caja', 'cuenta_bancaria', 'bankaccount', 'bank_account'],
  description: ['description', 'descripcion', 'memo', 'descr', 'detalle', 'concepto'],
  customerSupplier: [
    'bizacctname',
    'biz_acct_name',
    'customername',
    'customer_name',
    'vendorname',
    'vendor_name',
    'cliente_proveedor',
    'tercero',
    'beneficiario',
  ],
  amount: ['curyamt', 'cury_amt', 'amount', 'monto', 'total', 'importe', 'valor', 'curytrandebitamt', 'curytrancreditamt'],
  currency: ['cury', 'currency', 'curyid', 'moneda'],
  status: ['status', 'estado', 'released', 'docstatus'],
}

function normalize(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./]+/g, '_')
    .replace(/[áä]/g, 'a')
    .replace(/[éë]/g, 'e')
    .replace(/[íï]/g, 'i')
    .replace(/[óö]/g, 'o')
    .replace(/[úü]/g, 'u')
    .replace(/ñ/g, 'n')
}

function findColumn(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    if (aliases.includes(headers[i])) return i
  }
  return -1
}

function buildIndex(headers: string[], aliases: Record<string, string[]>) {
  const idx: Record<string, number> = {}
  const detected: Record<string, string> = {}
  for (const [field, aka] of Object.entries(aliases)) {
    const i = findColumn(headers, aka)
    if (i >= 0) {
      idx[field] = i
      detected[field] = headers[i]
    }
  }
  return { idx, detected }
}

const ZONES: readonly Zone[] = ['Quito', 'Guayaquil', 'Cuenca', 'Manta', 'Ambato']
const CATEGORIES: readonly Category[] = [
  'Motor',
  'Suspension',
  'Frenos',
  'Electrico',
  'Carroceria',
  'Transmision',
  'Filtros',
  'Lubricantes',
]

function coerceZone(v: string): Zone {
  const norm = normalize(v)
  const found = ZONES.find((z) => normalize(z) === norm)
  return found || 'Quito'
}

function coerceCategory(v: string): Category {
  const norm = normalize(v)
  const found = CATEGORIES.find((c) => normalize(c) === norm)
  return found || 'Motor'
}

function coerceStatus(v: string): Invoice['paidStatus'] {
  const n = normalize(v)
  if (n.startsWith('pag') || n === 'paid') return 'paid'
  if (n.startsWith('venc') || n === 'overdue') return 'overdue'
  return 'pending'
}

function coerceStage(v: string): PurchaseOrder['stage'] {
  const n = normalize(v)
  if (n.startsWith('prod')) return 'production'
  if (n.startsWith('ocean') || n.startsWith('mar')) return 'ocean'
  if (n.startsWith('aduan') || n.startsWith('cust')) return 'customs'
  if (n.startsWith('inland') || n.startsWith('terr')) return 'inland'
  return 'received'
}

const num = (s: string) => parseFloat((s || '0').replace(',', '.')) || 0

// ─────────────────────────────────────────────────────────────────────────────
// Type detection: score the header against each known schema.
// ─────────────────────────────────────────────────────────────────────────────
export type CsvKind =
  | 'invoices'
  | 'purchases'
  | 'products'
  | 'stock'
  | 'warehouses'
  | 'customers'
  | 'suppliers'
  | 'cashTransactions'
  | 'reference'

function scoreSchema(headers: string[], aliases: Record<string, string[]>): number {
  let score = 0
  for (const aka of Object.values(aliases)) {
    if (findColumn(headers, aka) >= 0) score++
  }
  return score
}

type DiscriminatedKind = Exclude<CsvKind, 'reference'>

export function detectCsvKind(text: string): { kind: CsvKind; headers: string[] } {
  const rows = parseCsv(text)
  if (rows.length < 2) return { kind: 'reference', headers: [] }
  const headers = rows[0].map(normalize)

  const scores: Record<DiscriminatedKind, number> = {
    invoices: scoreSchema(headers, INVOICE_ALIASES),
    purchases: scoreSchema(headers, PURCHASE_ALIASES),
    products: scoreSchema(headers, PRODUCT_ALIASES),
    stock: scoreSchema(headers, STOCK_ALIASES),
    warehouses: scoreSchema(headers, WAREHOUSE_ALIASES),
    customers: scoreSchema(headers, CUSTOMER_ALIASES),
    suppliers: scoreSchema(headers, SUPPLIER_ALIASES),
    cashTransactions: scoreSchema(headers, CASH_TRANSACTION_ALIASES),
  }
  // Heuristics: discriminating columns break ties.
  const hasFreight = findColumn(headers, PURCHASE_ALIASES.freightCost) >= 0
  const hasInvoiceId = findColumn(headers, INVOICE_ALIASES.invoiceId) >= 0
  const hasOnHand = findColumn(headers, STOCK_ALIASES.onHand) >= 0
  const hasUnits = findColumn(headers, INVOICE_ALIASES.units) >= 0
  const hasWarehouseId = findColumn(headers, WAREHOUSE_ALIASES.warehouseId) >= 0
  const hasLocationId = findColumn(headers, WAREHOUSE_ALIASES.locationId) >= 0
  const hasCustomerId = findColumn(headers, CUSTOMER_ALIASES.id) >= 0
  const hasSupplierId = findColumn(headers, SUPPLIER_ALIASES.id) >= 0
  const hasSku = findColumn(headers, PRODUCT_ALIASES.sku) >= 0
  const hasTranType = findColumn(headers, CASH_TRANSACTION_ALIASES.type) >= 0
  const hasCashAccount = findColumn(headers, CASH_TRANSACTION_ALIASES.cashAccount) >= 0
  const hasReferenceNbr = findColumn(headers, CASH_TRANSACTION_ALIASES.reference) >= 0
  const hasAmount = findColumn(headers, CASH_TRANSACTION_ALIASES.amount) >= 0

  if (hasFreight) scores.purchases += 3
  if (hasInvoiceId && hasUnits) scores.invoices += 3
  if (hasOnHand) scores.stock += 4
  if (hasWarehouseId || hasLocationId) scores.warehouses += 4
  if (hasCustomerId && !hasSku) scores.customers += 3
  if (hasSupplierId && !hasSku) scores.suppliers += 3
  if (hasTranType && (hasCashAccount || hasReferenceNbr) && hasAmount) {
    scores.cashTransactions += 5
  } else if (hasCashAccount && hasAmount) {
    scores.cashTransactions += 3
  }

  let best: DiscriminatedKind = 'invoices'
  let bestScore = -1
  for (const [k, v] of Object.entries(scores) as [DiscriminatedKind, number][]) {
    if (v > bestScore) {
      best = k
      bestScore = v
    }
  }
  if (bestScore < 2) return { kind: 'reference', headers }
  return { kind: best, headers }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-kind parsers. Each returns rows and warnings.
// ─────────────────────────────────────────────────────────────────────────────
export type ParsedInvoices = {
  kind: 'invoices'
  invoices: Invoice[]
  warnings: string[]
  detectedColumns: Record<string, string>
}
export type ParsedPurchases = {
  kind: 'purchases'
  purchases: PurchaseOrder[]
  warnings: string[]
  detectedColumns: Record<string, string>
}
export type ParsedProducts = {
  kind: 'products'
  products: Product[]
  warnings: string[]
  detectedColumns: Record<string, string>
}
export type ParsedStock = {
  kind: 'stock'
  stock: StockSnapshot[]
  warnings: string[]
  detectedColumns: Record<string, string>
}
export type ParsedWarehouses = {
  kind: 'warehouses'
  warehouses: Warehouse[]
  warnings: string[]
  detectedColumns: Record<string, string>
}
export type ParsedCustomers = {
  kind: 'customers'
  customers: CustomerMaster[]
  warnings: string[]
  detectedColumns: Record<string, string>
}
export type ParsedSuppliers = {
  kind: 'suppliers'
  suppliers: SupplierMaster[]
  warnings: string[]
  detectedColumns: Record<string, string>
}
export type ParsedReference = {
  kind: 'reference'
  reference: ReferenceTable
  warnings: string[]
  detectedColumns: Record<string, string>
}
export type ParsedCashTransactions = {
  kind: 'cashTransactions'
  cashTransactions: CashTransaction[]
  warnings: string[]
  detectedColumns: Record<string, string>
}
export type ParsedCsv =
  | ParsedInvoices
  | ParsedPurchases
  | ParsedProducts
  | ParsedStock
  | ParsedWarehouses
  | ParsedCustomers
  | ParsedSuppliers
  | ParsedCashTransactions
  | ParsedReference

function parseInvoices(rows: string[][], headers: string[]): ParsedInvoices {
  const { idx, detected } = buildIndex(headers, INVOICE_ALIASES)
  const warnings: string[] = []
  const required = ['date', 'sku', 'units', 'unitPrice']
  for (const r of required) if (!(r in idx)) warnings.push(`Falta columna: ${r}`)
  const invoices: Invoice[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (row.every((c) => !c?.trim())) continue
    const get = (k: string) => (k in idx ? row[idx[k]] : '')
    const date = (get('date') || '').trim().slice(0, 10)
    const units = num(get('units'))
    const unitPrice = num(get('unitPrice'))
    const unitCost = num(get('unitCost')) || unitPrice * 0.6
    const days = num(get('daysToCollect')) || 30
    invoices.push({
      id: get('invoiceId') || `IMP-${r}`,
      date: date || new Date().toISOString().slice(0, 10),
      customer: get('customer') || 'Cliente sin nombre',
      zone: coerceZone(get('zone')),
      repId: get('repId') || 'rep-import',
      category: coerceCategory(get('category')),
      sku: get('sku') || `SKU-${r}`,
      units,
      unitPrice,
      unitCost,
      daysToCollect: days,
      paidStatus: coerceStatus(get('paidStatus')),
    })
  }
  return { kind: 'invoices', invoices, warnings, detectedColumns: detected }
}

function parsePurchases(rows: string[][], headers: string[]): ParsedPurchases {
  const { idx, detected } = buildIndex(headers, PURCHASE_ALIASES)
  const warnings: string[] = []
  const required = ['date', 'sku', 'units', 'unitCost']
  for (const r of required) if (!(r in idx)) warnings.push(`Falta columna: ${r}`)
  const purchases: PurchaseOrder[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (row.every((c) => !c?.trim())) continue
    const get = (k: string) => (k in idx ? row[idx[k]] : '')
    const units = num(get('units'))
    const unitCost = num(get('unitCost'))
    purchases.push({
      id: get('poId') || `PO-IMP-${r}`,
      date: (get('date') || '').trim().slice(0, 10) || new Date().toISOString().slice(0, 10),
      supplier: get('supplier') || 'Proveedor sin nombre',
      originPort: get('originPort') || 'Origen',
      category: coerceCategory(get('category')),
      sku: get('sku') || `SKU-${r}`,
      units,
      unitCost,
      freightCost: num(get('freightCost')) || units * unitCost * 0.1,
      dutiesCost: num(get('dutiesCost')) || units * unitCost * 0.25,
      productionDays: num(get('productionDays')) || 28,
      oceanDays: num(get('oceanDays')) || 28,
      customsDays: num(get('customsDays')) || 14,
      inlandDays: num(get('inlandDays')) || 5,
      stage: coerceStage(get('stage') || 'received'),
    })
  }
  return { kind: 'purchases', purchases, warnings, detectedColumns: detected }
}

function parseProducts(rows: string[][], headers: string[]): ParsedProducts {
  const { idx, detected } = buildIndex(headers, PRODUCT_ALIASES)
  const warnings: string[] = []
  const required = ['sku', 'description']
  for (const r of required) if (!(r in idx)) warnings.push(`Falta columna: ${r}`)
  const products: Product[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (row.every((c) => !c?.trim())) continue
    const get = (k: string) => (k in idx ? row[idx[k]] : '')
    const cost = num(get('unitCost'))
    const price = num(get('unitPrice')) || cost * 1.5
    products.push({
      sku: get('sku') || `SKU-${r}`,
      description: get('description') || 'Sin descripción',
      category: coerceCategory(get('category')),
      brand: get('brand') || 'Genérico',
      weightKg: num(get('weightKg')) || 1,
      volumeM3: num(get('volumeM3')) || 0.01,
      unitCost: cost,
      unitPrice: price,
      imageHint: '',
    })
  }
  return { kind: 'products', products, warnings, detectedColumns: detected }
}

function parseStock(rows: string[][], headers: string[]): ParsedStock {
  const { idx, detected } = buildIndex(headers, STOCK_ALIASES)
  const warnings: string[] = []
  if (!('sku' in idx)) warnings.push('Falta columna: sku')
  if (!('onHand' in idx)) warnings.push('Falta columna: on_hand')
  const stock: StockSnapshot[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (row.every((c) => !c?.trim())) continue
    const get = (k: string) => (k in idx ? row[idx[k]] : '')
    const onHand = num(get('onHand'))
    const weekly = num(get('weeklyDemand')) || Math.max(1, onHand / 8)
    const reorder = num(get('reorderPoint')) || Math.round(weekly * 4)
    const woc = weekly > 0 ? onHand / weekly : 99
    stock.push({
      sku: get('sku') || `SKU-${r}`,
      onHand,
      reorderPoint: reorder,
      weeklyDemand: weekly,
      weeksOfCover: +woc.toFixed(1),
      abcClass: 'B',
      velocityScore: Math.min(1, weekly / 50),
      stockoutProb: Math.max(0, Math.min(1, 1 - woc / 8)),
    })
  }
  return { kind: 'stock', stock, warnings, detectedColumns: detected }
}

function parseWarehouses(rows: string[][], headers: string[]): ParsedWarehouses {
  const { idx, detected } = buildIndex(headers, WAREHOUSE_ALIASES)
  const warnings: string[] = []
  if (!('warehouseId' in idx) && !('locationId' in idx)) {
    warnings.push('Falta columna: warehouse_id o location_id')
  }
  const warehouses: Warehouse[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (row.every((c) => !c?.trim())) continue
    const get = (k: string) => (k in idx ? row[idx[k]] : '')
    const warehouseId = get('warehouseId') || get('locationId') || `WH-${r}`
    const locationId = get('locationId') || warehouseId
    const activeRaw = normalize(get('active'))
    const active =
      activeRaw === 'true' ||
      activeRaw === '1' ||
      activeRaw === 'si' ||
      activeRaw === 'yes' ||
      activeRaw === 'activo' ||
      activeRaw === ''
    warehouses.push({
      warehouseId,
      locationId,
      description: get('description') || '',
      active,
      parentLocationId: get('parentLocationId') || undefined,
    })
  }
  return { kind: 'warehouses', warehouses, warnings, detectedColumns: detected }
}

function parseCustomers(rows: string[][], headers: string[]): ParsedCustomers {
  const { idx, detected } = buildIndex(headers, CUSTOMER_ALIASES)
  const warnings: string[] = []
  if (!('id' in idx) && !('name' in idx)) {
    warnings.push('Falta columna: id o nombre')
  }
  const customers: CustomerMaster[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (row.every((c) => !c?.trim())) continue
    const get = (k: string) => (k in idx ? row[idx[k]] : '')
    customers.push({
      id: get('id') || `CUST-${r}`,
      name: get('name') || `Cliente ${r}`,
      zone: get('zone') || undefined,
      segment: get('segment') || undefined,
      creditLimit: num(get('creditLimit')) || undefined,
      paymentTerms: num(get('paymentTerms')) || undefined,
    })
  }
  return { kind: 'customers', customers, warnings, detectedColumns: detected }
}

function parseSuppliers(rows: string[][], headers: string[]): ParsedSuppliers {
  const { idx, detected } = buildIndex(headers, SUPPLIER_ALIASES)
  const warnings: string[] = []
  if (!('id' in idx) && !('name' in idx)) {
    warnings.push('Falta columna: id o nombre')
  }
  const suppliers: SupplierMaster[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (row.every((c) => !c?.trim())) continue
    const get = (k: string) => (k in idx ? row[idx[k]] : '')
    suppliers.push({
      id: get('id') || `SUPP-${r}`,
      name: get('name') || `Proveedor ${r}`,
      country: get('country') || undefined,
      category: get('category') || undefined,
      paymentTerms: num(get('paymentTerms')) || undefined,
    })
  }
  return { kind: 'suppliers', suppliers, warnings, detectedColumns: detected }
}

function parseCashTransactions(
  rows: string[][],
  headers: string[],
): ParsedCashTransactions {
  const { idx, detected } = buildIndex(headers, CASH_TRANSACTION_ALIASES)
  const warnings: string[] = []
  if (!('amount' in idx)) warnings.push('Falta columna: monto/amount')
  if (!('date' in idx)) warnings.push('Falta columna: fecha/date')
  // Acumatica frequently splits into debit + credit columns; honour both.
  const debitIdx = headers.findIndex((h) =>
    ['curytrandebitamt', 'cury_tran_debit_amt', 'debe', 'debit_amt'].includes(h),
  )
  const creditIdx = headers.findIndex((h) =>
    ['curytrancreditamt', 'cury_tran_credit_amt', 'haber', 'credit_amt'].includes(h),
  )

  const cashTransactions: CashTransaction[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (row.every((c) => !c?.trim())) continue
    const get = (k: string) => (k in idx ? row[idx[k]] : '')
    let amount = num(get('amount'))
    if (debitIdx >= 0 || creditIdx >= 0) {
      const debit = debitIdx >= 0 ? num(row[debitIdx]) : 0
      const credit = creditIdx >= 0 ? num(row[creditIdx]) : 0
      amount = debit - credit
    }
    const type = (get('type') || '').trim()
    // If type implies an outflow, flip sign when amount is positive.
    const lowerType = type.toLowerCase()
    const isOutflow = /pay|payment|pago|egreso|withdrawal|cheque/.test(lowerType)
    const isInflow = /receipt|recib|cobro|deposit|deposito|ingreso/.test(lowerType)
    if (amount > 0 && isOutflow && !(debitIdx >= 0 || creditIdx >= 0)) {
      amount = -amount
    } else if (amount < 0 && isInflow) {
      amount = -amount
    }
    cashTransactions.push({
      id: get('id') || get('reference') || `CT-${r}`,
      date: (get('date') || '').trim().slice(0, 10) || new Date().toISOString().slice(0, 10),
      type: type || 'Tx',
      reference: get('reference') || '',
      branch: get('branch') || undefined,
      branchName: get('branchName') || undefined,
      cashAccount: get('cashAccount') || undefined,
      description: get('description') || undefined,
      customerSupplier: get('customerSupplier') || undefined,
      amount,
      currency: get('currency') || undefined,
      status: get('status') || undefined,
    })
  }
  return {
    kind: 'cashTransactions',
    cashTransactions,
    warnings,
    detectedColumns: detected,
  }
}

function parseReference(
  rows: string[][],
  rawHeaders: string[],
  fileName?: string,
): ParsedReference {
  const SAMPLE_SIZE = 50
  const sample: Record<string, string>[] = []
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c?.trim()))
  for (let r = 0; r < Math.min(SAMPLE_SIZE, dataRows.length); r++) {
    const row = dataRows[r]
    const obj: Record<string, string> = {}
    for (let c = 0; c < rawHeaders.length; c++) {
      obj[rawHeaders[c] || `col_${c}`] = row[c] || ''
    }
    sample.push(obj)
  }
  const reference: ReferenceTable = {
    id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: fileName || 'reference',
    rowCount: dataRows.length,
    columns: rawHeaders.filter(Boolean),
    sample,
  }
  return {
    kind: 'reference',
    reference,
    warnings: [
      `Tabla maestra/de referencia con ${reference.columns.length} columnas: ${reference.columns.slice(0, 5).join(', ')}${reference.columns.length > 5 ? '…' : ''}`,
    ],
    detectedColumns: {},
  }
}

export function parseAuto(text: string, fileName?: string): ParsedCsv {
  const rows = parseCsv(text)
  if (rows.length < 2) {
    return parseReference(rows, rows[0] || [], fileName)
  }
  const rawHeaders = rows[0]
  const headers = rawHeaders.map(normalize)
  const { kind } = detectCsvKind(text)
  switch (kind) {
    case 'invoices':
      return parseInvoices(rows, headers)
    case 'purchases':
      return parsePurchases(rows, headers)
    case 'products':
      return parseProducts(rows, headers)
    case 'stock':
      return parseStock(rows, headers)
    case 'warehouses':
      return parseWarehouses(rows, headers)
    case 'customers':
      return parseCustomers(rows, headers)
    case 'suppliers':
      return parseSuppliers(rows, headers)
    case 'cashTransactions':
      return parseCashTransactions(rows, headers)
    default:
      return parseReference(rows, rawHeaders, fileName)
  }
}

// Backwards-compat helper kept for callers that only need invoices.
export function importInvoicesCsv(text: string) {
  const r = parseAuto(text)
  if (r.kind === 'invoices') {
    return {
      invoices: r.invoices,
      warnings: r.warnings,
      detectedColumns: r.detectedColumns,
    }
  }
  return {
    invoices: [] as Invoice[],
    warnings: [`CSV detectado como "${r.kind}", no como "invoices"`],
    detectedColumns: 'detectedColumns' in r ? r.detectedColumns : {},
  }
}
