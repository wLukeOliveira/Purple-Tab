import { randomUUID } from 'node:crypto'
import { currency, icon } from './investments.mjs'
import { shiftMonth, writeLinkedBill } from './planning.mjs'

export const CARDS_SCHEMA = `
ALTER TABLE transactions ADD COLUMN paymentMethod TEXT NOT NULL DEFAULT 'other' CHECK(paymentMethod IN ('other','debit','credit','pix','cash','bank_slip'));
CREATE TABLE credit_cards (id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE card_purchases (id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE card_statements (id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
`
const fail = message => { throw new Error(message) }
const text = (value, label, max = 300) => { if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${label} inválido.`); return value.trim() }
const money = (value, minimum = 0) => { if (!Number.isSafeInteger(value) || value < minimum) fail('Valor inválido em centavos.'); return value }
const date = value => { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2200-12-31' || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) fail('Data inválida.'); return value }
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const all = (s, table) => s.db.prepare(`SELECT value FROM ${table} ORDER BY rowid`).all().map(r => JSON.parse(r.value))
const get = (s, table, id) => { const row = s.db.prepare(`SELECT value FROM ${table} WHERE id=?`).get(text(id, 'Identificador')); return row ? JSON.parse(row.value) : null }
const requireRow = (s, table, id) => get(s, table, id) || fail('Registro não encontrado.')
const put = (s, table, row) => s.db.prepare(`INSERT INTO ${table} VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value`).run(row.id, JSON.stringify(row))
const remove = (s, table, id) => s.db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id)
const day = n => { if (!Number.isInteger(n) || n < 1 || n > 31) fail('Informe um dia entre 1 e 31.'); return n }
const flag = value => { if (value !== undefined && typeof value !== 'boolean') fail('Situação inválida.'); return value ?? false }
export function monthDate(month, selectedDay) {
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) fail('Mês inválido.')
  date(`${month}-01`)
  const [year, m] = month.split('-').map(Number)
  return date(`${month}-${String(Math.min(day(selectedDay), new Date(Date.UTC(year, m, 0)).getUTCDate())).padStart(2, '0')}`)
}
export function statementDates(card, month) {
  const closingDate = monthDate(month, card.closingDay)
  const dueMonth = shiftMonth(`${month}-01`, card.dueMonthOffset).slice(0, 7)
  const dueDate = monthDate(dueMonth, card.dueDay)
  if (dueDate < closingDate) fail('O vencimento não pode ocorrer antes do fechamento. Revise o mês de vencimento.')
  return { closingDate, dueDate }
}
export function firstStatementMonth(card, purchaseDate, closingOverride) {
  date(purchaseDate)
  const month = purchaseDate.slice(0, 7), closing = closingOverride || monthDate(month, card.closingDay)
  return purchaseDate > closing || (purchaseDate === closing && card.closingDayRule === 'next') ? shiftMonth(`${month}-01`, 1).slice(0, 7) : month
}
function cardInput(s, input, old) {
  const row = { id: old?.id || randomUUID(), name: text(input.name, 'Nome'), institution: typeof input.institution === 'string' ? input.institution.trim().slice(0, 160) : '', lastFour: input.lastFour || '', currency: currency(input.currency), icon: icon(input.icon || 'bank'), limitCents: money(input.limitCents), closingDay: day(input.closingDay), dueDay: day(input.dueDay), dueMonthOffset: input.dueMonthOffset, closingDayRule: input.closingDayRule, accountId: text(input.accountId, 'Conta'), archived: flag(input.archived) }
  if (!/^\d{0,4}$/.test(row.lastFour) || (row.lastFour && row.lastFour.length !== 4)) fail('Informe somente os quatro últimos dígitos, ou deixe vazio.')
  if (![0, 1].includes(row.dueMonthOffset) || !['current', 'next'].includes(row.closingDayRule)) fail('Regra de fechamento inválida.')
  if (row.dueMonthOffset === 0 && row.dueDay < row.closingDay) fail('Para vencimento anterior ao dia de fechamento, selecione o mês seguinte.')
  const account = s.reference('accounts', row.accountId, 'Conta para pagar faturas', old?.accountId)
  if ((account.currency || 'BRL') !== row.currency) fail('Cartão e conta de pagamento devem usar a mesma moeda.')
  if (old && old.currency !== row.currency && all(s, 'card_purchases').some(p => p.cardId === old.id)) fail('Um cartão utilizado não pode mudar de moeda.')
  return row
}
const billPayments = (s, id) => all(s, 'payments').filter(p => p.billId === id)
const remaining = (s, bill) => bill.canceled ? 0 : bill.amountCents - billPayments(s, bill.id).reduce((sum, p) => sum + p.appliedCents, 0)
export const cardSnapshot = s => ({ creditCards: all(s, 'credit_cards'), cardPurchases: all(s, 'card_purchases'), cardStatements: all(s, 'card_statements') })
export const cardMethods = {
  saveCreditCard(input) {
    const old = input.id ? requireRow(this, 'credit_cards', input.id) : null
    const row = cardInput(this, input, old)
    put(this, 'credit_cards', row)
    return row
  },
  saveCardPurchase(input) {
    const old = input.id ? requireRow(this, 'card_purchases', input.id) : null
    const card = requireRow(this, 'credit_cards', input.cardId)
    const purchaseDay = date(input.purchaseDate)
    const existingStatement = get(this, 'card_statements', `${card.id}:${purchaseDay.slice(0, 7)}`)
    if (card.archived && card.id !== old?.cardId) fail('Reative o cartão antes de registrar compras.')
    const row = { id: old?.id || randomUUID(), cardId: card.id, description: text(input.description, 'Descrição'), amountCents: money(input.amountCents, 1), purchaseDate: purchaseDay, count: input.count, projectId: input.projectId, categoryId: input.categoryId, subcategoryId: input.subcategoryId || null, notes: typeof input.notes === 'string' ? input.notes.trim().slice(0, 4000) : '', firstMonth: input.firstMonth || firstStatementMonth(card, purchaseDay, existingStatement?.closingDate), canceled: false }
    if (row.purchaseDate > today()) fail('Registre compras realizadas até hoje.')
    if (!Number.isInteger(row.count) || row.count < 1 || row.count > 120 || row.amountCents < row.count) fail('Use de 1 a 120 parcelas, com ao menos um centavo por parcela.')
    monthDate(row.firstMonth, 1)
    if (row.firstMonth < row.purchaseDate.slice(0, 7)) fail('A primeira fatura não pode ser anterior ao mês da compra.')
    this.reference('projects', row.projectId, 'Projeto', old?.projectId)
    const category = this.reference('categories', row.categoryId, 'Categoria', old?.categoryId)
    if (category.type !== 'expense' || category.parentId) fail('Escolha uma categoria principal de despesa.')
    if (row.subcategoryId) { const sub = this.reference('categories', row.subcategoryId, 'Subcategoria', old?.subcategoryId); if (sub.parentId !== row.categoryId || sub.type !== 'expense') fail('Subcategoria inválida.') }
    const oldBills = old ? all(this, 'bills').filter(b => b.cardPurchaseId === old.id) : []
    if (oldBills.some(b => billPayments(this, b.id).length)) fail('Desfaça as baixas destas parcelas antes de editar a compra.')
    if (oldBills.some(b => all(this, 'attachments').some(a => a.ownerType === 'bill' && a.ownerId === b.id))) fail('Exporte e remova os anexos das parcelas antes de refazer a compra.')
    return this.atomic(() => {
      for (const b of oldBills) { if (b.pendingId) remove(this, 'transactions', b.pendingId); remove(this, 'bills', b.id) }
      put(this, 'card_purchases', row)
      for (let i = 0; i < row.count; i++) {
        const month = shiftMonth(`${row.firstMonth}-01`, i).slice(0, 7), statementId = `${card.id}:${month}`
        let statement = get(this, 'card_statements', statementId)
        if (!statement) { statement = { id: statementId, cardId: card.id, month, ...statementDates(card, month) }; put(this, 'card_statements', statement) }
        if (statement.dueDate < row.purchaseDate) fail('A fatura escolhida vence antes da compra. Escolha outra competência.')
        writeLinkedBill(this, { name: `${row.description.slice(0, 120)} · ${i + 1}/${row.count} · ${card.name.slice(0, 40)}`, currency: card.currency, projectId: row.projectId, categoryId: row.categoryId, accountId: card.accountId, dueDate: statement.dueDate, amountCents: Math.floor(row.amountCents / row.count) + (i < row.amountCents % row.count ? 1 : 0), notes: row.notes }, { creditCardId: card.id, cardPurchaseId: row.id, statementId, installmentIndex: i, subcategoryId: row.subcategoryId })
      }
      return row
    })
  },
  cancelCardPurchase({ id }) {
    const purchase = requireRow(this, 'card_purchases', id), bills = all(this, 'bills').filter(b => b.cardPurchaseId === id)
    if (bills.some(b => billPayments(this, b.id).length)) fail('Desfaça as baixas antes de cancelar esta compra. Não registre estorno bancário como cancelamento.')
    return this.atomic(() => { for (const b of bills) writeLinkedBill(this, b, { ...b, canceled: true }, b); put(this, 'card_purchases', { ...purchase, canceled: true }); return { canceledPurchase: true } })
  },
  saveStatementDates(input) {
    const old = requireRow(this, 'card_statements', input.id)
    const row = { ...old, closingDate: date(input.closingDate), dueDate: date(input.dueDate) }
    if (row.closingDate.slice(0, 7) !== old.month || row.dueDate < row.closingDate) fail('Mantenha o fechamento na competência e o vencimento igual ou posterior.')
    const bills = all(this, 'bills').filter(b => b.statementId === old.id)
    if (bills.some(b => billPayments(this, b.id).length)) fail('Desfaça os pagamentos desta fatura antes de alterar as datas.')
    if (bills.some(b => requireRow(this, 'card_purchases', b.cardPurchaseId).purchaseDate > row.dueDate)) fail('O vencimento não pode anteceder as compras da fatura.')
    return this.atomic(() => { for (const b of bills) writeLinkedBill(this, { ...b, dueDate: row.dueDate }, {}, b); put(this, 'card_statements', row); return row })
  },
  payCardStatement(input) {
    const statement = requireRow(this, 'card_statements', input.statementId), card = requireRow(this, 'credit_cards', statement.cardId)
    const requestId = text(input.requestId, 'Identificador', 80)
    const duplicate = all(this, 'payments').filter(p => p.statementPaymentId === requestId)
    if (duplicate.length) { if (duplicate.some(p => p.statementId !== statement.id)) fail('Identificador já utilizado.'); return { payments: duplicate.map(p => p.id) } }
    const purchaseDates = new Map(all(this, 'card_purchases').map(p => [p.id, p.purchaseDate]))
    const bills = all(this, 'bills').filter(b => b.statementId === statement.id && remaining(this, b) > 0).sort((a, b) => purchaseDates.get(a.cardPurchaseId).localeCompare(purchaseDates.get(b.cardPurchaseId)))
    const outstanding = bills.reduce((sum, b) => sum + remaining(this, b), 0)
    const amount = money(input.amountCents ?? outstanding, 1)
    if (amount > outstanding) fail('O pagamento excede a fatura pendente. Registre somente o valor aplicado à fatura.')
    return this.atomic(() => {
      let rest = amount
      const ids = []
      for (const b of bills) {
        if (!rest) break
        const covered = Math.min(remaining(this, b), rest)
        const payment = this.payBill({ requestId: `${requestId}:${ids.length}`, billId: b.id, accountId: input.accountId || card.accountId, paidDate: input.paidDate || today(), appliedCents: covered, notes: 'Pagamento de fatura de cartão.' })
        put(this, 'payments', { ...payment, statementPaymentId: requestId, statementId: statement.id })
        ids.push(payment.id); rest -= covered
      }
      return { payments: ids }
    })
  },
  undoCardStatementPayment({ requestId }) {
    const payments = all(this, 'payments').filter(p => p.statementPaymentId === requestId)
    if (!payments.length) fail('Pagamento de fatura não encontrado.')
    return this.atomic(() => { for (const p of payments.reverse()) this.undoPayment({ id: p.id }); return { undone: true } })
  },
}
export function validateCards(s) {
  const cards = all(s, 'credit_cards'), purchases = all(s, 'card_purchases'), statements = all(s, 'card_statements'), bills = all(s, 'bills')
  for (const table of ['credit_cards','card_purchases','card_statements']) for (const r of s.db.prepare(`SELECT id,value FROM ${table}`).all()) if (r.id !== JSON.parse(r.value).id) fail('Identificador de cartão inconsistente.')
  for (const c of cards) cardInput(s, c, c)
  for (const st of statements) { requireRow(s, 'credit_cards', st.cardId); monthDate(st.month, 1); date(st.closingDate); date(st.dueDate); if (st.id !== `${st.cardId}:${st.month}` || st.closingDate.slice(0, 7) !== st.month || st.dueDate < st.closingDate) fail('Fatura inválida.') }
  for (const p of purchases) {
    requireRow(s, 'credit_cards', p.cardId); date(p.purchaseDate); money(p.amountCents, 1); flag(p.canceled); text(p.description, 'Compra'); monthDate(p.firstMonth, 1)
    const rows = bills.filter(b => b.cardPurchaseId === p.id)
    if (!Number.isInteger(p.count) || p.count < 1 || p.count > 120 || rows.length !== p.count || rows.reduce((sum, b) => sum + b.amountCents, 0) !== p.amountCents || new Set(rows.map(b => b.installmentIndex)).size !== p.count) fail('Parcelamento de cartão inconsistente.')
    for (const b of rows) { const st = requireRow(s, 'card_statements', b.statementId), c = requireRow(s, 'credit_cards', p.cardId); if (b.creditCardId !== p.cardId || st.cardId !== p.cardId || b.dueDate !== st.dueDate || b.currency !== c.currency || b.canceled !== p.canceled || b.projectId !== p.projectId || b.categoryId !== p.categoryId || b.installmentIndex < 0 || b.installmentIndex >= p.count) fail('Vínculo de parcela inválido.') }
  }
  for (const b of bills.filter(b => b.creditCardId)) requireRow(s, 'card_purchases', b.cardPurchaseId)
}
