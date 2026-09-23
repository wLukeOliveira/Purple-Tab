import test from 'node:test'
import assert from 'node:assert/strict'
import { fixedIncome, irRate, iofRate, exchange, reportingSnapshot, valuation, businessDay, annualEquivalent } from '../src/lib/investments.ts'
import { accountBalances } from '../src/lib/finance.ts'
import type { Investment, Snapshot } from '../src/lib/types.ts'
const lot:Investment={id:'lot',name:'Reserva',symbol:'',kind:'fixed',provider:'manual',currency:'BRL',exchange:'',icon:'shield',accountId:null,projectId:null,quantity:1,costPrice:10000,fees:0,openedDate:'2026-01-05',benchmark:'cdi',rate:120,taxMode:'regressive',taxPercent:22.5,iof:true,annualFeePercent:0,manualPrice:null,closedDate:null,salePrice:null}
const rates={cdiDaily:.05,cdiAnnual:13.42,selicDaily:.051,selicTarget:13.5,date:'2026-01-05',selicDate:'2026-01-05',fetchedAt:'2026-01-05T18:00:00Z',source:'fixture'}
test('IR boundaries and IOF charge earnings only, after IOF deduction',()=>{
  assert.deepEqual([180,181,360,361,720,721].map(irRate),[22.5,20,20,17.5,17.5,15])
  assert.deepEqual([1,15,29,30,400].map(iofRate),[96,50,3,0,0])
  const r=fixedIncome(lot,'2026-01-06',rates)!
  assert.equal(r.grossCents,1000600);assert.equal(r.iofCents,576);assert.equal(r.irCents,5);assert.equal(r.netCents,1000019)
  const exempt=fixedIncome({...lot,taxMode:'exempt',iof:false},'2026-01-06',rates)!
  assert.equal(exempt.netCents,1000600)
})
test('120% CDI compounds daily, historical factors override latest, deposits have separate tax clocks',()=>{
  const r=fixedIncome(lot,'2026-01-07',rates,{'2026-01-05':.04,'2026-01-06':.06})!
  assert.equal(r.grossCents,Math.round(1000000*1.00048*1.00072));assert.equal(r.estimatedDays,0);assert.equal(r.businessDays,2)
  assert.notEqual(annualEquivalent(.05,120),rates.cdiAnnual*1.2)
  assert.equal(fixedIncome(lot,'2026-01-06'),null)
  assert.equal(fixedIncome({...lot,benchmark:'fixed',rate:12},'2026-01-06')!.estimatedDays,0)
  assert.equal(businessDay('2026-01-01'),false);assert.equal(businessDay('2026-02-17'),false);assert.equal(businessDay('2026-02-18'),true)
})
test('multicurrency balances and exchange transfers never add currencies without a rate',()=>{
  const snapshot={accounts:[{id:'br',name:'Brasil',currency:'BRL',initialBalanceCents:100000,initialDate:'2026-01-01'},{id:'us',name:'Dólar',currency:'USD',initialBalanceCents:20000,initialDate:'2026-01-01'},{id:'eu',name:'Euro',currency:'EUR',initialBalanceCents:10000,initialDate:'2026-01-01'}],transactions:[],transfers:[{id:'x',fromAccountId:'br',toAccountId:'us',amountCents:50000,receivedCents:9800,date:'2026-01-02'}],projects:[],categories:[],goals:[],settings:{},market:{fx:{base:'BRL',rates:{BRL:1,USD:.2},date:'2026-01-02',fetchedAt:'2026-01-02T18:00:00Z',source:'fixture'}}} as unknown as Snapshot
  assert.equal(exchange(snapshot,100,'USD','BRL'),500);assert.equal(exchange(snapshot,100,'EUR','BRL'),null)
  const converted=reportingSnapshot(snapshot,'BRL');assert.equal(converted.missing.length,1)
  assert.equal(accountBalances(converted.snapshot,'2026-01-03').reduce((sum,row)=>sum+row.balance,0),199000)
  assert.equal(snapshot.accounts[1].initialBalanceCents,20000)
  const a={...lot,kind:'stock',quantity:2,costPrice:10,manualPrice:null,currency:'USD'} as Investment
  assert.equal(valuation(a,snapshot).value,null)
  assert.equal(valuation({...a,manualPrice:12},snapshot).gain,4)
})
