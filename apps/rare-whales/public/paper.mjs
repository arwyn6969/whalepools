import {requestJSON} from './request.mjs';
import {paperURL,paperCard,paperPNG,watchPath,validRecapDate} from './paper-share.mjs';
import {tidePath} from './tide-share.mjs';
import {downloadLocal} from './fleet-social.mjs';
import {installRecorderCoverage} from './recorder-coverage.mjs';
import {installWatchRecaps} from './watch-recap.mjs';
import {loadPaperDraft,savePaperDraft,reconcilePaperDraft} from './paper-draft.mjs';
import {stopReview,followUpMessage} from './watch-controls.mjs';
import {watchSnapshot,loadWatchBookmark,rememberWatch,forgetWatch,watchReturnHTML} from './watch-return.mjs';
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
export function installPaper({api,asset,avatar,hydrateArt,context,social,signIn,refreshInventory}){
 let shownRuns=new Map();
 const coverage=installRecorderCoverage({root:$('#paper-coverage'),api});
 const recaps=installWatchRecaps({root:$('#paper-fleet'),api,address:()=>context().address,nickname:id=>shownRuns.get(id)?.nickname??'Whale watch',onShare:()=>social.shared(),onRead:r=>{const run=shownRuns.get(r.id);return run?.owner===context().address&&r.lastValuation?social.review({...run,history:[{t:r.lastValuation}]}):false;}});
 const arcadeRibbon=$('.demo-ribbon').innerHTML,arcadeFooter=$('footer>span').textContent;
 let active=false,viewId=null,viewDay=null,openedDay=false,epoch=0,timer,data=null,loading=false,acting=false,wallet=null,whaleKey='',mutation=null,research=null,presentedWalletReady=false;
 const storage={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)};
 let draftScope=null,draft=null,draftStatus='',draftNotice='',knownRunId=null,returnDetails=null;
 const stopDialog=$('#paper-stop-review');let stopIntent=null;
 function closeStopReview(){stopIntent=null;if(stopDialog.open)stopDialog.close();}
 function renderStopReview(run){
  const review=stopReview(run,context().address);
  if(!review||review.id!==stopIntent?.id||review.wallet!==stopIntent?.wallet||!context().walletReady||!active||viewId){closeStopReview();return;}
  $('#paper-stop-name').textContent=review.nickname;
  $('#paper-stop-summary').textContent=`Last saved balance ${money(review.equity)} · last valuation ${stamp(review.lastValuation)}. ${review.positions} open paper position${review.positions===1?'':'s'} · ${review.queued} queued order${review.queued===1?'':'s'}.`;
 }
 function saveSetup(){
  if(!active||!draftScope||!draft||viewId)return;
  const result=savePaperDraft(storage,wallet,data.rulesHash,draft);
  draftStatus=result.status==='saved'?'Saved privately in this browser. Return with this wallet to continue.':result.status==='unavailable'?'Browser storage is unavailable. Keep this page open to keep your choices.':result.error;
  return result;
 }
 function controls(){
  $('#paper-launch').hidden=!!viewId;$('#paper-presets').hidden=!!viewId;
  const c=context(),next=c.address;
  if(next!==wallet){wallet=next;draftScope=null;draft=null;draftStatus='';draftNotice='';whaleKey='';mutation=null;knownRunId=null;returnDetails=null;$('#paper-name').value='My Whale Watch';$('#paper-style').value='balanced';$('#paper-consent').checked=false;$('#paper-message').textContent='';}
  const scope=next&&data?.rulesHash?next+':'+data.rulesHash:null;
  if(scope&&scope!==draftScope){
   draftScope=scope;const saved=loadPaperDraft(storage,next,data.rulesHash);
   draft=saved.draft??{nickname:'My Whale Watch',preset:'balanced',agents:null};
   draftStatus=saved.status==='loaded'?'Your private live setup is restored. Check the whales, then approve publication when ready.':saved.status==='unavailable'?'Browser storage is unavailable. Keep this page open to keep your choices.':saved.status==='corrupt'?'The saved live setup could not be read. Choose your crew again; your public records are safe.':'Your unfinished setup is private until you publish.';
   $('#paper-name').value=draft.nickname;$('#paper-style').value=draft.preset;$('#paper-consent').checked=false;whaleKey='';mutation=null;draftNotice='';
  }
  // Never interpret a failed or still-loading inventory as an empty wallet.
  // Spectator routes can read records without rewriting the private setup.
  if(active&&!viewId&&draft&&c.ready&&!c.inventoryLoading&&!c.inventoryError){
   if(draft.agents===null){draft.agents=c.whales.slice(0,3);saveSetup();}
   else{const reconciled=reconcilePaperDraft(draft,c.whales);if(reconciled.removed){draft=reconciled.draft;draftNotice=`${reconciled.removed} selected whale${reconciled.removed===1?' is':'s are'} no longer in this wallet. Your name and style are kept; review your crew before publishing.`;saveSetup();}}
  }
  const own=data?.me?.address===c.address?data.me?.run:null,running=own?.status==='running';
  $('#paper-form').hidden=running;$('#paper-draft-status').hidden=running;
  $('#paper-launch-title').textContent=running?'YOUR COMPANY IS ON WATCH':'START YOUR COMPANY';
  $('#paper-presets').hidden=!!viewId||running;
  // An acknowledged record ends that Start request, including response-loss recovery.
  // The next record needs a fresh request ID and explicit publication consent.
  if(own?.id&&own.id!==knownRunId){knownRunId=own.id;mutation=null;$('#paper-consent').checked=false;}
  $('#paper-fields').disabled=acting||!data?.enabled||!c.ready||!c.whales.length||running;
  $('#paper-stop').hidden=!running;$('#paper-stop').disabled=acting||!c.walletReady;
  $('#paper-next-watch').textContent=followUpMessage(own);$('#paper-next-watch').hidden=!$('#paper-next-watch').textContent;
  if(stopIntent)renderStopReview(own);
  $('#paper-connect').hidden=!!next&&c.walletReady;$('#paper-connect').disabled=c.connecting;$('#paper-connect').textContent=c.connecting?'WAITING FOR WALLET…':next?'RECONNECT THIS WALLET':'SIGN IN WITH YOUR WALLET';
  $('#paper-inventory-refresh').hidden=!next;$('#paper-inventory-refresh').disabled=c.connecting||c.inventoryLoading||acting;
  $('#paper-eligibility').textContent=!next?'One Rare Whales or WhaleStreet NFT is enough. Sign in here to find your whales; no historical company is required.':c.inventoryLoading?(c.inventoryProgress||'Checking your whales… Your private choices are kept.'):c.inventoryError?c.inventoryError+' Your live setup is kept. Use Refresh my whales to retry.':!c.walletReady?'Reconnect this wallet to verify ownership. Your private choices are kept.':!c.ready?'Refresh my whales to finish checking ownership.':running?'Your dated crew and rules are locked. Stop this watch to choose another style.':!c.whales.length?'No eligible whales found in this wallet. One NFT from either collection is enough; refresh after receiving one.':`${c.whales.length} owned whales available. Choose up to twelve, select a ready-made style, then publish a $1,000 simulated watch.`;
  $('#paper-draft-status').textContent=[draftStatus,draftNotice].filter(Boolean).join(' ');
  const selected=new Set((draft?.agents??[]).map(key)),fingerprint=next+':'+c.whales.map(key).join(',')+':'+[...selected].join(',');
  if(fingerprint!==whaleKey){whaleKey=fingerprint;$('#paper-whales').innerHTML=c.whales.map(a=>`<label class="consent"><input type="checkbox" data-paper-whale="${esc(key(a))}" ${selected.has(key(a))?'checked':''}> ${a.collection==='rarewhales'?'Rare Whales':'WhaleStreet'} #${a.tokenId}</label>`).join('');}
 }
 function checkIn(run){
  const c=context();if(viewId||!active||!c.walletReady||run.owner!==c.address||run.rulesHash!==data.rulesHash)return '';
  try{const saved=loadWatchBookmark(storage,c.address,run.rulesHash,run.id);return watchReturnHTML(run,{snapshot:watchSnapshot(run,c.address,run.rulesHash),bookmark:saved.bookmark,storageStatus:saved.status,rules:data.rules,expanded:returnDetails?.id===run.id&&returnDetails.open});}catch{return '';}
 }
 function card(run){
  const s=run.stats,h=run.history,last=h.at(-1),first=h[0],change=last&&first?last.equity-first.equity:0;
  return `<article class="panel paper-company"><div class="panel-title purple"><span>${esc(run.nickname)}</span><span>${esc(run.status.toUpperCase())}</span></div><div class="share-card-body"><p class="eyebrow">FORWARD PAPER RECORD · ${stamp(run.createdAt)}</p>${checkIn(run)}<div class="board-metrics"><div><span>PAPER BALANCE</span><strong>${money(s.equity)}</strong></div><div><span>NET RETURN</span><strong>${pct(s.returnPct)}</strong></div><div><span>WORST DRAWDOWN</span><strong>${s.maxDrawdown.toFixed(3)}%</strong></div><div><span>CLOSED TRADES</span><strong>${s.trades}</strong></div></div><p>Last chart window: ${money(change)} change · ${run.observedBars} timely observations · ${run.gapBars} skipped/gap bars.<br>Average marked exposure ${s.exposure.toFixed(2)}% · cash reference ${money(s.cash)} · 25% hold ${money(s.hold)}.</p>${curve(h)}${recaps.panel(run.id)}<div class="paper-grid">${run.agents.map(a=>`<div class="paper-agent"><div class="paper-portrait">${avatar(a)}</div><h3>${esc(data.rules.presets[a.preset]?.name??a.preset)}</h3><p>${a.collection==='rarewhales'?'Rare Whales':'WhaleStreet'} #${a.tokenId}<br>${esc(a.profile.name)} · DNA v1</p><strong>${a.qty?'POSITION OPEN':a.pending?'ORDER QUEUED':'WATCHING'}</strong><p>${esc(a.action)}</p><p>${a.qty?`${a.qty.toFixed(6)} UBTC · entry ${money(a.entry)}<br>Stop ${money(a.stop)} · target ${money(a.target)}`:`${money(a.cash)} paper cash`}</p></div>`).join('')}</div><p>Watch ends ${stamp(run.endsAt)}. ${run.owner?'Ownership snapshot block '+esc(run.ownershipBlock)+'.':'Preset watch uses neutral DNA stats and illustrative artwork.'}</p>${run.rulesHash!==data.rulesHash?'<p class="notice">This record uses older rules. Execution is paused; its saved results remain intact.</p>':''}<a class="link-button" href="#paper/${esc(run.id)}">OPEN THIS DATED RECORD →</a><div class="paper-share"><label>Dated public watch link<input readonly aria-label="Dated paper watch link" value="${esc(paperURL(location.href,run.id))}"></label><div class="form-actions"><button class="pixel-button yellow small" data-paper-copy="${run.id}">COPY WATCH LINK</button><button class="pixel-button white small" data-paper-card="${run.id}">DOWNLOAD SVG ↓</button><button class="pixel-button yellow small" data-paper-png="${run.id}">DOWNLOAD PNG ↓</button>${run.owner&&run.owner===context().address&&social.reviewEnabled()?`<button class="pixel-button blue small" data-paper-review="${run.id}">REVIEW NEW OBSERVATION</button>`:''}</div><p class="muted">Cards freeze the displayed rules and last valuation. Links open the latest saved record. You choose where to share them.</p><p data-share-status role="status"></p></div><details><summary>CAPTAIN’S LOG</summary><div class="table-scroll"><table><thead><tr><th>Observed · UTC</th><th>Whale</th><th>Action</th><th>Price / costs</th><th>Reason</th></tr></thead><tbody>${(run.events??[]).map(e=>`<tr><td>${stamp(e.at)}</td><td>${run.agents[e.agent]?.tokenId??'—'}</td><td>${esc(e.kind)}${e.pnl===undefined?'':' · '+money(e.pnl)}</td><td>${money(e.price)}<br>${money(e.fee)} fee</td><td>${esc(e.reason)}<br>Signal observed ${stamp(e.signalAt)}</td></tr>`).join('')||'<tr><td colspan="5">No simulated fills yet. Watching and waiting are part of these rules.</td></tr>'}</tbody></table></div></details></div></article>`;
 }
 function render(rival){
  const feed=data.feed,price=feed?.price;
  $('#paper-feed').textContent=!data.enabled?'Live paper trading is not enabled here yet. The historical arcade remains available.':feed?.error?`Recorder recovering: ${feed.error} Last successful check ${stamp(feed.last_ok)}. No catch-up fills.`:price?`${feed.stale?'WAITING FOR FRESH DATA':'MARKET WATCH CONNECTED'} · UBTC / USDC ${money(price.c)} · completed five-minute candle ${stamp(price.t+data.rules.interval)} · last recorder check ${stamp(feed.last_ok)}.`:'The recorder is preparing market warmup. Your watch starts with new observations.';
  $('#paper-rule-hash').textContent=`${data.rules.id} · ${data.rulesHash}`;
  $('#paper-presets').innerHTML=Object.entries(data.rules.presets).map(([id,p])=>{const past=research?.ruleHash===data.rulesHash?research.results[id]:null;return `<article class="panel paper-preset"><h3>${esc(p.name)}</h3><strong>${esc(p.style)}</strong><p>${esc(p.description)}</p>${past?`<details><summary>RECENT BACKTEST</summary><p>${pct(past.returnPct)} · ${past.trades} closed trades<br>${past.maxDrawdown.toFixed(3)}% drawdown<br>${money(past.fees)} fees · ${money(past.slippage)} modeled slippage</p><p>${stamp(research.from)} — ${stamp(research.until)} (exclusive). Default DNA, $1,000 start; 25% hold ${money(past.hold)}, cash $1,000.</p><p>Inspected development history with assumed timely closes. ${past.returnPct<0?'This preset lost money here.':'This inspected result is not forward evidence.'} Different from its same-named historical tactic; no future edge is established.</p></details>`:'<p class="muted">Backtest summary unavailable for these exact rules.</p>'}</article>`;}).join('');
  const own=data.me?.address===context().address?data.me.run:null,runs=rival?[rival]:[...(own?[own]:[]),...(data.labs??[])];
  shownRuns=new Map(runs.map(r=>[r.id,r]));
  $('#paper-fleet').innerHTML=runs.map(card).join('')||'<div class="empty-state"><h2>THE NEXT CANDLE IS A NEW CHAPTER.</h2><p>Preset watches will appear after the recorder starts. Backtests stay in Pool HQ; these records start from new market observations.</p></div>';
  hydrateArt($('#paper-fleet'));controls();presentedWalletReady=context().walletReady;
 }
 async function load(){
  if(!active||loading)return;loading=true;const n=epoch,address=context().address;
  $('#paper-refresh').disabled=true;
  try{
   const result=await api('/api/paper');let rival=null;
   if(!research){try{research=await requestJSON(asset('/paper-research.json'));}catch{/* A failed research read never hides the live fleet. */}}
   if(viewId&&result.enabled)rival=(await api('/api/paper/run/'+encodeURIComponent(viewId))).run;
   if(n!==epoch||address!==context().address)return;data=result;social.updatePaper(result);render(rival);
   if(viewId&&viewDay&&!openedDay){openedDay=true;await recaps.open(viewId,viewDay);}
  }catch(e){if(n===epoch){$('#paper-feed').textContent='Could not refresh the fleet. '+e.message+' Your saved run stays on the server; try Refresh fleet.';}}
  finally{loading=false;$('#paper-refresh').disabled=false;if(active)timer=setTimeout(load,n===epoch?30000:0);}
 }
 $('#paper-fleet').addEventListener('toggle',e=>{
  const host=e.target.closest('[data-watch-return]');if(host&&e.target.matches('details')&&e.target.isConnected)returnDetails={id:host.dataset.watchReturn,open:e.target.open};
 },true);
 $('#paper-fleet').addEventListener('click',async e=>{
  const b=e.target.closest('[data-watch-remember],[data-watch-forget],[data-watch-latest-recap]');if(!b)return;
  const id=b.dataset.watchRemember||b.dataset.watchForget||b.dataset.watchLatestRecap,run=shownRuns.get(id),c=context();
  if(!active||viewId||!c.walletReady||run?.owner!==c.address||run.rulesHash!==data.rulesHash||data.me?.run?.id!==id)return;
  const host=b.closest('[data-watch-return]'),token=epoch,address=c.address;
  if(b.dataset.watchLatestRecap){
   b.disabled=true;host.querySelector('[data-watch-return-status]').textContent='Reading the latest saved UTC day…';
   const loaded=await recaps.latest(id);if(token!==epoch||address!==context().address||!host.isConnected)return;
   host.querySelector('[data-watch-return-status]').textContent=loaded?'Latest daily recap ready below. Use its day link or card to share.':'The recap is still waiting or could not load. Your bookmark is kept; retry below.';b.disabled=false;
   if(loaded)$('#paper-fleet').querySelector(`[data-watch-recap="${id}"]`)?.scrollIntoView({block:'start',behavior:'instant'});return;
  }
  const result=b.dataset.watchForget?forgetWatch(storage,address,run.rulesHash,id):rememberWatch(storage,address,run.rulesHash,run);
  const reviewed=result.status==='saved'&&social.review(run);
  host.outerHTML=checkIn(run);const replacement=$('#paper-fleet').querySelector(`[data-watch-return="${id}"]`);
  if(!replacement)return;
  replacement.querySelector('[data-watch-return-status]').textContent=result.status==='saved'?'Snapshot remembered. Return with this wallet in this browser to compare newer observations.'+(reviewed?' New observation reviewed in your local live report.':''):result.status==='forgotten'?'Bookmark removed. Your dated watch and private draft are kept.':result.status==='older'?'This view is older than your bookmark. Refresh fleet before remembering it.':'The bookmark could not be saved. Your dated watch is kept; you can still read its recap.';
  replacement.querySelector('h3').focus();
 });
 $('#paper-fleet').addEventListener('click',async e=>{
  const b=e.target.closest('[data-paper-copy],[data-paper-card],[data-paper-png],[data-paper-review]');if(!b)return;
  const id=b.dataset.paperCopy||b.dataset.paperCard||b.dataset.paperPng||b.dataset.paperReview,run=shownRuns.get(id);if(!run)return;
  const host=b.closest('.paper-share'),status=host.querySelector('[data-share-status]'),url=paperURL(location.href,id),shareEpoch=epoch,shareWallet=context().address;
  if(b.dataset.paperReview){status.textContent=social.review(run)?'New observation reviewed in your local live report. A later UTC day is required for the seven-day return measure.':'No newer eligible observation to record yet. Return when this watch has new data.';return;}
  if(b.dataset.paperPng){b.disabled=true;status.textContent='Creating the displayed snapshot…';try{const png=await paperPNG(run,url);if(shareEpoch!==epoch||shareWallet!==context().address)return;downloadLocal(png,'image/png','whale-paper-'+id+'.png');social.shared();status.textContent='PNG downloaded with the displayed last valuation and rules.';}catch{status.textContent='PNG could not be created. Try Download SVG or copy the watch link.';}finally{b.disabled=false;}return;}
  if(b.dataset.paperCard){try{downloadLocal(paperCard(run,url),'image/svg+xml','whale-paper-'+id+'.svg');social.shared();status.textContent='Dated card downloaded with the displayed last valuation and rules.';}catch{status.textContent='Card could not be created. Copy the watch link instead.';}return;}
  try{await navigator.clipboard.writeText(url);if(shareEpoch!==epoch||shareWallet!==context().address)return;social.shared();status.textContent='Watch link copied. Choose where to share it.';}
  catch{const input=host.querySelector('input');input.focus();input.select();status.textContent='Select and copy the visible link with your browser’s copy command.';}
 });
 $('#paper-refresh').addEventListener('click',()=>{clearTimeout(timer);load();});
 $('#paper-connect').addEventListener('click',signIn);
 $('#paper-inventory-refresh').addEventListener('click',refreshInventory);
 function editSetup(){
  const c=context();if(!active||viewId||!draft||!c.ready||acting||$('#paper-fields').disabled)return;
  const agents=[...document.querySelectorAll('[data-paper-whale]:checked')].map(i=>c.whales.find(a=>key(a)===i.dataset.paperWhale)).filter(Boolean);
  if(agents.length>12){$('#paper-message').textContent='Choose up to twelve whales for this watch.';whaleKey='';controls();return;}
  const previous=draft;draft={nickname:$('#paper-name').value,preset:$('#paper-style').value,agents};draftNotice='';
  if(saveSetup()?.status==='invalid')draft=previous;
  controls();
 }
 $('#paper-form').addEventListener('input',e=>{if(e.target.id!=='paper-consent')editSetup();});
 $('#paper-form').addEventListener('change',e=>{if(e.target.id!=='paper-consent')editSetup();});
 $('#paper-form').addEventListener('submit',async e=>{
  e.preventDefault();if(acting)return;const c=context(),address=c.address;
  const selected=[...document.querySelectorAll('[data-paper-whale]:checked')].map(input=>c.whales.find(a=>key(a)===input.dataset.paperWhale)).filter(Boolean);
  if(!c.ready||!selected.length){$('#paper-message').textContent='Choose at least one whale from your completed wallet inventory.';return;}
  acting=true;const input={wallet:address,nickname:$('#paper-name').value,preset:$('#paper-style').value,agents:selected,rulesHash:data.rulesHash,publish:$('#paper-consent').checked};
  const fingerprint=JSON.stringify(input);if(mutation?.fingerprint!==fingerprint)mutation={fingerprint,id:crypto.randomUUID()};
  social.startAttempt();controls();$('#paper-message').textContent='Checking ownership and starting a new forward record…';
  try{const result=await api('/api/paper/start',{...input,mutationId:mutation.id});if(address!==context().address)return;knownRunId=result.run.id;mutation=null;$('#paper-consent').checked=false;if(result.run.status==='running'){social.started(result.run);$('#paper-message').textContent='Your paper watch is saved. The next new candles grow its record, even while you are away.';}else $('#paper-message').textContent='This request is already saved as a frozen dated record. Review it in My dated watches; a new Start creates a separate watch.';}
  catch(error){if(address===context().address){social.startError();$('#paper-message').textContent=error.uncertain?'The response did not arrive. Refresh to check your saved run; retrying the unchanged request is safe.':error.message;}}
  finally{acting=false;clearTimeout(timer);await load();controls();}
 });
 $('#paper-stop').addEventListener('click',()=>{
  if(acting||!context().walletReady||!active||viewId)return;
  const review=stopReview(data?.me?.run,context().address);if(!review)return;
  stopIntent={id:review.id,wallet:review.wallet};renderStopReview(data.me.run);stopDialog.showModal();$('#paper-stop-cancel').focus();
 });
 $('#paper-stop-cancel').addEventListener('click',closeStopReview);
 stopDialog.addEventListener('cancel',event=>{event.preventDefault();closeStopReview();});
 stopDialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const cancel=$('#paper-stop-cancel'),confirm=$('#paper-stop-confirm');
  if(event.shiftKey&&document.activeElement===cancel){event.preventDefault();confirm.focus();}
  else if(!event.shiftKey&&document.activeElement===confirm){event.preventDefault();cancel.focus();}
 });
 stopDialog.addEventListener('close',()=>{stopIntent=null;});
 $('#paper-stop-confirm').addEventListener('click',async()=>{
  const review=stopReview(data?.me?.run,context().address);
  if(acting||!context().walletReady||!active||viewId||!review||review.id!==stopIntent?.id||review.wallet!==stopIntent?.wallet){closeStopReview();return;}
  const address=review.wallet,id=review.id;let uncertain=false;closeStopReview();acting=true;controls();$('#paper-message').textContent='Stopping this dated watch…';
  try{const result=await api('/api/paper/stop',{id,wallet:address});if(address===context().address)$('#paper-message').textContent=(result.run?.status==='completed'?'This watch had already finished.':'Watch stopped.')+' Its dated public record is kept; the balance is its last valuation. You can start a new crew.';}
  catch(e){uncertain=!!e.uncertain;if(address===context().address)$('#paper-message').textContent=(uncertain?'The Stop response did not arrive.':e.message)+' Refresh to check the saved status before trying again.';}
  finally{acting=false;clearTimeout(timer);await load();controls();if(uncertain&&address===context().address&&data?.me?.address===address&&data.me.run?.id===id&&data.me.run.status==='stopped')$('#paper-message').textContent='Stop confirmed from your saved record. Its dated balance is frozen; you can start a new crew.';}
 });
 if(!location.hash&&!watchPath(location.pathname)&&!tidePath(location.pathname))api('/api/paper').then(result=>{if(result.enabled&&!location.hash&&!watchPath(location.pathname)&&!tidePath(location.pathname))location.hash='paper';}).catch(()=>{});
 return {sync(){const changed=context().address!==wallet,readyChanged=context().walletReady!==presentedWalletReady;if(changed){closeStopReview();recaps.invalidate(true);coverage.invalidate();epoch++;clearTimeout(timer);if(active){shownRuns.clear();$('#paper-fleet').replaceChildren();$('#paper-feed').textContent='Wallet changed. Refreshing the fleet for this session…';}}controls();if(changed&&active)load();else if(readyChanged&&active&&data)render(viewId?shownRuns.get(viewId):null);},route(show,id){closeStopReview();recaps.invalidate();coverage.invalidate();active=show;viewId=id;viewDay=id===watchPath(location.pathname)&&!location.hash?validRecapDate(new URLSearchParams(location.search).get('day')):null;openedDay=false;epoch++;clearTimeout(timer);$('.demo-ribbon').innerHTML=show?'<span>LIVE PAPER BETA</span> Choose a crew · watch new candles · inspect its decisions <a href="#practice">HISTORICAL ARCADE ↗</a>':arcadeRibbon;$('footer>span').textContent=show?'RARE WHALES + WHALESTREET · LIVE PAPER BETA':arcadeFooter;$('#paper-home').hidden=!id;if(show){$('#paper-fleet').replaceChildren();$('#paper-feed').textContent='Refreshing the dated forward record…';load();}}};
}
