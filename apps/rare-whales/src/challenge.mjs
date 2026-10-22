import {summarize} from '../../../dist/engine.mjs';
import {replayAgent} from './pool.mjs';
import {whaleDNA,validateRoster} from './dna.mjs';
import {STRATEGIES} from './config.mjs';

// A separate, declared game. Nothing here changes the historical company board.
export const CHALLENGE_RULES={id:'tidal-trio-v1',title:'The Tidal Trio',size:3,budget:1000,maxDrawdown:0.25,
 loaners:[{collection:'rarewhales',tokenId:245},{collection:'rarewhales',tokenId:246},{collection:'rarewhales',tokenId:247},{collection:'rarewhales',tokenId:248},{collection:'whalestreet',tokenId:1},{collection:'whalestreet',tokenId:2}],
 episodes:[{id:'early',title:'Early tide',from:Date.parse('2026-07-24T10:00:00Z'),until:Date.parse('2026-08-22T00:00:00Z')},{id:'later',title:'Later tide',from:Date.parse('2026-08-22T00:00:00Z'),until:Date.parse('2026-09-19T22:00:00Z')}],
 objective:'Complete at least one trade in each episode, keep each drawdown at or below 0.25%, then improve your lower episode return.'};
const key=a=>`${a.collection}:${a.tokenId}`;
const stats=({endEquity,pnl,returnPct,maxDrawdown,count,winRate})=>({endEquity,pnl,returnPct,maxDrawdown,count,winRate});

export function episodePractice(practice,episode){
 const bars=practice.replay.bars,start=bars.findIndex(b=>b.t>=episode.from),end=bars.findIndex(b=>b.t>=episode.until),stop=end<0?bars.length:end;
 if(start<1||stop<=start||episode.from<practice.from||episode.until>practice.until)throw Error('Challenge episode is outside the frozen sample.');
 return {...practice,from:episode.from,until:episode.until,replay:{bars:bars.slice(start-1,stop),signals:Object.fromEntries(Object.entries(practice.replay.signals).map(([id,signals])=>[id,signals.filter(s=>s.i>=start&&s.i<stop).map(s=>({...s,i:s.i-start+1}))]))}};
}
export function challengeRoster(data,roster){
 const clean=validateRoster(roster).sort((a,b)=>a.collection.localeCompare(b.collection)||a.tokenId-b.tokenId);
 if(clean.length!==data.rules.size||clean.some(a=>!data.rules.loaners.some(l=>key(l)===key(a))))throw Error('Choose exactly three different whales from the six loaners.');
 return clean;
}
export function evaluateChallenge(data,roster){
 const clean=challengeRoster(data,roster);
 const episodes=data.episodes.map(episode=>{
  const runs=clean.map(a=>episode.runs[`${key(a)}:${a.strategy}`]);
  if(runs.some(r=>!r))throw Error('This challenge version is unavailable.');
  const indices=[...new Set(runs.flatMap(r=>r.curve.map(p=>p[0])))].sort((a,b)=>a-b),positions=runs.map(()=>0);
  const curve=indices.map(index=>({equity:runs.reduce((sum,run,i)=>{while(positions[i]+1<run.curve.length&&run.curve[positions[i]+1][0]<=index)positions[i]++;return sum+run.curve[positions[i]][1];},0)}));
  const trades=runs.flatMap(r=>r.trades).sort((a,b)=>a.entryTime-b.entryTime);
  return {id:episode.id,title:episode.title,from:episode.from,until:episode.until,stats:stats(summarize(trades,data.rules.budget,curve))};
 });
 const cleared=episodes.every(e=>e.stats.maxDrawdown<=data.rules.maxDrawdown&&e.stats.count>0);
 return {version:data.rules.id,roster:clean,episodes,cleared,worstReturn:Math.min(...episodes.map(e=>e.stats.returnPct))};
}
export function enumerateChallenge(data){
 const choices=[],loaners=data.rules.loaners,tactics=Object.keys(STRATEGIES);
 for(let a=0;a<loaners.length-2;a++)for(let b=a+1;b<loaners.length-1;b++)for(let c=b+1;c<loaners.length;c++)for(const x of tactics)for(const y of tactics)for(const z of tactics)choices.push(evaluateChallenge(data,[{...loaners[a],strategy:x},{...loaners[b],strategy:y},{...loaners[c],strategy:z}]));
 return choices;
}
export async function buildChallenge(practice){
 const rules=structuredClone(CHALLENGE_RULES),loaners=await Promise.all(rules.loaners.map(async a=>({...a,profile:await whaleDNA(a.collection,a.tokenId)})));
 const episodes=rules.episodes.map(episode=>{
  const sample=episodePractice(practice,episode),runs={};
  for(const a of loaners)for(const tactic of Object.keys(STRATEGIES)){
   const run=replayAgent(sample,tactic,a.profile,rules.budget/rules.size);
   runs[`${key(a)}:${tactic}`]={curve:run.curve.flatMap((p,i,c)=>i===0||p.equity!==c[i-1].equity?[[i,p.equity]]:[]),trades:run.trades.map(({pnl,r,entryTime})=>({pnl,r,entryTime}))};
  }
  return {...episode,marketReturn:(sample.replay.bars.at(-1).c/sample.replay.bars[1].o-1)*100,runs};
 });
 const data={rules,loaners,episodes,sourceHashes:practice.sourceHashes},choices=enumerateChallenge(data),cleared=choices.filter(c=>c.cleared).sort((a,b)=>b.worstReturn-a.worstReturn),best=cleared[0];
 const episodeBest=episodes.map((_,i)=>Math.max(...choices.map(c=>c.episodes[i].stats.returnPct)));
 const dominators=choices.filter(c=>choices.every(other=>c.episodes.every((e,i)=>e.stats.returnPct>=other.episodes[i].stats.returnPct-1e-10&&e.stats.maxDrawdown<=other.episodes[i].stats.maxDrawdown+1e-10)));
 data.analysis={legalChoices:choices.length,cleared:cleared.length,bestWorstReturn:best?.worstReturn??null,bestTies:cleared.filter(c=>Math.abs(c.worstReturn-best.worstReturn)<1e-10).length,episodeBest,universalDominators:dominators.length,top50Tactics:Object.fromEntries(Object.keys(STRATEGIES).map(t=>[t,cleared.slice(0,50).flatMap(c=>c.roster).filter(a=>a.strategy===t).length]))};
 return data;
}
