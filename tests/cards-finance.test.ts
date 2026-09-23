import test from 'node:test'
import assert from 'node:assert/strict'
import { FinanceStore } from '../electron/store.mjs'
import { cardTotals, cardUsed, creditPreview } from '../src/lib/cards.ts'
import { accountBalance, totals } from '../src/lib/finance.ts'
import { netWorth } from '../src/lib/planning.ts'
import type { Snapshot } from '../src/lib/types.ts'

test('limites multimoeda e patrimônio não confundem crédito com caixa nem duplicam despesas', () => {
  const s = new FinanceStore(':memory:')
  try {
    const init = s.snapshot(), projectId = init.projects[0].id, categoryId = init.categories.find((c: { type: string }) => c.type === 'expense').id
    const br = s.saveAccount({ name: 'BR', type: 'checking', institution: '', currency: 'BRL', initialBalanceCents: 100000, initialDate: '2020-01-01' })
    const us = s.saveAccount({ ...br, id: undefined, name: 'USD', currency: 'USD' })
    const card = s.saveCreditCard({ name: 'Cartão BR', currency: 'BRL', icon: 'bank', accountId: br.id, limitCents: 200000, closingDay: 10, dueDay: 20, dueMonthOffset: 0, closingDayRule: 'next' })
    s.saveCreditCard({ ...card, id: undefined, name: 'Cartão USD', accountId: us.id, currency: 'USD', limitCents: 100000 })
    s.cacheMarket('fx', { rates: { BRL: 1, USD: .2 }, date: '2026-01-01' })
    s.saveCardPurchase({ description: 'Notebook', cardId: card.id, amountCents: 30000, count: 3, purchaseDate: '2026-01-01', projectId, categoryId })
    const before = s.snapshot() as Snapshot
    assert.deepEqual(cardTotals(before, 'BRL'), { limit: 700000, used: 30000, available: 670000, excess: 0, missing: [] })
    assert.equal(totals(before.transactions).expenses, 0)
    assert.equal(netWorth(before, 'BRL').net, 570000)
    assert.equal(accountBalance(br, before), 100000)
    s.payCardStatement({ requestId: 'test', statementId: before.cardStatements![0].id, accountId: br.id, paidDate: '2026-01-15' })
    const after = s.snapshot() as Snapshot
    assert.equal(cardUsed(after, card.id), 20000)
    assert.equal(accountBalance(br, after), 90000)
    assert.equal(totals(after.transactions).expenses, 10000)
    assert.equal(netWorth(after, 'BRL').net, 570000)
    assert.deepEqual(creditPreview(card, '2026-01-10', '', []), { closingDate: '2026-02-10', dueDate: '2026-02-20' })
    s.saveCreditCard({ ...card, limitCents: 15000 })
    assert.equal(cardTotals(s.snapshot(), 'BRL').excess, 5000)
    s.saveCreditCard({ ...card, archived: true })
    assert.equal(cardTotals(s.snapshot(), 'BRL').limit, 500000)
    assert.equal(cardTotals(s.snapshot(), 'BRL').used, 20000)
  } finally { s.close() }
})
