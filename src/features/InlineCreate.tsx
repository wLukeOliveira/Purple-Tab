import { useEffect, useState, type KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../lib/api'
import { parseMoney, today } from '../lib/finance'
import { currencies } from '../lib/investments'
import type { Account, Category, Commit, EntryType, Project, Snapshot } from '../lib/types'
import QuickCreateDialog from './QuickCreateDialog'

type Kind = 'project' | 'account' | 'category' | 'subcategory'
const labels: Record<Kind, string> = { project: 'projeto', account: 'conta', category: 'categoria', subcategory: 'subcategoria' }
const articles: Record<Kind, string> = { project: 'do', account: 'da', category: 'da', subcategory: 'da' }
const newLabels: Record<Kind, string> = { project: 'Novo', account: 'Nova', category: 'Nova', subcategory: 'Nova' }

interface Props {
  kind: Kind
  snapshot: Snapshot
  onCommit: Commit
  onCreated: (id: string) => void
  disabled?: boolean
  entryType?: EntryType
  parentId?: string
  preferredCurrency?: string
  preferredDate?: string
  lockCurrency?: boolean
}

export default function InlineCreate({ kind, snapshot, onCommit, onCreated, disabled, entryType = 'expense', parentId, preferredCurrency = 'BRL', preferredDate, lockCurrency = false }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [currency, setCurrency] = useState(preferredCurrency)
  const [accountType, setAccountType] = useState<Account['type']>('checking')
  const [balance, setBalance] = useState('0,00')
  const [initialDate, setInitialDate] = useState(preferredDate && preferredDate < today() ? preferredDate : today())
  const [color, setColor] = useState('#a78bfa')
  const [error, setError] = useState('')
  const accountCurrency = lockCurrency ? preferredCurrency : currency

  useEffect(() => { if (!open) { setCurrency(preferredCurrency); setInitialDate(preferredDate && preferredDate < today() ? preferredDate : today()) } }, [open, preferredCurrency, preferredDate])

  const reset = () => { setOpen(false); setName(''); setError('') }
  const matches = (item: Project | Account | Category) => !item.archived && item.name.localeCompare(name.trim(), 'pt-BR', { sensitivity: 'base' }) === 0

  async function create() {
    if (busy) return
    const title = labels[kind]
    if (!name.trim()) { setError(`Informe o nome ${articles[kind]} ${title}.`); return }
    if (kind === 'subcategory' && !parentId) { setError('Escolha primeiro a categoria principal.'); return }
    setError('')
    try {
      const existing = kind === 'project' ? snapshot.projects.find(matches)
        : kind === 'account' ? snapshot.accounts.find(item => matches(item) && (item.currency || 'BRL') === accountCurrency)
          : snapshot.categories.find(item => matches(item) && item.type === entryType && item.parentId === (kind === 'subcategory' ? parentId : null))
      if (existing) { onCreated(existing.id); reset(); return }
      const cents = kind === 'account' ? parseMoney(balance) : 0
      if (kind === 'account' && !Number.isSafeInteger(cents)) throw new Error('Informe um saldo inicial válido.')
      setBusy(true)
      let created: Project | Account | Category | undefined
      const ok = await onCommit(async () => {
        created = kind === 'project' ? await api.saveProject({ name: name.trim(), color, icon: 'folder', archived: false }) as Project
          : kind === 'account' ? await api.saveAccount({ name: name.trim(), institution: institution.trim(), currency: accountCurrency, icon: '', type: accountType, initialBalanceCents: cents, initialDate, archived: false }) as Account
            : await api.saveCategory({ name: name.trim(), type: entryType, parentId: kind === 'subcategory' ? parentId! : null, archived: false }) as Category
        return created
      }, `${title.charAt(0).toUpperCase()}${title.slice(1)} criada e selecionada.`)
      if (ok && created) { onCreated(created.id); reset() }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o cadastro.')
    } finally { setBusy(false) }
  }

  function enter(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type !== 'date' && event.target.type !== 'color') { event.preventDefault(); void create() }
  }

  return <div className="inline-create">
    <button type="button" className="inline-create-open" disabled={disabled || (kind === 'subcategory' && !parentId)} onClick={() => setOpen(true)}><Plus size={13} /> Criar {labels[kind]} aqui</button>
    {open && <QuickCreateDialog title={`${newLabels[kind]} ${labels[kind]}`} onClose={reset} busy={busy} wide={kind === 'account'}><div className="inline-create-panel" onKeyDown={enter}>
      <div className="inline-create-heading"><strong>{newLabels[kind]} {labels[kind]}</strong><button type="button" className="text-button" disabled={busy} onClick={reset}>Cancelar</button></div>
      <label className="field">Nome {articles[kind]} {newLabels[kind].toLowerCase()} {labels[kind]}<input autoFocus required maxLength={80} value={name} disabled={busy} onChange={event => setName(event.target.value)} placeholder={`Nome ${articles[kind]} ${labels[kind]}`} /></label>
      {kind === 'project' && <label className="field">Cor da aba<input type="color" value={color} disabled={busy} onChange={event => setColor(event.target.value)} /></label>}
      {kind === 'account' && <div className="inline-create-account-fields">
        <label className="field">Instituição (opcional)<input maxLength={100} value={institution} disabled={busy} onChange={event => setInstitution(event.target.value)} placeholder="Banco ou carteira" /></label>
        <label className="field">Tipo de conta<select value={accountType} disabled={busy} onChange={event => setAccountType(event.target.value as Account['type'])}><option value="checking">Conta corrente</option><option value="savings">Poupança</option><option value="cash">Dinheiro vivo</option><option value="investment">Investimento</option></select></label>
        {lockCurrency ? <span className="hint">Moeda: {accountCurrency}</span> : <label className="field">Moeda<select value={currency} disabled={busy} onChange={event => setCurrency(event.target.value)}>{currencies.map(item => <option key={item}>{item}</option>)}</select></label>}
        <label className="field">Saldo inicial<input inputMode="decimal" value={balance} disabled={busy} onChange={event => setBalance(event.target.value)} /></label>
        <label className="field">Data do saldo inicial<input type="date" min="1900-01-01" max={today()} value={initialDate} disabled={busy} onChange={event => setInitialDate(event.target.value)} /></label>
      </div>}
      {error && <span className="error-text" role="alert">{error}</span>}
      <button type="button" className="inline-create-save" disabled={busy || !name.trim()} onClick={() => void create()}>{busy ? 'Criando…' : `Criar e selecionar ${labels[kind]}`}</button>
    </div></QuickCreateDialog>}
  </div>
}
