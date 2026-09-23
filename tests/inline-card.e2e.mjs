/* global window */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron } from 'playwright'
import electron from 'electron'

const root = resolve('.')
const temporary = mkdtempSync(join(tmpdir(), 'purple-inline-card-'))
const env = { ...process.env, PURPLE_TAB_DATA_DIR: join(temporary, 'data'), PURPLE_TAB_TEST_HEADLESS: '1' }
delete env.ELECTRON_RUN_AS_NODE
let app

try {
  app = await _electron.launch({ executablePath: process.env.PURPLE_TAB_EXE || electron, args: process.env.PURPLE_TAB_EXE ? [] : ['.'], cwd: root, env })
  const page = await app.firstWindow()
  page.setDefaultTimeout(12000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.locator('.app-main').waitFor()
  await page.getByRole('button', { name: 'Novo lançamento' }).click()
  await page.getByLabel('Forma de pagamento').selectOption('credit')
  const form = page.locator('.modal-panel form')
  await form.getByLabel('Descrição da compra').fill('Fone sem cadastro prévio')
  await form.getByLabel('Valor total da compra (BRL)').fill('120,00')

  const cardField = form.getByLabel('Cartão de crédito', { exact: true }).locator('..')
  await cardField.getByRole('button', { name: 'Criar cartão aqui' }).click()
  const cardDialog = page.getByRole('dialog', { name: 'Novo cartão de crédito' })
  await cardDialog.getByLabel('Nome do novo cartão').fill('Cartão novo')
  await cardDialog.getByLabel('Limite total').fill('2000,00')
  const accountField = cardDialog.getByLabel('Conta para pagar a fatura').locator('..')
  await accountField.getByRole('button', { name: 'Criar conta aqui' }).click()
  const accountDialog = page.getByRole('dialog', { name: 'Nova conta' })
  await accountDialog.getByLabel('Nome da nova conta').fill('Banco novo')
  await accountDialog.getByRole('button', { name: 'Criar e selecionar conta' }).click()
  await accountDialog.waitFor({ state: 'hidden' })
  await cardDialog.getByRole('button', { name: 'Criar e selecionar cartão' }).click()
  await cardDialog.waitFor({ state: 'hidden' })
  assert.equal(await form.getByLabel('Descrição da compra').inputValue(), 'Fone sem cadastro prévio')
  assert.equal(await form.getByLabel('Valor total da compra (BRL)').inputValue(), '120,00')
  await form.getByLabel('Categoria da compra', { exact: true }).selectOption({ label: 'Alimentação' })
  await form.getByRole('button', { name: 'Registrar compra' }).click()
  await form.waitFor({ state: 'hidden' })

  const snapshot = await page.evaluate(() => window.electronAPI.getSnapshot())
  assert.equal(snapshot.creditCards.find(c => c.name === 'Cartão novo')?.limitCents, 200000)
  assert.equal(snapshot.cardPurchases.find(p => p.description === 'Fone sem cadastro prévio')?.amountCents, 12000)
  assert.equal(snapshot.accounts.find(a => a.name === 'Banco novo')?.currency, 'BRL')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ status: 'passed' }))
} finally {
  if (app) await app.close().catch(() => {})
  rmSync(temporary, { recursive: true, force: true })
}
