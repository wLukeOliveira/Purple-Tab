import type { ElectronAPI } from './types'

export const isDesktop = Boolean(window.electronAPI)
export const api = window.electronAPI as ElectronAPI
