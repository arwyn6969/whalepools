import {backtest,summarize} from '../../../dist/engine.mjs';
import {STRATEGIES} from './config.mjs';
import {NEUTRAL_PROFILE,validateRoster,whaleDNA} from './dna.mjs';

// These are separately versioned development variants; the frozen engine is imported unchanged.
export function replayAgent(practice,strategy,profile=NEUTRAL_PROFILE,equity=1000){
 if(!practice.replay||!Object.hasOwn(STRATEGIES,strategy)||!Number.isFinite(equity)||equity<=0)throw Error('Invalid replay inputs.');
 if(![.225,.25,.275].includes(profile.risk)||![.95,1,1.05].includes(profile.targetMultiplier)||![22.5,25,27.5].includes(profile.allocation))throw Error('Unknown DNA settings.');
 const original=practice.replay.signals[strategy];
 const signals=original.map(s=>({...s,target:profile.targetMultiplier===1?s.target:s.entry+(s.target-s.entry)*profile.targetMultiplier}));
 const model={bars:practice.replay.bars,signals};
 return backtest(model,{...practice.settings,decimals:5,equity,risk:profile.risk,allocation:profile.allocation},1,model.bars.length);
}

export async function replayPool(practice,roster){
 const clean=validateRoster(roster);
 if(!clean.length)return {agents:[],curve:[],baseline:{curve:[],stats:{endEquity:1000}},stats:{count:0,pnl:0,returnPct:0,maxDrawdown:0,endEquity:1000},skipped:0,trades:[]};
 const equity=1000/clean.length;
 const agents=await Promise.all(clean.map(async a=>{
  const profile=await whaleDNA(a.collection,a.tokenId);
  return {...a,profile,startEquity:equity,result:replayAgent(practice,a.strategy,profile,equity),baseline:replayAgent(practice,a.strategy,NEUTRAL_PROFILE,equity)};
 }));
 const combine=field=>{
  const curve=agents[0][field].curve.map((p,i)=>({t:p.t,equity:agents.reduce((v,a)=>v+a[field].curve[i].equity,0)}));
  const trades=agents.flatMap(a=>a[field].trades.map(t=>({...t,collection:a.collection,tokenId:a.tokenId,strategy:a.strategy}))).sort((a,b)=>a.entryTime-b.entryTime);
  return {curve,trades,stats:summarize(trades,1000,curve),skipped:agents.reduce((s,a)=>s+a[field].skipped,0)};
 };
 return {...combine('result'),baseline:combine('baseline'),agents};
}
