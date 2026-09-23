export const CURRENCIES = ['BRL','USD','EUR','GBP','CAD','AUD','CHF','JPY','CNY','ARS','CLP','MXN','NZD','SGD','HKD','INR','ZAR','SEK','NOK','DKK','PLN','KRW','TRY','ILS','IDR','THB','MYR','PHP','CZK','HUF','RON','ISK']
export function currency(value = 'BRL') {
  if (!CURRENCIES.includes(value)) throw new Error('Moeda não suportada. Escolha uma moeda da lista.')
  return value
}
export function icon(value = '') {
  if (typeof value !== 'string' || value.length > 180000 || (!/^[a-z0-9-]{0,40}$/.test(value) && !/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(value))) throw new Error('Ícone inválido. Importe uma imagem pelo aplicativo.')
  return value
}
export function investmentInput(input, store, old = null) {
  if (!input || typeof input !== 'object') throw new Error('Investimento inválido.')
  const str = (name, max = 160) => { const value = input[name] ?? ''; if (typeof value !== 'string' || value.length > max) throw new Error(`Campo ${name} inválido.`); return value.trim() }
  const choose = (name, values) => { if (!values.includes(input[name])) throw new Error(`Campo ${name} inválido.`); return input[name] }
  const number = (name, max = 1e12) => { const value = input[name]; if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) throw new Error(`Campo ${name}: informe um número válido.`); return value }
  const date = value => { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw new Error('Data do investimento inválida.'); return value }
  const row = {
    id: old?.id, name: str('name'), symbol: str('symbol', 80), kind: choose('kind', ['fixed','crypto','stock','etf','fii','fund','bond','commodity','other']),
    provider: choose('provider', ['manual','coinbase','brapi','twelve']), currency: currency(input.currency), exchange: str('exchange', 80), icon: icon(input.icon),
    accountId: input.accountId || null, projectId: input.projectId || null, quantity: number('quantity'), costPrice: number('costPrice'), fees: number('fees'), openedDate: date(input.openedDate),
    benchmark: choose('benchmark', ['cdi','selic','fixed']), rate: number('rate', 10000), taxMode: choose('taxMode', ['regressive','fixed','exempt']), taxPercent: number('taxPercent',100), annualFeePercent: number('annualFeePercent',100), iof: input.iof,
    manualPrice: input.manualPrice == null ? null : number('manualPrice'), closedDate: input.closedDate ? date(input.closedDate) : null, salePrice: input.salePrice == null ? null : number('salePrice'),
  }
  if (!row.name || typeof row.iof !== 'boolean') throw new Error('Informe nome e tributação do investimento.')
  const today = new Date().toLocaleDateString('en-CA')
  if (row.openedDate > today) throw new Error('O aporte não pode estar no futuro. Use o simulador para projeções.')
  if (row.accountId) store.reference('accounts', row.accountId, 'Conta de custódia', old?.accountId)
  if (row.projectId) store.reference('projects', row.projectId, 'Projeto', old?.projectId)
  if (row.kind === 'fixed' && (row.currency !== 'BRL' || row.quantity !== 1 || row.costPrice <= 0)) throw new Error('Renda fixa brasileira: cadastre um aporte positivo em BRL por lote.')
  if (row.provider !== 'manual' && !row.symbol) throw new Error('Informe o símbolo do ativo no provedor.')
  if (row.provider === 'coinbase' && (!/^[A-Z0-9]{1,20}-[A-Z]{3}$/.test(row.symbol) || row.symbol.split('-')[1] !== row.currency)) throw new Error('O par da Coinbase deve terminar na moeda escolhida, por exemplo BTC-USD.')
  if (row.provider === 'brapi' && row.currency !== 'BRL') throw new Error('Os ativos B3 da brapi são cotados em BRL.')
  if (row.closedDate && (row.closedDate < row.openedDate || row.closedDate > today || row.salePrice === null)) throw new Error('Informe data válida e preço de venda/resgate para encerrar o lote.')
  if (!Number.isSafeInteger(Math.round((row.quantity * row.costPrice + row.fees) * 100))) throw new Error('Valor do investimento excede o limite suportado.')
  return row
}
