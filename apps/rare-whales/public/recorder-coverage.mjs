const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=t=>new Date(t).toISOString().slice(0,16).replace('T',' ')+' UTC';
export function coverageHTML(r){
 const c=r.receipt,x=r.reference,issues=r.closes.filter(p=>p.receipt!=='on-time'||!['actionable','unavailable'].includes(p.execution));
 const clean=c.late+c.missing+c.waiting===0&&x.available&&x.valuationOnly+x.missing+x.waiting===0;
 return `<label>Recorder UTC day <select aria-label="Recorder UTC day" data-coverage-day>${r.days.map(d=>`<option ${d===r.day?'selected':''}>${esc(d)}</option>`).join('')}</select></label><h3>${r.completeDay?'SAVED DAY':'DAY SO FAR'} · ${esc(r.day)}</h3>
 <p>${!r.expected?'Waiting for the first new five-minute close.':clean?'Every checked close so far arrived on time and was usable by all three public preset watches.':'Some closes are waiting or could not be used. A connected feed alone does not mean an uninterrupted watch.'}</p>
 <div class="board-metrics"><div><span>CLOSES DUE</span><strong>${r.expected}</strong></div><div><span>ARRIVED ON TIME</span><strong>${c.onTime}</strong></div><div><span>ARRIVED LATE</span><strong>${c.late}</strong></div><div><span>NOT RECEIVED</span><strong>${c.missing}</strong></div></div>
 <p>${c.waiting} awaiting delivery within the ${r.maxDelayMs/1000}-second window. Late arrivals can value a watch; they cannot create catch-up fills.</p>
 <h4>COULD THE PRESET WATCHES ACT?</h4><p>${x.available?`${x.actionable} closes usable by all three public preset watches · ${x.valuationOnly} valuation only · ${x.missing} without a saved decision · ${x.waiting} still processing within the delivery window.`:'Comparable public watch coverage is unavailable for this window. Receipt counts remain visible; no execution coverage is assumed.'}</p>
 <p class="muted">A usable close allows a decision; it does not promise a trade. Your own watch may have a different start or interruption. Open its daily recap for its decisions. Daily Tide applies its own round coverage and requires 288 timely, gap-free observations for final ranks.</p>
 ${issues.length?`<details><summary>INSPECT ${issues.length} WAITING OR INTERRUPTED CLOSE${issues.length===1?'':'S'}</summary><ul>${issues.slice(-12).reverse().map(p=>`<li>${stamp(p.close)} · ${p.receipt==='on-time'?'arrived on time':p.receipt==='late'?'arrived late':p.receipt==='waiting'?'awaiting delivery':'not received'} · ${p.execution==='actionable'?'usable':p.execution==='valuation-only'?'valuation only':p.execution==='waiting'?'decision pending':p.execution==='missing'?'no saved decision':'execution unavailable'}</li>`).join('')}</ul><p class="muted">Last twelve affected closes shown. This snapshot does not identify the cause of an interruption.</p></details>`:''}
 <p class="muted">Window ${stamp(r.from)} → ${stamp(r.until)}. Checked ${stamp(r.checkedAt)}. Midnight closes belong to the ending UTC day. The first day excludes warmup before the public watches began. Update to read newer saved data.</p>`;
}
export function installRecorderCoverage({root,api}){
 let generation=0,pending=false,saved=null,requestedDay=null;
 const status=root.querySelector('[data-coverage-status]'),content=root.querySelector('[data-coverage-content]'),button=root.querySelector('[data-coverage-load]');
 function controls(){button.disabled=pending;for(const select of content.querySelectorAll('select'))select.disabled=pending;}
 async function load(day){
  if(pending)return;const token=generation;pending=true;requestedDay=day??null;status.textContent='Reading saved recorder coverage…';controls();
  try{const r=await api('/api/paper/coverage'+(day?'?day='+encodeURIComponent(day):''));
   if(token!==generation)return;saved=r;requestedDay=r.day;content.innerHTML=coverageHTML(r);button.textContent='UPDATE COVERAGE ↻';status.textContent='Coverage snapshot loaded. Your company and private setup are kept.';
  }catch(e){if(token===generation){status.textContent='Could not read coverage for '+(day??'today')+'. '+e.message+' Your watch is kept. '+(saved?'Showing the snapshot for '+saved.day+'. ':'')+'Try Update coverage.';button.textContent='UPDATE COVERAGE ↻';if(saved)content.innerHTML=coverageHTML(saved);}}
  finally{if(token===generation){pending=false;controls();}}
 }
 button.addEventListener('click',()=>load(requestedDay));
 root.addEventListener('change',e=>{if(e.target.matches('[data-coverage-day]'))load(e.target.value);});
 return {invalidate(){generation++;pending=false;saved=null;requestedDay=null;content.replaceChildren();status.textContent='Inspect saved candle receipt and public preset decisions for each UTC day.';button.textContent='CHECK TODAY’S COVERAGE →';controls();}};
}
