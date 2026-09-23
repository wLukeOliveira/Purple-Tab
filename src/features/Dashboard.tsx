import { type CSSProperties } from 'react'
import { ArrowDownLeft, ArrowUpRight, Clock3, Equal } from 'lucide-react'
import type { Commit, Filters, Snapshot, Transaction, DashboardWidget } from '../lib/types'
import { accountBalance, accountBalances, dateLabel, filteredTransactions, groupTotals, money, projection, today, totals, transactionDate } from '../lib/finance'
import AnimatedMoney from '../components/motion/AnimatedMoney'
import AnimatedFill from '../components/motion/AnimatedFill'
import CashChart from './CashChart'
import { PortfolioSummary } from './Investments'
import RatePanel from './RatePanel'
import { Identity } from './Identity'
import { useCurrency } from '../lib/CurrencyContext'
import './views.css'

interface Props { snapshot: Snapshot; rawSnapshot?: Snapshot; projectId: string; filters: Filters; onEdit: (entry: Transaction, duplicate?: boolean) => void; onCommit?: Commit; onNew: () => void; onManageAccounts?: () => void }

export default function Dashboard({ snapshot, rawSnapshot = snapshot, projectId, filters, onEdit, onNew, onManageAccounts }: Props) {
  const currency = useCurrency()
  const labels:Record<DashboardWidget,string> = {balance:'Saldo e previsão',summary:'Entradas e saídas',cashchart:'Gráfico navegável',categories:'Distribuições',recent:'Últimos lançamentos',accounts:'Contas bancárias',portfolio:'Carteira de investimentos',rates:'CDI, Selic e câmbio'}
  const layouts:Record<string,DashboardWidget[]>={overview:['balance','summary','cashchart','categories','recent','accounts','portfolio','rates'],banking:['balance','accounts','summary','recent','cashchart'],investing:['portfolio','rates','cashchart','balance'],charts:['cashchart','categories','portfolio','rates'],foreign:['balance','rates','accounts','portfolio','cashchart'],custom:snapshot.settings.dashboardWidgets||Object.keys(labels) as DashboardWidget[]}
  const layout=snapshot.settings.dashboardLayout||'overview', widgets=layouts[layout]||layouts.overview
  const widgetStyle=(name:DashboardWidget):CSSProperties=>({order:widgets.indexOf(name),display:widgets.includes(name)?undefined:'none'})
  const portfolioSnapshot={...rawSnapshot,investments:rawSnapshot.investments?.filter(a=>!a.accountId||!filters.excludedAccountIds.includes(a.accountId))}

  const entries = filteredTransactions(snapshot, projectId, filters)
  const summary = totals(entries)
  const end = filters.end || today()
  const forecast = projection(snapshot, end, filters.accountId, today(), filters.excludedAccountIds)
  const project = snapshot.projects.find(item => item.id === projectId)
  const recent = [...entries].sort((a, b) => transactionDate(b).localeCompare(transactionDate(a)) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6)
  const months = groupTotals(entries, entry => transactionDate(entry).slice(0, 7)).sort((a, b) => a.id.localeCompare(b.id))
  const chartMax = Math.max(1, ...months.flatMap(item => [item.income, item.expenses]))
  const categories = groupTotals(entries.filter(item => item.status === 'settled' && item.type === 'expense'), entry => entry.categoryId).sort((a, b) => b.expenses - a.expenses)
  const balances = accountBalances(snapshot, forecast.baseDate, filters.accountId, filters.excludedAccountIds)

  return <div className="stack dashboard-overview">
    <div style={widgetStyle('portfolio')}><PortfolioSummary snapshot={portfolioSnapshot} projectId={projectId}/></div>
    <div style={widgetStyle('rates')}><RatePanel snapshot={rawSnapshot}/></div>
    {!snapshot.accounts.some(account => !account.archived) && <section className="card empty-state"><h2>Comece pelas suas contas</h2><p>Cadastre uma conta com o saldo inicial para registrar receitas, despesas e transferências.{snapshot.accounts.length > 0 ? ' Você também pode reativar uma conta arquivada.' : ''}</p>{onManageAccounts ? <button className="primary" onClick={onManageAccounts}>Gerenciar contas</button> : <p className="hint">Abra Criação → Contas para cadastrar sua primeira conta.</p>}</section>}

    {projectId === 'geral' ? <div className="card forecast-card balance-hero" style={widgetStyle('balance')}>
      <div className="forecast-primary"><span className="muted balance-label">Saldo das contas em {dateLabel(forecast.baseDate)}</span><strong className="metric"><AnimatedMoney cents={forecast.balance} /></strong></div>
      <div className="forecast-secondary"><span className="muted balance-label">Saldo previsto até {dateLabel(end)}</span><strong className={`metric ${forecast.predicted < 0 ? 'negative' : 'positive'}`}><AnimatedMoney cents={forecast.predicted} /></strong></div>
      <p className="hint">Saldo acumulado da conta selecionada ou de todas as contas, incluindo o saldo inicial e transferências. Não é afetado por busca, categoria ou situação. Previsão inclui todas as pendências até a data, inclusive {forecast.overdue} vencida(s). A data inicial do filtro não limita o saldo.</p>
    </div> : <div className="card forecast-card balance-hero" style={widgetStyle('balance')}>
      <div className="forecast-primary"><span className="muted balance-label">Resultado previsto do projeto no período</span><strong className={`metric ${summary.projectedResult < 0 ? 'negative' : 'positive'}`}><AnimatedMoney cents={summary.projectedResult} /></strong></div>
      <p className="hint">Resultado realizado + receitas pendentes − despesas pendentes nos filtros atuais. Este valor representa o projeto e não o saldo de uma conta bancária.</p>
    </div>}

    <div className="stats-grid" style={widgetStyle('summary')}>
      <article className="stat-card"><div className="stat-label"><span className="stat-icon positive"><ArrowDownLeft size={17} aria-hidden="true" /></span><span className="muted">Receitas realizadas</span></div><strong className="metric positive"><AnimatedMoney cents={summary.income} /></strong><small>No período e filtros selecionados</small></article>
      <article className="stat-card"><div className="stat-label"><span className="stat-icon negative"><ArrowUpRight size={17} aria-hidden="true" /></span><span className="muted">Despesas realizadas</span></div><strong className="metric negative"><AnimatedMoney cents={summary.expenses} /></strong><small>No período e filtros selecionados</small></article>
      <article className="stat-card"><div className="stat-label"><span className="stat-icon"><Equal size={17} aria-hidden="true" /></span><span className="muted">{project ? 'Resultado do projeto' : 'Resultado do período'}</span></div><strong className={`metric ${summary.result < 0 ? 'negative' : 'positive'}`}><AnimatedMoney cents={summary.result} /></strong><small>Receitas menos despesas realizadas</small></article>
      <article className="stat-card"><div className="stat-label"><span className="stat-icon"><Clock3 size={17} aria-hidden="true" /></span><span className="muted">A pagar / a receber</span></div><strong className="metric negative"><AnimatedMoney cents={summary.payable} /></strong><small className="positive">A receber: <AnimatedMoney cents={summary.receivable} /></small></article>
    </div>

    <div style={widgetStyle('cashchart')}><CashChart entries={entries} start={filters.start} end={filters.end} /></div>

    <div className="views-two-columns" style={widgetStyle('categories')}>
      <section className="card"><h2>Entradas e saídas</h2><p className="hint">Realizadas por mês de pagamento ou recebimento.</p>{!months.length ? <p className="empty-state">Os gráficos aparecem quando você cadastrar lançamentos.</p> : <div className="cash-chart" role="img" aria-label="Comparação mensal de receitas e despesas realizadas"><div className="chart-legend"><span className="positive">● Receitas</span><span className="negative">● Despesas</span></div>{months.map(item => <div className="cash-chart-row" key={item.id}><span>{item.id.split('-').reverse().join('/')}</span><div className="cash-chart-bars"><AnimatedFill className="cash-chart-bar income-bar" percentage={item.income / chartMax * 100} /><AnimatedFill className="cash-chart-bar expense-bar" percentage={item.expenses / chartMax * 100} /></div><div className="chart-values"><span className="positive"><AnimatedMoney cents={item.income} /></span><span className="negative"><AnimatedMoney cents={item.expenses} /></span></div></div>)}</div>}</section>
      <section className="card"><h2>Despesas por categoria</h2>{!categories.length ? <p className="empty-state">Nenhuma despesa realizada neste recorte.</p> : <div className="stack">{categories.map(item => <div key={item.id}><div className="section-heading compact-heading"><span>{snapshot.categories.find(category => category.id === item.id)?.name || 'Categoria'}</span><strong><AnimatedMoney cents={item.expenses} /></strong></div><div className="progress-track"><AnimatedFill percentage={item.expenses / Math.max(1, summary.expenses) * 100} /></div></div>)}</div>}</section>
    </div>

    <section className="card" style={widgetStyle('recent')}><div className="section-heading"><h2>Lançamentos recentes</h2><span className="badge">{entries.length} no filtro</span></div>{!recent.length ? <div className="empty-state"><p>Você ainda não tem lançamentos neste período.</p><button className="primary" onClick={onNew}>Criar lançamento</button></div> : <div className="table-wrap"><table><thead><tr><th>Descrição</th><th>Data</th><th>Situação</th><th>Valor</th></tr></thead><tbody>{recent.map(entry => <tr key={entry.id}><td><button className="text-button" onClick={() => onEdit(entry)}>{entry.description}</button><small className="cell-secondary">{snapshot.projects.find(item => item.id === entry.projectId)?.name} · {snapshot.accounts.find(item => item.id === entry.accountId)?.name}</small></td><td>{dateLabel(transactionDate(entry))}</td><td><span className={`badge ${entry.status === 'settled' ? 'positive' : ''}`}>{entry.status === 'settled' ? entry.type === 'income' ? 'Recebido' : 'Pago' : 'Pendente'}</span></td><td className={entry.type === 'income' ? 'positive' : 'negative'}>{entry.type === 'expense' ? '− ' : '+ '}{money(entry.amountCents,currency)}</td></tr>)}</tbody></table></div>}</section>
    {projectId === 'geral' && <section className="card" style={widgetStyle('accounts')}><h2>Contas</h2><p className="hint">Saldos acumulados até {dateLabel(forecast.baseDate)}. A conta selecionada no filtro limita esta lista.</p><div className="account-summary-grid">{balances.map(({ account, balance }) => <article className="account-summary" key={account.id}><span><Identity value={account.icon || (account.type==='cash'?'cash':'')} name={account.institution || account.name}/>{account.name}{account.archived ? ' (arquivada)' : ''}</span><strong className={balance < 0 ? 'negative' : ''}><AnimatedMoney cents={balance} /></strong>{account.currency && account.currency!==currency && <small><AnimatedMoney currency={account.currency} cents={accountBalance(rawSnapshot.accounts.find(a=>a.id===account.id)!,rawSnapshot,forecast.baseDate)}/> na moeda da conta</small>}<small className="muted">{account.institution || 'Conta local'} · carteira {account.currency || 'BRL'}</small></article>)}</div></section>}
  </div>
}
