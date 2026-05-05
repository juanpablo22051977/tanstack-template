import { useRef } from 'react'
import { Upload, RefreshCw, Calendar, Layers, ChevronRight } from 'lucide-react'
import { dashboardActions, dashboardStore, useDashboard } from '../store'
import { importInvoicesCsv } from '../../finance/csvParser'
import type { DrillPath } from '../../finance/types'

export function TopBar() {
  const dateRange = useDashboard((s) => s.dateRange)
  const drill = useDashboard((s) => s.drill)
  const isSample = useDashboard((s) => s.isSample)
  const importNotice = useDashboard((s) => s.importNotice)
  const fileInput = useRef<HTMLInputElement>(null)

  const onCsv = async (file: File) => {
    const text = await file.text()
    const result = importInvoicesCsv(text)
    const ds = dashboardStore.state.dataset
    if (result.invoices.length === 0) {
      dashboardActions.setDataset(
        ds,
        false,
        `Importación falló: ${result.warnings.join(', ') || 'sin filas'}`,
      )
      return
    }
    // Rebuild financials from imported invoices (simple top-line aggregation).
    const revenue = result.invoices.reduce((s, i) => s + i.units * i.unitPrice, 0)
    const cogs = result.invoices.reduce((s, i) => s + i.units * i.unitCost, 0)
    dashboardActions.setDataset(
      {
        ...ds,
        invoices: result.invoices,
        financials: {
          ...ds.financials,
          revenue,
          cogs,
          opex: revenue * 0.18,
          depreciation: revenue * 0.022,
          receivables: revenue * 0.14,
          inventory: cogs * 0.32,
          payables: cogs * 0.11,
        },
      },
      false,
      `Importadas ${result.invoices.length} facturas. Columnas: ${Object.entries(result.detectedColumns)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}`,
    )
  }

  return (
    <div className="sticky top-0 z-20 backdrop-blur-xl bg-slate-950/70 border-b border-white/10">
      <div className="px-6 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
            <Layers className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-orange-300/90 font-semibold">
              Importaciones Davila
            </div>
            <div className="text-xs text-slate-400 -mt-0.5">
              Executive Intelligence — Ecuador
            </div>
          </div>
        </div>

        <div className="h-8 w-px bg-white/10 mx-2 hidden md:block" />

        <DrillBreadcrumb drill={drill} />

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <DateRangeBox
            range={dateRange}
            onChange={dashboardActions.setDateRange}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-orange-200 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 transition"
          >
            <Upload className="w-3.5 h-3.5" /> Importar CSV
          </button>
          <button
            type="button"
            onClick={() => dashboardActions.resetSample()}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition"
            title="Reset al dataset de demo"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <input
            type="file"
            ref={fileInput}
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onCsv(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>
      {importNotice ? (
        <div className="px-6 pb-2 text-[11px] text-orange-300/80">
          {importNotice}
        </div>
      ) : isSample ? (
        <div className="px-6 pb-2 text-[11px] text-slate-500">
          Mostrando dataset de demostración. Carga un CSV para ver tus datos.
        </div>
      ) : null}
    </div>
  )
}

function DrillBreadcrumb({ drill }: { drill: DrillPath }) {
  const parts: { label: string; level: keyof DrillPath | 'root' }[] = [
    { label: 'Global', level: 'root' },
  ]
  if (drill.category) parts.push({ label: drill.category, level: 'category' })
  if (drill.zone) parts.push({ label: drill.zone, level: 'zone' })
  if (drill.repId) parts.push({ label: drill.repId, level: 'repId' })
  if (drill.sku) parts.push({ label: drill.sku, level: 'sku' })
  if (drill.invoiceId) parts.push({ label: drill.invoiceId, level: 'invoiceId' })
  return (
    <div className="flex items-center gap-1 text-xs">
      {parts.map((p, i) => (
        <button
          key={i}
          type="button"
          onClick={() => dashboardActions.popDrillTo(p.level)}
          className={`flex items-center gap-1 transition ${
            i === parts.length - 1
              ? 'text-orange-300 font-medium cursor-default'
              : 'text-slate-400 hover:text-orange-300'
          }`}
          disabled={i === parts.length - 1}
        >
          {i > 0 ? <ChevronRight className="w-3 h-3 text-slate-600" /> : null}
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  )
}

function DateRangeBox({
  range,
  onChange,
}: {
  range: { from: string; to: string } | null
  onChange: (r: { from: string; to: string } | null) => void
}) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <Calendar className="w-3.5 h-3.5 text-slate-500" />
      <input
        type="date"
        value={range?.from || ''}
        onChange={(e) =>
          onChange(e.target.value ? { from: e.target.value, to: range?.to || e.target.value } : null)
        }
        className="bg-white/5 border border-white/10 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-orange-400/60"
      />
      <span className="text-slate-600">→</span>
      <input
        type="date"
        value={range?.to || ''}
        onChange={(e) =>
          onChange(range?.from ? { from: range.from, to: e.target.value } : null)
        }
        className="bg-white/5 border border-white/10 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-orange-400/60"
      />
      {range ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-slate-500 hover:text-orange-300 px-1"
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
