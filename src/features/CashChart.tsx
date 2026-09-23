import { useCallback } from 'react'
import { useCurrency } from '../lib/CurrencyContext'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AreaSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries, createChart, type IChartApi } from 'lightweight-charts'
import { ChartNoAxesCombined, ChartColumn, ChartSpline, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import type { Transaction } from '../lib/types'
import { createCashSeries, type ChartGranularity, type CashPoint } from '../lib/chartData'
import { dateLabel, money as formatMoney, today } from '../lib/finance'

type ChartKind = 'area' | 'line' | 'bars'

export default function CashChart({ entries, start, end }: { entries: Transaction[]; start: string; end: string }) {
  const currency = useCurrency()
  const money = useCallback((cents:number)=>formatMoney(cents,currency),[currency])
  const [kind, setKind] = useState<ChartKind>('area')
  const [granularity, setGranularity] = useState<ChartGranularity>('day')
  const [hovered, setHovered] = useState<CashPoint | null>(null)
  const element = useRef<HTMLDivElement>(null)
  const chartApi = useRef<IChartApi | null>(null)
  const lastDay = end && end < today() ? end : today()
  const spanDays = start && lastDay ? Math.max(0, Math.round((Date.parse(lastDay) - Date.parse(start)) / 86_400_000)) : 0
  const effectiveGranularity = spanDays > 2200 ? 'month' : granularity
  const entrySignature = JSON.stringify(entries)
  const points = useMemo(() => createCashSeries(JSON.parse(entrySignature) as Transaction[], start, lastDay, effectiveGranularity), [entrySignature, start, lastDay, effectiveGranularity])
  const current = hovered || points.at(-1) || null

  useEffect(() => {
    const container = element.current
    if (!container || !points.length) return
    const chart = createChart(container, {
      width: container.clientWidth, height: 322,
      layout: { background: { type: ColorType.Solid, color: '#20212a' }, textColor: '#9191a5', fontFamily: '-apple-system, Segoe UI, sans-serif', fontSize: 11, attributionLogo: true },
      grid: { vertLines: { color: '#d5c8eb09' }, horzLines: { color: '#d5c8eb0c' } },
      crosshair: { mode: CrosshairMode.Magnet, vertLine: { color: '#b6a3da94', labelBackgroundColor: '#62527f' }, horzLine: { color: '#9ba7c591', labelBackgroundColor: '#4f5b74' } },
      timeScale: { borderColor: '#c1b5d218', timeVisible: false, rightOffset: 1, barSpacing: 12 },
      rightPriceScale: { borderColor: '#c1b5d218', scaleMargins: { top: .16, bottom: .14 } },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      localization: { locale: 'pt-BR' },
    })
    chartApi.current = chart
    const priceFormat = { type: 'custom' as const, formatter: (value: number) => money(Math.round(value * 100)), minMove: .01 }
    if (kind === 'bars') {
      const bars = chart.addSeries(HistogramSeries, { priceFormat, base: 0, priceLineVisible: false, lastValueVisible: false })
      bars.setData(points.map(point => ({ time: point.time, value: point.resultCents / 100, color: point.resultCents >= 0 ? '#86cab5' : '#dea0b0' })))
    } else {
      const result = kind === 'area'
        ? chart.addSeries(AreaSeries, { lineColor: '#c4adee', topColor: '#a98bd747', bottomColor: '#a98bd703', lineWidth: 2, priceFormat, priceLineVisible: false })
        : chart.addSeries(LineSeries, { color: '#c4adee', lineWidth: 2, priceFormat, priceLineVisible: false })
      result.setData(points.map(point => ({ time: point.time, value: point.cumulativeCents / 100 })))
      const income = chart.addSeries(LineSeries, { color: '#89cbb5', lineWidth: 1, priceFormat, priceLineVisible: false, lastValueVisible: false })
      income.setData(points.map(point => ({ time: point.time, value: point.incomeCents / 100 })))
      const expenses = chart.addSeries(LineSeries, { color: '#d5a0b0', lineWidth: 1, priceFormat, priceLineVisible: false, lastValueVisible: false })
      expenses.setData(points.map(point => ({ time: point.time, value: point.expenseCents / 100 })))
    }
    const lookup = new Map(points.map(point => [point.time, point]))
    chart.subscribeCrosshairMove(param => {
      if (!param.time) { setHovered(null); return }
      const time = typeof param.time === 'string' ? param.time : typeof param.time === 'number' ? new Date(param.time * 1000).toISOString().slice(0, 10) : `${param.time.year}-${String(param.time.month).padStart(2, '0')}-${String(param.time.day).padStart(2, '0')}`
      setHovered(lookup.get(time) || null)
    })
    const observer = new ResizeObserver(() => chart.applyOptions({ width: container.clientWidth }))
    observer.observe(container)
    chart.timeScale().fitContent()
    return () => { observer.disconnect(); chartApi.current = null; chart.remove() }
  }, [points, kind, money])

  const zoom = (factor: number) => {
    const scale = chartApi.current?.timeScale()
    const range = scale?.getVisibleLogicalRange()
    if (!scale || !range) return
    const midpoint = (range.from + range.to) / 2
    const half = Math.max(2, (range.to - range.from) * factor / 2)
    scale.setVisibleLogicalRange({ from: midpoint - half, to: midpoint + half })
  }

  return <section className="card market-chart-card" aria-label="Gráfico interativo do fluxo financeiro">
    <div className="market-chart-header"><div><span className="eyebrow">ANÁLISE VISUAL</span><h2>Fluxo do período</h2><p className="hint">Receitas e despesas realizadas, sem crédito ou amortização de principal de empréstimos. O resultado começa em zero no início do filtro.</p></div>
      <div className="market-chart-controls"><div className="chart-pills" aria-label="Tipo de gráfico"><button aria-label="Gráfico de área" title="Área" aria-pressed={kind === 'area'} onClick={() => setKind('area')}><ChartSpline size={16} /></button><button aria-label="Gráfico de linha" title="Linha" aria-pressed={kind === 'line'} onClick={() => setKind('line')}><ChartNoAxesCombined size={16} /></button><button aria-label="Gráfico de barras" title="Barras" aria-pressed={kind === 'bars'} onClick={() => setKind('bars')}><ChartColumn size={16} /></button></div><div className="chart-pills" aria-label="Intervalo do gráfico">{(['day', 'week', 'month'] as const).map(period => <button key={period} aria-pressed={granularity === period} onClick={() => setGranularity(period)}>{period === 'day' ? 'Dia' : period === 'week' ? 'Semana' : 'Mês'}</button>)}</div></div>
    </div>
    {points.length ? <><div className="market-chart-readout" aria-live="off"><span>{current ? dateLabel(current.time) : '—'}</span><strong className={current && (kind === 'bars' ? current.resultCents : current.cumulativeCents) < 0 ? 'negative' : 'positive'}>{current ? money(kind === 'bars' ? current.resultCents : current.cumulativeCents) : '—'}</strong><small>Entradas {current ? money(current.incomeCents) : '—'} <i /> Saídas {current ? money(current.expenseCents) : '—'}</small></div><div className="market-chart-legend"><span><i className="result" />{kind === 'bars' ? 'Resultado no intervalo' : 'Resultado acumulado'}</span>{kind !== 'bars' && <><span><i className="income" />Entradas no intervalo</span><span><i className="expense" />Saídas no intervalo</span></>}{effectiveGranularity !== granularity && <span>Período longo agrupado por mês</span>}</div><div ref={element} className="market-chart-canvas" role="img" aria-label="Arraste para percorrer datas, use a roda do mouse para dar zoom e passe o cursor para ver valores" /><div className="market-chart-footer"><span>Arraste para navegar · roda do mouse para zoom · cursor para valores exatos</span><div className="chart-pills"><button aria-label="Aproximar gráfico" title="Aproximar" onClick={() => zoom(.67)}><ZoomIn size={15} /></button><button aria-label="Afastar gráfico" title="Afastar" onClick={() => zoom(1.5)}><ZoomOut size={15} /></button><button aria-label="Mostrar todo o período" title="Mostrar tudo" onClick={() => chartApi.current?.timeScale().fitContent()}><RotateCcw size={14} /></button></div></div></> : <p className="empty-state">Quando houver lançamentos realizados neste período, você poderá navegar pelo gráfico e consultar cada data.</p>}
  </section>
}
