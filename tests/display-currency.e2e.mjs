/* global window */
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron } from 'playwright'
import electron from 'electron'

const root = resolve('.')
const temporary = mkdtempSync(join(tmpdir(), 'purple-currency-'))
const artifacts = join(root, 'tests', 'artifacts', `currency-${new Date().toISOString().replace(/[:.]/g, '-')}`)
mkdirSync(artifacts, { recursive: true })
const env = { ...process.env, PURPLE_TAB_DATA_DIR: join(temporary, 'data'), PURPLE_TAB_TEST_HEADLESS: '1' }
delete env.ELECTRON_RUN_AS_NODE
let app

try {
  app = await _electron.launch({ executablePath: process.env.PURPLE_TAB_EXE || electron, args: process.env.PURPLE_TAB_EXE ? [] : ['.'], cwd: root, env })
  const page = await app.firstWindow()
  page.setDefaultTimeout(12000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.setSize(1360, 900); window.showInactive() })
  await page.locator('.app-main').waitFor()

  const currency = page.getByRole('button', { name: 'Moeda de visualização: BRL. Alterar moeda' })
  await currency.waitFor()
  assert.ok((await currency.boundingBox()).width <= 40)
  assert.match(await currency.locator('img').getAttribute('src'), /data:image\/svg\+xml.*%23009B3A/)
  assert.equal(await page.locator('.topbar-actions select').count(), 0)
  await page.screenshot({ path: join(artifacts, '01-bandeira-brasil.png'), animations: 'disabled' })

  await currency.click()
  const search = page.getByRole('searchbox', { name: 'Buscar moeda' })
  await search.fill('USD')
  await page.screenshot({ path: join(artifacts, '02-menu-moedas.png'), animations: 'disabled' })
  await page.locator('.display-currency-options button').filter({ hasText: 'USD' }).click()
  await page.getByRole('button', { name: 'Moeda de visualização: USD. Alterar moeda' }).waitFor()
  assert.equal((await page.evaluate(() => window.electronAPI.getSnapshot())).settings.displayCurrency, 'USD')

  await page.reload()
  const usd = page.getByRole('button', { name: 'Moeda de visualização: USD. Alterar moeda' })
  await usd.waitFor()
  await usd.click()
  await page.getByRole('searchbox', { name: 'Buscar moeda' }).fill('BRL')
  await page.locator('.display-currency-options button').filter({ hasText: 'BRL' }).click()
  await currency.waitFor()
  await currency.click()
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('.display-currency-menu').count(), 0)
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ status: 'passed', artifacts }))
} finally {
  if (app) await app.close().catch(() => {})
  rmSync(temporary, { recursive: true, force: true })
}
