import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import { dateLabel, money, parseMoney, today } from '../lib/finance'
import type { Account, Category, Commit, EntryType, Project, Snapshot } from '../lib/types'

import { currencies } from '../lib/investments'
import { Identity, IconPicker } from './Identity'
import { institutions } from '../lib/institutions'
import InlineCreate from './InlineCreate'

type Kind = 'project' | 'account' | 'category'
interface Props { snapshot: Snapshot; onCommit: Commit; initialKind?: Kind }
const kindLabels: Record<Kind, string> = { project: 'Projetos', account: 'Contas', category: 'Categorias' }
const typeLabels: Record<Account['type'], string> = { checking: 'Conta corrente', savings: 'Poupança', cash: 'Dinheiro', investment: 'Investimentos' }

function useEditorSave(onCommit: Commit, onSaved: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  async function submit(event: FormEvent, prepare: () => () => Promise<unknown>, message: string) {
    event.preventDefault()
    if (saving.current) return
    saving.current = true
    setError('')
    try {
      const action = prepare()
      setBusy(true)
      if (await onCommit(action, message)) onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o cadastro.')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  return { busy, error, submit }
}

function ProjectForm({ entry, onCommit, onSaved }: { entry?: Project; onCommit: Commit; onSaved: () => void }) {
  const id = useId()
  const [name, setName] = useState(entry?.name ?? '')
  const [color, setColor] = useState(entry?.color ?? '#a78bfa')
  const [icon, setIcon] = useState(entry?.icon ?? 'folder')
  const { busy, error, submit } = useEditorSave(onCommit, onSaved)
  return <form className="stack" onSubmit={e => submit(e, () => {
    if (!name.trim()) throw new Error('Informe o nome do projeto.')
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Escolha uma cor válida.')
    const input = { ...(entry ? { id: entry.id } : {}), name: name.trim(), color, icon, archived: entry?.archived ?? false }
    return () => api.saveProject(input)
  }, entry ? 'Projeto atualizado.' : 'Projeto criado.')}>
    <div className="section-heading"><h3>{entry ? 'Editar projeto' : 'Novo projeto'}</h3>{entry?.archived && <span className="badge">Arquivado</span>}</div>
    <div className="field"><label htmlFor={`${id}-name`}>Nome do projeto</label><input id={`${id}-name`} value={name} onChange={e => setName(e.target.value)} required maxLength={80} placeholder="Ex.: Pessoal, Empresa, Reforma" disabled={busy} /></div>
    <div className="field"><label htmlFor={`${id}-color`}>Cor da aba</label><input id={`${id}-color`} type="color" value={color} onChange={e => setColor(e.target.value)} disabled={busy} /><span className="hint">{color.toUpperCase()}</span></div>
    <IconPicker value={icon} onChange={setIcon}/>
    <p className="hint">O projeto reúne receitas e despesas próprias. A visão Geral consolida todos os projetos.</p>
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="toolbar">{entry && <button type="button" className="button secondary" onClick={onSaved} disabled={busy}>Cancelar edição</button>}<button type="submit" className="button primary" disabled={busy}>{busy ? 'Salvando…' : entry ? 'Salvar projeto' : 'Criar projeto'}</button></div>
  </form>
}

function AccountForm({ entry, onCommit, onSaved }: { entry?: Account; onCommit: Commit; onSaved: () => void }) {
  const id = useId()
  const [name, setName] = useState(entry?.name ?? '')
  const [institution, setInstitution] = useState(entry?.institution ?? '')
  const [currency, setCurrency] = useState(entry?.currency ?? 'BRL')
  const [icon, setIcon] = useState(entry?.icon ?? '')
  const [type, setType] = useState<Account['type']>(entry?.type ?? 'checking')
  const [initialBalance, setInitialBalance] = useState(entry ? `${entry.initialBalanceCents < 0 ? '-' : ''}${String(Math.abs(entry.initialBalanceCents)).padStart(3, '0').replace(/(\d{2})$/, ',$1')}` : '0,00')
  const [initialDate, setInitialDate] = useState(entry?.initialDate ?? today())
  const { busy, error, submit } = useEditorSave(onCommit, onSaved)
  return <form className="stack" onSubmit={e => submit(e, () => {
    if (!name.trim()) throw new Error('Informe o nome da conta.')
    const initialBalanceCents = parseMoney(initialBalance)
    if (!Number.isSafeInteger(initialBalanceCents)) throw new Error('Informe um saldo inicial válido, com até duas casas decimais.')
    if (!initialDate) throw new Error('Informe a data do saldo inicial.')
    const input = { ...(entry ? { id: entry.id } : {}), name: name.trim(), institution: institution.trim(), currency, icon, type, initialBalanceCents, initialDate, archived: entry?.archived ?? false }
    return () => api.saveAccount(input)
  }, entry ? 'Conta atualizada.' : 'Conta criada.')}>
    <div className="section-heading"><h3>{entry ? 'Editar conta' : 'Nova conta'}</h3>{entry?.archived && <span className="badge">Arquivada</span>}</div>
    <div className="field"><label htmlFor={`${id}-name`}>Nome da conta</label><input id={`${id}-name`} value={name} onChange={e => setName(e.target.value)} required maxLength={80} placeholder="Ex.: Conta principal" disabled={busy} /></div>
    <div className="field"><label htmlFor={`${id}-institution`}>Instituição (opcional)</label><input id={`${id}-institution`} list={`${id}-banks`} value={institution} onChange={e => setInstitution(e.target.value)} maxLength={100} placeholder="Ex.: Banco ou carteira" disabled={busy} /><datalist id={`${id}-banks`}>{institutions.map(bank=><option key={bank} value={bank}/>)}</datalist><div className="institution-preview"><Identity value={icon || (type==='cash'?'cash':'')} name={institution || name} size={42}/><span>{institution || 'Sua instituição'}</span></div></div>
    <label className="field">Moeda da carteira<select value={currency} onChange={e=>setCurrency(e.target.value)}>{currencies.map(c=><option key={c}>{c}</option>)}</select><small>Para uma instituição multimoeda, crie uma carteira por moeda, por exemplo Nomad · USD e Nomad · EUR.</small></label>
    <IconPicker value={icon} onChange={setIcon}/>
    <div className="field"><label htmlFor={`${id}-type`}>Tipo de conta</label><select id={`${id}-type`} value={type} onChange={e => setType(e.target.value as Account['type'])} disabled={busy}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    <div className="form-grid"><div className="field"><label htmlFor={`${id}-balance`}>Saldo inicial ({currency === 'BRL' ? 'R$' : currency})</label><input id={`${id}-balance`} inputMode="decimal" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} required disabled={busy} /><p className="hint">Pode ser zero ou negativo. Ex.: -250,00.</p></div><div className="field"><label htmlFor={`${id}-date`}>Data do saldo inicial</label><input id={`${id}-date`} type="date" value={initialDate} onChange={e => setInitialDate(e.target.value)} min="1900-01-01" max={today()} required disabled={busy} /></div></div>
    <p className="hint">Registre o saldo antes dos lançamentos que serão cadastrados. {entry ? 'Alterar o saldo inicial recalcula o saldo da conta em todo o histórico.' : 'Informe apenas dinheiro disponível; os ativos cadastrados na carteira de investimentos são contabilizados separadamente.'}</p>
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="toolbar">{entry && <button type="button" className="button secondary" onClick={onSaved} disabled={busy}>Cancelar edição</button>}<button type="submit" className="button primary" disabled={busy}>{busy ? 'Salvando…' : entry ? 'Salvar conta' : 'Criar conta'}</button></div>
  </form>
}

function CategoryForm({ entry, snapshot, onCommit, onSaved }: { entry?: Category; snapshot: Snapshot; onCommit: Commit; onSaved: () => void }) {
  const id = useId()
  const [name, setName] = useState(entry?.name ?? '')
  const [type, setType] = useState<EntryType>(entry?.type ?? 'expense')
  const [parentId, setParentId] = useState(entry?.parentId ?? '')
  const { busy, error, submit } = useEditorSave(onCommit, onSaved)
  const hasChildren = Boolean(entry && snapshot.categories.some(c => c.parentId === entry.id))
  const used = Boolean(entry && snapshot.transactions.some(t => t.categoryId === entry.id || t.subcategoryId === entry.id))
  const parents = snapshot.categories.filter(c => !c.parentId && c.type === type && c.id !== entry?.id && (!c.archived || c.id === entry?.parentId))
  return <form className="stack" onSubmit={e => submit(e, () => {
    if (!name.trim()) throw new Error('Informe o nome da categoria.')
    if (parentId && !parents.some(c => c.id === parentId)) throw new Error('Selecione uma categoria principal válida.')
    if (parentId && hasChildren) throw new Error('Uma categoria com subcategorias deve continuar como categoria principal.')
    const input = { ...(entry ? { id: entry.id } : {}), name: name.trim(), type, parentId: parentId || null, archived: entry?.archived ?? false }
    return () => api.saveCategory(input)
  }, entry ? 'Categoria atualizada.' : parentId ? 'Subcategoria criada.' : 'Categoria criada.')}>
    <div className="section-heading"><h3>{entry ? 'Editar categoria' : 'Nova categoria ou subcategoria'}</h3>{entry?.archived && <span className="badge">Arquivada</span>}</div>
    <div className="field"><label htmlFor={`${id}-name`}>Nome</label><input id={`${id}-name`} value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="Ex.: Moradia, Aluguel, Serviços" required disabled={busy} /></div>
    <div className="field"><label htmlFor={`${id}-type`}>Tipo de lançamento</label><select id={`${id}-type`} value={type} onChange={e => { setType(e.target.value as EntryType); setParentId('') }} disabled={busy || used || hasChildren}><option value="expense">Despesa</option><option value="income">Receita</option></select>{(used || hasChildren) && <p className="hint">O tipo é preservado porque esta categoria já possui lançamentos ou subcategorias.</p>}</div>
    <div className="field"><label htmlFor={`${id}-parent`}>Categoria principal</label><select id={`${id}-parent`} value={parentId} onChange={e => setParentId(e.target.value)} disabled={busy || hasChildren || used}><option value="">Nenhuma — criar categoria principal</option>{parents.map(c => <option key={c.id} value={c.id}>{c.name}{c.archived ? ' (arquivada)' : ''}</option>)}</select>{!entry && <InlineCreate kind="category" snapshot={snapshot} onCommit={onCommit} onCreated={setParentId} entryType={type} disabled={busy} />}<p className="hint">{used ? 'O vínculo é preservado para manter os lançamentos existentes consistentes.' : hasChildren ? 'Esta categoria já possui subcategorias.' : 'Selecione uma categoria principal para cadastrar uma subcategoria.'}</p></div>
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="toolbar">{entry && <button type="button" className="button secondary" onClick={onSaved} disabled={busy}>Cancelar edição</button>}<button type="submit" className="button primary" disabled={busy}>{busy ? 'Salvando…' : entry ? 'Salvar categoria' : parentId ? 'Criar subcategoria' : 'Criar categoria'}</button></div>
  </form>
}

export function Catalogs({ snapshot, onCommit, initialKind = 'project' }: Props) {
  const [kind, setKind] = useState<Kind>(initialKind)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [showArchived, setShowArchived] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const archiving = useRef(false)
  const items = (kind === 'project' ? snapshot.projects : kind === 'account' ? snapshot.accounts : snapshot.categories).filter(item => showArchived || !item.archived)

  function resetEditor() { setEditingId(null); setRevision(n => n + 1) }
  function changeKind(next: Kind) { setKind(next); resetEditor(); setError('') }

  async function toggleArchived(item: Project | Account | Category) {
    if (archiving.current) return
    archiving.current = true
    setBusyId(item.id)
    setError('')
    try {
      const archived = !item.archived
      const action = kind === 'project'
        ? () => api.saveProject({ ...(item as Project), archived })
        : kind === 'account'
          ? () => api.saveAccount({ ...(item as Account), archived })
          : () => api.saveCategory({ ...(item as Category), archived })
      if (await onCommit(action, archived ? 'Cadastro arquivado. O histórico foi preservado.' : 'Cadastro reativado.')) {
        if (editingId === item.id) resetEditor()
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível alterar o cadastro.')
    } finally {
      archiving.current = false
      setBusyId(null)
    }
  }

  function detail(item: Project | Account | Category) {
    if (kind === 'project') return snapshot.transactions.filter(t => t.projectId === item.id).length + ' lançamento(s)'
    if (kind === 'account') {
      const account = item as Account
      return `${typeLabels[account.type]}${account.institution ? ` · ${account.institution}` : ''} · Saldo inicial ${money(account.initialBalanceCents, account.currency || 'BRL')} em ${dateLabel(account.initialDate)}`
    }
    const category = item as Category
    const parent = snapshot.categories.find(c => c.id === category.parentId)
    return `${category.type === 'income' ? 'Receita' : 'Despesa'}${parent ? ` · Subcategoria de ${parent.name}` : ' · Categoria principal'}`
  }

  return <div className="stack">
    <div className="toolbar">{(Object.keys(kindLabels) as Kind[]).map(key => <button key={key} type="button" className={`button ${kind === key ? 'primary' : 'secondary'}`} aria-pressed={kind === key} onClick={() => changeKind(key)}>{kindLabels[key]}</button>)}</div>
    <div className="form-grid">
      <section className="card stack" aria-label={`Lista de ${kindLabels[kind].toLowerCase()}`}>
        <div className="section-heading"><h3>{kindLabels[kind]}</h3><button type="button" className="button secondary" onClick={resetEditor}>Novo cadastro</button></div>
        <label className="toolbar"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Mostrar arquivados</label>
        <div className="catalog-list">{items.length === 0 ? <p className="hint">Nenhum cadastro disponível. Use o formulário para começar.</p> : items.map(item => <div className="catalog-item" key={item.id}>
          <div><strong>{kind !== 'category' && <Identity value={(item as Project | Account).icon} color={kind==='project'?(item as Project).color:undefined} name={'institution' in item ? item.institution : item.name}/>}{item.name}</strong>{item.archived && <span className="badge"> Arquivado</span>}<p className="hint">{detail(item)}</p></div>
          <div className="toolbar"><button type="button" className="button secondary" onClick={() => { setEditingId(item.id); setRevision(n => n + 1) }} aria-label={`Editar ${item.name}`} disabled={Boolean(busyId)}>Editar</button><button type="button" className="button secondary" onClick={() => void toggleArchived(item)} aria-label={`${item.archived ? 'Reativar' : 'Arquivar'} ${item.name}`} disabled={Boolean(busyId)}>{busyId === item.id ? 'Salvando…' : item.archived ? 'Reativar' : 'Arquivar'}</button></div>
        </div>)}</div>
        <p className="hint">Arquivar oculta o cadastro dos novos lançamentos e preserva o histórico. Você pode reativá-lo a qualquer momento.{kind === 'project' ? ' Fechar uma aba também preserva todos os dados.' : ''}</p>
        {error && <p className="error-text" role="alert">{error}</p>}
      </section>
      <section className="card" aria-label="Formulário de cadastro">
        {kind === 'project' && <ProjectForm key={`project-${editingId}-${revision}`} entry={snapshot.projects.find(p => p.id === editingId)} onCommit={onCommit} onSaved={resetEditor} />}
        {kind === 'account' && <AccountForm key={`account-${editingId}-${revision}`} entry={snapshot.accounts.find(a => a.id === editingId)} onCommit={onCommit} onSaved={resetEditor} />}
        {kind === 'category' && <CategoryForm key={`category-${editingId}-${revision}`} entry={snapshot.categories.find(c => c.id === editingId)} snapshot={snapshot} onCommit={onCommit} onSaved={resetEditor} />}
      </section>
    </div>
  </div>
}
