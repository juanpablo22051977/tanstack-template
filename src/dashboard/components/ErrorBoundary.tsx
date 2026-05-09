import { Component, type ReactNode, type ErrorInfo } from 'react'

type State = { error: Error | null; info: ErrorInfo | null }

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: (e: Error, reset: () => void) => ReactNode },
  State
> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info })
    console.error('Dashboard error boundary:', error, info)
  }

  reset = () => this.setState({ error: null, info: null })

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset)
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200 flex items-center justify-center px-4">
          <div className="max-w-2xl w-full rounded-2xl border border-rose-500/30 bg-slate-900/80 p-8">
            <div className="text-xs uppercase tracking-[0.2em] text-rose-300 font-semibold">
              Error en la aplicación
            </div>
            <div className="mt-2 text-2xl text-slate-100 font-semibold">
              {this.state.error.name}: {this.state.error.message}
            </div>
            <pre className="mt-4 max-h-64 overflow-auto text-[11px] text-slate-400 bg-black/40 border border-white/10 rounded-lg p-3 whitespace-pre-wrap">
              {this.state.error.stack}
            </pre>
            {this.state.info?.componentStack ? (
              <pre className="mt-2 max-h-48 overflow-auto text-[11px] text-slate-500 bg-black/40 border border-white/10 rounded-lg p-3 whitespace-pre-wrap">
                {this.state.info.componentStack}
              </pre>
            ) : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={this.reset}
                className="rounded-lg px-4 py-2 text-sm font-medium text-orange-200 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 transition"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => location.reload()}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition"
              >
                Recargar página
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
