import { useState } from 'react'
import {
  LayoutDashboard,
  GitBranch,
  Ship,
  Boxes,
  Dices,
  Globe2,
} from 'lucide-react'
import { TopBar } from './components/TopBar'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ExecutiveOverview } from './sections/ExecutiveOverview'
import { DrillDown } from './sections/DrillDown'
import { SupplyChain } from './sections/SupplyChain'
import { Wms } from './sections/Wms'
import { Simulation } from './sections/Simulation'
import { MacroBenchmark } from './sections/MacroBenchmark'

type SectionId = 'overview' | 'drill' | 'supply' | 'wms' | 'simulation' | 'macro'

const NAV: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Executive', icon: LayoutDashboard },
  { id: 'drill', label: 'Drill-Down', icon: GitBranch },
  { id: 'supply', label: 'Importaciones', icon: Ship },
  { id: 'wms', label: 'WMS · Stock', icon: Boxes },
  { id: 'simulation', label: 'Simulación', icon: Dices },
  { id: 'macro', label: 'Macro · Comp.', icon: Globe2 },
]

export function Dashboard() {
  return (
    <ErrorBoundary>
      <DashboardInner />
    </ErrorBoundary>
  )
}

function DashboardInner() {
  const [active, setActive] = useState<SectionId>('overview')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 left-1/3 w-[640px] h-[640px] rounded-full bg-orange-500/[0.06] blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full bg-orange-700/[0.05] blur-3xl" />
      </div>

      <TopBar />

      <div className="flex">
        <aside className="hidden md:flex flex-col w-56 px-4 pt-6 pb-12 border-r border-white/5 sticky top-[68px] h-[calc(100vh-68px)]">
          <nav className="space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon
              const isActive = active === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActive(item.id)}
                  className={[
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition group',
                    isActive
                      ? 'bg-orange-500/15 text-orange-200 ring-1 ring-orange-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]',
                  ].join(' ')}
                >
                  <Icon
                    className={`w-4 h-4 transition ${
                      isActive
                        ? 'text-orange-300'
                        : 'text-slate-500 group-hover:text-orange-300'
                    }`}
                  />
                  {item.label}
                </button>
              )
            })}
          </nav>
          <div className="mt-auto pt-6 border-t border-white/5 text-[10px] text-slate-500 leading-relaxed">
            <div className="text-orange-300/80 uppercase tracking-[0.2em] mb-1">
              Engine
            </div>
            McKinsey Operating Approach · Monte Carlo · NN classifier
          </div>
        </aside>

        <main className="flex-1 px-4 sm:px-6 py-6 max-w-[1400px]">
          <MobileNav active={active} setActive={setActive} />
          {active === 'overview' && <ExecutiveOverview />}
          {active === 'drill' && <DrillDown />}
          {active === 'supply' && <SupplyChain />}
          {active === 'wms' && <Wms />}
          {active === 'simulation' && <Simulation />}
          {active === 'macro' && <MacroBenchmark />}
        </main>
      </div>
    </div>
  )
}

function MobileNav({
  active,
  setActive,
}: {
  active: SectionId
  setActive: (s: SectionId) => void
}) {
  return (
    <div className="md:hidden mb-4 flex gap-1.5 overflow-x-auto pb-2">
      {NAV.map((item) => {
        const isActive = active === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActive(item.id)}
            className={[
              'whitespace-nowrap px-3 py-1.5 rounded-full text-xs transition border',
              isActive
                ? 'bg-orange-500/20 text-orange-200 border-orange-500/40'
                : 'text-slate-400 bg-white/[0.02] border-white/10',
            ].join(' ')}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
