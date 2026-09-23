import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import type { Commit, Goal, Snapshot } from '../lib/types'
import { dateLabel, defaultFilters, filteredTransactions, money, moneyDecimal, monthRange, parseMoney, today, totals } from '../lib/finance'
import AnimatedMoney from '../components/motion/AnimatedMoney'
import AnimatedFill from '../components/motion/AnimatedFill'
import './views.css'

interface Props { snapshot: Snapshot; projectId: string; onCommit: Commit }
interface GoalForm { id?: string; name: string; projectId: string; target: string; startDate: string; endDate: string }

export default function Achievements({ snapshot, projectId, onCommit }: Props) {
  const [form, setForm] = useState<GoalForm | null>(null)
  const [deleting, setDeleting] = useState<Goal | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const goals = snapshot.goals.filter(goal => projectId === 'geral' || goal.projectId === projectId)
  const openForm = (goal?: Goal) => {
    const period = monthRange()
    setForm(goal ? { ...goal, projectId: goal.projectId || '', target: moneyDecimal(goal.targetCents) } : { name: '', projectId: projectId === 'geral' ? '' : projectId, target: '', startDate: period.start, endDate: period.end })
    setError(''); setDeleting(null)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form || busy) return
    try {
      const targetCents = parseMoney(form.target)
      if (!form.name.trim()) throw new Error('Informe o nome da meta.')
      if (targetCents <= 0) throw new Error('O objetivo da meta deve ser maior que zero.')
      if (!form.startDate || !form.endDate || form.startDate > form.endDate) throw new Error('Informe um período válido para a meta.')
      setError(''); setBusy(true)
      const ok = await onCommit(() => api.saveGoal({ id: form.id, name: form.name.trim(), projectId: form.projectId || null, targetCents, startDate: form.startDate, endDate: form.endDate }), 'Meta salva.')
      if (ok) setForm(null)
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar a meta.') }
    finally { setBusy(false) }
  }
  const removeGoal = async () => {
    if (!deleting || busy) return
    setBusy(true)
    const ok = await onCommit(() => api.deleteGoal({ id: deleting.id }), 'Meta excluída.')
    setBusy(false)
    if (ok) setDeleting(null)
  }
  const milestones = [
    { label: 'Primeiro lançamento', description: 'Pelo menos uma receita ou despesa cadastrada.', done: snapshot.transactions.length > 0 },
    { label: 'Projetos organizados', description: 'Dois ou mais projetos cadastrados.', done: snapshot.projects.length >= 2 },
    { label: 'Objetivo definido', description: 'Pelo menos uma meta de economia criada.', done: snapshot.goals.length > 0 },
    { label: 'Dados protegidos', description: 'Um backup registrado pelo aplicativo.', done: Boolean(snapshot.meta.lastBackup) },
  ]
  return <div className="stack"><div className="toolbar"><button className="primary" onClick={() => openForm()}>+ Nova meta</button></div><p className="hint">Metas de economia medem receitas realizadas menos despesas realizadas no período e projeto definidos. Não incluem saldo inicial, pendências ou transferências. Os filtros superiores não alteram o período de cada meta; a aba selecionada define quais metas aparecem.</p>
    {form && <form className="card goal-form stack" onSubmit={submit}><h2>{form.id ? 'Editar meta' : 'Nova meta de economia'}</h2><div className="form-grid"><label className="field">Nome da meta<input autoFocus required maxLength={120} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Reserva para o escritório" /></label><label className="field">Economia desejada (R$)<input required inputMode="decimal" value={form.target} onChange={event => setForm({ ...form, target: event.target.value })} placeholder="1.000,00" /></label><label className="field">Projeto<select value={form.projectId} onChange={event => setForm({ ...form, projectId: event.target.value })}><option value="">Todos os projetos</option>{snapshot.projects.filter(project => !project.archived || project.id === snapshot.goals.find(goal => goal.id === form.id)?.projectId).map(project => <option key={project.id} value={project.id}>{project.name}{project.archived ? ' (arquivado)' : ''}</option>)}</select></label><label className="field">Início<input type="date" required value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} /></label><label className="field">Fim<input type="date" required min={form.startDate} value={form.endDate} onChange={event => setForm({ ...form, endDate: event.target.value })} /></label></div>{error && <p className="error-text" role="alert">{error}</p>}<div className="toolbar"><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar meta'}</button><button className="secondary" type="button" disabled={busy} onClick={() => setForm(null)}>Cancelar</button></div></form>}
    {deleting && <section className="inline-confirm"><h3>Excluir a meta “{deleting.name}”?</h3><p>Os lançamentos financeiros serão preservados.</p><div className="toolbar"><button className="danger" disabled={busy} onClick={removeGoal}>Excluir meta</button><button className="secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button></div></section>}
    {!goals.length ? <section className="card empty-state"><p>Nenhuma meta para este contexto.</p><button className="primary" onClick={() => openForm()}>Definir primeira meta</button></section> : <div className="goal-grid">{goals.map(goal => {
      const filters = { ...defaultFilters(), start: goal.startDate, end: goal.endDate < today() ? goal.endDate : today(), status: 'settled' as const }
      const result = totals(filteredTransactions(snapshot, goal.projectId || 'geral', filters)).result
      const percentage = goal.targetCents > 0 ? Math.max(0, Math.min(100, result / goal.targetCents * 100)) : 0
      const completed = result >= goal.targetCents
      return <article key={goal.id} className={`card goal-card ${completed ? 'goal-complete' : ''}`}><div className="section-heading"><h3>{goal.name}</h3><span className={`badge ${completed ? 'positive' : ''}`}>{completed ? 'Atingida' : goal.startDate > today() ? 'Ainda não iniciada' : goal.endDate < today() ? 'Período encerrado' : 'Em andamento'}</span></div><p className="hint">{goal.projectId ? snapshot.projects.find(project => project.id === goal.projectId)?.name : 'Todos os projetos'} · {dateLabel(goal.startDate)} a {dateLabel(goal.endDate)}</p><div className="goal-progress"><strong className={result < 0 ? 'negative' : 'positive'}><AnimatedMoney cents={result} /></strong><span className="muted">de {money(goal.targetCents)}</span></div><div className="progress-track" role="progressbar" aria-label={goal.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentage)}><AnimatedFill percentage={percentage} /></div><p className="hint">{percentage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do objetivo · {completed ? 'Objetivo alcançado com o resultado registrado.' : `Faltam ${money(Math.max(0, goal.targetCents - result))}.`}</p><div className="row-actions"><button className="secondary" onClick={() => openForm(goal)}>Editar meta</button><button className="danger" onClick={() => { setDeleting(goal); setForm(null) }}>Excluir</button></div></article>
    })}</div>}
    <section className="card"><h2>Marcos da sua organização</h2><p className="hint">Critérios baseados no estado atual de todos os seus registros.</p><div className="milestone-list">{milestones.map(item => <article key={item.label} className={`milestone ${item.done ? 'done' : ''}`}><strong>{item.done ? '✓ ' : '○ '}{item.label}</strong><small className="muted">{item.description}</small></article>)}</div></section>
  </div>
}
