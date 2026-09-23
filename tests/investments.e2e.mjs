/* global window, document, getComputedStyle */
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { _electron } from 'playwright'
import electron from 'electron'
import { FinanceStore } from '../electron/store.mjs'
const root=resolve('.'),temporary=mkdtempSync(join(tmpdir(),'purple-tab-investments-ui-')),data=join(temporary,'data'),artifacts=join(root,'tests','artifacts',`investments-${new Date().toISOString().replace(/[:.]/g,'-')}`)
mkdirSync(artifacts,{recursive:true})
const store=new FinanceStore(join(data,'purple-tab.sqlite'))
store.cacheMarket('rates',{cdiDaily:.05,cdiAnnual:(1.0005**252-1)*100,selicDaily:.051,selicTarget:13.5,date:'2026-09-21',selicDate:'2026-09-21',fetchedAt:new Date().toISOString(),source:'Fixture de teste · não é cotação real'})
store.cacheMarket('fx',{base:'BRL',rates:{BRL:1,USD:.2,EUR:.18},date:'2026-09-21',fetchedAt:new Date().toISOString(),source:'Fixture de teste'})
store.close()
const env={...process.env,PURPLE_TAB_DATA_DIR:data,PURPLE_TAB_TEST_HEADLESS:'1'};delete env.ELECTRON_RUN_AS_NODE
let app,page
const errors=[]
try {
  app=await _electron.launch({executablePath:process.env.PURPLE_TAB_EXE||electron,args:process.env.PURPLE_TAB_EXE?[]:['.'],cwd:root,env})
  page=await app.firstWindow();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message))
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setSize(1460,950);w.webContents.backgroundThrottling=false;w.showInactive()})
  await page.locator('.app-main').waitFor()
  await page.evaluate(async()=>{const api=window.electronAPI;await api.saveAccount({name:'Conta Brasil',institution:'Nubank',type:'checking',initialBalanceCents:100000,initialDate:'2026-01-01',archived:false,currency:'BRL'});await api.saveAccount({name:'Nomad · USD',institution:'Nomad',type:'checking',initialBalanceCents:20000,initialDate:'2026-01-01',archived:false,currency:'USD'});await api.saveProject({name:'Viagens',color:'#a0b7ef',icon:'travel'})})
  await page.reload();await page.locator('.balance-hero').waitFor()
  assert.equal(await page.locator('.balance-hero .motion-number').first().getAttribute('data-value'),'200000')
  await page.getByRole('button',{name:'Moeda de visualização: BRL. Alterar moeda'}).click()
  await page.getByRole('searchbox',{name:'Buscar moeda'}).fill('USD')
  await page.locator('.display-currency-options button').filter({hasText:'USD'}).click()
  await page.waitForFunction(()=>document.querySelector('.balance-hero .motion-number')?.getAttribute('data-value')==='40000')
  const font=await page.locator('.metric').first().evaluate(el=>({font:getComputedStyle(el).fontFamily,weight:getComputedStyle(el).fontWeight}))
  assert.match(font.font,/Nunito/);assert.equal(font.weight,'800')
  await page.getByRole('button',{name:'Visualização do espaço de trabalho',exact:true}).click();await page.locator('.workspace-presets').getByRole('button',{name:'Investimentos',exact:true}).click();await page.locator('.portfolio-summary').waitFor({state:'visible'})
  await page.locator('.stats-grid').waitFor({state:'hidden'})
  await page.getByRole('button',{name:'Visualização do espaço de trabalho',exact:true}).click();await page.getByRole('button',{name:'Personalizar layout',exact:true}).click();await page.getByLabel('Últimos lançamentos',{exact:true}).click()
  await page.waitForFunction(async()=> (await window.electronAPI.getSnapshot()).settings.dashboardLayout==='custom')
  await page.screenshot({path:join(artifacts,'01-layout-usd.png')})
  await page.getByRole('button',{name:'Fechar layouts',exact:true}).click();await page.getByRole('button',{name:'Investimentos',exact:true}).click()
  await page.getByRole('button',{name:'Caixinha / renda fixa',exact:true}).click()
  await page.getByLabel('Nome do investimento',{exact:true}).fill('Reserva 120% CDI')
  await page.getByLabel('Capital deste aporte (R$)',{exact:true}).fill('10000')
  await page.getByLabel('Data do aporte',{exact:true}).fill('2026-01-05')
  await page.getByRole('button',{name:'Salvar investimento',exact:true}).click()
  await page.locator('.investment-card').filter({hasText:'Reserva 120% CDI'}).waitFor()
  await page.getByRole('button',{name:'Analisar',exact:true}).click()
  await page.locator('.asset-chart canvas').first().waitFor()
  assert.match(await page.locator('.calculation-breakdown').innerText(),/IR estimado/)
  await page.screenshot({path:join(artifacts,'02-carteira.png')})
  await page.getByRole('button',{name:'Simulador',exact:true}).click()
  await page.getByLabel('Data do aporte',{exact:true}).fill('2026-01-05');await page.getByLabel('Data do resgate',{exact:true}).fill('2026-01-06')
  await page.waitForFunction(()=>document.querySelector('.simulator-total')?.textContent?.replace(/\s/g,'')==='R$10.000,19')
  await page.getByLabel('Imposto de renda').selectOption('exempt');await page.getByLabel('IOF regressivo nos primeiros 29 dias',{exact:true}).uncheck()
  await page.waitForFunction(()=>document.querySelector('.simulator-total')?.textContent?.replace(/\s/g,'')==='R$10.006,00')
  await page.screenshot({path:join(artifacts,'03-simulador.png')})
  await page.getByRole('button',{name:'Carteira',exact:true}).click();await page.getByRole('button',{name:'Adicionar ativo',exact:true}).click()
  await page.getByLabel('Nome do investimento',{exact:true}).fill('ETF global de teste');await page.getByLabel('Classe do ativo').selectOption('etf');await page.getByLabel('Moeda do ativo').selectOption('USD');await page.getByLabel('Quantidade · zero para acompanhar').fill('3');await page.getByLabel('Custo por unidade (USD)').fill('100');await page.getByLabel('Preço atual por unidade (USD)').fill('120');await page.getByRole('button',{name:'Salvar investimento',exact:true}).click()
  const card=page.locator('.investment-card').filter({hasText:'ETF global de teste'});await card.waitFor();assert.match(await card.innerText(),/360,00/)
  await card.getByRole('button',{name:'Editar investimento ETF global de teste',exact:true}).click();await page.getByLabel('Preço atual por unidade (USD)').fill('130');await page.getByRole('button',{name:'Salvar investimento',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.investment-card')[1]?.textContent?.includes('390,00'))
  await page.reload();await page.locator('.investment-card').filter({hasText:'ETF global de teste'}).waitFor()
  const final=await page.evaluate(()=>window.electronAPI.getSnapshot());assert.equal(final.investments.length,2);assert.equal(final.settings.displayCurrency,'USD');assert.ok(final.settings.dashboardWidgets.includes('recent'));assert.equal(final.projects.find(p=>p.name==='Viagens').icon,'travel')
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1000,720));await page.screenshot({path:join(artifacts,'04-compact.png')})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false)
  assert.deepEqual(errors,[])
  writeFileSync(join(artifacts,'result.json'),JSON.stringify({status:'passed',errors,font,tests:['multi-currency-dashboard','layout-persistence','fixed-income-create','tax-simulation','foreign-asset-edit-restart','project-icon','small-window'],artifacts},null,2))
  console.log(JSON.stringify({status:'passed',artifacts}))
}catch(e){if(page)await page.screenshot({path:join(artifacts,'failure.png')}).catch(()=>{});console.error(e);process.exitCode=1}
finally{await app?.close();rmSync(temporary,{recursive:true,force:true})}
