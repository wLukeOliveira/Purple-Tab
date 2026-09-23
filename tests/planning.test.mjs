import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { FinanceStore } from '../electron/store.mjs'
import { shiftMonth } from '../electron/planning.mjs'

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'purple-planning-')), path = join(directory, 'test.sqlite'), store = new FinanceStore(path)
  t.after(() => { try { store.close() } catch { /* Closed in migration test. */ } rmSync(directory, { recursive: true, force: true }) })
  const snapshot = store.snapshot(), project = snapshot.projects[0], category = snapshot.categories.find(c => c.type === 'expense')
  const account = store.saveAccount({ name: 'Nubank', institution: 'Nubank', currency: 'BRL', type: 'checking', initialBalanceCents: 100000, initialDate: '2020-01-01', archived: false })
  const bill = { name: 'Energia', currency: 'BRL', accountId: account.id, projectId: project.id, categoryId: category.id, dueDate: '2026-01-15', amountCents: 20000, estimateCents: 18000, notes: '' }
  const loan = { name: 'Empréstimo', institution: 'Banco', ...bill, contractedCents: 100000, openingBalanceCents: 90000, openingDate: '2026-01-01', receiveFunds: false, schedule: [{ dueDate: '2026-01-15', principalCents: 45000, interestCents: 5000 }, { dueDate: '2026-02-15', principalCents: 45000, interestCents: 4000 }] }
  return { store, directory, path, account, bill, loan }
}
const balance = (store, id) => { const s = store.snapshot(); return s.accounts.find(a => a.id === id).initialBalanceCents + s.transactions.filter(t => t.accountId === id && t.status === 'settled').reduce((sum, t) => sum + (t.type === 'income' ? t.amountCents : -t.amountCents), 0) }
const pay = (store, bill, args = {}) => store.payBill({ requestId: randomUUID(), billId: bill.id, paidDate: '2026-01-16', ...args })

test('conta confirmada, baixa parcial, encargos, conta alternativa, idempotência e desfazer sem duplicação', t => {
  const { store, bill, account } = fixture(t)
  const b = store.saveBill(bill), original = store.snapshot()
  assert.equal(original.transactions.length, 1)
  const other = store.saveAccount({ ...account, id: undefined, name: 'Outra conta' })
  const first = pay(store, b, { accountId: other.id, appliedCents: 8000, interestCents: 500, fineCents: 100, feeCents: 100, discountCents: 200, totalCents: 8700 })
  assert.equal(first.adjustmentCents, 200)
  assert.equal(balance(store, other.id), 91300)
  assert.equal(balance(store, account.id), 100000)
  assert.equal(store.snapshot().transactions.find(t => t.status === 'pending').amountCents, 12000)
  assert.deepEqual(store.payBill({ requestId: first.id, billId: b.id }), first)
  const second = pay(store, b)
  assert.equal(second.totalCents, 12000)
  assert.equal(store.snapshot().transactions.filter(t => t.status === 'pending').length, 0)
  assert.throws(() => pay(store, b), /valor válido/)
  assert.throws(() => store.undoPayment({ id: first.id }), /mais recente/)
  assert.throws(() => store.saveBill({ ...b, amountCents: 21000 }), /Desfaça/)
  assert.throws(() => store.deleteTransaction({ id: first.transactionId }), /Gerencie/)
  store.undoPayment({ id: second.id }); store.undoPayment({ id: first.id })
  assert.equal(balance(store, account.id), 100000); assert.equal(balance(store, other.id), 100000)
  assert.equal(store.snapshot().transactions.length, 1)
  assert.equal(store.snapshot().transactions[0].amountCents, 20000)
  store.cancelBill({ id: b.id, canceled: true }); assert.equal(store.snapshot().transactions.length, 0)
  store.cancelBill({ id: b.id, canceled: false }); assert.equal(store.snapshot().transactions.length, 1)
})

test('recorrência variável: desconhecido não é zero; previsões, pausa, retomada, datas e cancelamento preservados', t => {
  const { store, bill } = fixture(t)
  const template = store.saveCommitment({ ...bill, amountCents: null, startDate: '2026-01-31', endDate: '2026-04-30', estimateMode: 'average', paused: false })
  assert.equal(store.snapshot().transactions.length, 0)
  assert.deepEqual(store.snapshot().bills.map(b => b.dueDate), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  const [a, b, c] = store.snapshot().bills
  assert.throws(() => pay(store, a), /Confirme/)
  store.saveBill({ ...a, amountCents: 10000 }); store.saveBill({ ...b, amountCents: 20000 })
  store.atomic(() => store.materializeBills('2026-04-01'))
  assert.equal(store.snapshot().bills.find(row => row.id === c.id).estimateCents, 15000)
  store.cancelBill({ id: c.id, canceled: true })
  store.saveCommitment({ ...template, paused: true })
  const before = store.snapshot().bills
  store.atomic(() => store.materializeBills('2027-01-01'))
  assert.deepEqual(store.snapshot().bills, before)
  store.saveCommitment({ ...template, paused: false })
  assert.equal(store.snapshot().bills.find(row => row.id === c.id).canceled, true)
  assert.equal(shiftMonth('2024-01-31', 1), '2024-02-29')
})

test('validação é atômica e rejeita pagamento futuro, moeda errada, ajustes e referências inválidas', t => {
  const { store, bill, account } = fixture(t), b = store.saveBill(bill)
  const usd = store.saveAccount({ ...account, id: undefined, name: 'USD', currency: 'USD' })
  const before = store.snapshot()
  for (const input of [{ appliedCents: 20001 }, { accountId: usd.id }, { paidDate: '9999-01-01' }, { interestCents: -1 }, { totalCents: 1.5 }, { accountId: 'missing' }, { paidDate: '2026-02-30' }]) assert.throws(() => pay(store, b, input))
  assert.deepEqual(store.snapshot(), before)
  assert.throws(() => store.saveBill({ ...bill, amountCents: 0 }))
  assert.throws(() => store.saveBill({ ...bill, amountCents: 100, accountId: null }))
  assert.throws(() => store.saveBill({ ...bill, amountCents: null, dueDate: 'bad' }))
})

test('lançamento legado vira conta sem cópia, e edição em lote não rompe vínculo', t => {
  const { store, bill } = fixture(t)
  const result = store.saveTransaction({ description: bill.name, ...bill, type: 'expense', status: 'pending', seriesMode: 'recurring', count: 3 })
  const b = store.adoptBill({ id: result.ids[1] })
  assert.equal(store.snapshot().transactions.length, 3)
  assert.equal(store.adoptBill({ id: result.ids[1] }).id, b.id)
  assert.throws(() => store.deleteTransaction({ id: result.ids[0], scope: 'future' }), /Gerencie/)
  assert.throws(() => store.settleTransaction({ id: result.ids[1], paidDate: '2026-03-01' }), /Gerencie/)
  pay(store, b)
  assert.equal(store.snapshot().transactions.length, 3)
})

test('empréstimo: capital não é renda, amortização não é despesa, antecipação e saldo líquido', t => {
  const { store, loan, account } = fixture(t)
  const l = store.saveLoan({ ...loan, receiveFunds: true }), initial = store.snapshot()
  assert.equal(balance(store, account.id), 190000)
  assert.equal(initial.transactions.find(t => t.type === 'income').economicCents, 0)
  assert.equal(initial.bills.length, 2)
  const first = initial.bills[0], second = initial.bills[1]
  const p1 = pay(store, first, { appliedCents: 25000 })
  assert.equal(p1.principalCents, 22500)
  const p2 = pay(store, first), p3 = pay(store, second, { discountCents: 4000 })
  assert.equal(p2.principalCents, 22500); assert.equal(p3.principalCents, 45000)
  assert.equal(store.snapshot().payments.reduce((sum, p) => sum + p.principalCents, 0), l.openingBalanceCents)
  assert.equal(store.snapshot().transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.economicCents, 0), 5000)
  assert.equal(balance(store, account.id), 95000)
  assert.throws(() => store.cancelBill({ id: second.id, canceled: true }))
  store.undoPayment({ id: p3.id })
  assert.equal(store.snapshot().payments.reduce((sum, p) => sum + p.principalCents, 0), 45000)
  assert.throws(() => pay(store, second, { discountCents: 5000 }), /principal/)
})

test('cronograma incorreto não grava contrato, parcelas nem crédito', t => {
  const { store, loan } = fixture(t)
  const before = store.snapshot()
  assert.throws(() => store.saveLoan({ ...loan, receiveFunds: true, openingBalanceCents: 90001 }), /soma/)
  assert.deepEqual(store.snapshot(), before)
})

test('patrimônio, participação, avaliações, anexos e backup/restauração v3', t => {
  const { store, loan, directory } = fixture(t)
  const l = store.saveLoan(loan)
  const a = store.saveProperty({ name: 'Apartamento', kind: 'Imóvel', icon: 'home', currency: 'BRL', projectId: loan.projectId, acquisitionDate: '2026-01-01', acquisitionCents: 40000000, ownershipPercent: 50, loanId: l.id, notes: 'Compartilhado', valuations: [{ date: '2026-01-02', valueCents: 50000000, source: 'Estimativa' }] })
  const attachment = store.saveAttachment({ ownerType: 'property', ownerId: a.id, name: 'contrato.pdf', data: Buffer.from('%PDF-1.4\n teste').toString('base64') })
  assert.equal(store.snapshot().attachments.length, 1)
  assert.equal(store.snapshot().attachments[0].data, undefined)
  assert.throws(() => store.saveAttachment({ ownerType: 'property', ownerId: a.id, name: 'bad.exe', data: Buffer.from('bad').toString('base64') }))
  assert.throws(() => store.saveProperty({ ...a, id: undefined }), /vinculado/)
  assert.throws(() => store.saveProperty({ ...a, ownershipPercent: 101 }))
  const backup = join(directory, 'backup.sqlite'); store.backupTo(backup)
  store.saveProperty({ ...a, valuations: [...a.valuations, { date: '2026-02-01', valueCents: 52000000, source: 'Corretor' }] })
  store.deleteAttachment({ id: attachment.id }); store.restoreFrom(backup)
  assert.deepEqual(store.snapshot().assets[0], a)
  assert.equal(store.snapshot().attachments.length, 1)
  const corrupt = new DatabaseSync(backup)
  const b = store.snapshot().bills[0]
  corrupt.prepare('UPDATE bills SET value=? WHERE id=?').run(JSON.stringify({ ...b, pendingId: 'missing' }), b.id); corrupt.close()
  assert.throws(() => store.restoreFrom(backup), /encontrado/)
  assert.deepEqual(store.snapshot().assets[0], a)
})

test('migração v2 preserva tabelas anteriores e cria backup preventivo; restaura v2', t => {
  const { store, path, directory } = fixture(t)
  const previous = store.snapshot()
  store.db.exec('DROP TABLE credit_cards; DROP TABLE card_purchases; DROP TABLE card_statements; ALTER TABLE transactions DROP COLUMN paymentMethod; DROP TABLE attachments; DROP TABLE property_assets; DROP TABLE loans; DROP TABLE payments; DROP TABLE bills; DROP TABLE commitments; PRAGMA user_version=2;')
  const legacy = join(directory, 'legacy.sqlite'); store.backupTo(legacy); store.close()
  const upgraded = new FinanceStore(path)
  try {
    for (const key of ['accounts', 'projects', 'transactions', 'categories', 'transfers', 'investments']) assert.deepEqual(upgraded.snapshot()[key], previous[key])
    assert.equal(upgraded.db.prepare('PRAGMA user_version').get().user_version, 4)
    assert.ok(readdirSync(join(directory, 'backups')).some(name => name.startsWith('pre-v3-')))
    upgraded.restoreFrom(legacy)
    assert.deepEqual(upgraded.snapshot().accounts, previous.accounts)
    assert.deepEqual(upgraded.snapshot().bills, [])
  } finally { upgraded.close() }
})

test('recorrência com conta arquivada não bloqueia abertura do aplicativo', t => {
  const { store, bill, account } = fixture(t)
  store.saveCommitment({ ...bill, startDate: '2026-01-01', estimateMode: 'manual' })
  store.saveAccount({ ...account, archived: true })
  assert.doesNotThrow(() => store.atomic(() => store.materializeBills('2027-01-01')))
})

test('moeda de conta vinculada a fatura desconhecida é protegida; mudança de moeda do modelo não mistura previsões', t => {
  const { store, bill, account } = fixture(t)
  store.saveBill({ ...bill, amountCents: null })
  assert.throws(() => store.saveAccount({ ...account, currency: 'USD' }), /outra carteira/)
  const template = store.saveCommitment({ ...bill, amountCents: null, startDate: '2026-01-01', endDate: '2026-03-01', estimateMode: 'average' })
  const first = store.snapshot().bills.find(b => b.templateId === template.id)
  store.saveBill({ ...first, amountCents: 20000 })
  const us = store.saveAccount({ ...account, id: undefined, name: 'USD', currency: 'USD' })
  store.saveCommitment({ ...template, currency: 'USD', accountId: us.id, estimateCents: 500, endDate: '2026-04-01' })
  const last = store.snapshot().bills.filter(b => b.templateId === template.id).at(-1)
  assert.equal(last.currency, 'USD'); assert.equal(last.estimateCents, 500)
  assert.equal(store.snapshot().bills.find(b => b.id === first.id).currency, 'BRL')
})
