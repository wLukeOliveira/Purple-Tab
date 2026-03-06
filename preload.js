const { contextBridge, ipcRenderer } = require('electron');

// Expor APIs seguras para o processo de renderização
contextBridge.exposeInMainWorld('electronAPI', {
  // Aqui podemos expor funções para manipulação de arquivos locais
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  loadData: () => ipcRenderer.invoke('load-data'),
  
  // Para desenvolvimento
  platform: process.platform
});
