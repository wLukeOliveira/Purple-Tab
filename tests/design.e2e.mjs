// Real Electron visual/motion checks. Build first: node scripts/tasks.mjs build
// Optional packaged mode: set PURPLE_TAB_EXE to the new executable's full path.
// A fresh temporary SQLite database is used; the user's data is never opened.
/* global window, document, requestAnimationFrame, getComputedStyle */
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, existsSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as pause } from 'node:timers/promises'
import { _electron } from 'playwright'
import electronExecutable from 'electron'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const temporary = mkdtempSync(join(tmpdir(), 'purple-tab-design-'))
const dataDirectory = join(temporary, 'data')
const packaged = Boolean(process.env.PURPLE_TAB_EXE)
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const artifacts = join(root, 'tests', 'artifacts', `design-${packaged ? 'packaged' : 'source'}-${runId}`)
mkdirSync(artifacts, { recursive: true })
const env = { ...process.env, PURPLE_TAB_DATA_DIR: dataDirectory, PURPLE_TAB_TEST_HEADLESS: '1' }
delete env.ELECTRON_RUN_AS_NODE
const report = { mode: packaged ? 'packaged' : 'source', startedAt: new Date().toISOString(), status: 'running', stages: [], pageErrors: [], artifactDirectory: artifacts }
let electronApp
let page
let stage = 'launch'

function mark(name, detail = {}) {
  stage = name
  report.stages.push({ name, ...detail })
  console.log(`PASS ${name}${Object.keys(detail).length ? ` ${JSON.stringify(detail)}` : ''}`)
}

async function until(check, message, timeout = 10000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await check()) return
    await pause(40)
  }
  throw new Error(`Timed out: ${message}`)
}

async function resize(width, height) {
  await electronApp.evaluate(({ BrowserWindow }, size) => {
    const main = BrowserWindow.getAllWindows()[0]
    main.setSize(size.width, size.height)
    main.showInactive()
    main.webContents.backgroundThrottling = false
  }, { width, height })
  await pause(250)
}

async function screenshot(name) {
  // Keep animation enabled: these screenshots should show the actual design,
  // including its breathing primary button and translucent hover treatment.
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))))
  await page.screenshot({ path: join(artifacts, name), fullPage: true, animations: 'allow', timeout: 30000 })
}

const compact = text => text.replace(/\s/g, '')
const money = cents => compact(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100))
const incomeMetric = () => page.locator('.stats-grid .stat-card').first().locator('.motion-number').first()
const incomeText = () => incomeMetric().locator('.motion-number-visual').innerText()

async function sampleIncomeDuringSwitch(tabName, milliseconds = 1100) {
  // Sample real rendered strings on animation frames, not CSS declarations.
  // Start the observer before the click so fast IPC/UI updates are not missed.
  const samplesPromise = page.evaluate(duration => new Promise(done => {
    const samples = []
    const start = performance.now()
    const step = () => {
      const metric = document.querySelector('.stats-grid .stat-card .motion-number')
      samples.push({ elapsed: Math.round(performance.now() - start), text: metric?.querySelector('.motion-number-visual')?.textContent || '', accessible: metric?.querySelector('.motion-number-accessible')?.textContent || '', target: metric?.getAttribute('data-value'), animating: metric?.getAttribute('data-animating') })
      if (performance.now() - start >= duration) done(samples)
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }), milliseconds)
  await page.locator('.tab-label').filter({ hasText: new RegExp(`^${tabName}$`) }).click()
  return samplesPromise
}

try {
  if (!packaged) assert.ok(existsSync(join(root, 'dist', 'index.html')), 'Build the application first')
  electronApp = await _electron.launch({ executablePath: process.env.PURPLE_TAB_EXE || electronExecutable, args: packaged ? [] : ['.'], cwd: root, env, timeout: 30000 })
  page = await electronApp.firstWindow()
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => report.pageErrors.push(error.message))
  await page.locator('.app-main').waitFor()
  await page.context().setOffline(true)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await resize(1460, 950)
  const initial = await page.evaluate(() => window.electronAPI.getSnapshot())
  assert.equal(resolve(initial.meta.databasePath), resolve(join(dataDirectory, 'purple-tab.sqlite')))
  assert.equal(initial.transactions.length, 0)
  assert.equal(initial.accounts.length, 0)
  assert.match(await page.locator('.app-main').innerText(), /Comece pelas suas contas/)
  await pause(1100)
  await screenshot('01-empty-dashboard.png')
  mark('isolated-offline-empty-state')

  stage = 'seed-through-renderer-api'
  const seeded = await page.evaluate(async () => {
    const api = window.electronAPI
    const snapshot = await api.getSnapshot()
    const date = new Date()
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const firstDay = `${day.slice(0, 7)}-01`
    const studio = await api.saveProject({ name: 'Estúdio', color: '#9a8af5' })
    const personal = snapshot.projects[0]
    const account = await api.saveAccount({ name: 'Conta do dia a dia', institution: 'Conta local', type: 'checking', initialBalanceCents: 520000, initialDate: firstDay, archived: false })
    await api.saveAccount({ name: 'Reserva', institution: 'Objetivos pessoais', type: 'savings', initialBalanceCents: 1250000, initialDate: firstDay, archived: false })
    const incomeCategory = snapshot.categories.find(item => item.type === 'income' && !item.parentId)
    const expenseCategory = snapshot.categories.find(item => item.type === 'expense' && !item.parentId)
    const entries = [
      { description: 'Projeto editorial · Setembro', type: 'income', amountCents: 480000, projectId: studio.id, status: 'settled' },
      { description: 'Identidade visual · Ateliê', type: 'income', amountCents: 320000, projectId: studio.id, status: 'settled' },
      { description: 'Receita pessoal', type: 'income', amountCents: 275000, projectId: personal.id, status: 'settled' },
      { description: 'Equipamentos do estúdio', type: 'expense', amountCents: 158900, projectId: studio.id, status: 'settled' },
      { description: 'Assinaturas de criação', type: 'expense', amountCents: 29900, projectId: studio.id, status: 'settled' },
      { description: 'Mercado e casa', type: 'expense', amountCents: 84325, projectId: personal.id, status: 'settled' },
      { description: 'Próxima entrega · Campanha', type: 'income', amountCents: 210000, projectId: studio.id, status: 'pending' },
      { description: 'Internet e serviços', type: 'expense', amountCents: 24990, projectId: personal.id, status: 'pending' },
    ]
    for (const entry of entries) await api.saveTransaction({ ...entry, categoryId: entry.type === 'income' ? incomeCategory.id : expenseCategory.id, accountId: account.id, dueDate: day, paidDate: entry.status === 'settled' ? day : null, notes: '', seriesMode: 'single' })
    await api.saveSettings({ profileName: 'Luke', activeTab: 'geral', openTabs: ['geral', personal.id, studio.id], screen: 'home', compact: false })
    return { studioId: studio.id, personalId: personal.id, expectedIncome: 1075000, studioIncome: 800000 }
  })
  await page.reload()
  await page.locator('.app-main').waitFor()
  await until(async () => compact(await incomeText()) === money(seeded.expectedIncome), 'initial animated income')
  await until(async () => await incomeMetric().getAttribute('data-animating') !== 'true', 'initial number settles')
  await pause(1100)
  await screenshot('02-seeded-dashboard.png')
  await page.locator('.market-chart-canvas').scrollIntoViewIfNeeded()
  await pause(650)
  assert.ok(await page.locator('.market-chart-canvas canvas').count() > 0, 'Interactive market-style chart must render its canvas')
  await screenshot('02a-interactive-chart.png')
  await page.locator('.app-main').evaluate(element => { element.scrollTop = element.scrollHeight })
  await pause(650)
  await screenshot('02b-seeded-dashboard-lower.png')
  await page.locator('.app-main').evaluate(element => { element.scrollTop = 0 })
  await pause(650)
  mark('seeded-dashboard-with-real-local-records', { transactions: 8, expectedIncomeCents: seeded.expectedIncome })

  stage = 'card-and-primary-hover'
  const primary = page.locator('.heading-actions .primary')
  const idleAnimations = await primary.evaluate(element => [element, ...element.querySelectorAll('*')].flatMap(node => node.getAnimations().map(animation => ({ playState: animation.playState, iterations: animation.effect?.getTiming().iterations }))))
  assert.ok(idleAnimations.some(animation => animation.playState === 'running'), 'Primary action must have a real idle animation')
  await primary.hover()
  await pause(280)
  const hoverStyle = await primary.evaluate(element => ({ background: getComputedStyle(element).backgroundImage, boxShadow: getComputedStyle(element).boxShadow, borderRadius: getComputedStyle(element).borderRadius, beforeAnimation: getComputedStyle(element, '::before').animationName, afterAnimation: getComputedStyle(element, '::after').animationName }))
  await screenshot('03-primary-hover.png')
  const card = page.locator('.stat-card').first()
  await page.mouse.move(10, 10)
  await pause(350)
  const initialTop = await card.evaluate(element => element.getBoundingClientRect().top)
  await card.hover()
  await pause(400)
  const hoveredTop = await card.evaluate(element => element.getBoundingClientRect().top)
  assert.ok(hoveredTop < initialTop - 0.5, `Hover should lift stat cards; before=${initialTop}, after=${hoveredTop}`)
  await screenshot('04-card-hover.png')
  mark('animated-primary-and-soft-card-hover', { idleAnimations: idleAnimations.length, hoverStyle, cardLiftPx: Number((initialTop - hoveredTop).toFixed(2)) })

  stage = 'real-number-interpolation'
  await page.mouse.move(10, 10)
  const samples = await sampleIncomeDuringSwitch('Estúdio')
  const observed = [...new Set(samples.map(item => compact(item.text)).filter(Boolean))]
  assert.ok(observed.some(value => value !== money(seeded.expectedIncome) && value !== money(seeded.studioIncome)), `Expected intermediate currency values, got ${JSON.stringify(observed)}`)
  assert.ok(samples.some(item => item.animating === 'true'), 'The number should report an active transition')
  assert.ok(samples.filter(item => item.animating === 'true').every(item => Number(item.target) === seeded.studioIncome && compact(item.accessible) === money(seeded.studioIncome)), 'Accessible and canonical money must remain exact during visual interpolation')
  await until(async () => compact(await incomeText()) === money(seeded.studioIncome), 'project income final exact cents')
  await until(async () => await incomeMetric().getAttribute('data-animating') !== 'true', 'project income transition settles')
  writeFileSync(join(artifacts, 'number-transition.json'), JSON.stringify(samples, null, 2))
  mark('number-values-interpolate-and-settle-exactly', { intermediateValues: observed.length - 2, final: money(seeded.studioIncome) })

  stage = 'modal-and-small-desktop'
  await page.locator('.heading-actions').getByRole('button', { name: 'Novo lançamento', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Lançamento financeiro' })
  await dialog.waitFor()
  await pause(450)
  const choice = dialog.getByRole('group', { name: 'Tipo de lançamento' })
  await choice.getByRole('button', { name: /Entrada/ }).click()
  assert.equal(await choice.getByRole('button', { name: /Entrada/ }).getAttribute('aria-pressed'), 'true')
  await choice.getByRole('button', { name: /Despesa/ }).click()
  assert.equal(await choice.getByRole('button', { name: /Despesa/ }).getAttribute('aria-pressed'), 'true')
  await dialog.getByLabel('Descrição', { exact: true }).fill('Uma nova ideia para o estúdio')
  await screenshot('05-transaction-modal.png')
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  await resize(1000, 760)
  await screenshot('06-small-desktop-dashboard.png')
  const width = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
  assert.ok(width.content <= width.viewport + 1, `Horizontal document overflow: ${JSON.stringify(width)}`)
  await page.locator('.heading-actions').getByRole('button', { name: 'Novo lançamento', exact: true }).click()
  await dialog.waitFor()
  await pause(450)
  await screenshot('07-small-desktop-modal.png')
  const modalBounds = await dialog.boundingBox()
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
  assert.ok(modalBounds.x >= 0 && modalBounds.y >= 0 && modalBounds.x + modalBounds.width <= viewport.width + 1 && modalBounds.y + modalBounds.height <= viewport.height + 1, 'Modal must stay inside the small desktop viewport')
  await page.keyboard.press('Escape')
  mark('desktop-and-compact-viewport-modal-layout', { viewport, documentWidth: width.content })

  stage = 'all-redesigned-screens'
  await resize(1460, 950)
  for (const [title, id] of [['Histórico', 'history'], ['Comparação', 'comparison'], ['Relatórios', 'reports'], ['Criação', 'creation'], ['Conquistas', 'achievements'], ['Configurações', 'settings']]) {
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: title, exact: true }).click()
    await until(async () => await page.locator('.page-heading h1').textContent() === title, `navigate to ${title}`)
    await pause(1100)
    await screenshot(`08-screen-${id}.png`)
  }
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Visão geral', exact: true }).click()
  await incomeMetric().waitFor()
  mark('all-seven-redesigned-screens')

  stage = 'reduced-motion'
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await pause(100)
  const reducedSamples = await sampleIncomeDuringSwitch('Geral', 400)
  const reducedValues = [...new Set(reducedSamples.map(item => compact(item.text)).filter(Boolean))]
  assert.ok(reducedValues.every(value => [money(seeded.studioIncome), money(seeded.expectedIncome)].includes(value)), `Reduced motion must not count through intermediate values: ${JSON.stringify(reducedValues)}`)
  assert.ok(!reducedSamples.some(item => item.animating === 'true'), 'Reduced motion should never start a number tween')
  assert.equal(compact(await incomeText()), money(seeded.expectedIncome))
  const activeAnimations = await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running' && animation.effect?.getTiming().duration > 20).map(animation => ({ duration: animation.effect.getTiming().duration, iterations: animation.effect.getTiming().iterations })))
  assert.deepEqual(activeAnimations, [], 'Reduced motion should stop decorative/continuous animations')
  await screenshot('09-reduced-motion-dashboard.png')
  mark('reduced-motion-immediate-values-and-no-continuous-animation', { final: money(seeded.expectedIncome) })

  assert.deepEqual(report.pageErrors, [], 'Renderer must not throw exceptions')
  report.status = 'passed'
  report.finishedAt = new Date().toISOString()
  console.log(`Design validation passed: ${artifacts}`)
} catch (error) {
  report.status = 'failed'
  report.failedStage = stage
  report.error = error.stack || String(error)
  report.finishedAt = new Date().toISOString()
  console.error(report.error)
  if (page) {
    try { await screenshot('failure.png') } catch { /* Preserve original failure. */ }
  }
  process.exitCode = 1
} finally {
  writeFileSync(join(artifacts, 'result.json'), JSON.stringify(report, null, 2))
  if (electronApp) await electronApp.close().catch(() => {})
  // Only the exact newly-created test directory is removed. Screenshots remain.
  rmSync(temporary, { recursive: true, force: true })
}
