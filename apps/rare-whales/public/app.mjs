import {CHAIN_ID,STRATEGIES,COLLECTIONS} from '../src/config.mjs';
import {MAX_AGENTS,validateRoster} from '../src/dna.mjs';
import {NEUTRAL_PROFILE} from '../src/dna.mjs';
import {replayPool,replayAgent} from '../src/pool.mjs';
import {createPortraitLoader} from './portraits.mjs';
import {createWalletPicker,discoverWallets} from './wallet-picker.mjs';
import {loadHoldings} from '../src/holdings.mjs';
import {inventoryItems,retainOwned,chooseCaptain} from './owned-crew.mjs';
import {loadDraft,saveDraft} from './company-draft.mjs';
import {requestJSON,boundedRequest} from './request.mjs';
import {installNextSprint} from './next-sprint.mjs';
import {installFleetSocial} from './fleet-social.mjs';
import {installPaper} from './paper.mjs';
import {watchPath} from './paper-share.mjs';
import {signInLanding} from './auth-journey.mjs';
const walletDiscovery=discoverWallets(window);
const pickWallet=createWalletPicker(window,document,{wallets:walletDiscovery});
const $=s=>document.querySelector(s);
const asset=p=>new URL(p.replace(/^\//,''),import.meta.url).href;
let chartState;
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(n);
const signed=n=>`${n>0?'+':''}${n.toFixed(2)}`;
const date=t=>new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'});
const stamp=t=>new Date(t).toISOString().slice(0,16).replace('T',' ');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=a=>`${a.collection}:${a.tokenId}`;
const label=a=>`${COLLECTIONS[a.collection].name} #${a.tokenId}`;
const portraits=createPortraitLoader({asset});
const avatar=a=>`<img data-whale-art data-collection="${a.collection}" data-token="${a.tokenId}" src="${asset('/art/portrait-loading.svg')}" alt="Loading artwork for ${esc(label(a))}" decoding="async" referrerpolicy="no-referrer">`;
const hydrateArt=container=>portraits.hydrate(container);
for(const button of document.querySelectorAll('[data-retry-art]'))button.addEventListener('click',()=>portraits.retry(document));
const example=[{collection:'rarewhales',tokenId:245,strategy:'trend'},{collection:'rarewhales',tokenId:246,strategy:'recovery'},{collection:'whalestreet',tokenId:1,strategy:'breakout'},{collection:'rarewhales',tokenId:248,strategy:'magnet'}];
let roster=example,selected='rarewhales:245',scope='pool',practice,company,club,provider,busy=false,generation=0,walletRevision=0,crewGeneration=0,clubGeneration=0,walletReady=false,initialAccountProvider=null;
try{const saved=localStorage.getItem('whale-pools-sandbox-v1');if(saved)roster=validateRoster(JSON.parse(saved));}catch{/* A corrupted local draft never affects registered companies. */}
let crewWallet=null,crewRules=null,ownedWhales=[],ownedLoaded=false,ownedLoading=false,ownedError='',inventoryRevision=0,inventoryController,inventoryProgress='',spectator=null,draftResult=null,draftStorageStatus='',uncertainAction=null;
let walletController=new AbortController(),logoutPending=Promise.resolve();
const nextSprint=installNextSprint({asset,api,avatar,hydrateArt,privateResult:()=>draftResult,inspectCompany,walletReady:()=>({ready:walletReady&&ownedLoaded&&ownedWhales.length>0,published:!!club?.me?.seat})});
const liveContext=()=>({address:club?.me?.address??null,ready:walletReady&&ownedLoaded,whales:ownedWhales,inventoryLoading:ownedLoading,inventoryError:ownedError,inventoryProgress,connecting:busy,walletReady});
const live=installFleetSocial({api,context:liveContext,signIn,refreshInventory:loadOwnedWhales});
const paper=installPaper({api,asset,avatar,hydrateArt,context:liveContext,social:live,signIn,refreshInventory:loadOwnedWhales});
const displayedRoster=()=>spectator?.agents||roster;
const draftStorage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
const watchedProviders=new WeakSet();
function watchProvider(next){
 provider=next;
 if(provider.on&&!watchedProviders.has(provider)){
  const watched=provider,changed=()=>{if(provider===watched)logout();};
  provider.on('accountsChanged',()=>{if(initialAccountProvider!==watched)changed();});provider.on('chainChanged',changed);watchedProviders.add(provider);
 }
}
async function restoreWalletProvider(address){
 const epoch=walletRevision,signal=walletController.signal;
 let remembered;
 try{remembered=localStorage.getItem('whale-pools-wallet-provider-v1');}catch{/* Discovery still works. */}
 const entries=walletDiscovery.list(),candidates=remembered?entries.filter(w=>w.rdns===remembered):entries;
 for(const wallet of candidates){
  try{
   const accounts=await boundedRequest(()=>wallet.provider.request({method:'eth_accounts'}),{timeoutMs:5000,signal});
   if(epoch!==walletRevision)return;
   if(accounts?.[0]?.toLowerCase()!==address.toLowerCase()){
    if(remembered){watchProvider(wallet.provider);await logout();return;}
    continue;
   }
   watchProvider(wallet.provider);
   const chain=await boundedRequest(()=>provider.request({method:'eth_chainId'}),{timeoutMs:5000,signal});
   if(epoch!==walletRevision)return;
   if(Number(chain)!==CHAIN_ID){await logout();message('Select Robinhood Chain, then sign in again. Your private draft is kept.');return;}
   walletReady=true;renderClub();return;
  }catch(e){if(e.name==='AbortError')return;}
 }
 if(club?.me&&epoch===walletRevision){walletReady=false;renderClub();message('Your private draft is restored. Connect the same holder wallet before publishing.');}
}
walletDiscovery.subscribe(()=>{if(club?.me&&!provider&&!busy)restoreWalletProvider(club.me.address);});
function api(path,data,method=data?'POST':'GET',signal,extraHeaders={}){
 return requestJSON(asset(path),{method,credentials:'same-origin',headers:{...(data?{'content-type':'application/json'}:{}),...extraHeaders},...(data?{body:JSON.stringify(data)}:{})},{signal});
}
function savePrivateDraft(){
 if(crewWallet&&crewRules){
  const saved=saveDraft(draftStorage,crewWallet,crewRules,{agents:roster,nickname:$('#nickname').value,captain:chooseCaptain(roster,$('#captain').value),selected:roster.some(a=>key(a)===(spectator?.privateSelected??selected))?(spectator?.privateSelected??selected):null});
  draftStorageStatus=saved.status==='saved'?'Private draft saved in this browser.':'Draft could not be saved here. Keep this tab open or enable browser storage.';
 }else{try{localStorage.setItem('whale-pools-sandbox-v1',JSON.stringify(roster));}catch{/* Sandbox remains usable. */}}
 renderJourney();
}
function renderJourney(){
 $('#draft-status').textContent=crewWallet?draftStorageStatus:'Practice freely. Sign in with a holder wallet to build a company you can publish.';
 $('#journey-progress').textContent=!roster.length?'Step 1 of 4: choose at least one whale.':!draftResult?'Replaying your crew on the historical sample…':!club?.me?'Steps 2–3: try tactics and read the historical result. Sign in to publish your own whales.':'Steps 2–3: choose tactics and review the result. Step 4: name your company and publish.';
 $('#seat-result').textContent=draftResult?`${roster.length} whales · ${signed(draftResult.stats.returnPct)}% net historical return · ${draftResult.stats.maxDrawdown.toFixed(2)}% worst drawdown · ${draftResult.stats.count} completed trades. $1,000 starting paper budget, 24 July–19 September 2026. Changes replay the same old sample; this is not a forecast.`:'Choose whales, then review their historical result before publishing.';
 $('#reconcile-entry').hidden=!uncertainAction;
 $('#add-agent').hidden=!!spectator;
 $('#spectator-banner').hidden=!spectator;
 $('#spectator-title').textContent=spectator?`Inspecting ${spectator.nickname} · read-only historical replay` : '';
 $('#journey').hidden=!!spectator;
}
function leaveSpectator(){
 if(!spectator)return;
 const previous=spectator;spectator=null;selected=previous.privateSelected;scope=previous.privateScope;
 renderOwnedWhales();renderJourney();refreshCompany();
}
function message(text){$('#global-message').textContent=text;$('#global-message').hidden=!text;}
function route(){
 const hash=location.hash.slice(1)||((watchPath(location.pathname)?'paper/'+watchPath(location.pathname):'')),current=hash==='paper'||hash.startsWith('paper/')?'paper':hash==='tide'||hash.startsWith('tide/')?'tide':hash.startsWith('company/')?'company':['seat','crew','challenge','pilot','live-pilot'].includes(hash)?hash:'practice';
 paper.route(current==='paper',hash.startsWith('paper/')?hash.slice(6):null);
 live.route(current,hash.startsWith('paper/')?hash.slice(6):hash.startsWith('tide/')?hash.slice(5):null);
 nextSprint.cancelCompany();if(current==='company')nextSprint.openCompany(hash.slice('company/'.length));
 if(current==='challenge')nextSprint.loadChallenge();
 if(['company','challenge','pilot','paper','tide','live-pilot'].includes(current)||hash==='practice')leaveSpectator();
 for(const section of document.querySelectorAll('.page'))section.hidden=section.id!==current;
 for(const link of document.querySelectorAll('nav a')){if(link.dataset.page===current)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 if(current==='crew')loadCrew();
 if(current==='seat')leaveSpectator();
 if(['roster','tactics','scoreboard'].includes(hash))$('#'+hash).scrollIntoView({block:'start'});
}
window.addEventListener('hashchange',route);
function rosterChanged(){draftResult=null;updateRegistrationRoster();savePrivateDraft();renderOwnedWhales();return refreshCompany();}
async function refreshCompany(){
 if(!practice)return;
 const epoch=++generation;$('#download').disabled=true;
 try{
  const activeRoster=displayedRoster(),next=await replayPool(practice,activeRoster);if(epoch!==generation)return;company=next;if(!spectator)draftResult=next;renderJourney();updateRegistrationRoster();
  if(!company.agents.some(a=>key(a)===selected))selected=company.agents[0]?key(company.agents[0]):null;
  const s=company.stats;$('#end-equity').textContent=money(s.endEquity);$('#net-return').textContent=signed(s.returnPct)+'%';$('#net-return').className=s.returnPct>=0?'positive':'negative';$('#drawdown').textContent=s.maxDrawdown.toFixed(2)+'%';$('#agent-count').textContent=`${displayedRoster().length} / ${MAX_AGENTS}`;$('#budget-split').textContent=displayedRoster().length?`${money(1000/displayedRoster().length)} starting budget each`:'$1,000 stays in paper cash';
  renderAgents();renderInspector();renderScoreboard();$('#download').disabled=!company.trades.length;
 }catch(e){if(epoch!==generation)return;message('Replay unavailable: '+e.message);company=null;if(!spectator)draftResult=null;renderJourney();updateRegistrationRoster();for(const id of ['end-equity','net-return','drawdown'])$('#'+id).textContent='—';$('#chart').replaceChildren();$('#trade-rows').innerHTML='<tr><td colspan="5">Replay unavailable. No result has been substituted.</td></tr>';}
}
function renderAgents(){
 if(!company)return;
 $('#agent-roster').innerHTML=company.agents.length?company.agents.map(a=>`<article class="agent-card agent-color-${a.profile.levels[0]} ${key(a)===selected?'is-selected':''}"><div class="agent-top"><span>${a.collection==='rarewhales'?'RARE WHALES':'WHALESTREET'} #${a.tokenId}</span><button type="button" data-remove="${key(a)}" aria-label="Remove ${esc(label(a))}" ${spectator||busy?'disabled':''}>×</button></div><button class="agent-portrait" data-inspect="${key(a)}" aria-label="Select ${esc(label(a))} and view trading results" aria-pressed="${key(a)===selected}">${avatar(a)}<span class="inspect-label">${key(a)===selected?'SELECTED AGENT':'VIEW MY RESULTS ↗'}</span></button><div class="agent-info"><h4 class="agent-name">${STRATEGIES[a.strategy].name.toUpperCase()}</h4><div class="agent-sub"><span>${a.profile.name} · DNA ${a.profile.hash.slice(0,6)}</span><span>${money(a.startEquity)} budget</span></div><div class="agent-stats"><span>NERVE<strong>${a.profile.risk.toFixed(3)}%</strong></span><span>REACH<strong>${a.profile.targetMultiplier>1?'+':''}${((a.profile.targetMultiplier-1)*100).toFixed(0)}%</strong></span><span>CARGO<strong>${a.profile.allocation}%</strong></span></div><label>ASSIGN TACTIC<select data-tactic="${key(a)}" aria-label="Strategy for ${esc(label(a))}" ${spectator||busy?'disabled':''}>${Object.entries(STRATEGIES).map(([id,t])=>`<option value="${id}" ${a.strategy===id?'selected':''}>${t.icon} ${t.name}</option>`).join('')}</select></label><p class="agent-result"><span>Net replay P/L</span><b class="${a.result.stats.pnl>=0?'positive':'negative'}">${a.result.stats.pnl>0?'+':''}${money(a.result.stats.pnl)}</b></p><div class="agent-mini-stats"><span><b>${a.result.stats.count}</b> trades</span><span><b>${a.result.stats.count?a.result.stats.winRate.toFixed(0)+'%':'—'}</b> won</span><span><b>${a.result.stats.maxDrawdown.toFixed(2)}%</b> drawdown</span></div></div></article>`).join(''):'<div class="empty-roster"><h3>YOUR COMPANY NEEDS A CREW.</h3><p>Add a whale above. An empty pool keeps its budget in paper cash.</p></div>';
 hydrateArt($('#agent-roster'));
}
$('#agent-roster').addEventListener('click',event=>{
 const inspect=event.target.closest('[data-inspect]'),remove=event.target.closest('[data-remove]');
 if(inspect){selected=inspect.dataset.inspect;scope='agent';if(!spectator)savePrivateDraft();renderAgents();renderInspector();renderScoreboard();}
 if(remove&&!spectator&&!busy){roster=roster.filter(a=>key(a)!==remove.dataset.remove);rosterChanged();}
});
$('#agent-roster').addEventListener('change',event=>{if(event.target.dataset.tactic&&!spectator&&!busy){roster=roster.map(a=>key(a)===event.target.dataset.tactic?{...a,strategy:event.target.value}:a);rosterChanged();}});
function selectedAgent(){return company?.agents.find(a=>key(a)===selected);}
function renderTactics(a){
 $('#tactic-whale').textContent=a?`${label(a)} · ${money(a.startEquity)} per replay · fixed DNA ${a.profile.build}. Select another whale above to compare its tactics.`:'Add a whale to compare these four tactics with the same budget.';
 $('#tactic-cards').innerHTML=Object.entries(STRATEGIES).map(([id,t],i)=>{
  const run=a?replayAgent(practice,id,a.profile,a.startEquity):null,neutral=a?replayAgent(practice,id,NEUTRAL_PROFILE,a.startEquity):null,s=run?.stats,active=a?.strategy===id;
  return `<article class="tactic-card tactic-${id} ${active?'is-assigned':''}"><div class="tactic-heading"><span class="tactic-icon" aria-hidden="true">${t.icon}</span><span>0${i+1} / ${t.stage.toUpperCase()}</span></div><h4>${t.name}</h4><p class="tactic-kind">${t.kind}</p><p class="tactic-description">${t.description}</p><dl class="tactic-stats"><div><dt>Net return</dt><dd class="${s&&s.returnPct>=0?'positive':'negative'}">${s?signed(s.returnPct)+'%':'—'}</dd></div><div><dt>Max drawdown</dt><dd>${s?s.maxDrawdown.toFixed(2)+'%':'—'}</dd></div><div><dt>Trades</dt><dd>${s?s.count:'—'}</dd></div><div><dt>DNA effect</dt><dd>${s?signed(s.returnPct-neutral.stats.returnPct)+' pp':'—'}</dd></div></dl><details><summary>HOW THIS TACTIC TRADES</summary><p>${t.rules}</p><p>Confirmation at candle close; earliest fill at next open. After-cost reward/risk must be at least 1.5. DNA adjusts risk, target distance and allocation. Fees 0.08% + slippage 0.05% per side.</p></details><button type="button" data-assign="${id}" aria-pressed="${active}" ${!a||spectator||busy?'disabled':''}>${active?'✓ ASSIGNED':`ASSIGN ${t.name.toUpperCase()}`}<span aria-hidden="true">→</span></button></article>`;
 }).join('');
}
$('#tactic-cards').addEventListener('click',async event=>{
 const button=event.target.closest('[data-assign]');if(!button||!selectedAgent()||spectator||busy)return;
 const tactic=button.dataset.assign;if(!Object.hasOwn(STRATEGIES,tactic))return;
 roster=roster.map(a=>key(a)===selected?{...a,strategy:tactic}:a);scope='agent';await rosterChanged();
 $('#tactic-cards').querySelector(`[data-assign="${tactic}"]`)?.focus({preventScroll:true});
});
function renderInspector(){
 const a=selectedAgent();renderTactics(a);if(!a){$('#dna-details').innerHTML='<p>No active agents. Add an NFT to inspect its fixed DNA.</p>';return;}
 const p=a.profile,stat=(name,value,level,description)=>`<div class="dna-stat"><div><span>${name}</span><strong>${value}</strong></div><div class="stat-meter" aria-hidden="true">${Array.from({length:5},(_,i)=>`<i class="${i<level+2?'filled':''}"></i>`).join('')}</div><p>${description}</p></div>`;
 $('#dna-details').innerHTML=`<div class="dna-character">${avatar(a)}<div><h3>${p.name.toUpperCase()}</h3><p>${esc(label(a))}<br>${money(a.startEquity)} starting share</p></div></div>${stat('NERVE',p.risk.toFixed(3)+'%',p.levels[0],'Risk budget per trade: '+money(a.startEquity*p.risk/100)+' initially.')}${stat('REACH',`${Math.round((p.targetMultiplier-1)*100)>0?'+':''}${Math.round((p.targetMultiplier-1)*100)}%`,p.levels[1],'Distance from signal entry to target. Stops stay fixed.')}${stat('CARGO',p.allocation+'%',p.levels[2],'Maximum portion of this agent’s budget in a position.')}<p class="dna-hash">FIXED BUILD ${p.build} · SHA-256 ${p.hash.slice(0,12)}…<br>COLLECTION + TOKEN ID · SAME NFT, SAME STATS</p><p class="dna-outcome">This replay: <b>${money(a.result.stats.endEquity)}</b> with DNA / <b>${money(a.baseline.stats.endEquity)}</b> with default stats. ${a.result.stats.count} completed ${a.result.stats.count===1?'trade':'trades'}. Small samples are not a prediction.</p>`;
 hydrateArt($('#dna-details'));
}
function drawGraph(run,baseline,initial){
 const hold=practice.hold.map(p=>({...p,equity:p.equity*initial/1000}));
 const flat=[{t:practice.from,equity:initial},{t:practice.until,equity:initial}];
 const lines=[{data:run.curve.length?run.curve:flat,color:'#b42164',width:3.2},{data:baseline.curve.length?baseline.curve:flat,color:'#3762a6',width:1.7,dash:'6 4'},{data:hold,color:'#ad741a',width:1.3}];
 if(!$('#show-hold').checked)lines.pop();
 $('#hold-legend').hidden=!$('#show-hold').checked;
 const values=lines.flatMap(l=>l.data.map(p=>p.equity)),span=Math.max(2,Math.max(initial,...values)-Math.min(initial,...values)),lo=Math.min(initial,...values)-span*.1,hi=Math.max(initial,...values)+span*.1;
 const W=720,H=320,left=58,right=15,top=19,bottom=32,x=t=>left+(t-practice.from)/(practice.until-practice.from)*(W-left-right),y=v=>top+(hi-v)/(hi-lo)*(H-top-bottom);
 let content=`<title>${scope==='pool'?'Company':'Selected agent'} historical paper equity with and without DNA</title><desc>Starting share ${money(initial)}. With DNA ${money(run.stats.endEquity)}, default stats ${money(baseline.stats.endEquity)}. Previously inspected data, not live results.</desc>`;
 for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4;content+=`<line x1="${left}" y1="${y(v)}" x2="${W-right}" y2="${y(v)}" stroke="#dcd8ca" stroke-dasharray="3 4"/><text x="${left-8}" y="${y(v)+3}" text-anchor="end">${v.toLocaleString('en-US',{maximumFractionDigits:span<10?1:0})}</text>`;}
 for(let i=0;i<5;i++){const t=practice.from+(practice.until-practice.from)*i/4;content+=`<text x="${x(t)}" y="${H-7}" text-anchor="${i===0?'start':i===4?'end':'middle'}">${date(t)}</text>`;}
 for(const l of lines.toReversed()){content+=`<path d="${[{t:practice.from,equity:initial},...l.data].map((p,i)=>`${i?'L':'M'}${x(p.t).toFixed(2)},${y(p.equity).toFixed(2)}`).join(' ')}" fill="none" stroke="${l.color}" stroke-width="${l.width}" ${l.dash?`stroke-dasharray="${l.dash}"`:''}/>`;}
 chartState={points:lines[0].data,x,y,H,top,bottom};
 $('#chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg">${content}<g id="chart-cursor"></g></svg>`;
 renderCursor();
}
function renderScoreboard(){
 if(!company)return;
 const a=selectedAgent();if(!a)scope='pool';
 $('#chart-agent').innerHTML='<option value="pool">Whole company · all agents</option>'+company.agents.map(a=>`<option value="${key(a)}">${esc(label(a))} · ${esc(a.profile.name)}</option>`).join('');
 $('#chart-agent').value=scope==='pool'?'pool':selected;
 for(const button of document.querySelectorAll('[data-view]')){button.setAttribute('aria-pressed',String(button.dataset.view===scope));button.disabled=button.dataset.view==='agent'&&!a;}
 const run=scope==='pool'?company:a.result,baseline=scope==='pool'?company.baseline:a.baseline,initial=scope==='pool'?1000:a.startEquity;
 $('#chart-title').textContent=scope==='pool'?(spectator?`${spectator.nickname.toUpperCase()}, AT A GLANCE.`:'YOUR COMPANY, AT A GLANCE.'):label(a).toUpperCase();
 $('#scope-banner').innerHTML=scope==='pool'?`<span class="scope-icon" aria-hidden="true">♛</span><div><b>WHOLE COMPANY</b><span>${company.agents.length} agents · $1,000 combined starting budget</span></div>`:`${avatar(a)}<div><b>${esc(label(a))}</b><span>${esc(a.profile.name)} · ${money(a.startEquity)} starting share</span></div><a href="#roster">CHANGE WHALE ↑</a>`;
 hydrateArt($('#scope-banner'));
 renderTradingStats(run);
 $('#chart-description').textContent=scope==='pool'?`${company.agents.length} agents share $1,000. Every curve is a reconstruction on the same old sample.`:`${STRATEGIES[a.strategy].name}. Same candles and starting share; only the DNA modifiers differ.`;
 $('#baseline-label').textContent=scope==='pool'?'Same crew, default stats':'Same agent, default stats';
 drawGraph(run,baseline,initial);
 $('#chart-comparison').textContent=`Final balance: DNA ${money(run.stats.endEquity)} · default stats ${money(baseline.stats.endEquity)} · difference ${money(run.stats.endEquity-baseline.stats.endEquity)}. DNA can help or hurt.`;
 const trades=scope==='pool'?company.trades:a.result.trades.map(t=>({...t,collection:a.collection,tokenId:a.tokenId}));
 $('#trade-rows').innerHTML=trades.length?trades.toReversed().map(t=>`<tr><td>${t.collection==='rarewhales'?'RW':'WS'} #${t.tokenId}</td><td>${stamp(t.entryTime)}</td><td>${stamp(t.exitTime)}</td><td class="${t.pnl>=0?'positive':'negative'}">${t.pnl>0?'+':''}${money(t.pnl)}</td><td>${esc(t.reason)}</td></tr>`).join(''):'<tr><td colspan="5">No completed trades in this replay.</td></tr>';
 $('#trade-note').textContent=`${scope==='pool'?'Whole company':label(a)} · ${trades.length} completed trades · ${run.skipped} entries skipped by execution checks. Some exits use a candle-close time proxy. CSV exports the whole company.`;
}
$('#chart-agent').addEventListener('change',e=>{scope=e.target.value==='pool'?'pool':'agent';if(scope==='agent')selected=e.target.value;if(!spectator)savePrivateDraft();renderAgents();renderInspector();renderScoreboard();});
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{scope=button.dataset.view;renderScoreboard();});
function addWhale(whale){
 if(busy||spectator)return;
 try{if(club?.me&&(!ownedLoaded||!ownedWhales.some(a=>key(a)===key(whale))))throw Error('Choose a whale from your wallet dropdown.');
 roster=validateRoster([...roster,{...whale,strategy:'trend'}]);selected=key(roster.at(-1));scope='agent';$('#roster-message').textContent=`${label(roster.at(-1))} added to ${club?.me?'your crew':'the sandbox'}.`;$('#add-form').hidden=true;$('#add-token').value='';rosterChanged();
 }catch(error){$('#roster-message').textContent=error.message;$('#seat-message').textContent=error.message;}
}
$('#add-agent').addEventListener('click',()=>{$('#add-form').hidden=!$('#add-form').hidden;renderOwnedWhales();if(!$('#add-form').hidden)$(club?.me?'#add-owned':'#add-token').focus();});
$('#cancel-add').addEventListener('click',()=>{$('#add-form').hidden=true;});
$('#add-form').addEventListener('submit',e=>{e.preventDefault();const whale=club?.me?ownedWhales.find(a=>key(a)===$('#add-owned').value):{collection:$('#add-collection').value,tokenId:Number($('#add-token').value)};if(whale)addWhale(whale);});
$('#add-owned-whale').addEventListener('click',()=>{const whale=ownedWhales.find(a=>key(a)===$('#owned-whale').value);if(whale)addWhale(whale);});
for(const id of ['owned-whale','add-owned'])$('#'+id).addEventListener('change',renderOwnedWhales);
$('#refresh-whales').addEventListener('click',()=>{if(!busy)loadOwnedWhales();});
$('#registration-roster').addEventListener('click',event=>{const remove=event.target.closest('[data-crew-remove]');if(remove&&!busy){roster=roster.filter(a=>key(a)!==remove.dataset.crewRemove);rosterChanged();}});
function renderOwnedWhales(){
 live.sync();paper.sync();
 const signedIn=!!club?.me,available=ownedWhales.filter(a=>!roster.some(b=>key(b)===key(a)));
 $('#manual-whale-fields').hidden=signedIn;$('#owned-add-label').hidden=!signedIn;$('#add-token').required=!signedIn;$('#add-token').disabled=signedIn;
 $('#add-submit').textContent=signedIn?'ADD TO CREW':'ADD TO SANDBOX';$('#add-submit').disabled=busy||signedIn&&(!ownedLoaded||ownedLoading||!available.length||roster.length>=MAX_AGENTS);
 $('#add-help').textContent=signedIn?'Choose a whale held by the signed-in wallet. Ownership is checked again when publishing.':'Preview a token from either collection. Sign in to choose from your own wallet’s whales.';
 const placeholder=!signedIn?'Sign in to load your whales':ownedLoading?'Loading your whales…':!ownedLoaded?'Refresh to load your whales':!available.length?(ownedWhales.length?'All your whales are already in this crew':'No whales found in this wallet'):'Choose a whale…';
 for(const id of ['owned-whale','add-owned']){const select=$('#'+id),old=select.value;select.innerHTML=`<option value="">${placeholder}</option>`+available.map(a=>`<option value="${key(a)}">${esc(label(a))}</option>`).join('');if(available.some(a=>key(a)===old))select.value=old;select.disabled=busy||!signedIn||ownedLoading||!ownedLoaded||!available.length||roster.length>=MAX_AGENTS;}
 $('#add-owned-whale').disabled=busy||!signedIn||ownedLoading||!ownedLoaded||!available.length||roster.length>=MAX_AGENTS||!$('#owned-whale').value;
 if(signedIn)$('#add-submit').disabled=$('#add-submit').disabled||!$('#add-owned').value;
 $('#refresh-whales').disabled=!signedIn||ownedLoading||busy;
 $('#owned-status').textContent=!signedIn?'Your Rare Whales and WhaleStreet NFTs will appear here after sign-in.':ownedLoading?(inventoryProgress||'Reading both collections from Robinhood…'):ownedError||(!ownedLoaded?'Load your wallet’s whales to build a crew.':`${ownedWhales.length} ${ownedWhales.length===1?'whale':'whales'} found · ${roster.length}/${MAX_AGENTS} in your crew. ${ownedWhales.length?(available.length?'Select a whale above and add it.':'All available whales are in your crew.'):'Check that you signed in with the wallet holding your NFTs.'}`);
 $('#sandbox-label').textContent=spectator?'SPECTATOR · PRIVATE DRAFT KEPT':signedIn?'YOUR WALLET CREW · HISTORICAL REPLAY':'SANDBOX · OWNERSHIP NOT VERIFIED';
}
function syncCrewWallet(){
 const next=club?.me?.address?.toLowerCase()||null,rules=club?.arcade?.ruleHash||club?.season?.id||null;
 if(next===crewWallet&&rules===crewRules)return false;
 // Save outgoing work before resetting controls. Never turn a spectator into a private draft.
 const outgoingWallet=crewWallet;savePrivateDraft();leaveSpectator();inventoryController?.abort();
 crewWallet=next;crewRules=rules;inventoryRevision++;ownedWhales=[];ownedLoaded=false;ownedLoading=false;ownedError='';inventoryProgress='';draftResult=null;uncertainAction=null;
 roster=[];selected=null;scope='pool';$('#add-form').hidden=true;$('#seat-form').reset();$('#seat-message').textContent='';$('#published-link').hidden=true;
 if(next){
  const saved=loadDraft(draftStorage,next,rules),seat=club.me.seat;
  if(saved.status==='loaded'){
   roster=saved.draft.agents;selected=saved.draft.selected;$('#nickname').value=saved.draft.nickname;updateRegistrationRoster();$('#captain').value=chooseCaptain(roster,saved.draft.captain);
   draftStorageStatus='Private draft restored. Checking your current holdings before you publish.';
  }else if(seat){
   roster=validateRoster(seat.agents||[]);$('#nickname').value=seat.nickname;updateRegistrationRoster();$('#captain').value=chooseCaptain(roster,`${seat.collection}:${seat.tokenId}`);
   draftStorageStatus='Published crew loaded. Your edits stay private until you publish again.';
  }else draftStorageStatus=saved.status==='unavailable'?'Browser storage is unavailable. Keep this tab open to retain your draft.':saved.status==='corrupt'?'The saved draft could not be read. Start a new crew; your public entry is unchanged.':'New private draft. Choose whales from this wallet.';
 }else{
  try{const saved=localStorage.getItem('whale-pools-sandbox-v1');roster=saved?validateRoster(JSON.parse(saved)):example;}catch{roster=example;}
 }
 $('#roster-message').textContent=next?'Your private crew is separate from the practice sandbox.':outgoingWallet?'Signed out. Your wallet draft is kept privately in this browser for your return.':'Practice with these example whales. Sign in to choose whales from your own wallet.';
 updateRegistrationRoster();renderJourney();refreshCompany();return true;
}
async function loadOwnedWhales(){
 const wallet=club?.me?.address?.toLowerCase();if(!wallet)return;
 inventoryController?.abort();inventoryController=new AbortController();
 const revision=++inventoryRevision;ownedLoading=true;ownedLoaded=false;ownedError='';inventoryProgress='Connecting to Robinhood…';renderOwnedWhales();updateRegistrationRoster();
 try{
  const result=await loadHoldings({address:wallet,signal:inventoryController.signal,onProgress:p=>{
   if(revision!==inventoryRevision)return;
   const name=p.collection?COLLECTIONS[p.collection].name:'Robinhood';
   const percent=p.totalBlocks&&Number(p.totalBlocks)>0?` · ${Math.min(100,Math.floor(Number(p.scannedBlocks)/Number(p.totalBlocks)*100))}% history checked`:'';
   inventoryProgress=p.phase==='history'?`Checking ${name} transfers${percent}…`:p.phase==='balance'?`Checking ${name} balance…`:p.phase==='verify'?`Confirming ${name} ownership at the same block…`:p.phase==='complete'?(p.completedCollections===p.totalCollections?'Both collections checked. Finishing your inventory…':`${name} checked. Loading the next collection…`):'Connecting to Robinhood…';renderOwnedWhales();
  }});
  if(revision!==inventoryRevision||club?.me?.address?.toLowerCase()!==wallet)return;
  if(result.address!==wallet)throw Error('Wallet changed. Reconnect before choosing whales.');
  ownedWhales=inventoryItems(result.items);ownedLoaded=true;
  if(ownedWhales.length&&walletReady)nextSprint.pilotEvent(club?.me?.seat?'wallet_ready_existing':'wallet_ready_new');
  const retained=retainOwned(roster,ownedWhales),removed=roster.length-retained.length;
  if(removed){roster=retained;$('#seat-message').textContent=`${removed} ${removed===1?'whale is':'whales are'} no longer in this wallet and removed from the private crew. Your public entry stays unchanged until you publish.`;rosterChanged();}
 }catch(e){
  if(revision===inventoryRevision&&e.name!=='AbortError'){ownedLoaded=false;const reason=e.name==='TimeoutError'?'Loading took too long.':/wrong network/.test(e.message)?'The inventory service returned another network.':/history|balance|ownership/.test(e.message)?'Your wallet history could not be fully verified.':'The inventory service is unavailable.';nextSprint.pilotEvent('inventory_error');live.inventoryError();ownedError=`${reason} Your draft is kept. Refresh your whales to try again.`;}
 }finally{if(revision===inventoryRevision){ownedLoading=false;renderOwnedWhales();updateRegistrationRoster();renderJourney();}}
}
$('#download').addEventListener('click',()=>{
 if(!company)return;const fields=['collection','tokenId','strategy','entryTime','exitTime','entry','exit','qty','pnl','reason','exitTimePrecision'];
 const quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';
 const rows=company.trades.map(t=>fields.map(k=>quote(k.endsWith('Time')?new Date(t[k]).toISOString():t[k])).join(','));
 const blob=new Blob([[fields.join(','),...rows].join('\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='whale-pool-tactics-v1-historical-trades.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function updateRegistrationRoster(){
 const captain=chooseCaptain(roster,$('#captain').value);
 $('#captain').innerHTML=roster.length?roster.map(a=>`<option value="${key(a)}">${esc(label(a))}</option>`).join(''):'<option value="">Add a whale to your crew first</option>';
 $('#captain').value=captain;$('#captain').disabled=!roster.length;
 $('#registration-roster').innerHTML=roster.length?`<p>${roster.length} ${roster.length===1?'agent':'agents'} · $1,000 shared equally (${money(1000/roster.length)} each).</p><div class="company-crew">`+roster.map(a=>`<div>${avatar(a)}<span>${esc(label(a))}</span><button type="button" data-crew-remove="${key(a)}" aria-label="Remove ${esc(label(a))} from company">×</button></div>`).join('')+'</div>':'Add at least one whale from your wallet above. Your first whale becomes captain.';
 hydrateArt($('#registration-roster'));
 $('#check').disabled=busy||!club?.me||!walletReady||!roster.length;$('#reserve').disabled=busy||!!uncertainAction||!club?.me||!walletReady||!club?.registrationOpen||!roster.length||!ownedLoaded||ownedLoading||!draftResult;
}
function renderClub(){
 if(!club)return;const me=club.me,seat=me?.seat;
 if(club.demo){
  $('#season-status').textContent='PREVIEW';$('#connect').textContent='EXPLORE WHAT’S NEXT';$('#connect').disabled=false;$('#logout').hidden=true;$('#seat-connect').hidden=true;$('#wallet-status').textContent='Registration is not open in this public demo.';$('#sign-in-note').textContent='Try every sandbox control without connecting a wallet. Your roster stays in this browser.';$('#seat-fields').disabled=true;$('#reserve').disabled=true;$('#registration-notice').textContent='Coming after the demo: approved promo 1/1s, founder access, future season dates and a working paper recorder. No wallet connection or NFT approval is needed today.';updateRegistrationRoster();return;
 }
 $('#season-status').textContent=club.arcade?'ARCADE OPEN':club.season.status.toUpperCase();$('#connect').textContent=me?`${me.address.slice(0,6)}…${me.address.slice(-4)}`:'CONNECT WALLET';$('#connect').disabled=!!me&&walletReady;$('#logout').hidden=!me;$('#seat-connect').hidden=!!me&&walletReady;
 $('#wallet-status').textContent=me?`Owner wallet: ${me.address}`:'Sign in to prove control of your Robinhood wallet.';
 $('#seat-fields').disabled=busy||!me;$('#reserve').disabled=!me||!club.registrationOpen;
 $('#registration-notice').textContent=club.arcade?'Free historical arcade. Publish your current crew; the server verifies ownership and calculates the score. You can edit, resubmit or remove your entry.':club.registrationOpen?`Registration closes ${new Date(club.season.registrationClosesAt).toLocaleString('en-GB',{timeZone:'UTC'})} UTC. Your roster and tactics lock then.`:club.season.status==='draft'?'Registration is waiting for the approved 1/1 list, founder wallet, future dates and season recorder.':'Registration is closed. Company rosters and tactics are fixed.';
 $('#remove').hidden=!seat||!club.registrationOpen;$('#load-saved').hidden=!seat;
 $('#published-link').hidden=!seat;if(seat)$('#published-link').href='#company/'+seat.id;
 $('#remove').disabled=busy||!!uncertainAction||!walletReady;
 updateRegistrationRoster();renderOwnedWhales();
}
async function refreshClub(){
 const epoch=walletRevision,clubEpoch=++clubGeneration,next=await api('/api/club',undefined,'GET',walletController.signal);if(epoch!==walletRevision||clubEpoch!==clubGeneration)return;
 club=next;const changed=syncCrewWallet();renderClub();$('#retry-status').hidden=true;
 if(club.me&&!walletReady)await restoreWalletProvider(club.me.address);
 if(epoch!==walletRevision)return;
 if(club.me&&(changed||!ownedLoaded)&&!ownedLoading)await loadOwnedWhales();
}
async function logout(){
 walletRevision++;walletReady=false;walletController.abort();walletController=new AbortController();inventoryController?.abort();
 if(club)club.me=null;syncCrewWallet();renderOwnedWhales();renderClub();
 logoutPending=api('/api/auth/logout',{}).catch(e=>{message('Sign-out could not reach the server. Your private draft is kept. Retry sign-in before publishing. '+e.message);throw e;});
 try{await logoutPending;}catch{/* Next sign-in retries server sign-out first. */}
}
async function signIn(){
 if(club?.demo){location.hash='seat';return;}
 if(!club){message('Arcade status could not load. Use Retry connection, then sign in.');$('#retry-status').hidden=false;return;}
 if(busy)return;const entry=location.href;busy=true;message('');renderOwnedWhales();
 try{
  try{await logoutPending;}catch{await api('/api/auth/logout',{});logoutPending=Promise.resolve();}
  const wallet=await pickWallet();if(!wallet)return;watchProvider(wallet.provider);
  try{localStorage.setItem('whale-pools-wallet-provider-v1',wallet.rdns);}catch{/* Wallet discovery can restore authorised providers without this hint. */}
  const epoch=walletRevision,signal=walletController.signal;
  const walletRequest=params=>boundedRequest(()=>provider.request(params),{timeoutMs:90000,signal});
  let addresses;initialAccountProvider=provider;
  try{addresses=await walletRequest({method:'eth_requestAccounts'});}finally{initialAccountProvider=null;}
  if(!addresses?.[0])throw Error('No wallet selected.');
  if(Number(await walletRequest({method:'eth_chainId'}))!==CHAIN_ID)throw Error('Select Robinhood Chain in your wallet, then connect again.');
  const challenge=await api('/api/auth/challenge',{address:addresses[0]},'POST',signal),encoded='0x'+[...new TextEncoder().encode(challenge.message)].map(n=>n.toString(16).padStart(2,'0')).join('');
  if(epoch!==walletRevision)throw Error('Wallet changed. Please reconnect.');
  const signature=await walletRequest({method:'personal_sign',params:[encoded,addresses[0]]});
  const current=await walletRequest({method:'eth_accounts'});if(epoch!==walletRevision||current?.[0]?.toLowerCase()!==addresses[0].toLowerCase()||Number(await walletRequest({method:'eth_chainId'}))!==CHAIN_ID)throw Error('The wallet changed during sign-in. Please reconnect.');
  await api('/api/auth/verify',{id:challenge.id,signature},'POST',signal);
  if(epoch!==walletRevision)return;walletReady=true;await refreshClub();if(epoch===walletRevision){const landing=signInLanding(entry,location.href);if(landing)location.hash=landing;}
 }catch(e){if(e.name!=='AbortError')message(e.code===4001?'Wallet request cancelled. Your draft is kept; sign in when ready.':e.name==='TimeoutError'?'Sign-in took too long. Close any old wallet request, then try again.':e.message||'Wallet sign-in failed.');}
 finally{busy=false;renderClub();renderOwnedWhales();renderAgents();renderInspector();updateRegistrationRoster();}
}
$('#connect').addEventListener('click',signIn);$('#seat-connect').addEventListener('click',signIn);$('#logout').addEventListener('click',logout);
function seatInput(){const captain=roster.find(a=>key(a)===$('#captain').value);return {nickname:$('#nickname').value,collection:captain?.collection??null,tokenId:captain?.tokenId??null,strategy:captain?.strategy??'trend',publish:$('#publish').checked,agents:roster,ruleHash:club?.arcade?.ruleHash};}
function seatMatches(seat,input){
 const canonical=agents=>validateRoster(agents).sort((a,b)=>a.collection.localeCompare(b.collection)||a.tokenId-b.tokenId);
 return !!seat&&seat.nickname===input.nickname.trim()&&seat.collection===input.collection&&seat.tokenId===input.tokenId&&JSON.stringify(canonical(seat.agents||[]))===JSON.stringify(canonical(input.agents));
}
async function reconcileEntry(){
 if(!uncertainAction)return;
 const action=uncertainAction,epoch=walletRevision;
 try{
  await refreshClub();if(epoch!==walletRevision)return;
  const saved=club?.me?.seat,applied=club?.me?.mutationId===action.mutationId&&(club?.me?.revision??0)>action.expectedRevision,matches=applied&&(action.method==='DELETE'?!saved:seatMatches(saved,action.input));
  const resolvedDifferent=(club?.me?.revision??0)>action.expectedRevision&&!applied;
  uncertainAction=null;
  if(matches&&action.method!=='DELETE')nextSprint.pilotEvent(action.previousPublished?'published_edit':'published_create');
  $('#seat-message').textContent=matches?(action.method==='DELETE'?'Removal confirmed on the server. Your private draft is kept.':'Your matching company is saved on the leaderboard. Publication confirmed.'):resolvedDifferent?'A newer company change is saved. Your draft is kept; review the saved crew before publishing again.':'The saved entry has been checked, but this change is not confirmed. Your private draft is kept. Review it and try again when ready.';
 }catch(e){if(epoch===walletRevision)$('#seat-message').textContent='Could not confirm the saved entry yet. Check again before retrying publication. '+e.message;}
 renderJourney();updateRegistrationRoster();renderClub();
}
async function seatAction(path,method='POST'){
 if(busy||uncertainAction||!club?.me||!walletReady)return;
 savePrivateDraft();busy=true;const previousPublished=!!club.me.seat,epoch=walletRevision,input=seatInput(),expectedRevision=club.me.revision??0,mutationId=crypto.randomUUID();$('#seat-message').textContent=method==='DELETE'?'Removing your public entry…':'Checking ownership of every whale on Robinhood…';$('#seat-fields').disabled=true;renderAgents();renderInspector();
 try{
  const result=await api(path,method==='DELETE'?undefined:input,method,walletController.signal,path==='/api/seat'?{'x-whale-revision':String(expectedRevision),'x-whale-mutation':mutationId}:{});if(epoch!==walletRevision)return;
  if(path==='/api/seat'){
   await refreshClub();if(epoch!==walletRevision)return;
   $('#seat-message').textContent=method==='DELETE'?'Your public entry has been removed. Your private draft is kept so you can return and publish again.':`Published ${input.agents.length} whales: ${signed(result.stats.returnPct)}% net historical return. View your company on the leaderboard.`;
   if(method!=='DELETE'){nextSprint.pilotEvent(previousPublished?'published_edit':'published_create');$('#published-link').hidden=false;}
  }else $('#seat-message').textContent=result.eligible?`${result.label} verified. Every whale belongs to this wallet; ownership is checked again when publishing.`:result.reason;
 }catch(e){
  if(epoch===walletRevision&&e.name!=='AbortError'){
   if(path==='/api/seat')nextSprint.pilotEvent('publish_error');
   if(path==='/api/seat'&&e.uncertain){uncertainAction={method,input,expectedRevision,mutationId,previousPublished};$('#seat-message').textContent='The response did not arrive. Checking your saved entry before you retry…';await reconcileEntry();}
   else{if(e.status===409)await refreshClub();$('#seat-message').textContent=e.message+' Your private draft is kept.';if(/sign in|Connect/.test(e.message)){if(club)club.me=null;syncCrewWallet();renderClub();}}
  }
 }finally{busy=false;$('#seat-fields').disabled=!club?.me;renderJourney();updateRegistrationRoster();renderClub();renderAgents();renderInspector();}
}
$('#check').addEventListener('click',()=>seatAction('/api/eligibility'));$('#seat-form').addEventListener('submit',e=>{e.preventDefault();seatAction('/api/seat');});
$('#reconcile-entry').addEventListener('click',reconcileEntry);
$('#nickname').addEventListener('input',savePrivateDraft);$('#captain').addEventListener('change',savePrivateDraft);
$('#load-saved').addEventListener('click',()=>{
 if(!club?.me?.seat||busy)return;if(!ownedLoaded){$('#seat-message').textContent='Refresh your whales first. Your private draft is kept.';return;}
 roster=retainOwned(validateRoster(club.me.seat.agents||[]),ownedWhales);$('#nickname').value=club.me.seat.nickname;updateRegistrationRoster();$('#captain').value=chooseCaptain(roster,`${club.me.seat.collection}:${club.me.seat.tokenId}`);rosterChanged();
 $('#seat-message').textContent='Still-owned whales from your published crew loaded. These replace the private draft; changes reach the board when you publish again.';
});
$('#remove').addEventListener('click',()=>seatAction('/api/seat','DELETE'));
let boardPools=[];
async function loadCrew(){
 const epoch=++crewGeneration;$('#refresh-board').disabled=true;
 try{const data=await api('/api/crew');if(epoch!==crewGeneration)return;boardPools=data.seats;
 $('#crew-count').textContent=`${data.total??data.seats.length} ${(data.total??data.seats.length)===1?'COMPANY':'COMPANIES'}`;
 $('#crew-state').textContent=data.total>100?'TOP 100 · HISTORICAL ARCADE':'HISTORICAL ARCADE · ROUND 01';
 $('#crew-list').innerHTML=data.seats.length?data.seats.map(pool=>`<article class="crew-member panel"><div class="panel-title purple"><span>#${pool.rank} · ${esc(pool.nickname)}</span><span>${pool.agents.length} AGENTS</span></div><div class="board-metrics"><div><span>NET RETURN</span><strong class="${pool.stats.returnPct>=0?'positive':'negative'}">${signed(pool.stats.returnPct)}%</strong></div><div><span>DRAWDOWN</span><strong>${pool.stats.maxDrawdown.toFixed(2)}%</strong></div><div><span>TRADES</span><strong>${pool.stats.count}</strong></div><div><span>FINAL PAPER BALANCE</span><strong>${money(pool.stats.endEquity)}</strong></div></div><div class="company-meta">Owner <a href="https://robinhoodchain.blockscout.com/address/${esc(pool.owner)}" target="_blank" rel="noopener">${esc(pool.owner.slice(0,6))}…${esc(pool.owner.slice(-4))} ↗</a><br>Ownership checked ${stamp(pool.updatedAt)} UTC · block ${esc(pool.ownershipBlock)}<br>Same $1,000 starting budget · current published crew</div><div class="crew-avatars">${pool.agents.map(a=>`<div class="crew-avatar">${avatar(a)}<span>${a.collection==='rarewhales'?'RW':'WS'} #${a.tokenId} · ${esc(a.profile.name)}<br>${esc(STRATEGIES[a.strategy].name)}<br>${signed(a.stats.returnPct)}% · ${a.stats.count} ${a.stats.count===1?'trade':'trades'}</span></div>`).join('')}</div><a class="link-button public-company-link" href="#company/${esc(pool.id)}">VIEW & SHARE COMPANY →</a><button type="button" class="link-button board-replay" data-replay-pool="${esc(pool.id)}">EXPLORE THIS CREW’S REPLAY →</button></article>`).join(''):'<div class="empty-state"><span>≈</span><h2>THE BOARD IS OPEN.<br>BRING THE FIRST CREW.</h2><p>Sign in with a wallet that owns a Rare Whales or WhaleStreet NFT.<br>Choose your crew, publish its historical score, and make your mark.</p><a href="#seat" class="pixel-button yellow">PUBLISH MY COMPANY →</a></div>';
 hydrateArt($('#crew-list'));
 }catch(e){if(epoch!==crewGeneration)return;$('#crew-count').textContent='BOARD UNAVAILABLE';$('#crew-state').textContent='TRY REFRESHING';$('#crew-list').textContent=e.message;}
 finally{if(epoch===crewGeneration)$('#refresh-board').disabled=false;}
}
$('#refresh-board').addEventListener('click',loadCrew);
function inspectCompany(pool){
 if(busy)return; if(!spectator)savePrivateDraft();
 spectator={nickname:pool.nickname,agents:validateRoster(pool.agents),privateSelected:spectator?.privateSelected??selected,privateScope:spectator?.privateScope??scope};
 selected=null;scope='pool';$('#add-form').hidden=true;renderJourney();renderOwnedWhales();refreshCompany();location.hash='roster';
 message(`Exploring ${pool.nickname}. Your private draft and wallet session are kept. Tactics here are read-only.`);
}
$('#crew-list').addEventListener('click',event=>{
 const id=event.target.closest('[data-replay-pool]')?.dataset.replayPool,pool=boardPools.find(p=>p.id===id);if(!pool||busy)return;
 inspectCompany(pool);
});
$('#return-to-draft').addEventListener('click',()=>{leaveSpectator();message('Returned to your private crew.');location.hash='roster';});


function renderTradingStats(run){
 const s=run.stats,trades=run.trades||[],wins=trades.filter(t=>t.pnl>0),losses=trades.filter(t=>t.pnl<0),flat=trades.length-wins.length-losses.length;
 const card=(name,value,note,color='')=>`<div class="result-stat"><span>${name}</span><strong class="${color}">${value}</strong><small>${note}</small></div>`;
 $('#result-stats').innerHTML=card('NET PROFIT / LOSS',`${s.pnl>0?'+':''}${money(s.pnl)}`,'After modeled fees + slippage',s.pnl>=0?'positive':'negative')+card('COMPLETED TRADES',String(trades.length),'Agent trades can overlap')+card('WIN RATE',trades.length?s.winRate.toFixed(1)+'%':'—',`${wins.length} won · ${losses.length} lost · ${flat} flat`)+card('WORST DRAWDOWN',s.maxDrawdown.toFixed(2)+'%','Largest peak-to-trough fall');
 const average=trades.length?money(s.pnl/trades.length):'—',best=trades.length?money(Math.max(...trades.map(t=>t.pnl))):'—',worst=trades.length?money(Math.min(...trades.map(t=>t.pnl))):'—';
 const pf=!trades.length?'—':s.profitFactor===null?'No losing trades':s.profitFactor.toFixed(2)+'×';
 const rows=[['Average trade',average,'Net profit / loss divided by completed trades.'],['Best / worst trade',best+' / '+worst,'Largest and smallest completed net outcomes.'],['Profit factor',pf,'Total net winning P/L divided by absolute net losing P/L.'],['Skipped entries',String(run.skipped),'Signals rejected by execution checks.'],['Sample','24 Jul–19 Sep 2026','Previously inspected UBTC/USDC candles. Reconstructed, not live.']];
 $('#trade-stats').innerHTML=rows.map(([name,value,note])=>`<div><span>${name}</span><b>${value}</b><small>${note}</small></div>`).join('');
}
function renderCursor(){
 if(!chartState||!$('#chart-cursor'))return;const {points,x,y,H,top,bottom}=chartState;
 const point=points[Math.round(Number($('#replay-cursor').value)/100*(points.length-1))];
 $('#cursor-value').textContent=`${stamp(point.t)} UTC · ${money(point.equity)} paper equity`;
 $('#replay-cursor').setAttribute('aria-valuetext',$('#cursor-value').textContent);
 $('#chart-cursor').innerHTML=`<line x1="${x(point.t)}" x2="${x(point.t)}" y1="${top}" y2="${H-bottom}" stroke="#16233f" stroke-width="1.5" stroke-dasharray="3 4"/><circle cx="${x(point.t)}" cy="${y(point.equity)}" r="5" fill="#ffe06b" stroke="#16233f" stroke-width="2"/>`;
}
$('#replay-cursor').addEventListener('input',renderCursor);
$('#show-hold').addEventListener('change',renderScoreboard);
async function loadReplay(){
 $('#retry-replay').hidden=true;
 try{practice=await requestJSON(asset('/practice.json'));await refreshCompany();}
 catch(e){message('Historical replay could not load. Your draft is kept. '+e.message);$('#retry-replay').hidden=false;}
}
$('#retry-replay').addEventListener('click',loadReplay);
$('#retry-status').addEventListener('click',()=>refreshClub().catch(e=>message('Arcade connection unavailable. Your draft is kept. '+e.message)));
updateRegistrationRoster();renderOwnedWhales();renderJourney();route();
Promise.allSettled([refreshClub(),loadReplay()]).then(results=>{for(const r of results)if(r.status==='rejected'){message('Arcade connection unavailable. '+r.reason.message);$('#retry-status').hidden=false;}});
