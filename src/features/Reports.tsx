import { useCallback } from 'react'
import { useCurrency } from '../lib/CurrencyContext'
import { useState } from 'react'
import { api } from '../lib/api'
import { paymentLabels } from '../lib/cards'
import type { Filters, Snapshot } from '../lib/types'
import { dateLabel, filteredTransactions, filteredTransfers, groupTotals, money as formatMoney, moneyDecimal, totals, transactionDate } from '../lib/finance'
import AnimatedMoney from '../components/motion/AnimatedMoney'
import './views.css'

interface Props { snapshot: Snapshot; projectId: string; filters: Filters }
type Grouping = 'month' | 'project' | 'account' | 'category'

export default function Reports({ snapshot, projectId, filters }: Props) {
  const currency = useCurrency()
  const money = useCallback((cents:number)=>formatMoney(cents,currency),[currency])
  const [grouping, setGrouping] = useState<Grouping>('category')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const entries = filteredTransactions(snapshot, projectId, filters).sort((a, b) => transactionDate(a).localeCompare(transactionDate(b)))
  const transfers = filteredTransfers(snapshot, projectId, filters).sort((a, b) => a.date.localeCompare(b.date))
  const summary = totals(entries)
  const groups = groupTotals(entries, entry => grouping === 'month' ? transactionDate(entry).slice(0, 7) : grouping === 'project' ? entry.projectId : grouping === 'account' ? entry.accountId : entry.categoryId)
  const projectName = (id: string) => snapshot.projects.find(item => item.id === id)?.name || 'Projeto'
  const accountName = (id: string) => snapshot.accounts.find(item => item.id === id)?.name || 'Conta'
  const categoryName = (id: string | null) => snapshot.categories.find(item => item.id === id)?.name || ''
  const groupName = (id: string) => grouping === 'month' ? id.split('-').reverse().join('/') : grouping === 'project' ? projectName(id) : grouping === 'account' ? accountName(id) : categoryName(id)
  const context = projectId === 'geral' ? 'Todos os projetos' : projectName(projectId)
  const activeAccounts = snapshot.accounts.filter(account => !filters.excludedAccountIds.includes(account.id) && (!filters.accountId || filters.accountId === account.id))
  const accountContext = activeAccounts.length === snapshot.accounts.length ? 'Todas as contas' : activeAccounts.length ? activeAccounts.map(account => account.name).join(', ') : 'Nenhuma conta'
  const subtitle = `Moeda: ${currency} · câmbio de referência atual${snapshot.market?.fx ? ` (${dateLabel(snapshot.market.fx.date)})` : ''} · ${context} · ${dateLabel(filters.start)} a ${dateLabel(filters.end)} · ${accountContext} · ${filters.categoryId ? categoryName(filters.categoryId) : 'Todas as categorias'}${filters.subcategoryId ? ` / ${categoryName(filters.subcategoryId)}` : ''} · ${filters.status === 'all' ? 'Todas as situações' : filters.status === 'pending' ? 'Pendentes' : 'Realizados'}${filters.search ? ` · Busca: ${filters.search}` : ''}`
  const totalsText = [`Receitas realizadas: ${money(summary.income)}`, `Despesas realizadas: ${money(summary.expenses)}`, `Resultado realizado: ${money(summary.result)}`, `A receber: ${money(summary.receivable)}`, `A pagar: ${money(summary.payable)}`]
  const exportReport = async (format: 'csv' | 'pdf') => {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = format === 'csv' ? await api.exportCsv({ filename: `purple-tab-${filters.start || 'inicio'}-${filters.end || 'fim'}.csv`, rows: [
        ['Data de referência', 'Descrição', 'Tipo', 'Projeto', 'Conta', 'Conta destino', 'Categoria', 'Subcategoria', 'Vencimento', 'Efetivação', 'Situação', `Movimentação (${currency})`, 'Observação', `Principal de empréstimo (${currency})`, `Receita / despesa econômica (${currency})`, 'Forma de pagamento'],
        ...entries.map(entry => [dateLabel(transactionDate(entry)), entry.description, entry.economicCents !== undefined && entry.economicCents !== entry.amountCents ? entry.type === 'income' ? 'Crédito de empréstimo' : 'Parcela de contrato' : entry.type === 'income' ? 'Receita' : 'Despesa', projectName(entry.projectId), accountName(entry.accountId), '', categoryName(entry.categoryId), categoryName(entry.subcategoryId), dateLabel(entry.dueDate), entry.paidDate ? dateLabel(entry.paidDate) : '', entry.status === 'settled' ? entry.type === 'income' ? 'Recebido' : 'Pago' : 'Pendente', moneyDecimal(entry.amountCents), entry.notes, moneyDecimal(entry.amountCents - (entry.economicCents ?? entry.amountCents)), moneyDecimal(entry.economicCents ?? entry.amountCents), paymentLabels[entry.paymentMethod || 'other']]),
        ...transfers.map(item => [dateLabel(item.date), 'Transferência entre contas', 'Transferência', '', accountName(item.fromAccountId), accountName(item.toAccountId), '', '', '', dateLabel(item.date), 'Realizado', moneyDecimal(item.amountCents), item.notes, '', '', '']),
      ] }) : await api.printReport({ title: 'Relatório financeiro — Purple Tab', subtitle, headers: ['Data', 'Descrição', 'Projeto', 'Conta', 'Categoria', 'Situação', 'Entrada de caixa', 'Saída de caixa'], rows: [
        ...entries.map(entry => [dateLabel(transactionDate(entry)), entry.description, projectName(entry.projectId), accountName(entry.accountId), categoryName(entry.subcategoryId || entry.categoryId), entry.status === 'settled' ? 'Realizado' : 'Pendente', entry.type === 'income' ? money(entry.amountCents) : '', entry.type === 'expense' ? money(entry.amountCents) : '']),
        ...transfers.map(item => [dateLabel(item.date), `Transferência ${money(item.amountCents)}`, '—', `${accountName(item.fromAccountId)} → ${accountName(item.toAccountId)}`, '—', 'Realizado', '—', '—']),
        ...groups.map(group => ['Resumo econômico', groupName(group.id), '', '', '', `Resultado ${money(group.result)}`, money(group.income), money(group.expenses)]),
      ], totals: [...totalsText, 'Datas: efetivação para realizados; vencimento para pendentes. Totais e resumos econômicos excluem transferências e principal de empréstimos. As linhas de movimentações mostram caixa integral.', `Resumo agrupado por ${grouping === 'month' ? 'mês' : grouping === 'project' ? 'projeto' : grouping === 'account' ? 'conta' : 'categoria'}. Valores das linhas de resumo são realizados.`] })
      setMessage(result.canceled ? 'Exportação cancelada.' : `Relatório salvo${result.path ? ` em ${result.path}` : ''}.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível exportar o relatório.') }
    finally { setBusy(false) }
  }
  return <div className="stack"><div className="toolbar"><button className="secondary" disabled={busy} onClick={() => exportReport('csv')}>{busy ? 'Exportando…' : 'Exportar CSV'}</button><button className="primary" disabled={busy} onClick={() => exportReport('pdf')}>Salvar PDF</button></div>
    {error && <p className="error-text" role="alert">{error}</p>}{message && <p className="report-export-status" role="status">{message}</p>}
    <section className="card"><h2>Resumo dos filtros</h2><p className="hint">{subtitle}</p><div className="stats-grid"><div><span className="muted">Receitas realizadas</span><strong className="metric positive"><AnimatedMoney cents={summary.income} /></strong></div><div><span className="muted">Despesas realizadas</span><strong className="metric negative"><AnimatedMoney cents={summary.expenses} /></strong></div><div><span className="muted">Resultado</span><strong className={`metric ${summary.result < 0 ? 'negative' : 'positive'}`}><AnimatedMoney cents={summary.result} /></strong></div><div><span className="muted">Pendências</span><p>A pagar: <AnimatedMoney cents={summary.payable} /><br />A receber: <AnimatedMoney cents={summary.receivable} /></p></div></div></section>
    <section className="card"><div className="section-heading"><h2>Distribuição</h2><label className="field">Agrupar por<select value={grouping} onChange={event => setGrouping(event.target.value as Grouping)}><option value="category">Categoria</option><option value="project">Projeto</option><option value="account">Conta</option><option value="month">Mês</option></select></label></div>{!groups.length ? <p className="empty-state">Não há registros para os filtros atuais.</p> : <div className="table-wrap"><table><thead><tr><th>Grupo</th><th>Receitas</th><th>Despesas</th><th>Resultado</th><th>A receber</th><th>A pagar</th></tr></thead><tbody>{groups.sort((a, b) => groupName(a.id).localeCompare(groupName(b.id), 'pt-BR')).map(group => <tr key={group.id}><td>{groupName(group.id)}</td><td className="positive">{money(group.income)}</td><td className="negative">{money(group.expenses)}</td><td>{money(group.result)}</td><td>{money(group.receivable)}</td><td>{money(group.payable)}</td></tr>)}</tbody></table></div>}<p className="hint">Receitas, despesas e resultado incluem apenas valores realizados. Os pendentes aparecem nas colunas a receber e a pagar.</p></section>
    <section className="card"><h2>Detalhamento · {entries.length} lançamento(s)</h2><p className="hint">Totais de receitas/despesas excluem principal de empréstimos; o detalhamento mostra a movimentação bancária integral. CSV e PDF incluem todos os registros dos filtros, além de {transfers.length} transferência(s) elegível(is). A prévia abaixo exibe até 100 lançamentos. O PDF pode ser impresso pelo leitor de PDF.</p>{!entries.length ? <p className="empty-state">Sem lançamentos neste recorte.</p> : <div className="table-wrap"><table><thead><tr><th>Data de referência</th><th>Descrição</th><th>Projeto</th><th>Conta / categoria</th><th>Situação</th><th>Valor</th></tr></thead><tbody>{entries.slice(0, 100).map(entry => <tr key={entry.id}><td>{dateLabel(transactionDate(entry))}</td><td>{entry.description}</td><td>{projectName(entry.projectId)}</td><td>{accountName(entry.accountId)}<small className="cell-secondary">{categoryName(entry.categoryId)}</small></td><td>{entry.status === 'settled' ? 'Realizado' : 'Pendente'}</td><td className={entry.type === 'income' ? 'positive' : 'negative'}>{entry.type === 'expense' ? '− ' : '+ '}{money(entry.amountCents)}</td></tr>)}</tbody></table></div>}</section>
  </div>
}
