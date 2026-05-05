import type { ReactNode } from 'react'
import { useState } from 'react'
import { Info, TrendingUp, TrendingDown } from 'lucide-react'
import { Formula } from './Formula'

export type KpiTone = 'positive' | 'negative' | 'neutral' | 'accent'

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  tone = 'accent',
  formula,
  description,
  footer,
}: {
  label: string
  value: ReactNode
  delta?: number
  deltaLabel?: string
  tone?: KpiTone
  formula?: string
  description?: string
  footer?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const toneRing =
    tone === 'positive'
      ? 'ring-emerald-400/30'
      : tone === 'negative'
        ? 'ring-rose-400/30'
        : tone === 'accent'
          ? 'ring-orange-500/40'
          : 'ring-slate-500/20'
  const toneText =
    tone === 'positive'
      ? 'text-emerald-300'
      : tone === 'negative'
        ? 'text-rose-300'
        : tone === 'accent'
          ? 'text-orange-300'
          : 'text-slate-200'

  return (
    <div
      className={[
        'relative group rounded-2xl border backdrop-blur-xl p-5',
        'bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent',
        'border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)]',
        'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.45)]',
        'ring-1',
        toneRing,
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-medium">
          {label}
        </div>
        {formula || description ? (
          <button
            type="button"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onClick={() => setOpen((o) => !o)}
            className="rounded-full p-1 text-slate-400 hover:text-orange-300 hover:bg-orange-500/10 transition"
            aria-label="Mostrar fórmula"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
      <div className={`mt-3 text-3xl font-semibold tabular-nums tracking-tight ${toneText}`}>
        {value}
      </div>
      {delta !== undefined ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          {delta >= 0 ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          )}
          <span className={delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {(delta * 100).toFixed(1)}%
          </span>
          {deltaLabel ? (
            <span className="text-slate-500">{deltaLabel}</span>
          ) : null}
        </div>
      ) : null}
      {footer ? <div className="mt-3 text-xs text-slate-400">{footer}</div> : null}

      {open && (formula || description) ? (
        <div className="absolute z-30 right-0 top-full mt-2 w-[320px] rounded-xl border border-orange-500/30 bg-slate-900/95 backdrop-blur-md p-4 shadow-2xl">
          {formula ? (
            <div className="text-orange-200 text-base leading-relaxed">
              <Formula tex={formula} />
            </div>
          ) : null}
          {description ? (
            <p className="mt-2 text-xs text-slate-300 leading-snug">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
