import { useDashboard } from '../store'
import { Glass, SectionHeader } from '../components/Glass'
import { HorizontalBars } from '../components/Charts'
import { formatPct, formatPct2, formatUsd } from '../format'
import { Globe2, Trophy } from 'lucide-react'

export function MacroBenchmark() {
  const ds = useDashboard((s) => s.dataset)

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Contexto Macro & Competencia"
        subtitle="Indicadores Ecuador + benchmarking del sector autopartes"
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Glass className="p-5">
          <SectionHeader
            title="Macro · Ecuador"
            subtitle="Drivers que afectan ROIC y costo de capital"
            right={<Globe2 className="w-4 h-4 text-orange-300" />}
          />
          <div className="grid grid-cols-2 gap-4">
            <MacroTile
              label="Inflación 12m"
              value={formatPct2(ds.macro.inflation)}
              hint="USD-CPI Ecuador"
            />
            <MacroTile
              label="PIB sector automotriz"
              value={formatPct2(ds.macro.gdpAuto)}
              hint="Crecimiento real"
              positive={ds.macro.gdpAuto > 0}
            />
            <MacroTile
              label="Riesgo país (CRP)"
              value={formatPct2(ds.macro.countryRisk)}
              hint="EMBI EC"
            />
            <MacroTile
              label="Riesgo cambiario"
              value={formatPct2(ds.macro.fxRisk)}
              hint="Vol. canasta de monedas"
            />
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-400 leading-relaxed">
            Aunque Ecuador es dolarizado, los costos de importación están
            expuestos al fortalecimiento del dólar frente al CNY/JPY/KRW —
            principal canasta de origen de autopartes.
          </div>
        </Glass>

        <Glass className="p-5">
          <SectionHeader
            title="Benchmarking competencia"
            subtitle="Participación de mercado estimada en autopartes EC"
            right={<Trophy className="w-4 h-4 text-orange-300" />}
          />
          <HorizontalBars
            data={ds.competitors.map((c) => ({
              label: c.name,
              value: c.marketShare,
            }))}
            valueFormat={(v) => formatPct(v)}
            height={210}
          />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {ds.competitors.map((c) => (
              <div
                key={c.name}
                className={`rounded-lg border px-3 py-2 flex items-baseline justify-between gap-2 ${
                  c.name.toLowerCase().includes('davila')
                    ? 'border-orange-400/40 bg-orange-500/10'
                    : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <div>
                  <div className="text-slate-200 font-medium truncate max-w-[200px]">
                    {c.name}
                  </div>
                  <div className="text-[10px] text-slate-500">{c.notes}</div>
                </div>
                <div className="text-right">
                  <div className="text-orange-300 tabular-nums font-semibold">
                    {formatUsd(c.avgPrice, true)}
                  </div>
                  <div className="text-[10px] text-slate-500">precio prom.</div>
                </div>
              </div>
            ))}
          </div>
        </Glass>
      </div>
    </section>
  )
}

function MacroTile({
  label,
  value,
  hint,
  positive,
}: {
  label: string
  value: string
  hint?: string
  positive?: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          positive ? 'text-emerald-300' : 'text-orange-300'
        }`}
      >
        {value}
      </div>
      {hint ? <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div> : null}
    </div>
  )
}
