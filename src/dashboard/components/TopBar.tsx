import { useRef, useState } from 'react'
import {
  Upload,
  RefreshCw,
  Calendar,
  Layers,
  ChevronRight,
  X,
  FileSpreadsheet,
  AlertTriangle,
  ChevronDown,
  Trash2,
} from 'lucide-react'
import { dashboardActions, useDashboard } from '../store'
import type { DrillPath } from '../../finance/types'
import type { CsvKind } from '../../finance/csvParser'
import type { ImportedFile } from '../store'

const KIND_LABEL: Record<CsvKind, string> = {
  invoices: 'Facturas',
  purchases: 'Importaciones',
  products: 'Productos',
  stock: 'Stock',
  warehouses: 'Almacenes',
  customers: 'Clientes',
  suppliers: 'Proveedores',
  reference: 'Referencia',
}

const KIND_STYLE: Record<CsvKind, string> = {
  invoices: 'bg-orange-500/15 text-orange-200 ring-orange-500/30',
  purchases: 'bg-amber-500/15 text-amber-200 ring-amber-500/30',
  products: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30',
  stock: 'bg-sky-500/15 text-sky-200 ring-sky-500/30',
  warehouses: 'bg-violet-500/15 text-violet-200 ring-violet-500/30',
  customers: 'bg-cyan-500/15 text-cyan-200 ring-cyan-500/30',
  suppliers: 'bg-fuchsia-500/15 text-fuchsia-200 ring-fuchsia-500/30',
  reference: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
}

export function TopBar() {
  const dateRange = useDashboard((s) => s.dateRange)
  const drill = useDashboard((s) => s.drill)
  const isSample = useDashboard((s) => s.isSample)
  const importNotice = useDashboard((s) => s.importNotice)
  const importedFiles = useDashboard((s) => s.importedFiles)
  const fileInput = useRef<HTMLInputElement>(null)
  const [filesPanelOpen, setFilesPanelOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const onCsv = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      await dashboardActions.importCsvFiles(Array.from(files))
      setFilesPanelOpen(true)
    } finally {
      setBusy(false)
    }
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    if (!e.dataTransfer.files) return
    await onCsv(e.dataTransfer.files)
  }

  return (
    <div
      className="sticky top-0 z-20 backdrop-blur-xl bg-slate-950/70 border-b border-white/10"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
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

          {importedFiles.length > 0 ? (
            <button
              type="button"
              onClick={() => setFilesPanelOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-orange-300" />
              {importedFiles.length} archivo{importedFiles.length === 1 ? '' : 's'}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  filesPanelOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-orange-200 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 transition disabled:opacity-50"
            title="Selecciona uno o varios CSV (facturas, importaciones, productos, stock)"
          >
            <Upload className="w-3.5 h-3.5" /> {busy ? 'Procesando…' : 'Importar CSV'}
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
            multiple
            className="hidden"
            onChange={(e) => {
              onCsv(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {filesPanelOpen && importedFiles.length > 0 ? (
        <FilesPanel
          files={importedFiles}
          onClose={() => setFilesPanelOpen(false)}
          onRemove={(id) => dashboardActions.removeImportedFile(id)}
        />
      ) : null}

      {importNotice ? (
        <div className="px-6 pb-2 text-[11px] text-orange-300/80 flex items-start justify-between gap-3">
          <span className="flex-1">{importNotice}</span>
          <button
            type="button"
            onClick={() => dashboardActions.clearImportNotice()}
            className="text-slate-500 hover:text-orange-300"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : isSample ? (
        <div className="px-6 pb-2 text-[11px] text-slate-500">
          Mostrando dataset de demostración. Arrastra o selecciona uno o varios
          CSV (facturas, importaciones, productos, stock) para ver tus datos.
        </div>
      ) : null}
    </div>
  )
}

function FilesPanel({
  files,
  onClose,
  onRemove,
}: {
  files: ImportedFile[]
  onClose: () => void
  onRemove: (id: string) => void
}) {
  const totals = files.reduce<Record<CsvKind, number>>(
    (acc, f) => {
      acc[f.kind] = (acc[f.kind] || 0) + f.rowCount
      return acc
    },
    {
      invoices: 0,
      purchases: 0,
      products: 0,
      stock: 0,
      warehouses: 0,
      customers: 0,
      suppliers: 0,
      reference: 0,
    } as Record<CsvKind, number>,
  )
  const totalKinds: CsvKind[] = [
    'invoices',
    'purchases',
    'products',
    'stock',
    'warehouses',
    'customers',
    'suppliers',
    'reference',
  ]
  return (
    <div className="px-6 pb-3">
      <div className="rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-orange-300/90 font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Archivos importados
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            {totalKinds
              .filter((k) => totals[k])
              .map((k) => (
                <span key={k} className="tabular-nums">
                  {KIND_LABEL[k]}:{' '}
                  <span className="text-orange-300 font-semibold">
                    {totals[k].toLocaleString('en-US')}
                  </span>
                </span>
              ))}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-orange-300 ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 flex items-start gap-2"
            >
              <div className="mt-0.5">
                <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-xs text-slate-200 font-medium truncate max-w-[200px]">
                    {f.name}
                  </div>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] ring-1 ${KIND_STYLE[f.kind]}`}
                  >
                    {KIND_LABEL[f.kind]}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 tabular-nums mt-0.5">
                  {f.rowCount.toLocaleString('en-US')} filas
                  {Object.keys(f.detectedColumns).length > 0 ? (
                    <span className="ml-2 text-slate-600">
                      cols: {Object.keys(f.detectedColumns).slice(0, 4).join(', ')}
                      {Object.keys(f.detectedColumns).length > 4 ? '…' : ''}
                    </span>
                  ) : null}
                </div>
                {f.warnings.length > 0 ? (
                  <div className="text-[10px] text-amber-300/80 mt-0.5 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{f.warnings.join(' · ')}</span>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                className="text-slate-500 hover:text-rose-300 transition shrink-0"
                title="Quitar del registro"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
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
