import {requestJSON,boundedRequest} from './request.mjs';
import {companyId,companyURL,companyCard} from './company-share.mjs';
import {createPilot} from './pilot.mjs';
import {evaluateChallenge} from '../src/challenge.mjs';
import {validateRoster} from '../src/dna.mjs';
import {COLLECTIONS,STRATEGIES} from '../src/config.mjs';
const $=s=>document.querySelector(s),key=a=>`${a.collection}:${a.tokenId}`;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const percent=n=>`${n>=0?'+':''}${n.toFixed(2)}%`,stamp=t=>new Date(t).toISOString().slice(0,16).replace('T',' ');
function download(value,type,name){const url=URL.createObjectURL(new Blob([value],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const storage={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v),removeItem:k=>localStorage.removeItem(k)};

export function installNextSprint({asset,api,avatar,hydrateArt,privateResult,inspectCompany,walletReady}){
 const pilot=createPilot(storage);let publicData=null,publicEpoch=0,publicController,challenge=null,challengePromise,choices=[],best=null,challengeKey;
 const pilotEvent=type=>{pilot.record(type);renderPilot();};
 function renderPilot(){
  const {state,unavailable}=pilot.status();$('#pilot-start').hidden=!!state;$('#pilot-report-controls').hidden=!state;$('#pilot-code').disabled=!!state;
  $('#pilot-assistance').checked=state?.assisted??false;$('#pilot-stop').disabled=!state?.active;
  $('#pilot-status').textContent=unavailable?'Browser storage is unavailable. Reports may not survive a reload; the arcade still works.':state?`${state.code} · ${state.events.length>=500?'report full; export it':state.active?'recording':'stopped'} · ${state.events.length} ${state.events.length===1?'event':'events'} · expires ${stamp(state.expiresAt)} UTC. Export before erasing or changing browsers.`:'Recording is off. Join only if the pilot organiser assigned you a participant code.';
 }
 $('#pilot-start').addEventListener('click',()=>{try{pilot.start($('#pilot-code').value);const ready=walletReady();if(ready.ready)pilot.record(ready.published?'wallet_ready_existing':'wallet_ready_new');renderPilot();}catch(e){$('#pilot-status').textContent=e.message;}});
 $('#pilot-assistance').addEventListener('change',e=>{pilot.assistance(e.target.checked);renderPilot();});
 $('#pilot-stop').addEventListener('click',()=>{pilot.stop();renderPilot();});
 $('#pilot-erase').addEventListener('click',()=>{pilot.erase();renderPilot();});
 $('#pilot-export').addEventListener('click',()=>{try{const report=pilot.report();download(JSON.stringify(report,null,2),'application/json',`whale-pools-${report.code}.json`);}catch(e){$('#pilot-status').textContent=e.message;}});
 renderPilot();

 function cancelCompany(){publicEpoch++;publicController?.abort();}
 async function openCompany(id){
  cancelCompany();const epoch=publicEpoch;publicController=new AbortController();publicData=null;$('#public-company-content').replaceChildren();$('#company-actions').hidden=true;$('#company-message').textContent='Loading the published company…';$('#company-retry').hidden=true;
  if(!companyId(id)){$('#company-message').textContent='This public company link is invalid. Open a company from the leaderboard.';return;}
  try{
   const data=await api('/api/company/'+id,undefined,'GET',publicController.signal);if(epoch!==publicEpoch)return;publicData=data;const c=data.company,s=c.stats,a=data.arcade;
   $('#company-message').textContent='Latest public crew. The owner can edit it; withdrawal removes this destination.';
   $('#public-company-content').innerHTML=`<div class="panel-title purple"><span>${esc(c.nickname)}</span><span>#${c.rank} ON THE BOARD</span></div><div class="share-card-body"><p class="eyebrow">HISTORICAL PAPER SCORE · $1,000 STARTING BUDGET</p><div class="board-metrics"><div><span>NET RETURN</span><strong>${percent(s.returnPct)}</strong></div><div><span>MAX DRAWDOWN</span><strong>${s.maxDrawdown.toFixed(2)}%</strong></div><div><span>TRADES</span><strong>${s.count}</strong></div></div><p>UBTC / USDC · Hyperliquid spot<br>${stamp(a.from)} — ${stamp(a.until)} UTC (end exclusive)</p><p>Ownership checked ${stamp(c.updatedAt)} UTC · block ${esc(c.ownershipBlock)}<br>Owner <a href="https://robinhoodchain.blockscout.com/address/${esc(c.owner)}" target="_blank" rel="noopener">${esc(c.owner)}</a></p><div class="crew-avatars">${c.agents.map(agent=>`<div class="crew-avatar">${avatar(agent)}<span>${esc(COLLECTIONS[agent.collection].name)} #${agent.tokenId}<br>${esc(STRATEGIES[agent.strategy].name)}</span></div>`).join('')}</div><p class="muted">Reconstructed results on inspected history. No live trades, rewards or evidence of trading skill. Ownership was checked when publishing.</p><details><summary>EXACT HISTORICAL RULES VERSION</summary><p class="version-hash">${esc(a.ruleHash)}</p><p>DNA v1. Shares this company's current public crew, never its owner's private draft.</p></details></div>`;
   hydrateArt($('#public-company-content'));$('#company-link').value=companyURL(location.href,c.id);$('#company-actions').hidden=false;$('#company-compare-result').replaceChildren();
  }catch(e){if(epoch!==publicEpoch||e.name==='AbortError')return;$('#company-message').textContent=e.message;$('#company-retry').hidden=e.status===404;}
 }
 $('#company-retry').addEventListener('click',()=>openCompany(location.hash.slice('#company/'.length)));
 $('#company-copy').addEventListener('click',async()=>{try{await boundedRequest(()=>navigator.clipboard.writeText($('#company-link').value),{timeoutMs:5000});$('#company-message').textContent='Public company link copied. Your private crew is kept.';pilotEvent('company_shared');}catch{$('#company-link').focus();$('#company-link').select();$('#company-message').textContent='Copy the selected link using your browser. The link shares only the published crew.';}});
 $('#company-card').addEventListener('click',()=>{if(!publicData)return;try{download(companyCard(publicData.company,publicData.arcade,$('#company-link').value),'image/svg+xml',`whale-pools-${publicData.company.id}.svg`);pilotEvent('company_shared');$('#company-message').textContent='Card downloaded with its historical date and rules version. The link shows the latest published crew.';}catch(e){$('#company-message').textContent=e.message;}});
 $('#company-replay').addEventListener('click',()=>{if(publicData)inspectCompany(publicData.company);});
 $('#company-compare').addEventListener('click',()=>{
  if(!publicData)return;const own=privateResult();if(!own?.stats){$('#company-compare-result').textContent='Return to your crew and let its replay finish, then compare again.';return;}
  const other=publicData.company;
  $('#company-compare-result').innerHTML=`<div class="table-scroll"><table><caption>Same historical sample and $1,000 paper budget. Your draft stays private.</caption><thead><tr><th>Company</th><th>Net return</th><th>Drawdown</th><th>Trades</th></tr></thead><tbody>${[['Your private crew',own.stats],[other.nickname,other.stats]].map(([name,s])=>`<tr><th>${esc(name)}</th><td>${percent(s.returnPct)}</td><td>${s.maxDrawdown.toFixed(2)}%</td><td>${s.count}</td></tr>`).join('')}</tbody></table></div><p class="muted">Different crews can trade the same market together. A higher old score does not establish greater skill.</p>`;
 });

 async function loadChallenge(){
  if(challenge)return;
  if(challengePromise)return challengePromise;
  $('#challenge-message').textContent='Loading the separate historical challenge…';$('#challenge-retry').hidden=true;
  challengePromise=(async()=>{try{
   challenge=await requestJSON(asset('/challenge.json'));challengeKey='whale-pools-challenge:'+challenge.rules.id+':'+challenge.ruleHash;
   try{const saved=JSON.parse(storage.getItem(challengeKey)||'null');if(saved){choices=validateRoster(saved.choices);if(choices.length>3||choices.some(a=>!challenge.rules.loaners.some(l=>key(l)===key(a))))throw Error();if(saved.best){const evaluated=evaluateChallenge(challenge,saved.best);if(evaluated.cleared)best=evaluated;}}}catch{choices=[];best=null;}
   $('#challenge-version').textContent=challenge.rules.id;
   $('#challenge-brief').textContent=challenge.rules.objective+' Each episode resets the $1,000 budget, split equally. No wallet or ownership needed.';
   $('#challenge-episodes').innerHTML=challenge.episodes.map(e=>`<article><h3>${esc(e.title)}</h3><p>${stamp(e.from)} — ${stamp(e.until)} UTC<br>Market price change ${percent(e.marketReturn)}</p></article>`).join('');
   $('#challenge-analysis').textContent=`All ${challenge.analysis.legalChoices.toLocaleString()} legal choices were enumerated; ${challenge.analysis.cleared} clear the brief. ${challenge.analysis.bestTies} choices tie for the best lower-episode return. ${challenge.analysis.universalDominators} choices dominate every other choice on return and drawdown in both episodes. The best 50 use ${Object.entries(challenge.analysis.top50Tactics).map(([id,n])=>`${STRATEGIES[id].name}: ${n}`).join(', ')} assignments. This prototype needs player feedback; enumeration does not establish balance or trading skill.`;
   $('#challenge-hash').textContent=challenge.ruleHash;renderChallenge();$('#challenge-message').textContent='Choose three loaners, assign tactics, then run both episodes. Your company draft stays separate.';
  }catch(e){challenge=null;$('#challenge-message').textContent='Challenge unavailable. '+e.message;$('#challenge-retry').hidden=false;}finally{challengePromise=null;}})();return challengePromise;
 }
 function renderChallenge(){
  const focused=document.activeElement,focusKey=focused?.dataset?.loaner||focused?.dataset?.challengeTactic,focusType=focused?.dataset?.loaner?'data-loaner':'data-challenge-tactic';
  if(!challenge)return;$('#challenge-progress').textContent=`${choices.length}/3 loaners chosen · ${best?`best lower-episode return ${percent(best.worstReturn)}`:'no cleared attempt yet'}`;$('#challenge-run').disabled=choices.length!==3;
  $('#challenge-loaners').innerHTML=challenge.loaners.map(a=>{const chosen=choices.find(c=>key(c)===key(a));return `<article class="challenge-loaner panel"><div class="challenge-portrait">${avatar(a)}</div><div><h3>${esc(COLLECTIONS[a.collection].name)} #${a.tokenId}</h3><p>${esc(a.profile.name)} · DNA v1</p><label class="consent"><input type="checkbox" data-loaner="${key(a)}" ${chosen?'checked':''} ${!chosen&&choices.length===3?'disabled':''}> Choose loaner</label><label>Tactic<select data-challenge-tactic="${key(a)}" ${!chosen?'disabled':''}>${Object.entries(STRATEGIES).map(([id,t])=>`<option value="${id}" ${chosen?.strategy===id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label></div></article>`;}).join('');hydrateArt($('#challenge-loaners'));
  if(focusKey)$('#challenge-loaners').querySelector(`[${focusType}="${CSS.escape(focusKey)}"]`)?.focus();
 }
 function saveChallenge(){try{storage.setItem(challengeKey,JSON.stringify({choices,best:best?.roster??null}));}catch{$('#challenge-message').textContent='Browser storage is unavailable. You can play, but this challenge draft may not survive a reload.';}}
 $('#challenge-loaners').addEventListener('change',e=>{
  if(!challenge)return;const id=e.target.dataset.loaner||e.target.dataset.challengeTactic;if(!id)return;$('#challenge-result').replaceChildren();
  if(e.target.dataset.loaner){if(e.target.checked&&choices.length<3){const a=challenge.rules.loaners.find(a=>key(a)===id);if(a)choices.push({...a,strategy:'trend'});}else choices=choices.filter(a=>key(a)!==id);}else choices=choices.map(a=>key(a)===id?{...a,strategy:e.target.value}:a);
  saveChallenge();renderChallenge();
 });
 $('#challenge-run').addEventListener('click',()=>{
  if(!challenge)return;try{const result=evaluateChallenge(challenge,choices);if(result.cleared&&(!best||result.worstReturn>best.worstReturn))best=result;saveChallenge();
   $('#challenge-result').innerHTML=`<div class="panel-title ${result.cleared?'yellow':'pink'}">${result.cleared?'RISK BRIEF CLEARED':'KEEP EXPLORING'}</div><div class="share-card-body"><h3>Lower episode return: ${percent(result.worstReturn)}</h3><div class="challenge-episodes">${result.episodes.map(e=>`<article><h3>${esc(e.title)}</h3><p>${percent(e.stats.returnPct)} net return<br>${e.stats.maxDrawdown.toFixed(3)}% drawdown · ${e.stats.count} ${e.stats.count===1?'trade':'trades'}</p><strong>${!e.stats.count?'Needs a completed trade':e.stats.maxDrawdown>challenge.rules.maxDrawdown?'Over the drawdown limit':'Within the risk brief'}</strong></article>`).join('')}</div><p>Try changing one tactic. Protect both episodes, then improve the weaker return. This is inspected history; these choices do not publish or edit your company.</p></div>`;pilotEvent('challenge_completed');renderChallenge();
  }catch(e){$('#challenge-message').textContent=e.message;}
 });
 $('#challenge-retry').addEventListener('click',loadChallenge);
 return {openCompany,cancelCompany,loadChallenge,pilotEvent};
}
