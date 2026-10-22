import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {database} from '../scripts/database.mjs';
import {coverageWindow,recorderCoverage,createRecorderCoverage} from '../src/recorder-coverage.mjs';
import {observeScheduled} from '../src/recorder-observer.mjs';
import {coverageHTML} from '../public/recorder-coverage.mjs';
import {diarySummary} from '../src/recorder-evidence.mjs';
import {createApi} from '../src/api.mjs';
const start=Date.UTC(2026,9,7),I=300000,D=86400000,hash='a'.repeat(64);
const ref=(points,extra={})=>({created_at:start,ends_at:start+14*D,history:points,...extra});
const refs=(points)=>[ref(points),ref(points),ref(points)];
const bar=(close,delay=1000,fresh=1)=>({t:close-I,observed_at:close+delay,fresh});
const project=(bars,rows,now=start+4*I+100000,day='2026-10-07')=>recorderCoverage(bars,rows,{now,day,rulesHash:hash});
test('coverage distinguishes timely receipt from interrupted strategy execution',()=>{
 const c=project([bar(start+I),bar(start+2*I),bar(start+3*I,100000,0)],refs([{t:start+I,actionable:true},{t:start+2*I,actionable:false},{t:start+3*I,actionable:false}]));
 assert.deepEqual(c.receipt,{onTime:2,late:1,missing:1,waiting:0});assert.deepEqual(c.reference,{available:true,watches:3,actionable:1,valuationOnly:2,missing:1,waiting:0});assert.equal(c.closes[1].receipt,'on-time');assert.equal(c.closes[1].execution,'valuation-only');
 assert.match(coverageHTML(c),/connected feed alone/);assert.match(coverageHTML(c),/1 closes usable/);assert.match(coverageHTML(c),/cannot create catch-up fills/);
});
test('coverage gives delivery and execution the frozen ninety-second grace',()=>{
 const now=start+I+90000,c=project([],refs([]),now);assert.equal(c.receipt.waiting,1);assert.equal(c.reference.waiting,1);assert.match(coverageHTML(c),/Some closes are waiting/);
 const after=project([],refs([]),now+1);assert.equal(after.receipt.missing,1);assert.equal(after.reference.missing,1);
 assert.equal(project([bar(start+I,90000)],refs([]),now).receipt.onTime,1);assert.equal(project([bar(start+I,90001)],refs([]),now+1).receipt.late,1);
});
test('ending midnight belongs to previous day and first-day warmup is excluded',()=>{
 const p=[{t:start+D,actionable:true},{t:start+D+I,actionable:true}],bars=[bar(start+D),bar(start+D+I)];
 assert.equal(project(bars,refs(p),start+D+I+100000).closes.at(-1).close,start+D);
 const next=project(bars,refs(p),start+D+I+100000,'2026-10-08');assert.equal(next.expected,1);assert.equal(next.closes[0].close,start+D+I);
 const partial=project([bar(start+I),bar(start+2*I)],refs([]).map(r=>({...r,created_at:start+I+1234})),start+2*I+1000);assert.equal(partial.expected,1);assert.equal(partial.receipt.onTime,1);
 assert.equal(project([],refs([]),start+D+89999).completeDay,false);assert.equal(project([],refs([]),start+D+90000).completeDay,true);
});
test('days are strict, bounded to fourteen and never precede recording',()=>{
 for(const day of ['2026-02-30','2026-10-7','garbage'])assert.throws(()=>coverageWindow({day,now:start,startedAt:start}),e=>e.status===400);
 for(const day of ['2026-10-06','2026-10-08'])assert.throws(()=>coverageWindow({day,now:start,startedAt:start}),e=>e.status===404);
 const w=coverageWindow({day:null,now:start+30*D,startedAt:start});assert.equal(w.days.length,14);assert.throws(()=>coverageWindow({day:'2026-10-07',now:start+30*D,startedAt:start}),e=>e.status===404);
 assert.equal(project([],refs([]),start+D+I,'2026-10-07').expected,288);
});
test('all three watches must save actionable decisions; no available evidence means no assumed coverage',()=>{
 const p={t:start+I,actionable:true},rows=refs([p]);rows[1].history=[{...p,actionable:false}];assert.equal(project([bar(p.t)],rows,start+I+1000).reference.valuationOnly,1);
 for(const incomplete of [rows.slice(0,2),rows.map(r=>({...r,ends_at:start})),rows.map(r=>({...r,history_length:4032,first_close:start+2*I}))]){const c=project([bar(p.t)],incomplete,start+I+1000);assert.equal(c.reference.available,false);assert.equal(c.reference.actionable,null);assert.match(coverageHTML(c),/coverage is unavailable/);}
});
test('indexed coverage service reads compact flags only and does not mutate or expose private fields',async()=>{
 const db=database();try{
  for(let n=0;n<3;n++)await db.prepare('INSERT INTO wp_paper_runs(id,nickname,input_json,rules_hash,created_at,ends_at,status,state_json) VALUES(?,?,?,?,?,?,?,?)').bind(String(n),'neutral','{}',hash,start,start+14*D,'running',JSON.stringify({history:[{t:start+I,actionable:true,equity:1001}]})).run();
  await db.prepare('INSERT INTO wp_paper_runs(id,wallet,nickname,input_json,rules_hash,created_at,ends_at,status,state_json) VALUES(?,?,?,?,?,?,?,?,?)').bind('private','0xprivate','Secret name','private choices',hash,start,start+14*D,'running','{"history":[]}').run();
  const b=bar(start+I);await db.prepare('INSERT INTO wp_paper_bars(t,o,h,l,c,observed_at,fresh) VALUES(?,?,?,?,?,?,?)').bind(b.t,1,1,1,1,b.observed_at,b.fresh).run();
  const before=await db.prepare('SELECT * FROM wp_paper_runs').all(),svc=createRecorderCoverage({rulesHash:hash,now:()=>start+I+1000}),env={PAPER_ENABLED:'1'},url=new URL('https://app.invalid/api/paper/coverage');
  const c=await svc.read({db,env,url});assert.equal(c.reference.actionable,1);assert.equal(c.receipt.onTime,1);assert.equal(c.closes.length,1);assert.doesNotMatch(JSON.stringify(c),/private|Secret|wallet|input_json|nickname|equity|state_json/);assert.deepEqual(await db.prepare('SELECT * FROM wp_paper_runs').all(),before);
  await assert.rejects(svc.read({db,env:{},url}),e=>e.status===404);
  await assert.rejects(svc.read({db,env,url:new URL(url+'?day=2026-02-30')}),e=>e.status===400);
  await assert.rejects(createRecorderCoverage({rulesHash:'b'.repeat(64)}).read({db,env,url}),e=>e.status===503);
 }finally{db.close();}
});
test('coverage API keeps same-origin, cross-site and method protection',async()=>{
 const db=database(),season=JSON.parse(await readFile(new URL('../arcade.json',import.meta.url)));try{
  let reads=0;const api=createApi({season,recorder:{read:async()=>{reads++;return {ok:true};}}}),env={DB:db,APP_ORIGIN:'https://app.invalid'};
  assert.equal((await api(new Request('https://app.invalid/api/paper/coverage'),env)).status,200);
  assert.equal((await api(new Request('https://app.invalid/api/paper/coverage',{headers:{'sec-fetch-site':'cross-site'}}),env)).status,403);
  assert.equal((await api(new Request('https://other.invalid/api/paper/coverage'),env)).status,503);
  assert.equal((await api(new Request('https://app.invalid/api/paper/coverage',{method:'POST',headers:{origin:'https://app.invalid'}}),env)).status,401);assert.equal(reads,1);
 }finally{db.close();}
});
const observer=async(tick,controller={scheduledTime:900})=>{let t=1000;const logs=[];const options={tick,clock:()=>t+=50,log:{info:v=>logs.push(v),error:v=>logs.push(v)}};return {logs,run:()=>observeScheduled(controller,{},options)};};
test('scheduler reports timing, success, busy and disabled without leaking arbitrary results',async()=>{
 for(const result of [{recorded:1,runs:3,tide:{advanced:1},wallet:'secret'}, {busy:true}, {disabled:true,tide:{disabled:true}}]){
  const o=await observer(async()=>result);assert.equal(await o.run(),result);assert.equal(o.logs.length,2);assert.equal(o.logs[0].scheduleLagMs,150);assert.equal(o.logs[1].durationMs,50);assert.equal(o.logs[1].status,result.busy?'busy':result.disabled?'disabled':'ok');assert.doesNotMatch(JSON.stringify(o.logs),/secret|wallet/);
 }
});
test('caught engine error objects and thrown failures reject the scheduled promise with a safe summary',async()=>{
 for(const tick of [async()=>({error:'secret upstream URL'}),async()=>{throw Error('secret credential');}]){
  const o=await observer(tick);await assert.rejects(o.run(),/Scheduled paper recording failed/);assert.equal(o.logs[1].status,'failed');assert.doesNotMatch(JSON.stringify(o.logs),/secret|credential/);
 }
});

test('diary counts only consecutive full days; missing reads and bootstrap windows block the coverage gate',()=>{
 const now=start+10*D+100000,good=i=>({day:new Date(start+i*D).toISOString().slice(0,10),from:start+i*D,expected:288,rulesHash:hash,completeDay:true,receipt:{onTime:288,late:0,missing:0,waiting:0},reference:{available:true,actionable:288,valuationOnly:0,missing:0,waiting:0}});
 const rows=Array.from({length:8},(_,i)=>good(9-i));assert.equal(diarySummary(rows,{rulesHash:hash,checkedAt:now}).sevenDayCoverageGate,true);
 for(const bad of [{day:rows[2].day,error:'read failed'}, {...rows[2],from:start+7*D+1}, {...rows[2],reference:{...rows[2].reference,valuationOnly:1}}, {...rows[2],rulesHash:'old'}]){const altered=rows.slice();altered[2]=bad;assert.equal(diarySummary(altered,{rulesHash:hash,checkedAt:now}).consecutiveCleanDays,2);}
 const omitted=rows.filter((_,i)=>i!==2);assert.equal(diarySummary(omitted,{rulesHash:hash,checkedAt:now}).consecutiveCleanDays,2);
 assert.equal(diarySummary([{...good(10),completeDay:false},...rows],{rulesHash:hash,checkedAt:now}).consecutiveCleanDays,8);
 assert.equal(diarySummary([{...good(9),completeDay:false},...rows.slice(1)],{rulesHash:hash,checkedAt:start+10*D+1000}).consecutiveCleanDays,7);
});
