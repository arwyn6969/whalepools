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
 for(const name of ['0001_club.sql','0002_pool_agents.sql','0003_arcade.sql']){const sql=await readFile(new URL('../migrations/'+name,import.meta.url),'utf8');await db.exec(sql.replace(/\n/g,' '));}
 // Production origin is deliberately fixed, so localhost requests need the declared host through dispatchFetch.
 const publicClub=await mf.dispatchFetch('https://arwyn.party/whalepools/api/club');assert.equal(publicClub.status,200);assert.equal((await publicClub.json()).arcade.mode,'arcade');
 const empty=await mf.dispatchFetch('https://arwyn.party/whalepools/api/crew');assert.deepEqual((await empty.json()).seats,[]);
 const blocked=await mf.dispatchFetch('https://arwyn.party/whalepools/api/seat',{method:'POST',headers:{origin:'https://arwyn.party','content-type':'application/json'},body:'{}'});assert.equal(blocked.status,401);
 for(const name of ['index.html','app.js','style.css','practice.json','claims.json','whale.avif','art/whalestreet-1.avif','art/wax-tub.svg','art/surfboard.svg','art/holy-brick.svg','art/captain-crown.svg','art/portrait-loading.svg','art/portrait-missing.svg']){
  const r=await fetch(new URL('/whalepools/'+name,origin));assert.equal(r.status,200);
  if(name.endsWith('.svg'))assert.equal(r.headers.get('content-type'),'image/svg+xml');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()),await readFile(new URL('../build/public/'+name,import.meta.url)),'HTTP decoded bytes differ for '+name);
 }
 const alias=await fetch(new URL('/whalepool/?crew=1',origin),{redirect:'manual'});assert.equal(alias.status,308);assert.equal(new URL(alias.headers.get('location')).pathname,'/whalepools/');assert.equal(new URL(alias.headers.get('location')).search,'?crew=1');
 console.log('Cloudflare runtime passed: assets decode, D1 schema/empty board work and unauthenticated writes are blocked.');
}finally{await mf.dispose();}
