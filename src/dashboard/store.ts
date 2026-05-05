import { Store, useStore } from '@tanstack/react-store'
import type { Dataset, DateRange, DrillPath, WaccInputs } from '../finance/types'
import { buildSampleDataset } from '../finance/sampleData'
import { parseAuto, type CsvKind } from '../finance/csvParser'

export type SensitivityState = {
  marginDelta: number
  fxDelta: number
  freightDelta: number
}

export type MonteCarloState = {
  iterations: number
  salesVol: number
  fxVol: number
  freightVol: number
  customsBetaAlpha: number
  customsBetaBeta: number
  customsScaleDays: number
}

export type ImportedFile = {
  id: string
  name: string
  kind: CsvKind
  rowCount: number
  warnings: string[]
  detectedColumns: Record<string, string>
  importedAt: number
}

export type DashboardState = {
  dataset: Dataset
  isSample: boolean
  importedFiles: ImportedFile[]
  dateRange: DateRange | null
  drill: DrillPath
  sensitivity: SensitivityState
  monteCarlo: MonteCarloState
  importNotice: string | null
}

const initialDataset = buildSampleDataset()

export const dashboardStore = new Store<DashboardState>({
  dataset: initialDataset,
  isSample: true,
  importedFiles: [],
  dateRange: null,
  drill: {},
  sensitivity: { marginDelta: 0, fxDelta: 0, freightDelta: 0 },
  monteCarlo: {
    iterations: 10000,
    salesVol: 0.18,
    fxVol: 0.04,
    freightVol: 0.12,
    customsBetaAlpha: 2,
    customsBetaBeta: 5,
    customsScaleDays: 35,
  },
  importNotice: null,
})

// Re-derive financial statements from invoices.
function rebuildFinancials(ds: Dataset): Dataset {
  if (ds.invoices.length === 0) return ds
  const revenue = ds.invoices.reduce((s, i) => s + i.units * i.unitPrice, 0)
  const cogs = ds.invoices.reduce((s, i) => s + i.units * i.unitCost, 0)
  return {
    ...ds,
    financials: {
      ...ds.financials,
      revenue: +revenue.toFixed(2),
      cogs: +cogs.toFixed(2),
      opex: +(revenue * 0.18).toFixed(2),
      depreciation: +(revenue * 0.022).toFixed(2),
      receivables: +(revenue * 0.14).toFixed(2),
      inventory: +(cogs * 0.32).toFixed(2),
      payables: +(cogs * 0.11).toFixed(2),
    },
  }
}

// Apply a parsed CSV onto the working dataset, replacing the relevant slice.
function applyParsed(
  baseDataset: Dataset,
  freshFromImport: { invoices?: boolean; purchases?: boolean },
  parsed: ReturnType<typeof parseAuto>,
): Dataset {
  switch (parsed.kind) {
    case 'invoices': {
      const merged = freshFromImport.invoices
        ? [...baseDataset.invoices, ...parsed.invoices]
        : parsed.invoices
      return rebuildFinancials({ ...baseDataset, invoices: merged })
    }
    case 'purchases': {
      const merged = freshFromImport.purchases
        ? [...baseDataset.purchases, ...parsed.purchases]
        : parsed.purchases
      return { ...baseDataset, purchases: merged }
    }
    case 'products': {
      const map = new Map(baseDataset.products.map((p) => [p.sku, p]))
      for (const p of parsed.products) map.set(p.sku, p)
      return { ...baseDataset, products: [...map.values()] }
    }
    case 'stock': {
      const map = new Map(baseDataset.stock.map((s) => [s.sku, s]))
      for (const s of parsed.stock) map.set(s.sku, s)
      return { ...baseDataset, stock: [...map.values()] }
    }
    case 'warehouses': {
      const map = new Map(
        baseDataset.warehouses.map((w) => [`${w.warehouseId}::${w.locationId}`, w]),
      )
      for (const w of parsed.warehouses) {
        map.set(`${w.warehouseId}::${w.locationId}`, w)
      }
      return { ...baseDataset, warehouses: [...map.values()] }
    }
    case 'customers': {
      const map = new Map(baseDataset.customers.map((c) => [c.id, c]))
      for (const c of parsed.customers) map.set(c.id, c)
      return { ...baseDataset, customers: [...map.values()] }
    }
    case 'suppliers': {
      const map = new Map(baseDataset.suppliers.map((s) => [s.id, s]))
      for (const s of parsed.suppliers) map.set(s.id, s)
      return { ...baseDataset, suppliers: [...map.values()] }
    }
    case 'cashTransactions': {
      const key = (t: { id: string; date: string; amount: number }) =>
        `${t.id}::${t.date}::${t.amount}`
      const map = new Map(
        baseDataset.cashTransactions.map((t) => [key(t), t]),
      )
      for (const t of parsed.cashTransactions) map.set(key(t), t)
      return { ...baseDataset, cashTransactions: [...map.values()] }
    }
    case 'journalEntries': {
      const key = (j: { id: string; date: string; account: string; debit: number; credit: number }) =>
        `${j.id}::${j.date}::${j.account}::${j.debit}::${j.credit}`
      const map = new Map(baseDataset.journalEntries.map((j) => [key(j), j]))
      for (const j of parsed.journalEntries) map.set(key(j), j)
      return { ...baseDataset, journalEntries: [...map.values()] }
    }
    case 'landedCosts': {
      const key = (l: { id: string; reference: string; costCode?: string }) =>
        `${l.id}::${l.reference}::${l.costCode || ''}`
      const map = new Map(baseDataset.landedCosts.map((l) => [key(l), l]))
      for (const l of parsed.landedCosts) map.set(key(l), l)
      return { ...baseDataset, landedCosts: [...map.values()] }
    }
    case 'payments': {
      const key = (p: { id: string; date: string; amount: number }) =>
        `${p.id}::${p.date}::${p.amount}`
      const map = new Map(baseDataset.payments.map((p) => [key(p), p]))
      for (const p of parsed.payments) map.set(key(p), p)
      return { ...baseDataset, payments: [...map.values()] }
    }
    case 'purchaseInvoices': {
      const map = new Map(baseDataset.purchaseInvoices.map((p) => [p.id, p]))
      for (const p of parsed.purchaseInvoices) map.set(p.id, p)
      return { ...baseDataset, purchaseInvoices: [...map.values()] }
    }
    case 'inventoryTransfers': {
      const key = (t: { id: string; sku?: string }) => `${t.id}::${t.sku || ''}`
      const map = new Map(baseDataset.inventoryTransfers.map((t) => [key(t), t]))
      for (const t of parsed.inventoryTransfers) map.set(key(t), t)
      return { ...baseDataset, inventoryTransfers: [...map.values()] }
    }
    case 'reference': {
      return {
        ...baseDataset,
        references: [...baseDataset.references, parsed.reference],
      }
    }
    default:
      return baseDataset
  }
}

export const dashboardActions = {
  resetSample() {
    dashboardStore.setState((s) => ({
      ...s,
      dataset: buildSampleDataset(),
      isSample: true,
      importedFiles: [],
      drill: {},
      importNotice: null,
    }))
  },
  // Import several CSVs in one shot. The first import clears the sample
  // dataset; subsequent imports merge on top.
  async importCsvFiles(files: File[]) {
    if (files.length === 0) return
    const wasSample = dashboardStore.state.isSample
    let dataset = wasSample
      ? {
          ...dashboardStore.state.dataset,
          invoices: [],
          purchases: [],
        }
      : dashboardStore.state.dataset
    let importedFiles = wasSample ? [] : [...dashboardStore.state.importedFiles]
    const seenInvoicesThisBatch = { invoices: false, purchases: false }
    const summary: string[] = []
    for (const file of files) {
      const text = await file.text()
      const parsed = parseAuto(text, file.name)
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      let rowCount = 0
      switch (parsed.kind) {
        case 'invoices':
          rowCount = parsed.invoices.length
          break
        case 'purchases':
          rowCount = parsed.purchases.length
          break
        case 'products':
          rowCount = parsed.products.length
          break
        case 'stock':
          rowCount = parsed.stock.length
          break
        case 'warehouses':
          rowCount = parsed.warehouses.length
          break
        case 'customers':
          rowCount = parsed.customers.length
          break
        case 'suppliers':
          rowCount = parsed.suppliers.length
          break
        case 'cashTransactions':
          rowCount = parsed.cashTransactions.length
          break
        case 'journalEntries':
          rowCount = parsed.journalEntries.length
          break
        case 'landedCosts':
          rowCount = parsed.landedCosts.length
          break
        case 'payments':
          rowCount = parsed.payments.length
          break
        case 'purchaseInvoices':
          rowCount = parsed.purchaseInvoices.length
          break
        case 'inventoryTransfers':
          rowCount = parsed.inventoryTransfers.length
          break
        case 'reference':
          rowCount = parsed.reference.rowCount
          break
      }

      // Within a batch, the first invoices/purchases file *replaces* the
      // sample data; subsequent files of the same kind append. Across
      // batches we always append. Master data (products/stock/warehouses/
      // customers/suppliers) merges by key. Reference tables accumulate.
      const isReplaceableKind =
        parsed.kind === 'invoices' || parsed.kind === 'purchases'
      const isFirstOfKind =
        isReplaceableKind && !seenInvoicesThisBatch[parsed.kind]
      const freshFromImport = {
        invoices: parsed.kind === 'invoices' ? !isFirstOfKind : false,
        purchases: parsed.kind === 'purchases' ? !isFirstOfKind : false,
      }
      if (!wasSample && isReplaceableKind) {
        freshFromImport[parsed.kind] = true
      }

      dataset = applyParsed(dataset, freshFromImport, parsed)
      if (isReplaceableKind) seenInvoicesThisBatch[parsed.kind] = true

      importedFiles.push({
        id,
        name: file.name,
        kind: parsed.kind,
        rowCount,
        warnings: parsed.warnings,
        detectedColumns: 'detectedColumns' in parsed ? parsed.detectedColumns : {},
        importedAt: Date.now(),
      })
      summary.push(`${file.name}: ${parsed.kind} (${rowCount})`)
    }
    dashboardStore.setState((s) => ({
      ...s,
      dataset,
      isSample: false,
      importedFiles,
      drill: wasSample ? {} : s.drill,
      importNotice: `Importados ${files.length} archivo(s) — ${summary.join(' · ')}`,
    }))
  },
  removeImportedFile(id: string) {
    const { importedFiles } = dashboardStore.state
    const rest = importedFiles.filter((f) => f.id !== id)
    if (rest.length === 0) {
      dashboardActions.resetSample()
      return
    }
    dashboardStore.setState((s) => ({
      ...s,
      importedFiles: rest,
      importNotice: `Removido del registro: ${
        importedFiles.find((f) => f.id === id)?.name || ''
      }. Recarga los archivos para reconstruir el dataset.`,
    }))
  },
  setDateRange(range: DateRange | null) {
    dashboardStore.setState((s) => ({ ...s, dateRange: range }))
  },
  setDrill(drill: DrillPath) {
    dashboardStore.setState((s) => ({ ...s, drill }))
  },
  pushDrill(patch: Partial<DrillPath>) {
    dashboardStore.setState((s) => ({ ...s, drill: { ...s.drill, ...patch } }))
  },
  popDrillTo(level: keyof DrillPath | 'root') {
    dashboardStore.setState((s) => {
      if (level === 'root') return { ...s, drill: {} }
      const order: (keyof DrillPath)[] = ['category', 'zone', 'repId', 'sku', 'invoiceId']
      const cut = order.indexOf(level)
      const next: DrillPath = {}
      for (let i = 0; i <= cut; i++) {
        const k = order[i]
        if (s.drill[k] !== undefined) next[k] = s.drill[k] as never
      }
      return { ...s, drill: next }
    })
  },
  updateSensitivity(p: Partial<SensitivityState>) {
    dashboardStore.setState((s) => ({ ...s, sensitivity: { ...s.sensitivity, ...p } }))
  },
  updateMonteCarlo(p: Partial<MonteCarloState>) {
    dashboardStore.setState((s) => ({ ...s, monteCarlo: { ...s.monteCarlo, ...p } }))
  },
  updateWacc(p: Partial<WaccInputs>) {
    dashboardStore.setState((s) => ({
      ...s,
      dataset: { ...s.dataset, wacc: { ...s.dataset.wacc, ...p } },
    }))
  },
  clearImportNotice() {
    dashboardStore.setState((s) => ({ ...s, importNotice: null }))
  },
}

export function useDashboard<T>(selector: (s: DashboardState) => T): T {
  return useStore(dashboardStore, selector)
}
