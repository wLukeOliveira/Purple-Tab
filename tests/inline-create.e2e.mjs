/* global window */
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron } from 'playwright'
import electron from 'electron'

const root = resolve('.')
const temporary = mkdtempSync(join(tmpdir(), 'purple-inline-create-'))
const artifacts = join(root, 'tests', 'artifacts', `inline-create-${new Date().toISOString().replace(/[:.]/g, '-')}`)
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

  await page.getByRole('button', { name: 'Novo lançamento' }).click()
  const form = page.locator('.modal-panel form')
  await form.getByLabel('Descrição', { exact: true }).fill('Livro e café')
  await form.getByLabel('Valor (R$)').fill('49,90')

  const categoryField = form.getByLabel('Categoria', { exact: true }).locator('..')
  const formHeightBefore = await form.evaluate(element => element.scrollHeight)
  await categoryField.getByRole('button', { name: 'Criar categoria aqui' }).click()
  const categoryDialog = page.getByRole('dialog', { name: 'Nova categoria' })
  await categoryDialog.getByLabel('Nome da nova categoria').fill('Rascunho descartado')
  await page.keyboard.press('Escape')
  await categoryDialog.waitFor({ state: 'hidden' })
  assert.ok(await form.isVisible(), 'Esc deve fechar apenas o cadastro rápido')
  await categoryField.getByRole('button', { name: 'Criar categoria aqui' }).click()
  await categoryDialog.getByLabel('Nome da nova categoria').fill('Estudos novos')
  const formHeightAfter = await form.evaluate(element => element.scrollHeight)
  assert.equal(formHeightAfter, formHeightBefore, 'Criar categoria não deve aumentar nem deslocar o formulário')
  await page.screenshot({ path: join(artifacts, '01-categoria-sobreposta.png'), animations: 'disabled' })
  await categoryDialog.getByRole('button', { name: 'Criar e selecionar categoria' }).click()
  await categoryDialog.waitFor({ state: 'hidden' })
  const categoryId = await form.getByLabel('Categoria', { exact: true }).inputValue()
  assert.equal((await page.evaluate(() => window.electronAPI.getSnapshot())).categories.find(c => c.id === categoryId).name, 'Estudos novos')
  assert.equal(await form.getByLabel('Descrição', { exact: true }).inputValue(), 'Livro e café')
  assert.equal(await form.getByLabel('Valor (R$)').inputValue(), '49,90')

  const subField = form.getByLabel('Subcategoria (opcional)').locator('..')
  await subField.getByRole('button', { name: 'Criar subcategoria aqui' }).click()
  const subDialog = page.getByRole('dialog', { name: 'Nova subcategoria' })
  await subDialog.getByLabel('Nome da nova subcategoria').fill('Livros')
  await subDialog.getByRole('button', { name: 'Criar e selecionar subcategoria' }).click()
  await subDialog.waitFor({ state: 'hidden' })
  const subId = await form.getByLabel('Subcategoria (opcional)').inputValue()
  assert.equal((await page.evaluate(() => window.electronAPI.getSnapshot())).categories.find(c => c.id === subId).parentId, categoryId)

  const accountField = form.getByLabel('Conta', { exact: true }).locator('..')
  await accountField.getByRole('button', { name: 'Criar conta aqui' }).click()
  const accountDialog = page.getByRole('dialog', { name: 'Nova conta' })
  await accountDialog.getByLabel('Nome da nova conta').fill('Carteira do dia')
  await accountDialog.getByRole('button', { name: 'Criar e selecionar conta' }).click()
  await accountDialog.waitFor({ state: 'hidden' })
  const accountId = await form.getByLabel('Conta', { exact: true }).inputValue()
  assert.equal((await page.evaluate(() => window.electronAPI.getSnapshot())).accounts.find(a => a.id === accountId).name, 'Carteira do dia')

  const projectField = form.getByLabel('Projeto', { exact: true }).locator('..')
  await projectField.getByRole('button', { name: 'Criar projeto aqui' }).click()
  const projectDialog = page.getByRole('dialog', { name: 'Novo projeto' })
  await projectDialog.getByLabel('Nome do novo projeto').fill('Leituras')
  await projectDialog.getByRole('button', { name: 'Criar e selecionar projeto' }).click()
  await projectDialog.waitFor({ state: 'hidden' })
  const projectId = await form.getByLabel('Projeto', { exact: true }).inputValue()
  assert.equal((await page.evaluate(() => window.electronAPI.getSnapshot())).projects.find(p => p.id === projectId).name, 'Leituras')

  await form.getByRole('button', { name: 'Criar lançamento', exact: true }).click()
  await form.waitFor({ state: 'hidden' })
  const snapshot = await page.evaluate(() => window.electronAPI.getSnapshot())
  const entry = snapshot.transactions.find(t => t.description === 'Livro e café')
  assert.equal(entry?.categoryId, categoryId)
  assert.equal(entry?.subcategoryId, subId)
  assert.equal(entry?.accountId, accountId)
  assert.equal(entry?.projectId, projectId)
  assert.equal(entry?.amountCents, 4990)

  await page.getByRole('button', { name: 'Novo lançamento' }).click()
  const incomeForm = page.locator('.modal-panel form')
  await incomeForm.getByRole('button', { name: /Entrada Dinheiro que chegou/ }).click()
  await incomeForm.getByLabel('Descrição', { exact: true }).fill('Serviço prestado')
  await incomeForm.getByLabel('Valor (R$)').fill('100,00')
  const incomeCategory = incomeForm.getByLabel('Categoria', { exact: true }).locator('..')
  await incomeCategory.getByRole('button', { name: 'Criar categoria aqui' }).click()
  const incomeCategoryDialog = page.getByRole('dialog', { name: 'Nova categoria' })
  await incomeCategoryDialog.getByLabel('Nome da nova categoria').fill('Consultoria')
  await incomeCategoryDialog.getByRole('button', { name: 'Criar e selecionar categoria' }).click()
  await incomeCategoryDialog.waitFor({ state: 'hidden' })
  const incomeCategoryId = await incomeForm.getByLabel('Categoria', { exact: true }).inputValue()
  assert.equal((await page.evaluate(() => window.electronAPI.getSnapshot())).categories.find(c => c.id === incomeCategoryId)?.type, 'income')
  await incomeForm.getByLabel('Conta', { exact: true }).selectOption(accountId)
  await incomeForm.getByRole('button', { name: 'Criar lançamento', exact: true }).click()
  await incomeForm.waitFor({ state: 'hidden' })
  assert.equal((await page.evaluate(() => window.electronAPI.getSnapshot())).transactions.find(t => t.description === 'Serviço prestado')?.categoryId, incomeCategoryId)
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ status: 'passed', artifacts }))
} finally {
  if (app) await app.close().catch(() => {})
  rmSync(temporary, { recursive: true, force: true })
}
