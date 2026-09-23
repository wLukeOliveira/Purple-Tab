import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync, readdirSync, writeFileSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { FinanceStore, addMonths } from '../electron/store.mjs'

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'purple-tab-store-test-'))
  const path = join(directory, 'finance.sqlite')
  const store = new FinanceStore({ path })
  t.after(() => { try { store.close() } catch { /* reopened/closed by test */ } rmSync(directory, { recursive: true, force: true }) })
  const initial = store.snapshot()
  const account = store.saveAccount({ name: 'Conta principal', institution: 'Banco', type: 'checking', initialBalanceCents: 100000, initialDate: '2026-01-01', archived: false })
  const personal = initial.projects[0]
  const income = initial.categories.find(row => row.type === 'income')
  const expense = initial.categories.find(row => row.type === 'expense')
  const base = { description: 'Teste', type: 'expense', amountCents: 10000, accountId: account.id, projectId: personal.id, categoryId: expense.id, subcategoryId: null, dueDate: '2026-01-31', paidDate: null, status: 'pending', notes: '' }
  return { store, directory, path, account, personal, income, expense, base }
}

function accountBalance(data, accountId) {
  const account = data.accounts.find(row => row.id === accountId)
  return data.transactions.filter(row => row.accountId === accountId && row.status === 'settled').reduce((sum, row) => sum + (row.type === 'income' ? row.amountCents : -row.amountCents), account.initialBalanceCents)
    + data.transfers.reduce((sum, row) => sum + (row.toAccountId === accountId ? row.amountCents : 0) - (row.fromAccountId === accountId ? row.amountCents : 0), 0)
}
const total = data => data.accounts.reduce((sum, account) => sum + accountBalance(data, account.id), 0)
const projectResult = (data, projectId) => data.transactions.filter(row => row.projectId === projectId && row.status === 'settled').reduce((sum, row) => sum + (row.type === 'income' ? row.amountCents : -row.amountCents), 0)
const records = data => ({ projects: data.projects, accounts: data.accounts, categories: data.categories, transactions: data.transactions, transfers: data.transfers, goals: data.goals, settings: data.settings })

test('aceite: cadastros, entradas/despesas, edição, previsão, pagamento, transferência, reinício e restore', t => {
  const { store, directory, path, account, personal, income, base } = fixture(t)
  assert.equal(store.snapshot().transactions.length, 0)
  const company = store.saveProject({ name: 'Empresa', color: '#7c3aed' })
  store.saveTransaction({ ...base, description: 'Venda', projectId: company.id, type: 'income', categoryId: income.id, amountCents: 200000, status: 'settled', paidDate: '2026-01-31' })
  const expenseId = store.saveTransaction({ ...base, description: 'Despesa', amountCents: 30000, status: 'settled', paidDate: '2026-01-31' }).ids[0]
  assert.equal(total(store.snapshot()), 270000)
  assert.equal(projectResult(store.snapshot(), company.id), 200000)
  assert.equal(projectResult(store.snapshot(), personal.id), -30000)
  store.saveTransaction({ ...store.snapshot().transactions.find(row => row.id === expenseId), amountCents: 35000 })
  assert.equal(total(store.snapshot()), 265000)
  const pendingId = store.saveTransaction({ ...base, amountCents: 50000, dueDate: '2026-02-20' }).ids[0]
  const pendingSnapshot = store.snapshot()
  assert.equal(total(pendingSnapshot), 265000)
  assert.equal(total(pendingSnapshot) - pendingSnapshot.transactions.filter(row => row.status === 'pending').reduce((sum, row) => sum + row.amountCents, 0), 215000)
  store.settleTransaction({ id: pendingId, paidDate: '2026-02-20' })
  store.settleTransaction({ id: pendingId, paidDate: '2026-02-20' })
  assert.equal(total(store.snapshot()), 215000)
  assert.equal(store.snapshot().transactions.length, 3)
  const savings = store.saveAccount({ name: 'Poupança', institution: '', type: 'savings', initialBalanceCents: 0, initialDate: '2026-01-01', archived: false })
  store.saveTransfer({ fromAccountId: account.id, toAccountId: savings.id, amountCents: 10000, date: '2026-02-20', notes: '' })
  assert.equal(accountBalance(store.snapshot(), account.id), 205000)
  assert.equal(accountBalance(store.snapshot(), savings.id), 10000)
  assert.equal(total(store.snapshot()), 215000)
  assert.equal(store.snapshot().transactions.length, 3)
  const installmentIds = store.saveTransaction({ ...base, seriesMode: 'installments', count: 3 }).ids
  const installments = store.snapshot().transactions.filter(row => installmentIds.includes(row.id))
  assert.deepEqual(installments.map(row => row.amountCents), [3334, 3333, 3333])
  assert.equal(installments.reduce((sum, row) => sum + row.amountCents, 0), 10000)
  assert.deepEqual(installments.map(row => row.dueDate), ['2026-01-31', '2026-02-28', '2026-03-31'])
  store.saveSettings({ openTabs: ['geral', company.id], activeTab: company.id, screen: 'history', profileName: 'Luke', compact: true })
  store.saveGoal({ name: 'Economizar', projectId: company.id, targetCents: 100000, startDate: '2026-01-01', endDate: '2026-12-31' })
  const before = records(store.snapshot())
  store.close()
  store.db = new DatabaseSync(path)
  store.configure()
  store.migrate()
  assert.deepEqual(records(store.snapshot()), before)
  const backup = join(directory, 'manual.sqlite')
  store.backupTo(backup)
  assert.ok(existsSync(backup))
  store.saveTransaction({ ...base, description: 'Extra após backup' })
  store.saveSettings({ profileName: 'Alterado' })
  const result = store.restoreFrom(backup)
  assert.ok(existsSync(result.preventiveBackup))
  assert.deepEqual(records(store.snapshot()), before)
  assert.equal(total(store.snapshot()), 215000)
})

test('validadores recusam dinheiro fracionário, datas impossíveis, referências e status inconsistentes sem gravação parcial', t => {
  const { store, base, account, directory } = fixture(t)
  for (const patch of [{ amountCents: 1.5 }, { amountCents: 0 }, { amountCents: Number.MAX_SAFE_INTEGER + 1 }, { dueDate: '2026-02-30' }, { dueDate: '2025-12-31' }, { projectId: 'missing' }, { accountId: 'missing' }, { status: 'settled', paidDate: null }, { status: 'pending', paidDate: '2026-01-31' }]) assert.throws(() => store.saveTransaction({ ...base, ...patch }))
  assert.throws(() => store.saveTransaction({ ...base, type: 'income' }), /categoria/i)
  assert.throws(() => store.saveTransaction({ ...base, seriesMode: 'installments', count: 3, amountCents: 2 }), /centavo/)
  assert.throws(() => store.saveTransaction({ ...base, seriesMode: 'recurring', count: 361 }), /quantidade/)
  assert.throws(() => store.saveTransaction({ ...base, dueDate: '9999-12-31', seriesMode: 'recurring', count: 2 }))
  assert.equal(store.snapshot().transactions.length, 0)
  assert.equal(store.db.prepare('SELECT count(*) AS count FROM series').get().count, 0)
  assert.throws(() => store.saveTransfer({ fromAccountId: account.id, toAccountId: 'missing', amountCents: 100, date: '2026-01-02', notes: '' }))
  assert.throws(() => store.saveTransfer({ fromAccountId: account.id, toAccountId: account.id, amountCents: 100, date: '2026-01-02', notes: '' }))
  assert.equal(store.snapshot().transfers.length, 0)
  assert.throws(() => store.backupTo(store.path))
  assert.throws(() => store.restoreFrom(join(directory, 'absent.sqlite')))
})

test('recorrência repete o valor, edição/exclusão futura preserva realizadas e alterações são atômicas', t => {
  const { store, base } = fixture(t)
  const ids = store.saveTransaction({ ...base, seriesMode: 'recurring', count: 5 }).ids
  assert.deepEqual(store.snapshot().transactions.map(row => row.amountCents), Array(5).fill(10000))
  store.settleTransaction({ id: ids[2], paidDate: '2026-03-31' })
  const paid = store.snapshot().transactions.find(row => row.id === ids[2])
  const second = store.snapshot().transactions.find(row => row.id === ids[1])
  store.saveTransaction({ ...second, scope: 'future', description: 'Reajustado', amountCents: 11000, dueDate: '2026-02-20' })
  const edited = store.snapshot().transactions
  assert.equal(edited[0].amountCents, 10000)
  assert.equal(edited[1].amountCents, 11000)
  assert.deepEqual(edited[2], paid)
  assert.equal(edited[3].dueDate, '2026-04-20')
  assert.equal(edited[4].dueDate, '2026-05-20')
  assert.throws(() => store.saveTransaction({ ...paid, scope: 'future', amountCents: 12000 }), /realizado/)
  assert.throws(() => store.deleteTransaction({ id: paid.id, scope: 'future' }), /realizado/)
  store.deleteTransaction({ id: ids[1], scope: 'future' })
  assert.deepEqual(store.snapshot().transactions.map(row => row.id), [ids[0], ids[2]])
  store.deleteTransaction({ id: ids[0], scope: 'one' })
  store.deleteTransaction({ id: ids[2], scope: 'one' })
  assert.equal(store.snapshot().transactions.length, 0)
  assert.equal(store.db.prepare('SELECT count(*) AS count FROM series').get().count, 0)
  // A failure during the second insert must roll back both the first insert and the series.
  store.db.exec(`CREATE TRIGGER fail_second BEFORE INSERT ON transactions WHEN NEW.occurrenceIndex=1 BEGIN SELECT RAISE(ABORT, 'test rollback'); END`)
  assert.throws(() => store.saveTransaction({ ...base, seriesMode: 'recurring', count: 3 }), /test rollback/)
  assert.equal(store.snapshot().transactions.length, 0)
  assert.equal(store.db.prepare('SELECT count(*) AS count FROM series').get().count, 0)
})

test('arquivar preserva histórico, fecha a aba e impede novos usos; categorias respeitam vínculo e hierarquia', t => {
  const { store, base, personal, expense, income, account } = fixture(t)
  const subcategory = store.saveCategory({ name: 'Internet', type: 'expense', parentId: expense.id, archived: false })
  const saved = store.saveTransaction({ ...base, subcategoryId: subcategory.id }).ids[0]
  assert.throws(() => store.saveCategory({ ...subcategory, parentId: income.id }), /mesmo tipo/)
  assert.throws(() => store.saveCategory({ ...subcategory, parentId: null }), /utilizado/)
  assert.throws(() => store.saveCategory({ name: 'Neto', type: 'expense', parentId: subcategory.id }), /principal/)
  assert.throws(() => store.saveTransaction({ ...base, categoryId: subcategory.id }), /principal/)
  store.saveSettings({ activeTab: personal.id })
  store.saveProject({ ...personal, archived: true })
  assert.deepEqual(store.snapshot().settings.openTabs, ['geral'])
  assert.equal(store.snapshot().settings.activeTab, 'geral')
  assert.equal(store.snapshot().transactions.length, 1)
  assert.throws(() => store.saveTransaction(base), /arquivado/)
  store.saveTransaction({ ...store.snapshot().transactions[0], amountCents: 12345 })
  store.settleTransaction({ id: saved, paidDate: '2026-01-31' })
  store.saveAccount({ ...account, archived: true })
  assert.throws(() => store.saveAccount({ ...account, initialDate: '2026-02-01' }), /anterior/)
  store.saveProject({ ...personal, archived: false })
  assert.throws(() => store.saveTransaction(base), /arquivado/)
  store.saveAccount({ ...account, archived: false })
  store.saveCategory({ ...expense, archived: true })
  assert.throws(() => store.saveTransaction(base), /arquivado/)
  store.saveCategory({ ...expense, archived: false })
  store.saveTransaction(base)
  assert.equal(store.snapshot().transactions.length, 2)
})

test('backups inválidos não mudam a base: arquivo aleatório, schema adulterado, dados inválidos e versão futura', t => {
  const { store, directory, base } = fixture(t)
  store.saveTransaction(base)
  const expected = records(store.snapshot())
  const original = join(directory, 'original.sqlite')
  store.backupTo(original)
  const invalid = join(directory, 'invalid.sqlite')
  writeFileSync(invalid, 'não é SQLite')
  assert.throws(() => store.restoreFrom(invalid), /restaurar/)
  const mutate = (name, query) => {
    const target = join(directory, name)
    copyFileSync(original, target)
    const db = new DatabaseSync(target)
    db.exec(query)
    db.close()
    assert.throws(() => store.restoreFrom(target), /restaurar/)
    assert.deepEqual(records(store.snapshot()), expected)
  }
  mutate('schema.sqlite', 'CREATE TABLE unsolicited (name TEXT)')
  mutate('future.sqlite', 'PRAGMA user_version=999')
  mutate('dates.sqlite', "UPDATE transactions SET dueDate='2026-02-30'")
  mutate('settings.sqlite', `UPDATE settings SET value='{}'`)
  mutate('unknown.sqlite', `UPDATE app_meta SET value='other-app' WHERE key='application'`)
  assert.deepEqual(records(store.snapshot()), expected)
  assert.equal(existsSync(store.backupDirectory), false)
})

test('backup WAL inclui dados confirmados, pode sobrescrever destino e automático limita retenção', t => {
  const { store, directory, base } = fixture(t)
  const backup = join(directory, 'wal.sqlite')
  store.backupTo(backup)
  store.saveTransaction(base)
  store.backupTo(backup)
  const restored = new FinanceStore(join(directory, 'second.sqlite'))
  try {
    restored.restoreFrom(backup)
    assert.equal(restored.snapshot().transactions.length, 1)
  } finally { restored.close() }
  store.automaticBackup()
  assert.equal(store.automaticBackup().skipped, true)
  for (let day = 1; day <= 20; day++) copyFileSync(backup, join(store.backupDirectory, `auto-2000-01-${String(day).padStart(2, '0')}.sqlite`))
  const currentBackup = join(store.backupDirectory, `auto-${new Date().toISOString().slice(0, 10)}.sqlite`)
  rmSync(currentBackup)
  store.automaticBackup()
  assert.equal(readdirSync(store.backupDirectory).filter(name => /^auto-/.test(name)).length, 14)
  assert.ok(store.snapshot().meta.lastBackup)
})

test('datas mensais mantêm o dia original quando possível e respeitam ano bissexto', () => {
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29')
  assert.equal(addMonths('2024-01-31', 2), '2024-03-31')
  assert.equal(addMonths('2026-12-31', 1), '2027-01-31')
  assert.equal(addMonths('2026-01-30', 1), '2026-02-28')
})

test('editar descrição da série preserva centavos das parcelas e vencimentos no fim do mês', t => {
  const { store, base } = fixture(t)
  store.saveTransaction({ ...base, seriesMode: 'installments', count: 3 })
  const first = store.snapshot().transactions[0]
  store.saveTransaction({ ...first, description: 'Descrição corrigida', scope: 'future' })
  assert.deepEqual(store.snapshot().transactions.map(row => row.amountCents), [3334, 3333, 3333])
  const second = store.snapshot().transactions[1]
  store.saveTransaction({ ...second, description: 'Outra descrição', scope: 'future' })
  assert.deepEqual(store.snapshot().transactions.map(row => row.dueDate), ['2026-01-31', '2026-02-28', '2026-03-31'])
})

test('preferências, metas e operações de remoção validam destinos e períodos', t => {
  const { store, personal, account } = fixture(t)
  assert.throws(() => store.saveSettings({ openTabs: [personal.id, 'geral'] }), /Geral/)
  assert.throws(() => store.saveSettings({ openTabs: ['geral', 'geral'] }), /repetições/)
  assert.throws(() => store.saveSettings({ activeTab: 'missing' }), /aberta/)
  assert.throws(() => store.saveSettings({ screen: 'other' }), /Tela/)
  assert.throws(() => store.saveGoal({ name: 'Inválida', projectId: null, targetCents: 100, startDate: '2026-03-01', endDate: '2026-02-01' }), /fim/)
  const goal = store.saveGoal({ name: 'Meta', projectId: personal.id, targetCents: 10000, startDate: '2026-01-01', endDate: '2026-12-31' })
  store.saveGoal({ ...goal, targetCents: 12000 })
  assert.equal(store.snapshot().goals[0].targetCents, 12000)
  store.deleteGoal({ id: goal.id })
  assert.equal(store.snapshot().goals.length, 0)
  const other = store.saveAccount({ ...account, id: undefined, name: 'Outra', initialBalanceCents: 0 })
  const transfer = store.saveTransfer({ fromAccountId: account.id, toAccountId: other.id, amountCents: 1000, date: '2026-03-01', notes: 'Teste' })
  store.saveTransfer({ ...transfer, amountCents: 2000 })
  assert.equal(store.snapshot().transfers[0].amountCents, 2000)
  store.deleteTransfer({ id: transfer.id })
  assert.equal(store.snapshot().transfers.length, 0)
})

test('pagamentos/recebimentos e transferências futuros são recusados mesmo via API; vencimentos futuros são permitidos', t => {
  const { store, base, account } = fixture(t)
  const future = new Date()
  future.setDate(future.getDate() + 1)
  const tomorrow = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`
  assert.throws(() => store.saveTransaction({ ...base, status: 'settled', paidDate: tomorrow }), /futura/)
  const entry = store.saveTransaction({ ...base, dueDate: tomorrow }).ids[0]
  assert.throws(() => store.settleTransaction({ id: entry, paidDate: tomorrow }), /futura/)
  assert.equal(store.snapshot().transactions[0].status, 'pending')
  const other = store.saveAccount({ ...account, id: undefined, name: 'Outra' })
  assert.throws(() => store.saveTransfer({ fromAccountId: account.id, toAccountId: other.id, amountCents: 100, date: tomorrow, notes: '' }), /futura/)
  assert.equal(store.snapshot().transfers.length, 0)
})
