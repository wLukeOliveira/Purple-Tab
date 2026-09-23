/* global window */
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { _electron } from 'playwright'
import electron from 'electron'

const data = mkdtempSync(path.join(tmpdir(), 'purple-tab-dev-smoke-'))
const env = { ...process.env, PURPLE_TAB_DATA_DIR: data, PURPLE_TAB_TEST_HEADLESS: '1' }
delete env.ELECTRON_RUN_AS_NODE
const server = await createServer()
let app
try {
  await server.listen()
  app = await _electron.launch({ executablePath: electron, args: ['.', '--dev'], env })
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.locator('.app-main').waitFor()
  const snapshot = await page.evaluate(() => window.electronAPI.getSnapshot())
  assert.equal(snapshot.projects.length, 1)
  assert.equal(snapshot.transactions.length, 0)
  assert.ok(page.url().startsWith('http://localhost:5173/'))
  assert.deepEqual(errors, [])
  console.log('PASS development: React Refresh, Vite, preload isolado e SQLite sem erros de CSP/renderização.')
} finally {
  await app?.close()
  await server.close()
}
