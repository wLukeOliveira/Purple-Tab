import { useEffect, useRef, useState } from 'react'
import { PanelsTopLeft, Check, ArrowUp, ArrowDown, X } from 'lucide-react'
import { api } from '../lib/api'
import type { Commit, DashboardWidget, Settings } from '../lib/types'

const labels: Record<DashboardWidget, string> = { balance: 'Saldo e previsão', summary: 'Entradas e saídas', cashchart: 'Gráfico navegável', categories: 'Distribuições', recent: 'Últimos lançamentos', accounts: 'Contas bancárias', portfolio: 'Carteira de investimentos', rates: 'CDI, Selic e câmbio' }
const presets = [{ id: 'overview', name: 'Visão completa' }, { id: 'banking', name: 'Contas e rotina' }, { id: 'investing', name: 'Investimentos' }, { id: 'charts', name: 'Mesa de gráficos' }, { id: 'foreign', name: 'Visão internacional' }, { id: 'custom', name: 'Meu layout' }]
export default function WorkspaceMenu({ settings, onCommit }: { settings: Settings; onCommit: Commit }) {
  const [open, setOpen] = useState(false), [custom, setCustom] = useState(false)
  const anchor = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!anchor.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('mousedown', close); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key) }
  }, [open])
  const layouts: Record<string, DashboardWidget[]> = { overview: Object.keys(labels) as DashboardWidget[], banking: ['balance','accounts','summary','recent','cashchart'], investing: ['portfolio','rates','cashchart','balance'], charts: ['cashchart','categories','portfolio','rates'], foreign: ['balance','rates','accounts','portfolio','cashchart'], custom: settings.dashboardWidgets || Object.keys(labels) as DashboardWidget[] }
  const widgets = layouts[settings.dashboardLayout || 'overview'] || layouts.overview
  const save = (next: DashboardWidget[]) => void onCommit(() => api.saveSettings({ dashboardLayout: 'custom', dashboardWidgets: next }), '')
  return <div className="workspace-anchor" ref={anchor}>
    <button ref={trigger} className="icon-button workspace-trigger" title="Visualização do espaço de trabalho" aria-label="Visualização do espaço de trabalho" aria-expanded={open} aria-controls="workspace-panel" onClick={() => setOpen(v => !v)}><PanelsTopLeft size={18} /></button>
    {open && <section id="workspace-panel" className="workspace-popover" aria-label="Layouts do dashboard"><div className="section-heading"><span className="eyebrow">SEU ESPAÇO</span><button className="icon-button" aria-label="Fechar layouts" onClick={() => { setOpen(false); trigger.current?.focus() }}><X size={15} /></button></div><div className="workspace-presets">{presets.map(p => <button key={p.id} aria-pressed={(settings.dashboardLayout || 'overview') === p.id} onClick={async () => { if (await onCommit(() => api.saveSettings({ dashboardLayout: p.id, ...(p.id === 'foreign' ? { displayCurrency: 'USD' } : {}) }), '')) { setOpen(false); trigger.current?.focus() } }}>{p.name}{(settings.dashboardLayout || 'overview') === p.id && <Check size={14} />}</button>)}</div><button className="text-button" aria-expanded={custom} onClick={() => setCustom(v => !v)}>Personalizar layout</button>{custom && <div className="workspace-custom">{[...widgets, ...(Object.keys(labels) as DashboardWidget[]).filter(w => !widgets.includes(w))].map(w => <div key={w}><label><input type="checkbox" checked={widgets.includes(w)} onChange={e => save(e.target.checked ? [...widgets, w] : widgets.filter(x => x !== w))} />{labels[w]}</label><span>{[-1, 1].map(dir => <button key={dir} className="icon-button" aria-label={`Mover ${labels[w]} para ${dir < 0 ? 'cima' : 'baixo'}`} disabled={!widgets.includes(w) || widgets.indexOf(w) + dir < 0 || widgets.indexOf(w) + dir >= widgets.length} onClick={() => { const next = [...widgets], index = next.indexOf(w); [next[index], next[index + dir]] = [next[index + dir], next[index]]; save(next) }}>{dir < 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}</button>)}</span></div>)}</div>}</section>}
  </div>
}
