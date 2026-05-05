import type { Invoice, Zone, Category } from './types'

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
      else if (c === ',') {
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

// Header aliases — Spanish/English.
const HEADER_ALIASES: Record<string, string[]> = {
  date: ['date', 'fecha', 'fecha_emision', 'emision'],
  invoiceId: ['invoice', 'invoice_id', 'factura', 'numero', 'comprobante'],
  customer: ['customer', 'cliente', 'razon_social'],
  zone: ['zone', 'zona', 'ciudad', 'region'],
  repId: ['rep', 'rep_id', 'vendedor', 'agente'],
  category: ['category', 'categoria', 'linea', 'familia'],
  sku: ['sku', 'codigo', 'producto', 'item'],
  units: ['units', 'unidades', 'cantidad', 'qty'],
  unitPrice: ['unit_price', 'precio', 'precio_unitario', 'pvp'],
  unitCost: ['unit_cost', 'costo', 'costo_unitario'],
  daysToCollect: ['days_to_collect', 'dias_cobro', 'plazo'],
  paidStatus: ['status', 'estado', 'paid_status', 'cobrado'],
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

export type CsvImportResult = {
  invoices: Invoice[]
  warnings: string[]
  detectedColumns: Record<string, string>
}

export function importInvoicesCsv(text: string): CsvImportResult {
  const rows = parseCsv(text)
  if (rows.length < 2) {
    return { invoices: [], warnings: ['CSV vacío'], detectedColumns: {} }
  }
  const headers = rows[0].map(normalize)
  const idx: Record<string, number> = {}
  const detected: Record<string, string> = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const i = findColumn(headers, aliases)
    if (i >= 0) {
      idx[field] = i
      detected[field] = rows[0][i]
    }
  }
  const warnings: string[] = []
  const required = ['date', 'sku', 'units', 'unitPrice']
  for (const r of required) {
    if (!(r in idx)) warnings.push(`Columna requerida no encontrada: ${r}`)
  }
  const invoices: Invoice[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (row.every((c) => !c?.trim())) continue
    const get = (k: string) => (k in idx ? row[idx[k]] : '')
    const num = (s: string) => parseFloat((s || '0').replace(',', '.')) || 0
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
  return { invoices, warnings, detectedColumns: detected }
}
