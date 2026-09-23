// Explicit online smoke test. No user database, credentials, or financial records.
import assert from 'node:assert/strict'
import { FinanceStore } from '../electron/store.mjs'
import { MarketService } from '../electron/markets.mjs'
const store=new FinanceStore(':memory:'),markets=new MarketService(store)
const input={name:'Verificação de conectividade BTC',symbol:'BTC-USD',kind:'crypto',provider:'coinbase',currency:'USD',exchange:'Coinbase',icon:'',accountId:null,projectId:null,quantity:0,costPrice:0,fees:0,openedDate:'2026-01-01',benchmark:'cdi',rate:120,taxMode:'regressive',taxPercent:22.5,iof:true,annualFeePercent:0,manualPrice:null,closedDate:null,salePrice:null}
try {
  const asset=store.saveInvestment(input),br=store.saveInvestment({...input,name:'Verificação PETR4',symbol:'PETR4',provider:'brapi',kind:'stock',currency:'BRL',exchange:'B3'})
  const refreshed=await markets.refresh();assert.deepEqual(refreshed.errors,[])
  assert.ok(store.snapshot().market.rates.cdiDaily>0);assert.ok(store.snapshot().market.fx.rates.USD>0)
  assert.ok(store.snapshot().market[`quote:${asset.id}`].price>0);assert.ok(store.snapshot().market[`quote:${br.id}`].price>0)
  const history=await markets.history({id:asset.id,interval:'1d'});assert.ok(history.points.length>20)
  await new Promise((resolve,reject)=>{
    const deadline=setTimeout(()=>{markets.close();reject(new Error('Nenhum tick recebido em 25 segundos.'))},25000)
    markets.streaming(true,()=>{const q=store.snapshot().market[`quote:${asset.id}`];if(q?.status==='Transmissão · última negociação'){clearTimeout(deadline);resolve()}})
  })
  console.log(JSON.stringify({status:'passed',checkedAt:new Date().toISOString(),checks:['BCB CDI/Selic','Frankfurter FX','Coinbase quote','brapi PETR4 quote','Coinbase historical candles','Coinbase live WebSocket'],cdiDate:store.snapshot().market.rates.date,historyPoints:history.points.length}))
}finally{markets.close();store.close()}
