import { CURRENCIES } from './investments.mjs'
const iso = () => new Date().toISOString()
const brDate = value => value.split('-').reverse().join('/')
const apiDate = value => value.split('/').reverse().join('-')
const finite = value => { const n = Number(value); if (!Number.isFinite(n) || n < 0) throw new Error('O provedor retornou um valor inválido.'); return n }

export class MarketService {
  constructor(store, getKey = () => '') { this.store = store; this.getKey = getKey; this.running = null; this.lastRefresh = 0 }
  async json(url, headers = {}) {
    let response
    try { response = await fetch(url, { headers: { 'User-Agent': 'PurpleTab/0.2', ...headers }, signal: AbortSignal.timeout(15000) }) }
    catch { throw new Error('Sem conexão ou provedor indisponível. A última informação salva foi preservada.') }
    if(response.status>=500) {
      try{response=await fetch(url,{headers:{'User-Agent':'PurpleTab/0.2',...headers},signal:AbortSignal.timeout(15000)})}catch{throw new Error('Provedor temporariamente indisponível. A última informação salva foi preservada.')}
    }
    if (!response.ok) throw new Error(response.status === 429 ? 'Limite de consultas do provedor atingido. Tente mais tarde.' : response.status>=500 ? 'Provedor temporariamente indisponível. Tente novamente mais tarde.' : `Provedor respondeu ${response.status}. Verifique a chave e a cobertura do seu plano.`)
    const data = await response.json()
    if (data.status === 'error' || data.error) throw new Error('Provedor recusou a consulta. Verifique símbolo, bolsa e permissão do plano.')
    return data
  }
  async economicRates() {
    const end = new Date().toLocaleDateString('en-CA'),begin=new Date();begin.setDate(begin.getDate()-20)
    const rows = await Promise.all([12,11,432].map(code => this.json(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${begin.toLocaleDateString('pt-BR')}&dataFinal=${brDate(end)}`)))
    const [cdi,selic,target] = rows.map(values=>values.filter(row=>/^\d{2}\/\d{2}\/\d{4}$/.test(row.data)&&apiDate(row.data)<=end).sort((a,b)=>apiDate(a.data).localeCompare(apiDate(b.data))).at(-1))
    if(!cdi||!selic||!target) throw new Error('O Banco Central não retornou observações válidas até hoje.')
    const cdiDaily = finite(cdi.valor)
    this.store.cacheMarket('rates', { cdiDaily, cdiAnnual: (Math.pow(1+cdiDaily/100,252)-1)*100, selicDaily: finite(selic.valor), selicTarget: finite(target.valor), date: apiDate(cdi.data), selicDate: apiDate(target.data), fetchedAt: iso(), source: 'Banco Central · SGS 12, 11 e 432' })
    const lots = this.store.snapshot().investments.filter(i => i.kind === 'fixed')
    if (!lots.length) return
    const tenYears = new Date(); tenYears.setUTCFullYear(tenYears.getUTCFullYear()-10); tenYears.setUTCDate(tenYears.getUTCDate()+1)
    const start = [lots.map(i=>i.openedDate).sort()[0],tenYears.toISOString().slice(0,10)].sort().at(-1)
    for (const [name,code] of [['cdi',12],['selic',11]]) {
      const values = await this.json(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${brDate(start)}&dataFinal=${brDate(end)}`)
      this.store.cacheMarket(`history:${name}`, Object.fromEntries(values.filter(r=>apiDate(r.data)<=end).map(r=>[apiDate(r.data),finite(r.valor)])))
    }
  }
  async exchangeRates() {
    const values = await this.json(`https://api.frankfurter.dev/v2/rates?base=BRL&quotes=${CURRENCIES.filter(c=>c!=='BRL').join(',')}`)
    if (!Array.isArray(values) || !values.length) throw new Error('Câmbio indisponível.')
    const rates = { BRL:1 }, dates = {}
    for (const row of values) { if (CURRENCIES.includes(row.quote) && finite(row.rate)>0) { rates[row.quote] = Number(row.rate); dates[row.quote] = row.date } }
    this.store.cacheMarket('fx', { base:'BRL', rates, dates, date: values.map(v=>v.date).sort()[0], fetchedAt:iso(), source:'Frankfurter · referência diária de bancos centrais' })
  }
  async quote(asset) {
    const fetchedAt = iso()
    let value
    if (asset.provider === 'coinbase') {
      const q = await this.json(`https://api.exchange.coinbase.com/products/${encodeURIComponent(asset.symbol)}/ticker`)
      value = { price:finite(q.price),currency:asset.currency,time:q.time,fetchedAt,source:'Coinbase Exchange',status:'Última negociação · consulta periódica' }
    } else if (asset.provider === 'brapi') {
      const key = this.getKey('brapi')
      const q = (await this.json(`https://brapi.dev/api/quote/${encodeURIComponent(asset.symbol)}`,key ? {Authorization:`Bearer ${key}`} : {})).results?.[0]
      if (!q || q.currency !== asset.currency) throw new Error('Cotação ausente ou moeda incompatível com o cadastro.')
      value = { price:finite(q.regularMarketPrice),currency:q.currency,time:q.regularMarketTime,fetchedAt,source:'brapi · B3',status:'Última cotação disponível · atraso conforme plano' }
    } else if (asset.provider === 'twelve') {
      const key = this.getKey('twelve'); if (!key) throw new Error('Cadastre sua chave Twelve Data em Conexões para consultar ativos globais.')
      const q = await this.json(`https://api.twelvedata.com/quote?${new URLSearchParams({symbol:asset.symbol,exchange:asset.exchange,timezone:'UTC'})}`,{Authorization:`apikey ${key}`})
      if (q.currency !== asset.currency) throw new Error('Moeda da cotação diferente da moeda cadastrada.')
      value = {price:finite(q.close),currency:q.currency,time:new Date(Number(q.timestamp)*1000).toISOString(),fetchedAt,source:'Twelve Data',status:'Última cotação disponível · cobertura conforme plano'}
    } else return
    if (!Number.isFinite(Date.parse(value.time))) throw new Error('Cotação sem horário válido.')
    this.store.cacheMarket(`quote:${asset.id}`,value)
  }
  async refresh() {
    if (this.running) return this.running
    if (Date.now()-this.lastRefresh<30000) return {errors:[]}
    this.lastRefresh = Date.now()
    this.running = (async()=>{
      const errors = []
      const results = await Promise.allSettled([this.economicRates(),this.exchangeRates()])
      results.forEach((r,i)=>{if(r.status==='rejected') errors.push(`${i ? 'Câmbio':'Taxas brasileiras'}: ${r.reason.message}`)})
      // Sequential quotes respect small provider plans and keep independent failures local.
      for(const asset of this.store.snapshot().investments.filter(a=>!a.closedDate && a.kind!=='fixed' && a.provider!=='manual')) {
        try { await this.quote(asset) } catch(e) { errors.push(`${asset.symbol}: ${e.message}`) }
      }
      this.store.cacheMarket('connection',{checkedAt:iso(),errors})
      return {errors}
    })().finally(()=>{this.running=null})
    return this.running
  }
  streaming(enabled, notify=()=>{}) {
    this.streamEnabled=Boolean(enabled)
    this.streamNotify=notify
    clearTimeout(this.reconnectTimer)
    if(this.socket){this.socket.onclose=null;this.socket.onopen=null;this.socket.onerror=null;this.socket.onmessage=null;this.socket.close();this.socket=null}
    const assets=this.store.snapshot().investments.filter(a=>a.provider==='coinbase' && !a.closedDate)
    this.store.cacheMarket('stream',{connected:false,updatedAt:iso()})
    notify()
    if(!enabled || !assets.length) return
    const products=[...new Set(assets.map(a=>a.symbol))].slice(0,50)
    const socket=new WebSocket('wss://ws-feed.exchange.coinbase.com')
    this.socket=socket
    socket.onopen=()=>{socket.send(JSON.stringify({type:'subscribe',product_ids:products,channels:['ticker','heartbeat']}));this.store.cacheMarket('stream',{connected:true,updatedAt:iso()});notify()}
    const written=new Map()
    socket.onmessage=event=>{
      try{
        const tick=JSON.parse(String(event.data))
        if(tick.type!=='ticker'||!products.includes(tick.product_id)||Date.now()-(written.get(tick.product_id)||0)<1000) return
        const price=finite(tick.price)
        if(!Number.isFinite(Date.parse(tick.time))) return
        written.set(tick.product_id,Date.now())
        for(const asset of this.store.snapshot().investments.filter(a=>a.provider==='coinbase'&&a.symbol===tick.product_id&&!a.closedDate)) this.store.cacheMarket(`quote:${asset.id}`,{price,currency:asset.currency,time:tick.time,fetchedAt:iso(),source:'Coinbase Exchange',status:'Transmissão · última negociação'})
        notify()
      }catch{/* Ignore malformed feed messages; keep the last validated quote. */}
    }
    socket.onerror=()=>{this.store.cacheMarket('stream',{connected:false,updatedAt:iso()});notify();socket.close()}
    socket.onclose=()=>{this.store.cacheMarket('stream',{connected:false,updatedAt:iso()});notify();if(this.streamEnabled)this.reconnectTimer=setTimeout(()=>this.streaming(true,notify),15000)}
  }
  close() {this.streamEnabled=false;clearTimeout(this.reconnectTimer);if(this.socket){this.socket.onclose=null;this.socket.onopen=null;this.socket.onerror=null;this.socket.onmessage=null;this.socket.close();this.socket=null}}
  async search({query,provider}) {
    if (typeof query!=='string' || query.length<1 || query.length>80) throw new Error('Digite um nome ou símbolo de até 80 caracteres.')
    const q = query.toLowerCase()
    if(provider==='coinbase') {
      if (!this.products || Date.now()-this.productsAt>3600000) { this.products=await this.json('https://api.exchange.coinbase.com/products'); this.productsAt=Date.now() }
      return this.products.filter(p=>p.status==='online' && CURRENCIES.includes(p.quote_currency) && p.id.toLowerCase().includes(q)).slice(0,40).map(p=>({name:p.display_name,symbol:p.id,currency:p.quote_currency,exchange:'Coinbase',provider,kind:'crypto'}))
    }
    if(provider==='brapi') {
      const key=this.getKey('brapi')
      const data=await this.json(`https://brapi.dev/api/quote/list?${new URLSearchParams({search:query,limit:'30'})}`,key?{Authorization:`Bearer ${key}`}:{})
      return (data.stocks||[]).slice(0,30).map(p=>({name:p.name||p.stock,symbol:p.stock,currency:'BRL',exchange:'B3',provider,kind:p.type==='fund'?'fii':'stock'}))
    }
    if(provider==='twelve') {
      const key=this.getKey('twelve'); if(!key) throw new Error('Cadastre sua chave Twelve Data na seção Conexões.')
      const data=await this.json(`https://api.twelvedata.com/symbol_search?${new URLSearchParams({symbol:query,outputsize:'30'})}`,{Authorization:`apikey ${key}`})
      return (data.data||[]).filter(p=>CURRENCIES.includes(p.currency)).map(p=>({name:p.instrument_name,symbol:p.symbol,currency:p.currency,exchange:p.exchange,provider,kind:p.instrument_type==='ETF'?'etf':'stock'}))
    }
    throw new Error('Selecione um provedor de pesquisa.')
  }
  async history({id,interval}) {
    const asset=this.store.snapshot().investments.find(a=>a.id===id)
    if(!asset || !['1h','1d','1w'].includes(interval)) throw new Error('Ativo ou intervalo inválido.')
    const cacheKey=`candles:${id}:${interval}`, cached=this.store.snapshot().market[cacheKey]
    if(cached && Date.now()-Date.parse(cached.fetchedAt)<60000) return cached
    try {
      let points,source
      if(asset.provider==='coinbase') {
        const granularity=interval==='1h'?3600:86400
        const data=await this.json(`https://api.exchange.coinbase.com/products/${encodeURIComponent(asset.symbol)}/candles?granularity=${granularity}`)
        points=data.map(r=>({time:r[0],low:r[1],high:r[2],open:r[3],close:r[4]})); source='Coinbase Exchange'
      } else if(asset.provider==='brapi') {
        const key=this.getKey('brapi')
        const q=(await this.json(`https://brapi.dev/api/quote/${encodeURIComponent(asset.symbol)}?range=${interval==='1h'?'5d':'1y'}&interval=${interval==='1w'?'1wk':interval}`,key?{Authorization:`Bearer ${key}`} : {})).results?.[0]
        points=q?.historicalDataPrice?.map(r=>({time:r.date,open:r.open,high:r.high,low:r.low,close:r.close}));source='brapi · B3'
      } else if(asset.provider==='twelve') {
        const key=this.getKey('twelve');if(!key) throw new Error('Cadastre sua chave Twelve Data.')
        const data=await this.json(`https://api.twelvedata.com/time_series?${new URLSearchParams({symbol:asset.symbol,exchange:asset.exchange,interval:interval==='1h'?'1h':interval==='1w'?'1week':'1day',outputsize:'300',timezone:'UTC'})}`,{Authorization:`apikey ${key}`})
        points=data.values?.map(r=>({time:Date.parse(r.datetime.replace(' ','T')+(r.datetime.includes(' ')?'Z':'T00:00:00Z'))/1000,open:Number(r.open),high:Number(r.high),low:Number(r.low),close:Number(r.close)}));source='Twelve Data'
      } else throw new Error('O ativo manual não tem histórico de mercado. Escolha um provedor ao editar.')
      if(!Array.isArray(points)) throw new Error('O provedor não disponibilizou histórico neste plano.')
      points=points.filter(p=>[p.time,p.open,p.high,p.low,p.close].every(Number.isFinite) && p.low>=0 && p.high>=Math.max(p.open,p.close) && p.low<=Math.min(p.open,p.close)).sort((a,b)=>a.time-b.time)
      points=[...new Map(points.map(p=>[p.time,p])).values()]
      if(interval==='1w' && asset.provider==='coinbase') {
        const groups=new Map()
        for(const p of points) { const d=new Date(p.time*1000);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));d.setUTCHours(0,0,0,0);const t=d.getTime()/1000;const prev=groups.get(t);groups.set(t,prev?{...prev,high:Math.max(prev.high,p.high),low:Math.min(prev.low,p.low),close:p.close}:{...p,time:t}) }
        points=[...groups.values()]
      }
      const result={points,source,fetchedAt:iso()};this.store.cacheMarket(cacheKey,result);return result
    } catch(error) { if(cached) return {...cached,cached:true}; throw error }
  }
}
