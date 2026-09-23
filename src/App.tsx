import { Component } from 'react'
import type { ReactNode } from 'react'
import DesktopApp from './DesktopApp'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' }
  static getDerivedStateFromError(error: Error) { return { error: error.message } }
  render() {
    if (this.state.error) return <div className="startup"><h1>Precisamos recarregar esta tela</h1><p role="alert">{this.state.error}</p><p>Os registros já salvos permanecem no banco local.</p><button className="button primary" onClick={() => location.reload()}>Reabrir aplicativo</button></div>
    return this.props.children
  }
}
export default function App() { return <ErrorBoundary><DesktopApp /></ErrorBoundary> }
