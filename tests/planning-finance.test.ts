import test from 'node:test'
import assert from 'node:assert/strict'
import { FinanceStore } from '../electron/store.mjs'
import { totals, accountBalance } from '../src/lib/finance.ts'
import { netWorth, loanBalance } from '../src/lib/planning.ts'
import { reportingSnapshot } from '../src/lib/investments.ts'
import type { Snapshot } from '../src/lib/types.ts'

test('consolidado patrimonial não duplica contrato vinculado e separa caixa de resultado econômico', () => {
  const store = new FinanceStore(':memory:')
  try {
    const initial = store.snapshot(), projectId = initial.projects[0].id, categoryId = initial.categories.find((c: { type: string }) => c.type === 'expense').id
    const account = store.saveAccount({ name: 'Banco', institution: '', currency: 'BRL', type: 'checking', initialBalanceCents: 100000, initialDate: '2026-01-01' })
    const loan = store.saveLoan({ name: 'Contrato', institution: 'Banco', currency: 'BRL', projectId, categoryId, accountId: account.id, contractedCents: 30000000, openingBalanceCents: 30000000, openingDate: '2026-01-01', receiveFunds: true, schedule: [{ dueDate: '2026-02-01', principalCents: 30000000, interestCents: 10000 }] })
    store.saveProperty({ name: 'Casa', kind: 'Imóvel', icon: 'home', currency: 'BRL', projectId, acquisitionDate: '2026-01-01', acquisitionCents: 40000000, ownershipPercent: 100, loanId: loan.id, valuations: [{ date: '2026-01-01', valueCents: 50000000, source: 'Manual' }] })
    store.cacheMarket('fx', { rates: { BRL: 1, USD: .2 }, date: '2026-01-01' })
    const before = store.snapshot() as Snapshot
    assert.equal(totals(before.transactions).income, 0)
    assert.equal(accountBalance(account, before), 30100000)
    const worth = netWorth(before, 'BRL')
    assert.equal(worth.assets, 50000000); assert.equal(worth.debt, 30000000); assert.equal(worth.net, 50100000)
    assert.equal(netWorth(before, 'USD').net, 10020000)
    store.payBill({ requestId: 'test', billId: before.bills![0].id, paidDate: '2026-02-01' })
    const after = store.snapshot() as Snapshot
    assert.equal(loanBalance(after, loan), 0)
    assert.equal(totals(after.transactions).expenses, 10000)
    assert.equal(accountBalance(account, after), 90000)
    assert.equal(netWorth(after, 'BRL').net, 50090000)
    assert.equal(totals(reportingSnapshot(after, 'USD').snapshot.transactions).expenses, 2000)
    assert.equal(netWorth(after, 'EUR').missing.length, 3)
  } finally { store.close() }
})
