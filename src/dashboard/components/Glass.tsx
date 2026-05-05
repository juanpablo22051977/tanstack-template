import type { ReactNode } from 'react'

export function Glass({
  children,
  className = '',
  accent = false,
}: {
  children: ReactNode
  className?: string
  accent?: boolean
}) {
  return (
    <div
      className={[
        'rounded-2xl border backdrop-blur-xl',
        'bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent',
        'border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)]',
        accent ? 'ring-1 ring-orange-500/30' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 className="text-xs uppercase tracking-[0.18em] text-orange-400/90 font-semibold">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      {right}
    </div>
  )
}
