import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare,convertV4MiniflareOptions}=await import(pathToFileURL(wranglerRequire.resolve('miniflare')));
const paper=JSON.parse(await readFile(new URL('../build/public/paper-rules.json',import.meta.url))),tide=JSON.parse(await readFile(new URL('../build/public/tide-rules.json',import.meta.url)));
assert.equal(paper.ruleHash,'e2a7f52280106d1b0a97080f821fab64bf8a3568b13fb63ce54e77f7b03c1b97');
await mkdir(new URL('../work/',import.meta.url),{recursive:true});
// Only this ignored wrapper can override the scheduler clock; the public Worker cannot.
const source=`import worker from '../build/cloudflare-worker.mjs';import {tickPaper} from '../src/paper-service.mjs';import {tickTide} from '../src/daily-tide.mjs';export default {...worker,async fetch(request,env){if(new URL(request.url).pathname==='/__test/social-tick'){const now=Number(request.headers.get('fixture-now'));const paper=await tickPaper(env,{rulesHash:${JSON.stringify(paper.ruleHash)},now});const tide=await tickTide(env,{rulesHash:${JSON.stringify(tide.ruleHash)},paperHash:${JSON.stringify(paper.ruleHash)},now});return Response.json({paper,tide});}return worker.fetch(request,env);}};`;
await writeFile(new URL('../work/social-runtime-entry.mjs',import.meta.url),source);
await build({entryPoints:[fileURLToPath(new URL('../work/social-runtime-entry.mjs',import.meta.url))],outfile:fileURLToPath(new URL('../work/social-runtime-worker.mjs',import.meta.url)),bundle:true,format:'esm',platform:'browser',target:'es2022'});
const interval=300000,base=Date.UTC(2026,9,7,12),start=Date.UTC(2026,9,8);let clock=base+1000;
const mf=new Miniflare(convertV4MiniflareOptions({name:'fleet-social-runtime-fixture',modules:true,scriptPath:fileURLToPath(new URL('../work/social-runtime-worker.mjs',import.meta.url)),compatibilityDate:'2026-09-21',port:0,d1Databases:{DB:'isolated-social-test'},bindings:{PAPER_ENABLED:'1',TIDE_ENABLED:'1'},outboundService:async request=>{
 const data=await request.json();if(data.type==='spotMeta')return Response.json({tokens:[{name:'UBTC',index:1},{name:'USDC',index:0}],universe:[{index:7,tokens:[1,0]}]});
 const latest=Math.floor(clock/interval)*interval-interval;
 return Response.json(Array.from({length:100},(_,i)=>{const t=latest-(99-i)*interval,p=500+(t-base)/interval*.2;return {t,T:t+interval-1,s:'@7',i:'5m',o:String(p),h:String(p+.1),l:String(p-.1),c:String(p)};}));
}}));
const url='https://arwyn.party/whalepools';
try{
 await mf.ready;const db=await mf.getD1Database('DB');
 for(const name of ['0001_club.sql','0002_pool_agents.sql','0003_arcade.sql','0004_arcade_revisions.sql','0005_paper.sql','0006_daily_tide.sql'])await db.exec((await readFile(new URL('../migrations/'+name,import.meta.url),'utf8')).replace(/--[^\n]*/g,'').replace(/\n/g,' '));
 const tick=async()=>{const r=await mf.dispatchFetch('https://arwyn.party/__test/social-tick',{headers:{'fixture-now':String(clock)}});assert.equal(r.status,200);const data=await r.json();assert.equal(data.paper.error,undefined);return data;};
 await tick();const roundId='tide-'+tide.ruleHash.slice(0,12)+'-2026-10-08';
 const queued=await db.prepare('SELECT * FROM wp_tide_rounds WHERE id=?').bind(roundId).first();assert.equal(queued.status,'queued');assert.equal(queued.starts_at,start);
 for(let i=1;i<=3;i++){clock=start+i*interval+1000;await tick();}
 const events=(await db.prepare('SELECT COUNT(*) AS n FROM wp_tide_events').first()).n;assert.ok(events>0);await tick();assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM wp_tide_events').first()).n,events);
 const publicData=await (await mf.dispatchFetch(url+'/api/tide?round='+roundId)).json();assert.equal(publicData.rounds[0].strategies.length,3);assert.equal(publicData.rounds[0].status,'running');assert.ok(publicData.rounds[0].strategies.every(s=>s.rank===null&&s.observedBars===3));assert.equal(publicData.paperHash,paper.ruleHash);
 assert.deepEqual(await (await mf.dispatchFetch(url+'/tide-rules.json')).json(),tide);
 assert.equal((await mf.dispatchFetch(url+'/api/paper/history')).status,401);
 for(const p of ['/api/tide','/api/paper/history'])assert.equal((await mf.dispatchFetch(url+p,{headers:{'sec-fetch-site':'cross-site'}})).status,403);
 assert.equal((await mf.dispatchFetch(url+'/api/tide/join',{method:'POST',headers:{origin:'https://arwyn.party','content-type':'application/json'},body:'{}'})).status,401);
 const token='33'.repeat(32),address='0x'+'3'.repeat(40),sessionHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
 await db.prepare('INSERT INTO rw_sessions(hash,address,expires) VALUES(?,?,?)').bind(sessionHash,address,Date.now()+60000).run();
 const run=(await db.prepare('SELECT id FROM wp_paper_runs LIMIT 1').first()).id;await db.prepare('UPDATE wp_paper_runs SET wallet=? WHERE id=?').bind(address,run).run();
 const history=await mf.dispatchFetch(url+'/api/paper/history',{headers:{cookie:'wp_arcade_session='+token}});assert.equal(history.status,200);const archive=await history.json();assert.equal(archive.address,address);assert.equal(archive.runs.length,1);assert.equal(archive.runs[0].id,run);assert.equal('owner' in archive.runs[0],false);assert.equal('input_json' in archive.runs[0],false);
 assert.equal((await mf.dispatchFetch(url+'/api/paper/history?cursor=bad',{headers:{cookie:'wp_arcade_session='+token}})).status,400);
 assert.equal((await mf.dispatchFetch(url+'/api/tide/join',{method:'POST',headers:{origin:'https://other.invalid',cookie:'wp_arcade_session='+token,'content-type':'application/json'},body:'{}'})).status,403);
 // Force a partial finish, preserving public dated data and suppressing final ranks.
 await db.prepare("UPDATE wp_paper_feed SET error='fixture outage'").run();
 clock=start+86400000+1000;
 // Mark recorded candles stale without any attempt to fabricate missing observations.
 await db.prepare('UPDATE wp_paper_feed SET last_ok=?').bind(base).run();
 // Recovery can mark new prices, but the missing observations keep this round partial.
 await tick();const completed=await (await mf.dispatchFetch(url+'/api/tide?round='+roundId)).json();assert.equal(completed.rounds[0].status,'completed');assert.equal(completed.rounds[0].quality,'partial');assert.ok(completed.rounds[0].strategies.every(s=>s.rank===null));
 console.log(JSON.stringify({passed:true,runtime:'actual workerd and D1',fixtures:true,realEligibleWallet:false,paperHash:paper.ruleHash,tideHash:tide.ruleHash,checks:['additive migrations','prospective queue','shared observed candles','atomic ledger and duplicate tick','public API and exact rules asset','private session archive','invalid cursor','cross-origin and unsigned writes rejected','partial final results without ranks']}));
}finally{await mf.dispose();}
