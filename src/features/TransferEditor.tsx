import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import { parseMoney, today } from '../lib/finance'
import type { Commit, Snapshot, Transfer } from '../lib/types'
import InlineCreate from './InlineCreate'

interface Props { snapshot: Snapshot; transfer?: Transfer | null; onClose: () => void; onCommit: Commit }

export function TransferEditor({ snapshot, transfer, onClose, onCommit }: Props) {
  const id = useId()
  const accounts = snapshot.accounts.filter(a => !a.archived || a.id === transfer?.fromAccountId || a.id === transfer?.toAccountId)
  const fromAccounts = accounts.filter(a => !a.archived || a.id === transfer?.fromAccountId)
  const toAccounts = accounts.filter(a => !a.archived || a.id === transfer?.toAccountId)
  const [fromAccountId, setFromAccountId] = useState(transfer?.fromAccountId ?? accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(transfer?.toAccountId ?? accounts[1]?.id ?? '')
  const [amount, setAmount] = useState(transfer ? String(transfer.amountCents).padStart(3, '0').replace(/(\d{2})$/, ',$1') : '')
  const [received, setReceived] = useState(transfer ? String(transfer.receivedCents ?? transfer.amountCents).padStart(3,'0').replace(/(\d{2})$/,',$1') : '')
  const fromCurrency = accounts.find(a=>a.id===fromAccountId)?.currency || 'BRL'
  const toCurrency = accounts.find(a=>a.id===toAccountId)?.currency || 'BRL'
  const [date, setDate] = useState(transfer?.date ?? today())
  const [notes, setNotes] = useState(transfer?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving.current) return
    setError('')
    try {
      const amountCents = parseMoney(amount)
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('Informe um valor maior que zero, com até duas casas decimais.')
      if (!fromAccounts.some(a => a.id === fromAccountId) || !toAccounts.some(a => a.id === toAccountId)) throw new Error('Escolha as contas de origem e destino.')
      if (fromAccountId === toAccountId) throw new Error('Escolha contas diferentes para origem e destino.')
      if (!date) throw new Error('Informe a data da transferência.')
      if (accounts.some(a => (a.id === fromAccountId || a.id === toAccountId) && date < a.initialDate)) throw new Error('A transferência não pode ocorrer antes da data inicial de uma das contas.')
      saving.current = true
      setBusy(true)
      const input = { ...(transfer ? { id: transfer.id } : {}), fromAccountId, toAccountId, amountCents, receivedCents: fromCurrency===toCurrency ? amountCents : parseMoney(received), date, notes: notes.trim() }
      if (await onCommit(() => api.saveTransfer(input), transfer ? 'Transferência atualizada.' : 'Transferência criada.')) onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a transferência.')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  return <form onSubmit={submit}>
    <div className="modal-header"><div><h2>{transfer ? 'Editar transferência' : 'Transferir entre contas'}</h2><p className="hint">Movimenta os saldos das contas sem alterar receitas ou despesas.</p></div><button type="button" className="icon-button" aria-label="Fechar formulário" onClick={onClose} disabled={busy}>×</button></div>
    <div className="modal-body stack">
      {accounts.length < 2 && <p className="hint">Crie as contas que faltam aqui mesmo para realizar a transferência.</p>}
      <div className="form-grid">
        <div className="field"><label htmlFor={`${id}-from`}>Conta de origem</label><select id={`${id}-from`} value={fromAccountId} onChange={e => setFromAccountId(e.target.value)} required disabled={busy}><option value="" disabled>Selecione</option>{fromAccounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.archived ? ' (arquivada)' : ''}</option>)}</select><InlineCreate kind="account" snapshot={snapshot} onCommit={onCommit} onCreated={setFromAccountId} preferredCurrency={fromCurrency} preferredDate={date} disabled={busy} /></div>
        <div className="field"><label htmlFor={`${id}-to`}>Conta de destino</label><select id={`${id}-to`} value={toAccountId} onChange={e => setToAccountId(e.target.value)} required disabled={busy}><option value="" disabled>Selecione</option>{toAccounts.map(a => <option key={a.id} value={a.id} disabled={a.id === fromAccountId}>{a.name}{a.archived ? ' (arquivada)' : ''}</option>)}</select><InlineCreate kind="account" snapshot={snapshot} onCommit={onCommit} onCreated={setToAccountId} preferredCurrency={toCurrency} preferredDate={date} disabled={busy} /></div>
        <div className="field"><label htmlFor={`${id}-amount`}>Valor ({fromCurrency==='BRL'?'R$':fromCurrency})</label><input id={`${id}-amount`} value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" required disabled={busy} /></div>
        {fromCurrency!==toCurrency && <label className="field">Valor recebido ({toCurrency})<input required inputMode="decimal" value={received} onChange={e=>setReceived(e.target.value)}/><small>Informe o valor líquido efetivamente recebido, após câmbio e custos. A cotação indicativa do dashboard não altera esta operação.</small></label>}
        <div className="field"><label htmlFor={`${id}-date`}>Data da transferência</label><input id={`${id}-date`} type="date" value={date} onChange={e => setDate(e.target.value)} min="1900-01-01" max={today()} required disabled={busy} /></div>
        <div className="field span-2"><label htmlFor={`${id}-notes`}>Observações (opcional)</label><textarea id={`${id}-notes`} value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={2000} disabled={busy} /></div>
      </div>
      {error && <p role="alert" className="error-text">{error}</p>}
    </div>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className="button primary" disabled={busy || accounts.length < 2}>{busy ? 'Salvando…' : transfer ? 'Salvar alterações' : 'Transferir'}</button></div>
  </form>
}
