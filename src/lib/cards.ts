import type { CardStatement, CreditCard, Snapshot } from './types.ts'
import { billRemaining, nextMonth } from './planning.ts'
import { exchange } from './investments.ts'

export const paymentLabels = { other: 'Outro / não informado', debit: 'Cartão de débito', credit: 'Cartão de crédito', pix: 'Pix', cash: 'Dinheiro', bank_slip: 'Boleto' }
const monthDay = (month: string, day: number) => `${month}-${String(Math.min(day, new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate())).padStart(2, '0')}`
export function creditPreview(card: CreditCard, purchaseDate: string, override: string, statements: CardStatement[]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) return null
  let month = purchaseDate.slice(0, 7)
  const close = statements.find(s => s.cardId === card.id && s.month === month)?.closingDate || monthDay(month, card.closingDay)
  if (purchaseDate > close || (purchaseDate === close && card.closingDayRule === 'next')) month = nextMonth(`${month}-01`, 1).slice(0, 7)
  month = override || month
  const existing = statements.find(s => s.cardId === card.id && s.month === month)
  return existing || { closingDate: monthDay(month, card.closingDay), dueDate: monthDay(nextMonth(`${month}-01`, card.dueMonthOffset).slice(0, 7), card.dueDay) }
}
export const cardUsed = (snapshot: Snapshot, cardId: string) => (snapshot.bills || []).filter(b => b.creditCardId === cardId && !b.canceled).reduce((sum, b) => sum + (billRemaining(snapshot, b) || 0), 0)
export function cardTotals(snapshot: Snapshot, currency: string) {
  let limit = 0, used = 0, available = 0, excess = 0
  const missing: string[] = []
  for (const c of snapshot.creditCards || []) {
    const committed = cardUsed(snapshot, c.id)
    if (c.archived && !committed) continue
    const convert = (value: number) => { const result = exchange(snapshot, value, c.currency, currency); if (result === null && !missing.includes(c.currency)) missing.push(c.currency); return Math.round(result || 0) }
    limit += convert(c.archived ? 0 : c.limitCents); used += convert(committed)
    available += convert(c.archived ? 0 : Math.max(0, c.limitCents - committed)); excess += convert(Math.max(0, committed - c.limitCents))
  }
  return { limit, used, available, excess, missing }
}
