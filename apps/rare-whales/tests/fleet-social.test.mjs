import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {database} from '../scripts/database.mjs';
import {TIDE_RULES,nextTideStart,tideId,initialTide,tideQuality,projectTide,tickTide} from '../src/daily-tide.mjs';
import {createFleetSocialService,decodeArchiveCursor} from '../src/fleet-social-service.mjs';
import {PAPER_RULES as R} from '../src/paper-engine.mjs';
import {tickPaper,createPaperService} from '../src/paper-service.mjs';
import {CHAIN_ID} from '../src/config.mjs';
import {paperURL,paperCard} from '../public/paper-share.mjs';
import {createLivePilot,livePilotReadout,validateLivePilot,LIVE_PILOT_KEY} from '../public/live-pilot.mjs';
const season=JSON.parse(await readFile(new URL('../arcade.json',import.meta.url))),hash='b'.repeat(64),paperHash='a'.repeat(64),address='0x'+'1'.repeat(40),other='0x'+'2'.repeat(40);
const env=db=>({DB:db,PAPER_ENABLED:'1',TIDE_ENABLED:'1'}),base=Date.UTC(2026,9,7,12),interval=R.interval,start=nextTideStart(base),id=tideId(hash,start);
const client={getChainId:async()=>CHAIN_ID,getBlockNumber:async()=>100n,readContract:async({functionName,args})=>functionName==='balanceOf'?1n:args[0]===245n?address:other};
const bar=(t,p=200)=>({t,o:p,h:p+.1,l:p-.1,c:p,fresh:1,observed_at:t+interval+1000});
async function feed(db,now,t=now-interval){
 await db.prepare('UPDATE wp_paper_feed SET last_ok=?,error=NULL,halted=0 WHERE id=1').bind(now).run();
 for(let i=99;i>=0;i--){const b=bar(t-i*interval,200+(t-i*interval-start)/interval*.2);await db.prepare('INSERT OR IGNORE INTO wp_paper_bars(t,o,h,l,c,observed_at,fresh) VALUES(?,?,?,?,?,?,?)').bind(b.t,b.o,b.h,b.l,b.c,b.observed_at,b.fresh).run();}
}
async function prepare(db,at=base){await feed(db,at);await tickTide(env(db),{rulesHash:hash,paperHash,now:at});}
const input=()=>({wallet:address,roundId:id,preset:'trend',nickname:'My Tide Pick',badge:{collection:'rarewhales',tokenId:245},publish:true,rulesHash:hash,mutationId:crypto.randomUUID()});
const join=(service,db,data=input())=>service.join({db,me:{address:data.wallet},env:env(db),request:new Request('https://test.invalid/api/tide/join',{method:'POST'}),data});
const service=(now=()=>base,c=client)=>createFleetSocialService({season,tideHash:hash,paperHash,client:c,now});
const read=(svc,db,me={address})=>svc.tide({db,me,env:env(db),url:new URL('https://test.invalid/api/tide?round='+id)});
test('Daily Tide v1 starts next UTC day with neutral equal budgets and preserves paper costs',()=>{
 assert.equal(nextTideStart(start),start+86400000);assert.equal(TIDE_RULES.duration/interval,288);assert.deepEqual(TIDE_RULES.costs,{fee:R.fee,slippage:R.slippage});
 const states=initialTide(start);assert.equal(tideQuality(states),'partial');
 for(const s of Object.values(states)){assert.equal(s.lastT,start-interval);assert.equal(s.startAt,start);assert.equal(s.agents[0].cash,1000);assert.equal(s.agents[0].profile.allocation,25);}
});
test('rounds are queued prospectively, concurrent lease is exclusive and restart does not replay',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'tide-')),file=path.join(dir,'tide.sqlite');let db=database(file);
 try{
  await feed(db,base);const ticks=await Promise.all([1,2].map(()=>tickTide(env(db),{rulesHash:hash,paperHash,now:base})));assert.equal(ticks.filter(r=>r.busy).length,1);
  let rounds=(await db.prepare('SELECT * FROM wp_tide_rounds').all()).results;assert.equal(rounds.length,1);assert.equal(rounds[0].starts_at,start);assert.equal(rounds[0].status,'queued');assert.equal(JSON.parse(rounds[0].state_json).trend.history.length,0);
  await feed(db,start+interval+1000,start);await tickTide(env(db),{rulesHash:hash,paperHash,now:start+interval+1000});
  await feed(db,start+2*interval+1000,start+interval);await tickTide(env(db),{rulesHash:hash,paperHash,now:start+2*interval+1000});
  const events=(await db.prepare('SELECT COUNT(*) AS n FROM wp_tide_events WHERE round_id=?').bind(id).first()).n;assert.ok(events>0);
  db.close();db=database(file);await tickTide(env(db),{rulesHash:hash,paperHash,now:start+2*interval+2000});
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_tide_events WHERE round_id=?').bind(id).first()).n,events);
 }finally{db.close();await rm(dir,{recursive:true,force:true});}
});
test('full 288 timely observations produce final ranks and freeze; paper tables remain intact',async()=>{
 const db=database();try{
  await prepare(db);for(let i=0;i<288;i++){const at=start+(i+1)*interval+1000;await feed(db,at,start+i*interval);await tickTide(env(db),{rulesHash:hash,paperHash,now:at});}
  const round=(await read(service(()=>start+86400000+1000),db)).rounds[0];assert.equal(round.status,'completed');assert.equal(round.quality,'complete');
  for(const s of round.strategies){assert.equal(s.observedBars,288);assert.equal(s.gapBars,0);assert.ok(s.rank>=1&&s.rank<=3);assert.equal(s.lastObservation,start+86400000);}
  const before=await db.prepare('SELECT state_json FROM wp_tide_rounds WHERE id=?').bind(id).first();
  await tickTide(env(db),{rulesHash:hash,paperHash,now:start+86400000+interval});assert.deepEqual(await db.prepare('SELECT state_json FROM wp_tide_rounds WHERE id=?').bind(id).first(),before);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_runs').first()).n,0);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events').first()).n,0);
 }finally{db.close();}
});
test('matching rounded returns tie, partial rounds do not rank',()=>{
 const states=initialTide(start),row={id,rules_hash:hash,rules_json:JSON.stringify(TIDE_RULES),starts_at:start,ends_at:start+86400000,status:'completed',quality:'complete',state_json:JSON.stringify(states)};
 assert.deepEqual(projectTide(row).strategies.map(s=>s.rank),[1,1,1]);assert.deepEqual(projectTide({...row,quality:'partial'}).strategies.map(s=>s.rank),[null,null,null]);
});
test('late, interrupted and unhealthy rounds stay partial and never invent fills',async()=>{
 const db=database();try{
  await prepare(db);await feed(db,start+interval+1000,start);await tickTide(env(db),{rulesHash:hash,paperHash,now:start+interval+1000});
  await feed(db,start+5*interval+1000,start+4*interval);await tickTide(env(db),{rulesHash:hash,paperHash,now:start+5*interval+1000});
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_tide_events').first()).n,0);
  await db.prepare("UPDATE wp_paper_feed SET error='fixture outage' WHERE id=1").run();await tickTide(env(db),{rulesHash:hash,paperHash,now:start+86400000+1000});
  const r=(await read(service(),db)).rounds[0];assert.equal(r.status,'completed');assert.equal(r.quality,'partial');assert.ok(r.strategies.every(s=>s.rank===null&&s.gapBars>0));
 }finally{db.close();}
});
test('stale versions pause old rounds without deleting records or picks',async()=>{
 const db=database();try{await prepare(db);await join(service(),db);await tickTide(env(db),{rulesHash:'c'.repeat(64),paperHash,now:base});
 const r=(await read(service(),db)).rounds[0];assert.equal(r.status,'paused');assert.equal(r.picks.length,1);assert.equal(r.rulesHash,hash);
 }finally{db.close();}
});
test('pick checks ownership, consent, wallet and rules; unchanged retry works after deadline',async()=>{
 const db=database();let time=base;const svc=service(()=>time);try{
  await prepare(db);for(const patch of [{publish:false},{rulesHash:'old'},{badge:{collection:'rarewhales',tokenId:246}},{nickname:'<unsafe>'},{preset:'magnet'}])await assert.rejects(join(svc,db,{...input(),...patch}),e=>[400,403,409].includes(e.status));
  await assert.rejects(svc.join({db,me:{address:other},env:env(db),request:new Request('https://test.invalid',{method:'POST'}),data:input()}),e=>e.status===409);
  const data=input(),saved=await join(svc,db,data);assert.equal(saved.pick.ownershipBlock,'98');time=start+1;
  assert.deepEqual(await join(svc,db,data),saved);await assert.rejects(join(svc,db,{...data,preset:'breakout'}),e=>e.status===409);await assert.rejects(join(svc,db,input()),e=>e.status===409);
  const pub=(await read(svc,db,null)).rounds[0];assert.equal(pub.mine,null);assert.equal(pub.picks[0].owner,address);assert.equal('input_json' in pub.picks[0],false);assert.equal('mutation_id' in pub.picks[0],false);
 }finally{db.close();}
});
test('slow ownership crossing deadline and recorder failures cannot confirm a pick',async()=>{
 const db=database();let time=base;try{await prepare(db);const slow={...client,readContract:async args=>{const v=await client.readContract(args);time=start+1;return v;}};
 await assert.rejects(join(service(()=>time,slow),db),e=>[409,503].includes(e.status));assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_tide_picks').first()).n,0);
 time=base;await db.prepare("UPDATE wp_paper_feed SET error='outage'").run();await assert.rejects(join(service(()=>time),db),e=>e.status===503);
 }finally{db.close();}
});
test('concurrent capacity and one-wallet constraints preserve exactly 20 locked picks',async()=>{
 const db=database();try{await prepare(db);const universal={...client,readContract:async({functionName})=>functionName==='balanceOf'?1n:address};
 const svc=service(()=>base,universal);const results=await Promise.allSettled(Array.from({length:24},()=>join(svc,db,input())));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 await db.prepare('DELETE FROM wp_tide_picks').run();
 // Inject test ownership per wallet, retaining the real ownership gate and conditional insert.
 const many=await Promise.allSettled(Array.from({length:24},(_,i)=>{const w='0x'+(i+10).toString(16).padStart(40,'0');return join(service(()=>base,{...client,readContract:async({functionName})=>functionName==='balanceOf'?1n:w}),db,{...input(),wallet:w});}));
 assert.equal(many.filter(r=>r.status==='fulfilled').length,20);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_tide_picks').first()).n,20);
 }finally{db.close();}
});
test('disabled social features never access database; archive requires session',async()=>{
 const svc=service(),bad={prepare(){throw Error('must not query');}},url=new URL('https://test.invalid');
 assert.deepEqual(await svc.archive({db:bad,env:{},url}),{enabled:false,runs:[],next:null});assert.equal((await svc.tide({db:bad,env:{},url})).enabled,false);
 await assert.rejects(svc.archive({db:bad,env:{PAPER_ENABLED:'1'},url}),e=>e.status===401);assert.deepEqual(await tickTide({DB:bad,PAPER_ENABLED:'1'},{rulesHash:hash,paperHash}),{disabled:true});
});
test('wallet archive pagination is stable for identical timestamps and excludes other wallets and private inputs',async()=>{
 const db=database();try{
  await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:paperHash,now:base,market:async()=>({coin:'@fixture',bars:Array.from({length:100},(_,i)=>{const b=bar(base-(100-i)*interval);return {t:b.t,o:b.o,h:b.h,l:b.l,c:b.c};})})});
  const runService=createPaperService({season,client,rulesHash:paperHash,now:()=>base+1000});
  const saved=await runService.handle({db,me:{address},env:{PAPER_ENABLED:'1'},request:new Request('https://test.invalid/api/paper/start',{method:'POST'}),data:{wallet:address,nickname:'Archive whale',preset:'trend',agents:[{collection:'rarewhales',tokenId:245}],publish:true,rulesHash:paperHash,mutationId:crypto.randomUUID()}});
  await db.prepare("UPDATE wp_paper_runs SET status='stopped' WHERE id=?").bind(saved.run.id).run();
  for(let i=0;i<13;i++)await db.prepare("INSERT INTO wp_paper_runs(id,wallet,nickname,input_json,rules_hash,ownership_block,created_at,ends_at,status,state_json) SELECT ?,?,nickname,input_json,rules_hash,ownership_block,created_at,ends_at,'stopped',state_json FROM wp_paper_runs WHERE id=?").bind(crypto.randomUUID(),i===12?other:address,saved.run.id).run();
  const svc=service(),readPage=cursor=>svc.archive({db,me:{address},env:env(db),url:new URL('https://test.invalid/api/paper/history'+(cursor?'?cursor='+encodeURIComponent(cursor):''))});
  const a=await readPage(),b=await readPage(a.next);assert.equal(a.runs.length,10);assert.equal(b.runs.length,3);assert.equal(b.next,null);assert.equal(new Set([...a.runs,...b.runs].map(r=>r.id)).size,13);assert.equal('agents' in a.runs[0],false);assert.equal('input_json' in a.runs[0],false);
  for(const v of ['bad',btoa('[1,"SQL"]'),'x'.repeat(181)])assert.throws(()=>decodeArchiveCursor(v),e=>e.status===400);
  const card=paperCard({...saved.run,nickname:'A & "B" <C>'},paperURL('https://user:secret@example.com/whalepools/?token=private#seat',saved.run.id));assert.match(card,/A &amp; &quot;B&quot; &lt;C&gt;/);assert.match(card,/No completed observation/);assert.match(card,RegExp(paperHash));assert.doesNotMatch(card,/secret|private|<C>/);assert.match(card,/downloaded snapshot/i);
 }finally{db.close();}
});
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};};
test('live pilot is opt-in, whitelist-only, separate-version and rejects stale or repeated review',()=>{
 let time=base;const store=memory(),p=createLivePilot(store,()=>time);assert.equal(p.record('live_started'),false);p.start('P01');p.record('live_ready_new');time+=90000;p.record('live_started');
 assert.equal(p.record('live_reviewed',time),false);time+=interval;assert.equal(p.record('live_reviewed',time-1000),true);assert.equal(p.record('live_reviewed',time-1000),false);
 const clean=validateLivePilot({...p.report(),wallet:address,events:p.report().events.map(e=>({...e,session:'secret',nickname:'Private'}))});assert.doesNotMatch(JSON.stringify(clean),/wallet|secret|Private/);assert.equal(store.map.has(LIVE_PILOT_KEY),true);
 assert.throws(()=>validateLivePilot({...clean,version:'holder-pilot-v1'}));assert.throws(()=>livePilotReadout([clean,clean],time));assert.throws(()=>livePilotReadout([clean],base));
 p.stop();assert.equal(p.record('live_shared'),false);p.erase();assert.equal(p.status().state,null);assert.equal(store.map.size,0);
});
test('pilot meaningful return requires later UTC day and newer observation; sharing and round picks alone fail',()=>{
 let time=base;const p=createLivePilot(memory(),()=>time);p.start('P02');p.record('live_ready_new');time+=60000;p.record('live_started');time+=interval;p.record('live_reviewed',time-1000);
 assert.equal(livePilotReadout([p.report()],time).meaningfulReturns,0);time=start+interval;p.record('live_shared');p.record('tide_joined');assert.equal(livePilotReadout([p.report()],time).meaningfulReturns,0);
 p.record('live_reviewed',time-1000);const r=livePilotReadout([p.report()],time);assert.equal(r.meaningfulReturns,1);assert.equal(r.medianCreationMs,60000);assert.equal(r.unaidedStarts,1);assert.equal(r.returnWindowsComplete,0);assert.equal(r.missingParticipants,9);
 assert.equal(livePilotReadout([p.report()],base+8*86400000).returnWindowsComplete,1);
});
test('existing holders cannot become new activations; bounded reports, expiry and unavailable storage stay usable',()=>{
 let time=base;const p=createLivePilot(memory(),()=>time);p.start('P03');p.record('live_ready_existing');assert.equal(p.record('live_ready_new'),false);assert.equal(livePilotReadout([p.report()],time).unaidedStarts,0);
 for(let i=0;i<600;i++)p.record('live_start_error');assert.equal(p.report().events.length,500);time+=30*86400000;assert.equal(p.status().state,null);
 const broken={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}},q=createLivePilot(broken,()=>base);assert.equal(q.start('P04'),false);q.record('live_shared');assert.equal(q.report().events.length,1);assert.equal(q.status().unavailable,true);
});
test('a newer pause during an executor commit prevents stale state and ghost fill logs',async()=>{
 const db=database();try{
  await prepare(db);await feed(db,start+interval+1000,start);await tickTide(env(db),{rulesHash:hash,paperHash,now:start+interval+1000});
  await feed(db,start+2*interval+1000,start+interval);
  const racing={...db,async batch(statements){await db.prepare("UPDATE wp_tide_rounds SET status='paused',revision=revision+1,commit_token=NULL WHERE id=?").bind(id).run();return db.batch(statements);}};
  await tickTide(env(racing),{rulesHash:hash,paperHash,now:start+2*interval+1000});
  const row=await db.prepare('SELECT * FROM wp_tide_rounds WHERE id=?').bind(id).first();assert.equal(row.status,'paused');assert.equal(JSON.parse(row.state_json).trend.history.length,1);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_tide_events WHERE round_id=?').bind(id).first()).n,0);
 }finally{db.close();}
});

test('voluntary live readout CLI accepts past fixture reports and rejects duplicate participants',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'live-readout-')),file=path.join(dir,'P01-fixture.json');let time=Date.now()-2*86400000;
 try{
  const p=createLivePilot(memory(),()=>time);p.start('P01');p.record('live_ready_new');time+=60000;p.record('live_started');time+=86400000;p.record('live_reviewed',time-1000);
  await writeFile(file,JSON.stringify(p.report()));const script=new URL('../scripts/live-pilot-readout.mjs',import.meta.url);
  const r=JSON.parse(execFileSync(process.execPath,[decodeURIComponent(script.pathname),file],{encoding:'utf8'}));assert.equal(r.unaidedStarts,1);assert.equal(r.meaningfulReturns,1);assert.equal(r.medianCreationMs,60000);
  assert.throws(()=>execFileSync(process.execPath,[decodeURIComponent(script.pathname),file,file],{stdio:'pipe'}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
