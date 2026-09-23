import { useCallback } from 'react'
import { useCurrency } from '../lib/CurrencyContext'
import { useState } from 'react'
import { api } from '../lib/api'
import { paymentLabels } from '../lib/cards'
import type { Commit, Filters, Snapshot, Transaction, Transfer } from '../lib/types'
import { dateLabel, filteredTransactions, filteredTransfers, money as formatMoney, today, totals, transactionDate } from '../lib/finance'
import './views.css'

interface Props { snapshot: Snapshot; projectId: string; filters: Filters; onEdit: (entry: Transaction, duplicate?: boolean) => void; onEditTransfer?: (transfer: Transfer) => void; onCommit: Commit; onNew: () => void }
type Confirmation = { kind: 'delete' | 'settle'; entry: Transaction } | { kind: 'transfer'; entry: Transfer }

export default function History({ snapshot, projectId, filters, onEdit, onEditTransfer, onCommit, onNew }: Props) {
  const currency = useCurrency()
  const money = useCallback((cents:number)=>formatMoney(cents,currency),[currency])
  const [order, setOrder] = useState('date-desc')
  const [page, setPage] = useState(1)
  const [details, setDetails] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [scope, setScope] = useState<'one' | 'future'>('one')
  const [paidDate, setPaidDate] = useState(today())
  const [busy, setBusy] = useState(false)
  const entries = [...filteredTransactions(snapshot, projectId, filters)].sort((a, b) => {
    if (order === 'amount-desc') return b.amountCents - a.amountCents || a.id.localeCompare(b.id)
    if (order === 'description') return a.description.localeCompare(b.description, 'pt-BR')
    return (order === 'date-asc' ? 1 : -1) * transactionDate(a).localeCompare(transactionDate(b)) || a.id.localeCompare(b.id)
  })
  const summary = totals(entries)
  const transfers = filteredTransfers(snapshot, projectId, filters).sort((a, b) => b.date.localeCompare(a.date))
  const pages = Math.max(1, Math.ceil(entries.length / 20)), currentPage = Math.min(page, pages)
  const shown = entries.slice((currentPage - 1) * 20, currentPage * 20)
  const openConfirmation = (next: Confirmation) => { setScope('one'); setPaidDate(today()); setConfirmation(next) }
  const confirm = async () => {
    if (!confirmation || busy || (confirmation.kind === 'settle' && (!paidDate || paidDate > today()))) return
    setBusy(true)
    const ok = await onCommit(() => confirmation.kind === 'transfer' ? api.deleteTransfer({ id: confirmation.entry.id })
      : confirmation.kind === 'settle' ? api.settleTransaction({ id: confirmation.entry.id, paidDate })
      : api.deleteTransaction({ id: confirmation.entry.id, scope }), confirmation.kind === 'settle' ? 'Lançamento efetivado.' : 'Registro excluído.')
    setBusy(false)
    if (ok) setConfirmation(null)
  }
  return <div className="stack">
    {confirmation && <section className="inline-confirm" role="region" aria-label="Confirmar operação"><h3>{confirmation.kind === 'settle' ? confirmation.entry.type === 'income' ? 'Registrar recebimento' : 'Registrar pagamento' : 'Excluir registro?'}</h3><p>{confirmation.kind === 'transfer' ? 'A transferência será removida dos saldos das duas contas.' : confirmation.entry.description}</p>{confirmation.kind === 'delete' && confirmation.entry.seriesId && <label className="field">Ocorrências a excluir<select value={scope} onChange={event => setScope(event.target.value as 'one' | 'future')}><option value="one">Somente esta ocorrência</option>{confirmation.entry.status === 'pending' && <option value="future">Esta e as próximas pendentes</option>}</select><small>Outras ocorrências já pagas ou recebidas serão preservadas.</small></label>}{confirmation.kind === 'settle' && <label className="field">Data da efetivação<input type="date" value={paidDate} max={today()} required onChange={event => setPaidDate(event.target.value)} /></label>}<div className="toolbar"><button className={confirmation.kind === 'settle' ? 'primary' : 'danger'} disabled={busy || (confirmation.kind === 'settle' && (!paidDate || paidDate > today()))} onClick={confirm}>{busy ? 'Salvando…' : confirmation.kind === 'settle' ? 'Confirmar' : 'Excluir definitivamente'}</button><button className="secondary" disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</button></div></section>}
    <section className="card"><div className="section-heading"><div><h2>{entries.length} lançamento(s)</h2><p className="hint">Resultado econômico (sem principal de empréstimos): {money(summary.income)} em receitas · {money(summary.expenses)} em despesas · Resultado {money(summary.result)}</p><p className="hint">Pendente: {money(summary.payable)} a pagar · {money(summary.receivable)} a receber. Período usa a data de efetivação nos realizados e o vencimento nos pendentes.</p></div><label className="field">Ordenar<select value={order} onChange={event => { setOrder(event.target.value); setPage(1) }}><option value="date-desc">Data: mais recentes</option><option value="date-asc">Data: mais antigas</option><option value="amount-desc">Maior valor</option><option value="description">Descrição A–Z</option></select></label></div>
      {!shown.length ? <div className="empty-state"><p>Nenhum lançamento corresponde aos filtros.</p><button className="primary" onClick={onNew}>Criar lançamento</button></div> : <div className="table-wrap"><table className="history-table"><thead><tr><th>Descrição / categoria</th><th>Projeto / conta</th><th>Vencimento / efetivação</th><th>Situação</th><th>Valor</th><th>Ações</th></tr></thead><tbody>{shown.map(entry => <tr key={entry.id}><td><button className="text-button" aria-expanded={details === entry.id} onClick={() => setDetails(details === entry.id ? null : entry.id)}>{entry.description}</button><small className="cell-secondary">{snapshot.categories.find(item => item.id === entry.categoryId)?.name}{entry.subcategoryId && ` / ${snapshot.categories.find(item => item.id === entry.subcategoryId)?.name || ''}`}</small>{entry.economicCents !== undefined && entry.economicCents !== entry.amountCents && <small className="cell-secondary">Capital: {money(entry.amountCents - entry.economicCents)} · custo / receita: {money(entry.economicCents)}</small>}{entry.type === 'expense' && <small className="cell-secondary">{paymentLabels[entry.paymentMethod || 'other']}</small>}{entry.seriesId && <small className="cell-secondary">Série · ocorrência {(entry.occurrenceIndex ?? 0) + 1}</small>}{details === entry.id && <div className="details-note"><small className="cell-secondary">{entry.notes || 'Sem observação.'}</small><small className="cell-secondary">Criado em {dateLabel(entry.createdAt.slice(0, 10))}</small></div>}</td><td>{snapshot.projects.find(item => item.id === entry.projectId)?.name}<small className="cell-secondary">{snapshot.accounts.find(item => item.id === entry.accountId)?.name}</small></td><td className="nowrap">{dateLabel(entry.dueDate)}<small className="cell-secondary">Efetivado: {dateLabel(entry.paidDate)}</small></td><td><span className={`badge ${entry.status === 'settled' ? 'positive' : entry.dueDate < today() ? 'negative' : ''}`}>{entry.status === 'settled' ? entry.type === 'income' ? 'Recebido' : 'Pago' : entry.dueDate < today() ? 'Vencido' : 'Pendente'}</span></td><td className={`nowrap ${entry.type === 'income' ? 'positive' : 'negative'}`}>{entry.type === 'expense' ? '− ' : '+ '}{money(entry.amountCents)}</td><td><div className="row-actions"><button className="secondary" onClick={() => onEdit(entry)}>{entry.billId || entry.loanId ? 'Gerenciar vínculo' : 'Editar'}</button><button className="secondary" onClick={() => onEdit(entry, true)}>Duplicar</button>{entry.status === 'pending' && !entry.billId && <button className="secondary" onClick={() => openConfirmation({ kind: 'settle', entry })}>{entry.type === 'income' ? 'Receber' : 'Pagar'}</button>}{!entry.billId && !entry.loanId && <button className="danger" onClick={() => openConfirmation({ kind: 'delete', entry })}>Excluir</button>}</div></td></tr>)}</tbody></table></div>}
      {pages > 1 && <div className="pagination"><button className="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>{currentPage} de {pages}</span><button className="secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Próxima</button></div>}
    </section>
    {projectId === 'geral' && <section className="card"><h2>Transferências entre contas</h2><p className="hint">Movimentam saldos e não são receitas ou despesas. Não pertencem a projetos/categorias; filtros de categoria ou situação pendente ocultam transferências.</p>{!transfers.length ? <p className="empty-state">Nenhuma transferência neste recorte.</p> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Origem → destino</th><th>Observação</th><th>Valor</th><th>Ações</th></tr></thead><tbody>{transfers.map(item => <tr key={item.id}><td>{dateLabel(item.date)}</td><td>{snapshot.accounts.find(account => account.id === item.fromAccountId)?.name} → {snapshot.accounts.find(account => account.id === item.toAccountId)?.name}</td><td>{item.notes || '—'}</td><td>{money(item.amountCents)}</td><td><div className="row-actions">{onEditTransfer && <button className="secondary" onClick={() => onEditTransfer(item)}>Editar</button>}<button className="danger" onClick={() => openConfirmation({ kind: 'transfer', entry: item })}>Excluir</button></div></td></tr>)}</tbody></table></div>}</section>}
  </div>
}
