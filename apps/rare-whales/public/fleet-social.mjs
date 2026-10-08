import {createLivePilot,livePilotProgress} from './live-pilot.mjs';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=t=>t?new Date(t).toISOString().slice(0,16).replace('T',' ')+' UTC':'not observed yet';
const money=n=>'$'+n.toFixed(2),pct=n=>(n>=0?'+':'')+n.toFixed(3)+'%';
const storage={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v),removeItem:k=>localStorage.removeItem(k)};
export function downloadLocal(value,type,name){
 const url=URL.createObjectURL(new Blob([value],{type})),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function installFleetSocial({api,context,signIn,refreshInventory}){
 const pilot=createLivePilot(storage),originalRibbon=$('.demo-ribbon').innerHTML;
 let page=null,viewId=null,wallet=null,epoch=0,own=null,known=false,ownLoading=false,attempt=null,confirmedRun=null;
 let archiveRows=[],archiveNext=null,archiveLoaded=false,archiveLoading=false,archiveOwnKey='';
 let tideData=null,tideLoading=false,tideTimer,acting=false,mutation=null;
 function renderPilot(){
  const {state,unavailable}=pilot.status();
  $('#live-pilot-start').hidden=!!state;$('#live-pilot-controls').hidden=!state;$('#live-pilot-code').disabled=!!state;
  $('#live-pilot-assistance').checked=state?.assisted??false;$('#live-pilot-stop').disabled=!state?.active;
  $('#live-pilot-progress').hidden=!state;
  if(state){try{const progress=livePilotProgress(state);$('#live-pilot-progress').innerHTML='<h3>YOUR PILOT PROGRESS</h3><ol><li>'+esc(progress.start)+'</li><li>'+esc(progress.returned)+'</li></ol><p>'+esc(progress.next)+'</p><p class="muted">Progress comes from your local report. Export only if you choose.</p>';}catch{$('#live-pilot-progress').textContent='Report timing cannot be assessed on this device. Check its clock; your report and company are kept.';}}
  $('#live-pilot-status').textContent=unavailable?'Browser storage is unavailable. Your report may not survive a reload; company controls still work.':state?state.code+' · '+(state.events.length>=500?'report full':state.active?'recording':'stopped')+' · '+state.events.length+' events · expires '+stamp(state.expiresAt):'Recording is off. Start only with an assigned participant code, before your first live company.';
 }
 function event(type){pilot.record(type);renderPilot();}
 function ready(){
  const c=context();
  if(known&&c.ready&&c.whales.length&&pilot.status().state?.active)event(own?'live_ready_existing':'live_ready_new');
 }
 function started(run){
  const state=pilot.status().state;
  if(run?.owner!==context().address||!attempt||run.id===attempt.previousId||run.id===confirmedRun)return;
  confirmedRun=run.id;attempt=null;
  if(!state?.active)return;
  if(!state.events.some(e=>e.type==='live_started')){
   if(state.events.some(e=>e.type==='live_ready_new'))event('live_started');
  }else event('live_followup_started');
  attempt=null;
 }
 function updatePaper(data){
  const c=context();if(!data.enabled||!data.me||data.me.address!==c.address)return;
  own=data.me.run;known=true;ready();
  if(attempt?.address===c.address&&own&&own.id!==attempt.previousId)started(own);
  const ownKey=own?.id+':'+own?.status;
  if(ownKey!==archiveOwnKey){archiveOwnKey=ownKey;archiveLoaded=false;}
  if(page==='paper'&&!viewId&&!archiveLoaded)loadArchive();
 }
 async function loadOwn(){
  if(ownLoading||!context().address)return;
  const n=epoch;ownLoading=true;
  try{const result=await api('/api/paper');if(n===epoch)updatePaper(result);}
  catch{/* Optional measurement never blocks company use. */}
  finally{ownLoading=false;if(n!==epoch&&pilot.status().state?.active)loadOwn();}
 }
 function renderArchive(){
  $('#paper-archive').hidden=page!=='paper'||!!viewId||!context().address;
  $('#paper-archive-list').innerHTML=archiveRows.map(r=>'<article class="archive-row"><div><h3>'+esc(r.nickname)+'</h3><p>'+esc(r.status.toUpperCase())+' · started '+stamp(r.createdAt)+'<br>Last valuation '+stamp(r.lastObservation)+'</p></div><div><strong>'+money(r.stats.equity)+' · '+pct(r.stats.returnPct)+'</strong><p>'+r.stats.trades+' closed trades · '+r.stats.maxDrawdown.toFixed(3)+'% drawdown</p><a class="link-button" href="#paper/'+r.id+'">OPEN DATED WATCH →</a></div></article>').join('');
  $('#paper-archive-more').hidden=!archiveNext;$('#paper-archive-more').disabled=archiveLoading;
  $('#paper-archive-refresh').disabled=archiveLoading;
 }
 async function loadArchive(more=false){
  const address=context().address;if(!address||archiveLoading)return;
  const n=epoch,cursor=more?archiveNext:null;archiveLoading=true;renderArchive();
  $('#paper-archive-status').textContent='Loading your saved watches…';
  try{
   const result=await api('/api/paper/history'+(cursor?'?cursor='+encodeURIComponent(cursor):''));
   if(n!==epoch||address!==context().address||result.address!==address)return;
   archiveRows=more?[...archiveRows,...result.runs.filter(r=>!archiveRows.some(x=>x.id===r.id))]:result.runs;
   archiveNext=result.next;archiveLoaded=true;
   $('#paper-archive-status').textContent=archiveRows.length?'Dated snapshots. Open a watch for its latest public record; earlier rules stay labelled.':'No saved holder watches yet. Your first Start creates one.';
  }catch(e){if(n===epoch)$('#paper-archive-status').textContent='Archive could not load. '+e.message+' Your saved watches are kept; retry Refresh archive.';}
  finally{archiveLoading=false;renderArchive();if(n!==epoch&&page==='paper'&&!viewId&&context().address)loadArchive();}
 }
 $('#paper-archive-refresh').addEventListener('click',()=>loadArchive());
 $('#paper-archive-more').addEventListener('click',()=>loadArchive(true));
 $('#live-pilot-start').addEventListener('click',()=>{
  try{pilot.start($('#live-pilot-code').value);known=false;renderPilot();loadOwn();}
  catch(e){$('#live-pilot-status').textContent=e.message;}
 });
 $('#live-pilot-assistance').addEventListener('change',()=>{pilot.assistance($('#live-pilot-assistance').checked);renderPilot();});
 $('#live-pilot-stop').addEventListener('click',()=>{pilot.stop();renderPilot();});
 $('#live-pilot-erase').addEventListener('click',()=>{pilot.erase();renderPilot();});
 $('#live-pilot-export').addEventListener('click',()=>{try{const report=pilot.report();downloadLocal(JSON.stringify(report,null,2),'application/json',report.code+'-live-pilot.json');}catch(e){$('#live-pilot-status').textContent=e.message;}});
 function review(run){
  if(!run.owner||run.owner!==context().address)return false;
  const ok=pilot.record('live_reviewed',run.history.at(-1)?.t);renderPilot();return ok;
 }
 function tideForm(round){
  const c=context(),allowed=round?.status==='queued'&&round.rulesHash===tideData?.rulesHash&&!round.mine;
  $('#tide-connect').hidden=!!c.address&&c.walletReady;$('#tide-connect').disabled=c.connecting;
  $('#tide-inventory-refresh').hidden=!c.address;$('#tide-inventory-refresh').disabled=c.connecting||c.inventoryLoading||acting;
  $('#tide-inventory-status').textContent=c.inventoryLoading?(c.inventoryProgress||'Checking your whale badge…'):c.inventoryError?c.inventoryError+' Use Refresh my whales to retry.':c.address&&!c.walletReady?'Reconnect this wallet to verify your badge.':'';
  $('#tide-fields').disabled=acting||!allowed||!c.ready||!c.whales.length||tideData?.serverTime>=round?.startsAt;
  $('#tide-eligibility').textContent=round?.mine?'Your '+round.mine.preset+' pick is saved and locked. It follows the common round; your company keeps its own crew.':!allowed?'This round cannot accept another pick. Choose an upcoming round.':!c.address?'Sign in here with one owned whale as your entry badge.':!c.ready?'Finish checking your badge here before choosing a preset.':c.whales.length?c.whales.length+' owned whales available. Confirm one preset before the common start.':'This wallet needs one Rare Whales or WhaleStreet NFT to join.';
  const selected=$('#tide-badge').value;
  $('#tide-badge').innerHTML=c.whales.map(a=>'<option value="'+esc(a.collection+':'+a.tokenId)+'">'+(a.collection==='rarewhales'?'Rare Whales':'WhaleStreet')+' #'+a.tokenId+'</option>').join('');
  if(c.whales.some(a=>a.collection+':'+a.tokenId===selected))$('#tide-badge').value=selected;
 }
 $('#tide-connect').addEventListener('click',signIn);
 $('#tide-inventory-refresh').addEventListener('click',refreshInventory);
 function renderTide(){
  const rows=tideData.rounds,now=tideData.serverTime;
  const round=viewId?rows.find(r=>r.id===viewId):rows.find(r=>r.status==='running')||rows.find(r=>r.status==='queued'&&r.startsAt>now)||rows[0];
  $('#tide-status').textContent=!tideData.enabled?'Daily Tide is not enabled here yet.':!round?'The recorder is preparing the next UTC round. Retry Refresh round shortly.':'Saved round · '+round.id;
  $('#tide-select').innerHTML=rows.map(r=>'<option value="'+r.id+'" '+(r.id===round?.id?'selected':'')+'>'+stamp(r.startsAt)+' · '+r.status+'</option>').join('');
  $('#tide-select').disabled=!rows.length;$('#tide-form').hidden=!round;$('#tide-rules-hash').textContent=(round?.rules.id||tideData.rules.id)+' · '+(round?.rulesHash||tideData.rulesHash||'');
  if(!round){$('#tide-round').innerHTML='';return;}
  const remaining=Math.max(0,(round.status==='queued'?round.startsAt:round.endsAt)-now);
  const phase=round.status==='queued'?'PICKS OPEN':round.status==='running'?'ROUND RUNNING':round.status==='completed'?(round.quality==='complete'?'FINAL RESULTS':'PARTIAL RESULTS · NO FINAL RANKS'):'OLDER RULES · PAUSED';
  const strategies=round.strategies.map(s=>'<article class="panel tide-strategy"><div class="panel-title purple">'+esc(s.name)+'<span>'+(s.rank?'RANK '+s.rank:'—')+'</span></div><div class="share-card-body"><strong class="tide-balance">'+money(s.stats.equity)+'</strong><p>'+pct(s.stats.returnPct)+' net · '+s.stats.maxDrawdown.toFixed(3)+'% drawdown<br>'+s.stats.trades+' closed trades · '+s.stats.exposure.toFixed(2)+'% average exposure</p><p>'+s.observedBars+'/288 timely observations · '+s.gapBars+' skipped/gap bars<br>Last observation '+stamp(s.lastObservation)+'</p><strong>'+ (round.status==='completed'||round.status==='paused'?'FROZEN AT LAST VALUATION':s.position?'POSITION OPEN':s.pending?'ORDER QUEUED':'WATCHING')+'</strong><p>'+esc(s.action)+'</p><p class="muted">Cash reference $1,000 · 25% hold '+money(s.stats.hold)+'. Same neutral stats and costs for every pick.</p></div></article>').join('');
  $('#tide-round').innerHTML='<article class="panel"><div class="panel-title yellow">'+phase+'<span>24 HOURS · $1,000 PAPER</span></div><div class="share-card-body"><h2>'+stamp(round.startsAt)+' → '+stamp(round.endsAt)+'</h2><p>'+(round.status==='queued'?'Confirm one preset before this common start. Your pick locks when saved.':round.status==='running'?'The outcome is still unfolding. Follow the next observed close; these are not final ranks.':'A dated round record; no new picks or retrospective fills.')+'</p>'+(['queued','running'].includes(round.status)?'<p>About '+Math.ceil(remaining/3600000)+' hours until '+(round.status==='queued'?'start':'finish')+'. Times are UTC; the server clock decides the deadline.</p>':'')+(round.status==='running'&&round.strategies.some(s=>s.gapBars>0)?'<p class="notice">This round already has interrupted closes. It will keep partial results without final ranks; new observations still arrive.</p>':'')+'<p>'+round.picks.length+'/20 wallet picks · <a class="link-button" href="#tide/'+round.id+'">OPEN DATED ROUND →</a></p></div></article><div class="paper-grid">'+strategies+'</div><article class="panel"><div class="panel-title purple">THE ROUND PICKS</div><div class="share-card-body">'+(round.picks.map(p=>'<p><strong>'+esc(p.nickname)+'</strong> · '+esc(p.preset)+' · '+(p.badge.collection==='rarewhales'?'Rare Whales':'WhaleStreet')+' #'+p.badge.tokenId+(p.owner===context().address?' · YOUR PICK':'')+'</p>').join('')||'<p>Be the first holder to choose a preset for this round.</p>')+'</div></article>';
  $('#tide-round').dataset.roundId=round.id;tideForm(round);
 }
 async function loadTide(){
  if(page!=='tide'||tideLoading)return;
  const n=epoch,address=context().address;tideLoading=true;$('#tide-refresh').disabled=true;
  try{
   const result=await api('/api/tide');
   if(viewId&&result.enabled&&!result.rounds.some(r=>r.id===viewId)){
    const old=await api('/api/tide?round='+encodeURIComponent(viewId));result.rounds.push(...old.rounds);
   }
   if(n!==epoch||address!==context().address)return;
   tideData=result;renderTide();
  }catch(e){if(n===epoch)$('#tide-status').textContent='Round could not refresh. '+e.message+' Saved picks and company records are kept; retry Refresh round.';}
  finally{tideLoading=false;$('#tide-refresh').disabled=false;if(page==='tide')tideTimer=setTimeout(loadTide,n===epoch?30000:0);}
 }
 $('#tide-select').addEventListener('change',()=>{location.hash='tide/'+$('#tide-select').value;});
 $('#tide-refresh').addEventListener('click',()=>{clearTimeout(tideTimer);loadTide();});
 $('#tide-form').addEventListener('submit',async e=>{
  e.preventDefault();if(acting)return;
  const c=context(),address=c.address,roundId=$('#tide-round').dataset.roundId;
  const badge=c.whales.find(a=>a.collection+':'+a.tokenId===$('#tide-badge').value);if(!badge||!c.ready)return;
  const input={wallet:address,roundId,badge,preset:$('#tide-preset').value,nickname:$('#tide-name').value,publish:$('#tide-consent').checked,rulesHash:tideData.rulesHash};
  const fingerprint=JSON.stringify(input);if(mutation?.fingerprint!==fingerprint)mutation={fingerprint,id:crypto.randomUUID()};
  acting=true;$('#tide-fields').disabled=true;$('#tide-message').textContent='Checking your badge and saving this locked round pick…';
  try{
   await api('/api/tide/join',{...input,mutationId:mutation.id});
   if(address===context().address){$('#tide-message').textContent='Your preset is saved. Return after the common start to inspect its new decisions.';event('tide_joined');}
  }catch(error){if(address===context().address)$('#tide-message').textContent=error.uncertain?'The response did not arrive. Refresh to check your saved pick; retrying this unchanged choice is safe.':error.message;}
  finally{acting=false;clearTimeout(tideTimer);await loadTide();}
 });
 function sync(){
  const next=context().address;
  if(next!==wallet){
   if(wallet&&pilot.status().state?.active){pilot.stop();renderPilot();}
   wallet=next;epoch++;known=false;own=null;attempt=null;confirmedRun=null;mutation=null;archiveLoaded=false;archiveRows=[];archiveNext=null;
   $('#tide-name').value='My Tide Pick';$('#tide-consent').checked=false;$('#tide-message').textContent='';$('#paper-archive-list').replaceChildren();$('#paper-archive-status').textContent='';
   if(page==='tide'){tideData=null;$('#tide-round').replaceChildren();$('#tide-badge').replaceChildren();$('#tide-form').hidden=true;$('#tide-status').textContent='Wallet changed. Refreshing the round…';$('#tide-fields').disabled=true;clearTimeout(tideTimer);loadTide();}
  }
  renderArchive();ready();
  if(pilot.status().state?.active&&!known&&context().ready)loadOwn();
  if(page==='tide'&&tideData)renderTide();
 }
 renderPilot();
 return {
  sync,updatePaper,review,reviewEnabled:()=>!!pilot.status().state?.active,
  shared:()=>event('live_shared'),inventoryError:()=>event('live_inventory_error'),startError:()=>event('live_start_error'),
  startAttempt(){attempt={address:context().address,previousId:own?.id??null};},started,
  route(next,id){
   page=next;viewId=id;epoch++;clearTimeout(tideTimer);
   const live=['paper','tide','live-pilot'].includes(next);
   $('#footer-pilot').href=live?'#live-pilot':'#pilot';
   if(next==='tide'||next==='live-pilot'){
    $('.demo-ribbon').innerHTML='<span>LIVE PAPER BETA</span> Your company · a common daily tide · new observations <a href="#paper">RETURN TO MY FLEET ↗</a>';
    $('footer>span').textContent='RARE WHALES + WHALESTREET · LIVE PAPER BETA';
   }else if(next!=='paper')$('.demo-ribbon').innerHTML=originalRibbon;
   sync();if(next==='tide')loadTide();if(next==='live-pilot'){renderPilot();if(context().address)loadOwn();}
   if(next==='paper'&&!id&&!archiveLoaded)loadArchive();
  }
 };
}
