import type { Transaction } from './types.ts'
import { transactionDate } from './finance.ts'

export type ChartGranularity = 'day' | 'week' | 'month'
export interface CashPoint { time: string; incomeCents: number; expenseCents: number; resultCents: number; cumulativeCents: number }

const dateAtNoon = (day: string) => new Date(`${day}T12:00:00Z`)
const iso = (date: Date) => date.toISOString().slice(0, 10)
const monday = (day: string) => { const date = dateAtNoon(day); date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7); return iso(date) }

export function periodKey(day: string, granularity: ChartGranularity): string {
  return granularity === 'month' ? `${day.slice(0, 7)}-01` : granularity === 'week' ? monday(day) : day
}

const nextPeriod = (day: string, granularity: ChartGranularity) => {
  const date = dateAtNoon(day)
  if (granularity === 'month') date.setUTCMonth(date.getUTCMonth() + 1)
  else date.setUTCDate(date.getUTCDate() + (granularity === 'week' ? 7 : 1))
  return iso(date)
}

/** One point per actual calendar period, including zero-activity periods. No mock values. */
export function createCashSeries(entries: Transaction[], start: string, end: string, granularity: ChartGranularity): CashPoint[] {
  const realized = entries.filter(entry => entry.status === 'settled')
  if (!realized.length || !start || !end || start > end) return []
  const buckets = new Map<string, { income: number; expenses: number }>()
  for (const entry of realized) {
    const day = transactionDate(entry)
    if (day < start || day > end) continue
    const key = periodKey(day, granularity)
    const bucket = buckets.get(key) || { income: 0, expenses: 0 }
    if (entry.type === 'income') bucket.income += entry.economicCents ?? entry.amountCents
    else bucket.expenses += entry.economicCents ?? entry.amountCents
    buckets.set(key, bucket)
  }
  if (!buckets.size) return []
  const first = periodKey(start, granularity)
  const last = periodKey(end, granularity)
  const points: CashPoint[] = []
  let running = 0
  for (let day = first; day <= last && points.length < 2200; day = nextPeriod(day, granularity)) {
    const bucket = buckets.get(day) || { income: 0, expenses: 0 }
    const result = bucket.income - bucket.expenses
    running += result
    points.push({ time: day, incomeCents: bucket.income, expenseCents: bucket.expenses, resultCents: result, cumulativeCents: running })
  }
  return points
}
