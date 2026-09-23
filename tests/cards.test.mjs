import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { FinanceStore } from '../electron/store.mjs'
import { firstStatementMonth, statementDates } from '../electron/cards.mjs'

function fixture(t, disk = false) {
  const dir = disk ? mkdtempSync(join(tmpdir(), 'purple-cards-')) : null, path = dir ? join(dir, 'test.sqlite') : ':memory:', s = new FinanceStore(path)
  t.after(() => { try { s.close() } catch { /* Test already closed. */ } if (dir) rmSync(dir, { recursive: true, force: true }) })
  const account = s.saveAccount({ name: 'Conta', institution: 'Banco', currency: 'BRL', type: 'checking', initialBalanceCents: 200000, initialDate: '2020-01-01' })
  const snapshot = s.snapshot(), projectId = snapshot.projects[0].id, categoryId = snapshot.categories.find(c => c.type === 'expense').id
  const card = s.saveCreditCard({ name: 'Roxo', institution: 'Banco', currency: 'BRL', icon: 'bank', limitCents: 100000, closingDay: 10, dueDay: 20, dueMonthOffset: 0, closingDayRule: 'next', accountId: account.id, archived: false, lastFour: '1234' })
  const purchase = { description: 'Compra', cardId: card.id, amountCents: 10000, count: 3, purchaseDate: '2026-01-09', projectId, categoryId, subcategoryId: null, notes: '', firstMonth: '' }
  const used = () => { const data = s.snapshot(); return data.bills.filter(b => b.creditCardId === card.id && !b.canceled).reduce((sum, b) => sum + b.amountCents - data.payments.filter(p => p.billId === b.id).reduce((n, p) => n + p.appliedCents, 0), 0) }
  const balance = id => s.snapshot().transactions.filter(t => t.accountId === id && t.status === 'settled').reduce((sum, t) => sum + (t.type === 'income' ? 1 : -1) * t.amountCents, s.snapshot().accounts.find(a => a.id === id).initialBalanceCents)
  return { s, account, card, purchase, used, balance, dir, path }
}
test('calendário: antes, no dia e depois do fechamento; meses curtos, bissexto e virada de ano', () => {
  const card = { closingDay: 10, dueDay: 5, dueMonthOffset: 1, closingDayRule: 'next' }
  assert.equal(firstStatementMonth(card, '2026-01-09'), '2026-01')
  assert.equal(firstStatementMonth(card, '2026-01-10'), '2026-02')
  assert.equal(firstStatementMonth({ ...card, closingDayRule: 'current' }, '2026-01-10'), '2026-01')
  assert.equal(firstStatementMonth(card, '2026-12-11'), '2027-01')
  assert.deepEqual(statementDates(card, '2026-12'), { closingDate: '2026-12-10', dueDate: '2027-01-05' })
  assert.deepEqual(statementDates({ ...card, closingDay: 31, dueDay: 31 }, '2024-02'), { closingDate: '2024-02-29', dueDate: '2024-03-31' })
  assert.equal(firstStatementMonth({ ...card, closingDay: 31 }, '2026-02-28'), '2026-03')
})
test('parcelas preservam centavos, comprometem total e não mudam o saldo até a baixa', t => {
  const { s, purchase, used, balance, account } = fixture(t)
  s.saveCardPurchase(purchase)
  const snapshot = s.snapshot()
  assert.equal(used(), 10000); assert.equal(balance(account.id), 200000)
  assert.deepEqual(snapshot.bills.map(b => b.amountCents), [3334,3333,3333])
  assert.deepEqual(snapshot.bills.map(b => b.dueDate), ['2026-01-20','2026-02-20','2026-03-20'])
  assert.ok(snapshot.transactions.every(t => t.status === 'pending' && t.paymentMethod === 'credit' && t.creditCardId))
  const statement = snapshot.cardStatements[0], requestId = randomUUID()
  s.payCardStatement({ requestId, statementId: statement.id, accountId: account.id, amountCents: 1000, paidDate: '2026-01-12' })
  assert.equal(used(), 9000); assert.equal(balance(account.id), 199000)
  s.payCardStatement({ requestId, statementId: statement.id, accountId: account.id, amountCents: 1000, paidDate: '2026-01-12' })
  assert.equal(used(), 9000)
  s.undoCardStatementPayment({ requestId }); assert.equal(used(), 10000); assert.equal(balance(account.id), 200000)
  s.payCardStatement({ requestId: randomUUID(), statementId: statement.id, accountId: account.id, amountCents: 3334, paidDate: '2026-01-12' })
  assert.equal(used(), 6666); assert.equal(balance(account.id), 196666)
  assert.equal(s.snapshot().transactions.filter(t => t.status === 'settled').reduce((sum, t) => sum + t.economicCents, 0), 3334)
})
test('fatura preserva categorias/projetos e baixa é atômica na falha de referência', t => {
  const { s, purchase, account } = fixture(t)
  s.saveCardPurchase({ ...purchase, count: 1 })
  const project = s.saveProject({ name: 'Empresa', color: '#abcdef' })
  s.saveCardPurchase({ ...purchase, projectId: project.id, count: 1, amountCents: 20000 })
  const snapshot = s.snapshot(), statement = snapshot.cardStatements[0]
  const other = s.saveAccount({ ...account, id: undefined, name: 'USD', currency: 'USD' })
  assert.throws(() => s.payCardStatement({ requestId: randomUUID(), statementId: statement.id, accountId: other.id, paidDate: '2026-02-01', amountCents: 30000 }), /mesma moeda/)
  assert.equal(s.snapshot().payments.length, 0)
  const id = randomUUID()
  s.payCardStatement({ requestId: id, statementId: statement.id, paidDate: '2026-02-01', amountCents: 30000 })
  assert.equal(s.snapshot().payments.length, 2)
  assert.equal(new Set(s.snapshot().transactions.map(t => t.projectId)).size, 2)
  const last = s.snapshot().payments.at(-1)
  s.undoPayment({ id: last.id })
  s.undoCardStatementPayment({ requestId: id })
  assert.equal(s.snapshot().payments.length, 0)
})
test('edição/cancelamento sincroniza limite e parcelas; fatura paga protege compra e datas', t => {
  const { s, card, purchase, used, account } = fixture(t)
  const p = s.saveCardPurchase(purchase)
  s.saveCardPurchase({ ...p, amountCents: 12000, count: 2 })
  assert.equal(s.snapshot().bills.length, 2); assert.equal(used(), 12000)
  s.cancelCardPurchase({ id: p.id }); assert.equal(used(), 0); assert.equal(s.snapshot().transactions.length, 0)
  s.saveCardPurchase({ ...p, amountCents: 10000 }); assert.equal(used(), 10000)
  const statement = s.snapshot().cardStatements[0]
  s.payCardStatement({ requestId: randomUUID(), statementId: statement.id, accountId: account.id, paidDate: '2026-01-20' })
  assert.throws(() => s.cancelCardPurchase({ id: p.id }), /Desfaça/)
  assert.throws(() => s.saveCardPurchase(p), /Desfaça/)
  assert.throws(() => s.saveStatementDates({ ...statement, dueDate: '2026-01-21' }), /Desfaça/)
  assert.throws(() => s.saveCreditCard({ ...card, currency: 'USD' }))
  assert.throws(() => s.saveAccount({ ...account, currency: 'USD' }), /cartão/)
  assert.throws(() => s.saveBill({ ...s.snapshot().bills[0], amountCents: 1 }), /Cartões/)
})
test('alterar regras não reescreve faturas; calendário excepcional guia compras novas', t => {
  const { s, card, purchase } = fixture(t)
  s.saveCardPurchase({ ...purchase, count: 1 })
  const old = s.snapshot().cardStatements[0]
  s.saveCreditCard({ ...card, closingDay: 5, dueDay: 25 })
  assert.deepEqual(s.snapshot().cardStatements[0], old)
  s.saveStatementDates({ id: old.id, closingDate: '2026-01-12', dueDate: '2026-01-26' })
  assert.equal(s.snapshot().bills[0].dueDate, '2026-01-26')
  const p = s.saveCardPurchase({ ...purchase, count: 1, purchaseDate: '2026-01-11' })
  assert.equal(p.firstMonth, '2026-01')
  assert.equal(s.snapshot().bills.at(-1).dueDate, '2026-01-26')
})
test('débito persiste no lançamento normal; crédito não pode contornar faturas', t => {
  const { s, purchase, account } = fixture(t)
  const input = { description: 'Débito', amountCents: 1000, type: 'expense', projectId: purchase.projectId, accountId: account.id, categoryId: purchase.categoryId, dueDate: '2026-01-01', status: 'settled', paidDate: '2026-01-01', paymentMethod: 'debit' }
  s.saveTransaction(input); assert.equal(s.snapshot().transactions[0].paymentMethod, 'debit')
  assert.throws(() => s.saveTransaction({ ...input, paymentMethod: 'credit' }), /Cartões/)
  assert.throws(() => s.saveTransaction({ ...input, paymentMethod: 'invalid' }))
})
test('backup v4 com fatura parcialmente paga restaura exatamente', t => {
  const { s, purchase, account, dir } = fixture(t, true)
  s.saveCardPurchase(purchase)
  s.payCardStatement({ requestId: randomUUID(), statementId: s.snapshot().cardStatements[0].id, accountId: account.id, paidDate: '2026-01-15', amountCents: 1000 })
  const before = s.snapshot(), file = join(dir, 'backup.sqlite')
  s.backupTo(file); s.restoreFrom(file)
  for (const key of ['creditCards','cardPurchases','cardStatements','bills','payments','transactions']) assert.deepEqual(s.snapshot()[key], before[key])
  const legacy = join(s.backupDirectory, readdirSync(s.backupDirectory).find(name => name.startsWith('pre-restore-')))
  assert.ok(legacy)
})

test('migração e restauração v3 preservam contas, baixas e lançamentos antigos', t => {
  const { s, account, purchase, dir, path } = fixture(t, true)
  const bill = s.saveBill({ name: 'Energia', currency: 'BRL', accountId: account.id, projectId: purchase.projectId, categoryId: purchase.categoryId, dueDate: '2026-01-15', amountCents: 10000 })
  s.payBill({ requestId: randomUUID(), billId: bill.id, paidDate: '2026-01-15', appliedCents: 3000 })
  const before = s.snapshot()
  s.db.exec('DROP TABLE credit_cards; DROP TABLE card_purchases; DROP TABLE card_statements; ALTER TABLE transactions DROP COLUMN paymentMethod; PRAGMA user_version=3;')
  const legacy = join(dir, 'legacy-v3.sqlite'); s.backupTo(legacy); s.close()
  const upgraded = new FinanceStore(path)
  try {
    for (const key of ['accounts', 'bills', 'payments', 'transactions']) assert.deepEqual(upgraded.snapshot()[key], before[key])
    assert.equal(upgraded.db.prepare('PRAGMA user_version').get().user_version, 4)
    assert.ok(readdirSync(upgraded.backupDirectory).some(name => name.startsWith('pre-v4-')))
    upgraded.restoreFrom(legacy)
    assert.deepEqual(upgraded.snapshot().payments, before.payments)
    assert.deepEqual(upgraded.snapshot().transactions, before.transactions)
    assert.deepEqual(upgraded.snapshot().creditCards, [])
  } finally { upgraded.close() }
})

test('baixa parcial segue a data das compras e rejeita pagamento anterior à compra', t => {
  const { s, purchase } = fixture(t)
  const later = s.saveCardPurchase({ ...purchase, count: 1, purchaseDate: '2026-01-08' })
  const earlier = s.saveCardPurchase({ ...purchase, count: 1, purchaseDate: '2026-01-02' })
  const statement = s.snapshot().cardStatements[0]
  assert.throws(() => s.payCardStatement({ requestId: randomUUID(), statementId: statement.id, paidDate: '2026-01-01' }), /anteceder/)
  assert.equal(s.snapshot().payments.length, 0)
  s.payCardStatement({ requestId: randomUUID(), statementId: statement.id, paidDate: '2026-01-09', amountCents: 5000 })
  const snapshot = s.snapshot(), payment = snapshot.payments[0]
  assert.equal(snapshot.bills.find(b => b.id === payment.billId).cardPurchaseId, earlier.id)
  assert.notEqual(snapshot.bills.find(b => b.id === payment.billId).cardPurchaseId, later.id)
})
