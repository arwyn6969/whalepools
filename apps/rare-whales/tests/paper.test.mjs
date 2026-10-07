import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {database} from '../scripts/database.mjs';
import {PAPER_RULES as R,initialState,stepPaper,signal} from '../src/paper-engine.mjs';
import {tickPaper,createPaperService} from '../src/paper-service.mjs';
import {readPaperMarket} from '../src/paper-feed.mjs';
import {NEUTRAL_PROFILE} from '../src/dna.mjs';
import {CHAIN_ID} from '../src/config.mjs';
const season=JSON.parse(await readFile(new URL('../arcade.json',import.meta.url)));
const hash='a'.repeat(64),address='0x'+'1'.repeat(40),agent={collection:'rarewhales',tokenId:245,preset:'trend',profile:NEUTRAL_PROFILE};
const base=Date.UTC(2026,9,7,12),candle=(t,p=100)=>({t,o:p,h:p+0.1,l:p-0.1,c:p,observed_at:t+R.interval+1000,fresh:1});
const rising=t=>Array.from({length:100},(_,i)=>candle(t-(99-i)*R.interval,100+i));
const marketAt=t=>async()=>({coin:'@1',bars:rising(t).map(b=>{const p=199+(b.t-base)/R.interval;return {t:b.t,o:p,h:p+0.1,l:p-0.1,c:p};})});
const client={getChainId:async()=>CHAIN_ID,getBlockNumber:async()=>100n,readContract:async({functionName,args})=>functionName==='balanceOf'?1n:args[0]===245n?address:'0x'+'2'.repeat(40)};
const payload=()=>({wallet:address,agents:[{collection:'rarewhales',tokenId:245}],preset:'balanced',nickname:'Test Watch',publish:true,rulesHash:hash,mutationId:crypto.randomUUID()});
const start=(service,db,data=payload())=>service.handle({db,me:{address},env:{PAPER_ENABLED:'1'},request:new Request('https://test.invalid/api/paper/start',{method:'POST'}),data});
test('presets are causal, reject discontinuous warmup and have distinct rules',()=>{
 const bars=rising(base);assert.equal(signal('trend',bars).buy,true);assert.equal(signal('breakout',bars).buy,true);assert.equal(signal('recovery',bars).buy,false);
 assert.equal(signal('trend',bars.slice(-20)).buy,false);bars[80].t-=R.interval;assert.match(signal('trend',bars).reason,/continuous/);
});
test('a signal queues an order; only the following observed close can fill',()=>{
 const bars=rising(base),first=bars.at(-1),s=initialState([agent],base-R.interval,base-R.interval);
 const a=stepPaper(s,first,bars,base+R.interval+1000);assert.equal(a.events.length,0);assert.equal(a.state.agents[0].pending.side,'buy');
 const next=candle(base+R.interval,200),b=stepPaper(a.state,next,[...bars,next],next.observed_at);
 assert.equal(b.events.length,1);assert.equal(b.events[0].kind,'buy');assert.equal(b.events[0].price,200*(1+R.slippage));assert.equal(b.events[0].signalAt,first.observed_at);assert.ok(b.state.agents[0].cash>0);
 assert.deepEqual(stepPaper(b.state,next,[...bars,next],next.observed_at).state,b.state);
});
test('backfill, stale execution and discontinuities cannot fill a queued order',()=>{
 const bars=rising(base),s=initialState([agent],base-R.interval,base-R.interval),queued=stepPaper(s,bars.at(-1),bars,base+R.interval+1000).state;
 for(const [bar,now] of [[{...candle(base+R.interval),fresh:0},base+2*R.interval+1000],[candle(base+R.interval),base+2*R.interval+R.maxDelay+1],[candle(base+2*R.interval),base+3*R.interval+1000]]){
  const r=stepPaper(queued,bar,[...bars,bar],now);assert.equal(r.events.length,0);assert.equal(r.state.agents[0].qty,0);assert.equal(r.state.agents[0].pending,null);assert.equal(r.state.gapBars,1);
 }
});
test('sell orders include fees and retain the original signal time',()=>{
 const s=initialState([agent],base-R.interval,base-R.interval);Object.assign(s.agents[0],{qty:1,cash:800,cost:200,entry:200,stop:190,target:220,pending:{side:'sell',at:base,reason:'Stop'}});
 const bar=candle(base,180),r=stepPaper(s,bar,rising(base),bar.observed_at);
 assert.equal(r.events[0].kind,'sell');assert.ok(r.events[0].pnl<-20);assert.equal(r.state.agents[0].qty,0);assert.equal(r.state.agents[0].tradeCount,1);assert.ok(r.state.maxDrawdown>0);
});
test('recorder restart persists observations and never repeats a fill',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'whale-paper-')),file=path.join(dir,'paper.sqlite');let db=database(file);
 try{
  await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+R.interval+1000,market:marketAt(base)});
  await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+2*R.interval+1000,market:marketAt(base+R.interval)});
  await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+3*R.interval+1000,market:marketAt(base+2*R.interval)});
  const before=(await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events').first()).n;assert.ok(before>0);db.close();db=database(file);
  await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+3*R.interval+2000,market:marketAt(base+2*R.interval)});
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events').first()).n,before);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_runs').first()).n,3);
 }finally{db.close();await rm(dir,{recursive:true,force:true});}
});
test('concurrent ticks acquire one lease and keep first-observed candles immutable',async()=>{
 const db=database();try{
  const results=await Promise.all([1,2].map(()=>tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+R.interval+1000,market:marketAt(base)})));assert.equal(results.filter(r=>r.busy).length,1);
  const old=await db.prepare('SELECT * FROM wp_paper_bars WHERE t=?').bind(base).first();
  const result=await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+R.interval+2000,market:async()=>({coin:'@1',bars:[{...candle(base),c:999}]})});assert.match(result.error,/revised/);assert.equal((await db.prepare('SELECT c FROM wp_paper_bars WHERE t=?').bind(base).first()).c,old.c);assert.equal((await db.prepare('SELECT halted FROM wp_paper_feed').first()).halted,1);
 }finally{db.close();}
});
test('provider errors recover without deleting records or claiming catch-up fills',async()=>{
 const db=database();try{
  await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+R.interval+1000,market:marketAt(base)});
  const failed=await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+2*R.interval+1000,market:async()=>{throw Error('fixture outage');}});assert.match(failed.error,/outage/);
  await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+5*R.interval+1000,market:marketAt(base+4*R.interval)});
  assert.equal((await db.prepare('SELECT error FROM wp_paper_feed').first()).error,null);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events').first()).n,0);
 }finally{db.close();}
});
test('owned company start is idempotent, locked and checks every NFT',async()=>{
 const db=database();try{
  await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+R.interval+1000,market:marketAt(base)});
  const service=createPaperService({season,client,rulesHash:hash,now:()=>base+R.interval+2000}),input=payload(),first=await start(service,db,input);
  assert.equal((await start(service,db,input)).run.id,first.run.id);assert.equal(first.run.agents.length,1);
  await assert.rejects(start(service,db,{...input,nickname:'Changed'}),e=>e.status===409);
  await assert.rejects(start(service,db,payload()),e=>e.status===409);
  const publicData=await service.read({db,env:{PAPER_ENABLED:'1'},id:first.run.id});assert.equal(publicData.run.owner,address);assert.equal('mutationId' in publicData.run,false);assert.equal('input_json' in publicData.run,false);
  await service.handle({db,me:{address},env:{PAPER_ENABLED:'1'},request:new Request('https://test.invalid/api/paper/stop',{method:'POST'}),data:{wallet:address,id:first.run.id}});
  await assert.rejects(start(service,db,{...payload(),agents:[{collection:'rarewhales',tokenId:245},{collection:'rarewhales',tokenId:246}]}),e=>e.status===403);
  assert.notEqual((await start(service,db,payload())).run.id,first.run.id);
 }finally{db.close();}
});
test('wallet switches, stale rules, missing consent and recorder recovery refuse starts',async()=>{
 const db=database(),service=createPaperService({season,client,rulesHash:hash,now:()=>base});try{
  for(const patch of [{wallet:'0x'+'2'.repeat(40)},{rulesHash:'old'},{publish:false}])await assert.rejects(start(service,db,{...payload(),...patch}),e=>[400,409].includes(e.status));
  await assert.rejects(start(service,db,payload()),e=>e.status===503);
  assert.deepEqual(await tickPaper({DB:db},{rulesHash:hash}),{disabled:true});
 }finally{db.close();}
});
test('a stop racing an executor commit cannot be overwritten or append ghost fills',async()=>{
 const db=database();try{
  await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+R.interval+1000,market:marketAt(base)});
  const service=createPaperService({season,client,rulesHash:hash,now:()=>base+R.interval+2000}),run=(await start(service,db)).run;
  await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+2*R.interval+1000,market:marketAt(base+R.interval)});
  const wrapper={...db,prepare(query){const stmt=db.prepare(query);stmt.testQuery=query;return stmt;},async batch(statements){if(statements[0].testQuery?.startsWith('UPDATE wp_paper_runs SET state_json'))await db.prepare("UPDATE wp_paper_runs SET status='stopped',revision=revision+1 WHERE id=?").bind(run.id).run();return db.batch(statements);}};
  await tickPaper({DB:wrapper,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+3*R.interval+1000,market:marketAt(base+2*R.interval)});
  assert.equal((await db.prepare('SELECT status FROM wp_paper_runs WHERE id=?').bind(run.id).first()).status,'stopped');assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events WHERE run_id=?').bind(run.id).first()).n,0);
 }finally{db.close();}
});
test('feed resolves spot metadata, discards open candles and rejects malformed OHLC',async()=>{
 const meta={tokens:[{name:'UBTC',index:1},{name:'USDC',index:0}],universe:[{index:7,tokens:[1,0]}]},row={t:base,T:base+R.interval-1,s:'@7',i:'5m',o:'100',h:'101',l:'99',c:'100'};
 const read=async rows=>readPaperMarket({now:base+R.interval+1000,fetcher:async(_url,request)=>Response.json(JSON.parse(request.body).type==='spotMeta'?meta:rows)});
 const result=await read([row,{...row,t:base+R.interval,T:base+2*R.interval-1}]);assert.equal(result.coin,'@7');assert.equal(result.bars.length,1);
 await assert.rejects(read([{...row,h:'90'}]),/Invalid/);await assert.rejects(read([{...row,s:'BTC'}]),/Invalid/);await assert.rejects(read([row,row]),/duplicated/);
});
test('normal time between closes is healthy, while old provider data is recoverable',async()=>{
 const db=database();try{
  const healthy=await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+R.interval+120000,market:marketAt(base)});assert.equal(healthy.error,undefined);
  const service=createPaperService({season,rulesHash:hash,now:()=>base+R.interval+120000});assert.equal((await service.read({db,env:{PAPER_ENABLED:'1'}})).feed.stale,false);
  const late=await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+3*R.interval,market:marketAt(base)});assert.match(late.error,/fresh completed/);
 }finally{db.close();}
});
test('a slow response is recorded at receipt time and cannot pretend to be a timely observation',async()=>{
 const db=database();let time=base+R.interval+1000;
 try{
  await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,clock:()=>time,market:async args=>{time=base+R.interval+R.maxDelay+1000;return marketAt(base)(args);}});
  const bar=await db.prepare('SELECT observed_at,fresh FROM wp_paper_bars WHERE t=?').bind(base).first();assert.equal(bar.observed_at,time);assert.equal(bar.fresh,0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events').first()).n,0);
 }finally{db.close();}
});
test('daily loss limits and changed rule versions cannot silently start new positions',async()=>{
 const s=initialState([agent],base-R.interval,base-R.interval);Object.assign(s.agents[0],{day:Math.floor(base/86400000),dayPnl:-20,pending:{side:'buy',at:base-1000,reason:'old entry'}});
 const step=stepPaper(s,candle(base,200),rising(base),base+R.interval+1000);assert.equal(step.events.length,0);assert.equal(step.state.agents[0].qty,0);assert.match(step.state.agents[0].action,/Daily loss/);
 const db=database();try{
  await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:base+R.interval+1000,market:marketAt(base)});
  const original=(await db.prepare('SELECT id FROM wp_paper_runs ORDER BY id LIMIT 1').first()).id;
  await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:'b'.repeat(64),now:base+2*R.interval+1000,market:marketAt(base+R.interval)});
  assert.equal((await db.prepare('SELECT status FROM wp_paper_runs WHERE id=?').bind(original).first()).status,'stopped');assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events WHERE run_id=?').bind(original).first()).n,0);
 }finally{db.close();}
});
