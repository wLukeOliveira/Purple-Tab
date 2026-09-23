import { app, BrowserWindow, dialog, ipcMain, Menu, shell, safeStorage, nativeImage } from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { FinanceStore } from './store.mjs'
import { MarketService } from './markets.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dev = process.argv.includes('--dev') && !app.isPackaged
const indexFile = path.join(root, 'dist', 'index.html')
const expectedUrl = dev ? 'http://localhost:5173/' : pathToFileURL(indexFile).href
app.setName('Purple Tab')
app.setPath('userData', process.env.PURPLE_TAB_DATA_DIR || path.join(app.getPath('appData'), 'Purple Tab'))
app.setAppUserModelId('br.purpletab.desktop')
let mainWindow
let store
let backupWarning = null
let backupTimer
let markets
const keyFile = path.join(app.getPath('userData'), 'market-keys.enc')
function providerKeys() {
  if (!existsSync(keyFile)) return {}
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Proteção de credenciais indisponível neste computador.')
  try { return JSON.parse(safeStorage.decryptString(readFileSync(keyFile))) }
  catch { throw new Error('Cadastre novamente as chaves de dados neste computador.') }
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
function text(value, max = 500) {
  if (typeof value !== 'string' || value.length > max) throw new Error('Conteúdo inválido para exportação.')
  return value
}
function rows(value) {
  if (!Array.isArray(value) || value.length > 20000) throw new Error('Exporte no máximo 20.000 linhas por vez.')
  return value.map(row => {
    if (!Array.isArray(row) || row.length > 30) throw new Error('Colunas inválidas.')
    return row.map(cell => text(cell, 4000))
  })
}
function snapshot() {
  store.atomic(() => store.materializeBills())
  const result = store.snapshot()
  result.meta.appVersion = app.getVersion()
  result.meta.backupWarning = backupWarning
  return result
}
function autoBackup() {
  try { store.automaticBackup(); backupWarning = null }
  catch (error) { backupWarning = `O backup automático não foi concluído: ${error.message}` }
}
function handle(name, action) {
  ipcMain.handle(`purple:${name}`, async (event, data) => {
    try {
      if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || event.senderFrame.url !== expectedUrl) throw new Error('Origem não autorizada.')
      return { ok: true, data: await action(data) }
    } catch (error) { return { ok: false, error: error.message || 'Não foi possível concluir a operação.' } }
  })
}
function registerHandlers() {
  for (const name of ['saveCreditCard','saveCardPurchase','cancelCardPurchase','saveStatementDates','payCardStatement','undoCardStatementPayment']) handle(name, data => store[name](data))
  for (const name of ['saveBill','adoptBill','cancelBill','saveCommitment','payBill','undoPayment','saveLoan','saveProperty']) handle(name, data => store[name](data))
  handle('importAttachment', async data => {
    const selection = await dialog.showOpenDialog(mainWindow, { title: 'Anexar boleto, comprovante ou documento', properties: ['openFile'], filters: [{ name: 'PDF ou imagem', extensions: ['pdf','png','jpg','jpeg','webp'] }] })
    if (selection.canceled || !selection.filePaths[0]) return { canceled: true }
    const file = selection.filePaths[0]
    if ((await stat(file)).size > 5 * 1024 * 1024) throw new Error('Escolha um arquivo de até 5 MB.')
    return store.saveAttachment({ ownerType: data?.ownerType, ownerId: data?.ownerId, name: path.basename(file), data: (await readFile(file)).toString('base64') })
  })
  handle('exportAttachment', async data => {
    const attachment = store.attachmentData(data)
    const target = await dialog.showSaveDialog(mainWindow, { title: 'Salvar cópia do anexo', defaultPath: attachment.name })
    if (target.canceled || !target.filePath) return { canceled: true }
    await writeFile(target.filePath, Buffer.from(attachment.data, 'base64'))
    return { saved: true }
  })
  handle('deleteAttachment', data => store.deleteAttachment(data))
  handle('getSnapshot', snapshot)
  for (const name of ['saveProject', 'saveAccount', 'saveCategory', 'saveTransaction', 'deleteTransaction', 'settleTransaction', 'saveTransfer', 'deleteTransfer', 'saveGoal', 'deleteGoal', 'saveSettings', 'saveInvestment', 'deleteInvestment']) handle(name, data => store[name](data))
  handle('refreshMarkets', () => process.env.PURPLE_TAB_TEST_HEADLESS ? { errors: [] } : markets.refresh())
  handle('searchAssets', data => markets.search(data))
  handle('assetHistory', data => markets.history(data))
  handle('setMarketStreaming', enabled => { if(typeof enabled!=='boolean') throw new Error('Estado inválido.'); if(!process.env.PURPLE_TAB_TEST_HEADLESS) markets.streaming(enabled,()=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('purple:marketUpdate')}); return {enabled} })
  handle('providerStatus', () => { const keys=providerKeys();return {twelve:Boolean(keys.twelve),brapi:Boolean(keys.brapi)} })
  handle('saveProviderKey', data => {
    if (!['twelve','brapi'].includes(data?.provider) || typeof data?.key !== 'string' || data.key.length>500 || /[\r\n]/.test(data.key)) throw new Error('Credencial inválida.')
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Proteção de credenciais indisponível.')
    let keys; try { keys=providerKeys() } catch { keys={} }
    keys[data.provider]=data.key.trim()
    writeFileSync(keyFile,safeStorage.encryptString(JSON.stringify(keys)))
    markets.lastRefresh=0
    return {saved:true}
  })
  handle('importIcon', async () => {
    const selection=await dialog.showOpenDialog(mainWindow,{title:'Escolher ícone',properties:['openFile'],filters:[{name:'Imagem',extensions:['png','jpg','jpeg','webp']}]})
    if(selection.canceled || !selection.filePaths[0]) return {canceled:true}
    const file=selection.filePaths[0]
    if((await stat(file)).size>4*1024*1024) throw new Error('Escolha uma imagem de até 4 MB.')
    const source=nativeImage.createFromBuffer(await readFile(file))
    if(source.isEmpty()) throw new Error('Não foi possível ler esta imagem.')
    const size=source.getSize(),edge=Math.min(size.width,size.height)
    const normalized=source.crop({x:Math.floor((size.width-edge)/2),y:Math.floor((size.height-edge)/2),width:edge,height:edge}).resize({width:128,height:128})
    return {canceled:false,icon:normalized.toDataURL()}
  })
  handle('toggleFullscreen', () => {
    mainWindow.setFullScreen(!mainWindow.isFullScreen())
    return mainWindow.isFullScreen()
  })
  handle('backup', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar backup do Purple Tab', defaultPath: `Purple-Tab-${new Date().toISOString().slice(0, 10)}.purpletab`,
      filters: [{ name: 'Backup Purple Tab', extensions: ['purpletab'] }],
    })
    if (canceled || !filePath) return { canceled: true }
    store.backupTo(filePath)
    return { canceled: false, path: filePath }
  })
  handle('restore', async () => {
    const selection = await dialog.showOpenDialog(mainWindow, { title: 'Selecionar backup', properties: ['openFile'], filters: [{ name: 'Backup Purple Tab', extensions: ['purpletab', 'sqlite', 'db'] }] })
    if (selection.canceled || !selection.filePaths[0]) return { canceled: true }
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning', title: 'Restaurar backup', message: 'Substituir os dados atuais pelos dados deste backup?',
      detail: 'Uma cópia preventiva dos dados atuais será criada. Projetos, lançamentos e preferências serão substituídos.',
      buttons: ['Cancelar', 'Restaurar backup'], defaultId: 0, cancelId: 0, noLink: true,
    })
    if (response !== 1) return { canceled: true }
    const result = store.restoreFrom(selection.filePaths[0])
    autoBackup()
    return { ...result, canceled: false, restored: true }
  })
  handle('exportCsv', async data => {
    const content = rows(data?.rows).map(row => row.map(cell => {
      const safe = /^[\s]*[=+\-@]/.test(cell) ? `'${cell}` : cell
      return `"${safe.replaceAll('"', '""')}"`
    }).join(';')).join('\r\n')
    const filename = path.basename(text(data.filename, 150)).replace(/[^\p{L}\p{N}_. -]/gu, '-')
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { title: 'Exportar relatório CSV', defaultPath: filename || 'relatorio.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] })
    if (canceled || !filePath) return { canceled: true }
    await writeFile(filePath, `\ufeff${content}`, 'utf8')
    return { canceled: false, path: filePath }
  })
  handle('printReport', async data => {
    const title = text(data?.title)
    const subtitle = text(data?.subtitle, 2000)
    const tableRows = rows(data?.rows)
    const headers = rows([data?.headers])[0]
    const totals = rows([data?.totals])[0]
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { title: 'Salvar relatório PDF', defaultPath: 'Purple-Tab-relatorio.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    if (canceled || !filePath) return { canceled: true }
    const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
    try {
      const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>@page{margin:15mm}body{font:11px Arial;color:#172033}h1{color:#7045d5;font-size:24px}p{white-space:pre-line}table{width:100%;border-collapse:collapse}th,td{padding:7px;border-bottom:1px solid #ddd;text-align:left;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}.totals{padding:14px;background:#f1edff;margin:16px 0}</style><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p><div class="totals">${totals.map(escapeHtml).join(' · ')}</div><table><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${tableRows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table><p>Purple Tab · Gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))}</p></html>`
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      const pdf = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4', landscape: headers.length > 7 })
      await writeFile(filePath, pdf)
    } finally { printWindow.destroy() }
    return { canceled: false, path: filePath }
  })
}
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1460, height: 950, minWidth: 1000, minHeight: 700, show: false,
    title: 'Purple Tab', backgroundColor: '#101116',
    webPreferences: { preload: path.join(root, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/www\.tradingview\.com(?:\/|$)/.test(url)) void shell.openExternal('https://www.tradingview.com/')
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== expectedUrl) {
      event.preventDefault()
      if (/^https:\/\/www\.tradingview\.com(?:\/|$)/.test(url)) void shell.openExternal('https://www.tradingview.com/')
    }
  })
  mainWindow.once('ready-to-show', () => { if (!process.env.PURPLE_TAB_TEST_HEADLESS) mainWindow.show() })
  mainWindow.on('closed', () => { mainWindow = null })
  if (dev) await mainWindow.loadURL(expectedUrl)
  else await mainWindow.loadFile(indexFile)
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus() } })
  app.whenReady().then(async () => {
    try {
      Menu.setApplicationMenu(null)
      await mkdir(app.getPath('userData'), { recursive: true })
      store = new FinanceStore(path.join(app.getPath('userData'), 'purple-tab.sqlite'))
      markets = new MarketService(store, provider => providerKeys()[provider] || '')
      autoBackup()
      registerHandlers()
      backupTimer = setInterval(autoBackup, 60 * 60 * 1000)
      await createWindow()
    } catch (error) {
      console.error(error)
      dialog.showErrorBox('Purple Tab não pôde iniciar', `${error.message}\n\nOs dados existentes foram preservados. Pasta: ${app.getPath('userData')}`)
      app.quit()
    }
  })
  app.on('activate', () => { if (store && !mainWindow) createWindow() })
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
  app.on('before-quit', () => { clearInterval(backupTimer); markets?.close(); store?.close() })
}
