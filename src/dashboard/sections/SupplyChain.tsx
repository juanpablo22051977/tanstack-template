import { useMemo } from 'react'
import { useDashboard } from '../store'
import { Glass, SectionHeader } from '../components/Glass'
import { Pipeline } from '../components/Charts'
import { formatUsd, formatNum, formatDays } from '../format'
import { Ship, Package, Truck, Anchor, Building2, FileSignature } from 'lucide-react'

const STAGE_ICONS = {
  production: FileSignature,
  ocean: Ship,
  customs: Anchor,
  inland: Truck,
  received: Package,
} as const

const STAGE_LABEL: Record<string, string> = {
  production: 'Producción',
  ocean: 'Tránsito',
  customs: 'Aduana EC',
  inland: 'Inland EC',
  received: 'Recibida',
}

export function SupplyChain() {
  const ds = useDashboard((s) => s.dataset)

  const aggregated = useMemo(() => {
    const buckets = {
      production: { capital: 0, days: 0, count: 0 },
      ocean: { capital: 0, days: 0, count: 0 },
      customs: { capital: 0, days: 0, count: 0 },
      inland: { capital: 0, days: 0, count: 0 },
      received: { capital: 0, days: 0, count: 0 },
    }
    for (const po of ds.purchases) {
      const totalValue = po.units * po.unitCost + po.freightCost + po.dutiesCost
      const b = buckets[po.stage]
      b.capital += totalValue
      b.count += 1
      const stageDays =
        po.stage === 'production'
          ? po.productionDays
          : po.stage === 'ocean'
            ? po.oceanDays
            : po.stage === 'customs'
              ? po.customsDays
              : po.stage === 'inland'
                ? po.inlandDays
                : 0
      b.days += stageDays
    }
    for (const k of Object.keys(buckets) as (keyof typeof buckets)[]) {
      const b = buckets[k]
      b.days = b.count > 0 ? b.days / b.count : 0
    }
    return buckets
  }, [ds.purchases])

  const trappedCapital =
    aggregated.production.capital +
    aggregated.ocean.capital +
    aggregated.customs.capital +
    aggregated.inland.capital
  const totalLeadDays =
    aggregated.production.days +
    aggregated.ocean.days +
    aggregated.customs.days +
    aggregated.inland.days

  const pipelineStages = (
    ['production', 'ocean', 'customs', 'inland', 'received'] as const
  ).map((stage) => ({
    name: STAGE_LABEL[stage],
    capital: aggregated[stage].capital,
    days: Math.round(aggregated[stage].days),
    active: stage !== 'received',
  }))

  const inFlight = ds.purchases.filter((p) => p.stage !== 'received')

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Supply Chain & Lead Time"
        subtitle="Pipeline de importación con tiempos estocásticos (aduana EC: distribución Beta)"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={<Building2 className="w-4 h-4 text-orange-300" />}
          label="Capital atrapado en pipeline"
          value={formatUsd(trappedCapital)}
          sub={`${inFlight.length} órdenes en tránsito`}
        />
        <SummaryCard
          icon={<Ship className="w-4 h-4 text-orange-300" />}
          label="Lead time promedio"
          value={formatDays(totalLeadDays)}
          sub={`Aduana EC: ${formatDays(aggregated.customs.days)}  ·  σ Beta(α=2, β=5)`}
        />
        <SummaryCard
          icon={<Anchor className="w-4 h-4 text-orange-300" />}
          label="Costos no-producto"
          value={formatUsd(
            ds.purchases.reduce((s, p) => s + p.freightCost + p.dutiesCost, 0),
          )}
          sub="Flete + nacionalización del histórico"
        />
      </div>

      <Glass className="p-5">
        <SectionHeader
          title="Capital por etapa"
          subtitle="Cada segmento es proporcional al capital congelado en esa fase"
        />
        <Pipeline stages={pipelineStages} />
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(STAGE_LABEL) as (keyof typeof STAGE_ICONS)[]).map((k) => {
            const Icon = STAGE_ICONS[k]
            return (
              <span
                key={k}
                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400 bg-white/[0.03] border border-white/10 px-2 py-1 rounded-full"
              >
                <Icon className="w-3 h-3 text-orange-400" />
                {STAGE_LABEL[k]}
              </span>
            )
          })}
        </div>
      </Glass>

      <Glass className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-xs uppercase tracking-[0.18em] text-orange-400/90 font-semibold">
            Órdenes en tránsito
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {inFlight.length} órdenes con capital comprometido — etapas Beta-distribuidas
          </div>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-950/95 backdrop-blur z-10">
              <tr className="text-slate-400 text-left">
                <th className="px-4 py-2 font-medium text-[11px] uppercase tracking-wider">PO</th>
                <th className="px-4 py-2 font-medium text-[11px] uppercase tracking-wider">Proveedor</th>
                <th className="px-4 py-2 font-medium text-[11px] uppercase tracking-wider">Origen</th>
                <th className="px-4 py-2 font-medium text-[11px] uppercase tracking-wider">SKU</th>
                <th className="px-4 py-2 font-medium text-[11px] uppercase tracking-wider text-right">Unidades</th>
                <th className="px-4 py-2 font-medium text-[11px] uppercase tracking-wider text-right">Capital</th>
                <th className="px-4 py-2 font-medium text-[11px] uppercase tracking-wider">Etapa</th>
              </tr>
            </thead>
            <tbody>
              {inFlight.map((po) => {
                const Icon = STAGE_ICONS[po.stage]
                const value = po.units * po.unitCost + po.freightCost + po.dutiesCost
                return (
                  <tr key={po.id} className="border-t border-white/5 hover:bg-orange-500/5">
                    <td className="px-4 py-2 font-medium text-slate-300">{po.id}</td>
                    <td className="px-4 py-2 text-slate-300">{po.supplier}</td>
                    <td className="px-4 py-2 text-slate-400">{po.originPort}</td>
                    <td className="px-4 py-2 font-mono text-slate-400">{po.sku}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatNum(po.units)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-orange-300 font-semibold">
                      {formatUsd(value)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-orange-200 bg-orange-500/10 border border-orange-500/30 px-2 py-0.5 rounded-full">
                        <Icon className="w-3 h-3" />
                        {STAGE_LABEL[po.stage]}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Glass>
    </section>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <Glass className="p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-orange-300 tabular-nums">
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-slate-400">{sub}</div> : null}
    </Glass>
  )
}
