import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {PAPER_RULES as R,initialState} from '../src/paper-engine.mjs';
import {NEUTRAL_PROFILE} from '../src/dna.mjs';
import {demoPaths} from '../src/demo-worker.mjs';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare,convertV4MiniflareOptions}=await import(pathToFileURL(wranglerRequire.resolve('miniflare')));
const paper=JSON.parse(await readFile(new URL('../build/public/paper-rules.json',import.meta.url))),tide=JSON.parse(await readFile(new URL('../build/public/tide-rules.json',import.meta.url)));
const name='market-v1:'+paper.ruleHash+':'+tide.ruleHash;
await mkdir(new URL('../work/',import.meta.url),{recursive:true});
// Only this ignored local wrapper controls time and exposes RPC diagnostics.
// It imports the exact staging bundle/class, not a replacement implementation.
const source=`import worker from '../build/paper-worker.mjs';export {PaperRecorder} from '../build/paper-worker.mjs';let clock=0;Date.now=()=>clock;export default {async fetch(request,env){const path=new URL(request.url).pathname;if(path==='/__test/status')return Response.json(await env.PAPER_RECORDER.getByName(${JSON.stringify(name)}).status());if(path==='/__test/wake'){clock=Number(request.headers.get('fixture-now'));const jobs=[];worker.scheduled({scheduledTime:clock-1000},env,{waitUntil:p=>jobs.push(p)});try{await Promise.all(jobs);return Response.json({outcome:'ok'});}catch{return Response.json({outcome:'failed'},{status:503});}}return worker.fetch(request,env);}};`;
await writeFile(new URL('../work/durable-runtime-entry.mjs',import.meta.url),source);
await build({entryPoints:[fileURLToPath(new URL('../work/durable-runtime-entry.mjs',import.meta.url))],outfile:fileURLToPath(new URL('../work/durable-runtime-worker.mjs',import.meta.url)),bundle:true,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:workers']});
const persist=await mkdtemp(fileURLToPath(new URL('../work/durable-runtime-',import.meta.url)));
let clock=Date.UTC(2026,9,8,10)+1000,fail=false,marketCalls=0;
const options=convertV4MiniflareOptions({name:'durable-recorder-runtime-fixture',modules:true,scriptPath:fileURLToPath(new URL('../work/durable-runtime-worker.mjs',import.meta.url)),compatibilityDate:'2026-09-21',port:0,resourcePersistencePath:persist,d1Databases:{DB:'isolated-durable-recorder-test'},durableObjects:{PAPER_RECORDER:{className:'PaperRecorder',useSQLite:true}},bindings:{PAPER_ENABLED:'1',TIDE_ENABLED:'1',RECORDER_MODE:'durable-object',APP_ORIGIN:'https://arwyn.party'},outboundService:async request=>{
 marketCalls++;if(fail)return new Response('fixture outage',{status:503});
 const data=await request.json();if(data.type==='spotMeta')return Response.json({tokens:[{name:'UBTC',index:1},{name:'USDC',index:0}],universe:[{index:7,tokens:[1,0]}]});
 const latest=Math.floor(clock/R.interval)*R.interval-R.interval;
 return Response.json(Array.from({length:100},(_,i)=>{const t=latest-(99-i)*R.interval,p=1000+(t-Date.UTC(2026,9,8,10))/R.interval;return {t,T:t+R.interval-1,s:'@7',i:'5m',o:String(p),h:String(p+.1),l:String(p-.1),c:String(p)};}));
}});
let mf=new Miniflare(options);
const wake=()=>mf.dispatchFetch('https://arwyn.party/__test/wake',{headers:{'fixture-now':String(clock)}});
const checkpoint=async()=> (await mf.dispatchFetch('https://arwyn.party/__test/status')).json();
const snapshot=async db=>(await db.prepare('SELECT id,created_at,ends_at,status,revision,state_json FROM wp_paper_runs ORDER BY id').all()).results;
try{
 await mf.ready;let db=await mf.getD1Database('DB');
 for(const file of ['0001_club.sql','0002_pool_agents.sql','0003_arcade.sql','0004_arcade_revisions.sql','0005_paper.sql','0006_daily_tide.sql'])await db.exec((await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).replace(/--[^\n]*/g,'').replace(/\n/g,' '));
 assert.equal((await wake()).status,200);assert.equal((await checkpoint()).status,'ok');
 const firstCalls=marketCalls,before=await snapshot(db);await Promise.all([wake(),wake(),wake()]);assert.equal(marketCalls,firstCalls);assert.deepEqual(await snapshot(db),before);
 const agents=Array.from({length:12},(_,i)=>({collection:'rarewhales',tokenId:i+1,preset:'trend',profile:NEUTRAL_PROFILE}));
 for(let i=0;i<20;i++)await db.prepare("INSERT INTO wp_paper_runs(id,wallet,nickname,input_json,rules_hash,created_at,ends_at,status,state_json) VALUES(?,?,?,'{}',?,?,?,'running',?)").bind('load-'+i,'0x'+String(i+100).padStart(40,'0'),'Disposable runtime holder',paper.ruleHash,clock,clock+R.duration,JSON.stringify(initialState(agents,clock,Math.floor(clock/R.interval)*R.interval-R.interval))).run();
 for(let i=0;i<2;i++){clock+=R.interval;assert.equal((await wake()).status,200);}
 assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM wp_paper_events WHERE run_id LIKE 'load-%' AND json_extract(event_json,'$.kind')='buy'").first()).n,240);
 const longStart=clock-3800*R.interval,grown=initialState(agents,longStart,Math.floor(clock/R.interval)*R.interval-R.interval);
 grown.history=Array.from({length:3800},(_,i)=>({t:longStart+(i+1)*R.interval,observedAt:longStart+(i+1)*R.interval+1000,equity:1000,hold:1000,price:200,actionable:true}));grown.observedBars=3800;
 await db.prepare("UPDATE wp_paper_runs SET state_json=? WHERE id LIKE 'load-%'").bind(JSON.stringify(grown)).run();
 clock+=R.interval;const started=Date.now();assert.equal((await wake()).status,200);const longWallMs=Date.now()-started;
 const longState=JSON.parse((await db.prepare("SELECT state_json FROM wp_paper_runs WHERE id='load-0'").first()).state_json);assert.equal(longState.history.length,3801);assert.equal(longState.history.at(-1).actionable,true);
 const saved=await snapshot(db),savedCheckpoint=await checkpoint(),beforeRestartCalls=marketCalls;
 await mf.dispose();mf=new Miniflare(options);await mf.ready;db=await mf.getD1Database('DB');
 assert.deepEqual(await checkpoint(),savedCheckpoint);assert.equal((await wake()).status,200);assert.equal(marketCalls,beforeRestartCalls);assert.deepEqual(await snapshot(db),saved);
 // Two failed tries are allowed per minute, including after a reconstruction.
 clock+=60000;fail=true;const callsBeforeFailure=marketCalls;
 assert.equal((await wake()).status,503);assert.equal((await wake()).status,503);assert.equal((await wake()).status,503);assert.equal(marketCalls-callsBeforeFailure,2);assert.equal((await checkpoint()).status,'failed');
 assert.deepEqual(await snapshot(db),saved);fail=false;clock+=60000;assert.equal((await wake()).status,200);assert.equal((await checkpoint()).status,'ok');
 // Recovery after downtime must not fill past closes. Original v1 records remain.
 const gapStart=Math.floor(clock/R.interval)*R.interval;clock+=3*R.interval;assert.equal((await wake()).status,200);
 assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM wp_paper_events WHERE bar_t>=? AND bar_t<? AND json_extract(event_json,'$.kind') IN ('buy','sell')").bind(gapStart,Math.floor(clock/R.interval)*R.interval-R.interval).first()).n,0);
 const recovered=JSON.parse((await db.prepare("SELECT state_json FROM wp_paper_runs WHERE id='load-0'").first()).state_json);assert.ok(recovered.gapBars>0);
 for(const path of demoPaths){const response=await mf.dispatchFetch('https://arwyn.party/whalepools'+path);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(new URL('../build/public'+(path==='/'?'/index.html':path),import.meta.url)));}
 assert.equal((await mf.dispatchFetch('https://arwyn.party/whalepools/api/paper/start',{method:'POST',headers:{origin:'https://arwyn.party','content-type':'application/json'},body:'{}'})).status,401);
 assert.equal((await mf.dispatchFetch('https://arwyn.party/whalepools/api/paper/coverage',{headers:{'sec-fetch-site':'cross-site'}})).status,403);
 const record={passed:true,runtime:'actual workerd, SQLite Durable Object RPC and D1',fixtures:true,realEligibleWallet:false,cloudflareFreeCpuSimulated:false,paperHash:paper.ruleHash,tideHash:tide.ruleHash,fullCohort:{holders:20,whalesPerHolder:12,savedCloses:3800,tickWallMs:longWallMs},checks:['compiled staging export and private scheduled RPC','persisted duplicate suppression','20 x 12 whales and 240 fills','3800-close cohort advances','complete runtime restart retains coordinator and companies','bounded failed retries and next-minute recovery','outage closes valued without retrospective fills','exact public assets and guarded API']};
 await writeFile(new URL('../work/durable-runtime.json',import.meta.url),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
}finally{await mf.dispose();}
