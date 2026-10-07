import {companyId} from './company-share.mjs';
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const stamp=t=>Number.isSafeInteger(t)?new Date(t).toISOString().slice(0,16).replace('T',' ')+' UTC':'No completed observation';
export function paperURL(base,id){
 if(!companyId(id))throw Error('Invalid dated paper record.');
 const url=new URL(base);
 if(!['http:','https:'].includes(url.protocol))throw Error('Use an HTTP paper record link.');
 url.username='';url.password='';url.search='';url.hash='paper/'+id.toLowerCase();return url.href;
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
