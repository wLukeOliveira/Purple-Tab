import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { House, History as HistoryIcon, GitCompareArrows, ChartNoAxesCombined, CirclePlus, Trophy, Settings as SettingsIcon, Plus, X, Maximize2, ChevronLeft, ChevronRight, Database, ArrowDownUp, PanelLeftClose, PanelLeftOpen, WalletCards } from 'lucide-react'
import type { Commit, Filters, Screen, Settings, Snapshot, Transaction, Transfer } from './lib/types'
import { api, isDesktop } from './lib/api'
import { defaultFilters, today } from './lib/finance'
import { useSurfaceLight } from './lib/useSurfaceLight'
import Dashboard from './features/Dashboard'
import History from './features/History'
import Comparison from './features/Comparison'
import Reports from './features/Reports'
import Achievements from './features/Achievements'
import { TransactionEditor } from './features/TransactionEditor'
import { TransferEditor } from './features/TransferEditor'
import { Catalogs } from './features/Catalogs'
import Preferences from './features/Preferences'
import FilterBar from './features/FilterBar'
import logo from './assets/logo.png'
import './desktop.css'
import './features/investments.css'
import '@fontsource/nunito-sans/latin-700.css'
import '@fontsource/nunito-sans/latin-800.css'
import Investments from './features/Investments'
import { CurrencyContext } from './lib/CurrencyContext'
import { reportingSnapshot } from './lib/investments'
import { Identity } from './features/Identity'
import Bills from './features/Bills'
import Loans from './features/Loans'
import Patrimony from './features/Patrimony'
import WorkspaceMenu from './features/WorkspaceMenu'
import Cards from './features/Cards'
import DisplayCurrency from './features/DisplayCurrency'
import { CreditCard } from 'lucide-react'
import { CalendarDays, Landmark, Gem } from 'lucide-react'
import './features/planning.css'

const navigation = [
  { id: 'home', title: 'Visão geral', icon: House, description: 'Seu dinheiro, com clareza.' },
  { id: 'bills', title: 'Contas a pagar', icon: CalendarDays, description: 'Sua rotina em dia, mesmo antes de saber o valor.' },
  { id: 'cards', title: 'Cartões', icon: CreditCard, description: 'Compras, faturas e limites — cada coisa no seu lugar.' },
  { id: 'loans', title: 'Financiamentos', icon: Landmark, description: 'Empréstimos, parcelas e o caminho até a quitação.' },
  { id: 'patrimony', title: 'Patrimônio', icon: Gem, description: 'Tudo que você construiu, em uma visão completa.' },
  { id: 'investments', title: 'Investimentos', icon: WalletCards, description: 'Sua carteira, seus mercados, suas possibilidades.' },
  { id: 'history', title: 'Histórico', icon: HistoryIcon, description: 'Consulte e organize cada movimentação.' },
  { id: 'comparison', title: 'Comparação', icon: GitCompareArrows, description: 'Entenda o que mudou entre períodos e projetos.' },
  { id: 'reports', title: 'Relatórios', icon: ChartNoAxesCombined, description: 'Transforme seus registros em informação.' },
  { id: 'creation', title: 'Criação', icon: CirclePlus, description: 'Tudo que você precisa para organizar suas finanças.' },
  { id: 'achievements', title: 'Conquistas', icon: Trophy, description: 'Acompanhe metas e reconheça seu progresso.' },
  { id: 'settings', title: 'Configurações', icon: SettingsIcon, description: 'Seu espaço, seus dados, suas preferências.' },
] as const
type Overlay = { kind: 'entry'; entry?: Transaction; duplicate?: boolean } | { kind: 'transfer'; transfer?: Transfer } | { kind: 'catalog'; initialKind: 'project' | 'account' | 'category' } | null

function Modal({ title, onClose, closing, children }: { title: string; onClose: () => void; closing: boolean; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const getFocusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]') || []).filter(el => el.getClientRects().length)
    getFocusable()[0]?.focus()
    const handler = (event: KeyboardEvent) => {
      if (document.querySelector('dialog.quick-create-dialog[open]')) return
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current() }
      if (event.key === 'Tab') {
        const elements = getFocusable(), first = elements[0], last = elements.at(-1)
        if (!first) { event.preventDefault(); return }
        if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handler)
    return () => { document.removeEventListener('keydown', handler); previous?.focus() }
  }, [])
  return <div className={`modal-backdrop ${closing ? 'is-closing' : ''}`}><div className="modal-panel" ref={panel} role="dialog" aria-modal="true" aria-label={title} inert={closing}>{children}</div></div>
}

export default function DesktopApp() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [marketRefreshing,setMarketRefreshing] = useState(false)
  const [marketErrors,setMarketErrors] = useState<string[]>([])
  const [fatal, setFatal] = useState('')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [closingOverlay, setClosingOverlay] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null)
  const [saving, setSaving] = useState(0)
  const [filters, setFilters] = useState<Filters>(() => defaultFilters(today()))
  const menu = useRef<HTMLDivElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const main = useRef<HTMLElement>(null)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useSurfaceLight(surface, Boolean(snapshot))
  const closeOverlay = useCallback(() => {
    if (dismissTimer.current) return
    setClosingOverlay(true)
    dismissTimer.current = setTimeout(() => {
      setOverlay(null)
      setClosingOverlay(false)
      dismissTimer.current = null
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180)
  }, [])
  useEffect(() => () => { if (dismissTimer.current) clearTimeout(dismissTimer.current) }, [])
  useEffect(() => { main.current?.scrollTo({ top: 0, behavior: 'instant' }) }, [snapshot?.settings.screen])

  useEffect(() => {
    if (isDesktop) api.getSnapshot().then(setSnapshot).catch(error => setFatal(error.message))
  }, [])
  useEffect(() => {
    if (!toast || toast.error) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    if (!showProjects) return
    const close = (event: MouseEvent) => { if (!menu.current?.contains(event.target as Node)) setShowProjects(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showProjects])

  const commit: Commit = useCallback(async (action, success) => {
    setSaving(n => n + 1)
    try {
      const result = await action()
      if (result && typeof result === 'object' && 'canceled' in result && result.canceled) return false
      if (result && typeof result === 'object' && 'restored' in result && result.restored) setFilters(defaultFilters(today()))
      setSnapshot(await api.getSnapshot())
      if (success) setToast({ text: success, error: false })
      return true
    } catch (error) {
      setToast({ text: error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.', error: true })
      return false
    } finally { setSaving(n => n - 1) }
  }, [])

  useEffect(()=>{
    if (!isDesktop) return
    let active=true
    const refresh=async()=>{
      if(document.hidden) return
      setMarketRefreshing(true)
      try { const result=await api.refreshMarkets(); if(active){setMarketErrors(result.errors);setSnapshot(await api.getSnapshot())} }
      catch(e){if(active)setMarketErrors([e instanceof Error?e.message:'Conexão indisponível'])}
      finally{if(active)setMarketRefreshing(false)}
    }
    void refresh()
    const timer=setInterval(()=>void refresh(),60000)
    return()=>{active=false;clearInterval(timer)}
  },[])

  const streamingAssets = snapshot?.investments?.filter(a=>a.provider==='coinbase'&&!a.closedDate).map(a=>a.id+':'+a.symbol).join(',') || ''
  const streamingScreen = snapshot?.settings.screen || 'home'
  useEffect(()=>{
    if(!isDesktop) return
    const apply=()=>void api.setMarketStreaming(Boolean(streamingAssets)&&!document.hidden&&['home','investments'].includes(streamingScreen)).catch(()=>{})
    apply();document.addEventListener('visibilitychange',apply)
    let pending:ReturnType<typeof setTimeout>|undefined
    const unsubscribe=api.onMarketUpdate(()=>{if(pending)return;pending=setTimeout(()=>{pending=undefined;void api.getSnapshot().then(setSnapshot).catch(()=>{})},400)})
    return()=>{document.removeEventListener('visibilitychange',apply);unsubscribe();clearTimeout(pending);void api.setMarketStreaming(false).catch(()=>{})}
  },[streamingAssets,streamingScreen])

  if (!isDesktop) return <div className="startup"><img src={logo} alt="Purple Tab" /><h1>Abra o Purple Tab no desktop</h1><p>O banco local é acessado pela janela do aplicativo Windows.</p><p className="muted">Para desenvolver, use <code>npm run electron-dev</code>. Para usar, abra Purple Tab.exe.</p></div>
  if (fatal) return <div className="startup"><h1>Não foi possível ler os dados</h1><p role="alert">{fatal}</p><button className="button primary" onClick={() => location.reload()}>Tentar novamente</button></div>
  if (!snapshot) return <div className="startup"><img src={logo} alt="Purple Tab" /><h1>Preparando seu espaço…</h1><p>Abrindo o banco local.</p></div>

  const { settings, projects } = snapshot
  const activeProject = projects.find(p => p.id === settings.activeTab && !p.archived)
  const projectId = activeProject?.id || 'geral'
  const screen = navigation.some(item => item.id === settings.screen) ? settings.screen : 'home'
  const current = navigation.find(item => item.id === screen)!
  const openTabs = ['geral', ...settings.openTabs.filter((id, index, all) => id !== 'geral' && all.indexOf(id) === index && projects.some(p => p.id === id && !p.archived))]
  const saveSettings = (data: Partial<Settings>) => commit(() => api.saveSettings(data), '')
  const navigate = (next: Screen) => { void saveSettings({ screen: next }) }
  const newEntry = () => setOverlay({ kind: 'entry' })
  const editEntry = (entry: Transaction, duplicate = false) => {
    if (entry.creditCardId) { navigate('cards'); return }
    if (!duplicate && (entry.billId || entry.loanId)) { navigate(entry.billId ? 'bills' : 'loans'); return }
    setOverlay({ kind: 'entry', entry: snapshot.transactions.find(t=>t.id===entry.id) || entry, duplicate })
  }
  const openProject = (id: string) => { setShowProjects(false); void saveSettings({ activeTab: id, openTabs: openTabs.includes(id) ? openTabs : [...openTabs, id] }) }
  const closeTab = (id: string) => { void saveSettings({ openTabs: openTabs.filter(tab => tab !== id), activeTab: projectId === id ? 'geral' : projectId }) }
  const moveTab = (id: string, direction: number) => {
    const ordered = [...openTabs], index = ordered.indexOf(id), next = index + direction
    if (index < 1 || next < 1 || next >= ordered.length) return
    ;[ordered[index], ordered[next]] = [ordered[next], ordered[index]]
    void saveSettings({ openTabs: ordered })
  }
  const displayCurrency = settings.displayCurrency || 'BRL'
  const reporting = reportingSnapshot(snapshot,displayCurrency)
  const common = { snapshot:reporting.snapshot, projectId, filters, onEdit: editEntry, onNew: newEntry, onCommit: commit }

  return <CurrencyContext.Provider value={displayCurrency}><div ref={surface} className={`desktop-app ${settings.compact ? 'compact' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <header className="app-topbar">
      <div className="brand"><img src={logo} alt="" /><span>Purple<span className="brand-accent">Tab</span><small>SEU ESPAÇO FINANCEIRO</small></span></div>
      <div className="project-tabs" aria-label="Projetos abertos">
        <div className="project-tabs-scroll">{openTabs.map((id, index) => {
          const project = projects.find(p => p.id === id)
          return <div key={id} className={`project-tab ${projectId === id ? 'active' : ''}`}>
            <button className="tab-label" onClick={() => openProject(id)} aria-pressed={projectId === id}>{project && <Identity value={project.icon || 'folder'} color={project.color} size={20}/>}{project?.name || 'Geral'}</button>
            {id !== 'geral' && <><button className="tab-close" title={`Fechar aba ${project?.name}`} aria-label={`Fechar aba ${project?.name}`} onClick={() => closeTab(id)}><X size={13} /></button>{projectId === id && <div className="tab-order"><button aria-label="Mover aba para esquerda" disabled={index < 2} onClick={() => moveTab(id, -1)}><ChevronLeft size={12} /></button><button aria-label="Mover aba para direita" disabled={index === openTabs.length - 1} onClick={() => moveTab(id, 1)}><ChevronRight size={12} /></button></div>}</>}
          </div>
        })}</div>
        <div className="project-menu-anchor" ref={menu}>
          <button className="icon-button add-tab" aria-label="Abrir ou criar projeto" aria-expanded={showProjects} onClick={() => setShowProjects(v => !v)}><Plus size={18} /></button>
          {showProjects && <div className="project-menu"><p className="eyebrow">SEUS PROJETOS</p>{projects.filter(p => !p.archived).map(p => <button key={p.id} onClick={() => openProject(p.id)}><Identity value={p.icon || 'folder'} color={p.color} size={22}/>{p.name}<span className="muted">{openTabs.includes(p.id) ? 'Aberto' : 'Abrir'}</span></button>)}<button className="menu-create" onClick={() => { setShowProjects(false); setOverlay({ kind: 'catalog', initialKind: 'project' }) }}><Plus size={16} />Criar ou gerenciar projetos</button></div>}
        </div>
      </div>
      <div className="topbar-actions"><DisplayCurrency value={displayCurrency} onChange={currency => saveSettings({ displayCurrency: currency })} /><span className="local-chip"><span />{saving > 0 ? 'Salvando…' : marketRefreshing ? 'Atualizando…' : 'Local'}</span><button className="icon-button" title="Tela cheia" aria-label="Tela cheia" onClick={() => void commit(() => api.toggleFullscreen(), '')}><Maximize2 size={18} /></button><button className="avatar" title="Abrir configurações" onClick={() => navigate('settings')}>{(settings.profileName || 'U').slice(0, 1).toUpperCase()}</button></div>
    </header>
    <aside className="app-sidebar"><div className="sidebar-label">ESPAÇO DE TRABALHO</div><nav aria-label="Navegação principal" style={{ '--nav-index': navigation.findIndex(item => item.id === screen) } as CSSProperties}>{navigation.map(({ id, title, icon: Icon }) => <button key={id} className={screen === id ? 'active' : ''} aria-current={screen === id ? 'page' : undefined} aria-label={title} data-label={title} onClick={() => navigate(id)}><Icon size={20} strokeWidth={1.65} /><span>{title}</span>{screen === id && <span className="nav-indicator" />}</button>)}</nav><div className="sidebar-bottom"><div className="offline-note" title="Salvo neste computador"><Database size={17} /><span>Salvo neste computador<small>Você está no controle dos dados.</small></span></div><button className="collapse-button" onClick={() => setSidebarCollapsed(v => !v)} aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'} title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}<span>Recolher menu</span></button></div></aside>
    <main className="app-main" ref={main}>
      <div className="page-heading"><div><div className="eyebrow">{activeProject?.name || 'TODOS OS PROJETOS'} <span>/</span> FINANÇAS</div><h1>{current.title}</h1><p>{current.description}</p></div><div className="heading-actions"><span className="today-label">{new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</span><button className="button primary" onClick={newEntry}><Plus size={17} />Novo lançamento</button>{screen === 'home' && <WorkspaceMenu settings={settings} onCommit={commit} />}</div></div>
      {['home','history','comparison','reports'].includes(screen)&&<div className="currency-context"><span>Visualização em {displayCurrency}{snapshot.market?.fx ? ` · câmbio de referência de ${snapshot.market.fx.date.split('-').reverse().join('/')}` : ''}. Conversões usam o câmbio atual salvo, inclusive no histórico.</span>{reporting.missing.length>0&&<strong role="status">Total parcial: {reporting.missing.map(a=>a.name).join(', ')} sem câmbio disponível.</strong>}{marketErrors.length>0&&<details><summary>Algumas fontes não atualizaram · dados salvos preservados</summary><p>{marketErrors.join(' ')}</p></details>}</div>}
      <div className="screen-content" key={screen}>
      {['home', 'history', 'reports', 'comparison'].includes(screen) && <FilterBar snapshot={snapshot} filters={filters} onChange={setFilters} settledOnly={screen === 'comparison'} />}
      {screen === 'home' && <Dashboard {...common} rawSnapshot={snapshot} onManageAccounts={() => setOverlay({ kind: 'catalog', initialKind: 'account' })} />}
      {screen === 'history' && <History {...common} onEditTransfer={transfer => setOverlay({ kind: 'transfer', transfer:snapshot.transfers.find(t=>t.id===transfer.id)||transfer })} />}
      {screen === 'comparison' && <Comparison {...common} />}
      {screen === 'reports' && <Reports {...common} />}
      {screen === 'achievements' && <CurrencyContext.Provider value="BRL"><Achievements {...common} snapshot={reportingSnapshot(snapshot,'BRL').snapshot}/></CurrencyContext.Provider>}
      {screen === 'investments' && <Investments snapshot={snapshot} projectId={projectId} onCommit={commit}/>}
      {screen === 'bills' && <Bills snapshot={snapshot} projectId={projectId} onCommit={commit} />}
      {screen === 'cards' && <Cards snapshot={snapshot} projectId={projectId} onCommit={commit} />}
      {screen === 'loans' && <Loans snapshot={snapshot} projectId={projectId} onCommit={commit} />}
      {screen === 'patrimony' && <Patrimony snapshot={snapshot} projectId={projectId} onCommit={commit} />}
      {screen === 'creation' && <div className="stack"><div className="creation-actions"><button className="creation-tile" onClick={newEntry}><span className="tile-icon"><CirclePlus size={24} /></span><strong>Receita ou despesa</strong><span>Um lançamento, parcelas ou recorrência mensal.</span><Plus size={18} /></button><button className="creation-tile" onClick={() => setOverlay({ kind: 'transfer' })}><span className="tile-icon"><ArrowDownUp size={24} /></span><strong>Transferir entre contas</strong><span>Movimente seu dinheiro sem alterar o resultado.</span><Plus size={18} /></button></div><Catalogs snapshot={snapshot} onCommit={commit} /></div>}
      {screen === 'settings' && <Preferences key={snapshot.settings.profileName} snapshot={snapshot} onCommit={commit} onManage={() => setOverlay({ kind: 'catalog', initialKind: 'account' })} />}
      </div>
      <footer className="app-footer"><span>Purple Tab <span className="muted">v{snapshot.meta.appVersion}</span></span><span>Dados locais · {snapshot.transactions.length} lançamentos</span></footer>
    </main>
    {overlay && <Modal title={overlay.kind === 'entry' ? 'Lançamento financeiro' : overlay.kind === 'transfer' ? 'Transferência' : 'Gerenciar cadastros'} closing={closingOverlay} onClose={() => { if (saving === 0) closeOverlay() }}>
      {overlay.kind === 'entry' && <TransactionEditor snapshot={snapshot} projectId={projectId} entry={overlay.entry} duplicate={overlay.duplicate} onClose={closeOverlay} onCommit={commit} />}
      {overlay.kind === 'transfer' && <TransferEditor snapshot={snapshot} transfer={overlay.transfer} onClose={closeOverlay} onCommit={commit} />}
      {overlay.kind === 'catalog' && <><div className="modal-header"><div><span className="eyebrow">ORGANIZAÇÃO</span><h2>Seus cadastros</h2></div><button className="icon-button" disabled={saving > 0} aria-label="Fechar cadastros" onClick={closeOverlay}><X size={20} /></button></div><div className="modal-body"><Catalogs snapshot={snapshot} initialKind={overlay.initialKind} onCommit={commit} /></div></>}
    </Modal>}
    {toast && <div className={`toast ${toast.error ? 'toast-error' : ''}`} role={toast.error ? 'alert' : 'status'}><span>{toast.text}</span><button className="icon-button" aria-label="Fechar mensagem" onClick={() => setToast(null)}><X size={16} /></button></div>}
  </div></CurrencyContext.Provider>
}
