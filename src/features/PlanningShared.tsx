import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Commit, Snapshot } from '../lib/types'
import { currencies } from '../lib/investments'
import InlineCreate from './InlineCreate'

export function PlanningDialog({ title, onClose, busy, children, bare }: { bare?: boolean; title: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return <dialog ref={ref} className="planning-dialog" aria-label={title} onCancel={e => { e.preventDefault(); if (!busy) onClose() }}>{bare ? children : <><div className="modal-header"><div><span className="eyebrow">SEU CONTROLE FINANCEIRO</span><h2>{title}</h2></div><button type="button" className="icon-button" aria-label="Fechar formulário" disabled={busy} onClick={onClose}><X size={19} /></button></div><div className="modal-body">{children}</div></>}</dialog>
}
export function MoneyField({ label, value, onChange, required = true, disabled = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; disabled?: boolean }) {
  return <label className="field">{label}<input inputMode="decimal" required={required} disabled={disabled} value={value} placeholder="0,00" onChange={e => onChange(e.target.value)} /></label>
}
export function PlanningReferences({ snapshot, accountId, projectId, categoryId, currency, onChange, onCommit, preferredDate }: { snapshot: Snapshot; accountId: string; projectId: string; categoryId: string; currency: string; onChange: (value: { accountId?: string; projectId?: string; categoryId?: string; currency?: string }) => void; onCommit: Commit; preferredDate?: string }) {
  return <>
    <label className="field">Moeda<select aria-label="Moeda" value={currency} onChange={e => onChange({ currency: e.target.value, accountId: '' })}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label>
    <div className="field"><label htmlFor="planning-account">Conta prevista</label><select id="planning-account" aria-label="Conta prevista" value={accountId} onChange={e => onChange({ accountId: e.target.value })}><option value="">Escolher conta</option>{snapshot.accounts.filter(a => (!a.archived || a.id === accountId) && (a.currency || 'BRL') === currency).map(a => <option key={a.id} value={a.id}>{a.name}{a.archived ? ' (arquivada)' : ''}</option>)}</select><InlineCreate kind="account" snapshot={snapshot} onCommit={onCommit} onCreated={id => onChange({ accountId: id })} preferredCurrency={currency} preferredDate={preferredDate} lockCurrency /></div>
    <div className="field"><label htmlFor="planning-project">Projeto</label><select id="planning-project" aria-label="Projeto" required value={projectId} onChange={e => onChange({ projectId: e.target.value })}><option value="">Escolher projeto</option>{snapshot.projects.filter(p => !p.archived || p.id === projectId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><InlineCreate kind="project" snapshot={snapshot} onCommit={onCommit} onCreated={id => onChange({ projectId: id })} /></div>
    <div className="field"><label htmlFor="planning-category">Categoria</label><select id="planning-category" aria-label="Categoria" required value={categoryId} onChange={e => onChange({ categoryId: e.target.value })}><option value="">Escolher categoria</option>{snapshot.categories.filter(c => c.type === 'expense' && !c.parentId && (!c.archived || c.id === categoryId)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><InlineCreate kind="category" snapshot={snapshot} onCommit={onCommit} onCreated={id => onChange({ categoryId: id })} /></div>
  </>
}
