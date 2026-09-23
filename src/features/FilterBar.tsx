import { useId, useState } from 'react'
import { ChevronDown, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import { monthRange, today } from '../lib/finance'
import type { Filters, Snapshot } from '../lib/types'
import AccountDock from './AccountDock'

export default function FilterBar({ snapshot, filters, onChange, settledOnly = false }: { snapshot: Snapshot; filters: Filters; onChange: (filters: Filters) => void; settledOnly?: boolean }) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const activeCount = [filters.categoryId, filters.subcategoryId, filters.search, !settledOnly && filters.status !== 'all'].filter(Boolean).length
  const month = monthRange(today())
  const allDates = [today(), ...snapshot.transactions.flatMap(t => [t.dueDate, t.paidDate || t.dueDate]), ...snapshot.accounts.map(a => a.initialDate)].sort()
  const presets = [
    { label: 'Este mês', ...month },
    { label: 'Este ano', start: `${today().slice(0, 4)}-01-01`, end: `${today().slice(0, 4)}-12-31` },
    { label: 'Todo período', start: allDates[0], end: allDates.at(-1)! },
  ]
  return <section className="filter-bar" aria-label="Filtros financeiros">
    <div className="filter-topline">
      <div className="segmented" aria-label="Período">{presets.map(({ label, start, end }) => <button key={label} aria-pressed={filters.start === start && filters.end === end} onClick={() => set({ start, end })}>{label}</button>)}</div>
      <div className="date-filter-pair">
        <label className="field">De<input type="date" value={filters.start} onChange={e => e.target.value && set({ start: e.target.value, end: filters.end < e.target.value ? e.target.value : filters.end })} /></label>
        <label className="field">Até<input type="date" value={filters.end} onChange={e => e.target.value && set({ end: e.target.value, start: filters.start > e.target.value ? e.target.value : filters.start })} /></label>
      </div>
      <button className={`filter-toggle ${activeCount ? 'has-filters' : ''}`} aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(value => !value)}><SlidersHorizontal size={15} />Filtros{activeCount > 0 && <span className="filter-count">{activeCount}</span>}<ChevronDown size={13} /></button>
    </div>
    <AccountDock accounts={snapshot.accounts} filters={filters} onChange={onChange} />
    <div id={detailsId} className={`filter-details ${expanded ? 'is-open' : ''}`} inert={!expanded} aria-hidden={!expanded}>
      <div><div className="filters-grid">
        <label className="field">Categoria<select value={filters.categoryId} onChange={e => set({ categoryId: e.target.value, subcategoryId: '' })}><option value="">Todas as categorias</option>{snapshot.categories.filter(c => !c.parentId).map(c => <option key={c.id} value={c.id}>{c.name}{c.archived ? ' (arquivada)' : ''}</option>)}</select></label>
        <label className="field">Subcategoria<select value={filters.subcategoryId} onChange={e => set({ subcategoryId: e.target.value })}><option value="">Todas</option>{snapshot.categories.filter(c => c.parentId && (!filters.categoryId || c.parentId === filters.categoryId)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="field">Situação<select value={settledOnly ? 'settled' : filters.status} disabled={settledOnly} onChange={e => set({ status: e.target.value as Filters['status'] })}><option value="all">Todas</option><option value="settled">Realizados</option><option value="pending">Pendentes</option></select></label>
        <label className="field search-field">Buscar<div><Search size={15} /><input placeholder="Descrição ou observação" value={filters.search} onChange={e => set({ search: e.target.value })} /></div></label>
      </div><button className="text-button filter-reset" onClick={() => onChange({ ...month, accountId: '', excludedAccountIds: [], categoryId: '', subcategoryId: '', status: 'all', search: '' })}><RotateCcw size={13} />Limpar filtros</button></div>
    </div>
  </section>
}
