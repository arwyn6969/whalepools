import {requestJSON} from './request.mjs';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+Number(n).toFixed(2),pct=n=>(n>=0?'+':'')+Number(n).toFixed(3)+'%';
const stamp=t=>t?new Date(t).toISOString().slice(0,16).replace('T',' ')+' UTC':'not yet';
const key=a=>a.collection+':'+a.tokenId;
function curve(history){
 if(history.length<2)return '<p class="muted">Your forward chart grows as new candles arrive. Earlier candles are warmup, not scored trades.</p>';
 const values=history.flatMap(p=>[p.equity,p.hold,1000]),lo=Math.min(...values),hi=Math.max(...values),span=Math.max(hi-lo,0.1);
 const points=k=>history.map((p,i)=>`${(i/(history.length-1)*700).toFixed(2)},${(160-(p[k]-lo)/span*140).toFixed(2)}`).join(' ');
 return `<svg class="paper-chart" viewBox="0 0 700 180" role="img" aria-label="Last day of paper balance and 25 percent holding reference"><line x1="0" x2="700" y1="${160-(1000-lo)/span*140}" y2="${160-(1000-lo)/span*140}" class="paper-cash-line"/><polyline points="${points('hold')}" class="paper-hold-line"/><polyline points="${points('equity')}" class="paper-equity-line"/></svg><p class="muted">Pink: company · blue: 25% hold · dashed: cash. ${stamp(history[0].t)} — ${stamp(history.at(-1).t)}. Gaps are valued but cannot create fills.</p>`;
}
export function installPaper({api,asset,avatar,hydrateArt,context}){
 const arcadeRibbon=$('.demo-ribbon').innerHTML,arcadeFooter=$('footer>span').textContent;
 let active=false,viewId=null,epoch=0,timer,data=null,loading=false,acting=false,wallet=null,whaleKey='',mutation=null,research=null;
 function controls(){
  const c=context(),next=c.address;
  if(next!==wallet){wallet=next;whaleKey='';mutation=null;$('#paper-name').value='My Whale Watch';$('#paper-consent').checked=false;$('#paper-message').textContent='';}
  const own=data?.me?.address===c.address?data.me.run:null,running=own?.status==='running';
  $('#paper-fields').disabled=acting||!data?.enabled||!c.ready||!c.whales.length||running;
  $('#paper-stop').hidden=!running;$('#paper-stop').disabled=acting;
  $('#paper-eligibility').textContent=!next?'Sign in with a wallet holding at least one Rare Whales or WhaleStreet NFT.':!c.ready?'Your wallet inventory must finish loading. Use My Company to connect or refresh; your historical draft is kept.':running?'Your dated crew and rules are locked. Stop this watch to choose another style.':`${c.whales.length} owned whales available. One is enough; we select up to three to get you started. No historical publication is required.`;
  const fingerprint=next+':'+c.whales.map(key).join(',');
  if(fingerprint!==whaleKey){whaleKey=fingerprint;$('#paper-whales').innerHTML=c.whales.map((a,i)=>`<label class="consent"><input type="checkbox" data-paper-whale="${esc(key(a))}" ${i<3?'checked':''}> ${a.collection==='rarewhales'?'Rare Whales':'WhaleStreet'} #${a.tokenId}</label>`).join('');}
 }
 function card(run){
  const s=run.stats,h=run.history,last=h.at(-1),first=h[0],change=last&&first?last.equity-first.equity:0;
  return `<article class="panel paper-company"><div class="panel-title purple"><span>${esc(run.nickname)}</span><span>${esc(run.status.toUpperCase())}</span></div><div class="share-card-body"><p class="eyebrow">FORWARD PAPER RECORD · ${stamp(run.createdAt)}</p><div class="board-metrics"><div><span>PAPER BALANCE</span><strong>${money(s.equity)}</strong></div><div><span>NET RETURN</span><strong>${pct(s.returnPct)}</strong></div><div><span>WORST DRAWDOWN</span><strong>${s.maxDrawdown.toFixed(3)}%</strong></div><div><span>CLOSED TRADES</span><strong>${s.trades}</strong></div></div><p>Last chart window: ${money(change)} change · ${run.observedBars} timely observations · ${run.gapBars} skipped/gap bars.<br>Average marked exposure ${s.exposure.toFixed(2)}% · cash reference ${money(s.cash)} · 25% hold ${money(s.hold)}.</p>${curve(h)}<div class="paper-grid">${run.agents.map(a=>`<div class="paper-agent"><div class="paper-portrait">${avatar(a)}</div><h3>${esc(data.rules.presets[a.preset]?.name??a.preset)}</h3><p>${a.collection==='rarewhales'?'Rare Whales':'WhaleStreet'} #${a.tokenId}<br>${esc(a.profile.name)} · DNA v1</p><strong>${a.qty?'POSITION OPEN':a.pending?'ORDER QUEUED':'WATCHING'}</strong><p>${esc(a.action)}</p><p>${a.qty?`${a.qty.toFixed(6)} UBTC · entry ${money(a.entry)}<br>Stop ${money(a.stop)} · target ${money(a.target)}`:`${money(a.cash)} paper cash`}</p></div>`).join('')}</div><p>Watch ends ${stamp(run.endsAt)}. ${run.owner?'Ownership snapshot block '+esc(run.ownershipBlock)+'.':'Preset watch uses neutral DNA stats and illustrative artwork.'}</p>${run.rulesHash!==data.rulesHash?'<p class="notice">This record uses older rules. Execution is paused; its saved results remain intact.</p>':''}<a class="link-button" href="#paper/${esc(run.id)}">OPEN THIS DATED RECORD →</a><details><summary>CAPTAIN’S LOG</summary><div class="table-scroll"><table><thead><tr><th>Observed · UTC</th><th>Whale</th><th>Action</th><th>Price / costs</th><th>Reason</th></tr></thead><tbody>${(run.events??[]).map(e=>`<tr><td>${stamp(e.at)}</td><td>${run.agents[e.agent]?.tokenId??'—'}</td><td>${esc(e.kind)}${e.pnl===undefined?'':' · '+money(e.pnl)}</td><td>${money(e.price)}<br>${money(e.fee)} fee</td><td>${esc(e.reason)}<br>Signal observed ${stamp(e.signalAt)}</td></tr>`).join('')||'<tr><td colspan="5">No simulated fills yet. Watching and waiting are part of these rules.</td></tr>'}</tbody></table></div></details></div></article>`;
 }
 function render(rival){
  const feed=data.feed,price=feed?.price;
  $('#paper-feed').textContent=!data.enabled?'Live paper trading is not enabled here yet. The historical arcade remains available.':feed?.error?`Recorder recovering: ${feed.error} Last successful check ${stamp(feed.last_ok)}. No catch-up fills.`:price?`${feed.stale?'WAITING FOR FRESH DATA':'MARKET WATCH CONNECTED'} · UBTC / USDC ${money(price.c)} · completed five-minute candle ${stamp(price.t+data.rules.interval)} · last recorder check ${stamp(feed.last_ok)}.`:'The recorder is preparing market warmup. Your watch starts with new observations.';
  $('#paper-rule-hash').textContent=`${data.rules.id} · ${data.rulesHash}`;
  $('#paper-presets').innerHTML=Object.entries(data.rules.presets).map(([id,p])=>{const past=research?.ruleHash===data.rulesHash?research.results[id]:null;return `<article class="panel paper-preset"><h3>${esc(p.name)}</h3><strong>${esc(p.style)}</strong><p>${esc(p.description)}</p>${past?`<details><summary>RECENT BACKTEST</summary><p>${pct(past.returnPct)} · ${past.trades} closed trades<br>${past.maxDrawdown.toFixed(3)}% drawdown<br>${money(past.fees)} fees · ${money(past.slippage)} modeled slippage</p><p>${stamp(research.from)} — ${stamp(research.until)} (exclusive). Default DNA, $1,000 start; 25% hold ${money(past.hold)}, cash $1,000.</p><p>Inspected development history with assumed timely closes. ${past.returnPct<0?'This preset lost money here.':'This inspected result is not forward evidence.'} Different from its same-named historical tactic; no future edge is established.</p></details>`:'<p class="muted">Backtest summary unavailable for these exact rules.</p>'}</article>`;}).join('');
  const own=data.me?.address===context().address?data.me.run:null,runs=rival?[rival]:[...(own?[own]:[]),...(data.labs??[])];
  $('#paper-fleet').innerHTML=runs.map(card).join('')||'<div class="empty-state"><h2>THE NEXT CANDLE IS A NEW CHAPTER.</h2><p>Preset watches will appear after the recorder starts. Backtests stay in Pool HQ; these records start from new market observations.</p></div>';
  hydrateArt($('#paper-fleet'));controls();
 }
 async function load(){
  if(!active||loading)return;loading=true;const n=epoch,address=context().address;
  $('#paper-refresh').disabled=true;
  try{
   const result=await api('/api/paper');let rival=null;
   if(!research){try{research=await requestJSON(asset('/paper-research.json'));}catch{/* A failed research read never hides the live fleet. */}}
   if(viewId&&result.enabled)rival=(await api('/api/paper/run/'+encodeURIComponent(viewId))).run;
   if(n!==epoch||address!==context().address)return;data=result;render(rival);
  }catch(e){if(n===epoch){$('#paper-feed').textContent='Could not refresh the fleet. '+e.message+' Your saved run stays on the server; try Refresh fleet.';}}
  finally{loading=false;$('#paper-refresh').disabled=false;if(active)timer=setTimeout(load,n===epoch?30000:0);}
 }
 $('#paper-refresh').addEventListener('click',()=>{clearTimeout(timer);load();});
 $('#paper-form').addEventListener('submit',async e=>{
  e.preventDefault();if(acting)return;const c=context(),address=c.address;
  const selected=[...document.querySelectorAll('[data-paper-whale]:checked')].map(input=>c.whales.find(a=>key(a)===input.dataset.paperWhale)).filter(Boolean);
  if(!c.ready||!selected.length){$('#paper-message').textContent='Choose at least one whale from your completed wallet inventory.';return;}
  acting=true;const input={wallet:address,nickname:$('#paper-name').value,preset:$('#paper-style').value,agents:selected,rulesHash:data.rulesHash,publish:$('#paper-consent').checked};
  const fingerprint=JSON.stringify(input);if(mutation?.fingerprint!==fingerprint)mutation={fingerprint,id:crypto.randomUUID()};
  controls();$('#paper-message').textContent='Checking ownership and starting a new forward record…';
  try{await api('/api/paper/start',{...input,mutationId:mutation.id});if(address!==context().address)return;$('#paper-message').textContent='Your paper watch is saved. The next new candles grow its record, even while you are away.';}
  catch(error){if(address===context().address)$('#paper-message').textContent=error.uncertain?'The response did not arrive. Refresh to check your saved run; retrying the unchanged request is safe.':error.message;}
  finally{acting=false;clearTimeout(timer);await load();controls();}
 });
 $('#paper-stop').addEventListener('click',async()=>{
  if(acting||!data?.me?.run)return;const address=context().address,id=data.me.run.id;acting=true;controls();
  try{await api('/api/paper/stop',{id,wallet:address});if(address===context().address)$('#paper-message').textContent='Watch stopped. Its dated public record is kept; the balance is its last valuation. You can start a new crew.';}
  catch(e){if(address===context().address)$('#paper-message').textContent=e.message+' Refresh to check the saved status before trying again.';}
  finally{acting=false;clearTimeout(timer);await load();controls();}
 });
 if(!location.hash)api('/api/paper').then(result=>{if(result.enabled&&!location.hash)location.hash='paper';}).catch(()=>{});
 return {sync(){const changed=context().address!==wallet;if(changed){epoch++;clearTimeout(timer);}controls();if(changed&&active)load();},route(show,id){active=show;viewId=id;epoch++;clearTimeout(timer);$('.demo-ribbon').innerHTML=show?'<span>LIVE PAPER BETA</span> Choose a crew · watch new candles · inspect its decisions <a href="#practice">HISTORICAL ARCADE ↗</a>':arcadeRibbon;$('footer>span').textContent=show?'RARE WHALES + WHALESTREET · LIVE PAPER BETA':arcadeFooter;$('#paper-home').hidden=!id;if(show){$('#paper-fleet').replaceChildren();$('#paper-feed').textContent='Refreshing the dated forward record…';load();}}};
}
