import { useEffect, useMemo, useRef, useState } from 'react'
import { createChart, ColorType, CrosshairMode, AreaSeries, LineSeries, CandlestickSeries, type IChartApi, type UTCTimestamp } from 'lightweight-charts'
import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { assetPrice } from '../lib/finance'
import type { MarketPoint } from '../lib/types'

export default function AssetChart({points:incomingPoints,currency,title='Evolução do ativo',livePrice,liveTime,intervalSeconds=86400}:{points:MarketPoint[];currency:string;title?:string;livePrice?:number;liveTime?:string;intervalSeconds?:number}) {
  const signature=JSON.stringify(incomingPoints)
  const points=useMemo(()=>JSON.parse(signature) as MarketPoint[],[signature])
  const updateLive=useRef<((price:number,time:number)=>void)|null>(null)
  const host=useRef<HTMLDivElement>(null),chartRef=useRef<IChartApi|null>(null)
  const [kind,setKind]=useState<'area'|'line'|'candles'>('area'),[expanded,setExpanded]=useState(false),[hover,setHover]=useState<MarketPoint|null>(null)
  useEffect(()=>{
    if(!host.current || !points.length) return
    const chart=createChart(host.current,{autoSize:true,height:expanded?Math.max(360,window.innerHeight-240):340,layout:{background:{type:ColorType.Solid,color:'transparent'},textColor:'#aaa6bf',attributionLogo:true,fontFamily:'Segoe UI'},grid:{vertLines:{color:'#ffffff06'},horzLines:{color:'#ffffff09'}},crosshair:{mode:CrosshairMode.Normal},rightPriceScale:{borderVisible:false},timeScale:{borderVisible:false,timeVisible:true,secondsVisible:false},localization:{locale:'pt-BR',priceFormatter:(v:number)=>assetPrice(v,currency)}})
    chartRef.current=chart
    const series=kind==='candles'?chart.addSeries(CandlestickSeries,{upColor:'#81d6b7',downColor:'#f399ac',wickUpColor:'#81d6b7',wickDownColor:'#f399ac',borderVisible:false}):kind==='line'?chart.addSeries(LineSeries,{color:'#ba9aff',lineWidth:2}):chart.addSeries(AreaSeries,{lineColor:'#ba9aff',topColor:'#a680ef44',bottomColor:'#a680ef02',lineWidth:2})
    series.applyOptions({priceFormat:{type:'price',precision:points.some(p=>p.close>0&&p.close<1)?8:2,minMove:points.some(p=>p.close>0&&p.close<1)?1e-8:.01}})
    series.setData(points.map(p=>kind==='candles'?{...p,time:p.time as UTCTimestamp}:{time:p.time as UTCTimestamp,value:p.close}))
    chart.timeScale().fitContent()
    let latest=points.at(-1)!
    updateLive.current=(price,time)=>{
      const offset=intervalSeconds===604800?345600:0
      const bucket=Math.floor((time-offset)/intervalSeconds)*intervalSeconds+offset
      if(bucket<latest.time)return
      latest=bucket===latest.time?{...latest,high:Math.max(latest.high,price),low:Math.min(latest.low,price),close:price}:{time:bucket,open:latest.close,high:Math.max(latest.close,price),low:Math.min(latest.close,price),close:price}
      series.update(kind==='candles'?{...latest,time:latest.time as UTCTimestamp}:{time:latest.time as UTCTimestamp,value:latest.close})
    }
    chart.subscribeCrosshairMove(event=>{const point=Number(event.time)===latest.time?latest:points.find(p=>p.time===Number(event.time));setHover(point||null)})
    return ()=>{chart.remove();chartRef.current=null;updateLive.current=null}
  },[points,currency,kind,expanded,intervalSeconds])
  useEffect(()=>{if(!expanded)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setExpanded(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[expanded])
  useEffect(()=>{if(livePrice!==undefined&&liveTime){const time=Date.parse(liveTime)/1000;if(Number.isFinite(time)&&Number.isFinite(livePrice))updateLive.current?.(livePrice,time)}},[livePrice,liveTime,kind,points,expanded])
  const current=hover||points.at(-1)
  function zoom(factor:number){const scale=chartRef.current?.timeScale(),range=scale?.getVisibleLogicalRange();if(!scale||!range)return;const middle=(range.from+range.to)/2,half=(range.to-range.from)*factor/2;scale.setVisibleLogicalRange({from:middle-half,to:middle+half})}
  return <section className={`asset-chart ${expanded?'expanded':''}`} aria-label={title}><div className="section-heading"><div><span className="eyebrow">{title}</span><div className="asset-chart-value">{current?assetPrice(!hover&&livePrice!==undefined?livePrice:current.close,currency):'—'}<small>{current?new Date(!hover&&liveTime ? liveTime : current.time*1000).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'UTC'})+' UTC':''}</small></div></div><div className="chart-pills">{(['area','line','candles'] as const).map(k=><button key={k} aria-pressed={kind===k} onClick={()=>setKind(k)}>{k==='area'?'Área':k==='line'?'Linha':'Velas'}</button>)}<button aria-label={expanded?'Recolher gráfico':'Expandir gráfico'} onClick={()=>setExpanded(v=>!v)}>{expanded?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button></div></div>{kind==='candles'&&current&&<p className="hint">Abertura {assetPrice(current.open,currency)} · Máxima {assetPrice(current.high,currency)} · Mínima {assetPrice(current.low,currency)} · Fechamento {assetPrice(current.close,currency)}</p>}{points.length?<div className="asset-chart-host" ref={host}/>:<p className="empty-state">Ainda não há pontos neste período.</p>}<div className="market-chart-footer"><span>Arraste · aproxime com a roda · passe o cursor para consultar</span><div className="chart-pills"><button aria-label="Zoom +" onClick={()=>zoom(.65)}><ZoomIn size={16}/></button><button aria-label="Zoom −" onClick={()=>zoom(1.5)}><ZoomOut size={16}/></button><button aria-label="Ajustar histórico" onClick={()=>chartRef.current?.timeScale().fitContent()}><RotateCcw size={15}/></button></div></div></section>
}
