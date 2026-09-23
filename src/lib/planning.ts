import type { Bill, Loan, Snapshot } from './types.ts'
import { accountBalance } from './finance.ts'
import { exchange, valuation } from './investments.ts'

export const billPaid = (snapshot: Snapshot, id: string) => (snapshot.payments || []).filter(p => p.billId === id).reduce((sum, p) => sum + p.appliedCents, 0)
export const billRemaining = (snapshot: Snapshot, bill: Bill) => bill.amountCents === null ? null : bill.amountCents - billPaid(snapshot, bill.id)
export const loanBalance = (snapshot: Snapshot, loan: Loan) => loan.openingBalanceCents - (snapshot.payments || []).filter(p => snapshot.bills?.some(b => b.id === p.billId && b.loanId === loan.id)).reduce((sum, p) => sum + p.principalCents, 0)
export function netWorth(snapshot: Snapshot, target: string, projectId = 'geral') {
  const missing: string[] = []
  const convert = (value: number | null, currency: string, name: string) => {
    const converted = value === null ? null : exchange(snapshot, value, currency, target)
    if (converted === null) { missing.push(name); return 0 }
    return Math.round(converted)
  }
  // Accounts do not belong to projects; a project view explicitly excludes global cash.
  const cash = projectId === 'geral' ? snapshot.accounts.reduce((sum, a) => sum + convert(accountBalance(a, snapshot), a.currency || 'BRL', a.name), 0) : 0
  const investments = (snapshot.investments || []).filter(a => !a.closedDate && (projectId === 'geral' || a.projectId === projectId)).reduce((sum, a) => { const v = valuation(a, snapshot).value; return sum + convert(v === null ? null : v * 100, a.currency, a.name) }, 0)
  const assets = (snapshot.assets || []).filter(a => !a.archived && (projectId === 'geral' || a.projectId === projectId)).reduce((sum, a) => sum + convert(Math.round((a.valuations.at(-1)?.valueCents || 0) * a.ownershipPercent / 100), a.currency, a.name), 0)
  const cardDebt = (snapshot.bills || []).filter(b => b.creditCardId && !b.canceled && (projectId === 'geral' || b.projectId === projectId)).reduce((sum, b) => sum + convert(billRemaining(snapshot, b) || 0, b.currency, b.name), 0)
  const debt = cardDebt + (snapshot.loans || []).filter(l => projectId === 'geral' || l.projectId === projectId).reduce((sum, l) => sum + convert(loanBalance(snapshot, l), l.currency, l.name), 0)
  return { cash, investments, assets, debt, gross: cash + investments + assets, net: cash + investments + assets - debt, missing }
}
export function nextMonth(value: string, offset: number) {
  const [y, m, d] = value.split('-').map(Number), date = new Date(Date.UTC(y, m - 1 + offset, 1, 12))
  date.setUTCDate(Math.min(d, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()))
  return date.toISOString().slice(0, 10)
}
