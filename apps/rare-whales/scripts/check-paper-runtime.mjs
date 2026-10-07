import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {PAPER_RULES as R,initialState} from '../src/paper-engine.mjs';
import {NEUTRAL_PROFILE} from '../src/dna.mjs';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare,convertV4MiniflareOptions}=await import(pathToFileURL(wranglerRequire.resolve('miniflare')));
const rules=JSON.parse(await readFile(new URL('../build/public/paper-rules.json',import.meta.url)));
await mkdir(new URL('../work/',import.meta.url),{recursive:true});
// The clock-control endpoint exists only in this ignored runtime test wrapper.
const source=`import worker from '../build/cloudflare-worker.mjs';import {tickPaper} from '../src/paper-service.mjs';export default {...worker,async fetch(request,env){if(new URL(request.url).pathname==='/__test/tick')return Response.json(await tickPaper(env,{rulesHash:${JSON.stringify(rules.ruleHash)},now:Number(request.headers.get('fixture-now'))}));return worker.fetch(request,env);}};`;
await writeFile(new URL('../work/paper-runtime-entry.mjs',import.meta.url),source);
await build({entryPoints:[fileURLToPath(new URL('../work/paper-runtime-entry.mjs',import.meta.url))],outfile:fileURLToPath(new URL('../work/paper-runtime-worker.mjs',import.meta.url)),bundle:true,format:'esm',platform:'browser',target:'es2022'});
const base=Date.UTC(2026,9,7,12);let clock=base+R.interval+1000;
const mf=new Miniflare(convertV4MiniflareOptions({name:'paper-runtime-fixture',modules:true,scriptPath:fileURLToPath(new URL('../work/paper-runtime-worker.mjs',import.meta.url)),compatibilityDate:'2026-09-21',port:0,d1Databases:{DB:'isolated-paper-test'},bindings:{PAPER_ENABLED:'1'},outboundService:async request=>{
 const data=await request.json();if(data.type==='spotMeta')return Response.json({tokens:[{name:'UBTC',index:1},{name:'USDC',index:0}],universe:[{index:7,tokens:[1,0]}]});
 const latest=Math.floor(clock/R.interval)*R.interval-R.interval;
 return Response.json(Array.from({length:100},(_,i)=>{const t=latest-(99-i)*R.interval,p=199+(t-base)/R.interval;return {t,T:t+R.interval-1,s:'@7',i:'5m',o:String(p),h:String(p+.1),l:String(p-.1),c:String(p)};}));
}}));
try{
 await mf.ready;const db=await mf.getD1Database('DB');
 for(const name of ['0001_club.sql','0002_pool_agents.sql','0003_arcade.sql','0004_arcade_revisions.sql','0005_paper.sql'])await db.exec((await readFile(new URL('../migrations/'+name,import.meta.url),'utf8')).replace(/--[^\n]*/g,'').replace(/\n/g,' '));
 for(let i=0;i<3;i++){clock=base+(i+1)*R.interval+1000;const r=await mf.dispatchFetch('https://arwyn.party/__test/tick',{headers:{'fixture-now':String(clock)}});assert.equal(r.status,200);assert.equal((await r.json()).error,undefined);}
 const events=(await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events').first()).n;assert.ok(events>0);
 await mf.dispatchFetch('https://arwyn.party/__test/tick',{headers:{'fixture-now':String(clock)}});assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events').first()).n,events);
 const api=await mf.dispatchFetch('https://arwyn.party/whalepools/api/paper');assert.equal(api.status,200);const data=await api.json();assert.equal(data.enabled,true);assert.equal(data.labs.length,3);assert.equal(data.rulesHash,rules.ruleHash);assert.ok(data.labs.some(r=>r.events.length));
 const asset=await mf.dispatchFetch('https://arwyn.party/whalepools/paper-rules.json');assert.deepEqual(await asset.json(),rules);
 const anon=await mf.dispatchFetch('https://arwyn.party/whalepools/api/paper/start',{method:'POST',headers:{origin:'https://arwyn.party','content-type':'application/json'},body:'{}'});assert.equal(anon.status,401);
 const cross=await mf.dispatchFetch('https://arwyn.party/whalepools/api/paper',{headers:{'sec-fetch-site':'cross-site'}});assert.equal(cross.status,403);
 // Exercise the full declared cohort, including twelve whales in every holder crew.
 const agents=Array.from({length:12},(_,i)=>({collection:'rarewhales',tokenId:i+1,preset:'trend',profile:NEUTRAL_PROFILE}));
 for(let i=0;i<20;i++)await db.prepare("INSERT INTO wp_paper_runs(id,wallet,nickname,input_json,rules_hash,created_at,ends_at,status,state_json) VALUES(?,?,?,'{}',?,?,?,'running',?)").bind('load-'+i,'0x'+String(i+100).padStart(40,'0'),'Runtime load fixture '+i,rules.ruleHash,clock,clock+R.duration,JSON.stringify(initialState(agents,clock,Math.floor(clock/R.interval)*R.interval-R.interval))).run();
 const loadStart=Date.now();for(let i=0;i<2;i++){clock+=R.interval;const result=await (await mf.dispatchFetch('https://arwyn.party/__test/tick',{headers:{'fixture-now':String(clock)}})).json();assert.equal(result.error,undefined);assert.equal(result.runs,23);}
 const loadFills=(await db.prepare("SELECT COUNT(*) AS n FROM wp_paper_events WHERE run_id LIKE 'load-%'").first()).n;assert.equal(loadFills,240);
 console.log(JSON.stringify({event:'paper-full-cohort-runtime-fixture',holderRuns:20,whalesPerHolder:12,filledOrders:loadFills,twoTicksWallMs:Date.now()-loadStart,realMarket:false,realWallet:false}));
 await db.prepare("UPDATE wp_paper_runs SET status='stopped' WHERE id LIKE 'load-%'").run();
 const token='22'.repeat(32),address='0x'+'2'.repeat(40),hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex'),id=data.labs[0].id;
 await db.prepare('INSERT INTO rw_sessions(hash,address,expires) VALUES(?,?,?)').bind(hash,address,Date.now()+60000).run();await db.prepare('UPDATE wp_paper_runs SET wallet=? WHERE id=?').bind(address,id).run();
 const stopped=await mf.dispatchFetch('https://arwyn.party/whalepools/api/paper/stop',{method:'POST',headers:{origin:'https://arwyn.party','content-type':'application/json',cookie:'wp_arcade_session='+token},body:JSON.stringify({id,wallet:address})});assert.equal(stopped.status,200);assert.equal((await stopped.json()).run.status,'stopped');
 clock+=R.interval;await mf.dispatchFetch('https://arwyn.party/__test/tick',{headers:{'fixture-now':String(clock)}});assert.equal((await db.prepare('SELECT status FROM wp_paper_runs WHERE id=?').bind(id).first()).status,'stopped');
 console.log('Actual workerd/D1 paper runtime passed: recorder, atomic ledger, repeated ticks, public API/assets, session-bound stop and origin/anonymous rejection. Market and wallet are fixtures.');
}finally{await mf.dispose();}
