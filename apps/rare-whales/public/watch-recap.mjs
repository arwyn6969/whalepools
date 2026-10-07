const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n===null?'not recorded':'$'+n.toFixed(2);
const stamp=t=>t?new Date(t).toISOString().slice(0,16).replace('T',' ')+' UTC':'not observed yet';
export function recapHTML(r){
 const c=r.coverage;
 return `<label>UTC recap day <select data-recap-day="${esc(r.id)}" aria-label="UTC recap day">${r.days.map(d=>`<option ${d===r.day?'selected':''}>${d}</option>`).join('')}</select></label><h3>${r.completeDay?'SAVED DAY':'DAY SO FAR'} · ${r.day}</h3>
 <p class="recap-story">${r.buys+r.sells?`Your crew recorded ${r.buys} simulated ${r.buys===1?'buy':'buys'} and ${r.sells} ${r.sells===1?'sell':'sells'}.`:'No simulated fills were recorded in this window. Waiting is part of the preset rules.'}</p>
 <div class="board-metrics"><div><span>BALANCE AT LAST CLOSE</span><strong>${money(r.balance)}</strong></div><div><span>WINDOW CHANGE</span><strong>${money(r.change)}</strong></div><div><span>RECORDED FEES</span><strong>${money(r.fees)}</strong></div><div><span>MODELED FILL SLIPPAGE</span><strong>${money(r.slippage)}</strong></div></div>
 <p>${c.recorded}/${c.expected} scheduled closes valued · ${c.actionable} could trigger orders · ${c.missing} missing. ${c.recorded===c.expected&&c.recorded===c.actionable&&c.expected?'Every scheduled close in this window could trigger an order.':'Coverage is partial or still waiting; missing and late closes cannot invent fills.'}</p>
 <p class="muted">Window ${stamp(r.from)} → ${stamp(r.until)}. Last valuation ${stamp(r.lastValuation)}.<br>Change starts at the saved baseline ${stamp(r.baselineAt)}; the 25% hold reference changed ${money(r.holdChange)}. Fees and fill slippage are already reflected in the balance. Marked open positions include estimated exit costs.</p>
 ${r.events.length?`<details><summary>LAST ${r.events.length} FILLS IN THIS DAY</summary><ul>${r.events.map(e=>`<li>${stamp(e.at)} · whale ${e.agent+1} · ${esc(e.kind)}${e.pnl===undefined?'':' · realized '+money(e.pnl)} · ${esc(e.reason)}</li>`).join('')}</ul><p class="muted">Counts and costs above use the entire day’s ledger. Fill times are actual receipt times in UTC.</p></details>`:''}
 <p class="muted">${esc(r.note)}</p><p class="version-hash">Saved rules ${esc(r.rulesHash)}. This recap summarizes the record; it does not score or replay it.</p>`;
}
export function installWatchRecaps({root,api,address,onRead=()=>false}){
 let generation=0;const saved=new Map(),pending=new Set();
 const state=id=>saved.get(id);
 function panel(id){const s=state(id);return `<section class="watch-recap" data-watch-recap="${id}" aria-label="Daily watch recap"><div class="form-actions"><button class="pixel-button blue small" data-recap="${id}" ${pending.has(id)?'disabled':''}>${s?'UPDATE DAILY RECAP ↻':'WHAT HAPPENED TODAY? →'}</button></div><p data-recap-status role="status">${pending.has(id)?'Reading the saved day…':s?'Recap snapshot. Update to read newer observations.':''}</p><div data-recap-content>${s?(pending.has(id)?recapHTML(s).replace('<select data-','<select disabled data-'):recapHTML(s)):''}</div></section>`;}
 async function load(id,day){
  if(pending.has(id))return;const token=generation,wallet=address();pending.add(id);
  const host=()=>root.querySelector(`[data-watch-recap="${id}"]`);
  const current=host();if(!current){pending.delete(id);return;}
  current.querySelector('[data-recap-status]').textContent='Reading the saved day…';current.querySelector('button').disabled=true;
  for(const select of current.querySelectorAll('select'))select.disabled=true;
  try{const r=await api('/api/paper/recap/'+id+(day?'?day='+encodeURIComponent(day):''));
   if(token!==generation||wallet!==address()||!host())return;
   if(saved.size>=20&&!saved.has(id))saved.delete(saved.keys().next().value);
   saved.set(id,r);host().querySelector('[data-recap-content]').innerHTML=recapHTML(r);
   const reviewed=onRead(r);host().querySelector('[data-recap-status]').textContent='Saved day loaded. Update to read newer observations.'+(reviewed?' New observation reviewed in your local live report.':'');
   host().querySelector('button').textContent='UPDATE DAILY RECAP ↻';
  }catch(e){if(token===generation&&wallet===address()&&host())host().querySelector('[data-recap-status]').textContent='Could not load the recap. '+e.message+' Your watch is kept. Try Update daily recap.';}
  finally{if(token===generation){pending.delete(id);if(host()){host().querySelector('button').disabled=false;for(const select of host().querySelectorAll('select'))select.disabled=false;}}}
 }
 root.addEventListener('click',e=>{const b=e.target.closest('[data-recap]');if(b)load(b.dataset.recap,state(b.dataset.recap)?.day);});
 root.addEventListener('change',e=>{if(e.target.matches('[data-recap-day]'))load(e.target.dataset.recapDay,e.target.value);});
 return {panel,invalidate(clear=false){generation++;pending.clear();if(clear)saved.clear();}};
}
