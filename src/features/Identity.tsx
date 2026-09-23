import { useState } from 'react'
import { Folder, House, BriefcaseBusiness, Plane, Heart, Car, GraduationCap, Rocket, Wallet, Banknote, Landmark, Bitcoin, Gem, ChartNoAxesCombined, Upload, Camera, Music, ShoppingBag, Globe, Shield, Palmtree } from 'lucide-react'
import { api } from '../lib/api'
import bb from '../assets/bb.png'
import nubank from '../assets/nubank.png'
import santander from '../assets/santander.jpeg'
import picpay from '../assets/picpay.jpeg'
import sicredi from '../assets/sicredi.jpeg'
import caixa from '../assets/caixa.jpeg'
import btg from '../assets/btg.png'
import banrisul from '../assets/banrisul.jpeg'
import safra from '../assets/safra.jpeg'
import nomad from '../assets/nomad.jpeg'
import contasimples from '../assets/contasimples.jpeg'

const logos:[RegExp,string][] = [[/banco do brasil|\bbb\b/i,bb],[/nubank|\bnu\b/i,nubank],[/santander/i,santander],[/picpay/i,picpay],[/sicredi/i,sicredi],[/caixa/i,caixa],[/\bbtg\b/i,btg],[/banrisul/i,banrisul],[/safra/i,safra],[/nomad/i,nomad],[/conta simples/i,contasimples]]
const icons = {folder:Folder,home:House,work:BriefcaseBusiness,travel:Plane,heart:Heart,car:Car,study:GraduationCap,rocket:Rocket,wallet:Wallet,cash:Banknote,bank:Landmark,bitcoin:Bitcoin,crypto:Gem,chart:ChartNoAxesCombined,camera:Camera,music:Music,shopping:ShoppingBag,world:Globe,shield:Shield,holiday:Palmtree}
const iconNames:Record<string,string>={folder:'Pasta',home:'Casa',work:'Trabalho',travel:'Viagem',heart:'Família',car:'Carro',study:'Estudos',rocket:'Projeto',wallet:'Carteira',cash:'Dinheiro',bank:'Banco',bitcoin:'Bitcoin',crypto:'Cripto',chart:'Investimentos',camera:'Fotografia',music:'Música',shopping:'Compras',world:'Internacional',shield:'Reserva',holiday:'Férias'}
export function Identity({value='',name='',color,size=28}:{value?:string;name?:string;color?:string;size?:number}) {
  const source=value.startsWith('data:image/png;')?value:!value?logos.find(([match])=>match.test(name))?.[1]:undefined
  const Icon=icons[value as keyof typeof icons]
  const hue=[...name].reduce((sum,c)=>sum+c.charCodeAt(0),0)%360
  return <span className="identity" style={{width:size,height:size,color:color||`hsl(${hue} 68% 78%)`,background:color?`${color}15`:`hsl(${hue} 30% 26% / .6)`}}>{source?<img src={source} alt=""/>:Icon?<Icon size={size*.57}/>:<span>{name.trim().slice(0,2).toUpperCase()||'•'}</span>}</span>
}
export function IconPicker({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const [error,setError]=useState('')
  return <div className="icon-picker"><span className="hint">Ícone</span><div className="icon-options">{Object.keys(icons).map(key=><button key={key} type="button" className={value===key?'selected':''} title={iconNames[key]} aria-label={`Ícone ${iconNames[key]}`} aria-pressed={value===key} onClick={()=>onChange(key)}><Identity value={key}/></button>)}<button type="button" title="Usar ícone da instituição" onClick={()=>onChange('')}>Auto</button><button type="button" aria-label="Importar ícone" title="Importar PNG, JPG ou WebP" onClick={async()=>{try{const result=await api.importIcon();if(result.icon)onChange(result.icon)}catch(e){setError(e instanceof Error?e.message:'Falha ao importar')}}}><Upload size={17}/></button>{value.startsWith('data:')&&<Identity value={value}/>}</div>{error&&<span role="alert" className="error-text">{error}</span>}</div>
}
