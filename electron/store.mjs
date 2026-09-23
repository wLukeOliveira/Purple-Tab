import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { mkdirSync, existsSync, renameSync, rmSync, readdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { currency, icon, investmentInput } from './investments.mjs'
import { PLANNING_SCHEMA, planningMethods, planningSnapshot, assertUnmanaged, validatePlanning } from './planning.mjs'
import { CARDS_SCHEMA, cardMethods, cardSnapshot, validateCards } from './cards.mjs'

const VERSION = 4
const APPLICATION_ID = 0x50544231
const MARKER = 'purple-tab-finance'
const MAX_MONEY = Number.MAX_SAFE_INTEGER
const SCREENS = ['home', 'history', 'comparison', 'reports', 'creation', 'achievements', 'settings', 'investments', 'bills', 'loans', 'patrimony', 'cards']
const MIGRATION_2 = `
ALTER TABLE projects ADD COLUMN icon TEXT NOT NULL DEFAULT 'folder';
ALTER TABLE accounts ADD COLUMN currency TEXT NOT NULL DEFAULT 'BRL';
ALTER TABLE accounts ADD COLUMN icon TEXT NOT NULL DEFAULT '';
ALTER TABLE transfers ADD COLUMN receivedCents INTEGER;
UPDATE transfers SET receivedCents=amountCents;
CREATE TABLE investments (id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE market_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
`
const SCHEMA = `
CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), createdAt TEXT NOT NULL
) STRICT;
CREATE TABLE accounts (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, institution TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('checking','savings','cash','investment')),
  initialBalanceCents INTEGER NOT NULL CHECK(abs(initialBalanceCents) <= 9007199254740991), initialDate TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))
) STRICT;
CREATE TABLE categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('income','expense')),
  parentId TEXT REFERENCES categories(id), archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), CHECK(parentId IS NULL OR parentId != id)
) STRICT;
CREATE TABLE series (
  id TEXT PRIMARY KEY, mode TEXT NOT NULL CHECK(mode IN ('installments','recurring')), count INTEGER NOT NULL CHECK(count BETWEEN 2 AND 360), createdAt TEXT NOT NULL
) STRICT;
CREATE TABLE transactions (
  id TEXT PRIMARY KEY, description TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('income','expense')),
  amountCents INTEGER NOT NULL CHECK(amountCents BETWEEN 1 AND 9007199254740991),
  accountId TEXT NOT NULL REFERENCES accounts(id), projectId TEXT NOT NULL REFERENCES projects(id),
  categoryId TEXT NOT NULL REFERENCES categories(id), subcategoryId TEXT REFERENCES categories(id),
  dueDate TEXT NOT NULL, paidDate TEXT, status TEXT NOT NULL CHECK(status IN ('pending','settled')), notes TEXT NOT NULL,
  seriesId TEXT REFERENCES series(id), occurrenceIndex INTEGER,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
  CHECK((status = 'pending' AND paidDate IS NULL) OR (status = 'settled' AND paidDate IS NOT NULL)),
  CHECK((seriesId IS NULL AND occurrenceIndex IS NULL) OR (seriesId IS NOT NULL AND occurrenceIndex >= 0)),
  UNIQUE(seriesId, occurrenceIndex)
) STRICT;
CREATE TABLE transfers (
  id TEXT PRIMARY KEY, fromAccountId TEXT NOT NULL REFERENCES accounts(id), toAccountId TEXT NOT NULL REFERENCES accounts(id),
  amountCents INTEGER NOT NULL CHECK(amountCents BETWEEN 1 AND 9007199254740991), date TEXT NOT NULL, notes TEXT NOT NULL,
  CHECK(fromAccountId != toAccountId)
) STRICT;
CREATE TABLE goals (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, projectId TEXT REFERENCES projects(id),
  targetCents INTEGER NOT NULL CHECK(targetCents BETWEEN 1 AND 9007199254740991), startDate TEXT NOT NULL, endDate TEXT NOT NULL
) STRICT;
CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id = 1), value TEXT NOT NULL) STRICT;
CREATE INDEX transactions_dates ON transactions(dueDate, paidDate);
CREATE INDEX transactions_project ON transactions(projectId);
CREATE INDEX transactions_account ON transactions(accountId);
`

function fail(message) { throw new Error(message) }
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Dados inválidos.')
  return value
}
function text(value, label, max = 160, optional = false) {
  if (optional && (value === undefined || value === null)) return ''
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.trim().length > max) fail(`${label}: informe um texto válido de até ${max} caracteres.`)
  return value.trim()
}
function choice(value, allowed, label) {
  if (!allowed.includes(value)) fail(`${label} inválido.`)
  return value
}
function boolean(value, fallback = false) {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') fail('Informe verdadeiro ou falso.')
  return value
}
function money(value, label = 'Valor', allowNegative = false) {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_MONEY || (!allowNegative && value <= 0)) fail(`${label}: informe um valor válido em centavos.`)
  return value
}
export function validDate(value, label = 'Data') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31') fail(`${label} inválida.`)
  const parsed = new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(`${label} inválida.`)
  return value
}
export function addMonths(date, months) {
  validDate(date)
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1, 12))
  const lastDay = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0, 12)).getUTCDate()
  shifted.setUTCDate(Math.min(day, lastDay))
  return validDate(shifted.toISOString().slice(0, 10))
}
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) fail('Registro com data de criação inválida.')
}
function cleanRow(row) {
  if (!row) return row
  const result = { ...row }
  if ('archived' in result) result.archived = Boolean(result.archived)
  return result
}
const now = () => new Date().toISOString()
const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const key = () => randomUUID()
const normalizeSql = sql => sql.replace(/\s+/g, ' ').trim().replace(/;$/, '')

/** SQLite is owned exclusively by Electron's main process. Every write validates its input. */
export class FinanceStore {
  constructor(pathOrOptions) {
    const selected = typeof pathOrOptions === 'string' ? pathOrOptions : pathOrOptions?.path
    if (typeof selected !== 'string' || !selected) fail('Informe o caminho do banco de dados.')
    this.path = selected === ':memory:' ? selected : resolve(selected)
    this.backupDirectory = join(dirname(this.path), 'backups')
    if (this.path !== ':memory:') mkdirSync(dirname(this.path), { recursive: true })
    this.db = new DatabaseSync(this.path)
    try {
      this.configure()
      this.migrate()
      this.upgrade()
    } catch (error) {
      this.db.close()
      throw error
    }
  }

  configure() {
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA trusted_schema=OFF;')
  }

  migrate() {
    this.wasCreated = false
    const version = this.db.prepare('PRAGMA user_version').get().user_version
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
    if (version === 0 && tables.length === 0) {
      this.wasCreated = true
      this.atomic(() => {
        this.db.exec(SCHEMA)
        this.db.exec(`PRAGMA application_id=${APPLICATION_ID}; PRAGMA user_version=1;`)
        this.db.prepare('INSERT INTO app_meta VALUES (?,?)').run('application', MARKER)
        const projectId = key()
        this.db.prepare('INSERT INTO projects VALUES (?,?,?,?,?)').run(projectId, 'Pessoal', '#9b72f5', 0, now())
        for (const [name, type] of [['Salário', 'income'], ['Vendas', 'income'], ['Outras receitas', 'income'], ['Moradia', 'expense'], ['Alimentação', 'expense'], ['Transporte', 'expense'], ['Saúde', 'expense'], ['Lazer', 'expense'], ['Outras despesas', 'expense']]) {
          this.db.prepare('INSERT INTO categories VALUES (?,?,?,?,?)').run(key(), name, type, null, 0)
        }
        this.db.prepare('INSERT INTO settings VALUES (1,?)').run(JSON.stringify({ profileName: 'Meu perfil', openTabs: ['geral', projectId], activeTab: 'geral', screen: 'home', compact: false }))
      })
    } else {
      if (![1, 2, 3, VERSION].includes(version)) fail('Versão do banco incompatível. Abra o banco com a versão correspondente do Purple Tab.')
      const app = this.db.prepare('PRAGMA application_id').get().application_id
      if (app !== APPLICATION_ID || this.db.prepare("SELECT value FROM app_meta WHERE key='application'").get()?.value !== MARKER) fail('Este arquivo não é um banco do Purple Tab.')
    }
  }

  upgrade() {
    if (this.db.prepare('PRAGMA user_version').get().user_version === 1) {
      if (this.path !== ':memory:' && !this.wasCreated) this.backupTo(join(this.backupDirectory, `pre-v2-${key()}.sqlite`))
      this.atomic(() => this.db.exec(`${MIGRATION_2} PRAGMA user_version=2;`))
    }
    if (this.db.prepare('PRAGMA user_version').get().user_version === 2) {
      if (this.path !== ':memory:' && !this.wasCreated) this.backupTo(join(this.backupDirectory, `pre-v3-${key()}.sqlite`))
      this.atomic(() => this.db.exec(`${PLANNING_SCHEMA} PRAGMA user_version=3;`))
    }
    if (this.db.prepare('PRAGMA user_version').get().user_version === 3) {
      if (this.path !== ':memory:' && !this.wasCreated) this.backupTo(join(this.backupDirectory, `pre-v4-${key()}.sqlite`))
      this.atomic(() => this.db.exec(`${CARDS_SCHEMA} PRAGMA user_version=4;`))
    }
  }

  atomic(callback) {
    const depth = this.atomicDepth || 0
    const savepoint = `purple_nested_${depth}`
    this.db.exec(depth ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE')
    this.atomicDepth = depth + 1
    try {
      const result = callback()
      this.db.exec(depth ? `RELEASE ${savepoint}` : 'COMMIT')
      return result
    } catch (error) {
      this.db.exec(depth ? `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}` : 'ROLLBACK')
      throw error
    } finally { this.atomicDepth = depth }
  }

  row(table, id) {
    // table is always a hardcoded internal identifier; user-controlled values are bound.
    return cleanRow(this.db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(text(id, 'Identificador', 80)))
  }

  existing(table, id, label) {
    const row = this.row(table, id)
    if (!row) fail(`${label} não encontrado.`)
    return row
  }

  reference(table, id, label, oldId) {
    const row = this.existing(table, id, label)
    if (row.archived && id !== oldId) fail(`${label} arquivado. Reative o cadastro antes de usá-lo.`)
    return row
  }

  snapshot() {
    const all = table => this.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map(cleanRow)
    const legacy = this.db.prepare('PRAGMA user_version').get().user_version === 1
    return {
      projects: all('projects'), accounts: all('accounts'), categories: all('categories'),
      transactions: all('transactions'), transfers: all('transfers'), goals: all('goals'),
      ...(this.db.prepare('PRAGMA user_version').get().user_version >= 3 ? planningSnapshot(this, all('transactions')) : {}),
      ...(this.db.prepare('PRAGMA user_version').get().user_version >= 4 ? cardSnapshot(this) : {}),
      investments: legacy ? [] : all('investments').map(row => JSON.parse(row.value)),
      market: legacy ? {} : Object.fromEntries(all('market_cache').map(row => [row.key, JSON.parse(row.value)])),
      settings: JSON.parse(this.db.prepare('SELECT value FROM settings WHERE id=1').get().value),
      meta: { databasePath: this.path, lastBackup: this.db.prepare("SELECT value FROM app_meta WHERE key='last_backup'").get()?.value ?? null, appVersion: '0.4.3' },
    }
  }

  saveProject(input) {
    object(input)
    const old = input.id ? this.existing('projects', input.id, 'Projeto') : null
    const row = { id: old?.id ?? key(), name: text(input.name, 'Nome do projeto'), color: text(input.color, 'Cor', 7), icon: icon(input.icon ?? old?.icon ?? 'folder'), archived: boolean(input.archived, old?.archived), createdAt: old?.createdAt ?? now() }
    if (!/^#[0-9a-f]{6}$/i.test(row.color)) fail('Selecione uma cor válida para o projeto.')
    return this.atomic(() => {
      this.db.prepare(`INSERT INTO projects (id,name,color,archived,createdAt,icon) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,color=excluded.color,archived=excluded.archived,icon=excluded.icon`).run(row.id, row.name, row.color, Number(row.archived), row.createdAt, row.icon)
      if (row.archived) {
        const settings = this.snapshot().settings
        settings.openTabs = settings.openTabs.filter(id => id !== row.id)
        if (settings.activeTab === row.id) settings.activeTab = 'geral'
        this.writeSettings(settings)
      }
      return row
    })
  }

  saveAccount(input) {
    object(input)
    const old = input.id ? this.existing('accounts', input.id, 'Conta') : null
    const row = { id: old?.id ?? key(), name: text(input.name, 'Nome da conta'), institution: text(input.institution, 'Instituição', 160, true), type: choice(input.type, ['checking', 'savings', 'cash', 'investment'], 'Tipo de conta'), initialBalanceCents: money(input.initialBalanceCents, 'Saldo inicial', true), initialDate: validDate(input.initialDate, 'Data inicial'), archived: boolean(input.archived, old?.archived) }
    row.currency = currency(input.currency ?? old?.currency)
    row.icon = icon(input.icon ?? old?.icon)
    if (old && old.currency !== row.currency && this.snapshot().creditCards?.some(c => c.accountId === row.id)) fail('A conta é usada por um cartão. Crie outra carteira para mudar de moeda.')
    if (old && old.currency !== row.currency && [this.snapshot().commitments, this.snapshot().bills, this.snapshot().loans].some(rows => rows?.some(t => t.accountId === row.id))) fail('A conta possui compromissos ou contratos. Crie outra carteira para mudar de moeda.')
    if (old && old.currency !== row.currency && (this.db.prepare('SELECT id FROM transactions WHERE accountId=? LIMIT 1').get(row.id) || this.db.prepare('SELECT id FROM transfers WHERE fromAccountId=? OR toAccountId=? LIMIT 1').get(row.id,row.id) || this.snapshot().investments.some(item => item.accountId === row.id))) fail('Crie outra carteira para mudar a moeda de uma conta já utilizada.')
    const earlier = this.db.prepare(`SELECT id FROM transactions WHERE accountId=? AND (dueDate<? OR paidDate<?) UNION ALL SELECT id FROM transfers WHERE (fromAccountId=? OR toAccountId=?) AND date<? LIMIT 1`).get(row.id, row.initialDate, row.initialDate, row.id, row.id, row.initialDate)
    if (earlier) fail('A data inicial deve ser igual ou anterior aos lançamentos e transferências da conta.')
    this.db.prepare(`INSERT INTO accounts (id,name,institution,type,initialBalanceCents,initialDate,archived,currency,icon) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,institution=excluded.institution,type=excluded.type,initialBalanceCents=excluded.initialBalanceCents,initialDate=excluded.initialDate,archived=excluded.archived,currency=excluded.currency,icon=excluded.icon`).run(row.id, row.name, row.institution, row.type, row.initialBalanceCents, row.initialDate, Number(row.archived), row.currency, row.icon)
    return row
  }

  saveCategory(input) {
    object(input)
    const old = input.id ? this.existing('categories', input.id, 'Categoria') : null
    const row = { id: old?.id ?? key(), name: text(input.name, 'Nome da categoria'), type: choice(input.type, ['income', 'expense'], 'Tipo de categoria'), parentId: input.parentId || null, archived: boolean(input.archived, old?.archived) }
    if (row.parentId) {
      if (row.parentId === row.id) fail('Uma categoria não pode ser sua própria subcategoria.')
      const parent = this.reference('categories', row.parentId, 'Categoria principal', old?.parentId)
      if (parent.parentId || parent.type !== row.type) fail('A subcategoria precisa de uma categoria principal do mesmo tipo.')
    }
    if (old && (old.type !== row.type || old.parentId !== row.parentId)) {
      if (this.db.prepare('SELECT id FROM transactions WHERE categoryId=? OR subcategoryId=? LIMIT 1').get(row.id, row.id) || this.db.prepare('SELECT id FROM categories WHERE parentId=? LIMIT 1').get(row.id)) fail('O tipo e a categoria principal não podem mudar após o cadastro ser utilizado. Crie outra categoria.')
    }
    this.db.prepare(`INSERT INTO categories VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,parentId=excluded.parentId,archived=excluded.archived`).run(row.id, row.name, row.type, row.parentId, Number(row.archived))
    return row
  }

  transactionInput(input, old = null, permitArchived = false) {
    object(input)
    const row = {
      id: old?.id ?? key(), description: text(input.description, 'Descrição', 300), type: choice(input.type, ['income', 'expense'], 'Tipo de lançamento'),
      amountCents: money(input.amountCents), accountId: text(input.accountId, 'Conta', 80), projectId: text(input.projectId, 'Projeto', 80), categoryId: text(input.categoryId, 'Categoria', 80),
      subcategoryId: input.subcategoryId || null, dueDate: validDate(input.dueDate, 'Vencimento'),
      status: choice(input.status, ['pending', 'settled'], 'Situação'), paidDate: null, notes: text(input.notes, 'Observação', 4000, true),
      seriesId: old?.seriesId ?? null, occurrenceIndex: old?.occurrenceIndex ?? null, createdAt: old?.createdAt ?? now(), updatedAt: now(),
      paymentMethod: choice(input.paymentMethod ?? old?.paymentMethod ?? 'other', ['other','debit','credit','pix','cash','bank_slip'], 'Forma de pagamento'),
    }
    if (row.status === 'settled') {
      row.paidDate = validDate(input.paidDate, 'Data de pagamento/recebimento')
      if (row.paidDate > today()) fail('A data do pagamento/recebimento não pode ser futura. Mantenha o lançamento pendente até a efetivação.')
    }
    else if (input.paidDate !== undefined && input.paidDate !== null && input.paidDate !== '') fail('Um lançamento pendente não pode ter data de pagamento/recebimento.')
    const previous = permitArchived ? row : old
    const account = this.reference('accounts', row.accountId, 'Conta', previous?.accountId)
    this.reference('projects', row.projectId, 'Projeto', previous?.projectId)
    const category = this.reference('categories', row.categoryId, 'Categoria', previous?.categoryId)
    if (category.type !== row.type || category.parentId) fail('Escolha uma categoria principal do mesmo tipo do lançamento.')
    if (row.subcategoryId) {
      const subcategory = this.reference('categories', row.subcategoryId, 'Subcategoria', previous?.subcategoryId)
      if (subcategory.parentId !== row.categoryId || subcategory.type !== row.type) fail('A subcategoria não pertence à categoria selecionada.')
    }
    if (row.dueDate < account.initialDate || (row.paidDate && row.paidDate < account.initialDate)) fail('As datas do lançamento não podem ser anteriores à data inicial da conta.')
    return row
  }

  writeTransaction(row) {
    this.db.prepare(`INSERT INTO transactions (id,description,type,amountCents,accountId,projectId,categoryId,subcategoryId,dueDate,paidDate,status,notes,seriesId,occurrenceIndex,createdAt,updatedAt,paymentMethod) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET description=excluded.description,type=excluded.type,amountCents=excluded.amountCents,accountId=excluded.accountId,projectId=excluded.projectId,categoryId=excluded.categoryId,subcategoryId=excluded.subcategoryId,dueDate=excluded.dueDate,paidDate=excluded.paidDate,status=excluded.status,notes=excluded.notes,updatedAt=excluded.updatedAt,paymentMethod=excluded.paymentMethod`).run(row.id, row.description, row.type, row.amountCents, row.accountId, row.projectId, row.categoryId, row.subcategoryId, row.dueDate, row.paidDate, row.status, row.notes, row.seriesId, row.occurrenceIndex, row.createdAt, row.updatedAt, row.paymentMethod ?? 'other')
  }

  saveTransaction(input) {
    object(input)
    if (input.paymentMethod === 'credit') fail('Registre compras no crédito com um cartão e uma fatura pela área Cartões.')
    const scope = choice(input.scope ?? 'one', ['one', 'future'], 'Escopo')
    const mode = choice(input.seriesMode ?? 'single', ['single', 'installments', 'recurring'], 'Repetição')
    const old = input.id ? this.existing('transactions', input.id, 'Lançamento') : null
    if (old) assertUnmanaged(this, [old.id])
    const first = this.transactionInput(input, old)
    if (old) {
      if (mode !== 'single') fail('A repetição só pode ser definida ao criar um lançamento.')
      if (scope === 'future' && old.status !== 'pending') fail('Para alterar um lançamento já realizado, escolha somente esta ocorrência.')
      const affected = scope === 'future' && old.seriesId ? this.db.prepare("SELECT * FROM transactions WHERE seriesId=? AND occurrenceIndex>=? AND status='pending' ORDER BY occurrenceIndex").all(old.seriesId, old.occurrenceIndex).map(cleanRow) : [old]
      assertUnmanaged(this, affected.map(row => row.id))
      if (scope === 'future' && input.status !== 'pending') fail('Efetive cada ocorrência individualmente para registrar a data correta.')
      const updates = affected.map(row => this.transactionInput({
        ...input,
        // Editing a description must preserve short-month dates and the remainder cents of installments.
        amountCents: input.amountCents === old.amountCents ? row.amountCents : input.amountCents,
        dueDate: input.dueDate === old.dueDate ? row.dueDate : addMonths(input.dueDate, (row.occurrenceIndex ?? 0) - (old.occurrenceIndex ?? 0)),
      }, row))
      return this.atomic(() => { updates.forEach(row => this.writeTransaction(row)); return { ids: updates.map(row => row.id) } })
    }
    if (scope !== 'one') fail('O escopo de edição só pode ser usado em lançamentos existentes.')
    const count = mode === 'single' ? 1 : input.count
    if (!Number.isInteger(count) || count < (mode === 'single' ? 1 : 2) || count > 360) fail('Informe uma quantidade entre 2 e 360 ocorrências.')
    if (mode === 'installments' && input.amountCents < count) fail('O total precisa permitir pelo menos um centavo por parcela.')
    const seriesId = count > 1 ? key() : null
    const entries = Array.from({ length: count }, (_, index) => {
      const amountCents = mode === 'installments' ? Math.floor(input.amountCents / count) + (index < input.amountCents % count ? 1 : 0) : input.amountCents
      const row = this.transactionInput({ ...input, amountCents, dueDate: addMonths(input.dueDate, index), status: index === 0 ? input.status : 'pending', paidDate: index === 0 ? input.paidDate : null })
      return { ...row, id: index === 0 ? first.id : row.id, seriesId, occurrenceIndex: seriesId ? index : null }
    })
    return this.atomic(() => {
      if (seriesId) this.db.prepare('INSERT INTO series VALUES (?,?,?,?)').run(seriesId, mode, count, now())
      entries.forEach(row => this.writeTransaction(row))
      return { ids: entries.map(row => row.id), seriesId }
    })
  }

  deleteTransaction(input) {
    object(input)
    const old = this.existing('transactions', input.id, 'Lançamento')
    const scope = choice(input.scope ?? 'one', ['one', 'future'], 'Escopo')
    assertUnmanaged(this, scope === 'future' && old.seriesId ? this.db.prepare("SELECT id FROM transactions WHERE seriesId=? AND occurrenceIndex>=? AND status='pending'").all(old.seriesId, old.occurrenceIndex).map(row => row.id) : [old.id])
    if (scope === 'future' && old.status !== 'pending') fail('Para excluir um lançamento já realizado, escolha somente esta ocorrência.')
    return this.atomic(() => {
      const result = scope === 'future' && old.seriesId ? this.db.prepare("DELETE FROM transactions WHERE seriesId=? AND occurrenceIndex>=? AND status='pending'").run(old.seriesId, old.occurrenceIndex) : this.db.prepare('DELETE FROM transactions WHERE id=?').run(old.id)
      this.db.exec('DELETE FROM series WHERE id NOT IN (SELECT seriesId FROM transactions WHERE seriesId IS NOT NULL)')
      return { deleted: result.changes }
    })
  }

  settleTransaction(input) {
    object(input)
    const old = this.existing('transactions', input.id, 'Lançamento')
    assertUnmanaged(this, [old.id])
    const row = this.transactionInput({ ...old, status: 'settled', paidDate: input.paidDate }, old)
    this.writeTransaction(row)
    return row
  }

  transferInput(input, old = null, permitArchived = false) {
    object(input)
    const row = { id: old?.id ?? key(), fromAccountId: text(input.fromAccountId, 'Conta de origem', 80), toAccountId: text(input.toAccountId, 'Conta de destino', 80), amountCents: money(input.amountCents), date: validDate(input.date), notes: text(input.notes, 'Observação', 4000, true) }
    if (row.fromAccountId === row.toAccountId) fail('Escolha duas contas diferentes para a transferência.')
    if (row.date > today()) fail('A transferência precisa ter ocorrido até hoje. Uma data futura não pode ser efetivada.')
    const previous = permitArchived ? row : old
    const from = this.reference('accounts', row.fromAccountId, 'Conta de origem', previous?.fromAccountId)
    const to = this.reference('accounts', row.toAccountId, 'Conta de destino', previous?.toAccountId)
    row.receivedCents = (from.currency || 'BRL') === (to.currency || 'BRL') ? row.amountCents : money(input.receivedCents, 'Valor recebido na moeda de destino')
    if (row.date < from.initialDate || row.date < to.initialDate) fail('A transferência não pode ser anterior à data inicial das contas.')
    return row
  }

  saveTransfer(input) {
    object(input)
    const old = input.id ? this.existing('transfers', input.id, 'Transferência') : null
    const row = this.transferInput(input, old)
    this.db.prepare(`INSERT INTO transfers (id,fromAccountId,toAccountId,amountCents,date,notes,receivedCents) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET fromAccountId=excluded.fromAccountId,toAccountId=excluded.toAccountId,amountCents=excluded.amountCents,date=excluded.date,notes=excluded.notes,receivedCents=excluded.receivedCents`).run(row.id, row.fromAccountId, row.toAccountId, row.amountCents, row.date, row.notes, row.receivedCents)
    return row
  }

  deleteTransfer(input) {
    object(input)
    this.existing('transfers', input.id, 'Transferência')
    return { deleted: this.db.prepare('DELETE FROM transfers WHERE id=?').run(input.id).changes }
  }

  goalInput(input, old = null, permitArchived = false) {
    const row = { id: old?.id ?? key(), name: text(input.name, 'Nome da meta'), projectId: input.projectId || null, targetCents: money(input.targetCents, 'Objetivo'), startDate: validDate(input.startDate, 'Início'), endDate: validDate(input.endDate, 'Fim') }
    if (row.startDate > row.endDate) fail('O fim da meta deve ser igual ou posterior ao início.')
    if (row.projectId) this.reference('projects', row.projectId, 'Projeto', permitArchived ? row.projectId : old?.projectId)
    return row
  }

  saveGoal(input) {
    object(input)
    const old = input.id ? this.existing('goals', input.id, 'Meta') : null
    const row = this.goalInput(input, old)
    this.db.prepare(`INSERT INTO goals VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,projectId=excluded.projectId,targetCents=excluded.targetCents,startDate=excluded.startDate,endDate=excluded.endDate`).run(row.id, row.name, row.projectId, row.targetCents, row.startDate, row.endDate)
    return row
  }

  deleteGoal(input) {
    object(input)
    this.existing('goals', input.id, 'Meta')
    return { deleted: this.db.prepare('DELETE FROM goals WHERE id=?').run(input.id).changes }
  }

  validateSettings(input) {
    object(input)
    const settings = { profileName: text(input.profileName, 'Nome do perfil', 100), openTabs: input.openTabs, activeTab: input.activeTab, screen: choice(input.screen, SCREENS, 'Tela'), compact: boolean(input.compact) }
    settings.displayCurrency = currency(input.displayCurrency)
    settings.defaultAccountId = input.defaultAccountId || null
    if (settings.defaultAccountId) this.existing('accounts', settings.defaultAccountId, 'Conta padrão')
    settings.dashboardLayout = choice(input.dashboardLayout ?? 'overview', ['overview','banking','investing','charts','foreign','custom'], 'Layout')
    settings.dashboardWidgets = input.dashboardWidgets ?? ['balance','summary','cashchart','categories','recent','accounts','portfolio','rates']
    if (!Array.isArray(settings.dashboardWidgets) || settings.dashboardWidgets.length > 8 || new Set(settings.dashboardWidgets).size !== settings.dashboardWidgets.length || settings.dashboardWidgets.some(w => !['balance','summary','cashchart','categories','recent','accounts','portfolio','rates'].includes(w))) fail('Widgets do dashboard inválidos.')
    if (!Array.isArray(settings.openTabs) || !settings.openTabs.length || settings.openTabs.length > 500 || new Set(settings.openTabs).size !== settings.openTabs.length || settings.openTabs[0] !== 'geral') fail('As abas devem começar por Geral, sem repetições.')
    for (const id of settings.openTabs) {
      if (id !== 'geral') this.reference('projects', id, 'Projeto da aba')
    }
    if (!settings.openTabs.includes(settings.activeTab)) fail('A aba selecionada precisa estar aberta.')
    return settings
  }

  writeSettings(settings) {
    this.db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(this.validateSettings(settings)))
  }

  saveSettings(input) {
    object(input)
    const settings = { ...this.snapshot().settings, ...input }
    this.writeSettings(settings)
    return this.snapshot().settings
  }

  saveInvestment(input) {
    const existing = input?.id ? this.db.prepare('SELECT value FROM investments WHERE id=?').get(text(input.id, 'Identificador',80)) : null
    if (input?.id && !existing) fail('Investimento não encontrado.')
    const row = investmentInput(input, this, existing ? JSON.parse(existing.value) : null)
    row.id ||= key()
    this.db.prepare('INSERT INTO investments VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(row.id, JSON.stringify(row))
    return row
  }

  deleteInvestment(input) {
    return { deleted: this.db.prepare('DELETE FROM investments WHERE id=?').run(text(input?.id,'Identificador',80)).changes }
  }

  cacheMarket(name, value) {
    this.db.prepare('INSERT INTO market_cache VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(name, JSON.stringify(value))
  }

  backupTo(destination) {
    const target = resolve(text(destination, 'Caminho do backup', 3000))
    if (target.toLowerCase() === this.path.toLowerCase() || [`${this.path}-wal`, `${this.path}-shm`].some(path => path.toLowerCase() === target.toLowerCase())) fail('Escolha um arquivo diferente do banco em uso.')
    mkdirSync(dirname(target), { recursive: true })
    const staged = `${target}.${key()}.tmp`
    try {
      this.db.prepare('VACUUM INTO ?').run(staged)
      renameSync(staged, target)
      const date = now()
      this.db.prepare("INSERT INTO app_meta VALUES ('last_backup',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(date)
      return { path: target, date }
    } finally {
      if (existsSync(staged)) rmSync(staged)
    }
  }

  automaticBackup() {
    if (this.path === ':memory:') return null
    const day = now().slice(0, 10)
    const target = join(this.backupDirectory, `auto-${day}.sqlite`)
    if (existsSync(target)) return { path: target, skipped: true }
    const result = this.backupTo(target)
    const old = readdirSync(this.backupDirectory).filter(name => /^auto-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name)).sort().reverse().slice(14)
    for (const name of old) rmSync(join(this.backupDirectory, name))
    return result
  }

  validateBackup(database) {
    if (database.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') fail('O backup está corrompido.')
    const backupVersion = database.prepare('PRAGMA user_version').get().user_version
    if (database.prepare('PRAGMA application_id').get().application_id !== APPLICATION_ID || ![1,2,3,VERSION].includes(backupVersion)) fail('O arquivo não é um backup compatível do Purple Tab.')
    if (database.prepare('PRAGMA foreign_key_check').all().length) fail('O backup possui referências inválidas.')
    const expected = new DatabaseSync(':memory:')
    try {
      expected.exec(SCHEMA)
      if (backupVersion >= 2) expected.exec(MIGRATION_2)
      if (backupVersion >= 3) expected.exec(PLANNING_SCHEMA)
      if (backupVersion >= 4) expected.exec(CARDS_SCHEMA)
      const schema = connection => connection.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all().map(row => ({ type: row.type, name: row.name, sql: normalizeSql(row.sql) }))
      if (JSON.stringify(schema(expected)) !== JSON.stringify(schema(database))) fail('A estrutura deste backup não corresponde ao Purple Tab.')
    } finally { expected.close() }
    if (database.prepare("SELECT value FROM app_meta WHERE key='application'").get()?.value !== MARKER) fail('Este arquivo não foi criado pelo Purple Tab.')
    // Use the same business validators on the candidate connection without modifying it.
    const current = this.db
    this.db = database
    try {
      const data = this.snapshot()
      this.validateSettings(data.settings)
      for (const project of data.projects) {
        icon(project.icon)
        text(project.id, 'Identificador', 80); text(project.name, 'Projeto'); timestamp(project.createdAt)
        if (!/^#[0-9a-f]{6}$/i.test(project.color)) fail('Projeto com cor inválida no backup.')
      }
      for (const account of data.accounts) {
        currency(account.currency); icon(account.icon)
        text(account.id, 'Identificador', 80); text(account.name, 'Conta'); text(account.institution, 'Instituição', 160, true)
        choice(account.type, ['checking', 'savings', 'cash', 'investment'], 'Tipo de conta'); money(account.initialBalanceCents, 'Saldo inicial', true); validDate(account.initialDate)
      }
      for (const category of data.categories) {
        text(category.id, 'Identificador', 80); text(category.name, 'Categoria'); choice(category.type, ['income', 'expense'], 'Tipo de categoria')
        if (category.parentId) {
          const parent = this.existing('categories', category.parentId, 'Categoria principal')
          if (parent.parentId || parent.type !== category.type) fail('Subcategoria inválida no backup.')
        }
      }
      const series = database.prepare('SELECT * FROM series').all()
      for (const row of series) { text(row.id, 'Identificador', 80); timestamp(row.createdAt) }
      for (const transaction of data.transactions) {
        text(transaction.id, 'Identificador', 80); timestamp(transaction.createdAt); timestamp(transaction.updatedAt)
        this.transactionInput(transaction, transaction, true)
        if (transaction.seriesId) {
          const parent = series.find(row => row.id === transaction.seriesId)
          if (!parent || !Number.isInteger(transaction.occurrenceIndex) || transaction.occurrenceIndex < 0 || transaction.occurrenceIndex >= parent.count) fail('Parcela com sequência inválida no backup.')
        }
      }
      for (const transfer of data.transfers) { text(transfer.id, 'Identificador', 80); this.transferInput(transfer, transfer, true) }
      for (const goal of data.goals) { text(goal.id, 'Identificador', 80); this.goalInput(goal, goal, true) }
      for (const investment of data.investments) investmentInput(investment, this, investment)
      if (backupVersion >= 3) validatePlanning(this)
      if (backupVersion >= 4) validateCards(this)
    } finally { this.db = current }
  }

  restoreFrom(source) {
    if (this.path === ':memory:') fail('Restauração exige um banco salvo em arquivo.')
    const path = resolve(text(source, 'Caminho do backup', 3000))
    if (path.toLowerCase() === this.path.toLowerCase()) fail('Selecione um backup diferente do banco em uso.')
    if (!existsSync(path)) fail('O arquivo de backup não foi encontrado.')
    const staged = `${this.path}.restore-${key()}.tmp`
    let candidate
    let preventive
    try {
      candidate = new DatabaseSync(path, { readOnly: true })
      candidate.exec('PRAGMA trusted_schema=OFF')
      this.validateBackup(candidate)
      candidate.prepare('VACUUM INTO ?').run(staged)
      candidate.close()
      candidate = new DatabaseSync(staged, { readOnly: true })
      candidate.exec('PRAGMA trusted_schema=OFF')
      this.validateBackup(candidate)
      candidate.close()
      candidate = null
      preventive = this.backupTo(join(this.backupDirectory, `pre-restore-${now().replace(/[:.]/g, '-')}-${key().slice(0, 8)}.sqlite`)).path
      this.close()
      try {
        renameSync(staged, this.path)
        this.db = new DatabaseSync(this.path)
        this.configure()
        this.migrate()
        this.upgrade()
      } catch (error) {
        try { this.db?.close() } catch { /* connection may already be closed */ }
        copyFileSync(preventive, this.path)
        this.db = new DatabaseSync(this.path)
        this.configure()
        throw error
      }
      return { path, preventiveBackup: preventive }
    } catch (error) {
      throw new Error(`Não foi possível restaurar o backup: ${error.message}`, { cause: error })
    } finally {
      candidate?.close()
      if (existsSync(staged)) rmSync(staged)
    }
  }

  close() {
    this.db.close()
  }
}
Object.assign(FinanceStore.prototype, planningMethods, cardMethods)
