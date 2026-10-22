import {companyId} from './company-share.mjs';

const PREFIX='whale-pools-watch-bookmarks-v1',TTL=30*86400000,MAX=20;
const fields=['valuationAt','equity','timely','gaps','closedTrades','status','rememberedAt'];
const statuses=new Set(['running','stopped','completed']);
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
function scope(wallet,rulesHash){
 if(typeof wallet!=='string'||typeof rulesHash!=='string'||!/^0x[0-9a-f]{40}$/i.test(wallet)||!/^[0-9a-f]{64}$/.test(rulesHash))throw Error('A bookmark needs its holder and exact rules.');
 return {wallet:wallet.toLowerCase(),rulesHash,key:`${PREFIX}:${wallet.toLowerCase()}:${rulesHash}`};
}
function marker(v){
 return exact(v,fields)&&integer(v.valuationAt)&&v.valuationAt>0&&Number.isFinite(new Date(v.valuationAt).getTime())&&Number.isFinite(v.equity)&&v.equity>=0&&['timely','gaps','closedTrades','rememberedAt'].every(k=>integer(v[k]))&&statuses.has(v.status);
}
function read(storage,s,now){
 let raw;try{raw=storage.getItem(s.key);}catch{return {status:'unavailable',records:{}};}
 if(raw===null)return {status:'missing',records:{}};
 try{
  if(typeof raw!=='string'||raw.length>16384)throw Error('Too large');
  const d=JSON.parse(raw);
  if(!exact(d,['version','wallet','rulesHash','records'])||d.version!==1||d.wallet!==s.wallet||d.rulesHash!==s.rulesHash||!d.records||typeof d.records!=='object'||Array.isArray(d.records)||Object.keys(d.records).length>MAX)throw Error('Wrong bookmark scope');
  const records={};for(const [id,v] of Object.entries(d.records)){
   if(!companyId(id)||!marker(v)||v.rememberedAt>now)throw Error('Invalid bookmark');
   if(now-v.rememberedAt<TTL)records[id]=v;
  }
  return {status:'loaded',records};
 }catch{return {status:'corrupt',records:{}};}
}
export function watchSnapshot(run,wallet,rulesHash,now=Date.now()){
 const s=scope(wallet,rulesHash),last=run?.history?.at(-1);
 if(run?.owner?.toLowerCase()!==s.wallet||run.rulesHash!==rulesHash||!companyId(run.id)||!statuses.has(run.status))throw Error('Only your matching dated watch can be remembered.');
 if(!last)return null;
 const v={valuationAt:last.t,equity:run.stats?.equity,timely:run.observedBars,gaps:run.gapBars,closedTrades:run.stats?.trades,status:run.status,rememberedAt:now};
 if(!marker(v))throw Error('The saved watch snapshot is incomplete.');
 return v;
}
export function loadWatchBookmark(storage,wallet,rulesHash,id,now=Date.now()){
 let s;try{s=scope(wallet,rulesHash);if(!companyId(id))throw Error('Invalid watch');}catch{return {status:'invalid',bookmark:null};}
 const result=read(storage,s,now);return {status:result.status,bookmark:result.records[id]??null};
}
export function watchReturnStory(snapshot,bookmark){
 if(!snapshot)return {state:'waiting'};
 if(!bookmark)return {state:'first'};
 if(snapshot.valuationAt<bookmark.valuationAt||['timely','gaps','closedTrades'].some(k=>snapshot[k]<bookmark[k]))return {state:'older'};
 const newer=snapshot.valuationAt>bookmark.valuationAt;
 return {state:newer?'new':'current',from:bookmark.valuationAt,until:snapshot.valuationAt,change:snapshot.equity-bookmark.equity,timely:snapshot.timely-bookmark.timely,gaps:snapshot.gaps-bookmark.gaps,closedTrades:snapshot.closedTrades-bookmark.closedTrades};
}
export function rememberWatch(storage,wallet,rulesHash,run,now=Date.now()){
 let s,snapshot;try{s=scope(wallet,rulesHash);snapshot=watchSnapshot(run,wallet,rulesHash,now);}catch{return {status:'invalid'};}
 if(!snapshot)return {status:'waiting'};
 const loaded=read(storage,s,now);if(loaded.status==='unavailable')return {status:'unavailable'};
 if(watchReturnStory(snapshot,loaded.records[run.id]).state==='older')return {status:'older'};
 const records=loaded.records;delete records[run.id];records[run.id]=snapshot;
 const retained=Object.fromEntries(Object.entries(records).sort((a,b)=>a[1].rememberedAt-b[1].rememberedAt).slice(-MAX));
 try{storage.setItem(s.key,JSON.stringify({version:1,wallet:s.wallet,rulesHash,records:retained}));return {status:'saved',bookmark:snapshot};}catch{return {status:'unavailable'};}
}
export function forgetWatch(storage,wallet,rulesHash,id,now=Date.now()){
 let s;try{s=scope(wallet,rulesHash);if(!companyId(id))throw Error('Invalid watch');}catch{return {status:'invalid'};}
 const loaded=read(storage,s,now);if(loaded.status==='unavailable')return {status:'unavailable'};
 delete loaded.records[id];
 try{storage.setItem(s.key,JSON.stringify({version:1,wallet:s.wallet,rulesHash,records:loaded.records}));return {status:'forgotten'};}catch{return {status:'unavailable'};}
}

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=t=>new Date(t).toISOString().slice(0,16).replace('T',' ')+' UTC';
const money=n=>(n<0?'−':'+')+'$'+Math.abs(n).toFixed(2);
export function watchReturnHTML(run,{snapshot,bookmark,storageStatus,rules,expanded=false}){
 const story=watchReturnStory(snapshot,bookmark),newer=story.state==='new';
 const title=newer?'SINCE YOUR LAST LOOK':story.state==='current'?"YOU’RE UP TO DATE":'YOUR NEXT CHECK-IN';
 const intro=story.state==='waiting'?(run.status==='running'?'Your first saved observation is still ahead. Remember a snapshot once the next candle has been valued.':'This watch froze before its first saved valuation. A follow-up starts a separate record.'):story.state==='older'?'This view is older than your bookmark. Refresh fleet before remembering another snapshot.':story.state==='first'?'Remember this snapshot. When you return in this browser, see what changed in this dated watch.':`Your remembered valuation ${stamp(story.from)} → latest saved valuation ${stamp(story.until)}.`;
 const groups=Object.entries(rules.presets).map(([id,p])=>{
  const whales=run.agents.filter(a=>a.preset===id);if(!whales.length)return '';
  const holding=whales.filter(a=>a.qty>0).length,queued=whales.filter(a=>a.pending).length,watching=whales.filter(a=>!a.qty&&!a.pending).length;
  const reasons=[...new Set(whales.map(a=>a.action))].slice(0,2);
  return `<div><h4>${esc(p.name)}</h4><p>${holding} holding · ${queued} order${queued===1?'':'s'} queued · ${watching} watching</p>${reasons.map(r=>`<p class="muted">${esc(r)}</p>`).join('')}</div>`;
 }).join('');
 return `<section class="watch-return" data-watch-return="${esc(run.id)}" aria-label="Your watch check-in"><p class="eyebrow">YOUR COMPANY · ${esc(run.nickname)}</p><h3 tabindex="-1">${title}</h3><p>${intro}</p>
 ${newer?`<div class="board-metrics"><div><span>PAPER BALANCE CHANGE</span><strong>${money(story.change)}</strong></div><div><span>NEW TIMELY OBSERVATIONS</span><strong>${story.timely}</strong></div><div><span>NEW CLOSED TRADES</span><strong>${story.closedTrades}</strong></div><div><span>NEW SKIPPED / GAP BARS</span><strong>${story.gaps}</strong></div></div><p>${story.closedTrades?'Your crew closed simulated trades. See the latest daily recap for its actual fills and costs.':'No new closed trades. Open positions and waiting decisions are shown below.'} ${story.gaps?'Some new closes were interrupted; they cannot invent fills.':''}</p><p class="muted">Balance change includes marked open positions and modeled costs; it is not realized profit. Timely receipts and gap counts can overlap.</p>`:story.state==='current'?'<p>No newer saved valuation yet. Your bookmark stays put while the recorder watches for the next candle.</p>':''}
 <details ${expanded?'open':''}><summary>WHAT IS MY CREW WAITING FOR?</summary><div class="watch-return-crew">${groups}</div><p class="muted">These are saved decisions, not predictions. Different whale DNA can give the same preset different positions; inspect each whale below.</p></details>
 ${run.status!=='running'?'<p>This watch is frozen. Its latest saved valuation stays in the archive; a follow-up starts a separate record.</p>':''}
 <div class="form-actions"><button class="pixel-button yellow small" data-watch-remember="${run.id}" ${!snapshot||story.state==='older'||story.state==='current'?'disabled':''}>REMEMBER THIS SNAPSHOT</button><button class="pixel-button blue small" data-watch-latest-recap="${run.id}">READ LATEST DAILY RECAP →</button>${bookmark?`<button class="link-button" data-watch-forget="${run.id}">FORGET THIS BOOKMARK</button>`:''}</div>
 <p class="muted">Optional bookmark, only in this browser for this wallet/watch/rules. At most 20 snapshots, kept for 30 days. No automatic upload; visiting a page never marks it read.</p><p data-watch-return-status role="status">${storageStatus==='unavailable'?'Browser storage is unavailable. You can still read and share the saved daily recap.':storageStatus==='corrupt'?'The old bookmark could not be read. Remember this snapshot to begin again; your server record is safe.':''}</p></section>`;
}
