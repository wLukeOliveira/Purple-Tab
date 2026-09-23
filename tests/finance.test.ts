import test from 'node:test'
import assert from 'node:assert/strict'
import { accountBalance, accountBalances, defaultFilters, filteredTransactions, filteredTransfers, money, moneyDecimal, monthRange, parseMoney, percentageChange, previousPeriod, projection, totals } from '../src/lib/finance.ts'
import { createCashSeries } from '../src/lib/chartData.ts'
import type { Snapshot, Transaction } from '../src/lib/types.ts'

function entry(overrides: Partial<Transaction> = {}): Transaction {
  return { id: 't1', description: 'Lançamento', type: 'income', amountCents: 200000, accountId: 'a1', projectId: 'empresa', categoryId: 'c1', subcategoryId: null, dueDate: '2026-09-01', paidDate: '2026-09-01', status: 'settled', notes: '', seriesId: null, occurrenceIndex: null, createdAt: '2026-09-01T10:00:00', updatedAt: '2026-09-01T10:00:00', ...overrides }
}
function snapshot(): Snapshot {
  return { projects: [{ id: 'pessoal', name: 'Pessoal', color: '#aaa', archived: false, createdAt: '2026-09-01' }, { id: 'empresa', name: 'Empresa', color: '#aaa', archived: false, createdAt: '2026-09-01' }], accounts: [{ id: 'a1', name: 'Conta', institution: '', type: 'checking', initialBalanceCents: 100000, initialDate: '2026-09-01', archived: false }, { id: 'a2', name: 'Segunda', institution: '', type: 'cash', initialBalanceCents: 0, initialDate: '2026-09-01', archived: false }], categories: [], transactions: [], transfers: [], goals: [], settings: { profileName: '', openTabs: [], activeTab: 'geral', screen: 'home', compact: false }, meta: { databasePath: '', lastBackup: null, appVersion: '' } }
}

test('PT-BR money parsing preserves cents and rejects invalid or oversized input', () => {
  assert.equal(parseMoney('1.234,56'), 123456)
  assert.equal(parseMoney('R$ 100,01'), 10001)
  assert.equal(parseMoney('1.000'), 100000)
  assert.equal(parseMoney('0,10'), 10)
  assert.equal(parseMoney('-23,09'), -2309)
  assert.equal(parseMoney('1234.56'), 123456)
  assert.throws(() => parseMoney(''))
  assert.throws(() => parseMoney('1,000'))
  assert.throws(() => parseMoney('abc'))
  assert.throws(() => parseMoney('90071992547409999'))
  assert.match(money(123456), /1\.234,56/)
  assert.equal(moneyDecimal(Number.MAX_SAFE_INTEGER), '90071992547409,91')
  assert.equal(parseMoney(moneyDecimal(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER)
  assert.match(money(Number.MAX_SAFE_INTEGER), /90\.071\.992\.547\.409,91/)
})

test('acceptance: edits, payment, transfer and project totals stay consistent', () => {
  const data = snapshot()
  data.transactions.push(entry(), entry({ id: 't2', projectId: 'pessoal', type: 'expense', amountCents: 30000 }))
  const filters = defaultFilters('2026-09-22')
  assert.equal(accountBalances(data, '2026-09-22').reduce((sum, item) => sum + item.balance, 0), 270000)
  assert.equal(totals(filteredTransactions(data, 'empresa', filters)).result, 200000)
  assert.equal(totals(filteredTransactions(data, 'pessoal', filters)).result, -30000)
  data.transactions[1].amountCents = 35000
  assert.equal(accountBalance(data.accounts[0], data, '2026-09-22'), 265000)
  data.transactions.push(entry({ id: 't3', projectId: 'pessoal', type: 'expense', amountCents: 50000, dueDate: '2026-09-28', paidDate: null, status: 'pending' }))
  assert.equal(projection(data, '2026-09-30', '', '2026-09-22').balance, 265000)
  assert.equal(projection(data, '2026-09-30', '', '2026-09-22').predicted, 215000)
  data.transactions[2].status = 'settled'; data.transactions[2].paidDate = '2026-09-22'
  assert.equal(accountBalance(data.accounts[0], data, '2026-09-22'), 215000)
  data.transfers.push({ id: 'move', fromAccountId: 'a1', toAccountId: 'a2', amountCents: 10000, date: '2026-09-22', notes: '' })
  assert.equal(accountBalance(data.accounts[0], data, '2026-09-22'), 205000)
  assert.equal(accountBalance(data.accounts[1], data, '2026-09-22'), 10000)
  assert.equal(projection(data, '2026-09-30', '', '2026-09-22').balance, 215000)
  assert.equal(totals(data.transactions).income, 200000)
  assert.equal(totals(data.transactions).expenses, 85000)
})

test('period filters use paid date for settled records and due date for pending records', () => {
  const data = snapshot()
  data.transactions = [entry({ id: 'paid', dueDate: '2026-08-20', paidDate: '2026-09-03' }), entry({ id: 'old', dueDate: '2026-09-15', paidDate: '2026-08-30' }), entry({ id: 'pending', dueDate: '2026-09-05', paidDate: null, status: 'pending' }), entry({ id: 'future', dueDate: '2026-10-01', paidDate: null, status: 'pending' })]
  assert.deepEqual(filteredTransactions(data, 'geral', defaultFilters('2026-09-01')).map(item => item.id), ['paid', 'pending'])
  assert.deepEqual(filteredTransactions(data, 'geral', { ...defaultFilters('2026-09-01'), status: 'settled' }).map(item => item.id), ['paid'])
})

test('projection includes overdue pending and honors account initial date and horizon', () => {
  const data = snapshot()
  data.transactions = [entry({ type: 'expense', amountCents: 3000, dueDate: '2026-09-02', paidDate: null, status: 'pending' }), entry({ id: 'future', type: 'expense', amountCents: 9000, dueDate: '2026-10-01', paidDate: null, status: 'pending' })]
  assert.equal(projection(data, '2026-09-30', '', '2026-09-22').predicted, 97000)
  assert.equal(projection(data, '2026-09-30', '', '2026-09-22').overdue, 1)
  assert.equal(accountBalance(data.accounts[0], data, '2026-08-31'), 0)
  assert.equal(projection(data, '2026-09-30', 'a2', '2026-09-22').predicted, 0)
})

test('historical and future horizons never pull a later payment into the current balance', () => {
  const data = snapshot()
  data.transactions = [entry({ paidDate: '2026-09-22' }), entry({ id: 'later', paidDate: '2026-10-05', dueDate: '2026-10-05', amountCents: 9000 })]
  data.transfers = [{ id: 'later-transfer', fromAccountId: 'a1', toAccountId: 'a2', amountCents: 10000, date: '2026-10-05', notes: '' }]
  assert.equal(accountBalance(data.accounts[0], data, '2026-09-21'), 100000)
  assert.equal(projection(data, '2026-09-21', '', '2026-09-22').balance, 100000)
  assert.equal(projection(data, '2026-10-31', '', '2026-09-22').balance, 300000)
  assert.equal(projection(data, '2026-10-31', 'a2', '2026-09-22').balance, 0)
  assert.equal(totals(filteredTransactions(data, 'geral', defaultFilters('2026-09-01'))).income, 200000)
})

test('archived projects stay consolidated and all filters compose', () => {
  const data = snapshot()
  data.projects[1].archived = true
  data.transactions = [entry({ description: 'Venda especial', notes: 'Nota 42', subcategoryId: 'child' }), entry({ id: 'other', accountId: 'a2', categoryId: 'c2' })]
  const filters = { ...defaultFilters('2026-09-01'), accountId: 'a1', categoryId: 'c1', subcategoryId: 'child', search: 'NOTA 42', status: 'settled' as const }
  assert.equal(filteredTransactions(data, 'geral', filters).length, 1)
  assert.equal(filteredTransactions(data, 'pessoal', filters).length, 0)
  assert.equal(totals(filteredTransactions(data, 'geral', defaultFilters('2026-09-01'))).income, 400000)
})

test('transfers are visible only in account context, never income or expense', () => {
  const data = snapshot()
  data.transfers = [{ id: 'move', fromAccountId: 'a1', toAccountId: 'a2', amountCents: 10000, date: '2026-09-22', notes: 'Reserva' }]
  const filters = defaultFilters('2026-09-01')
  assert.equal(filteredTransfers(data, 'geral', { ...filters, accountId: 'a2' }).length, 1)
  assert.equal(filteredTransfers(data, 'pessoal', filters).length, 0)
  assert.equal(filteredTransfers(data, 'geral', { ...filters, categoryId: 'c1' }).length, 0)
  assert.equal(filteredTransfers(data, 'geral', { ...filters, status: 'pending' }).length, 0)
  assert.equal(totals(filteredTransactions(data, 'geral', filters)).income, 0)
})

test('bank dock exclusions apply to transactions, transfers, balances and forecast together', () => {
  const data = snapshot()
  data.accounts[1].initialBalanceCents = 40000
  data.transactions = [entry(), entry({ id: 'second', accountId: 'a2', amountCents: 5000 }), entry({ id: 'pending', accountId: 'a2', type: 'expense', amountCents: 1000, status: 'pending', paidDate: null, dueDate: '2026-09-30' })]
  data.transfers = [{ id: 'transfer', fromAccountId: 'a1', toAccountId: 'a2', amountCents: 10000, date: '2026-09-22', notes: '' }]
  const onlySecond = { ...defaultFilters('2026-09-22'), excludedAccountIds: ['a1'] }
  assert.deepEqual(filteredTransactions(data, 'geral', onlySecond).map(item => item.id), ['second', 'pending'])
  assert.deepEqual(filteredTransfers(data, 'geral', onlySecond).map(item => item.id), ['transfer'])
  assert.equal(accountBalances(data, '2026-09-22', '', onlySecond.excludedAccountIds).reduce((sum, item) => sum + item.balance, 0), 55000)
  assert.equal(projection(data, '2026-09-30', '', '2026-09-22', onlySecond.excludedAccountIds).predicted, 54000)
  const none = { ...onlySecond, excludedAccountIds: ['a1', 'a2'] }
  assert.equal(filteredTransactions(data, 'geral', none).length, 0)
  assert.equal(filteredTransfers(data, 'geral', none).length, 0)
  assert.equal(projection(data, '2026-09-30', '', '2026-09-22', none.excludedAccountIds).predicted, 0)
})

test('chart points use paid dates, exact cents, empty periods and calendar boundaries', () => {
  const entries = [entry({ id: 'in', amountCents: 10001, dueDate: '2026-08-29', paidDate: '2026-09-01' }), entry({ id: 'out', type: 'expense', amountCents: 3334, dueDate: '2026-09-02', paidDate: '2026-09-02' }), entry({ id: 'later', type: 'income', amountCents: 5000, dueDate: '2026-09-03', paidDate: null, status: 'pending' })]
  const days = createCashSeries(entries, '2026-09-01', '2026-09-04', 'day')
  assert.deepEqual(days.map(point => point.cumulativeCents), [10001, 6667, 6667, 6667])
  assert.deepEqual(days.map(point => point.time), ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'])
  assert.equal(createCashSeries(entries, '2026-09-01', '2026-09-30', 'month')[0].resultCents, 6667)
  assert.equal(createCashSeries(entries, '2026-09-01', '2026-09-30', 'week').reduce((sum, point) => sum + point.resultCents, 0), 6667)
  assert.equal(createCashSeries(entries, '2026-10-01', '2026-10-31', 'day').length, 0)
})

test('calendar helpers cover leap years and comparison avoids fictitious percentages', () => {
  assert.deepEqual(monthRange('2024-02-15'), { start: '2024-02-01', end: '2024-02-29' })
  assert.deepEqual(monthRange('2026-02-15'), { start: '2026-02-01', end: '2026-02-28' })
  assert.deepEqual(previousPeriod('2026-03-01', '2026-03-31'), { start: '2026-01-29', end: '2026-02-28' })
  assert.match(percentageChange(100, 0), /Sem base/)
  assert.match(percentageChange(100, -100), /Sem base/)
  assert.equal(percentageChange(150, 100), '+50%')
})
