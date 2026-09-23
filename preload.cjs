const { contextBridge, ipcRenderer } = require('electron')
const call = async (name, data) => {
  const result = await ipcRenderer.invoke(`purple:${name}`, data)
  if (!result.ok) throw new Error(result.error)
  return result.data
}
contextBridge.exposeInMainWorld('electronAPI', { ...Object.fromEntries([
  'getSnapshot', 'saveProject', 'saveAccount', 'saveCategory', 'saveTransaction', 'deleteTransaction', 'settleTransaction',
  'saveTransfer', 'deleteTransfer', 'saveGoal', 'deleteGoal', 'saveSettings', 'backup', 'restore', 'exportCsv', 'printReport', 'toggleFullscreen',
  'saveInvestment', 'deleteInvestment', 'refreshMarkets', 'searchAssets', 'assetHistory', 'providerStatus', 'saveProviderKey', 'importIcon',
  'setMarketStreaming',
  'saveCreditCard', 'saveCardPurchase', 'cancelCardPurchase', 'saveStatementDates', 'payCardStatement', 'undoCardStatementPayment',
  'saveBill', 'adoptBill', 'cancelBill', 'saveCommitment', 'payBill', 'undoPayment', 'saveLoan', 'saveProperty',
  'importAttachment', 'exportAttachment', 'deleteAttachment',
].map(name => [name, data => call(name, data)])), onMarketUpdate: callback => { const listener=()=>callback();ipcRenderer.on('purple:marketUpdate',listener);return ()=>ipcRenderer.removeListener('purple:marketUpdate',listener) } })
