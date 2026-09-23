import { useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../lib/api'
import { parseMoney } from '../lib/finance'
import { currencies } from '../lib/investments'
import type { Commit, CreditCard, Snapshot } from '../lib/types'
import InlineCreate from './InlineCreate'
import QuickCreateDialog from './QuickCreateDialog'

export default function InlineCardCreate({ snapshot, onCommit, onCreated, disabled }: { snapshot: Snapshot; onCommit: Commit; onCreated: (id: string) => void; disabled?: boolean }) {
  const defaultAccount = snapshot.accounts.find(a => a.id === snapshot.settings.defaultAccountId && !a.archived) || snapshot.accounts.find(a => !a.archived)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [currency, setCurrency] = useState(defaultAccount?.currency || 'BRL')
  const [accountId, setAccountId] = useState(defaultAccount?.id || '')
  const [limit, setLimit] = useState('')
  const [closingDay, setClosingDay] = useState(10)
  const [dueDay, setDueDay] = useState(20)
  const [dueMonthOffset, setDueMonthOffset] = useState(0)
  const [closingDayRule, setClosingDayRule] = useState<CreditCard['closingDayRule']>('next')
  const [error, setError] = useState('')

  async function create() {
    if (busy) return
    setError('')
    try {
      if (!name.trim()) throw new Error('Informe o nome do cartão.')
      if (!accountId) throw new Error('Escolha ou crie a conta usada para pagar as faturas.')
      const limitCents = parseMoney(limit)
      if (!Number.isSafeInteger(limitCents) || limitCents < 0) throw new Error('Informe um limite válido.')
      setBusy(true)
      let created: CreditCard | undefined
      const ok = await onCommit(async () => {
        created = await api.saveCreditCard({ name: name.trim(), institution: institution.trim(), lastFour: '', currency, icon: 'bank', limitCents, closingDay, dueDay, dueMonthOffset, closingDayRule, accountId, archived: false }) as CreditCard
        return created
      }, 'Cartão criado e selecionado.')
      if (ok && created) { onCreated(created.id); setOpen(false); setName('') }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o cartão.')
    } finally { setBusy(false) }
  }

  return <div className="inline-create">
    <button type="button" className="inline-create-open" disabled={disabled} onClick={() => setOpen(true)}><Plus size={13} /> Criar cartão aqui</button>
    {open && <QuickCreateDialog title="Novo cartão de crédito" onClose={() => setOpen(false)} busy={busy} wide><div className="inline-create-panel">
      <div className="inline-create-heading"><strong>Novo cartão de crédito</strong><button type="button" className="text-button" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button></div>
      <label className="field">Nome do novo cartão<input autoFocus maxLength={80} value={name} disabled={busy} onChange={event => setName(event.target.value)} placeholder="Ex.: Roxinho" /></label>
      <label className="field">Instituição<input maxLength={100} value={institution} disabled={busy} onChange={event => setInstitution(event.target.value)} placeholder="Banco emissor" /></label>
      <label className="field">Moeda do novo cartão<select value={currency} disabled={busy} onChange={event => { setCurrency(event.target.value); setAccountId('') }}>{currencies.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="field">Limite total<input inputMode="decimal" value={limit} disabled={busy} onChange={event => setLimit(event.target.value)} placeholder="0,00" /></label>
      <div className="field"><label htmlFor="inline-card-account">Conta para pagar a fatura</label><select id="inline-card-account" value={accountId} disabled={busy} onChange={event => setAccountId(event.target.value)}><option value="">Escolher conta</option>{snapshot.accounts.filter(a => !a.archived && (a.currency || 'BRL') === currency).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select><InlineCreate kind="account" snapshot={snapshot} onCommit={onCommit} onCreated={setAccountId} preferredCurrency={currency} lockCurrency disabled={busy} /></div>
      <div className="inline-card-days"><label className="field">Dia do fechamento<input type="number" min="1" max="31" value={closingDay} disabled={busy} onChange={event => setClosingDay(Number(event.target.value))} /></label><label className="field">Dia do vencimento<input type="number" min="1" max="31" value={dueDay} disabled={busy} onChange={event => setDueDay(Number(event.target.value))} /></label></div>
      <label className="field">Vencimento<select value={dueMonthOffset} disabled={busy} onChange={event => setDueMonthOffset(Number(event.target.value))}><option value={0}>No mês do fechamento</option><option value={1}>No mês seguinte</option></select></label>
      <label className="field">Compra no dia do fechamento<select value={closingDayRule} disabled={busy} onChange={event => setClosingDayRule(event.target.value as CreditCard['closingDayRule'])}><option value="next">Próxima fatura</option><option value="current">Fatura atual</option></select></label>
      {error && <span className="error-text" role="alert">{error}</span>}
      <button type="button" className="inline-create-save" disabled={busy || !name.trim() || !accountId} onClick={() => void create()}>{busy ? 'Criando…' : 'Criar e selecionar cartão'}</button>
    </div></QuickCreateDialog>}
  </div>
}
