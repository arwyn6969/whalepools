import {CHAIN_ID,STRATEGIES,COLLECTIONS} from '../src/config.mjs';
import {MAX_AGENTS,validateRoster} from '../src/dna.mjs';
import {NEUTRAL_PROFILE} from '../src/dna.mjs';
import {replayPool,replayAgent} from '../src/pool.mjs';
const $=s=>document.querySelector(s);
const asset=p=>new URL(p.replace(/^\//,''),import.meta.url).href;
let chartState,equipment='surfboard';
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(n);
const signed=n=>`${n>0?'+':''}${n.toFixed(2)}`;
const date=t=>new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'});
const stamp=t=>new Date(t).toISOString().slice(0,16).replace('T',' ');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=a=>`${a.collection}:${a.tokenId}`;
const label=a=>`${COLLECTIONS[a.collection].name} #${a.tokenId}`;
const art=a=>a.collection==='whalestreet'&&a.tokenId===1?asset('/art/whalestreet-1.avif'):a.collection==='rarewhales'&&a.tokenId===245?asset('/whale.avif'):a.collection==='rarewhales'&&[246,247,248].includes(a.tokenId)?asset(`/art/whale-${a.tokenId}.avif`):null;
const avatar=a=>art(a)?`<img src="${art(a)}" alt="${esc(label(a))}">`:'<span class="generic-whale" role="img" aria-label="NFT artwork unavailable">?</span>';
const example=[{collection:'rarewhales',tokenId:245,strategy:'trend'},{collection:'rarewhales',tokenId:246,strategy:'recovery'},{collection:'whalestreet',tokenId:1,strategy:'breakout'},{collection:'rarewhales',tokenId:248,strategy:'magnet'}];
let roster=example,selected='rarewhales:245',scope='pool',practice,company,club,provider,busy=false,generation=0;
try{const saved=localStorage.getItem('whale-pools-sandbox-v1');if(saved)roster=validateRoster(JSON.parse(saved));}catch{/* A corrupted local draft never affects registered companies. */}
const watchedProviders=new WeakSet();
async function api(path,data,method=data?'POST':'GET'){
 const r=await fetch(asset(path),{method,credentials:'same-origin',headers:data?{'content-type':'application/json'}:{},...(data?{body:JSON.stringify(data)}:{})});
 const result=await r.json();if(!r.ok)throw Error(result.error||'The pool could not complete that action.');return result;
}
function message(text){$('#global-message').textContent=text;$('#global-message').hidden=!text;}
function route(){
 const hash=location.hash.slice(1),current=['seat','crew','wax'].includes(hash)?hash:'practice';
 for(const section of document.querySelectorAll('.page'))section.hidden=section.id!==current;
 for(const link of document.querySelectorAll('nav a')){if(link.dataset.page===current)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 if(current==='crew')loadCrew();
 if(current==='wax')renderOutfit();
 if(hash==='roster')$('#roster').scrollIntoView({block:'start'});
}
window.addEventListener('hashchange',route);
function rosterChanged(){try{localStorage.setItem('whale-pools-sandbox-v1',JSON.stringify(roster));}catch{/* Practice still works without local persistence. */}updateRegistrationRoster();return refreshCompany();}
async function refreshCompany(){
 if(!practice)return;
 const epoch=++generation;$('#download').disabled=true;
 try{
  const next=await replayPool(practice,roster);if(epoch!==generation)return;company=next;
  if(!company.agents.some(a=>key(a)===selected))selected=company.agents[0]?key(company.agents[0]):null;
  const s=company.stats;$('#end-equity').textContent=money(s.endEquity);$('#net-return').textContent=signed(s.returnPct)+'%';$('#net-return').className=s.returnPct>=0?'positive':'negative';$('#drawdown').textContent=s.maxDrawdown.toFixed(2)+'%';$('#agent-count').textContent=`${roster.length} / ${MAX_AGENTS}`;$('#budget-split').textContent=roster.length?`${money(1000/roster.length)} starting budget each`:'$1,000 stays in paper cash';
  renderAgents();renderInspector();renderScoreboard();renderOutfit();$('#download').disabled=!company.trades.length;
 }catch(e){if(epoch!==generation)return;message('Replay unavailable: '+e.message);company=null;for(const id of ['end-equity','net-return','drawdown'])$('#'+id).textContent='—';$('#chart').replaceChildren();$('#trade-rows').innerHTML='<tr><td colspan="5">Replay unavailable. No result has been substituted.</td></tr>';}
}
function renderAgents(){
 if(!company)return;
 $('#agent-roster').innerHTML=company.agents.length?company.agents.map(a=>`<article class="agent-card agent-color-${a.profile.levels[0]} ${key(a)===selected?'is-selected':''}"><div class="agent-top"><span>${a.collection==='rarewhales'?'RARE WHALES':'WHALESTREET'} #${a.tokenId}</span><button type="button" data-remove="${key(a)}" aria-label="Remove ${esc(label(a))}">×</button></div><button class="agent-portrait" data-inspect="${key(a)}" aria-label="Select ${esc(label(a))} and view trading results" aria-pressed="${key(a)===selected}">${avatar(a)}<span class="inspect-label">${key(a)===selected?'SELECTED AGENT':'VIEW MY RESULTS ↗'}</span></button><div class="agent-info"><h4 class="agent-name">${STRATEGIES[a.strategy].name.toUpperCase()}</h4><div class="agent-sub"><span>${a.profile.name} · DNA ${a.profile.hash.slice(0,6)}</span><span>${money(a.startEquity)} budget</span></div><div class="agent-stats"><span>NERVE<strong>${a.profile.risk.toFixed(3)}%</strong></span><span>REACH<strong>${a.profile.targetMultiplier>1?'+':''}${((a.profile.targetMultiplier-1)*100).toFixed(0)}%</strong></span><span>CARGO<strong>${a.profile.allocation}%</strong></span></div><label>ASSIGN TACTIC<select data-tactic="${key(a)}" aria-label="Strategy for ${esc(label(a))}">${Object.entries(STRATEGIES).map(([id,t])=>`<option value="${id}" ${a.strategy===id?'selected':''}>${t.icon} ${t.name}</option>`).join('')}</select></label><p class="agent-result"><span>Net replay P/L</span><b class="${a.result.stats.pnl>=0?'positive':'negative'}">${a.result.stats.pnl>0?'+':''}${money(a.result.stats.pnl)}</b></p><div class="agent-mini-stats"><span><b>${a.result.stats.count}</b> trades</span><span><b>${a.result.stats.count?a.result.stats.winRate.toFixed(0)+'%':'—'}</b> won</span><span><b>${a.result.stats.maxDrawdown.toFixed(2)}%</b> drawdown</span></div></div></article>`).join(''):'<div class="empty-roster"><h3>YOUR COMPANY NEEDS A CREW.</h3><p>Add a whale above. An empty pool keeps its budget in paper cash.</p></div>';
}
$('#agent-roster').addEventListener('click',event=>{
 const inspect=event.target.closest('[data-inspect]'),remove=event.target.closest('[data-remove]');
 if(inspect){selected=inspect.dataset.inspect;scope='agent';renderAgents();renderInspector();renderScoreboard();renderOutfit();}
 if(remove){roster=roster.filter(a=>key(a)!==remove.dataset.remove);rosterChanged();}
});
$('#agent-roster').addEventListener('change',event=>{if(event.target.dataset.tactic){roster=roster.map(a=>key(a)===event.target.dataset.tactic?{...a,strategy:event.target.value}:a);rosterChanged();}});
function selectedAgent(){return company?.agents.find(a=>key(a)===selected);}
function renderTactics(a){
 $('#tactic-whale').textContent=a?`${label(a)} · ${money(a.startEquity)} per replay · fixed DNA ${a.profile.build}. Select another whale above to compare its tactics.`:'Add a whale to compare these four tactics with the same budget.';
 $('#tactic-cards').innerHTML=Object.entries(STRATEGIES).map(([id,t],i)=>{
  const run=a?replayAgent(practice,id,a.profile,a.startEquity):null,neutral=a?replayAgent(practice,id,NEUTRAL_PROFILE,a.startEquity):null,s=run?.stats,active=a?.strategy===id;
  return `<article class="tactic-card tactic-${id} ${active?'is-assigned':''}"><div class="tactic-heading"><span class="tactic-icon" aria-hidden="true">${t.icon}</span><span>0${i+1} / ${t.stage.toUpperCase()}</span></div><h4>${t.name}</h4><p class="tactic-kind">${t.kind}</p><p class="tactic-description">${t.description}</p><dl class="tactic-stats"><div><dt>Net return</dt><dd class="${s&&s.returnPct>=0?'positive':'negative'}">${s?signed(s.returnPct)+'%':'—'}</dd></div><div><dt>Max drawdown</dt><dd>${s?s.maxDrawdown.toFixed(2)+'%':'—'}</dd></div><div><dt>Trades</dt><dd>${s?s.count:'—'}</dd></div><div><dt>DNA effect</dt><dd>${s?signed(s.returnPct-neutral.stats.returnPct)+' pp':'—'}</dd></div></dl><details><summary>HOW THIS TACTIC TRADES</summary><p>${t.rules}</p><p>Confirmation at candle close; earliest fill at next open. After-cost reward/risk must be at least 1.5. DNA adjusts risk, target distance and allocation. Fees 0.08% + slippage 0.05% per side.</p></details><button type="button" data-assign="${id}" aria-pressed="${active}" ${!a?'disabled':''}>${active?'✓ ASSIGNED':`ASSIGN ${t.name.toUpperCase()}`}<span aria-hidden="true">→</span></button></article>`;
 }).join('');
}
$('#tactic-cards').addEventListener('click',async event=>{
 const button=event.target.closest('[data-assign]');if(!button||!selectedAgent())return;
 const tactic=button.dataset.assign;if(!Object.hasOwn(STRATEGIES,tactic))return;
 roster=roster.map(a=>key(a)===selected?{...a,strategy:tactic}:a);scope='agent';await rosterChanged();
 $('#tactic-cards').querySelector(`[data-assign="${tactic}"]`)?.focus({preventScroll:true});
});
function renderInspector(){
 const a=selectedAgent();renderTactics(a);if(!a){$('#dna-details').innerHTML='<p>No active agents. Add an NFT to inspect its fixed DNA.</p>';return;}
 const p=a.profile,stat=(name,value,level,description)=>`<div class="dna-stat"><div><span>${name}</span><strong>${value}</strong></div><div class="stat-meter" aria-hidden="true">${Array.from({length:5},(_,i)=>`<i class="${i<level+2?'filled':''}"></i>`).join('')}</div><p>${description}</p></div>`;
 $('#dna-details').innerHTML=`<div class="dna-character">${avatar(a)}<div><h3>${p.name.toUpperCase()}</h3><p>${esc(label(a))}<br>${money(a.startEquity)} starting share</p></div></div>${stat('NERVE',p.risk.toFixed(3)+'%',p.levels[0],'Risk budget per trade: '+money(a.startEquity*p.risk/100)+' initially.')}${stat('REACH',`${Math.round((p.targetMultiplier-1)*100)>0?'+':''}${Math.round((p.targetMultiplier-1)*100)}%`,p.levels[1],'Distance from signal entry to target. Stops stay fixed.')}${stat('CARGO',p.allocation+'%',p.levels[2],'Maximum portion of this agent’s budget in a position.')}<p class="dna-hash">FIXED BUILD ${p.build} · SHA-256 ${p.hash.slice(0,12)}…<br>COLLECTION + TOKEN ID · SAME NFT, SAME STATS</p><p class="dna-outcome">This replay: <b>${money(a.result.stats.endEquity)}</b> with DNA / <b>${money(a.baseline.stats.endEquity)}</b> with default stats. ${a.result.stats.count} completed ${a.result.stats.count===1?'trade':'trades'}. Small samples are not a prediction.</p>`;
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
 $('#chart-title').textContent=scope==='pool'?'YOUR COMPANY, AT A GLANCE.':label(a).toUpperCase();
 $('#scope-banner').innerHTML=scope==='pool'?`<span class="scope-icon" aria-hidden="true">♛</span><div><b>WHOLE COMPANY</b><span>${company.agents.length} agents · $1,000 combined starting budget</span></div>`:`${avatar(a)}<div><b>${esc(label(a))}</b><span>${esc(a.profile.name)} · ${money(a.startEquity)} starting share</span></div><a href="#roster">CHANGE WHALE ↑</a>`;
 renderTradingStats(run);
 $('#chart-description').textContent=scope==='pool'?`${company.agents.length} agents share $1,000. Every curve is a reconstruction on the same old sample.`:`${STRATEGIES[a.strategy].name}. Same candles and starting share; only the DNA modifiers differ.`;
 $('#baseline-label').textContent=scope==='pool'?'Same crew, default stats':'Same agent, default stats';
 drawGraph(run,baseline,initial);
 $('#chart-comparison').textContent=`Final balance: DNA ${money(run.stats.endEquity)} · default stats ${money(baseline.stats.endEquity)} · difference ${money(run.stats.endEquity-baseline.stats.endEquity)}. DNA can help or hurt.`;
 const trades=scope==='pool'?company.trades:a.result.trades.map(t=>({...t,collection:a.collection,tokenId:a.tokenId}));
 $('#trade-rows').innerHTML=trades.length?trades.toReversed().map(t=>`<tr><td>${t.collection==='rarewhales'?'RW':'WS'} #${t.tokenId}</td><td>${stamp(t.entryTime)}</td><td>${stamp(t.exitTime)}</td><td class="${t.pnl>=0?'positive':'negative'}">${t.pnl>0?'+':''}${money(t.pnl)}</td><td>${esc(t.reason)}</td></tr>`).join(''):'<tr><td colspan="5">No completed trades in this replay.</td></tr>';
 $('#trade-note').textContent=`${scope==='pool'?'Whole company':label(a)} · ${trades.length} completed trades · ${run.skipped} entries skipped by execution checks. Some exits use a candle-close time proxy. CSV exports the whole company.`;
}
$('#chart-agent').addEventListener('change',e=>{scope=e.target.value==='pool'?'pool':'agent';if(scope==='agent')selected=e.target.value;renderAgents();renderInspector();renderScoreboard();renderOutfit();});
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{scope=button.dataset.view;renderScoreboard();});
$('#add-agent').addEventListener('click',()=>{$('#add-form').hidden=!$('#add-form').hidden;if(!$('#add-form').hidden)$('#add-token').focus();});
$('#cancel-add').addEventListener('click',()=>{$('#add-form').hidden=true;});
$('#add-form').addEventListener('submit',e=>{e.preventDefault();try{roster=validateRoster([...roster,{collection:$('#add-collection').value,tokenId:Number($('#add-token').value),strategy:'trend'}]);selected=key(roster.at(-1));scope='agent';$('#roster-message').textContent=`${label(roster.at(-1))} added to the sandbox. Ownership is checked when registering.`;$('#add-form').hidden=true;$('#add-token').value='';rosterChanged();}catch(error){$('#roster-message').textContent=error.message;}});
$('#download').addEventListener('click',()=>{
 if(!company)return;const fields=['collection','tokenId','strategy','entryTime','exitTime','entry','exit','qty','pnl','reason','exitTimePrecision'];
 const quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';
 const rows=company.trades.map(t=>fields.map(k=>quote(k.endsWith('Time')?new Date(t[k]).toISOString():t[k])).join(','));
 const blob=new Blob([[fields.join(','),...rows].join('\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='whale-pool-tactics-v1-historical-trades.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function updateRegistrationRoster(){
 const old=$('#captain').value;
 $('#captain').innerHTML=roster.map(a=>`<option value="${key(a)}">${esc(label(a))}</option>`).join('')+'<option value="founder">Founder · no NFT captain</option>';
 if([...$('#captain').options].some(o=>o.value===old))$('#captain').value=old;
 $('#registration-roster').textContent=roster.length?`${roster.length} agents · $1,000 shared equally (${money(1000/roster.length)} each). Every NFT must belong to the connected wallet.`:'No agents selected. A founder can register an empty company; its budget stays in cash.';
}
function renderClub(){
 if(!club)return;const me=club.me,seat=me?.seat;
 if(club.demo){
  $('#season-status').textContent='PREVIEW';$('#connect').textContent='EXPLORE WHAT’S NEXT';$('#connect').disabled=false;$('#logout').hidden=true;$('#seat-connect').hidden=true;$('#wallet-status').textContent='Registration is not open in this public demo.';$('#sign-in-note').textContent='Try every sandbox control without connecting a wallet. Your roster stays in this browser.';$('#seat-fields').disabled=true;$('#reserve').disabled=true;$('#registration-notice').textContent='Coming after the demo: approved promo 1/1s, founder access, future season dates and a working paper recorder. No wallet connection or NFT approval is needed today.';updateRegistrationRoster();return;
 }
 $('#season-status').textContent=club.season.status.toUpperCase();$('#connect').textContent=me?`${me.address.slice(0,6)}…${me.address.slice(-4)}`:'CONNECT WALLET';$('#connect').disabled=!!me;$('#logout').hidden=!me;$('#seat-connect').hidden=!!me;
 $('#wallet-status').textContent=me?`Owner wallet: ${me.address}`:'Sign in to prove control of your Robinhood wallet.';
 $('#seat-fields').disabled=!me;$('#reserve').disabled=!me||!club.registrationOpen;
 $('#registration-notice').textContent=club.registrationOpen?`Registration closes ${new Date(club.season.registrationClosesAt).toLocaleString('en-GB',{timeZone:'UTC'})} UTC. Your roster and tactics lock then.`:club.season.status==='draft'?'Registration is waiting for the approved 1/1 list, founder wallet, future dates and season recorder.':'Registration is closed. Company rosters and tactics are fixed.';
 $('#remove').hidden=!seat||!club.registrationOpen;$('#load-saved').hidden=!seat;
 if(seat)$('#nickname').value=seat.nickname;
 updateRegistrationRoster();
}
async function refreshClub(){club=await api('/api/club');renderClub();}
async function logout(){if(club)club.me=null;$('#seat-message').textContent='';$('#seat-form').reset();renderClub();try{await api('/api/auth/logout',{});}catch(e){message('Server sign-out failed. Reconnect before saving changes. '+e.message);}}
async function signIn(){
 if(club?.demo){location.hash='wax';return;}
 if(!club){message('The demo status is still loading. Please try again in a moment.');return;}
 if(busy)return;busy=true;message('');
 try{provider=window.ethereum;if(!provider?.request)throw Error('Open this prototype in a browser with a Robinhood-compatible wallet extension. The company sandbox works without a wallet.');
  if(provider.on&&!watchedProviders.has(provider)){provider.on('accountsChanged',logout);provider.on('chainChanged',logout);watchedProviders.add(provider);}
  const addresses=await provider.request({method:'eth_requestAccounts'});if(!addresses?.[0])throw Error('No wallet selected.');
  if(Number(await provider.request({method:'eth_chainId'}))!==CHAIN_ID)throw Error('Select Robinhood Chain in your wallet, then connect again.');
  const challenge=await api('/api/auth/challenge',{address:addresses[0]}),encoded='0x'+[...new TextEncoder().encode(challenge.message)].map(n=>n.toString(16).padStart(2,'0')).join('');
  const signature=await provider.request({method:'personal_sign',params:[encoded,addresses[0]]});
  const current=await provider.request({method:'eth_accounts'});if(current?.[0]?.toLowerCase()!==addresses[0].toLowerCase()||Number(await provider.request({method:'eth_chainId'}))!==CHAIN_ID)throw Error('The wallet changed during sign-in. Please reconnect.');
  await api('/api/auth/verify',{id:challenge.id,signature});await refreshClub();location.hash='seat';
 }catch(e){message(e.code===4001?'Wallet request cancelled. Nothing was registered.':e.message||'Wallet sign-in failed.');}finally{busy=false;}
}
$('#connect').addEventListener('click',signIn);$('#seat-connect').addEventListener('click',signIn);$('#logout').addEventListener('click',logout);
function seatInput(){const captain=roster.find(a=>key(a)===$('#captain').value);return {nickname:$('#nickname').value,collection:captain?.collection??null,tokenId:captain?.tokenId??null,strategy:captain?.strategy??'trend',publish:$('#publish').checked,agents:roster};}
async function seatAction(path){if(busy)return;busy=true;$('#seat-message').textContent='Checking wallet ownership on Robinhood…';$('#check').disabled=true;$('#reserve').disabled=true;try{const result=await api(path,seatInput());if(path==='/api/seat'){await refreshClub();$('#seat-message').textContent='Company and agent roster saved. Ownership and DNA were verified by the server.';}else $('#seat-message').textContent=result.eligible?`${result.label} verified${result.total!==undefined?` · ${result.total} qualifying NFTs`:''}. Every agent will be verified when saving.`:result.reason;}catch(e){$('#seat-message').textContent=e.message;}finally{busy=false;$('#check').disabled=false;$('#reserve').disabled=!club?.registrationOpen;}}
$('#check').addEventListener('click',()=>seatAction('/api/eligibility'));$('#seat-form').addEventListener('submit',e=>{e.preventDefault();seatAction('/api/seat');});
$('#load-saved').addEventListener('click',()=>{if(!club?.me?.seat)return;roster=validateRoster(club.me.seat.agents||[]);rosterChanged();$('#captain').value=club.me.seat.collection?`${club.me.seat.collection}:${club.me.seat.tokenId}`:'founder';$('#seat-message').textContent='Saved company roster loaded into the historical sandbox. Replaying old data does not change your registered company.';});
$('#remove').addEventListener('click',async()=>{try{await api('/api/seat',undefined,'DELETE');$('#seat-form').reset();await refreshClub();$('#seat-message').textContent='Company and roster withdrawn. You can register again while registration is open.';}catch(e){$('#seat-message').textContent=e.message;}});
async function loadCrew(){try{const data=await api('/api/crew');$('#crew-count').textContent=`${data.seats.length} ${data.seats.length===1?'COMPANY':'COMPANIES'}${data.seats.length===100?' (FIRST 100)':''}`;$('#crew-state').textContent=`SEASON ${data.status.toUpperCase()} · NO LIVE STANDINGS`;
 $('#crew-list').innerHTML=data.seats.length?data.seats.map(pool=>`<article class="crew-member panel"><div class="panel-title purple">${esc(pool.nickname)}<span>${pool.agents.length} AGENTS</span></div><div class="company-meta">One owner wallet · ${esc(pool.basis)} access<br>$1,000 shared starting budget · ownership checked on save<br>Season performance has not been recorded.</div><div class="crew-avatars">${pool.agents.map(a=>`<div class="crew-avatar">${avatar(a)}<span>#${a.tokenId} · ${esc(a.profile.name)}<br>${esc(STRATEGIES[a.strategy].kind)}</span></div>`).join('')}</div></article>`).join(''):'<div class="empty-state"><span>≈</span><h2>THE OCEAN IS OPEN.<br>THE COMPANIES ARE COMING.</h2><p>No pools are registered yet. The founding season is still in draft.<br>You can build and replay an example whale company right now.</p><a href="#practice" class="pixel-button yellow">BUILD A SANDBOX POOL →</a></div>';
 }catch(e){message(e.message);}}

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
 if(!chartState)return;const {points,x,y,H,top,bottom}=chartState;
 const point=points[Math.round(Number($('#replay-cursor').value)/100*(points.length-1))];
 $('#cursor-value').textContent=`${stamp(point.t)} UTC · ${money(point.equity)} paper equity`;
 $('#replay-cursor').setAttribute('aria-valuetext',$('#cursor-value').textContent);
 $('#chart-cursor').innerHTML=`<line x1="${x(point.t)}" x2="${x(point.t)}" y1="${top}" y2="${H-bottom}" stroke="#16233f" stroke-width="1.5" stroke-dasharray="3 4"/><circle cx="${x(point.t)}" cy="${y(point.equity)}" r="5" fill="#ffe06b" stroke="#16233f" stroke-width="2"/>`;
}
$('#replay-cursor').addEventListener('input',renderCursor);
$('#show-hold').addEventListener('change',renderScoreboard);
const equipmentCopy={surfboard:['THE SURFBOARD','Proposed: make collecting an eligible whale’s allowance easier. Automation needs gas and permission; no reward multiplier or trading boost.'],brick:['HOLY BRICK OF KEK','Neon green. Spiritually unreasonable. Proposed: an HQ trophy and saved roster preset. The brick does not reverse losses.'],crown:['CAPTAIN’S DRIP','Proposed: whale cosmetics and company banners. Royal vibes, exactly the same trading rules.']};
const equipmentArt={surfboard:'surfboard',brick:'holy-brick',crown:'captain-crown'};
function renderOutfit(){
 const a=selectedAgent();$('#outfit-agent').innerHTML=company?.agents.length?company.agents.map(a=>`<option value="${key(a)}">${esc(label(a))}</option>`).join(''):'<option>No whales in this roster</option>';$('#outfit-agent').disabled=!a;
 if(a)$('#outfit-agent').value=selected;
 $('#outfit-stage').className='outfit-stage outfit-'+equipment;
 $('#outfit-stage').innerHTML=a?`${avatar(a)}<span class="outfit-accessory" aria-hidden="true"><img src="${asset('/art/'+equipmentArt[equipment]+'.svg')}" alt=""></span><span class="outfit-name">${esc(label(a))}</span>`:'<p>Add a whale in Pool HQ to try an outfit.</p>';
 $('#outfit-title').textContent=equipmentCopy[equipment][0];$('#outfit-description').textContent=equipmentCopy[equipment][1];
 for(const b of document.querySelectorAll('[data-equipment]'))b.setAttribute('aria-pressed',String(b.dataset.equipment===equipment));
}
$('#outfit-agent').addEventListener('change',e=>{selected=e.target.value;scope='agent';renderAgents();renderInspector();renderScoreboard();renderOutfit();});
for(const b of document.querySelectorAll('[data-equipment]'))b.addEventListener('click',()=>{equipment=b.dataset.equipment;renderOutfit();});

updateRegistrationRoster();route();
Promise.allSettled([refreshClub(),fetch(asset('/practice.json')).then(r=>{if(!r.ok)throw Error('Historical data could not load.');return r.json();}).then(data=>{practice=data;return refreshCompany();})]).then(results=>{for(const r of results)if(r.status==='rejected')message(r.reason.message);});
