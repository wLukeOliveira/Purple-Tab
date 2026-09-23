import { randomUUID } from 'node:crypto'
import { currency, icon } from './investments.mjs'

export const PLANNING_SCHEMA = `
CREATE TABLE commitments (id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE bills (id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE payments (id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE loans (id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE property_assets (id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE attachments (id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
`
const fail = message => { throw new Error(message) }
const text = (value, label, max = 300) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${label}: informe um texto válido.`)
  return value.trim()
}
const optional = (value, max = 4000) => value ? text(value, 'Texto', max) : ''
const cents = (value, positive = false) => {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) fail('Informe um valor válido em centavos.')
  return value
}
const signed = value => {
  if (!Number.isSafeInteger(value)) fail('Ajuste inválido.')
  return value
}
const flag = value => { if (value !== undefined && typeof value !== 'boolean') fail('Informe verdadeiro ou falso.'); return value ?? false }
const date = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31' || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) fail('Data inválida.')
  return value
}
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const shiftMonth = (value, count) => {
  const [year, month, day] = date(value).split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1 + count, 1, 12))
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()))
  return date(d.toISOString().slice(0, 10))
}
const all = (store, table) => store.db.prepare(`SELECT value FROM ${table} ORDER BY rowid`).all().map(r => JSON.parse(r.value))
const get = (store, table, id) => { const r = store.db.prepare(`SELECT value FROM ${table} WHERE id=?`).get(text(id, 'Identificador')); return r ? JSON.parse(r.value) : null }
const requireRow = (store, table, id) => get(store, table, id) || fail('Registro não encontrado.')
const put = (store, table, row) => store.db.prepare(`INSERT INTO ${table} VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value`).run(row.id, JSON.stringify(row))
const remove = (store, table, id) => store.db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id)
const paid = (store, billId) => all(store, 'payments').filter(p => p.billId === billId)
const applied = (store, billId) => paid(store, billId).reduce((sum, p) => sum + p.appliedCents, 0)
const settings = store => JSON.parse(store.db.prepare('SELECT value FROM settings WHERE id=1').get().value)
function references(store, input, old = {}) {
  store.reference('projects', input.projectId, 'Projeto', old?.projectId)
  const category = store.reference('categories', input.categoryId, 'Categoria', old?.categoryId)
  if (category.type !== 'expense' || category.parentId) fail('Escolha uma categoria principal de despesa.')
  const accountId = input.accountId || null
  if (accountId) {
    const account = store.reference('accounts', accountId, 'Conta', old?.accountId)
    if ((account.currency || 'BRL') !== input.currency) fail('A conta precisa usar a mesma moeda do compromisso.')
  }
  return accountId
}
function billInput(store, input, old) {
  const row = { id: old?.id || randomUUID(), name: text(input.name, 'Nome'), currency: currency(input.currency), projectId: input.projectId, categoryId: input.categoryId, accountId: input.accountId || null,
    dueDate: date(input.dueDate), amountCents: input.amountCents == null ? null : cents(input.amountCents, true), estimateCents: cents(input.estimateCents || 0), notes: optional(input.notes),
    templateId: old?.templateId || null, loanId: old?.loanId || null, principalCents: old?.principalCents || 0, pendingId: old?.pendingId || null, canceled: old?.canceled || false }
  row.accountId = references(store, row, old)
  if (old && paid(store, old.id).length && (row.currency !== old.currency || row.projectId !== old.projectId || row.categoryId !== old.categoryId || row.amountCents !== old.amountCents)) fail('Desfaça os pagamentos antes de alterar valor, moeda, categoria ou projeto.')
  if (row.amountCents !== null && !row.accountId) fail('Selecione uma conta para provisionar esta conta confirmada.')
  return row
}
function syncBill(store, bill) {
  const remaining = bill.amountCents === null ? 0 : bill.amountCents - applied(store, bill.id)
  if (remaining < 0) fail('Os pagamentos ultrapassam o valor da conta.')
  if (remaining > 0 && !bill.canceled) {
    const old = bill.pendingId ? store.row('transactions', bill.pendingId) : null
    const transaction = store.transactionInput({ description: bill.name, type: 'expense', amountCents: remaining, accountId: bill.accountId, projectId: bill.projectId, categoryId: bill.categoryId, subcategoryId: bill.subcategoryId, paymentMethod: bill.creditCardId ? 'credit' : undefined, dueDate: bill.dueDate, status: 'pending', paidDate: null, notes: bill.notes }, old)
    store.writeTransaction(transaction)
    bill.pendingId = transaction.id
  } else if (bill.pendingId) {
    remove(store, 'transactions', bill.pendingId)
    bill.pendingId = null
  }
  put(store, 'bills', bill)
  return bill
}

export function writeLinkedBill(store, input, metadata, old = null) {
  return syncBill(store, { ...billInput(store, input, old), ...(old || {}), ...metadata, dueDate: input.dueDate })
}

export function planningSnapshot(store, transactions) {
  const commitments = all(store, 'commitments'), bills = all(store, 'bills'), payments = all(store, 'payments'), loans = all(store, 'loans'), assets = all(store, 'property_assets')
  const linked = new Map()
  for (const bill of bills) if (bill.pendingId) {
    const paymentsForBill = payments.filter(p => p.billId === bill.id)
    const remaining = bill.amountCents - paymentsForBill.reduce((sum, p) => sum + p.appliedCents, 0)
    const principal = bill.principalCents - paymentsForBill.reduce((sum, p) => sum + p.principalCents, 0)
    linked.set(bill.pendingId, { billId: bill.id, loanId: bill.loanId, creditCardId: bill.creditCardId, cardPurchaseId: bill.cardPurchaseId, statementId: bill.statementId, ...(bill.loanId ? { economicCents: remaining - principal } : {}) })
  }
  for (const payment of payments) { const bill = bills.find(b => b.id === payment.billId); linked.set(payment.transactionId, { billId: payment.billId, paymentId: payment.id, creditCardId: bill?.creditCardId, cardPurchaseId: bill?.cardPurchaseId, statementId: bill?.statementId, economicCents: payment.totalCents - payment.principalCents }) }
  for (const loan of loans) if (loan.disbursementId) linked.set(loan.disbursementId, { loanId: loan.id, economicCents: 0 })
  const attachments = all(store, 'attachments').map(({ data, ...metadata }) => ({ ...metadata, size: Buffer.from(data, 'base64').length }))
  return { commitments, bills, payments, loans, assets, attachments, transactions: transactions.map(t => ({ ...t, ...linked.get(t.id) })) }
}
export function assertUnmanaged(store, ids) {
  if (store.db.prepare('PRAGMA user_version').get().user_version < 3) return
  const linked = new Set([...all(store, 'bills').map(b => b.pendingId), ...all(store, 'payments').map(p => p.transactionId), ...all(store, 'loans').map(l => l.disbursementId)])
  if (ids.some(id => linked.has(id))) fail('Gerencie este registro em Contas a pagar ou Financiamentos, para preservar o vínculo e os saldos.')
}
export const planningMethods = {
  saveAttachment(input) {
    const ownerTable = { bill: 'bills', property: 'property_assets', loan: 'loans' }[input.ownerType]
    if (!ownerTable) fail('Destino do anexo inválido.')
    requireRow(this, ownerTable, input.ownerId)
    if (typeof input.data !== 'string' || input.data.length > 7_000_000) fail('O anexo deve ter até 5 MB.')
    const data = Buffer.from(input.data, 'base64')
    const extension = data.subarray(0, 5).toString() === '%PDF-' ? 'pdf' : data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' : data[0] === 255 && data[1] === 216 && data[2] === 255 ? 'jpg' : data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP' ? 'webp' : null
    if (!extension || !data.length || data.length > 5 * 1024 * 1024) fail('Escolha um PDF, PNG, JPG ou WebP de até 5 MB.')
    if (all(this, 'attachments').filter(a => a.ownerType === input.ownerType && a.ownerId === input.ownerId).length >= 30) fail('Limite de 30 anexos por registro.')
    const row = { id: randomUUID(), ownerType: input.ownerType, ownerId: input.ownerId, name: text(input.name, 'Nome do arquivo', 180).replace(/[<>:"/\\|?*\p{Cc}]/gu, '_').replace(/\.[^.]+$/, '') + `.${extension}`, data: data.toString('base64'), createdAt: new Date().toISOString() }
    put(this, 'attachments', row)
    return { id: row.id }
  },
  attachmentData({ id }) { return requireRow(this, 'attachments', id) },
  deleteAttachment({ id }) { requireRow(this, 'attachments', id); remove(this, 'attachments', id); return { deleted: true } },
  saveBill(input) {
    const old = input.id ? requireRow(this, 'bills', input.id) : null
    if (old?.creditCardId) fail('Edite a compra ou as datas da fatura na área Cartões.')
    if (old?.loanId && (input.amountCents !== old.amountCents || input.currency !== old.currency || input.projectId !== old.projectId || input.categoryId !== old.categoryId)) fail('Valor, moeda, categoria e projeto da parcela pertencem ao cronograma do contrato.')
    const row = billInput(this, input, old)
    return this.atomic(() => syncBill(this, row))
  },
  adoptBill({ id }) {
    const old = this.existing('transactions', id, 'Lançamento')
    if (old.type !== 'expense' || old.status !== 'pending') fail('Selecione uma despesa pendente.')
    const existing = all(this, 'bills').find(b => b.pendingId === id)
    if (existing) return existing
    const bill = billInput(this, { name: old.description, amountCents: old.amountCents, estimateCents: 0, currency: this.row('accounts', old.accountId).currency, accountId: old.accountId, projectId: old.projectId, categoryId: old.categoryId, dueDate: old.dueDate, notes: old.notes }, null)
    bill.pendingId = old.id
    put(this, 'bills', bill)
    return bill
  },
  cancelBill({ id, canceled }) {
    if (typeof canceled !== 'boolean') fail('Situação inválida.')
    const bill = requireRow(this, 'bills', id)
    if (bill.creditCardId) fail('Cancele a compra na área Cartões para preservar o limite e as parcelas.')
    if (paid(this, id).length) fail('Desfaça os pagamentos antes de cancelar a conta.')
    if (bill.loanId) fail('Uma parcela de contrato não pode ser cancelada isoladamente. Ajuste o cronograma do contrato.')
    return this.atomic(() => syncBill(this, { ...bill, canceled }))
  },
  saveCommitment(input) {
    const old = input.id ? requireRow(this, 'commitments', input.id) : null
    const base = billInput(this, { ...input, dueDate: input.startDate }, old)
    const row = { id: old?.id || randomUUID(), name: base.name, currency: base.currency, accountId: base.accountId, projectId: base.projectId, categoryId: base.categoryId, amountCents: base.amountCents, estimateCents: base.estimateCents, notes: base.notes, startDate: date(input.startDate), endDate: input.endDate ? date(input.endDate) : null, paused: flag(input.paused), estimateMode: input.estimateMode || 'last' }
    if (!['last', 'average', 'manual'].includes(row.estimateMode)) fail('Previsão inválida.')
    if (row.startDate < shiftMonth(localToday(), -120) || (row.endDate && row.endDate < row.startDate)) fail('Revise o período da recorrência (início até 10 anos atrás).')
    if (old && row.startDate !== old.startDate) fail('Crie outra recorrência para alterar a data inicial; o histórico será preservado.')
    return this.atomic(() => { put(this, 'commitments', row); this.materializeBills(); return row })
  },
  materializeBills(asOf = localToday()) {
    const horizon = shiftMonth(date(asOf), 2)
    for (const template of all(this, 'commitments').filter(t => !t.paused)) {
      if (this.row('projects', template.projectId)?.archived || this.row('categories', template.categoryId)?.archived || (template.accountId && this.row('accounts', template.accountId)?.archived)) continue
      // The original day is always used, so January 31 becomes February 28 and March 31.
      for (let index = 0; index < 1500; index++) {
        const dueDate = shiftMonth(template.startDate, index)
        if (dueDate > horizon || (template.endDate && dueDate > template.endDate)) break
        const id = `${template.id}:${dueDate.slice(0, 7)}`
        const existing = get(this, 'bills', id)
        const previous = all(this, 'bills').filter(b => b.templateId === template.id && b.currency === template.currency && b.amountCents != null && !b.canceled && b.dueDate < dueDate).sort((a, b) => b.dueDate.localeCompare(a.dueDate)).slice(0, template.estimateMode === 'average' ? 3 : 1)
        const estimateCents = template.estimateMode !== 'manual' && previous.length ? Math.round(previous.reduce((sum, b) => sum + b.amountCents, 0) / previous.length) : template.estimateCents
        if (existing) {
          if (existing.amountCents === null && existing.currency === template.currency && !existing.canceled && existing.estimateCents !== estimateCents) put(this, 'bills', { ...existing, estimateCents })
          continue
        }
        const bill = { ...template, id, dueDate, estimateCents, templateId: template.id, pendingId: null, loanId: null, principalCents: 0, canceled: false }
        syncBill(this, bill)
      }
    }
  },
  payBill(input) {
    const id = text(input.requestId, 'Identificador do pagamento', 100)
    const duplicate = get(this, 'payments', id)
    if (duplicate) { if (duplicate.billId !== input.billId) fail('Identificador já utilizado.'); return duplicate }
    const bill = requireRow(this, 'bills', input.billId)
    if (bill.canceled || bill.amountCents === null) fail('Confirme o valor da conta antes de dar baixa.')
    const remaining = bill.amountCents - applied(this, bill.id)
    const covered = cents(input.appliedCents ?? remaining, true)
    if (covered > remaining) fail('A baixa ultrapassa o valor pendente.')
    const interestCents = cents(input.interestCents || 0), fineCents = cents(input.fineCents || 0), feeCents = cents(input.feeCents || 0), discountCents = cents(input.discountCents || 0)
    const totalCents = cents(input.totalCents ?? covered + interestCents + fineCents + feeCents - discountCents, true)
    const adjustmentCents = signed(totalCents - covered - interestCents - fineCents - feeCents + discountCents)
    const accountId = input.accountId || bill.accountId || settings(this).defaultAccountId
    const account = this.reference('accounts', accountId, 'Conta de pagamento')
    if ((account.currency || 'BRL') !== bill.currency) fail('O pagamento precisa usar uma conta da mesma moeda. Registre o câmbio como transferência primeiro.')
      const paidDate = date(input.paidDate || localToday())
      if (bill.cardPurchaseId && paidDate < requireRow(this, 'card_purchases', bill.cardPurchaseId).purchaseDate) fail('O pagamento não pode anteceder a compra no cartão.')
    const prior = paid(this, bill.id)
    const principalCents = bill.loanId ? Math.round((applied(this, bill.id) + covered) / bill.amountCents * bill.principalCents) - prior.reduce((sum, p) => sum + p.principalCents, 0) : 0
    if (totalCents < principalCents) fail('A baixa não pode reduzir mais principal que o valor pago. Ajuste o cronograma para uma renegociação.')
    return this.atomic(() => {
      const transaction = this.transactionInput({ description: bill.name, type: 'expense', amountCents: totalCents, accountId, projectId: bill.projectId, categoryId: bill.categoryId, subcategoryId: bill.subcategoryId, paymentMethod: bill.creditCardId ? 'credit' : undefined, dueDate: paidDate, paidDate, status: 'settled', notes: `Vencimento original: ${bill.dueDate}. ${optional(input.notes)}` })
      this.writeTransaction(transaction)
      const payment = { id, billId: bill.id, transactionId: transaction.id, accountId, paidDate, appliedCents: covered, totalCents, interestCents, fineCents, feeCents, discountCents, adjustmentCents, principalCents, notes: optional(input.notes) }
      put(this, 'payments', payment)
      syncBill(this, bill)
      return payment
    })
  },
  undoPayment({ id }) {
    const payment = requireRow(this, 'payments', id), bill = requireRow(this, 'bills', payment.billId)
    // Reverse in order so proportional principal rounding remains deterministic.
    if (paid(this, bill.id).at(-1)?.id !== id) fail('Desfaça primeiro o pagamento mais recente desta conta.')
    return this.atomic(() => { remove(this, 'transactions', payment.transactionId); remove(this, 'payments', id); syncBill(this, bill); return { undone: true } })
  },
  saveLoan(input) {
    const old = input.id ? requireRow(this, 'loans', input.id) : null
    const row = { id: old?.id || randomUUID(), name: text(input.name, 'Contrato'), institution: optional(input.institution, 160), currency: currency(input.currency), projectId: input.projectId, categoryId: input.categoryId, accountId: input.accountId,
      contractedCents: cents(input.contractedCents, true), openingBalanceCents: cents(input.openingBalanceCents, true), openingDate: date(input.openingDate), rateNotes: optional(input.rateNotes), notes: optional(input.notes), disbursementId: old?.disbursementId || null }
    references(this, row, old)
    if (!row.accountId || row.openingDate > localToday()) fail('Informe uma conta e uma data de referência até hoje.')
    if (!Array.isArray(input.schedule) || !input.schedule.length || input.schedule.length > 600) fail('Informe de 1 a 600 parcelas do cronograma.')
    const schedule = input.schedule.map(item => ({ dueDate: date(item.dueDate), principalCents: cents(item.principalCents), interestCents: cents(item.interestCents) }))
    if (schedule.some(item => item.dueDate < row.openingDate || item.principalCents + item.interestCents <= 0) || schedule.reduce((sum, item) => sum + item.principalCents, 0) !== row.openingBalanceCents) fail('A soma das amortizações deve coincidir com o saldo devedor de referência; revise as datas e os valores.')
    const existingBills = old ? all(this, 'bills').filter(b => b.loanId === old.id) : []
    if (old && (existingBills.some(b => paid(this, b.id).length) || old.disbursementId)) fail('Um contrato com movimentações não pode ser reescrito. Desfaça as baixas antes de ajustar o cronograma.')
    if (existingBills.some(b => all(this, 'attachments').some(a => a.ownerType === 'bill' && a.ownerId === b.id))) fail('As parcelas têm documentos. Exporte e remova esses anexos antes de substituir o cronograma.')
    const receiveFunds = flag(input.receiveFunds)
    return this.atomic(() => {
      for (const bill of existingBills) { if (bill.pendingId) remove(this, 'transactions', bill.pendingId); remove(this, 'bills', bill.id) }
      if (!old && receiveFunds) {
        const category = this.db.prepare("SELECT id FROM categories WHERE type='income' AND parentId IS NULL AND archived=0 LIMIT 1").get()
        if (!category) fail('Cadastre uma categoria principal de entrada antes de registrar o crédito.')
        const transaction = this.transactionInput({ description: `Crédito do contrato: ${row.name}`, type: 'income', amountCents: row.openingBalanceCents, accountId: row.accountId, projectId: row.projectId, categoryId: category.id, dueDate: row.openingDate, paidDate: row.openingDate, status: 'settled', notes: 'Entrada de capital emprestado; não é receita.' })
        this.writeTransaction(transaction); row.disbursementId = transaction.id
      }
      put(this, 'loans', row)
      schedule.forEach((item, index) => {
        const bill = billInput(this, { name: `${row.name} · ${index + 1}/${schedule.length}`, currency: row.currency, projectId: row.projectId, categoryId: row.categoryId, accountId: row.accountId, dueDate: item.dueDate, amountCents: item.principalCents + item.interestCents, notes: `Cronograma informado. Principal: ${item.principalCents / 100}; encargos contratuais: ${item.interestCents / 100}.` }, null)
        bill.loanId = row.id; bill.principalCents = item.principalCents; syncBill(this, bill)
      })
      return row
    })
  },
  saveProperty(input) {
    const old = input.id ? requireRow(this, 'property_assets', input.id) : null
    const row = { id: old?.id || randomUUID(), name: text(input.name, 'Nome do bem'), kind: text(input.kind, 'Categoria', 100), icon: icon(input.icon || 'home'), currency: currency(input.currency), projectId: input.projectId || null,
      acquisitionDate: date(input.acquisitionDate), acquisitionCents: cents(input.acquisitionCents), ownershipPercent: Number(input.ownershipPercent), loanId: input.loanId || null, notes: optional(input.notes), archived: flag(input.archived), valuations: input.valuations }
    if (row.acquisitionDate > localToday() || !Number.isFinite(row.ownershipPercent) || row.ownershipPercent <= 0 || row.ownershipPercent > 100) fail('Revise a data de aquisição e sua participação (0 a 100%).')
    if (row.projectId) this.reference('projects', row.projectId, 'Projeto', old?.projectId)
    if (row.loanId) {
      const loan = requireRow(this, 'loans', row.loanId)
      if (loan.currency !== row.currency) fail('Bem e financiamento devem usar a mesma moeda.')
      if (all(this, 'property_assets').some(a => a.id !== row.id && a.loanId === row.loanId && !a.archived)) fail('Este contrato já está vinculado a outro bem.')
    }
    if (!Array.isArray(row.valuations) || !row.valuations.length || row.valuations.length > 500) fail('Informe ao menos uma avaliação (máximo 500).')
    row.valuations = row.valuations.map(v => ({ date: date(v.date), valueCents: cents(v.valueCents), source: optional(v.source, 300) }))
    if (row.valuations.some(v => v.date > localToday() || v.date < row.acquisitionDate) || new Set(row.valuations.map(v => v.date)).size !== row.valuations.length) fail('As avaliações devem ter datas únicas entre a aquisição e hoje.')
    row.valuations.sort((a, b) => a.date.localeCompare(b.date))
    put(this, 'property_assets', row)
    return row
  },
}

// Read-only validation used before accepting a backup. Never materialize future bills here.
export function validatePlanning(store) {
  const bills = all(store, 'bills'), payments = all(store, 'payments'), loans = all(store, 'loans')
  const seen = new Set()
  for (const table of ['commitments', 'bills', 'payments', 'loans', 'property_assets', 'attachments']) for (const record of store.db.prepare(`SELECT id,value FROM ${table}`).all()) {
    const row = JSON.parse(record.value)
    if (row.id !== record.id) fail('Identificador inconsistente no backup.')
  }
  for (const bill of bills) {
    billInput(store, bill, bill)
    if (bill.templateId) requireRow(store, 'commitments', bill.templateId)
    if (bill.loanId) requireRow(store, 'loans', bill.loanId)
    const remaining = bill.amountCents === null ? 0 : bill.amountCents - applied(store, bill.id)
    if (remaining < 0 || (!bill.canceled && remaining > 0) !== Boolean(bill.pendingId)) fail('Pendência inconsistente no backup.')
    if (bill.pendingId) {
      const t = store.existing('transactions', bill.pendingId, 'Pendência')
      if (t.amountCents !== remaining || t.status !== 'pending' || t.accountId !== bill.accountId || seen.has(t.id)) fail('Vínculo de conta inconsistente.')
      seen.add(t.id)
    }
  }
  for (const p of payments) {
    const bill = requireRow(store, 'bills', p.billId), t = store.existing('transactions', p.transactionId, 'Pagamento')
    for (const field of ['appliedCents', 'totalCents', 'interestCents', 'fineCents', 'feeCents', 'discountCents', 'principalCents']) cents(p[field])
    signed(p.adjustmentCents); date(p.paidDate)
    if (p.totalCents !== p.appliedCents + p.interestCents + p.fineCents + p.feeCents - p.discountCents + p.adjustmentCents || p.totalCents !== t.amountCents || t.status !== 'settled' || t.type !== 'expense' || t.accountId !== p.accountId || p.paidDate !== t.paidDate || p.principalCents > p.totalCents || seen.has(t.id) || (!bill.loanId && p.principalCents)) fail('Pagamento inconsistente no backup.')
    seen.add(t.id)
  }
  for (const loan of loans) {
    cents(loan.openingBalanceCents, true); cents(loan.contractedCents, true); date(loan.openingDate); currency(loan.currency)
    const installments = bills.filter(b => b.loanId === loan.id)
    if (installments.reduce((sum, b) => sum + cents(b.principalCents), 0) !== loan.openingBalanceCents) fail('Saldo do contrato inconsistente.')
    if (loan.disbursementId) {
      const t = store.existing('transactions', loan.disbursementId, 'Crédito')
      if (seen.has(t.id) || t.type !== 'income' || t.status !== 'settled' || t.amountCents !== loan.openingBalanceCents) fail('Crédito inconsistente.')
      seen.add(t.id)
    }
  }
  for (const asset of all(store, 'property_assets')) {
    currency(asset.currency); icon(asset.icon); date(asset.acquisitionDate); cents(asset.acquisitionCents)
    if (!(asset.ownershipPercent > 0 && asset.ownershipPercent <= 100) || !Array.isArray(asset.valuations) || !asset.valuations.length) fail('Bem inválido no backup.')
    for (const v of asset.valuations) { date(v.date); cents(v.valueCents) }
    if (asset.loanId) requireRow(store, 'loans', asset.loanId)
  }
  for (const template of all(store, 'commitments')) {
    billInput(store, { ...template, dueDate: template.startDate }, template)
    date(template.startDate); if (template.endDate) date(template.endDate)
    if (!['manual', 'last', 'average'].includes(template.estimateMode)) fail('Recorrência inválida.')
  }
  for (const attachment of all(store, 'attachments')) {
    const table = { bill: 'bills', property: 'property_assets', loan: 'loans' }[attachment.ownerType]
    if (!table || typeof attachment.data !== 'string' || attachment.data.length > 7_000_000 || !/^[^<>:"/\\|?*\p{Cc}]+\.(pdf|png|jpg|webp)$/u.test(attachment.name)) fail('Anexo inválido no backup.')
    requireRow(store, table, attachment.ownerId)
  }
}
