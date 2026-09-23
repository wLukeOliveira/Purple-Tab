import { useState } from 'react'
import type { Investment } from '../lib/types'
import { Identity } from './Identity'
const bundled=import.meta.glob('/node_modules/cryptocurrency-icons/svg/color/*.svg',{eager:true,query:'?url',import:'default'}) as Record<string,string>
const cryptoIcons=Object.fromEntries(Object.entries(bundled).map(([path,url])=>[path.split('/').at(-1)!.replace('.svg','').toUpperCase(),url]))
export default function AssetIdentity({asset,size=40}:{asset:Pick<Investment,'symbol'|'name'|'kind'|'provider'>&{icon?:string};size?:number}) {
  const [failed,setFailed]=useState('')
  const symbol=asset.symbol.split(/[-/]/)[0]
  const source=asset.icon?'':asset.kind==='crypto'?cryptoIcons[symbol]:asset.provider==='brapi'?`https://icons.brapi.dev/icons/${encodeURIComponent(asset.symbol)}.svg`:''
  if(source&&source!==failed)return <span className="identity" style={{width:size,height:size}}><img src={source} alt="" onError={()=>setFailed(source)}/></span>
  return <Identity value={asset.icon || (asset.kind==='fixed'?'shield':asset.kind==='crypto'?'crypto':'chart')} name={asset.name} size={size}/>
}
