import { useState } from 'react'
import type { Filters, Snapshot } from '../lib/types'
import { dateLabel, filteredTransactions, percentageChange, previousPeriod, totals } from '../lib/finance'
import AnimatedMoney from '../components/motion/AnimatedMoney'
import './views.css'

interface Props { snapshot: Snapshot; projectId: string; filters: Filters }

export default function Comparison({ snapshot, projectId, filters }: Props) {
  const [mode, setMode] = useState<'periods' | 'projects'>('periods')
  const [comparisonDates, setComparisonDates] = useState(() => previousPeriod(filters.start, filters.end))
  const [leftProject, setLeftProject] = useState(projectId === 'geral' ? snapshot.projects[0]?.id || '' : projectId)
  const [rightProject, setRightProject] = useState(snapshot.projects.find(item => item.id !== (projectId === 'geral' ? snapshot.projects[0]?.id : projectId))?.id || '')
  const valid = mode === 'periods' ? Boolean(comparisonDates.start && comparisonDates.end && comparisonDates.start <= comparisonDates.end)
    : Boolean(leftProject && rightProject && leftProject !== rightProject)
  const leftFilters = { ...filters, status: 'settled' as const }
  const rightFilters = mode === 'periods' ? { ...leftFilters, ...comparisonDates } : leftFilters
  const left = totals(filteredTransactions(snapshot, mode === 'periods' ? projectId : leftProject, leftFilters))
  const right = totals(filteredTransactions(snapshot, mode === 'periods' ? projectId : rightProject, rightFilters))
  const leftTitle = mode === 'periods' ? `Atual: ${dateLabel(filters.start)} a ${dateLabel(filters.end)}` : snapshot.projects.find(item => item.id === leftProject)?.name
  const rightTitle = mode === 'periods' ? `Base: ${dateLabel(comparisonDates.start)} a ${dateLabel(comparisonDates.end)}` : snapshot.projects.find(item => item.id === rightProject)?.name
  const rows = [{ label: 'Receitas realizadas', left: left.income, right: right.income }, { label: 'Despesas realizadas', left: left.expenses, right: right.expenses }, { label: 'Resultado líquido', left: left.result, right: right.result }]
  return <div className="stack"><section className="card"><div className="comparison-controls"><label className="field">Comparar<select value={mode} onChange={event => setMode(event.target.value as 'periods' | 'projects')}><option value="periods">Dois períodos</option><option value="projects">Dois projetos</option></select></label>{mode === 'periods' ? <><label className="field">Período base: início<input type="date" value={comparisonDates.start} onChange={event => setComparisonDates({ ...comparisonDates, start: event.target.value })} /></label><label className="field">Período base: fim<input type="date" value={comparisonDates.end} onChange={event => setComparisonDates({ ...comparisonDates, end: event.target.value })} /></label><button className="secondary" onClick={() => setComparisonDates(previousPeriod(filters.start, filters.end))}>Usar período anterior</button></> : <><label className="field">Projeto analisado<select value={leftProject} onChange={event => setLeftProject(event.target.value)}><option value="">Selecione</option>{snapshot.projects.map(item => <option key={item.id} value={item.id}>{item.name}{item.archived ? ' (arquivado)' : ''}</option>)}</select></label><label className="field">Projeto base<select value={rightProject} onChange={event => setRightProject(event.target.value)}><option value="">Selecione</option>{snapshot.projects.map(item => <option key={item.id} value={item.id}>{item.name}{item.archived ? ' (arquivado)' : ''}</option>)}</select></label></>}</div><p className="hint">{mode === 'periods' ? 'O período atual e o projeto vêm dos filtros superiores.' : 'Os dois projetos usam o período dos filtros superiores; a seleção da aba é substituída pelos projetos escolhidos aqui.'} Conta, categoria e busca são mantidas. A comparação considera somente receitas e despesas realizadas, independentemente do filtro de situação.</p></section>
    {!valid ? <div className="card empty-state">{mode === 'periods' ? 'Selecione um período base válido.' : 'Selecione dois projetos diferentes. Você pode criar novos projetos na tela Criação.'}</div> : <section className="card"><div className="table-wrap"><table className="comparison-table"><thead><tr><th>Indicador</th><th>{leftTitle}</th><th>{rightTitle}</th><th>Diferença</th><th>Variação sobre a base</th></tr></thead><tbody>{rows.map(row => <tr key={row.label}><td>{row.label}</td><td><AnimatedMoney cents={row.left} /></td><td><AnimatedMoney cents={row.right} /></td><td>{row.left - row.right > 0 ? '+' : ''}<AnimatedMoney cents={row.left - row.right} /></td><td>{percentageChange(row.left, row.right)}</td></tr>)}</tbody></table></div><p className="hint">Diferença = analisado − base. Percentual só é calculado com base positiva. Um aumento de despesas não representa uma melhora.</p></section>}
  </div>
}
