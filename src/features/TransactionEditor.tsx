import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { api } from '../lib/api'
import { dateLabel, money, parseMoney, today } from '../lib/finance'
import type { Commit, EntryType, PaymentMethod, Snapshot, Transaction, TransactionInput } from '../lib/types'
import { paymentLabels } from '../lib/cards'
import CreditPurchaseEditor from './CreditPurchaseEditor'
import InlineCreate from './InlineCreate'

interface Props {
  snapshot: Snapshot
  projectId: string
  entry?: Transaction | null
  duplicate?: boolean
  initialType?: EntryType
  onClose: () => void
  onCommit: Commit
}

export function TransactionEditor({ snapshot, projectId, entry, duplicate = false, initialType = 'expense', onClose, onCommit }: Props) {
  const id = useId()
  const editing = Boolean(entry && !duplicate)
  const firstType = entry?.type ?? initialType
  const projects = snapshot.projects.filter(p => !p.archived || (editing && p.id === entry?.projectId))
  const accounts = snapshot.accounts.filter(a => !a.archived || (editing && a.id === entry?.accountId))
  const [type, setType] = useState<EntryType>(firstType)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(entry?.paymentMethod || 'other')
  const [description, setDescription] = useState(entry?.description ?? '')
  const [amount, setAmount] = useState(entry ? String(entry.amountCents).padStart(3, '0').replace(/(\d{2})$/, ',$1') : '')
  const [selectedProject, setSelectedProject] = useState(projects.find(p => p.id === (entry?.projectId ?? projectId))?.id ?? projects[0]?.id ?? '')
  const [accountId, setAccountId] = useState(accounts.find(a => a.id === entry?.accountId)?.id ?? accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(snapshot.categories.find(c => c.id === entry?.categoryId && (!c.archived || editing))?.id ?? '')
  const [subcategoryId, setSubcategoryId] = useState(snapshot.categories.find(c => c.id === entry?.subcategoryId && (!c.archived || editing))?.id ?? '')
  const [dueDate, setDueDate] = useState(editing ? entry!.dueDate : today())
  const [status, setStatus] = useState<TransactionInput['status']>(editing ? entry!.status : 'pending')
  const [paidDate, setPaidDate] = useState(editing ? entry!.paidDate ?? today() : today())
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [seriesMode, setSeriesMode] = useState<NonNullable<TransactionInput['seriesMode']>>('single')
  const [count, setCount] = useState('3')
  const [scope, setScope] = useState<'one' | 'future'>('one')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)

  const categories = snapshot.categories.filter(c => !c.parentId && c.type === type && (!c.archived || (editing && c.id === entry?.categoryId)))
  const subcategories = snapshot.categories.filter(c => c.parentId === categoryId && c.type === type && (!c.archived || (editing && c.id === entry?.subcategoryId)))
  const unavailable = projects.length === 0 || accounts.length === 0 || categories.length === 0
  const isSeries = !editing && seriesMode !== 'single'
  const accountStart = accounts.find(a => a.id === accountId)?.initialDate ?? '1900-01-01'
  const moneyPreview = (() => { try { return parseMoney(amount) } catch { return NaN } })()

  function changeType(next: EntryType) {
    if (next === type) return
    setType(next)
    setCategoryId('')
    setSubcategoryId('')
  }

  function changeMethod(method: PaymentMethod) {
    setPaymentMethod(method)
    if (!editing && method === 'debit') { setStatus('settled'); setDueDate(today()); setPaidDate(today()) }
  }

  const currency = snapshot.accounts.find(a=>a.id===accountId)?.currency || 'BRL'
  const currencyLabel = currency==='BRL'?'R$':currency

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving.current) return
    setError('')
    try {
      const cents = parseMoney(amount)
      if (!description.trim()) throw new Error('Informe a descrição do lançamento.')
      if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('Informe um valor maior que zero, com até duas casas decimais.')
      if (!projects.some(p => p.id === selectedProject)) throw new Error('Selecione um projeto disponível.')
      if (!accounts.some(a => a.id === accountId)) throw new Error('Selecione uma conta disponível.')
      if (!categories.some(c => c.id === categoryId)) throw new Error('Selecione uma categoria para este tipo de lançamento.')
      if (subcategoryId && !subcategories.some(c => c.id === subcategoryId)) throw new Error('Selecione uma subcategoria válida.')
      if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error('Informe uma data de vencimento válida.')
      if (!isSeries && status === 'settled' && !paidDate) throw new Error('Informe a data do pagamento ou recebimento.')
      if (dueDate < accountStart || (!isSeries && status === 'settled' && paidDate < accountStart)) throw new Error(`As datas do lançamento devem ser a partir de ${dateLabel(accountStart)}, a data inicial da conta.`)
      const totalCount = Number(count)
      if (isSeries && (!Number.isInteger(totalCount) || totalCount < 2 || totalCount > 120)) throw new Error('Use uma quantidade entre 2 e 120 meses.')
      if (isSeries && seriesMode === 'installments' && cents < totalCount) throw new Error('O valor total deve permitir pelo menos R$ 0,01 por parcela.')
      const input: TransactionInput = {
        ...(editing ? { id: entry!.id } : {}),
        description: description.trim(), type, amountCents: cents, paymentMethod: type === 'expense' ? paymentMethod : 'other',
        projectId: selectedProject, accountId, categoryId, subcategoryId: subcategoryId || null,
        dueDate, status: isSeries ? 'pending' : status,
        paidDate: !isSeries && status === 'settled' ? paidDate : null,
        notes: notes.trim(), seriesMode: editing ? 'single' : seriesMode,
        count: isSeries ? totalCount : 1,
        scope: editing && entry?.seriesId ? scope : 'one',
      }
      saving.current = true
      setBusy(true)
      const message = editing ? 'Lançamento atualizado.' : isSeries ? `${totalCount} lançamentos criados.` : 'Lançamento criado.'
      if (await onCommit(() => api.saveTransaction(input), message)) onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o lançamento.')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  if (type === 'expense' && paymentMethod === 'credit' && !editing) return <CreditPurchaseEditor snapshot={snapshot} projectId={selectedProject} onCommit={onCommit} onClose={onClose} onMethodChange={changeMethod} initial={{ description, amount, categoryId, subcategoryId, notes }} />
  return <form onSubmit={submit}>
    <div className="modal-header">
      <div><h2>{editing ? 'Editar lançamento' : duplicate ? 'Duplicar lançamento' : 'Novo lançamento'}</h2><p className="hint">Cada registro pertence a um projeto e movimenta uma conta.</p></div>
      <button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Fechar formulário">×</button>
    </div>
    <div className="modal-body stack">
      {unavailable && <p className="hint">Falta algum cadastro? Crie projeto, conta ou categoria diretamente nos campos abaixo.</p>}
      {duplicate && <p className="hint">A cópia será um novo lançamento pendente, com vencimento hoje. Revise os campos antes de salvar.</p>}
      {editing && entry?.seriesId && <div className="field"><label htmlFor={`${id}-scope`}>Aplicar alteração</label><select id={`${id}-scope`} value={scope} onChange={e => { const next = e.target.value as 'one' | 'future'; setScope(next); if (next === 'future') setStatus('pending') }} disabled={busy}><option value="one">Somente este lançamento</option><option value="future" disabled={entry.status === 'settled'}>Este e os próximos pendentes da série</option></select><p className="hint">Outros lançamentos já pagos ou recebidos não são alterados.{scope === 'future' ? ' Se você mudar o valor, o novo valor será aplicado a cada ocorrência selecionada; caso contrário, os valores originais serão preservados. Registre os pagamentos ou recebimentos individualmente.' : ''}</p></div>}
      <div className="entry-type-field"><span id={`${id}-type-label`}>Tipo de lançamento</span><div className="entry-type-selector" role="group" aria-labelledby={`${id}-type-label`}>
        <button type="button" className={`entry-type-button income ${type === 'income' ? 'is-selected' : ''}`} aria-pressed={type === 'income'} onClick={() => changeType('income')} disabled={busy}><span className="entry-type-icon"><TrendingUp size={23} strokeWidth={1.8} /></span><span><strong>Entrada</strong><small>Dinheiro que chegou</small></span></button>
        <button type="button" className={`entry-type-button expense ${type === 'expense' ? 'is-selected' : ''}`} aria-pressed={type === 'expense'} onClick={() => changeType('expense')} disabled={busy}><span className="entry-type-icon"><TrendingDown size={23} strokeWidth={1.8} /></span><span><strong>Despesa</strong><small>Dinheiro que saiu</small></span></button>
      </div></div>
      {type === 'expense' && <label className="field">Forma de pagamento<select aria-label="Forma de pagamento" disabled={busy} value={paymentMethod} onChange={e => changeMethod(e.target.value as PaymentMethod)}>{Object.entries(paymentLabels).filter(([key]) => key !== 'credit' || !editing).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
      <div className="form-grid">
        <div className="field"><label htmlFor={`${id}-project`}>Projeto</label><select id={`${id}-project`} value={selectedProject} onChange={e => setSelectedProject(e.target.value)} disabled={busy} required><option value="" disabled>Selecione um projeto</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}{p.archived ? ' (arquivado)' : ''}</option>)}</select><InlineCreate kind="project" snapshot={snapshot} onCommit={onCommit} onCreated={setSelectedProject} disabled={busy} /></div>
        <div className="field"><label htmlFor={`${id}-description`}>Descrição</label><input id={`${id}-description`} value={description} onChange={e => setDescription(e.target.value)} maxLength={180} placeholder={type === 'expense' ? 'Ex.: Aluguel do escritório' : 'Ex.: Serviço recebido'} required disabled={busy} /></div>
        {!editing && <div className="field"><label htmlFor={`${id}-series`}>Repetição</label><select id={`${id}-series`} value={seriesMode} onChange={e => setSeriesMode(e.target.value as typeof seriesMode)} disabled={busy}><option value="single">Lançamento único</option><option value="installments">Parcelar um valor total</option><option value="recurring">Repetir valor a cada mês</option></select></div>}
        {isSeries && <div className="field"><label htmlFor={`${id}-count`}>{seriesMode === 'installments' ? 'Número de parcelas' : 'Quantidade de meses'}</label><input id={`${id}-count`} type="number" min="2" max="120" step="1" required value={count} onChange={e => setCount(e.target.value)} disabled={busy} /></div>}
        <div className="field"><label htmlFor={`${id}-amount`}>{isSeries && seriesMode === 'installments' ? `Valor total (${currencyLabel})` : isSeries ? `Valor de cada mês (${currencyLabel})` : `Valor (${currencyLabel})`}</label><input id={`${id}-amount`} inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} required disabled={busy} /><p className="hint">{Number.isFinite(moneyPreview) && moneyPreview > 0 ? money(moneyPreview, currency) : 'Ex.: 1.250,50'}</p></div>
        <div className="field"><label htmlFor={`${id}-account`}>Conta</label><select id={`${id}-account`} value={accountId} onChange={e => setAccountId(e.target.value)} required disabled={busy}><option value="" disabled>Selecione uma conta</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.archived ? ' (arquivada)' : ''}</option>)}</select><InlineCreate kind="account" snapshot={snapshot} onCommit={onCommit} onCreated={setAccountId} preferredCurrency={currency} preferredDate={status === 'settled' && paidDate < dueDate ? paidDate : dueDate} disabled={busy} /></div>
        <div className="field"><label htmlFor={`${id}-category`}>Categoria</label><select id={`${id}-category`} value={categoryId} onChange={e => { setCategoryId(e.target.value); setSubcategoryId('') }} required disabled={busy}><option value="" disabled>Selecione uma categoria</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}{c.archived ? ' (arquivada)' : ''}</option>)}</select><InlineCreate kind="category" snapshot={snapshot} onCommit={onCommit} onCreated={value => { setCategoryId(value); setSubcategoryId('') }} entryType={type} disabled={busy} /></div>
        <div className="field"><label htmlFor={`${id}-subcategory`}>Subcategoria (opcional)</label><select id={`${id}-subcategory`} value={subcategoryId} onChange={e => setSubcategoryId(e.target.value)} disabled={busy || !categoryId}><option value="">Sem subcategoria</option>{subcategories.map(c => <option key={c.id} value={c.id}>{c.name}{c.archived ? ' (arquivada)' : ''}</option>)}</select><InlineCreate kind="subcategory" snapshot={snapshot} onCommit={onCommit} onCreated={setSubcategoryId} entryType={type} parentId={categoryId} disabled={busy} /></div>
        <div className="field"><label htmlFor={`${id}-due`}>{isSeries ? 'Primeiro vencimento' : 'Vencimento'}</label><input id={`${id}-due`} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} min={accountStart} max="2200-12-31" required disabled={busy} /><p className="hint">A conta aceita registros a partir de {dateLabel(accountStart)}.</p></div>
        {!isSeries && <div className="field"><label htmlFor={`${id}-status`}>Situação</label><select id={`${id}-status`} value={status} onChange={e => setStatus(e.target.value as typeof status)} disabled={busy || scope === 'future'}><option value="pending">{type === 'expense' ? 'A pagar' : 'A receber'}</option><option value="settled">{type === 'expense' ? 'Pago' : 'Recebido'}</option></select></div>}
        {!isSeries && status === 'settled' && <div className="field"><label htmlFor={`${id}-paid`}>Data {type === 'expense' ? 'do pagamento' : 'do recebimento'}</label><input id={`${id}-paid`} type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} min={accountStart} max={today()} required disabled={busy} /></div>}
        <div className="field span-2"><label htmlFor={`${id}-notes`}>Observações (opcional)</label><textarea id={`${id}-notes`} value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} rows={3} disabled={busy} /></div>
      </div>
      {isSeries && <p className="hint">{seriesMode === 'installments' ? 'O valor total será dividido entre as parcelas, mantendo a soma exata dos centavos.' : 'Cada mês terá um lançamento com o valor integral informado.'} Todos serão criados pendentes, a partir de {dueDate ? dateLabel(dueDate) : 'uma data válida'}. Em meses curtos, o vencimento usa o último dia disponível.</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
    </div>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className="button primary" disabled={busy || unavailable}>{busy ? 'Salvando…' : editing ? 'Salvar alterações' : isSeries ? 'Criar lançamentos' : 'Criar lançamento'}</button></div>
  </form>
}
