import { useMemo } from 'react'
import { useDashboard } from '../store'
import {
  computeFinanceSnapshot,
  computeCashCycle,
  decomposeGrowth,
  filterInvoices,
  monthlySeries,
  FormulaTeX,
} from '../../finance/engine'
import { applySensitivity } from '../../finance/forecast'
import { KpiCard } from '../components/KpiCard'
import { Glass, SectionHeader } from '../components/Glass'
import { AreaLineChart, DonutMix } from '../components/Charts'
import { formatUsd, formatPct, formatPct2, formatDays, formatNum } from '../format'

export function ExecutiveOverview() {
  const ds = useDashboard((s) => s.dataset)
  const dateRange = useDashboard((s) => s.dateRange)
  const drill = useDashboard((s) => s.drill)
  const sensitivity = useDashboard((s) => s.sensitivity)

  const filteredInvoices = useMemo(
    () => filterInvoices(ds.invoices, dateRange, drill),
    [ds.invoices, dateRange, drill],
  )

  const snap = useMemo(() => computeFinanceSnapshot(ds), [ds])
  const adjusted = useMemo(() => applySensitivity(ds, sensitivity), [ds, sensitivity])
  const growth = useMemo(() => decomposeGrowth(filteredInvoices), [filteredInvoices])
  const cycle = useMemo(() => computeCashCycle(ds.financials), [ds.financials])
  const series = useMemo(() => monthlySeries(filteredInvoices), [filteredInvoices])

  const seriesPoints = series.map((m) => ({
    label: m.month.slice(2),
    value: m.revenue,
  }))

  const valueCreation = (snap.roic - snap.wacc) * snap.investedCapital
  const sensitivityDelta = adjusted.roic - snap.roic

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Executive Overview"
        subtitle="Indicadores McKinsey — Operating approach, ajustado por exceso de caja y leases capitalizados"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Revenue"
          value={formatUsd(snap.revenue)}
          delta={growth.totalGrowth}
          deltaLabel="vs período previo"
          tone="accent"
          description="Ingresos totales del rango filtrado. Se descompone en volumen, precio y mix abajo."
        />
        <KpiCard
          label="NOPAT"
          value={formatUsd(snap.nopat)}
          tone="accent"
          formula={FormulaTeX.nopat}
          description="Utilidad operativa después de impuestos operativos. No incluye escudo fiscal de la deuda."
        />
        <KpiCard
          label="ROIC"
          value={formatPct2(snap.roic)}
          delta={sensitivityDelta}
          deltaLabel="vs ROIC base (sensibilidad)"
          tone={snap.roic > snap.wacc ? 'positive' : 'negative'}
          formula={FormulaTeX.roic}
          description="Retorno sobre capital invertido operativo. Excluye exceso de caja, incluye leases capitalizados (8× rentas)."
        />
        <KpiCard
          label="WACC"
          value={formatPct2(snap.wacc)}
          tone="neutral"
          formula={FormulaTeX.wacc}
          description="Costo promedio de capital con prima de riesgo país de Ecuador integrada."
        />
        <KpiCard
          label="EVA"
          value={formatUsd(snap.eva)}
          tone={snap.eva > 0 ? 'positive' : 'negative'}
          formula={FormulaTeX.eva}
          description="Valor económico agregado: solo positivo si ROIC supera WACC."
          footer={
            snap.eva > 0
              ? 'Generación de valor real.'
              : 'Destrucción de valor — capital trabajando bajo costo.'
          }
        />
        <KpiCard
          label="CFROI"
          value={formatPct2(snap.cfroi)}
          tone="accent"
          formula={FormulaTeX.cfroi}
          description="Retorno bruto en efectivo ajustado por inflación contra inversión bruta."
        />
        <KpiCard
          label="Invested Capital"
          value={formatUsd(snap.investedCapital)}
          tone="neutral"
          formula={FormulaTeX.investedCapital}
          description={`Caja en exceso ajustada: ${formatUsd(snap.excessCashAdjustment)}. Leases capitalizados: ${formatUsd(snap.capitalizedLeases)}.`}
        />
        <KpiCard
          label="Cash Conversion Cycle"
          value={formatDays(cycle.cashConversionCycle)}
          tone="neutral"
          description={`DSO ${cycle.daysSalesOutstanding.toFixed(0)}d  ·  DIO ${cycle.daysInventoryOutstanding.toFixed(0)}d  ·  DPO ${cycle.daysPayableOutstanding.toFixed(0)}d`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Glass className="xl:col-span-2 p-5">
          <SectionHeader
            title="Trayectoria de ingresos"
            subtitle="Series mensuales aplicando filtros activos"
            right={
              <div className="text-xs text-slate-400 flex gap-3">
                <span>
                  Facturas: <span className="text-orange-300 font-semibold">{formatNum(filteredInvoices.length)}</span>
                </span>
                <span>
                  Unidades: <span className="text-orange-300 font-semibold">{formatNum(filteredInvoices.reduce((s, i) => s + i.units, 0))}</span>
                </span>
              </div>
            }
          />
          <AreaLineChart data={seriesPoints} height={240} />
        </Glass>

        <Glass className="p-5">
          <SectionHeader
            title="Crecimiento efectivo"
            subtitle="Volumen vs. precio vs. mix"
          />
          <DonutMix
            centerLabel={
              <span>
                Δ Revenue {formatPct(growth.totalGrowth)}
              </span>
            }
            segments={[
              {
                label: 'Volumen',
                value: Math.max(0, growth.volumeEffect),
                color: '#F39C12',
              },
              {
                label: 'Precio (inflación/FX)',
                value: Math.max(0, growth.priceEffect),
                color: '#fb923c',
              },
              {
                label: 'Mix',
                value: Math.max(0, growth.mixEffect),
                color: '#94A3B8',
              },
            ]}
          />
          <div className="mt-4 text-[11px] text-slate-400 leading-relaxed">
            Diferencia entre crecimiento real (unidades) y nominal (precio). Una
            empresa de importación rentable debe ver más volumen que precio.
          </div>
        </Glass>
      </div>

      <Glass className="p-5">
        <SectionHeader
          title="Decomposición ROIC"
          subtitle="ROIC = Margen operativo × Rotación de capital"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Cell
            label="Operating Margin"
            value={formatPct2(snap.operatingMargin)}
            sub={`EBIT ${formatUsd(snap.ebit)}`}
          />
          <Cell
            label="Capital Turnover"
            value={`${snap.capitalTurnover.toFixed(2)}×`}
            sub={`Revenue / IC`}
          />
          <Cell
            label="Spread (ROIC − WACC)"
            value={formatPct2(snap.roic - snap.wacc)}
            sub={`Captura de valor: ${formatUsd(valueCreation)}`}
            highlight={snap.roic > snap.wacc}
          />
        </div>
      </Glass>
    </section>
  )
}

function Cell({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? 'bg-emerald-500/5 border-emerald-400/30'
          : 'bg-white/[0.02] border-white/10'
      }`}
    >
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          highlight ? 'text-emerald-300' : 'text-orange-300'
        }`}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-slate-400">{sub}</div> : null}
    </div>
  )
}
