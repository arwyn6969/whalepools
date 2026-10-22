import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/database.mjs';
import {tickPaper} from '../src/paper-recorder.mjs';
import {PAPER_RULES as R,initialState,stepPaper} from '../src/paper-engine.mjs';
import {NEUTRAL_PROFILE} from '../src/dna.mjs';

const hash='a'.repeat(64),base=Date.UTC(2026,9,20,12);
const agent={collection:'rarewhales',tokenId:245,preset:'trend',profile:NEUTRAL_PROFILE};
const marketAt=t=>async()=>({coin:'@1',bars:Array.from({length:144},(_,i)=>{const at=t-(143-i)*R.interval,p=1000+(at-base)/R.interval;return {t:at,o:p,h:p+.1,l:p-.1,c:p};})});
const quiet={info(){},error(){}};
const tick=(db,t,extra={})=>tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:hash,now:t+R.interval+1000,market:marketAt(t),log:quiet,...extra});
const snapshot=async db=>(await db.prepare('SELECT id,revision,status,state_json FROM wp_paper_runs ORDER BY id').all()).results;
const wrap=(db,onBatch=statements=>db.batch(statements))=>({...db,prepare(query){const stmt=db.prepare(query);stmt.testQuery=query;return stmt;},batch:onBatch});

test('a later cohort statement failure rolls back every watch while preserving first receipt and late-retry honesty',async()=>{
 const db=database();try{
  await tick(db,base);await tick(db,base+R.interval);
  const before=await snapshot(db),events=(await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events').first()).n;
  let cohortBatches=0;
  const failing=wrap(db,statements=>{
   if(statements[0].testQuery?.startsWith('UPDATE wp_paper_runs SET state_json')){
    cohortBatches++;
    // In the former per-watch executor the first watch commits before this
    // fault; in one cohort transaction this fault must roll everything back.
    if(cohortBatches===2||statements.filter(s=>s.testQuery?.startsWith('UPDATE wp_paper_runs SET state_json')).length>1)statements.push(db.prepare('INSERT INTO wp_paper_feed(id) VALUES(2)'));
   }
   return db.batch(statements);
  });
  const logs=[],log={info:v=>logs.push(v),error:v=>logs.push(JSON.parse(v))};
  const failed=await tick(failing,base+2*R.interval,{log});assert.ok(failed.error);
  assert.equal(logs.at(-1).phase,'commit');assert.equal(logs.at(-1).closeAt,base+3*R.interval);assert.equal(logs.at(-1).receiptDelayMs,1000);assert.doesNotMatch(JSON.stringify(logs),/wallet|nickname|state_json/);
  assert.deepEqual(await snapshot(db),before);
  const receipt=await db.prepare('SELECT observed_at,fresh FROM wp_paper_bars WHERE t=?').bind(base+2*R.interval).first();assert.equal(receipt.observed_at,base+3*R.interval+1000);assert.equal(receipt.fresh,1);
  const retry=await tick(db,base+2*R.interval,{now:base+3*R.interval+R.maxDelay+1});assert.equal(retry.error,undefined);
  const after=await snapshot(db);assert.equal(after.length,3);for(const run of after)assert.equal(JSON.parse(run.state_json).history.at(-1).actionable,false);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events').first()).n,events);
  assert.deepEqual(await db.prepare('SELECT observed_at,fresh FROM wp_paper_bars WHERE t=?').bind(base+2*R.interval).first(),receipt);
 }finally{db.close();}
});

test('long saved histories and twelve-close recovery remain byte-equivalent to the frozen step engine',async()=>{
 for(const [saved,pending] of [[3800,1],[4032,12]]){
  const db=database();try{
   await tick(db,base);const rows=await snapshot(db),latest=base+pending*R.interval;
   for(const row of rows){
    const state=JSON.parse(row.state_json);state.startAt=base-(saved+1)*R.interval;state.lastT=base;state.history=Array.from({length:saved},(_,i)=>({t:base-(saved-i-1)*R.interval,observedAt:base-(saved-i-1)*R.interval+1000,equity:1000,hold:1000,price:1000,actionable:true}));state.observedBars=saved;
    state.agents[0].pending={side:'buy',at:base+1000,reason:'Saved signal'};
    await db.prepare('UPDATE wp_paper_runs SET state_json=? WHERE id=?').bind(JSON.stringify(state),row.id).run();row.state=state;
   }
   const result=await tick(db,latest);assert.equal(result.error,undefined);
   const history=(await db.prepare('SELECT * FROM wp_paper_bars ORDER BY t DESC LIMIT 180').all()).results.reverse(),now=latest+R.interval+1000;
   for(const row of rows){
    let expected=row.state;const expectedEvents=[];
    for(const b of history.filter(b=>b.t>expected.lastT&&b.t+R.interval<=now).slice(-12)){const next=stepPaper(expected,b,history.filter(x=>x.t<=b.t).slice(-100),now);expected=next.state;next.events.forEach((event,ordinal)=>expectedEvents.push({bar_t:b.t,ordinal,event_json:JSON.stringify(event)}));}
    assert.equal((await db.prepare('SELECT state_json FROM wp_paper_runs WHERE id=?').bind(row.id).first()).state_json,JSON.stringify(expected));
    const events=(await db.prepare('SELECT bar_t,ordinal,event_json FROM wp_paper_events WHERE run_id=? ORDER BY bar_t,ordinal').bind(row.id).all()).results;assert.deepEqual(events.map(e=>({...e})),expectedEvents);
   }
  }finally{db.close();}
 }
});

test('twenty twelve-whale holders and all reference fills use a bounded cohort transaction',async()=>{
 const db=database();try{
  await tick(db,base);
  for(const row of await snapshot(db)){const state=JSON.parse(row.state_json);state.agents[0].pending={side:'buy',at:base+1000,reason:'Saved signal'};await db.prepare('UPDATE wp_paper_runs SET state_json=? WHERE id=?').bind(JSON.stringify(state),row.id).run();}
  const agents=Array.from({length:12},(_,i)=>({...agent,tokenId:i+1}));
  const state=initialState(agents,base-R.interval,base);for(const a of state.agents)a.pending={side:'buy',at:base+1000,reason:'Saved signal'};
  for(let i=0;i<20;i++)await db.prepare("INSERT INTO wp_paper_runs(id,wallet,nickname,input_json,rules_hash,created_at,ends_at,status,state_json) VALUES(?,?,?,'{}',?,?,?,'running',?)").bind('cohort-'+i,'0x'+String(i+1).padStart(40,'0'),'Cohort '+i,hash,base,base+R.duration,JSON.stringify(state)).run();
  let statements=0,queries=0,maxParameters=0,cohortSizes=[];const counted=wrap(db,items=>{statements+=items.length;queries+=items.length;if(items[0].testQuery?.startsWith('UPDATE wp_paper_runs SET state_json'))cohortSizes.push(items.length);return db.batch(items);});
  const prepare=counted.prepare;counted.prepare=query=>{const stmt=prepare(query),bind=stmt.bind;stmt.bind=(...values)=>{maxParameters=Math.max(maxParameters,values.length);return bind(...values);};for(const method of ['run','all','first']){const invoke=stmt[method];stmt[method]=(...args)=>{queries++;return invoke(...args);};}return stmt;};
  const result=await tick(counted,base+R.interval);assert.equal(result.error,undefined);assert.equal(result.runs,23);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM wp_paper_events WHERE run_id LIKE 'cohort-%'").first()).n,240);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events').first()).n,243);
  assert.deepEqual(cohortSizes,[25]);assert.ok(statements<=27,'cohort and receipt batches stay bounded independently of whales and fills');assert.ok(queries<=50,'all paper queries stay below the documented Free invocation allowance');assert.ok(maxParameters<=100);
 }finally{db.close();}
});

test('an executor that loses its lease cannot publish decisions or release the new owner lease',async()=>{
 const db=database();try{
  await tick(db,base);const before=await snapshot(db);
  const replaced=wrap(db,async statements=>{if(statements[0].testQuery?.startsWith('UPDATE wp_paper_runs SET state_json'))await db.prepare("UPDATE wp_paper_feed SET lock_owner='replacement',lock_until=? WHERE id=1").bind(base+10*R.interval).run();return db.batch(statements);});
  const result=await tick(replaced,base+R.interval);assert.equal(result.busy,true);assert.deepEqual(await snapshot(db),before);
  assert.equal((await db.prepare('SELECT lock_owner FROM wp_paper_feed WHERE id=1').first()).lock_owner,'replacement');
 }finally{db.close();}
});

test('a lost transaction response retries saved cohort truth without repeating fills',async()=>{
 const db=database();try{
  await tick(db,base);await tick(db,base+R.interval);
  let lost=false;
  const uncertain=wrap(db,async statements=>{const result=await db.batch(statements);if(!lost&&statements[0].testQuery?.startsWith('UPDATE wp_paper_runs SET state_json')){lost=true;throw Error('Fixture committed response lost');}return result;});
  assert.ok((await tick(uncertain,base+2*R.interval)).error);
  const saved=await snapshot(db),fills=(await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events').first()).n;assert.equal(fills,2);
  assert.equal((await tick(db,base+2*R.interval)).error,undefined);assert.deepEqual(await snapshot(db),saved);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events').first()).n,fills);assert.equal((await db.prepare('SELECT error FROM wp_paper_feed WHERE id=1').first()).error,null);
 }finally{db.close();}
});

test('D1 acquisition and failed error persistence retain their diagnostic phase',async()=>{
 const db=database();try{
  const logs=[],log={info:v=>logs.push(v),error:v=>logs.push(JSON.parse(v))};
  const failing=query=>({...db,prepare(sql){const stmt=db.prepare(sql);if(sql.startsWith(query))stmt.run=async()=>{throw Error('Fixture D1 unavailable');};return stmt;}});
  assert.match((await tick(failing('UPDATE wp_paper_feed SET lock_owner=?,'),base,{log})).error,/unavailable/);assert.equal(logs.at(-1).phase,'lease');
  await assert.rejects(tick(failing('UPDATE wp_paper_feed SET error=?'),base,{log,market:async()=>{throw Error('Fixture provider unavailable');}}),/D1 unavailable/);
  assert.equal(logs.at(-1).phase,'market');assert.match(logs.at(-1).message,/provider unavailable/);
  assert.equal((await db.prepare('SELECT lock_owner FROM wp_paper_feed WHERE id=1').first()).lock_owner,null);
 }finally{db.close();}
});

test('a D1 release failure is visible after committed data remains saved',async()=>{
 const db=database();try{
  const logs=[],log={info:v=>logs.push(v),error:v=>logs.push(JSON.parse(v))};
  const failing={...db,prepare(query){const stmt=db.prepare(query);if(query.startsWith('UPDATE wp_paper_feed SET lock_owner=NULL'))stmt.run=async()=>{throw Error('Fixture lease release unavailable');};return stmt;}};
  await assert.rejects(tick(failing,base,{log}),/release unavailable/);assert.equal(logs.at(-1).phase,'release');assert.equal((await snapshot(db)).length,3);
  assert.ok((await db.prepare('SELECT last_ok FROM wp_paper_feed WHERE id=1').first()).last_ok);
 }finally{db.close();}
});
