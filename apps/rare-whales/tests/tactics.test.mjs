import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildSignals} from '../../../dist/engine.mjs';
import {buildTacticSignals} from '../src/tactics.mjs';
import {buildPractice} from '../src/practice.mjs';
import {replayAgent,replayPool} from '../src/pool.mjs';
import {NEUTRAL_PROFILE,whaleDNA} from '../src/dna.mjs';
import {STRATEGIES,TACTIC_VERSION} from '../src/config.mjs';

const fixture=()=>({bars:Array.from({length:201},(_,i)=>({t:i*3600000,T:(i+1)*3600000-1,o:99.5,c:100,h:100.5,l:99,atr:2,e50:98,up:true,vector:false})),states:Array.from({length:201},()=>({bias:'uptrend',contextStale:false}))});
function breakout(){const m=fixture();Object.assign(m.bars[200],{o:100,c:102.8,h:103,l:99.9,vector:true});return m;}
function magnet(){const m=fixture();Object.assign(m.bars[190],{o:110,c:106,h:110,l:97,up:false,vector:true});Object.assign(m.bars[200],{o:100,c:101,h:101.2,l:99.8});return m;}
test('Cannonball requires a vector breakout, top-quarter close and uptrend; target and stop use only known prices',()=>{
 const m=breakout(),s=buildTacticSignals(m,'breakout');assert.equal(s.length,1);assert.equal(s[0].stop,98.6);assert.equal(s[0].target,102.8+2*(102.8-98.6));assert.equal(s[0].t,m.bars[200].T+1);
 for(const update of [{vector:false},{up:false},{c:100.4},{h:108},{l:90}]){const n=breakout();Object.assign(n.bars[200],update);assert.equal(buildTacticSignals(n,'breakout').length,0);}
 const n=breakout();n.states[200].bias='mixed';assert.equal(buildTacticSignals(n,'breakout').length,0);
});
test('Vector Magnet uses nearest untouched red body midpoint; touches, old sources and downtrends reject',()=>{
 const m=magnet();Object.assign(m.bars[191],{o:108,c:106,h:108,l:98,up:false,vector:true});
 const s=buildTacticSignals(m,'magnet');assert.equal(s.length,1);assert.equal(s[0].target,107);assert.equal(s[0].stop,98.6);
 const touched=magnet();touched.bars[199].h=108;assert.equal(buildTacticSignals(touched,'magnet').length,0);
 const sameBar=magnet();sameBar.bars[200].h=108;assert.equal(buildTacticSignals(sameBar,'magnet').length,0);
 assert.equal(buildTacticSignals(magnet(),'magnet',{patternStart:191*3600000}).length,0);
 for(const update of [{c:100.4},{e50:102},{up:false}]){const n=magnet();Object.assign(n.bars[200],update);assert.equal(buildTacticSignals(n,'magnet').length,0);}
 const down=magnet();down.states[200].bias='downtrend';assert.equal(buildTacticSignals(down,'magnet').length,0);
 const mixed=magnet();mixed.states[200].bias='mixed';assert.equal(buildTacticSignals(mixed,'magnet').length,1);
});
test('both new arms reject stale context, bad ATR and lookbacks across a chart gap',()=>{
 for(const [mode,make] of [['breakout',breakout],['magnet',magnet]]){
  const stale=make();stale.states[200].contextStale=true;assert.equal(buildTacticSignals(stale,mode).length,0);
  const gap=make();gap.bars[195].t+=1;assert.equal(buildTacticSignals(gap,mode).length,0);
  for(const atr of [0,NaN,Infinity]){const bad=make();bad.bars[200].atr=atr;assert.equal(buildTacticSignals(bad,mode).length,0);}
  assert.equal(buildTacticSignals(make(),mode,{patternStart:201*3600000}).length,0);
 }
});
const load=async p=>JSON.parse(await readFile(new URL('../../../'+p,import.meta.url)));
test('new signal generation is causal on real fixtures including closed 4h context',async()=>{
 const bars=await load('research/data/UBTC-1h.json'),context=await load('research/data/UBTC-4h.json'),protocol=await load('dist/protocol.json'),patternStart=Date.parse(protocol.historicalStart);
 const original=buildSignals(bars,context,'trend',{patternStart}),cut=Math.floor(bars.length*.8),prefix=buildSignals(bars.slice(0,cut),context.filter(b=>b.T<=bars[cut-1].T),'trend',{patternStart});
 for(const mode of ['breakout','magnet'])assert.deepEqual(buildTacticSignals(prefix,mode,{patternStart}),buildTacticSignals(original,mode,{patternStart}).filter(s=>s.i<cut));
 const future=structuredClone(bars);for(let i=cut;i<future.length;i++){future[i].o*=2;future[i].h*=2;future[i].l*=2;future[i].c*=2;future[i].v*=20;}
 const changed=buildSignals(future,context,'trend',{patternStart});
 for(const mode of ['breakout','magnet'])assert.deepEqual(buildTacticSignals(changed,mode,{patternStart}).filter(s=>s.i<cut),buildTacticSignals(original,mode,{patternStart}).filter(s=>s.i<cut));
});
test('all four neutral replays reproduce their complete paths; a mixed collection crew retains one budget',async()=>{
 const data=buildPractice({bars:await load('research/data/UBTC-1h.json'),context:await load('research/data/UBTC-4h.json'),protocol:await load('dist/protocol.json'),sourceHashes:{}});
 assert.equal(data.tacticVersion,TACTIC_VERSION);
 for(const id of Object.keys(STRATEGIES)){
  const r=replayAgent(data,id,NEUTRAL_PROFILE);assert.deepEqual(r.trades,data.strategies[id].trades);assert.deepEqual(r.curve,data.strategies[id].curve);assert.deepEqual(r.stats,data.strategies[id].stats);
  assert.ok(r.trades.every(t=>t.entryTime>=data.from&&t.exitTime<=data.until&&Number.isFinite(t.pnl)));
 }
 const roster=[{collection:'rarewhales',tokenId:245,strategy:'trend'},{collection:'rarewhales',tokenId:246,strategy:'recovery'},{collection:'whalestreet',tokenId:1,strategy:'breakout'},{collection:'rarewhales',tokenId:248,strategy:'magnet'}];
 const pool=await replayPool(data,roster);assert.equal(pool.agents.reduce((s,a)=>s+a.startEquity,0),1000);assert.deepEqual(pool.agents[2].profile,await whaleDNA('whalestreet',1));assert.equal(pool.stats.count,pool.agents.reduce((s,a)=>s+a.result.stats.count,0));
 assert.deepEqual(await replayPool(data,roster),pool);
});
