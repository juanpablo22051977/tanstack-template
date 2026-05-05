import { Store, useStore } from '@tanstack/react-store'
import type { Dataset, DateRange, DrillPath, WaccInputs } from '../finance/types'
import { buildSampleDataset } from '../finance/sampleData'

export type SensitivityState = {
  marginDelta: number
  fxDelta: number
  freightDelta: number
}

export type MonteCarloState = {
  iterations: number
  salesVol: number
  fxVol: number
  freightVol: number
  customsBetaAlpha: number
  customsBetaBeta: number
  customsScaleDays: number
}

export type DashboardState = {
  dataset: Dataset
  isSample: boolean
  dateRange: DateRange | null
  drill: DrillPath
  sensitivity: SensitivityState
  monteCarlo: MonteCarloState
  importNotice: string | null
}

const initialDataset = buildSampleDataset()

export const dashboardStore = new Store<DashboardState>({
  dataset: initialDataset,
  isSample: true,
  dateRange: null,
  drill: {},
  sensitivity: { marginDelta: 0, fxDelta: 0, freightDelta: 0 },
  monteCarlo: {
    iterations: 10000,
    salesVol: 0.18,
    fxVol: 0.04,
    freightVol: 0.12,
    customsBetaAlpha: 2,
    customsBetaBeta: 5,
    customsScaleDays: 35,
  },
  importNotice: null,
})

export const dashboardActions = {
  setDataset(dataset: Dataset, isSample = false, notice: string | null = null) {
    dashboardStore.setState((s) => ({ ...s, dataset, isSample, importNotice: notice }))
  },
  resetSample() {
    dashboardStore.setState((s) => ({
      ...s,
      dataset: buildSampleDataset(),
      isSample: true,
      drill: {},
      importNotice: null,
    }))
  },
  setDateRange(range: DateRange | null) {
    dashboardStore.setState((s) => ({ ...s, dateRange: range }))
  },
  setDrill(drill: DrillPath) {
    dashboardStore.setState((s) => ({ ...s, drill }))
  },
  pushDrill(patch: Partial<DrillPath>) {
    dashboardStore.setState((s) => ({ ...s, drill: { ...s.drill, ...patch } }))
  },
  popDrillTo(level: keyof DrillPath | 'root') {
    dashboardStore.setState((s) => {
      if (level === 'root') return { ...s, drill: {} }
      const order: (keyof DrillPath)[] = ['category', 'zone', 'repId', 'sku', 'invoiceId']
      const cut = order.indexOf(level)
      const next: DrillPath = {}
      for (let i = 0; i <= cut; i++) {
        const k = order[i]
        if (s.drill[k] !== undefined) next[k] = s.drill[k] as never
      }
      return { ...s, drill: next }
    })
  },
  updateSensitivity(p: Partial<SensitivityState>) {
    dashboardStore.setState((s) => ({ ...s, sensitivity: { ...s.sensitivity, ...p } }))
  },
  updateMonteCarlo(p: Partial<MonteCarloState>) {
    dashboardStore.setState((s) => ({ ...s, monteCarlo: { ...s.monteCarlo, ...p } }))
  },
  updateWacc(p: Partial<WaccInputs>) {
    dashboardStore.setState((s) => ({
      ...s,
      dataset: { ...s.dataset, wacc: { ...s.dataset.wacc, ...p } },
    }))
  },
}

export function useDashboard<T>(selector: (s: DashboardState) => T): T {
  return useStore(dashboardStore, selector)
}
