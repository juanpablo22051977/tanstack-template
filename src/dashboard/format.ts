const usdFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
const usdFmt2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})
const numFmt = new Intl.NumberFormat('en-US')
const pctFmt = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
})
const pct2Fmt = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 2,
})

export function formatUsd(v: number, precise = false) {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) >= 1_000_000)
    return `$${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return precise ? usdFmt2.format(v) : usdFmt.format(v)
}
export const formatUsdExact = (v: number) =>
  Number.isFinite(v) ? usdFmt2.format(v) : '—'

export const formatNum = (v: number) =>
  Number.isFinite(v) ? numFmt.format(Math.round(v)) : '—'

export const formatPct = (v: number) =>
  Number.isFinite(v) ? pctFmt.format(v) : '—'

export const formatPct2 = (v: number) =>
  Number.isFinite(v) ? pct2Fmt.format(v) : '—'

export const formatDays = (v: number) =>
  Number.isFinite(v) ? `${Math.round(v)} d` : '—'
