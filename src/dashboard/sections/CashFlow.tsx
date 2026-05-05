import { useMemo, useState } from 'react'
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingDown,
  Clock,
  Building2,
  Search,
} from 'lucide-react'
import { useDashboard } from '../store'
import { Glass, SectionHeader } from '../components/Glass'
import { AreaLineChart, DonutMix, HorizontalBars } from '../components/Charts'
import { formatUsd, formatNum, formatDays, formatPct } from '../format'
import { computeCashFlow, type CashFlowEvent } from '../../finance/cashFlow'

export function CashFlow() {
  const ds = useDashboard((s) => s.dataset)
  const dateRange = useDashboard((s) => s.dateRange)
  const cf = useMemo(() => computeCashFlow(ds, dateRange), [ds, dateRange])
  const [query, setQuery] = useState('')
  const [counterpartyFilter, setCounterpartyFilter] = useState<string | null>(null)

  if (!cf.hasData) {
    return (
      <section className="space-y-6">
        <SectionHeader
          title="Cash Flow"
          subtitle="Flujo de caja real desde transacciones, pagos y asientos"
        />
        <Glass className="p-8 text-center">
          <Wallet className="w-8 h-8 text-orange-300/70 mx-auto mb-3" />
          <div className="text-slate-200 text-base font-medium">
            No hay datos de flujo de caja
          </div>
          <div className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
            Importa un CSV de tipo <span className="text-orange-300">Transacciones de caja</span>,{' '}
            <span className="text-orange-300">Pagos AP/AR</span> o{' '}
            <span className="text-orange-300">Asientos contables</span> con cuentas que empiecen en 11
            (caja/bancos) y esta sección se llenará automáticamente.
          </div>
        </Glass>
      </section>
    )
  }

  const filteredEvents = useMemo(() => {
    let arr = cf.events
    if (counterpartyFilter) {
      arr = arr.filter((e) => e.counterparty === counterpartyFilter)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      arr = arr.filter(
        (e) =>
          e.reference.toLowerCase().includes(q) ||
          (e.counterparty || '').toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q) ||
          e.type.toLowerCase().includes(q),
      )
    }
    return arr
  }, [cf.events, query, counterpartyFilter])

  const cumulativePoints = (() => {
    let running = 0
    return cf.monthly.map((m) => {
      running += m.net
      return { label: m.month.slice(2), value: running }
    })
  })()

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Cash Flow"
        subtitle={`${formatNum(cf.events.length)} eventos analizados — fuentes: ${detectSources(cf.events)}`}
        right={
          counterpartyFilter ? (
            <button
              type="button"
              onClick={() => setCounterpartyFilter(null)}
              className="text-xs text-orange-300 hover:text-orange-200"
            >
              limpiar filtro: {counterpartyFilter} ×
            </button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          icon={<ArrowDownCircle className="w-4 h-4" />}
          label="Inflow total"
          value={formatUsd(cf.totalInflow)}
          sub={`Promedio mensual ${formatUsd(cf.averageMonthlyInflow)}`}
          tone="positive"
        />
        <Kpi
          icon={<ArrowUpCircle className="w-4 h-4" />}
          label="Outflow total"
          value={formatUsd(cf.totalOutflow)}
          sub={`Quema mensual ${formatUsd(cf.averageMonthlyBurn)}`}
          tone="negative"
        />
        <Kpi
          icon={<Wallet className="w-4 h-4" />}
          label="Caja neta"
          value={formatUsd(cf.netCash)}
          sub={cf.netCash >= 0 ? 'Generación de caja positiva' : 'Consumo neto de caja'}
          tone={cf.netCash >= 0 ? 'positive' : 'negative'}
        />
        <Kpi
          icon={<Clock className="w-4 h-4" />}
          label="Cash runway"
          value={
            cf.runwayDays === null
              ? '∞'
              : formatDays(cf.runwayDays)
          }
          sub={
            cf.runwayDays === null
              ? 'Flujo positivo — sin riesgo de agotamiento'
              : `Saldo + caja del balance / quema neta mensual`
          }
          tone={
            cf.runwayDays === null
              ? 'positive'
              : cf.runwayDays > 180
                ? 'neutral'
                : cf.runwayDays > 60
                  ? 'warning'
                  : 'negative'
          }
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Glass className="xl:col-span-2 p-5">
          <SectionHeader
            title="Posición acumulada"
            subtitle="Flujo neto acumulado mes a mes"
          />
          <AreaLineChart data={cumulativePoints} height={240} yLabel="Saldo acumulado" />
        </Glass>

        <Glass className="p-5">
          <SectionHeader title="Composición" subtitle="Tipos de transacción" />
          <DonutMix
            centerLabel={
              <span>{formatPct(
                cf.totalOutflow > 0 ? cf.totalInflow / (cf.totalInflow + cf.totalOutflow) : 0,
              )} inflow</span>
            }
            segments={cf.byType.slice(0, 6).map((b) => ({
              label: b.key,
              value: Math.abs(b.amount) || b.inflow + b.outflow,
            }))}
          />
        </Glass>
      </div>

      <Glass className="p-5">
        <SectionHeader
          title="Inflows vs Outflows mensuales"
          subtitle="Verde positivo, rojo negativo"
        />
        <MonthlyBars monthly={cf.monthly} />
      </Glass>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Glass className="p-5">
          <SectionHeader
            title="Top contrapartes que pagamos"
            subtitle="Click para filtrar el feed inferior"
          />
          {cf.topOutflowCounterparties.length > 0 ? (
            <ClickableBars
              items={cf.topOutflowCounterparties.map((c) => ({
                label: c.key,
                value: c.outflow,
              }))}
              onPick={(label) => setCounterpartyFilter(label)}
            />
          ) : (
            <Empty>Sin pagos registrados a contrapartes identificadas</Empty>
          )}
        </Glass>

        <Glass className="p-5">
          <SectionHeader
            title="Top contrapartes que nos pagan"
            subtitle="Click para filtrar el feed inferior"
          />
          {cf.topInflowCounterparties.length > 0 ? (
            <ClickableBars
              items={cf.topInflowCounterparties.map((c) => ({
                label: c.key,
                value: c.inflow,
              }))}
              onPick={(label) => setCounterpartyFilter(label)}
            />
          ) : (
            <Empty>Sin cobros registrados a contrapartes identificadas</Empty>
          )}
        </Glass>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Glass className="p-5">
          <SectionHeader title="Por cuenta de caja/banco" subtitle="Movimiento neto" />
          <HorizontalBars
            data={cf.byCashAccount.map((b) => ({ label: b.key, value: b.amount }))}
            height={Math.max(160, cf.byCashAccount.length * 28)}
            valueFormat={(v) => formatUsd(v)}
          />
        </Glass>

        <Glass className="p-5">
          <SectionHeader title="Por sucursal" subtitle="Movimiento neto" />
          <HorizontalBars
            data={cf.byBranch.map((b) => ({ label: b.key, value: b.amount }))}
            height={Math.max(160, cf.byBranch.length * 28)}
            valueFormat={(v) => formatUsd(v)}
          />
        </Glass>
      </div>

      <Glass className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-orange-400/90 font-semibold">
              Eventos de caja
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {formatNum(filteredEvents.length)} de {formatNum(cf.events.length)} eventos
            </div>
          </div>
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por referencia, contraparte, descripción…"
              className="pl-8 pr-3 py-1.5 w-72 max-w-full bg-white/[0.03] border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-orange-400/60"
            />
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-950/95 backdrop-blur z-10">
              <tr className="text-slate-400 text-left">
                <Th>Fecha</Th>
                <Th>Tipo</Th>
                <Th>Referencia</Th>
                <Th>Contraparte</Th>
                <Th>Cuenta</Th>
                <Th className="text-right">Monto</Th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.slice(0, 200).map((e, i) => (
                <tr
                  key={`${e.reference}-${i}`}
                  className="border-t border-white/5 hover:bg-orange-500/5"
                >
                  <Td className="text-slate-400">{e.date}</Td>
                  <Td>
                    <TypeBadge type={e.type} />
                  </Td>
                  <Td className="font-mono text-slate-300">{e.reference}</Td>
                  <Td className="text-slate-300 truncate max-w-[260px]">
                    {e.counterparty || '—'}
                  </Td>
                  <Td className="text-slate-400">{e.cashAccount || '—'}</Td>
                  <Td
                    className={`text-right tabular-nums font-semibold ${
                      e.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {e.amount >= 0 ? '+' : '−'}
                    {formatUsd(Math.abs(e.amount), true)}
                  </Td>
                </tr>
              ))}
              {filteredEvents.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500 text-xs"
                  >
                    No hay eventos que coincidan con el filtro
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Glass>

      {cf.largestSingleInflow || cf.largestSingleOutflow ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {cf.largestSingleInflow ? (
            <Glass className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300">
                Mayor cobro individual
              </div>
              <div className="mt-1 text-slate-200 truncate">
                {cf.largestSingleInflow.counterparty || cf.largestSingleInflow.reference}
              </div>
              <div className="mt-0.5 text-slate-500">
                {cf.largestSingleInflow.date} · {cf.largestSingleInflow.type}
              </div>
              <div className="mt-1 text-emerald-300 font-semibold tabular-nums text-base">
                {formatUsd(cf.largestSingleInflow.amount, true)}
              </div>
            </Glass>
          ) : null}
          {cf.largestSingleOutflow ? (
            <Glass className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-rose-300">
                Mayor pago individual
              </div>
              <div className="mt-1 text-slate-200 truncate">
                {cf.largestSingleOutflow.counterparty ||
                  cf.largestSingleOutflow.reference}
              </div>
              <div className="mt-0.5 text-slate-500">
                {cf.largestSingleOutflow.date} · {cf.largestSingleOutflow.type}
              </div>
              <div className="mt-1 text-rose-300 font-semibold tabular-nums text-base">
                {formatUsd(cf.largestSingleOutflow.amount, true)}
              </div>
            </Glass>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function detectSources(events: CashFlowEvent[]): string {
  const set = new Set(events.map((e) => e.source))
  const labels = {
    cash: 'Transacciones de caja',
    payment: 'Pagos AP/AR',
    journal: 'Asientos contables',
  }
  return Array.from(set)
    .map((s) => labels[s])
    .join(' + ')
}

function MonthlyBars({
  monthly,
}: {
  monthly: { month: string; inflow: number; outflow: number; net: number }[]
}) {
  if (monthly.length === 0) return <Empty>Sin datos mensuales</Empty>
  const w = 720
  const height = 220
  const padX = 50
  const padY = 16
  const innerW = w - padX * 2
  const innerH = height - padY * 2 - 18
  const max = Math.max(...monthly.map((m) => Math.max(m.inflow, m.outflow))) || 1
  const min = -max
  const range = max - min
  const barW = (innerW / monthly.length) * 0.34
  const groupW = innerW / monthly.length
  const zeroY = padY + innerH * (max / range)
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full">
      {/* Zero line */}
      <line
        x1={padX}
        y1={zeroY}
        x2={w - padX}
        y2={zeroY}
        stroke="rgba(148,163,184,0.4)"
        strokeDasharray="3 3"
      />
      {monthly.map((m, i) => {
        const cx = padX + i * groupW + groupW / 2
        const inflowH = (m.inflow / range) * innerH
        const outflowH = (m.outflow / range) * innerH
        return (
          <g key={i}>
            <rect
              x={cx - barW - 1}
              y={zeroY - inflowH}
              width={barW}
              height={Math.max(0, inflowH)}
              rx={2}
              fill="#34d399"
              opacity="0.85"
            />
            <rect
              x={cx + 1}
              y={zeroY}
              width={barW}
              height={Math.max(0, outflowH)}
              rx={2}
              fill="#fb7185"
              opacity="0.85"
            />
            <text
              x={cx}
              y={height - 4}
              textAnchor="middle"
              fontSize="10"
              fill="#94A3B8"
            >
              {m.month.slice(2)}
            </text>
          </g>
        )
      })}
      <text x={padX} y={padY - 2} fontSize="10" fill="#94A3B8">
        +{formatTickShort(max)}
      </text>
      <text x={padX} y={padY + innerH + 12} fontSize="10" fill="#94A3B8">
        −{formatTickShort(max)}
      </text>
    </svg>
  )
}

function ClickableBars({
  items,
  onPick,
}: {
  items: { label: string; value: number }[]
  onPick: (label: string) => void
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.value))) || 1
  return (
    <div className="space-y-2">
      {items.map((it) => {
        const pct = (Math.abs(it.value) / max) * 100
        return (
          <button
            key={it.label}
            type="button"
            onClick={() => onPick(it.label)}
            className="w-full text-left group relative rounded-lg overflow-hidden border border-white/10 hover:border-orange-400/40 transition"
          >
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500/20 to-orange-500/[0.04]"
              style={{ width: `${pct}%` }}
            />
            <div className="relative flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="text-xs text-slate-200 truncate">{it.label}</span>
              <span className="text-xs tabular-nums text-orange-300 font-semibold">
                {formatUsd(it.value)}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function Kpi({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone: 'positive' | 'negative' | 'neutral' | 'warning'
}) {
  const toneText =
    tone === 'positive'
      ? 'text-emerald-300'
      : tone === 'negative'
        ? 'text-rose-300'
        : tone === 'warning'
          ? 'text-amber-300'
          : 'text-orange-300'
  const toneRing =
    tone === 'positive'
      ? 'ring-emerald-400/30'
      : tone === 'negative'
        ? 'ring-rose-400/30'
        : tone === 'warning'
          ? 'ring-amber-400/30'
          : 'ring-orange-500/30'
  return (
    <Glass className={`p-4 ring-1 ${toneRing}`}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
        <span className={toneText}>{icon}</span>
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneText}`}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-slate-400">{sub}</div> : null}
    </Glass>
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

function TypeBadge({ type }: { type: string }) {
  const t = type.toLowerCase()
  const isInflow = /receipt|recib|cobro|deposit|deposito|ar/.test(t)
  const isOutflow = /pay|payment|pago|egreso|cheque|ap/.test(t)
  const cls = isInflow
    ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/30'
    : isOutflow
      ? 'bg-rose-500/10 text-rose-300 ring-rose-400/30'
      : 'bg-slate-500/10 text-slate-300 ring-slate-400/30'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ring-1 ${cls}`}>
      {type}
    </span>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-slate-500 italic py-6 text-center">
      {children}
    </div>
  )
}

function formatTickShort(v: number): string {
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return v.toFixed(0)
}

// touch unused imports to keep tree-shaker honest in dev
void Building2
void TrendingDown
