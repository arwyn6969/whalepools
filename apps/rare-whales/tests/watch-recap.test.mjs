import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {database} from '../scripts/database.mjs';
import {watchRecap,recapDay,createWatchRecaps} from '../src/watch-recap.mjs';
import {watchPreview} from '../src/watch-preview.mjs';
import {paperURL,watchPath} from '../public/paper-share.mjs';
import {createApi} from '../src/api.mjs';
const id='11111111-1111-4111-8111-111111111111',hash='a'.repeat(64),start=Date.UTC(2026,9,7),I=300000,D=86400000;
const point=(t,equity=1000,actionable=true)=>({t,equity,hold:1000,price:200,actionable,observedAt:t+1000});
const row=(history,extra={})=>({id,rules_hash:hash,created_at:start,ends_at:start+14*D,status:'running',state_json:JSON.stringify({history}),...extra});
const event=(t,kind='buy',extra={})=>({bar_t:t-I,event_json:JSON.stringify({kind,agent:0,at:t+1000,qty:1,price:kind==='buy'?200.1:199.9,fee:.16,reason:'Actual saved reason',...extra})});
const recap=(r,events=[],day='2026-10-07',now=start+D)=>watchRecap(r,events,{day,now,rulesHash:hash});
test('UTC date validation rejects impossible dates and formats',()=>{
 assert.equal(recapDay('2026-10-07'),start);
 for(const day of ['2026-02-30','07/10/2026','2026-10-7','<script>','2026-10-07T12:00',null])assert.throws(()=>recapDay(day),e=>e.status===400);
});
test('midnight close belongs to the ending day; the following day uses it as baseline',()=>{
 const r=row([point(start+I,999),point(start+D,1010),point(start+D+I,1012)]);
 const events=[event(start+D,'sell',{pnl:10}),event(start+D+I)];
 const a=recap(r,events);assert.equal(a.coverage.recorded,2);assert.equal(a.sells,1);assert.equal(a.buys,0);assert.equal(a.change,10);assert.equal(a.completeDay,true);
 const b=recap(r,events,'2026-10-08',start+D+I);assert.equal(b.change,2);assert.equal(b.baselineAt,start+D);assert.equal(b.buys,1);assert.equal(b.sells,0);
});
test('day costs and counts use every saved fill, with only twelve recent explanations returned',()=>{
 const points=Array.from({length:20},(_,i)=>point(start+(i+1)*I,1000+i)),events=points.map((p,i)=>event(p.t,i%2?'sell':'buy'));
 const r=recap(row(points),events,'2026-10-07',start+20*I);assert.equal(r.buys,10);assert.equal(r.sells,10);assert.ok(Math.abs(r.fees-3.2)<1e-10);assert.ok(Math.abs(r.slippage-2)<1e-10);assert.equal(r.events.length,12);assert.equal(r.events[0].at,points.at(-1).t+1000);assert.equal(r.change,19);
});
test('missing and valuation-only candles stay explicit and cannot create fills',()=>{
 const r=recap(row([point(start+I),point(start+3*I,990,false)]),[],null,start+4*I);
 assert.deepEqual(r.coverage,{recorded:2,actionable:1,expected:4,missing:2});assert.equal(r.change,-10);assert.equal(r.buys+r.sells,0);assert.equal(r.completeDay,false);
});
test('no observations have no invented balance or zero return',()=>{
 const r=recap(row([]),[],null,start+2*I);assert.equal(r.balance,null);assert.equal(r.change,null);assert.equal(r.lastValuation,null);assert.equal(r.coverage.missing,2);
});
test('a completed window still exposes missing final closes after the last valuation',()=>{
 const r=recap(row([point(start+I)],{status:'completed',ends_at:start+D}),[],null,start+2*D);
 assert.equal(r.until,start+D);assert.equal(r.completeDay,true);assert.equal(r.coverage.expected,288);assert.equal(r.coverage.missing,287);assert.equal(r.lastValuation,start+I);
});
test('midday start and stopped records count only their actual watch window',()=>{
 const r=row([point(start+I),point(start+2*I)],{created_at:start+12345,status:'stopped'});
 const a=recap(r,[],null,start+5*D);assert.equal(a.until,start+2*I);assert.equal(a.coverage.expected,2);assert.deepEqual(a.days,['2026-10-07']);assert.equal(a.completeDay,false);
 assert.throws(()=>recap(r,[],'2026-10-08'),e=>e.status===404);
});
test('ledger rows committed after the state snapshot are excluded',()=>{
 const a=recap(row([point(start+I)]),[event(start+I),event(start+2*I)],null,start+2*I);assert.equal(a.buys,1);assert.equal(a.fees,.16);
});
test('older rules freeze the window and never reinterpret fill slippage',()=>{
 const a=recap(row([point(start+I)],{rules_hash:'b'.repeat(64)}),[event(start+I)],null,start+3*D);assert.equal(a.until,start+I);assert.equal(a.slippage,null);assert.equal(a.fees,.16);
});
test('bounded read projects only public recap fields and does not mutate saved state',async()=>{
 const db=database(),r=row([point(start+I)]);try{
  await db.prepare('INSERT INTO wp_paper_runs(id,nickname,input_json,rules_hash,created_at,ends_at,status,state_json) VALUES(?,?,?,?,?,?,?,?)').bind(id,'Private-free public name','{"mutation":"private"}',hash,r.created_at,r.ends_at,r.status,r.state_json).run();
  const e=event(start+I);await db.prepare('INSERT INTO wp_paper_events(run_id,bar_t,ordinal,event_json) VALUES(?,?,?,?)').bind(id,e.bar_t,0,e.event_json).run();
  const svc=createWatchRecaps({rulesHash:hash,now:()=>start+I+1000}),url=new URL('https://app.invalid/api/paper/recap/'+id),env={PAPER_ENABLED:'1'};
  const before=await db.prepare('SELECT * FROM wp_paper_runs').all();const a=await svc.read({db,env,url,id});assert.equal(a.buys,1);assert.doesNotMatch(JSON.stringify(a),/nickname|wallet|mutation|input_json|state_json|commit_token/);assert.deepEqual(await db.prepare('SELECT * FROM wp_paper_runs').all(),before);
  await assert.rejects(svc.read({db,env,url,id:'bad'}),e=>e.status===404);await assert.rejects(svc.read({db:{prepare(){throw Error('must not read')}},env:{},url,id}),e=>e.status===404);
 }finally{db.close();}
});
test('read-only recap API retains origin, cross-site and method protections',async()=>{
 const season=JSON.parse(await readFile(new URL('../arcade.json',import.meta.url))),db=database();try{
  let reads=0;const api=createApi({season,recaps:{read:async()=>{reads++;return {id};}}}),env={DB:db,APP_ORIGIN:'https://app.invalid'};
  assert.equal((await api(new Request('https://app.invalid/api/paper/recap/'+id),env)).status,200);
  assert.equal((await api(new Request('https://app.invalid/api/paper/recap/'+id,{headers:{'sec-fetch-site':'cross-site'}}),env)).status,403);
  assert.equal((await api(new Request('https://other.invalid/api/paper/recap/'+id),env)).status,503);
  assert.equal((await api(new Request('https://app.invalid/api/paper/recap/'+id,{method:'POST',headers:{origin:'https://app.invalid'}}),env)).status,401);assert.equal(reads,1);
 }finally{db.close();}
});
test('canonical links remove credentials, queries and old watch suffixes; legacy hashes still parse separately',()=>{
 for(const path of ['/whalepools/','/whalepools/index.html','/whalepools/watch/'+id])assert.equal(paperURL('https://user:secret@app.invalid'+path+'?private=1#seat',id),'https://app.invalid/whalepools/watch/'+id);
 assert.equal(paperURL('http://127.0.0.1:48382/',id),'http://127.0.0.1:48382/watch/'+id);assert.equal(watchPath('/whalepools/watch/'+id),id);assert.equal(watchPath('/watch/bad'),null);assert.throws(()=>paperURL('javascript:alert(1)',id));
});
test('server share preview handles compressed assets, escapes public text and retains strict CSP',async()=>{
 const shell='<!doctype html><html><head><title>old</title><meta name="description" content="old"><link href="./style.css"><script src="./app.js"></script></head><body><img src="./whale.avif"></body></html>';
 const run={id,nickname:'A & "B" <script>alert(1)</script>',stats:{equity:999},history:[point(start+I)],rulesHash:hash,status:'running',createdAt:start,observedBars:1,gapBars:2};
 const paper={read:async()=>({run})},env={PAPER_ENABLED:'1',APP_ORIGIN:'https://app.invalid',ASSETS:{fetch:async()=>new Response(gzipSync(shell),{headers:{'content-encoding':'gzip'}})}};
 const request=new Request('https://app.invalid/whalepools/watch/'+id),r=await watchPreview(request,env,{paper,base:'/whalepools'}),html=await r.text();assert.equal(r.status,200);assert.match(html,/A &amp; &quot;B&quot; &lt;script&gt;/);assert.match(html,/<noscript>/);assert.match(html,/og:url.*https:\/\/app.invalid\/whalepools\/watch\//);assert.match(html,/src="\/whalepools\/app.js"/);assert.match(html,/href="\/whalepools\/style.css"/);assert.match(html,/2026-10-07 00:05 UTC/);assert.doesNotMatch(html,/<script>alert|<base|input_json|content-encoding/);assert.match(r.headers.get('content-security-policy'),/base-uri 'none'/);assert.equal(r.headers.get('content-encoding'),null);
 assert.equal((await watchPreview(new Request(request,{method:'HEAD'}),env,{paper,base:'/whalepools'})).body,null);
 assert.equal((await watchPreview(new Request('https://evil.invalid/whalepools/watch/'+id),env,{paper,base:'/whalepools'})).status,503);
 assert.equal((await watchPreview(new Request('https://app.invalid/whalepools/watch/bad'),env,{paper,base:'/whalepools'})).status,404);
 assert.equal((await watchPreview(request,{...env,PAPER_ENABLED:'0'},{paper,base:'/whalepools'})).status,404);
 assert.equal((await watchPreview(request,env,{paper:{read:async()=>{throw {status:404};}},base:'/whalepools'})).status,404);
});
