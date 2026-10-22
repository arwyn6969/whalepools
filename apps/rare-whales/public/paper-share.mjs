import {companyId} from './company-share.mjs';
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const stamp=t=>Number.isSafeInteger(t)?new Date(t).toISOString().slice(0,16).replace('T',' ')+' UTC':'No completed observation';
export function paperURL(base,id){
 if(!companyId(id))throw Error('Invalid dated paper record.');
 const url=new URL(base);
 if(!['http:','https:'].includes(url.protocol))throw Error('Use an HTTP paper record link.');
 url.username='';url.password='';url.search='';url.hash='';
 url.pathname=url.pathname.replace(/\/(?:watch|tide)\/[^/]*\/?$/,'/').replace(/\/index\.html$/,'/').replace(/\/?$/,'/')+'watch/'+id.toLowerCase();return url.href;
}
export function watchPath(path){const id=path.match(/\/watch\/([^/]+)$/)?.[1];return companyId(id)?id.toLowerCase():null;}
export async function paperPNG(run,url){return svgPNG(paperCard(run,url));}
export async function recapPNG(recap,nickname,url){return svgPNG(recapCard(recap,nickname,url));}
export async function svgPNG(card){
 // Draw our small, generated text/rectangle SVG vocabulary directly. No remote
 // images, blob image permission, SVG scripts or browser-specific SVG decoding.
 const svg=new DOMParser().parseFromString(card,'image/svg+xml').documentElement;
 const canvas=document.createElement('canvas');canvas.width=Number(svg.getAttribute('width'));canvas.height=Number(svg.getAttribute('height'));
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image export unavailable');
 for(const rect of svg.querySelectorAll('rect')){const n=k=>Number(rect.getAttribute(k)||0),w=rect.getAttribute('width')==='100%'?canvas.width:n('width'),h=rect.getAttribute('height')==='100%'?canvas.height:n('height');ctx.fillStyle=rect.getAttribute('fill');ctx.fillRect(n('x'),n('y'),w,h);if(rect.hasAttribute('stroke')){ctx.strokeStyle=rect.getAttribute('stroke');ctx.lineWidth=n('stroke-width');ctx.strokeRect(n('x'),n('y'),w,h);}}
 ctx.fillStyle='#16233f';for(const text of svg.querySelectorAll('text')){ctx.font=`${text.getAttribute('font-weight')||'normal'} ${text.getAttribute('font-size')}px sans-serif`;ctx.fillText(text.textContent,Number(text.getAttribute('x')),Number(text.getAttribute('y')));}
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Image export timed out')),5000);canvas.toBlob(blob=>{clearTimeout(timer);blob?resolve(blob):reject(Error('Image export unavailable'));},'image/png');});
}
export function paperCard(run,url){
 if(!companyId(run?.id)||! /^[0-9a-f]{64}$/.test(run.rulesHash||'')||!run.stats||!Array.isArray(run.history)||!Array.isArray(run.agents)||run.agents.length>12)throw Error('Refresh a saved paper record before exporting.');
 for(const key of ['equity','returnPct','maxDrawdown','trades','exposure'])if(!Number.isFinite(run.stats[key]))throw Error('Paper snapshot is incomplete.');
 const s=run.stats,last=run.history.at(-1),rows=[
  'Started '+stamp(run.createdAt)+' · ends '+stamp(run.endsAt),
  'Last valuation '+stamp(last?.t)+' · status '+run.status,
  'Balance $'+s.equity.toFixed(2)+' · net '+s.returnPct.toFixed(3)+'% · drawdown '+s.maxDrawdown.toFixed(3)+'%',
  s.trades+' closed trades · '+s.exposure.toFixed(2)+'% average marked exposure',
  run.observedBars+' timely observations · '+run.gapBars+' skipped/gap bars',
  run.owner?'Owned whale crew · DNA v1 · ownership checked at Start':'Neutral preset watch · illustrative whales, no ownership claim',
  ...run.agents.map(a=>(a.collection==='rarewhales'?'Rare Whales':'WhaleStreet')+' #'+a.tokenId+' · '+a.preset),
  'Signal then next timely five-minute close; 0.08% fee + 0.05% slippage per side.',
  'Late/backfilled candles cannot invent fills. Different start dates are not league ranks.',
  'Rules '+run.rulesHash,
  'Downloaded snapshot. The dated public link updates while this watch runs.',
  paperURL(url,run.id)
 ];
 const height=280+rows.length*31;
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="'+height+'" viewBox="0 0 1200 '+height+'" role="img" aria-label="'+xml(run.nickname)+' dated forward paper card"><rect width="100%" height="100%" fill="#fff5dd"/><rect x="24" y="24" width="1152" height="92" fill="#ffe17e" stroke="#16233f" stroke-width="6"/><g fill="#16233f" font-family="sans-serif"><text x="54" y="83" font-size="34" font-weight="bold">WHALE POOLS · LIVE MARKET · SIMULATED MONEY</text><text x="54" y="174" font-size="38" font-weight="bold">'+xml(run.nickname)+'</text><text x="54" y="214" font-size="24">$1,000 starting paper budget · UBTC / USDC spot</text>'+rows.map((line,i)=>'<text x="54" y="'+(260+i*31)+'" font-size="'+(i===rows.length-1?15:19)+'">'+xml(line)+'</text>').join('')+'</g></svg>';
}

export function validRecapDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const t=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===value?value:null;
}
export function recapURL(base,id,day){
 if(!validRecapDate(day))throw Error('Choose a valid saved UTC day.');
 const url=new URL(paperURL(base,id));url.searchParams.set('day',day);return url.href;
}
export function recapShareData(r,nickname,base){
 const c=r?.coverage;
 if(!companyId(r?.id)||!/^[0-9a-f]{64}$/.test(r.rulesHash||'')||!validRecapDate(r.day)||typeof r.completeDay!=='boolean'||!c)throw Error('Load a saved day before sharing.');
 for(const key of ['recorded','actionable','expected','missing'])if(!Number.isSafeInteger(c[key])||c[key]<0||c[key]>288)throw Error('Day coverage is incomplete.');
 if(c.actionable>c.recorded||c.recorded+c.missing!==c.expected)throw Error('Day coverage is incomplete.');
 for(const key of ['balance','change','fees','slippage'])if(r[key]!==null&&!Number.isFinite(r[key]))throw Error('Day balance is incomplete.');
 for(const key of ['buys','sells'])if(!Number.isSafeInteger(r[key])||r[key]<0)throw Error('Day fills are incomplete.');
 const cash=n=>n===null?'not recorded':'$'+n.toFixed(2),partial=!c.expected||c.missing>0||c.actionable<c.expected;
 const text=`Live market, simulated money. ${r.completeDay?'Saved UTC day':'UTC day so far'} ${r.day}. Balance ${cash(r.balance)} at ${stamp(r.lastValuation)}; window change ${cash(r.change)}. ${r.buys} simulated buys, ${r.sells} sells. ${c.actionable}/${c.expected} closes could trigger orders; ${partial?'coverage partial or waiting':'all closes actionable so far'}. ${r.completeDay?'':'This day is still unfolding. '}No retrospective fills or proven strategy edge.`;
 return {title:String(nickname).slice(0,64)+' · '+r.day+' · Whale Pools recap',text,url:recapURL(base,r.id,r.day)};
}
export function recapCard(r,nickname,base){
 const share=recapShareData(r,nickname,base),c=r.coverage,cash=n=>n===null?'not recorded':'$'+n.toFixed(2);
 const rows=[
  (r.completeDay?'SAVED UTC DAY':'UTC DAY SO FAR')+' · '+r.day+' · '+r.status,
  'Window '+stamp(r.from)+' → '+stamp(r.until),
  'Balance '+cash(r.balance)+' · window change '+cash(r.change),
  r.buys+' simulated buys · '+r.sells+' sells · last valuation '+stamp(r.lastValuation),
  'Recorded fees '+cash(r.fees)+' · modeled fill slippage '+cash(r.slippage),
  c.recorded+'/'+c.expected+' closes valued · '+c.actionable+' actionable · '+c.missing+' missing',
  !c.expected||c.missing||c.actionable<c.expected?'PARTIAL / WAITING · gaps cannot invent fills.':'All scheduled closes in this window could trigger orders.',
  'Change includes marked open positions and modeled exit costs; not realized profit.',
  'Fees and slippage are already reflected in balance. No proven strategy edge.',
  'Rules '+r.rulesHash,
  'Downloaded snapshot. This day link can update as new observations arrive.',
  share.url
 ];
 const height=280+rows.length*31;
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="'+height+'" viewBox="0 0 1200 '+height+'" role="img" aria-label="'+xml(nickname)+' UTC daily paper recap"><rect width="100%" height="100%" fill="#fff5dd"/><rect x="24" y="24" width="1152" height="92" fill="#83caff" stroke="#16233f" stroke-width="6"/><g fill="#16233f" font-family="sans-serif"><text x="54" y="83" font-size="34" font-weight="bold">WHALE POOLS · LIVE MARKET · SIMULATED MONEY</text><text x="54" y="174" font-size="38" font-weight="bold">'+xml(String(nickname).slice(0,64))+'</text><text x="54" y="214" font-size="24">A day on watch · UBTC / USDC spot</text>'+rows.map((line,i)=>'<text x="54" y="'+(260+i*31)+'" font-size="'+(i===rows.length-1?15:19)+'">'+xml(line)+'</text>').join('')+'</g></svg>';
}
// Called directly by a click: preserve the native share API's user activation.
// A cancelled sheet never copies, records an output or claims a post was made.
export async function sharePaperLink(data,{browser=navigator,current=()=>true}={}){
 if(typeof browser.share==='function'){
  try{await browser.share(data);return current()?'sheet':'stale';}
  catch(e){if(!current())return 'stale';if(e?.name==='AbortError')return 'cancelled';}
 }
 if(!current())return 'stale';
 try{await browser.clipboard.writeText(data.url);return current()?'copied':'stale';}
 catch{return current()?'manual':'stale';}
}
