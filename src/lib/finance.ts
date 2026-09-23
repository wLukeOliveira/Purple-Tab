import type { Account, Filters, Snapshot, Transaction, Transfer } from './types.ts'

export function moneyDecimal(cents: number): string {
  const digits = String(Math.abs(cents)).padStart(3, '0')
  return `${cents < 0 ? '-' : ''}${digits.slice(0, -2)},${digits.slice(-2)}`
}

export function money(cents: number, currency = 'BRL'): string {
  if (currency !== 'BRL') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
  const [whole, fraction] = moneyDecimal(Math.abs(cents)).split(',')
  const grouped = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(BigInt(whole))
  return `${cents < 0 ? '-' : ''}R$\u00a0${grouped},${fraction}`
}

export function assetPrice(value:number,currency:string) {
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:Math.abs(value)<1?8:2}).format(value)
}

export function parseMoney(text: string): number {
  const value = text.trim().replace(/^R\$\s*/, '').replace(/\s/g, '')
  let normalized: string
  if (/^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value)) normalized = value.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d+(,\d{1,2})?$/.test(value)) normalized = value.replace(',', '.')
  else if (/^-?\d+\.\d{1,2}$/.test(value)) normalized = value
  else throw new Error('Informe um valor válido, por exemplo 1.234,56.')
  const sign = normalized.startsWith('-') ? -1 : 1
  const [whole, fraction = ''] = normalized.replace('-', '').split('.')
  const cents = sign * (Number(whole) * 100 + Number(fraction.padEnd(2, '0')))
  if (!Number.isSafeInteger(cents)) throw new Error('O valor informado é muito grande.')
  return cents
}

export function today(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function dateLabel(date: string | null): string {
  if (!date) return '—'
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

export function monthRange(date = today()): { start: string; end: string } {
  const [year, month] = date.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return { start: `${year}-${String(month).padStart(2, '0')}-01`, end: `${year}-${String(month).padStart(2, '0')}-${lastDay}` }
}

export const defaultFilters = (date = today()): Filters => ({ ...monthRange(date), accountId: '', excludedAccountIds: [], categoryId: '', subcategoryId: '', status: 'all', search: '' })
export const accountIncluded = (filters: Filters, accountId: string): boolean => (!filters.accountId || filters.accountId === accountId) && !filters.excludedAccountIds.includes(accountId)
export const transactionDate = (entry: Transaction) => entry.status === 'settled' ? entry.paidDate || entry.dueDate : entry.dueDate
export const signedAmount = (entry: Transaction) => entry.type === 'income' ? entry.amountCents : -entry.amountCents

export function filteredTransactions(snapshot: Snapshot, projectId: string, filters: Filters): Transaction[] {
  const query = filters.search.trim().toLocaleLowerCase('pt-BR')
  return snapshot.transactions.filter(entry => {
    const date = transactionDate(entry)
    return (projectId === 'geral' || entry.projectId === projectId)
      && (!filters.start || date >= filters.start) && (!filters.end || date <= filters.end)
      && accountIncluded(filters, entry.accountId)
      && (!filters.categoryId || entry.categoryId === filters.categoryId)
      && (!filters.subcategoryId || entry.subcategoryId === filters.subcategoryId)
      && (filters.status === 'all' || entry.status === filters.status)
      && (!query || `${entry.description} ${entry.notes}`.toLocaleLowerCase('pt-BR').includes(query))
  })
}

export function totals(entries: Transaction[]) {
  let income = 0, expenses = 0, receivable = 0, payable = 0, pendingEconomic = 0
  for (const entry of entries) {
    if (entry.status === 'settled') {
      if (entry.type === 'income') income += entry.economicCents ?? entry.amountCents
      else expenses += entry.economicCents ?? entry.amountCents
    } else {
      if (entry.type === 'income') receivable += entry.amountCents
      else payable += entry.amountCents
      pendingEconomic += (entry.type === 'income' ? 1 : -1) * (entry.economicCents ?? entry.amountCents)
    }
  }
  return { income, expenses, result: income - expenses, receivable, payable, projectedResult: income - expenses + pendingEconomic }
}

export function accountBalance(account: Account, snapshot: Snapshot, end = today()): number {
  if (account.initialDate > end) return 0
  let balance = account.initialBalanceCents
  for (const entry of snapshot.transactions) {
    const date = transactionDate(entry)
    if (entry.accountId === account.id && entry.status === 'settled' && date >= account.initialDate && date <= end) balance += signedAmount(entry)
  }
  for (const transfer of snapshot.transfers) {
    if (transfer.date < account.initialDate || transfer.date > end) continue
    if (transfer.toAccountId === account.id) balance += transfer.receivedCents ?? transfer.amountCents
    if (transfer.fromAccountId === account.id) balance -= transfer.amountCents
  }
  return balance
}

export function accountBalances(snapshot: Snapshot, end = today(), accountId = '', excludedAccountIds: string[] = []) {
  return snapshot.accounts.filter(account => (!accountId || account.id === accountId) && !excludedAccountIds.includes(account.id)).map(account => ({ account, balance: accountBalance(account, snapshot, end) }))
}

// Includes overdue pending entries: an unpaid bill remains part of the forecast even
// when the visible period starts after its due date. Account balances are cumulative.
export function projection(snapshot: Snapshot, end: string, accountId = '', asOf = today(), excludedAccountIds: string[] = []) {
  const baseDate = end < asOf ? end : asOf
  const balance = accountBalances(snapshot, baseDate, accountId, excludedAccountIds).reduce((sum, item) => sum + item.balance, 0)
  let pending = 0, overdue = 0
  for (const entry of snapshot.transactions) {
    if (entry.status !== 'pending' || (accountId && entry.accountId !== accountId) || excludedAccountIds.includes(entry.accountId) || entry.dueDate > end) continue
    const account = snapshot.accounts.find(item => item.id === entry.accountId)
    if (!account || account.initialDate > end || entry.dueDate < account.initialDate) continue
    pending += signedAmount(entry)
    if (entry.dueDate < asOf) overdue += 1
  }
  return { balance, pending, predicted: balance + pending, overdue, baseDate }
}

export function filteredTransfers(snapshot: Snapshot, projectId: string, filters: Filters): Transfer[] {
  // Transfers belong to accounts, never to projects or expense categories.
  if (projectId !== 'geral' || filters.categoryId || filters.subcategoryId || filters.status === 'pending') return []
  const query = filters.search.trim().toLocaleLowerCase('pt-BR')
  return snapshot.transfers.filter(item => (!filters.start || item.date >= filters.start) && (!filters.end || item.date <= filters.end)
    && (accountIncluded(filters, item.fromAccountId) || accountIncluded(filters, item.toAccountId))
    && (!query || `${item.notes} transferência`.toLocaleLowerCase('pt-BR').includes(query)))
}

export function percentageChange(current: number, baseline: number): string {
  if (baseline <= 0) return 'Sem base percentual positiva'
  const value = (current - baseline) / baseline * 100
  return `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

export function previousPeriod(start: string, end: string): { start: string; end: string } {
  const parse = (value: string) => new Date(`${value}T12:00:00Z`).getTime()
  const first = parse(start), last = parse(end)
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return monthRange()
  const day = 86_400_000
  return { start: new Date(first - (last - first + day)).toISOString().slice(0, 10), end: new Date(first - day).toISOString().slice(0, 10) }
}

export function groupTotals(entries: Transaction[], key: (entry: Transaction) => string) {
  const groups = new Map<string, Transaction[]>()
  for (const entry of entries) {
    const id = key(entry)
    const existing = groups.get(id)
    if (existing) existing.push(entry)
    else groups.set(id, [entry])
  }
  return [...groups].map(([id, items]) => ({ id, count: items.length, ...totals(items) }))
}
