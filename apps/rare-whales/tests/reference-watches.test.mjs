import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/database.mjs';
import {REFERENCE_VERSION,ensureReferenceWatches,referenceCohorts} from '../src/reference-watches.mjs';
import {PAPER_RULES as R} from '../src/paper-engine.mjs';
import {createRecorderCoverage} from '../src/recorder-coverage.mjs';
import {diarySummary} from '../src/recorder-evidence.mjs';
const hash='a'.repeat(64),D=86400000,start=Date.UTC(2026,9,7,13,38),quiet={info(){},error(){}};
const all=async db=>(await db.prepare('SELECT * FROM wp_paper_runs ORDER BY created_at,id').all()).results;
const seed=(db,now=start)=>ensureReferenceWatches({db,rulesHash:hash,now,lastT:Math.floor(now/R.interval)*R.interval-R.interval});

test('renewal waits for all three completed watches and preserves their original records',async()=>{
 const db=database();try{
  assert.equal((await seed(db)).created,true);const original=await all(db);assert.equal(original.length,3);
  assert.deepEqual(original.map(r=>r.id),[1,2,3].map(n=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0')));
  assert.equal((await seed(db,start+R.duration+1)).created,false,'expiry alone cannot overlap a still-running cohort');
  await db.prepare("UPDATE wp_paper_runs SET status='completed' WHERE id=?").bind(original[0].id).run();assert.equal((await seed(db,start+R.duration+1)).created,false);
  await db.prepare("UPDATE wp_paper_runs SET status='completed'").run();
  assert.equal((await seed(db,start+R.duration-1)).created,false,'completion cannot backdate a renewal before expiry');
  const frozen=await all(db),at=start+R.duration+60000;
  assert.equal((await seed(db,at)).created,true);const rows=await all(db);assert.equal(rows.length,6);assert.deepEqual(rows.slice(0,3),frozen);
  const groups=referenceCohorts(rows);assert.equal(groups.length,2);assert.equal(groups[0].rows.length,3);assert.equal(groups[0].createdAt,at);
  for(const row of groups[0].rows){assert.equal(row.ends_at,at+R.duration);assert.equal(row.status,'running');assert.deepEqual(JSON.parse(row.state_json).history,[]);assert.match(row.nickname,/2026-10-21/);assert.equal(JSON.parse(row.input_json).referenceVersion,REFERENCE_VERSION);}
  assert.equal((await seed(db,at+1)).created,false);assert.deepEqual(await all(db),rows);
 }finally{db.close();}
});

test('one atomic seed survives a middle-row failure, concurrent attempts and a lost acknowledgement',async()=>{
 const db=database();try{
  await seed(db);await db.prepare("UPDATE wp_paper_runs SET status='completed'").run();const frozen=await all(db),at=start+R.duration+60000;
  await db.prepare("CREATE TRIGGER fail_reference BEFORE INSERT ON wp_paper_runs WHEN json_extract(NEW.input_json,'$.preset')='breakout' BEGIN SELECT RAISE(ABORT,'Fixture cohort failure'); END").run();
  await assert.rejects(seed(db,at),/Fixture cohort failure/);assert.deepEqual(await all(db),frozen,'no first-preset fragment survives the failed statement');
  await db.prepare('DROP TRIGGER fail_reference').run();
  const results=await Promise.all([seed(db,at),seed(db,at+1)]);assert.equal(results.filter(r=>r.created).length,1);assert.equal((await all(db)).length,6);
  await db.prepare("UPDATE wp_paper_runs SET status='completed'").run();
  const lost={...db,prepare(query){const statement=db.prepare(query);if(query.startsWith('INSERT OR IGNORE INTO wp_paper_runs')){const run=statement.run;statement.run=async()=>{await run();throw Error('Fixture saved acknowledgement lost');};}return statement;}};
  await assert.rejects(seed(lost,at+R.duration+60000),/acknowledgement lost/);assert.equal((await all(db)).length,9);assert.equal((await seed(db,at+R.duration+60001)).created,false);assert.equal((await all(db)).length,9);
 }finally{db.close();}
});

test('coverage retains earlier cohorts and counts renewal warmup as a missing decision',async()=>{
 const db=database();try{
  const day=Date.UTC(2026,9,21),expired=start+R.duration,renewed=expired+3*60000,now=day+D+100000;
  const points=Array.from({length:288},(_,i)=>({t:day+(i+1)*R.interval,actionable:true}));
  const earlier=Date.UTC(2026,9,20),oldPoints=Array.from({length:288},(_,i)=>({t:earlier+(i+1)*R.interval,actionable:i!==150}));
  for(let i=0;i<3;i++){
   const oldHistory=[...oldPoints,...points.filter(p=>p.t<=expired)];
   await db.prepare("INSERT INTO wp_paper_runs(id,nickname,input_json,rules_hash,created_at,ends_at,status,state_json) VALUES(?,'old','{}',?,?,?,'completed',?)").bind('old-'+i,hash,start,expired,JSON.stringify({history:oldHistory})).run();
   await db.prepare("INSERT INTO wp_paper_runs(id,nickname,input_json,rules_hash,created_at,ends_at,status,state_json) VALUES(?,'new',?,?,?,?,'running',?)").bind('new-'+i,JSON.stringify({referenceVersion:REFERENCE_VERSION,referenceCohort:'renewed'}),hash,renewed,renewed+R.duration,JSON.stringify({history:points.filter(p=>p.t>renewed)})).run();
  }
  for(const p of [...oldPoints,...points])await db.prepare('INSERT INTO wp_paper_bars(t,o,h,l,c,observed_at,fresh) VALUES(?,1,1,1,1,?,1)').bind(p.t-R.interval,p.t+1000).run();
  const frozen=await all(db),service=createRecorderCoverage({rulesHash:hash,now:()=>now}),env={PAPER_ENABLED:'1'};
  const read=day=>service.read({db,env,url:new URL('https://app.invalid/api/paper/coverage?day='+day)});
  const current=await read('2026-10-21');assert.equal(current.expected,288);assert.equal(current.receipt.onTime,288);assert.equal(current.reference.actionable,287);assert.equal(current.reference.missing,1);assert.equal(current.reference.available,true);assert.equal(current.referenceCohorts.length,2);
  assert.equal(current.closes.find(p=>p.close===Date.UTC(2026,9,21,13,40)).execution,'missing');
  const previous=await read('2026-10-20');assert.equal(previous.reference.valuationOnly,1);assert.equal(previous.reference.actionable,287);assert.equal(previous.referenceCohorts.length,1);assert.equal(previous.startedAt,start);
  assert.equal(diarySummary([current,previous],{rulesHash:hash,checkedAt:now}).consecutiveCleanDays,0);assert.deepEqual(await all(db),frozen);
 }finally{db.close();}
});
