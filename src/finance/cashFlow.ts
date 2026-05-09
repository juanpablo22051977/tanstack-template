import type { Dataset, DateRange } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Cash flow engine — unifies cash transactions, AP/AR payments and (optionally)
// journal entries hitting cash accounts into one event stream, then derives
// the analytics the Cash Flow section displays.
// ─────────────────────────────────────────────────────────────────────────────

export type CashFlowSource = 'cash' | 'payment' | 'journal'

export type CashFlowEvent = {
  date: string
  source: CashFlowSource
  type: string
  reference: string
  counterparty?: string
  cashAccount?: string
  branch?: string
  amount: number // signed: + inflow, − outflow
  currency?: string
  description?: string
}

export type CashFlowDailyPoint = {
  date: string
  inflow: number
  outflow: number
  net: number
  cumulative: number
  count: number
}

export type CashFlowMonthlyPoint = {
  month: string // yyyy-mm
  inflow: number
  outflow: number
  net: number
  count: number
}

export type CashFlowBreakdown = {
  key: string
  amount: number
  inflow: number
  outflow: number
  count: number
}

export type CashFlowSummary = {
  events: CashFlowEvent[]
  totalInflow: number
  totalOutflow: number
  netCash: number
  endingBalance: number
  startingBalance: number
  daily: CashFlowDailyPoint[]
  monthly: CashFlowMonthlyPoint[]
  byType: CashFlowBreakdown[]
  byCashAccount: CashFlowBreakdown[]
  byBranch: CashFlowBreakdown[]
  topInflowCounterparties: CashFlowBreakdown[]
  topOutflowCounterparties: CashFlowBreakdown[]
  averageMonthlyBurn: number // positive number = average outflow per month
  averageMonthlyInflow: number
  runwayDays: number | null
  largestSingleInflow: CashFlowEvent | null
  largestSingleOutflow: CashFlowEvent | null
  hasData: boolean
}

// Heuristic: in most LatAm Charts of Accounts, accounts starting with "11"
// are cash & equivalents. We use this only to add journal entries when no
// other cash source exists, to avoid double counting.
const CASH_ACCOUNT_REGEX = /^11/

function inRange(date: string, range: DateRange | null): boolean {
  if (!range) return true
  return date >= range.from && date <= range.to
}

export function unifyCashFlowEvents(
  ds: Dataset,
  range: DateRange | null = null,
): CashFlowEvent[] {
  const events: CashFlowEvent[] = []

  // Primary source: explicit cash transactions if available.
  // Fall back to AP/AR payments. Combining both would double-count because
  // every AP payment in Acumatica also creates a CADaily entry.
  if (ds.cashTransactions.length > 0) {
    for (const tx of ds.cashTransactions) {
      if (!inRange(tx.date, range)) continue
      events.push({
        date: tx.date,
        source: 'cash',
        type: tx.type || 'Tx',
        reference: tx.reference || tx.id,
        counterparty: tx.customerSupplier,
        cashAccount: tx.cashAccount,
        branch: tx.branchName || tx.branch,
        amount: tx.amount,
        currency: tx.currency,
        description: tx.description,
      })
    }
  } else if (ds.payments.length > 0) {
    for (const p of ds.payments) {
      if (!inRange(p.date, range)) continue
      events.push({
        date: p.date,
        source: 'payment',
        type: p.type || 'Pago',
        reference: p.reference || p.id,
        counterparty: p.vendorOrCustomer,
        cashAccount: p.cashAccount,
        branch: p.branch,
        amount: p.amount,
        currency: p.currency,
      })
    }
  }

  // Add journal entries on cash accounts only if they aren't already covered.
  if (events.length === 0 && ds.journalEntries.length > 0) {
    for (const j of ds.journalEntries) {
      if (!CASH_ACCOUNT_REGEX.test(j.account)) continue
      if (!inRange(j.date, range)) continue
      const amount = j.debit - j.credit
      if (amount === 0) continue
      events.push({
        date: j.date,
        source: 'journal',
        type: j.module ? `${j.module} ${j.batch || ''}`.trim() : 'GL',
        reference: j.batch || j.id,
        counterparty: j.accountDescription || j.description,
        cashAccount: j.account,
        branch: j.branch,
        amount,
        currency: j.currency,
        description: j.description,
      })
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date))
  return events
}

function aggregateDaily(events: CashFlowEvent[]): CashFlowDailyPoint[] {
  const map = new Map<string, CashFlowDailyPoint>()
  for (const e of events) {
    const d = e.date
    const cur = map.get(d) || {
      date: d,
      inflow: 0,
      outflow: 0,
      net: 0,
      cumulative: 0,
      count: 0,
    }
    if (e.amount >= 0) cur.inflow += e.amount
    else cur.outflow += -e.amount
    cur.net += e.amount
    cur.count += 1
    map.set(d, cur)
  }
  const sorted = [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
  let running = 0
  for (const p of sorted) {
    running += p.net
    p.cumulative = running
  }
  return sorted
}

function aggregateMonthly(events: CashFlowEvent[]): CashFlowMonthlyPoint[] {
  const map = new Map<string, CashFlowMonthlyPoint>()
  for (const e of events) {
    const m = e.date.slice(0, 7)
    const cur = map.get(m) || { month: m, inflow: 0, outflow: 0, net: 0, count: 0 }
    if (e.amount >= 0) cur.inflow += e.amount
    else cur.outflow += -e.amount
    cur.net += e.amount
    cur.count += 1
    map.set(m, cur)
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
}

function topBreakdown(
  events: CashFlowEvent[],
  keyFn: (e: CashFlowEvent) => string | undefined,
  limit: number,
  side: 'inflow' | 'outflow' | 'all',
): CashFlowBreakdown[] {
  const map = new Map<string, CashFlowBreakdown>()
  for (const e of events) {
    const key = keyFn(e)
    if (!key) continue
    if (side === 'inflow' && e.amount < 0) continue
    if (side === 'outflow' && e.amount > 0) continue
    const cur = map.get(key) || { key, amount: 0, inflow: 0, outflow: 0, count: 0 }
    cur.amount += e.amount
    if (e.amount >= 0) cur.inflow += e.amount
    else cur.outflow += -e.amount
    cur.count += 1
    map.set(key, cur)
  }
  const arr = [...map.values()]
  arr.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  return arr.slice(0, limit)
}

export function computeCashFlow(
  ds: Dataset,
  range: DateRange | null = null,
): CashFlowSummary {
  const events = unifyCashFlowEvents(ds, range)
  const totalInflow = events.reduce((s, e) => s + (e.amount > 0 ? e.amount : 0), 0)
  const totalOutflow = events.reduce((s, e) => s + (e.amount < 0 ? -e.amount : 0), 0)
  const netCash = totalInflow - totalOutflow

  const daily = aggregateDaily(events)
  const monthly = aggregateMonthly(events)

  // Starting balance proxy: opening cash position from financial statements
  // minus the imported activity already reflected. For a cleaner story we
  // start from 0 and let the cumulative track net flow within the period.
  const startingBalance = 0
  const endingBalance = startingBalance + netCash

  const byType = topBreakdown(events, (e) => e.type, 12, 'all')
  const byCashAccount = topBreakdown(
    events,
    (e) => e.cashAccount || 'Sin cuenta',
    8,
    'all',
  )
  const byBranch = topBreakdown(
    events,
    (e) => e.branch || 'Sin sucursal',
    8,
    'all',
  )
  const topInflowCounterparties = topBreakdown(
    events,
    (e) => e.counterparty,
    10,
    'inflow',
  )
  const topOutflowCounterparties = topBreakdown(
    events,
    (e) => e.counterparty,
    10,
    'outflow',
  )

  const monthsCovered = monthly.length || 1
  const averageMonthlyInflow = totalInflow / monthsCovered
  const averageMonthlyBurn = totalOutflow / monthsCovered

  // Runway: how long does the ending balance + financial-statement cash buffer
  // last at the current burn rate? If burn ≤ inflow, runway is effectively
  // infinite (positive cash flow).
  const cashBuffer = ds.financials.cash - ds.financials.excessCash
  const netMonthlyBurn = Math.max(0, averageMonthlyBurn - averageMonthlyInflow)
  const totalAvailable = Math.max(0, endingBalance + cashBuffer)
  const runwayDays =
    netMonthlyBurn > 0
      ? Math.round((totalAvailable / netMonthlyBurn) * 30)
      : null

  let largestSingleInflow: CashFlowEvent | null = null
  let largestSingleOutflow: CashFlowEvent | null = null
  for (const e of events) {
    if (
      e.amount > 0 &&
      (!largestSingleInflow || e.amount > largestSingleInflow.amount)
    ) {
      largestSingleInflow = e
    }
    if (
      e.amount < 0 &&
      (!largestSingleOutflow || e.amount < largestSingleOutflow.amount)
    ) {
      largestSingleOutflow = e
    }
  }

  return {
    events,
    totalInflow,
    totalOutflow,
    netCash,
    endingBalance,
    startingBalance,
    daily,
    monthly,
    byType,
    byCashAccount,
    byBranch,
    topInflowCounterparties,
    topOutflowCounterparties,
    averageMonthlyInflow,
    averageMonthlyBurn,
    runwayDays,
    largestSingleInflow,
    largestSingleOutflow,
    hasData: events.length > 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calibration: derive Monte Carlo input parameters from historical events.
// Returns null if there isn't enough data (< 3 monthly observations).
// ─────────────────────────────────────────────────────────────────────────────
export type HistoricalCalibration = {
  monthlyMean: number
  monthlySigma: number
  monthlyCv: number // coefficient of variation
  observations: number
  averageOutflow: number
  averageInflow: number
}

export function calibrateFromHistory(
  ds: Dataset,
  range: DateRange | null = null,
): HistoricalCalibration | null {
  const events = unifyCashFlowEvents(ds, range)
  if (events.length === 0) return null
  const monthly = aggregateMonthly(events)
  if (monthly.length < 3) return null
  const nets = monthly.map((m) => m.net)
  const mean = nets.reduce((a, b) => a + b, 0) / nets.length
  const variance =
    nets.reduce((s, x) => s + (x - mean) * (x - mean), 0) / nets.length
  const sigma = Math.sqrt(variance)
  const cv = mean !== 0 ? Math.abs(sigma / mean) : 0
  const totalInflow = monthly.reduce((s, m) => s + m.inflow, 0)
  const totalOutflow = monthly.reduce((s, m) => s + m.outflow, 0)
  return {
    monthlyMean: mean,
    monthlySigma: sigma,
    monthlyCv: cv,
    observations: monthly.length,
    averageInflow: totalInflow / monthly.length,
    averageOutflow: totalOutflow / monthly.length,
  }
}
