import { useMemo } from 'react'
import { useDashboard } from '../store'
import { recommendSlotting, reorderAdvice } from '../../finance/forecast'
import { Glass, SectionHeader } from '../components/Glass'
import { formatUsd, formatNum, formatPct } from '../format'
import { AlertTriangle, Box, Activity, Brain } from 'lucide-react'

const STATUS_STYLE = {
  urgent: 'text-rose-300 bg-rose-500/10 ring-rose-400/30',
  soon: 'text-amber-300 bg-amber-500/10 ring-amber-400/30',
  monitor: 'text-orange-300 bg-orange-500/10 ring-orange-400/30',
  ok: 'text-emerald-300 bg-emerald-500/10 ring-emerald-400/30',
} as const

const ZONE_STYLE = {
  'A-Picking': 'bg-orange-500/20 text-orange-200 ring-orange-400/40',
  'B-Reserva': 'bg-amber-500/15 text-amber-200 ring-amber-400/30',
  'C-Backstock': 'bg-slate-500/15 text-slate-300 ring-slate-400/30',
} as const

const STATUS_LABEL = {
  urgent: 'Urgente',
  soon: 'Pronto',
  monitor: 'Vigilar',
  ok: 'OK',
} as const

export function Wms() {
  const ds = useDashboard((s) => s.dataset)
  const slotting = useMemo(() => recommendSlotting(ds), [ds])
  const reorder = useMemo(() => reorderAdvice(ds, ds.purchases), [ds])
  const counts = useMemo(() => {
    const c = { A: 0, B: 0, C: 0 }
    for (const s of slotting) c[s.newClass]++
    return c
  }, [slotting])

  const urgentItems = reorder.filter((r) => r.status === 'urgent').length
  const totalDemand = ds.stock.reduce((s, x) => s + x.weeklyDemand, 0)

  return (
    <section className="space-y-6">
      <SectionHeader
        title="WMS · Slotting Inteligente"
        subtitle="Clasificación ABC dinámica con red neuronal de quiebre — pesos pre-entrenados"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Mini icon={<Brain className="w-4 h-4" />} label="Clase A · alta rotación" value={counts.A.toString()} sub="Zona de picking" />
        <Mini icon={<Box className="w-4 h-4" />} label="Clase B · media" value={counts.B.toString()} sub="Reserva intermedia" />
        <Mini icon={<Box className="w-4 h-4" />} label="Clase C · baja" value={counts.C.toString()} sub="Backstock" />
        <Mini
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Quiebres urgentes"
          value={urgentItems.toString()}
          sub={`Demanda semanal total: ${formatNum(totalDemand)} u.`}
          tone={urgentItems > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <Glass className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-orange-400/90 font-semibold">
              Predictor de quiebre · NN
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Inputs z-scored: velocidad · semanas de cobertura · demanda · lead time. Output: σ(WᵀTanh(Wx+b)+c)
            </div>
          </div>
          <Activity className="w-4 h-4 text-orange-300" />
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-950/95 backdrop-blur z-10">
              <tr className="text-slate-400 text-left">
                <Th>SKU</Th>
                <Th>Producto</Th>
                <Th className="text-right">WoC</Th>
                <Th className="text-right">P(quiebre)</Th>
                <Th className="text-right">Reposición</Th>
                <Th>Estado</Th>
                <Th>Mensaje</Th>
              </tr>
            </thead>
            <tbody>
              {reorder.slice(0, 24).map((r) => (
                <tr key={r.sku} className="border-t border-white/5 hover:bg-orange-500/5">
                  <Td className="font-mono text-slate-300">{r.sku}</Td>
                  <Td className="text-slate-300 truncate max-w-[200px]">{r.description}</Td>
                  <Td className="text-right tabular-nums text-slate-300">
                    {r.weeksOfCover.toFixed(1)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    <ProbBar value={r.stockoutProb} />
                  </Td>
                  <Td className="text-right tabular-nums text-slate-300">
                    {r.reorderInDays}d
                  </Td>
                  <Td>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ring-1 ${STATUS_STYLE[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </Td>
                  <Td className="text-[10px] text-slate-400">{r.message}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Glass>

      <Glass className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-xs uppercase tracking-[0.18em] text-orange-400/90 font-semibold">
            Slotting recomendado
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Score = 0.5·velocidad + 0.35·share margen − 0.15·bulkiness
          </div>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-950/95 backdrop-blur z-10">
              <tr className="text-slate-400 text-left">
                <Th>SKU</Th>
                <Th>Producto</Th>
                <Th>Clase actual</Th>
                <Th>Recomendada</Th>
                <Th>Zona</Th>
                <Th className="text-right">Margen contribuido</Th>
                <Th>Razón</Th>
              </tr>
            </thead>
            <tbody>
              {slotting.slice(0, 18).map((s) => (
                <tr key={s.sku} className="border-t border-white/5">
                  <Td className="font-mono text-slate-300">{s.sku}</Td>
                  <Td className="text-slate-300 truncate max-w-[200px]">{s.description}</Td>
                  <Td className="text-slate-400">{s.abcClass}</Td>
                  <Td>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ring-1 ${
                        s.newClass === 'A'
                          ? 'bg-orange-500/20 text-orange-200 ring-orange-400/40'
                          : s.newClass === 'B'
                            ? 'bg-amber-500/15 text-amber-200 ring-amber-400/30'
                            : 'bg-slate-500/15 text-slate-300 ring-slate-400/30'
                      }`}
                    >
                      {s.newClass}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ring-1 ${ZONE_STYLE[s.recommendedZone]}`}
                    >
                      {s.recommendedZone}
                    </span>
                  </Td>
                  <Td className="text-right tabular-nums text-orange-300 font-semibold">
                    {formatUsd(s.marginContribution)}
                  </Td>
                  <Td className="text-[10px] text-slate-400">{s.reason}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Glass>
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

function ProbBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = value > 0.6 ? 'bg-rose-500' : value > 0.4 ? 'bg-amber-500' : value > 0.25 ? 'bg-orange-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className="text-slate-300 tabular-nums w-8 text-right">{pct}%</span>
      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Mini({
  icon,
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone?: 'neutral' | 'warning'
}) {
  return (
    <Glass className={`p-4 ${tone === 'warning' ? 'ring-1 ring-rose-400/30' : ''}`}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
        <span className="text-orange-300">{icon}</span>
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${tone === 'warning' ? 'text-rose-300' : 'text-orange-300'}`}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-slate-400">{sub}</div> : null}
    </Glass>
  )
}

// Avoid unused import warning (formatPct used elsewhere previously).
void formatPct
