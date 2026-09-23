import { useState, type CSSProperties } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { Account, Filters } from '../lib/types'
import { Identity } from './Identity'

function Avatar({ account }: { account: Account }) {
  return <span className="bank-avatar"><Identity value={account.icon || (account.type==='cash'?'cash':'')} name={account.institution || account.name} size={36}/></span>
}

export default function AccountDock({ accounts, filters, onChange }: { accounts: Account[]; filters: Filters; onChange: (filters: Filters) => void }) {
  const [open, setOpen] = useState(false)
  const excluded = filters.excludedAccountIds
  const selected = accounts.filter(account => !excluded.includes(account.id)).length
  const toggle = (id: string) => onChange({ ...filters, accountId: '', excludedAccountIds: excluded.includes(id) ? excluded.filter(item => item !== id) : [...excluded, id] })
  return <div className={`bank-dock ${open ? 'is-open' : ''}`}>
    <div className="bank-dock-topline">
      <span className="bank-dock-heading">SUAS CONTAS <span>{selected}/{accounts.length} no filtro</span></span>
      {accounts.length > 0 && <button type="button" className="bank-dock-trigger" aria-expanded={open} aria-controls="bank-dock-accounts" onClick={() => setOpen(value => !value)}>
        <span className="bank-dock-mini" aria-hidden="true">{accounts.slice(0, 3).map(account => <Avatar key={account.id} account={account} />)}</span>
        <span>{open ? 'Recolher' : 'Escolher contas'}</span><ChevronDown size={14} />
      </button>}
    </div>
    {accounts.length ? <div id="bank-dock-accounts" className="bank-dock-reveal" inert={!open} aria-hidden={!open}>
      <div><div className="bank-dock-actions"><span>Toque para incluir ou retirar cada conta dos gráficos, saldos e relatórios.</span><button type="button" onClick={() => onChange({ ...filters, accountId: '', excludedAccountIds: [] })} disabled={selected === accounts.length}>Selecionar todas</button></div>
        <div className="bank-dock-list">{accounts.map((account, index) => {
          const active = !excluded.includes(account.id)
          return <button type="button" key={account.id} className={`bank-chip ${active ? 'is-selected' : ''}`} aria-label={`${account.institution || account.name} · ${account.name}${account.archived ? ' · arquivada' : ''}`} aria-pressed={active} onClick={() => toggle(account.id)} style={{ '--dock-index': index } as CSSProperties}>
            <Avatar account={account} /><span className="bank-chip-copy"><strong>{account.institution || account.name}</strong><small>{account.name} · {account.currency || 'BRL'}{account.archived ? ' · arquivada' : ''}</small></span><span className="bank-chip-check"><Check size={12} /></span>
          </button>
        })}</div>
      </div>
    </div> : <span className="bank-dock-empty">Cadastre uma conta para usar o filtro por bancos.</span>}
  </div>
}
