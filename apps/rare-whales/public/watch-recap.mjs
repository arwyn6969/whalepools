import {recapURL,recapShareData,recapCard,recapPNG,sharePaperLink} from './paper-share.mjs';
import {downloadLocal} from './fleet-social.mjs';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n===null?'not recorded':'$'+n.toFixed(2);
const stamp=t=>t?new Date(t).toISOString().slice(0,16).replace('T',' ')+' UTC':'not observed yet';
export function recapHTML(r,{nickname="Whale watch",base="https://example.invalid/"}={}){
 const c=r.coverage;
 return `<label>UTC recap day <select data-recap-day="${esc(r.id)}" aria-label="UTC recap day">${r.days.map(d=>`<option ${d===r.day?'selected':''}>${d}</option>`).join('')}</select></label><h3>${r.completeDay?'SAVED DAY':'DAY SO FAR'} · ${r.day}</h3>
 <p class="recap-story">${r.buys+r.sells?`Your crew recorded ${r.buys} simulated ${r.buys===1?'buy':'buys'} and ${r.sells} ${r.sells===1?'sell':'sells'}.`:'No simulated fills were recorded in this window. Waiting is part of the preset rules.'}</p>
 <div class="board-metrics"><div><span>BALANCE AT LAST CLOSE</span><strong>${money(r.balance)}</strong></div><div><span>WINDOW CHANGE</span><strong>${money(r.change)}</strong></div><div><span>RECORDED FEES</span><strong>${money(r.fees)}</strong></div><div><span>MODELED FILL SLIPPAGE</span><strong>${money(r.slippage)}</strong></div></div>
 <p>${c.recorded}/${c.expected} scheduled closes valued · ${c.actionable} could trigger orders · ${c.missing} missing. ${c.recorded===c.expected&&c.recorded===c.actionable&&c.expected?'Every scheduled close in this window could trigger an order.':'Coverage is partial or still waiting; missing and late closes cannot invent fills.'}</p>
 <p class="muted">Window ${stamp(r.from)} → ${stamp(r.until)}. Last valuation ${stamp(r.lastValuation)}.<br>Change starts at the saved baseline ${stamp(r.baselineAt)}; the 25% hold reference changed ${money(r.holdChange)}. Fees and fill slippage are already reflected in the balance. Marked open positions include estimated exit costs.</p>
 ${r.events.length?`<details><summary>LAST ${r.events.length} FILLS IN THIS DAY</summary><ul>${r.events.map(e=>`<li>${stamp(e.at)} · whale ${e.agent+1} · ${esc(e.kind)}${e.pnl===undefined?'':' · realized '+money(e.pnl)} · ${esc(e.reason)}</li>`).join('')}</ul><p class="muted">Counts and costs above use the entire day’s ledger. Fill times are actual receipt times in UTC.</p></details>`:''}
 <p class="muted">${esc(r.note)}</p><p class="version-hash">Saved rules ${esc(r.rulesHash)}. This recap summarizes the record; it does not score or replay it.</p>
 <div class="recap-share paper-share"><label>Link to this UTC day<input readonly aria-label="Saved UTC day link" value="${esc(recapURL(base,r.id,r.day))}"></label><div class="form-actions"><button class="pixel-button yellow small" data-recap-share="${r.id}">SHARE THIS DAY ↗</button><button class="pixel-button white small" data-recap-copy="${r.id}">COPY DAY LINK</button><button class="pixel-button blue small" data-recap-png="${r.id}">DAY PNG ↓</button><button class="pixel-button white small" data-recap-card="${r.id}">DAY SVG ↓</button></div><p data-recap-share-status role="status"></p><p class="muted">Cards keep this displayed snapshot. The link opens this UTC day and can update while it unfolds. You choose where to share it.</p></div>`;
}
export function installWatchRecaps({root,api,address,onRead=()=>false,onShare=()=>{},nickname=()=>"Whale watch",base=()=>location.href}){
 let generation=0;const saved=new Map(),pending=new Set(),requested=new Map();
 const state=id=>saved.get(id),html=r=>recapHTML(r,{nickname:nickname(r.id),base:base()});
 function panel(id){const s=state(id);return `<section class="watch-recap" data-watch-recap="${id}" aria-label="Daily watch recap"><div class="form-actions"><button class="pixel-button blue small" data-recap="${id}" ${pending.has(id)?'disabled':''}>${s?'UPDATE DAILY RECAP ↻':'WHAT HAPPENED TODAY? →'}</button></div><p data-recap-status role="status">${pending.has(id)?'Reading the saved day…':s?'Recap snapshot. Update to read newer observations.':''}</p><div data-recap-content>${s?(pending.has(id)?html(s).replace('<select data-','<select disabled data-'):html(s)):''}</div></section>`;}
 async function load(id,day,explicitReview=true){
  if(pending.has(id))return;const token=generation,wallet=address();pending.add(id);requested.set(id,day);
  const host=()=>root.querySelector(`[data-watch-recap="${id}"]`);
  const current=host();if(!current){pending.delete(id);return;}
  current.querySelector('[data-recap-status]').textContent='Reading the saved day…';
  for(const control of current.querySelectorAll('button,select'))control.disabled=true;
  try{const r=await api('/api/paper/recap/'+id+(day?'?day='+encodeURIComponent(day):''));
   if(token!==generation||wallet!==address()||!host())return;
   if(r.id!==id||day&&r.day!==day)throw Error('The saved day response did not match this link.');
   recapShareData(r,nickname(id),base());
   if(saved.size>=20&&!saved.has(id))saved.delete(saved.keys().next().value);
   saved.set(id,r);requested.set(id,r.day);host().querySelector('[data-recap-content]').innerHTML=html(r);
   const reviewed=explicitReview&&onRead(r);host().querySelector('[data-recap-status]').textContent='Saved day loaded. Update to read newer observations.'+(reviewed?' New observation reviewed in your local live report.':'');
   host().querySelector('[data-recap]').textContent='UPDATE DAILY RECAP ↻';
   return true;
  }catch(e){if(token===generation&&wallet===address()&&host())host().querySelector('[data-recap-status]').textContent='Could not load the recap. '+e.message+' Your watch and last displayed recap are kept. Try Update daily recap.';}
  finally{if(token===generation){pending.delete(id);if(host())for(const control of host().querySelectorAll('button,select'))control.disabled=false;}}
 }
 root.addEventListener('click',async e=>{
  const read=e.target.closest('[data-recap]');if(read){load(read.dataset.recap,requested.get(read.dataset.recap)??state(read.dataset.recap)?.day);return;}
  const button=e.target.closest('[data-recap-share],[data-recap-copy],[data-recap-card],[data-recap-png]');if(!button)return;
  const id=button.dataset.recapShare||button.dataset.recapCopy||button.dataset.recapCard||button.dataset.recapPng,r=state(id);if(!r||pending.has(id))return;
  const host=button.closest('[data-watch-recap]'),content=host.querySelector('[data-recap-content]'),status=host.querySelector('[data-recap-share-status]'),token=generation,wallet=address();
  const current=()=>token===generation&&wallet===address()&&host.isConnected&&host.querySelector('[data-recap-content]')===content&&status.isConnected&&state(id)===r;
  button.disabled=true;
  try{
   const share=recapShareData(r,nickname(id),base());
   if(button.dataset.recapShare){
    const result=await sharePaperLink(share,{current});if(!current())return;
    if(result==='cancelled'){status.textContent='Share cancelled. Your saved day is kept.';return;}
    if(result==='sheet'){onShare();status.textContent='Day link passed to your share sheet. Check your chosen app to confirm delivery.';return;}
    if(result==='copied'){onShare();status.textContent='Native sharing unavailable here. Day link copied; choose where to share it.';return;}
    if(result==='manual'){const input=host.querySelector('[aria-label="Saved UTC day link"]');input.focus();input.select();status.textContent='Select and copy the day link with your browser’s copy command.';}return;
   }
   if(button.dataset.recapCopy){
    try{await navigator.clipboard.writeText(share.url);if(current()){onShare();status.textContent='Day link copied. It opens '+r.day+' UTC; choose where to share it.';}}
    catch{if(current()){const input=host.querySelector('[aria-label="Saved UTC day link"]');input.focus();input.select();status.textContent='Select and copy the day link with your browser’s copy command.';}}return;
   }
   const png=!!button.dataset.recapPng;
   status.textContent='Creating this displayed day snapshot…';
   const value=png?await recapPNG(r,nickname(id),base()):recapCard(r,nickname(id),base());if(!current())return;
   downloadLocal(value,png?'image/png':'image/svg+xml','whale-day-'+id+'-'+r.day+(png?'.png':'.svg'));onShare();status.textContent='Day '+(png?'PNG':'SVG')+' downloaded with the displayed balance, coverage and rules.';
  }catch{if(current())status.textContent='This day could not be shared. Try Copy day link or the other card format.';}
  finally{if(button.isConnected)button.disabled=false;}
 });
 root.addEventListener('change',e=>{if(e.target.matches('[data-recap-day]'))load(e.target.dataset.recapDay,e.target.value);});
 return {panel,latest(id){return load(id,null,true);},open(id,day){if(state(id)?.day!==day)return load(id,day,false);},invalidate(clear=false){generation++;pending.clear();requested.clear();if(clear)saved.clear();}};
}
