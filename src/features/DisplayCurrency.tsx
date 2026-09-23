import { useEffect, useRef, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { currencies } from '../lib/investments'
import brazilFlag from '../assets/brazil-flag.svg'
import usaFlag from '../assets/usa-flag.svg'

const currencyNames = new Intl.DisplayNames('pt-BR', { type: 'currency' })

function CurrencyMark({ currency }: { currency: string }) {
  if (currency === 'BRL') return <img src={brazilFlag} alt="" />
  if (currency === 'USD') return <img src={usaFlag} alt="" />
  return <span>{currency}</span>
}

export default function DisplayCurrency({ value, onChange }: { value: string; onChange: (currency: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    search.current?.focus()
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const choices = currencies.filter(currency => `${currency} ${currencyNames.of(currency)}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')))

  return <div className="display-currency-anchor" ref={root}>
    <button ref={trigger} type="button" className="display-currency-trigger" title={`Visualização em ${value} · alterar moeda`} aria-label={`Moeda de visualização: ${value}. Alterar moeda`} aria-expanded={open} aria-controls="display-currency-menu" onClick={() => { setQuery(''); setOpen(current => !current) }}>
      <CurrencyMark currency={value} />
    </button>
    {open && <div id="display-currency-menu" className="display-currency-menu" aria-label="Escolher moeda de visualização">
      <div className="display-currency-menu-heading"><span>Visualizar em</span><strong>{value}</strong></div>
      <label className="display-currency-search"><Search size={15} /><input ref={search} aria-label="Buscar moeda" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar moeda" /></label>
      <div className="display-currency-options">
        {choices.map(currency => <button key={currency} type="button" disabled={busy} className={currency === value ? 'selected' : ''} aria-pressed={currency === value} onClick={async () => {
          if (currency !== value) {
            setBusy(true)
            const saved = await onChange(currency)
            setBusy(false)
            if (!saved) return
          }
          setOpen(false)
          trigger.current?.focus()
        }}><span className="display-currency-option-mark"><CurrencyMark currency={currency} /></span><span className="display-currency-option-label"><strong>{currency}</strong><small>{currencyNames.of(currency)}</small></span>{currency === value && <Check size={15} />}</button>)}
        {choices.length === 0 && <p className="display-currency-empty">Nenhuma moeda encontrada.</p>}
      </div>
    </div>}
  </div>
}
