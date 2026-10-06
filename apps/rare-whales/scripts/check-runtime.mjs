import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
// Exercise Wrangler's actual workerd runtime; Node's Response ignores encodeBody.
const require=createRequire(import.meta.url);
const wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare,convertV4MiniflareOptions}=await import(pathToFileURL(wranglerRequire.resolve('miniflare')));
const mf=new Miniflare(convertV4MiniflareOptions({name:'whale-pools-demo',modules:true,scriptPath:fileURLToPath(new URL('../build/cloudflare-worker.mjs',import.meta.url)),compatibilityDate:'2026-09-21',port:0,d1Databases:{DB:'arcade-test'}}));
try{
 const origin=await mf.ready,db=await mf.getD1Database('DB');
 for(const name of ['0001_club.sql','0002_pool_agents.sql','0003_arcade.sql','0004_arcade_revisions.sql']){const sql=await readFile(new URL('../migrations/'+name,import.meta.url),'utf8');await db.exec(sql.replace(/--[^\n]*/g,'').replace(/\n/g,' '));}
 // Production origin is deliberately fixed, so localhost requests need the declared host through dispatchFetch.
 const publicClub=await mf.dispatchFetch('https://arwyn.party/whalepools/api/club');assert.equal(publicClub.status,200);assert.equal((await publicClub.json()).arcade.mode,'arcade');
 const empty=await mf.dispatchFetch('https://arwyn.party/whalepools/api/crew');assert.deepEqual((await empty.json()).seats,[]);
 const absent=await mf.dispatchFetch('https://arwyn.party/whalepools/api/company/'+crypto.randomUUID());assert.equal(absent.status,404);
 const invalid=await mf.dispatchFetch('https://arwyn.party/whalepools/api/company/not-a-company');assert.equal(invalid.status,404);
 const blocked=await mf.dispatchFetch('https://arwyn.party/whalepools/api/seat',{method:'POST',headers:{origin:'https://arwyn.party','content-type':'application/json'},body:'{}'});assert.equal(blocked.status,401);
 // Exercise the actual D1 transaction guard with an authenticated fixture
 // session. This covers withdrawal concurrency, not real wallet signing.
 const token='11'.repeat(32),address='0x'+'1'.repeat(40),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 await db.prepare('INSERT INTO rw_sessions(hash,address,expires) VALUES (?,?,?)').bind(hash,address,Date.now()+60000).run();
 const sessionHeaders={origin:'https://arwyn.party',cookie:'wp_arcade_session='+token},mutationId=crypto.randomUUID();
 const missingVersion=await mf.dispatchFetch('https://arwyn.party/whalepools/api/seat',{method:'DELETE',headers:sessionHeaders});assert.equal(missingVersion.status,400);
 const mutationHeaders={...sessionHeaders,'x-whale-revision':'0','x-whale-mutation':mutationId};
 const removed=await mf.dispatchFetch('https://arwyn.party/whalepools/api/seat',{method:'DELETE',headers:mutationHeaders});assert.equal(removed.status,200);assert.equal((await removed.json()).revision,1);
 const repeated=await mf.dispatchFetch('https://arwyn.party/whalepools/api/seat',{method:'DELETE',headers:mutationHeaders});assert.equal(repeated.status,409);
 const me=(await (await mf.dispatchFetch('https://arwyn.party/whalepools/api/club',{headers:sessionHeaders})).json()).me;assert.equal(me.seat,null);assert.equal(me.revision,1);assert.equal(me.mutationId,mutationId);
 for(const name of ['index.html','app.js','style.css','practice.json','challenge.json','claims.json','whale.avif','art/whalestreet-1.avif','art/wax-tub.svg','art/surfboard.svg','art/holy-brick.svg','art/captain-crown.svg','art/portrait-loading.svg','art/portrait-missing.svg']){
  const r=await fetch(new URL('/whalepools/'+name,origin));assert.equal(r.status,200);
  if(name.endsWith('.svg'))assert.equal(r.headers.get('content-type'),'image/svg+xml');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()),await readFile(new URL('../build/public/'+name,import.meta.url)),'HTTP decoded bytes differ for '+name);
 }
 const alias=await fetch(new URL('/whalepool/?crew=1',origin),{redirect:'manual'});assert.equal(alias.status,308);assert.equal(new URL(alias.headers.get('location')).pathname,'/whalepools/');assert.equal(new URL(alias.headers.get('location')).search,'?crew=1');
 console.log('Cloudflare runtime passed: assets decode, D1 schema/empty board work, unauthenticated writes are blocked, and authenticated fixture withdrawals preserve revisions and reject stale replay.');
}finally{await mf.dispose();}
