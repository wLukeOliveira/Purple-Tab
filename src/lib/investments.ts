import type { Investment, Rates, Snapshot, Quote } from './types.ts'
import { today } from './finance.ts'

export const currencies = ['BRL','USD','EUR','GBP','CAD','AUD','CHF','JPY','CNY','ARS','CLP','MXN','NZD','SGD','HKD','INR','ZAR','SEK','NOK','DKK','PLN','KRW','TRY','ILS','IDR','THB','MYR','PHP','CZK','HUF','RON','ISK']
export const investmentKinds = { fixed:'Renda fixa / caixinha',crypto:'Criptomoeda',stock:'Ação',etf:'ETF',fii:'Fundo imobiliário',fund:'Fundo de investimento',bond:'Título',commodity:'Commodity',other:'Outro ativo' }
const dayMs = 86400000
export const elapsedDays = (start:string,end:string) => Math.max(0,Math.round((Date.parse(end)-Date.parse(start))/dayMs))
export const irRate = (days:number) => days<=180 ? 22.5 : days<=360 ? 20 : days<=720 ? 17.5 : 15
const iofTable = [100,96,93,90,86,83,80,76,73,70,66,63,60,56,53,50,46,43,40,36,33,30,26,23,20,16,13,10,6,3,0]
export const iofRate = (days:number) => days>=30 ? 0 : iofTable[Math.max(0,Math.floor(days))]

function easter(year:number) {
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1
  return Date.UTC(year,month-1,day)
}
export function businessDay(date:string) {
  const d=new Date(`${date}T00:00:00Z`),year=d.getUTCFullYear(),weekday=d.getUTCDay(),suffix=date.slice(5)
  if(weekday===0 || weekday===6 || ['01-01','04-21','05-01','09-07','10-12','11-02','11-15','12-25'].includes(suffix) || (year>=2024 && suffix==='11-20')) return false
  return ![-48,-47,-2,60].some(offset=>easter(year)+offset*dayMs===d.getTime())
}
export function annualEquivalent(dailyPercent:number,multiplier:number) { return (Math.pow(1+dailyPercent/100*multiplier/100,252)-1)*100 }

export function fixedIncome(input:Pick<Investment,'costPrice'|'openedDate'|'benchmark'|'rate'|'taxMode'|'taxPercent'|'iof'|'annualFeePercent'>, end:string, rates?:Rates, history:Record<string,number>={}) {
  const calendarDays=elapsedDays(input.openedDate,end)
  const daily=input.benchmark==='fixed' ? Math.pow(1+input.rate/100,1/252)-1 : rates ? (input.benchmark==='cdi'?rates.cdiDaily:rates.selicDaily)/100*input.rate/100 : null
  if(daily===null && calendarDays>0) return null
  let value=input.costPrice,businessDays=0,estimatedDays=0
  const points:{time:number;open:number;high:number;low:number;close:number}[]=[]
  const endTime=Date.parse(end),startTime=Date.parse(input.openedDate)
  points.push({time:startTime/1000,open:value,high:value,low:value,close:value})
  if(calendarDays>36600) return null
  for(let time=startTime;time<endTime;time+=dayMs) {
    const date=new Date(time).toISOString().slice(0,10)
    // SGS records are factors for the accrual date: deposit inclusive, redemption exclusive.
    const historical=input.benchmark==='fixed'?undefined:history[date]
    if(historical===undefined && !businessDay(date)) continue
    const factor=historical!==undefined?historical/100*input.rate/100:(daily||0)
    if(input.benchmark!=='fixed' && historical===undefined) estimatedDays++
    const before=value;value=value*(1+factor)*Math.pow(1-input.annualFeePercent/100,1/252);businessDays++
    if(!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value*100))) return null
    points.push({time:(time+dayMs)/1000,open:before,high:Math.max(before,value),low:Math.min(before,value),close:value})
  }
  const grossCents=Math.round(value*100),principalCents=Math.round(input.costPrice*100),profitCents=Math.max(0,grossCents-principalCents)
  const appliedIof=input.iof?iofRate(calendarDays):0,iofCents=Math.round(profitCents*appliedIof/100)
  const appliedIr=input.taxMode==='exempt'?0:input.taxMode==='fixed'?input.taxPercent:irRate(calendarDays),irCents=Math.round((profitCents-iofCents)*appliedIr/100)
  return {principalCents,grossCents,profitCents,iofCents,irCents,netCents:grossCents-iofCents-irCents,netProfitCents:grossCents-principalCents-iofCents-irCents,appliedIr,appliedIof,businessDays,calendarDays,estimatedDays,points,annualEquivalent:daily===null?null:(Math.pow(1+daily,252)-1)*100}
}
export function exchange(snapshot:Snapshot,amount:number,from:string,to:string):number|null {
  if(from===to) return amount
  const fx=snapshot.market?.fx
  const fromRate=from==='BRL'?1:fx?.rates[from],toRate=to==='BRL'?1:fx?.rates[to]
  if(!fromRate || !toRate || !Number.isFinite(fromRate) || !Number.isFinite(toRate)) return null
  return amount/fromRate*toRate
}
export function reportingSnapshot(snapshot:Snapshot,target:string) {
  const missing=snapshot.accounts.filter(a=>exchange(snapshot,1,a.currency||'BRL',target)===null)
  const available=snapshot.accounts.filter(a=>!missing.some(m=>m.id===a.id))
  const convert=(cents:number,accountId:string) => Math.round(exchange(snapshot,cents,snapshot.accounts.find(a=>a.id===accountId)?.currency||'BRL',target) || 0)
  return {missing,snapshot:{...snapshot,accounts:available.map(a=>({...a,initialBalanceCents:convert(a.initialBalanceCents,a.id)})),transactions:snapshot.transactions.filter(t=>available.some(a=>a.id===t.accountId)).map(t=>({...t,amountCents:convert(t.amountCents,t.accountId),economicCents:t.economicCents===undefined?undefined:convert(t.economicCents,t.accountId)})),transfers:snapshot.transfers.map(t=>({...t,amountCents:convert(t.amountCents,t.fromAccountId),receivedCents:convert(t.receivedCents??t.amountCents,t.toAccountId)})),settings:{...snapshot.settings,displayCurrency:target}}}
}
export function valuation(asset:Investment,snapshot:Snapshot,end=today()) {
  const cost=asset.quantity*asset.costPrice+asset.fees
  if(asset.closedDate && asset.salePrice!==null) return {cost,value:asset.quantity*asset.salePrice,gain:asset.quantity*asset.salePrice-cost,label:'Lote encerrado · valor de venda informado',quote:null,fixed:null}
  const fixed=asset.kind==='fixed'?fixedIncome(asset,end,snapshot.market?.rates,(snapshot.market?.[`history:${asset.benchmark}`]||{}) as Record<string,number>):null
  const quote=snapshot.market?.[`quote:${asset.id}`] as Quote|undefined
  const price=asset.provider==='manual'?asset.manualPrice:quote?.currency===asset.currency?quote.price:null
  const rawValue=asset.kind==='fixed'?(fixed?fixed.netCents/100:null):price!=null?price*asset.quantity:null
  const value=rawValue!==null && Number.isSafeInteger(Math.round(rawValue*100)) ? rawValue : null
  return {cost,value,gain:value===null?null:value-cost,label:asset.kind==='fixed'?(fixed?.estimatedDays?'Estimativa · há dias calculados pela taxa atual':'Estimativa líquida · fatores históricos disponíveis'):asset.provider==='manual'?'Preço manual':quote?.status||'Sem cotação',quote:quote||null,fixed}
}
