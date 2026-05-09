import type { ReactNode } from 'react'

const ORANGE = '#F39C12'
const ORANGE_SOFT = 'rgba(243, 156, 18, 0.18)'
const ORANGE_DARK = '#C0721A'
const SLATE = '#94A3B8'
const GRID = 'rgba(148, 163, 184, 0.12)'

export type SeriesPoint = { label: string; value: number; secondary?: number }

export function AreaLineChart({
  data,
  height = 220,
  yLabel,
}: {
  data: SeriesPoint[]
  height?: number
  yLabel?: string
}) {
  if (data.length === 0) return <Empty />
  const w = 720
  const padX = 40
  const padY = 24
  const innerW = w - padX * 2
  const innerH = height - padY * 2
  const max = Math.max(...data.map((d) => d.value)) * 1.08
  const min = Math.min(0, ...data.map((d) => d.value))
  const x = (i: number) =>
    padX + (i * innerW) / Math.max(1, data.length - 1)
  const y = (v: number) =>
    padY + innerH - ((v - min) / (max - min || 1)) * innerH
  const path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.value)}`)
    .join(' ')
  const area = `${path} L ${x(data.length - 1)} ${padY + innerH} L ${x(0)} ${padY + innerH} Z`
  const ticks = 4
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ORANGE} stopOpacity="0.35" />
          <stop offset="100%" stopColor={ORANGE} stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const yt = padY + (innerH * i) / ticks
        const v = max - ((max - min) * i) / ticks
        return (
          <g key={i}>
            <line x1={padX} y1={yt} x2={w - padX} y2={yt} stroke={GRID} />
            <text x={padX - 6} y={yt + 3} textAnchor="end" fontSize="10" fill={SLATE}>
              {formatTick(v)}
            </text>
          </g>
        )
      })}
      <path d={area} fill="url(#areaGrad)" />
      <path d={path} stroke={ORANGE} strokeWidth="2" fill="none" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.value)} r="3" fill={ORANGE} />
          {i % Math.ceil(data.length / 8) === 0 || i === data.length - 1 ? (
            <text
              x={x(i)}
              y={height - 6}
              textAnchor="middle"
              fontSize="10"
              fill={SLATE}
            >
              {d.label}
            </text>
          ) : null}
        </g>
      ))}
      {yLabel ? (
        <text x={padX} y={padY - 8} fontSize="10" fill={SLATE}>
          {yLabel}
        </text>
      ) : null}
    </svg>
  )
}

export function BarChart({
  data,
  height = 220,
  onClick,
  highlightKey,
  valueFormat,
}: {
  data: (SeriesPoint & { key?: string })[]
  height?: number
  onClick?: (item: SeriesPoint & { key?: string }) => void
  highlightKey?: string
  valueFormat?: (v: number) => string
}) {
  if (data.length === 0) return <Empty />
  const w = 720
  const padX = 40
  const padY = 16
  const innerW = w - padX * 2
  const innerH = height - padY * 2 - 16
  const max = Math.max(...data.map((d) => d.value)) * 1.08
  const barW = (innerW / data.length) * 0.7
  const gap = (innerW / data.length) * 0.3
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full">
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1={padX}
          y1={padY + (innerH * i) / 4}
          x2={w - padX}
          y2={padY + (innerH * i) / 4}
          stroke={GRID}
        />
      ))}
      {data.map((d, i) => {
        const h = (d.value / max) * innerH
        const x = padX + i * (barW + gap) + gap / 2
        const y = padY + innerH - h
        const isHi = highlightKey && d.key === highlightKey
        return (
          <g
            key={i}
            className={onClick ? 'cursor-pointer' : ''}
            onClick={() => onClick?.(d)}
          >
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx="3"
              fill={isHi ? ORANGE : 'url(#barGrad)'}
              stroke={isHi ? ORANGE : 'rgba(243,156,18,0.4)'}
              strokeWidth="1"
            />
            <text
              x={x + barW / 2}
              y={y - 5}
              textAnchor="middle"
              fontSize="10"
              fill={ORANGE}
              fontWeight="500"
            >
              {valueFormat ? valueFormat(d.value) : formatTick(d.value)}
            </text>
            <text
              x={x + barW / 2}
              y={padY + innerH + 14}
              textAnchor="middle"
              fontSize="10"
              fill={SLATE}
            >
              {d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label}
            </text>
          </g>
        )
      })}
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ORANGE} stopOpacity="0.85" />
          <stop offset="100%" stopColor={ORANGE_DARK} stopOpacity="0.4" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function HorizontalBars({
  data,
  height = 200,
  valueFormat,
}: {
  data: SeriesPoint[]
  height?: number
  valueFormat?: (v: number) => string
}) {
  if (data.length === 0) return <Empty />
  const w = 720
  const padX = 130
  const max = Math.max(...data.map((d) => Math.abs(d.value))) || 1
  const rowH = height / data.length
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full">
      {data.map((d, i) => {
        const barW = ((Math.abs(d.value) / max) * (w - padX - 40))
        const y = i * rowH + rowH * 0.2
        const h = rowH * 0.6
        return (
          <g key={i}>
            <text
              x={padX - 8}
              y={y + h / 2 + 3.5}
              fontSize="11"
              textAnchor="end"
              fill={SLATE}
            >
              {d.label}
            </text>
            <rect x={padX} y={y} width={barW} height={h} rx="3" fill={ORANGE} opacity="0.85" />
            <text
              x={padX + barW + 6}
              y={y + h / 2 + 3.5}
              fontSize="11"
              fill={ORANGE}
              fontWeight="500"
            >
              {valueFormat ? valueFormat(d.value) : formatTick(d.value)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function Histogram({
  bins,
  height = 180,
  thresholdValue,
}: {
  bins: { bucket: number; count: number }[]
  height?: number
  thresholdValue?: number
}) {
  if (bins.length === 0) return <Empty />
  const w = 720
  const padX = 30
  const padY = 14
  const innerW = w - padX * 2
  const innerH = height - padY * 2
  const max = Math.max(...bins.map((b) => b.count)) || 1
  const min = bins[0].bucket
  const maxX = bins[bins.length - 1].bucket
  const rangeX = maxX - min || 1
  const barW = innerW / bins.length
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full">
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1={padX}
          y1={padY + (innerH * i) / 3}
          x2={w - padX}
          y2={padY + (innerH * i) / 3}
          stroke={GRID}
        />
      ))}
      {bins.map((b, i) => {
        const h = (b.count / max) * innerH
        return (
          <rect
            key={i}
            x={padX + i * barW + 1}
            y={padY + innerH - h}
            width={barW - 2}
            height={h}
            rx="1.5"
            fill={ORANGE}
            opacity={0.78}
          />
        )
      })}
      {thresholdValue !== undefined ? (
        <line
          x1={padX + ((thresholdValue - min) / rangeX) * innerW}
          y1={padY}
          x2={padX + ((thresholdValue - min) / rangeX) * innerW}
          y2={padY + innerH}
          stroke="#FB7185"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      ) : null}
      <text x={padX} y={height - 2} fontSize="10" fill={SLATE}>
        {formatTick(min)}
      </text>
      <text x={w - padX} y={height - 2} textAnchor="end" fontSize="10" fill={SLATE}>
        {formatTick(maxX)}
      </text>
    </svg>
  )
}

export function Pipeline({
  stages,
}: {
  stages: { name: string; capital: number; days: number; active?: boolean }[]
}) {
  if (stages.length === 0) return <Empty />
  const w = 720
  const h = 130
  const padX = 16
  const total = stages.reduce((s, t) => s + Math.max(1, t.capital), 0)
  let cursor = padX
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {stages.map((s, i) => {
        const segW = ((Math.max(1, s.capital) / total) * (w - padX * 2)) - 6
        const x = cursor
        cursor += segW + 6
        return (
          <g key={i}>
            <rect
              x={x}
              y={36}
              width={segW}
              height={56}
              rx="14"
              fill={s.active ? ORANGE : ORANGE_SOFT}
              stroke={ORANGE}
              strokeWidth={s.active ? 1.5 : 1}
              opacity={s.active ? 0.92 : 0.35}
            />
            <text
              x={x + segW / 2}
              y={28}
              textAnchor="middle"
              fontSize="11"
              fill={SLATE}
            >
              {s.name}
            </text>
            <text
              x={x + segW / 2}
              y={66}
              textAnchor="middle"
              fontSize="13"
              fontWeight="600"
              fill={s.active ? '#0f172a' : '#fed7aa'}
            >
              {formatTick(s.capital)}
            </text>
            <text
              x={x + segW / 2}
              y={82}
              textAnchor="middle"
              fontSize="10"
              fill={s.active ? '#0f172a' : SLATE}
              opacity="0.85"
            >
              ~{s.days}d
            </text>
            {i < stages.length - 1 ? (
              <text
                x={x + segW + 1}
                y={66}
                fontSize="14"
                fill={ORANGE}
                opacity="0.7"
              >
                ▸
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

export function DonutMix({
  segments,
  size = 160,
  centerLabel,
}: {
  segments: { label: string; value: number; color?: string }[]
  size?: number
  centerLabel?: ReactNode
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const radius = size / 2 - 12
  const cx = size / 2
  const cy = size / 2
  let acc = 0
  const palette = [ORANGE, '#fb923c', '#f59e0b', '#fbbf24', '#94A3B8', '#475569', '#64748b', '#cbd5e1']
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((s, i) => {
          const start = (acc / total) * Math.PI * 2 - Math.PI / 2
          acc += s.value
          const end = (acc / total) * Math.PI * 2 - Math.PI / 2
          const x1 = cx + Math.cos(start) * radius
          const y1 = cy + Math.sin(start) * radius
          const x2 = cx + Math.cos(end) * radius
          const y2 = cy + Math.sin(end) * radius
          const large = end - start > Math.PI ? 1 : 0
          return (
            <path
              key={i}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`}
              fill={s.color || palette[i % palette.length]}
              opacity="0.9"
            />
          )
        })}
        <circle cx={cx} cy={cy} r={radius - 28} fill="#0f172a" />
      </svg>
      <div className="text-xs space-y-1">
        {centerLabel ? <div className="mb-2 text-orange-300 font-semibold">{centerLabel}</div> : null}
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ background: s.color || palette[i % palette.length] }}
            />
            <span className="text-slate-300">{s.label}</span>
            <span className="text-slate-500 ml-auto tabular-nums">
              {((s.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Empty() {
  return (
    <div className="text-xs text-slate-500 italic py-6 text-center">
      Sin datos suficientes
    </div>
  )
}

function formatTick(v: number): string {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return v.toFixed(0)
}
