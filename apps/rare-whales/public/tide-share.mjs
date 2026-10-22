import {validRecapDate,svgPNG} from './paper-share.mjs';
const presets=['trend','breakout','recovery'];
const stamp=t=>t===null?'not observed yet':new Date(t).toISOString().slice(0,16).replace('T',' ')+' UTC';
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const time=t=>Number.isSafeInteger(t)&&t>=0&&Number.isFinite(new Date(t).getTime());
export function validTideId(id){return typeof id==='string'&&/^tide-[0-9a-f]{12}-\d{4}-\d{2}-\d{2}$/.test(id)&&!!validRecapDate(id.slice(-10));}
export function tidePath(path){const id=path.match(/\/tide\/([^/]+)$/)?.[1];return validTideId(id)?id:null;}
export function tideURL(base,id){
 if(!validTideId(id))throw Error('Choose a saved Daily Tide round.');
 const url=new URL(base);if(!['http:','https:'].includes(url.protocol))throw Error('Use an HTTP round link.');
 url.username='';url.password='';url.search='';url.hash='';
 url.pathname=url.pathname.replace(/\/(?:watch|tide)\/[^/]*\/?$/,'/').replace(/\/index\.html$/,'/').replace(/\/?$/,'/')+'tide/'+id;return url.href;
}
export function tideStory(r){
 if(!validTideId(r?.id)||!/^[0-9a-f]{64}$/.test(r.rulesHash||'')||r.id!=='tide-'+r.rulesHash.slice(0,12)+'-'+new Date(r.startsAt).toISOString().slice(0,10)||!time(r.startsAt)||!time(r.endsAt)||r.endsAt-r.startsAt!==86400000||!['queued','running','completed','paused'].includes(r.status)||!['pending','complete','partial'].includes(r.quality)||r.strategies?.length!==3)throw Error('Refresh the saved round before sharing.');
 if(new Set(r.strategies.map(s=>s.preset)).size!==3)throw Error('Round presets are incomplete.');
 for(const s of r.strategies){
  if(!presets.includes(s.preset)||typeof s.name!=='string'||s.name.length>64||!['equity','returnPct','maxDrawdown','trades','exposure','hold'].every(k=>Number.isFinite(s.stats?.[k]))||!Number.isSafeInteger(s.stats.trades)||s.stats.trades<0||!['observedBars','gapBars'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0&&s[k]<=288)||s.lastObservation!==null&&(!time(s.lastObservation)||s.lastObservation<=r.startsAt||s.lastObservation>r.endsAt))throw Error('Round observations are incomplete.');
 }
 const final=r.status==='completed'&&r.quality==='complete';
 if(final&&!r.strategies.every(s=>s.observedBars===288&&s.gapBars===0&&Number.isSafeInteger(s.rank)&&s.rank>=1&&s.rank<=3))throw Error('Final ranks need the complete saved round.');
 const interrupted=r.status==='completed'&&!final||r.strategies.some(s=>s.gapBars>0);
 const frozen=['completed','paused'].includes(r.status),trades=r.strategies.reduce((n,s)=>n+s.stats.trades,0),observed=Math.min(...r.strategies.map(s=>s.observedBars)),gaps=Math.max(...r.strategies.map(s=>s.gapBars));
 const title=final?'THE TIDE IS IN':r.status==='completed'?'THIS TIDE ENDED WITH GAPS':r.status==='queued'?'YOUR NEXT SHARED WATCH':r.status==='paused'?'THIS DATED ROUND IS PAUSED':'THE TIDE IS STILL UNFOLDING';
 const leaders=final?r.strategies.filter(s=>s.rank===1).map(s=>s.name):[];
 const description=final?leaders.join(' and ')+(leaders.length>1?' share rank 1. Matching net returns tie.':' finished at rank 1.')+' All three presets recorded 288 timely, gap-free closes.':r.status==='completed'?'The 24-hour window ended with interrupted or missing closes. These saved balances remain inspectable, with no final ranks.':r.status==='paused'?'This record uses earlier rules. Its saved valuations remain inspectable; it cannot accept another pick.':r.status==='queued'?'Choose one familiar preset before the common UTC start. Your owned whale is its badge; every preset uses equal paper money and neutral stats.':interrupted?'New observations still arrive, but interrupted closes mean this round will keep partial results without final ranks.':'All three presets face the same arriving prices. The outcome is still open; these balances are not final ranks.';
 const activity=r.status==='queued'?'No round observations yet. The shared watch starts at the displayed UTC time.':!trades?'No preset closed a trade. Holding and waiting are part of these rules.':trades+' closed simulated trades across the three shared presets; holder picks do not create separate executions.';
 return {title,description,activity,final,frozen,interrupted,observed,gaps,leaders};
}
export function tideShareData(r,base){
 const s=tideStory(r),day=r.id.slice(-10);
 return {title:'Daily Tide · '+day+' · Whale Pools',text:'Live market, simulated money. UTC round '+stamp(r.startsAt)+' → '+stamp(r.endsAt)+'. '+s.title+'. '+s.description+' At least '+s.observed+'/288 timely observations per preset; up to '+s.gaps+' skipped/gap bars. '+s.activity+' Equal $1,000 budgets; modeled costs. No retrospective fills or proven strategy edge.',url:tideURL(base,r.id)};
}
export function tideCard(r,base){
 const story=tideStory(r),share=tideShareData(r,base),rows=[
  story.title,'UTC window '+stamp(r.startsAt)+' → '+stamp(r.endsAt),
  story.final?'FINAL RANKS · all three presets: 288/288 timely closes, zero gaps':'NO FINAL RANKS · '+r.status.toUpperCase()+' · at least '+story.observed+'/288 timely closes per preset',
  ...r.strategies.flatMap(s=>[(story.final?'Rank '+s.rank+' · ':'')+s.name+' · $'+s.stats.equity.toFixed(2)+' · net '+s.stats.returnPct.toFixed(3)+'%',s.stats.maxDrawdown.toFixed(3)+'% drawdown · '+s.stats.trades+' closed trades · '+s.observedBars+'/288 timely · '+s.gapBars+' skipped/gap bars','Last valuation '+stamp(s.lastObservation)]),
  'Equal neutral stats, $1,000 budgets. UBTC / USDC spot; no deposits or real orders.',
  '0.08% fee + 0.05% slippage per side. Missing/late closes cannot invent fills.',
  story.frozen?'Frozen at the last valuation, including estimated exit costs; no closing fill invented.':'Downloaded snapshot; the dated link updates while this round unfolds.',
  'Marked balances are not realized profit or proof of strategy skill.',
  'Rules '+r.rulesHash,share.url
 ];
 const height=250+rows.length*32;
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="'+height+'" viewBox="0 0 1200 '+height+'" role="img" aria-label="Daily Tide '+xml(r.id.slice(-10))+' saved round"><rect width="100%" height="100%" fill="#fff5dd"/><rect x="24" y="24" width="1152" height="92" fill="#baafff" stroke="#16233f" stroke-width="6"/><g fill="#16233f" font-family="sans-serif"><text x="54" y="83" font-size="34" font-weight="bold">WHALE POOLS · LIVE MARKET · SIMULATED MONEY</text><text x="54" y="174" font-size="38" font-weight="bold">DAILY TIDE · '+xml(r.id.slice(-10))+'</text>'+rows.map((line,i)=>'<text x="54" y="'+(225+i*32)+'" font-size="'+(i===rows.length-1?14:19)+'">'+xml(line)+'</text>').join('')+'</g></svg>';
}
export function tidePNG(r,base){return svgPNG(tideCard(r,base));}
