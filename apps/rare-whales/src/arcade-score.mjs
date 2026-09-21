import {summarize} from '../../../dist/engine.mjs';
import {replayAgent} from './pool.mjs';
import {validateRoster,whaleDNA} from './dna.mjs';
import {STRATEGIES} from './config.mjs';

export function buildArcadeScores(practice){
 const runs={};
 for(let n=1;n<=12;n++)for(let risk=0;risk<3;risk++)for(let target=0;target<3;target++)for(let allocation=0;allocation<3;allocation++)for(const tactic of Object.keys(STRATEGIES)){
  const profile={risk:[.225,.25,.275][risk],targetMultiplier:[.95,1,1.05][target],allocation:[22.5,25,27.5][allocation]},run=replayAgent(practice,tactic,profile,1000/n);
  runs[`${n}:${risk}-${target}-${allocation}:${tactic}`]={curve:run.curve.flatMap((p,i,c)=>i===0||p.equity!==c[i-1].equity?[[i,p.equity]]:[]),trades:run.trades.map(({pnl,r,entryTime})=>({pnl,r,entryTime})),skipped:run.skipped};
 }
 return {version:1,from:practice.from,until:practice.until,sourceHashes:practice.sourceHashes,runs};
}
export async function scoreArcade(scores,roster){
 const agents=validateRoster(roster).sort((a,b)=>a.collection.localeCompare(b.collection)||a.tokenId-b.tokenId);
 if(!agents.length)throw Error('Add at least one owned whale to publish a score.');
 const profiles=await Promise.all(agents.map(a=>whaleDNA(a.collection,a.tokenId)));
 const runs=agents.map((a,i)=>scores.runs[`${agents.length}:${profiles[i].build}:${a.strategy}`]);
 if(runs.some(r=>!r))throw Error('This score version is unavailable.');
 const indices=[...new Set(runs.flatMap(r=>r.curve.map(p=>p[0])))].sort((a,b)=>a-b),positions=runs.map(()=>0);
 const curve=indices.map(index=>({equity:runs.reduce((sum,run,i)=>{while(positions[i]+1<run.curve.length&&run.curve[positions[i]+1][0]<=index)positions[i]++;return sum+run.curve[positions[i]][1];},0)}));
 const trades=runs.flatMap(r=>r.trades).sort((a,b)=>a.entryTime-b.entryTime),stats=summarize(trades,1000,curve);
 const publicStats=({endEquity,pnl,returnPct,maxDrawdown,count,winRate})=>({endEquity,pnl,returnPct,maxDrawdown,count,winRate});
 return {stats:publicStats(stats),rankScore:Math.round(stats.returnPct*1e6),agents:agents.map((a,i)=>({...a,profile:profiles[i],stats:publicStats(summarize(runs[i].trades,1000/agents.length,runs[i].curve.map(p=>({equity:p[1]}))))}))};
}
