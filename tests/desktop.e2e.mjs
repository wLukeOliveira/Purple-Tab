// Real Electron/SQLite acceptance test. Run after `npm run build`:
//   node tests/desktop.e2e.mjs
// Packaged Windows build: set PURPLE_TAB_EXE to the full Purple Tab.exe path.
// Every run uses a fresh OS temporary data directory. Screenshots, exports and a
// JSON result are written under tests/artifacts; user data is never opened.
/* global window, requestAnimationFrame */
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, copyFileSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as pause } from 'node:timers/promises'
import { _electron } from 'playwright'
import electronExecutable from 'electron'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const packaged = Boolean(process.env.PURPLE_TAB_EXE)
const temporary = mkdtempSync(join(tmpdir(), 'purple-tab-desktop-'))
const dataDirectory = join(temporary, 'data')
const mode = packaged ? 'packaged' : 'source'
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const artifacts = join(root, 'tests', 'artifacts', `${mode}-${runId}`)
mkdirSync(artifacts, { recursive: true })
const paths = { backup: join(temporary, 'acceptance.purpletab'), csv: join(temporary, 'report.csv'), pdf: join(temporary, 'report.pdf') }
const env = { ...process.env, PURPLE_TAB_DATA_DIR: dataDirectory, PURPLE_TAB_TEST_HEADLESS: '1' }
delete env.ELECTRON_RUN_AS_NODE
const report = { mode, startedAt: new Date().toISOString(), status: 'running', stages: [], pageErrors: [], artifactDirectory: artifacts }
let electronApp
let page
let stage = 'launch'

function mark(name, detail = {}) {
  stage = name
  report.stages.push({ name, ...detail })
  console.log(`PASS ${name}${Object.keys(detail).length ? ` ${JSON.stringify(detail)}` : ''}`)
}

async function until(check, message, timeout = 15000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await check()) return
    await pause(60)
  }
  throw new Error(`Timed out: ${message}`)
}

async function launch() {
  electronApp = await _electron.launch({
    executablePath: process.env.PURPLE_TAB_EXE || electronExecutable,
    args: packaged ? [] : ['.'], cwd: root, env, timeout: 30000,
  })
  page = await electronApp.firstWindow()
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => report.pageErrors.push(error.message))
  await page.locator('.app-main').waitFor()
  await page.context().setOffline(true)
  const isolation = await page.evaluate(() => ({ api: Boolean(window.electronAPI), require: typeof window.require, process: typeof window.process }))
  assert.deepEqual(isolation, { api: true, require: 'undefined', process: 'undefined' })
  assert.ok(page.url().startsWith('file:'), 'Desktop must load built assets without a Vite server')
  await electronApp.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].webContents.backgroundThrottling = false
  })
  const actualData = await page.evaluate(() => window.electronAPI.getSnapshot())
  assert.equal(resolve(actualData.meta.databasePath), resolve(join(dataDirectory, 'purple-tab.sqlite')))
  await electronApp.evaluate(({ dialog }, locations) => {
    dialog.showSaveDialog = async (_parent, options) => ({
      canceled: false,
      filePath: options.title.includes('CSV') ? locations.csv : options.title.includes('PDF') ? locations.pdf : locations.backup,
    })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [locations.backup] })
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
  }, paths)
  return actualData
}

const snapshot = () => page.evaluate(() => window.electronAPI.getSnapshot())
const records = data => ({ projects: data.projects, accounts: data.accounts, categories: data.categories, transactions: data.transactions, transfers: data.transfers, goals: data.goals, settings: data.settings })
function balance(data) {
  return data.accounts.reduce((sum, account) => sum + account.initialBalanceCents, 0)
    + data.transactions.filter(row => row.status === 'settled').reduce((sum, row) => sum + (row.type === 'income' ? row.amountCents : -row.amountCents), 0)
}
const localDay = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }

async function navigate(title) {
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: title, exact: true }).click()
  await until(async () => await page.locator('.page-heading h1').textContent() === title, `navigation to ${title}`)
}

async function addEntry({ description, type = 'expense', amount, projectId, categoryId, accountId, settled = false }) {
  await page.locator('.heading-actions').getByRole('button', { name: 'Novo lançamento', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Lançamento financeiro' })
  await form.getByRole('group', { name: 'Tipo de lançamento' }).getByRole('button', { name: type === 'income' ? /Entrada/ : /Despesa/ }).click()
  await form.getByLabel('Projeto', { exact: true }).selectOption(projectId)
  await form.getByLabel('Descrição', { exact: true }).fill(description)
  await form.getByLabel('Valor (R$)', { exact: true }).fill(amount)
  await form.getByLabel('Conta', { exact: true }).selectOption(accountId)
  await form.getByLabel('Categoria', { exact: true }).selectOption(categoryId)
  if (settled) await form.getByLabel('Situação', { exact: true }).selectOption('settled')
  await form.getByRole('button', { name: 'Criar lançamento', exact: true }).click()
  await form.waitFor({ state: 'hidden' })
  return (await snapshot()).transactions.find(row => row.description === description)
}

async function openProject(name) {
  await page.getByRole('button', { name: 'Abrir ou criar projeto', exact: true }).click()
  await page.locator('.project-menu').getByRole('button', { name: new RegExp(`^${name}`) }).click()
  await until(async () => await page.locator('.tab-label[aria-pressed="true"]').textContent() === name, `open tab ${name}`)
}

async function screenshot(filename) {
  // Hidden windows can yield a stale composited frame even while DOM checks pass.
  // Show the test window without focusing it, wait for paint, then hide it again.
  await electronApp.evaluate(({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().startsWith('file:'))
    main.showInactive()
  })
  try {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await page.screenshot({ path: join(artifacts, filename), fullPage: true, animations: 'disabled', timeout: 30000 })
  } finally {
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows().find(window => window.webContents.getURL().startsWith('file:')).hide()
    })
  }
}

try {
  if (!packaged) assert.ok(existsSync(join(root, 'dist', 'index.html')), 'Run npm run build before the desktop test')
  const initial = await launch()
  assert.equal(initial.accounts.length, 0)
  assert.equal(initial.transactions.length, 0)
  assert.equal(initial.projects[0].name, 'Pessoal')
  mark('offline-startup-and-isolated-empty-database')

  stage = 'catalog-ui'
  await navigate('Criação')
  await page.getByLabel('Nome do projeto', { exact: true }).fill('Empresa E2E')
  await page.getByRole('button', { name: 'Criar projeto', exact: true }).click()
  await until(async () => (await snapshot()).projects.some(row => row.name === 'Empresa E2E'), 'create project')
  await page.getByRole('button', { name: 'Contas', exact: true }).click()
  await page.getByLabel('Nome da conta', { exact: true }).fill('Conta E2E')
  await page.getByLabel('Instituição (opcional)', { exact: true }).fill('Banco de teste')
  await page.getByLabel('Saldo inicial (R$)', { exact: true }).fill('1.000,00')
  await page.getByLabel('Data do saldo inicial', { exact: true }).fill(`${localDay().slice(0, 4)}-01-01`)
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await until(async () => (await snapshot()).accounts.length === 1, 'create account')
  const catalog = await snapshot()
  const account = catalog.accounts[0]
  const personal = catalog.projects.find(row => row.name === 'Pessoal')
  const company = catalog.projects.find(row => row.name === 'Empresa E2E')
  const income = catalog.categories.find(row => row.type === 'income')
  const expense = catalog.categories.find(row => row.type === 'expense')
  mark('create-project-and-account-through-forms')

  stage = 'entry-ui'
  const revenue = await addEntry({ description: '=VENDA E2E', type: 'income', amount: '2.000,00', projectId: company.id, categoryId: income.id, accountId: account.id, settled: true })
  const expenseEntry = await addEntry({ description: 'Despesa E2E', amount: '300,00', projectId: personal.id, categoryId: expense.id, accountId: account.id, settled: true })
  assert.equal(revenue.amountCents, 200000)
  assert.equal(expenseEntry.amountCents, 30000)
  assert.equal(balance(await snapshot()), 270000)
  await navigate('Visão geral')
  assert.match(await page.locator('.forecast-card').textContent(), /2\.700,00/)
  await navigate('Histórico')
  await page.locator('.history-table tbody tr').filter({ hasText: 'Despesa E2E' }).getByRole('button', { name: 'Editar', exact: true }).click()
  let form = page.getByRole('dialog', { name: 'Lançamento financeiro' })
  await form.getByLabel('Valor (R$)', { exact: true }).fill('350,00')
  await form.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
  await form.waitFor({ state: 'hidden' })
  assert.equal(balance(await snapshot()), 265000)
  mark('create-and-edit-income-expense', { balanceCents: 265000 })

  stage = 'pending-payment-ui'
  const pending = await addEntry({ description: 'Pendente E2E', amount: '500,00', projectId: personal.id, categoryId: expense.id, accountId: account.id })
  assert.equal(balance(await snapshot()), 265000)
  await navigate('Visão geral')
  const forecast = await page.locator('.forecast-card').textContent()
  assert.match(forecast, /2\.650,00/)
  assert.match(forecast, /2\.150,00/)
  await navigate('Histórico')
  await page.locator('.history-table tbody tr').filter({ hasText: 'Pendente E2E' }).getByRole('button', { name: 'Pagar', exact: true }).click()
  await page.getByRole('region', { name: 'Confirmar operação' }).getByRole('button', { name: 'Confirmar', exact: true }).click()
  await page.getByRole('region', { name: 'Confirmar operação' }).waitFor({ state: 'hidden' })
  assert.equal((await snapshot()).transactions.find(row => row.id === pending.id).status, 'settled')
  assert.equal(balance(await snapshot()), 215000)
  mark('pending-projection-and-payment', { balanceCents: 215000 })

  stage = 'transfer-ui'
  const secondary = await page.evaluate(async input => window.electronAPI.saveAccount(input), { name: 'Reserva E2E', institution: '', type: 'savings', initialBalanceCents: 0, initialDate: `${localDay().slice(0, 4)}-01-01`, archived: false })
  await navigate('Criação')
  await page.getByRole('button', { name: /Transferir entre contas/ }).click()
  form = page.getByRole('dialog', { name: 'Transferência', exact: true })
  await form.getByLabel('Conta de origem', { exact: true }).selectOption(account.id)
  await form.getByLabel('Conta de destino', { exact: true }).selectOption(secondary.id)
  await form.getByLabel('Valor (R$)', { exact: true }).fill('100,00')
  await form.getByRole('button', { name: 'Transferir', exact: true }).click()
  await form.waitFor({ state: 'hidden' })
  assert.equal((await snapshot()).transfers.length, 1)
  assert.equal((await snapshot()).transactions.length, 3)
  assert.equal(balance(await snapshot()), 215000)
  mark('transfer-form-preserves-consolidated-result')

  stage = 'account-dock-and-chart'
  await navigate('Visão geral')
  await page.locator('.bank-dock-trigger').click()
  const bankChip = page.locator('.bank-chip').filter({ hasText: 'Conta E2E' })
  await bankChip.click()
  await page.locator('.forecast-primary .motion-number[data-value="10000"]').waitFor()
  await page.getByRole('button', { name: 'Gráfico de barras' }).click()
  assert.equal(await page.getByRole('button', { name: 'Gráfico de barras' }).getAttribute('aria-pressed'), 'true')
  await page.getByRole('button', { name: 'Gráfico de área' }).click()
  await page.locator('.bank-dock-actions').getByRole('button', { name: 'Selecionar todas' }).click()
  await page.locator('.forecast-primary .motion-number[data-value="215000"]').waitFor()
  mark('real-bank-multiselect-and-interactive-chart')

  stage = 'project-tabs'
  await openProject('Empresa E2E')
  await page.getByRole('button', { name: 'Fechar aba Empresa E2E', exact: true }).click()
  await until(async () => !(await snapshot()).settings.openTabs.includes(company.id), 'close project tab')
  assert.ok((await snapshot()).transactions.some(row => row.id === revenue.id))
  await openProject('Empresa E2E')
  await page.getByRole('button', { name: 'Mover aba para esquerda', exact: true }).click()
  await until(async () => (await snapshot()).settings.openTabs[1] === company.id, 'reorder project tabs')
  mark('project-tabs-close-reopen-and-reorder')

  stage = 'seven-screens'
  const screens = [['Visão geral', 'home'], ['Histórico', 'history'], ['Comparação', 'comparison'], ['Relatórios', 'reports'], ['Criação', 'creation'], ['Conquistas', 'achievements'], ['Configurações', 'settings']]
  for (const [label, id] of screens) {
    await navigate(label)
    assert.equal((await snapshot()).settings.screen, id)
    await screenshot(`${id}.png`)
  }
  mark('all-seven-sidebar-screens')

  stage = 'goal-ui'
  await navigate('Conquistas')
  await page.getByRole('button', { name: '+ Nova meta', exact: true }).click()
  await page.getByLabel('Nome da meta', { exact: true }).fill('Meta E2E')
  await page.getByLabel('Economia desejada (R$)', { exact: true }).fill('1.000,00')
  await page.getByRole('button', { name: 'Salvar meta', exact: true }).click()
  await until(async () => (await snapshot()).goals.length === 1, 'create goal')
  await page.getByRole('progressbar', { name: 'Meta E2E' }).waitFor()
  assert.equal(await page.getByRole('progressbar', { name: 'Meta E2E' }).getAttribute('aria-valuenow'), '100')
  mark('goal-form-and-calculated-progress')

  stage = 'report-export-ui'
  await navigate('Relatórios')
  await page.getByRole('button', { name: 'Todo período', exact: true }).click()
  await page.locator('.filter-bar').getByRole('button', { name: /^Filtros/ }).click()
  await page.locator('.filter-bar').getByLabel(/^Categoria/).selectOption(income.id)
  await page.getByRole('button', { name: 'Exportar CSV', exact: true }).click()
  await until(() => existsSync(paths.csv), 'CSV export')
  await page.locator('.report-export-status').filter({ hasText: 'Relatório salvo' }).waitFor()
  const csv = readFileSync(paths.csv, 'utf8')
  assert.ok(csv.startsWith('\ufeff'))
  assert.ok(csv.includes("'=VENDA E2E"), 'Spreadsheet formula payload must be escaped in CSV')
  assert.ok(csv.includes('2000,00'))
  assert.ok(!csv.includes('Despesa E2E') && !csv.includes('Pendente E2E'), 'Export must respect project/category filters')
  await page.getByRole('button', { name: 'Salvar PDF', exact: true }).click()
  await until(() => existsSync(paths.pdf), 'PDF export', 30000)
  await until(() => readFileSync(paths.pdf).length > 1000, 'PDF written completely')
  assert.equal(readFileSync(paths.pdf).subarray(0, 5).toString(), '%PDF-')
  copyFileSync(paths.csv, join(artifacts, 'filtered-report.csv'))
  copyFileSync(paths.pdf, join(artifacts, 'filtered-report.pdf'))
  mark('filtered-csv-and-pdf-exports', { csvBytes: Buffer.byteLength(csv), pdfBytes: readFileSync(paths.pdf).length })

  stage = 'backup-restore-ui'
  await navigate('Configurações')
  await page.getByLabel('Como podemos chamar você?', { exact: true }).fill('Perfil E2E')
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await until(async () => (await snapshot()).settings.profileName === 'Perfil E2E', 'save profile')
  await page.getByLabel('Usar interface compacta', { exact: true }).click()
  await until(async () => (await snapshot()).settings.compact, 'compact preference')
  await until(() => page.getByLabel('Usar interface compacta', { exact: true }).isChecked(), 'compact checkbox refresh')
  const backedUp = records(await snapshot())
  await page.getByRole('button', { name: 'Salvar backup', exact: true }).click()
  await until(() => existsSync(paths.backup), 'manual backup')
  assert.equal(readFileSync(paths.backup).subarray(0, 15).toString(), 'SQLite format 3')
  await page.getByLabel('Como podemos chamar você?', { exact: true }).fill('Perfil alterado após backup')
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await until(async () => (await snapshot()).settings.profileName === 'Perfil alterado após backup', 'mutate profile')
  await page.evaluate(async input => window.electronAPI.saveTransaction(input), { ...revenue, amountCents: 99900 })
  await page.getByRole('button', { name: 'Restaurar backup', exact: true }).click()
  await until(async () => (await snapshot()).settings.profileName === 'Perfil E2E', 'restore data')
  assert.deepEqual(records(await snapshot()), backedUp)
  await until(async () => await page.getByLabel('Como podemos chamar você?', { exact: true }).inputValue() === 'Perfil E2E', 'restored profile refreshes the visible settings form')
  assert.ok(readdirSync(join(dataDirectory, 'backups')).some(name => name.startsWith('pre-restore-')))
  mark('manual-backup-restore-and-preventive-copy')

  stage = 'persistence-restart'
  await navigate('Histórico')
  const expected = records(await snapshot())
  await electronApp.close()
  electronApp = null
  const afterRestart = await launch()
  assert.deepEqual(records(afterRestart), expected)
  assert.equal(await page.locator('.page-heading h1').textContent(), 'Histórico')
  assert.equal(await page.locator('.tab-label[aria-pressed="true"]').textContent(), 'Empresa E2E')
  assert.equal(balance(afterRestart), 215000)
  assert.deepEqual(report.pageErrors, [])
  await screenshot('after-restart.png')
  mark('restart-preserves-database-tabs-profile-and-screen', { balanceCents: 215000, transactions: afterRestart.transactions.length })
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.failedStage = stage
  report.error = error.stack || error.message
  report.temporaryDataDirectory = temporary
  console.error(`FAIL ${stage}\n${report.error}`)
  if (page && !page.isClosed()) {
    try {
      await screenshot('failure.png')
      writeFileSync(join(artifacts, 'failure-dom.txt'), await page.locator('body').innerText(), 'utf8')
    } catch { /* retain original test failure */ }
  }
  process.exitCode = 1
} finally {
  if (electronApp) await electronApp.close().catch(() => {})
  report.finishedAt = new Date().toISOString()
  writeFileSync(join(artifacts, 'result.json'), JSON.stringify(report, null, 2), 'utf8')
  // Remove only this exact generated temporary test directory, never user data.
  if (report.status === 'passed' && dirname(resolve(temporary)) === resolve(tmpdir()) && basename(temporary).startsWith('purple-tab-desktop-')) rmSync(temporary, { recursive: true, force: true })
  console.log(JSON.stringify({ status: report.status, mode, result: join(artifacts, 'result.json') }))
}
