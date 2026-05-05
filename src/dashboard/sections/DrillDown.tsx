import { useMemo, useState } from 'react'
import { dashboardActions, useDashboard } from '../store'
import { aggregateBy, filterInvoices } from '../../finance/engine'
import type { Invoice } from '../../finance/types'
import { Glass, SectionHeader } from '../components/Glass'
import { BarChart } from '../components/Charts'
import { formatUsd, formatPct, formatNum } from '../format'
import { ChevronRight, X } from 'lucide-react'

export function DrillDown() {
  const ds = useDashboard((s) => s.dataset)
  const dateRange = useDashboard((s) => s.dateRange)
  const drill = useDashboard((s) => s.drill)
  const invoices = useMemo(
    () => filterInvoices(ds.invoices, dateRange, drill),
    [ds.invoices, dateRange, drill],
  )
  const [openInvoice, setOpenInvoice] = useState<Invoice | null>(null)

  const repNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of ds.reps) m.set(r.id, r.name)
    return m
  }, [ds.reps])

  const productByCode = useMemo(() => {
    const m = new Map(ds.products.map((p) => [p.sku, p]))
    return m
  }, [ds.products])

  // Choose drill level dynamically
  let level: 'category' | 'zone' | 'rep' | 'sku' | 'invoice' = 'category'
  if (drill.invoiceId) level = 'invoice'
  else if (drill.sku) level = 'invoice'
  else if (drill.repId) level = 'sku'
  else if (drill.zone) level = 'rep'
  else if (drill.category) level = 'zone'

  let buckets: { key: string; label: string; revenue: number; cogs: number; margin: number; units: number }[] = []
  let title = ''
  let onClick: ((b: { key: string }) => void) | undefined

  switch (level) {
    case 'category':
      buckets = aggregateBy(invoices, 'category')
      title = 'Por Categoría — click para hacer drill'
      onClick = (b) => dashboardActions.pushDrill({ category: b.key as never })
      break
    case 'zone':
      buckets = aggregateBy(invoices, 'zone')
      title = `Por Zona en ${drill.category}`
      onClick = (b) => dashboardActions.pushDrill({ zone: b.key as never })
      break
    case 'rep':
      buckets = aggregateBy(invoices, 'repId', (id) => repNameById.get(String(id)) || String(id))
      title = `Por Vendedor en ${drill.zone} · ${drill.category}`
      onClick = (b) => dashboardActions.pushDrill({ repId: b.key })
      break
    case 'sku':
      buckets = aggregateBy(invoices, 'sku', (sku) => {
        const p = productByCode.get(String(sku))
        return p ? `${sku} · ${p.description.slice(0, 22)}` : String(sku)
      })
      title = `Por SKU del vendedor ${repNameById.get(drill.repId || '') || ''}`
      onClick = (b) => dashboardActions.pushDrill({ sku: b.key })
      break
    case 'invoice':
      buckets = []
      title = `Facturas individuales`
      break
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Drill-Down Operativo"
        subtitle="Categoría → Zona → Vendedor → SKU → Factura"
        right={
          drill.category || drill.zone || drill.repId || drill.sku ? (
            <button
              type="button"
              onClick={() => dashboardActions.popDrillTo('root')}
              className="text-xs text-slate-400 hover:text-orange-300 transition flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> reset drill
            </button>
          ) : null
        }
      />

      {level !== 'invoice' ? (
        <Glass className="p-5">
          <div className="text-xs text-slate-400 mb-2">{title}</div>
          <BarChart
            data={buckets.slice(0, 12).map((b) => ({
              key: b.key,
              label: b.label,
              value: b.revenue,
            }))}
            valueFormat={(v) => formatUsd(v)}
            onClick={(item) => onClick && onClick({ key: item.key as string })}
            height={260}
          />
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {buckets.slice(0, 8).map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => onClick && onClick({ key: b.key })}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] hover:border-orange-400/40 hover:bg-orange-500/[0.06] px-3 py-2 transition group text-left"
              >
                <div>
                  <div className="text-slate-300 font-medium truncate max-w-[180px]">
                    {b.label}
                  </div>
                  <div className="text-slate-500 text-[10px]">
                    Margen {formatPct(b.margin)} · {formatNum(b.units)} u.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-orange-300 font-semibold tabular-nums">
                    {formatUsd(b.revenue)}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-orange-300 transition" />
                </div>
              </button>
            ))}
          </div>
        </Glass>
      ) : (
        <Glass className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-orange-400/90 font-semibold">
                Facturas
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {invoices.length} resultados — scroll para más
              </div>
            </div>
          </div>
          <div className="max-h-[460px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-950/95 backdrop-blur z-10">
                <tr className="text-slate-400 text-left">
                  <Th>Factura</Th>
                  <Th>Fecha</Th>
                  <Th>Cliente</Th>
                  <Th>SKU</Th>
                  <Th className="text-right">Unidades</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {invoices.slice(0, 200).map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => setOpenInvoice(inv)}
                    className="cursor-pointer hover:bg-orange-500/5 border-t border-white/5"
                  >
                    <Td className="text-slate-300 font-medium">{inv.id}</Td>
                    <Td className="text-slate-400">{inv.date}</Td>
                    <Td className="text-slate-300 truncate max-w-[200px]">
                      {inv.customer}
                    </Td>
                    <Td className="text-slate-400 font-mono">{inv.sku}</Td>
                    <Td className="text-right tabular-nums">{inv.units}</Td>
                    <Td className="text-right tabular-nums text-orange-300 font-semibold">
                      {formatUsd(inv.units * inv.unitPrice)}
                    </Td>
                    <Td>
                      <StatusBadge status={inv.paidStatus} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Glass>
      )}

      {openInvoice ? (
        <InvoiceModal
          invoice={openInvoice}
          productDescription={
            productByCode.get(openInvoice.sku)?.description || ''
          }
          repName={repNameById.get(openInvoice.repId) || openInvoice.repId}
          onClose={() => setOpenInvoice(null)}
        />
      ) : null}
    </section>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2 font-medium text-[11px] uppercase tracking-wider ${className}`}>
      {children}
    </th>
  )
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 ${className}`}>{children}</td>
}

function StatusBadge({ status }: { status: Invoice['paidStatus'] }) {
  const map = {
    paid: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
    pending: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
    overdue: 'bg-rose-500/15 text-rose-300 ring-rose-400/30',
  }
  const label = { paid: 'Pagada', pending: 'Pendiente', overdue: 'Vencida' }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ring-1 ${map[status]}`}
    >
      {label[status]}
    </span>
  )
}

function InvoiceModal({
  invoice,
  productDescription,
  repName,
  onClose,
}: {
  invoice: Invoice
  productDescription: string
  repName: string
  onClose: () => void
}) {
  const total = invoice.units * invoice.unitPrice
  const cost = invoice.units * invoice.unitCost
  const margin = total - cost
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl border border-orange-400/30 bg-slate-900/95 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-orange-300 font-semibold">
              Factura
            </div>
            <div className="text-2xl text-slate-100 font-semibold mt-1">
              {invoice.id}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <Field label="Fecha" value={invoice.date} />
          <Field label="Cliente" value={invoice.customer} />
          <Field label="Vendedor" value={repName} />
          <Field label="Zona" value={invoice.zone} />
          <Field
            label="SKU"
            value={
              <span className="font-mono text-slate-200">{invoice.sku}</span>
            }
          />
          <Field label="Categoría" value={invoice.category} />
        </div>

        <div className="mt-4 rounded-xl bg-white/[0.03] border border-white/10 p-3 text-xs text-slate-300">
          <div className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">
            Descripción del producto
          </div>
          <div className="text-slate-200">{productDescription}</div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Mini label="Unidades" value={invoice.units.toString()} />
          <Mini label="P. unitario" value={formatUsd(invoice.unitPrice, true)} />
          <Mini label="Total" value={formatUsd(total)} accent />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <Mini label="Costo total" value={formatUsd(cost)} />
          <Mini label="Margen $" value={formatUsd(margin)} accent />
          <Mini
            label="Plazo cobro"
            value={`${invoice.daysToCollect} días`}
          />
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="text-slate-200 mt-0.5">{value}</div>
    </div>
  )
}

function Mini({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 text-base font-semibold tabular-nums ${
          accent ? 'text-orange-300' : 'text-slate-100'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
