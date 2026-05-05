import { useMemo } from 'react'
import { dashboardActions, useDashboard } from '../store'
import { Glass, SectionHeader } from '../components/Glass'
import { Histogram } from '../components/Charts'
import { runMonteCarlo, applySensitivity } from '../../finance/forecast'
import { computeFinanceSnapshot } from '../../finance/engine'
import { calibrateFromHistory } from '../../finance/cashFlow'
import { formatUsd, formatPct, formatPct2 } from '../format'
import { Sliders, Dices, Activity, Wand2 } from 'lucide-react'

export function Simulation() {
  const ds = useDashboard((s) => s.dataset)
  const sensitivity = useDashboard((s) => s.sensitivity)
  const mc = useDashboard((s) => s.monteCarlo)
  const dateRange = useDashboard((s) => s.dateRange)

  const baseSnap = useMemo(() => computeFinanceSnapshot(ds), [ds])
  const adjustedSnap = useMemo(
    () => applySensitivity(ds, sensitivity),
    [ds, sensitivity],
  )
  const mcResult = useMemo(() => runMonteCarlo(ds, mc), [ds, mc])
  const calibration = useMemo(
    () => calibrateFromHistory(ds, dateRange),
    [ds, dateRange],
  )

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Simulación & Sensibilidad"
        subtitle={`Monte Carlo (${mc.iterations.toLocaleString('en-US')} iteraciones) + Análisis de sensibilidad sobre ROIC`}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Glass className="p-5">
          <SectionHeader
            title="Sensibilidad"
            subtitle="Mueve los sliders — ROIC se recalcula en tiempo real"
            right={<Sliders className="w-4 h-4 text-orange-300" />}
          />
          <div className="space-y-4">
            <Slider
              label="Δ Margen"
              hint="Mejora o reduce margen bruto"
              value={sensitivity.marginDelta}
              min={-0.1}
              max={0.1}
              step={0.005}
              onChange={(v) => dashboardActions.updateSensitivity({ marginDelta: v })}
              format={formatPct2}
            />
            <Slider
              label="Δ Tipo de cambio"
              hint="USD vs canasta de monedas asiáticas"
              value={sensitivity.fxDelta}
              min={-0.2}
              max={0.2}
              step={0.01}
              onChange={(v) => dashboardActions.updateSensitivity({ fxDelta: v })}
              format={formatPct2}
            />
            <Slider
              label="Δ Costo de flete"
              hint="Cambio en flete marítimo"
              value={sensitivity.freightDelta}
              min={-0.3}
              max={0.3}
              step={0.01}
              onChange={(v) => dashboardActions.updateSensitivity({ freightDelta: v })}
              format={formatPct2}
            />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <Result
              label="ROIC base"
              value={formatPct2(baseSnap.roic)}
              accent={false}
            />
            <Result
              label="ROIC ajustado"
              value={formatPct2(adjustedSnap.roic)}
              accent
              delta={adjustedSnap.roic - baseSnap.roic}
            />
            <Result
              label="EVA base"
              value={formatUsd(baseSnap.eva)}
              accent={false}
            />
            <Result
              label="EVA ajustado"
              value={formatUsd(adjustedSnap.eva)}
              accent
              delta={adjustedSnap.eva > baseSnap.eva ? 1 : -1}
            />
          </div>
        </Glass>

        <Glass className="p-5">
          <SectionHeader
            title="WACC parametrizable"
            subtitle="Costo de capital con prima de riesgo país Ecuador"
          />
          <div className="grid grid-cols-2 gap-3 text-xs">
            <NumInput
              label="Risk-free rate"
              value={ds.wacc.riskFreeRate}
              step={0.001}
              onChange={(v) => dashboardActions.updateWacc({ riskFreeRate: v })}
              suffix="%"
              percent
            />
            <NumInput
              label="Beta industria"
              value={ds.wacc.beta}
              step={0.05}
              onChange={(v) => dashboardActions.updateWacc({ beta: v })}
            />
            <NumInput
              label="Equity risk prem."
              value={ds.wacc.equityRiskPremium}
              step={0.005}
              onChange={(v) => dashboardActions.updateWacc({ equityRiskPremium: v })}
              suffix="%"
              percent
            />
            <NumInput
              label="Country risk prem. (EC)"
              value={ds.wacc.countryRiskPremium}
              step={0.005}
              onChange={(v) => dashboardActions.updateWacc({ countryRiskPremium: v })}
              suffix="%"
              percent
            />
            <NumInput
              label="Costo de deuda"
              value={ds.wacc.costOfDebt}
              step={0.005}
              onChange={(v) => dashboardActions.updateWacc({ costOfDebt: v })}
              suffix="%"
              percent
            />
            <NumInput
              label="Tasa impositiva"
              value={ds.wacc.taxRate}
              step={0.005}
              onChange={(v) => dashboardActions.updateWacc({ taxRate: v })}
              suffix="%"
              percent
            />
            <NumInput
              label="Peso equity"
              value={ds.wacc.equityWeight}
              step={0.01}
              onChange={(v) =>
                dashboardActions.updateWacc({
                  equityWeight: v,
                  debtWeight: 1 - v,
                })
              }
              suffix="%"
              percent
            />
            <NumInput
              label="Peso deuda"
              value={ds.wacc.debtWeight}
              step={0.01}
              onChange={(v) =>
                dashboardActions.updateWacc({
                  debtWeight: v,
                  equityWeight: 1 - v,
                })
              }
              suffix="%"
              percent
            />
          </div>
          <div className="mt-4 rounded-xl border border-orange-400/30 bg-orange-500/10 p-3 text-center">
            <div className="text-[11px] uppercase tracking-[0.18em] text-orange-200">
              WACC resultante
            </div>
            <div className="mt-1 text-3xl font-semibold text-orange-300 tabular-nums">
              {formatPct2(baseSnap.wacc)}
            </div>
          </div>
        </Glass>
      </div>

      <Glass className="p-5">
        <SectionHeader
          title="Monte Carlo · flujo de caja"
          subtitle={`${mc.iterations.toLocaleString('en-US')} simulaciones — shock multivariado`}
          right={
            <span className="inline-flex items-center gap-1.5 text-xs text-orange-300">
              <Dices className="w-3.5 h-3.5" /> P(caja &lt; 0) = {formatPct(mcResult.shortfallProb)}
            </span>
          }
        />
        {calibration ? (
          <div className="mb-4 rounded-xl border border-orange-400/30 bg-orange-500/[0.06] p-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[280px]">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-orange-300 font-semibold">
                <Wand2 className="w-3.5 h-3.5" /> Calibración histórica disponible
              </div>
              <div className="mt-1 text-xs text-slate-300">
                {calibration.observations} meses observados · σ mensual
                <span className="text-orange-300 font-semibold"> {formatUsd(calibration.monthlySigma)}</span> · CV
                <span className="text-orange-300 font-semibold"> {(calibration.monthlyCv * 100).toFixed(1)}%</span> · quema mensual prom.
                <span className="text-orange-300 font-semibold"> {formatUsd(calibration.averageOutflow)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                // Translate the historical CV (relative volatility) into the
                // sales-volatility input. Cap at 60% to keep the simulator
                // numerically stable.
                const salesVol = Math.min(0.6, Math.max(0.05, calibration.monthlyCv))
                dashboardActions.updateMonteCarlo({ salesVol })
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 bg-orange-300 hover:bg-orange-200 transition"
            >
              Aplicar al simulador
            </button>
          </div>
        ) : null}
        <Histogram bins={mcResult.histogram} thresholdValue={0} height={200} />
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Result label="Mediana (P50)" value={formatUsd(mcResult.p50)} accent />
          <Result label="Media" value={formatUsd(mcResult.meanCash)} />
          <Result label="P5 (escenario adverso)" value={formatUsd(mcResult.p5)} negative={mcResult.p5 < 0} />
          <Result label="P95 (escenario favorable)" value={formatUsd(mcResult.p95)} accent />
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <NumInput
            label="σ ventas"
            value={mc.salesVol}
            step={0.01}
            onChange={(v) => dashboardActions.updateMonteCarlo({ salesVol: v })}
          />
          <NumInput
            label="σ FX"
            value={mc.fxVol}
            step={0.005}
            onChange={(v) => dashboardActions.updateMonteCarlo({ fxVol: v })}
          />
          <NumInput
            label="σ flete"
            value={mc.freightVol}
            step={0.01}
            onChange={(v) => dashboardActions.updateMonteCarlo({ freightVol: v })}
          />
          <NumInput
            label="α aduana (Beta)"
            value={mc.customsBetaAlpha}
            step={0.5}
            onChange={(v) => dashboardActions.updateMonteCarlo({ customsBetaAlpha: v })}
          />
          <NumInput
            label="β aduana (Beta)"
            value={mc.customsBetaBeta}
            step={0.5}
            onChange={(v) => dashboardActions.updateMonteCarlo({ customsBetaBeta: v })}
          />
          <NumInput
            label="Días aduana max"
            value={mc.customsScaleDays}
            step={1}
            onChange={(v) => dashboardActions.updateMonteCarlo({ customsScaleDays: v })}
          />
        </div>
        <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-orange-400" />
          Drivers estocásticos: ventas, FX, flete y duración de aduana (distribución Beta).
        </div>
      </Glass>
    </section>
  )
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format: (v: number) => string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <div>
          <span className="text-xs text-slate-300 font-medium">{label}</span>
          {hint ? <span className="ml-2 text-[10px] text-slate-500">{hint}</span> : null}
        </div>
        <span className="text-sm tabular-nums font-semibold text-orange-300">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-orange-500"
      />
      <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 tabular-nums">
        <span>{format(min)}</span>
        <span>{format(0)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  )
}

function NumInput({
  label,
  value,
  step,
  onChange,
  percent,
  suffix,
}: {
  label: string
  value: number
  step: number
  onChange: (v: number) => void
  percent?: boolean
  suffix?: string
}) {
  const display = percent ? value * 100 : value
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
        {label}
      </div>
      <div className="flex items-center bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden focus-within:border-orange-400/50">
        <input
          type="number"
          step={percent ? step * 100 : step}
          value={Number.isFinite(display) ? display.toFixed(percent ? 2 : 3) : ''}
          onChange={(e) => {
            const n = parseFloat(e.target.value)
            if (Number.isFinite(n)) onChange(percent ? n / 100 : n)
          }}
          className="w-full bg-transparent px-2 py-1.5 text-slate-200 text-sm tabular-nums focus:outline-none"
        />
        {suffix ? (
          <span className="px-2 text-[10px] text-slate-500">{suffix}</span>
        ) : null}
      </div>
    </label>
  )
}

function Result({
  label,
  value,
  accent,
  delta,
  negative,
}: {
  label: string
  value: string
  accent?: boolean
  delta?: number
  negative?: boolean
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-semibold tabular-nums ${
          negative ? 'text-rose-300' : accent ? 'text-orange-300' : 'text-slate-100'
        }`}
      >
        {value}
      </div>
      {delta !== undefined ? (
        <div
          className={`text-[10px] mt-0.5 ${
            delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {delta >= 0 ? '▲' : '▼'} ajuste activo
        </div>
      ) : null}
    </div>
  )
}
