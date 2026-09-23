import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { FinanceStore } from '../electron/store.mjs'
import { MarketService } from '../electron/markets.mjs'
const lot={name:'BTC',symbol:'BTC-USD',kind:'crypto',provider:'coinbase',currency:'USD',exchange:'Coinbase',icon:'bitcoin',accountId:null,projectId:null,quantity:.1,costPrice:50000,fees:2,openedDate:'2026-01-05',benchmark:'cdi',rate:120,taxMode:'regressive',taxPercent:22.5,iof:true,annualFeePercent:0,manualPrice:null,closedDate:null,salePrice:null}
test('v1 migrates with preventive backup; old backups restore and migrate without losing records',()=>{
  const dir=mkdtempSync(join(tmpdir(),'purple-tab-migration-')),file=join(dir,'data.sqlite')
  const schema=readFileSync(new URL('../electron/store.mjs',import.meta.url),'utf8').match(/const SCHEMA = `([\s\S]*?)`/)[1]
  const db=new DatabaseSync(file);db.exec(schema);db.exec("PRAGMA application_id=1347699249;PRAGMA user_version=1;INSERT INTO app_meta VALUES ('application','purple-tab-finance');INSERT INTO projects VALUES ('p','Pessoal','#abcdef',0,'2026-01-01T00:00:00Z');INSERT INTO accounts VALUES ('a','Conta','Banco','checking',12345,'2026-01-01',0);")
  db.prepare('INSERT INTO settings VALUES(1,?)').run(JSON.stringify({profileName:'Meu perfil',openTabs:['geral','p'],activeTab:'geral',screen:'home',compact:false}));db.close()
  let store
  try {store=new FinanceStore(file);assert.equal(store.snapshot().accounts[0].currency,'BRL');assert.equal(store.snapshot().accounts[0].initialBalanceCents,12345);const backup=join(store.backupDirectory,readdirSync(store.backupDirectory)[0]);store.saveInvestment(lot);store.restoreFrom(backup);assert.equal(store.snapshot().investments.length,0);assert.equal(store.snapshot().accounts[0].initialBalanceCents,12345);assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,4)}finally{store?.close();rmSync(dir,{recursive:true,force:true})}
})
test('account currencies lock after usage, FX transfer requires destination value, icons and investments persist',()=>{
  const store=new FinanceStore(':memory:')
  try{const br=store.saveAccount({name:'Caixa',institution:'Dinheiro',type:'cash',currency:'BRL',initialBalanceCents:100000,initialDate:'2026-01-01'}),us=store.saveAccount({...br,id:undefined,name:'Nomad USD',institution:'Nomad',currency:'USD'})
  const transfer={fromAccountId:br.id,toAccountId:us.id,amountCents:50000,date:'2026-01-02'}
  assert.throws(()=>store.saveTransfer(transfer),/recebido/);store.saveTransfer({...transfer,receivedCents:9700});assert.equal(store.snapshot().transfers[0].receivedCents,9700)
  assert.throws(()=>store.saveAccount({...us,currency:'EUR'}),/outra carteira/)
  const saved=store.saveInvestment({...lot,accountId:us.id});assert.equal(store.snapshot().investments[0].quantity,.1);store.saveInvestment({...saved,quantity:.2});assert.equal(store.snapshot().investments[0].quantity,.2)
  assert.throws(()=>store.saveInvestment({...lot,quantity:-1}),/número/);assert.throws(()=>store.saveInvestment({...lot,currency:'BRL'}),/par/)
  assert.throws(()=>store.saveProject({name:'X',color:'#abcdef',icon:'<script>'}),/Ícone/)
  store.saveSettings({dashboardLayout:'custom',dashboardWidgets:['rates','portfolio'],displayCurrency:'USD'});assert.equal(store.snapshot().settings.displayCurrency,'USD')
  }finally{store.close()}
})
test('quotes and history preserve trustworthy cached data when a provider fails',async()=>{
  const store=new FinanceStore(':memory:');const asset=store.saveInvestment(lot),service=new MarketService(store)
  try {service.json=async()=>({price:'80000',time:'2026-01-05T12:00:00Z'});await service.quote(asset);assert.equal(store.snapshot().market[`quote:${asset.id}`].price,80000)
  service.json=async()=>[[1704153600,10,14,11,13],[1704067200,9,13,10,12]];const history=await service.history({id:asset.id,interval:'1d'});assert.ok(history.points[0].time<history.points[1].time)
  store.cacheMarket(`candles:${asset.id}:1d`,{...history,fetchedAt:'2020-01-01T00:00:00Z'});service.json=async()=>{throw new Error('offline')};const cached=await service.history({id:asset.id,interval:'1d'});assert.equal(cached.cached,true);assert.equal(store.snapshot().market[`quote:${asset.id}`].price,80000)
  }finally{store.close()}
})
