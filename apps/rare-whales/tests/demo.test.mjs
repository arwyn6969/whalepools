import test from 'node:test';
import assert from 'node:assert/strict';
import {demoFetch,demoPaths} from '../src/demo-worker.mjs';
const req=(path,method='GET')=>new Request('https://arwyn.party'+path,{method});
const env={ASSETS:{fetch:async request=>new Response(request.method==='HEAD'?null:new URL(request.url).pathname,{headers:{'content-type':'text/plain'}})}};
test('demo canonicalizes only its own root and preserves the query',async()=>{
 const r=await demoFetch(req('/whalepools?hello=1'),env);assert.equal(r.status,308);assert.equal(r.headers.get('location'),'https://arwyn.party/whalepools/?hello=1');
 for(const p of ['/vectordesk/','/','/whalepools-other','/whalepools-other/app.js','/api/club'])assert.equal((await demoFetch(req(p),env)).status,404);
});
test('singular alias preserves deep links and query and never captures neighboring prefixes',async()=>{
 for(const [input,output] of [['/whalepool','/whalepools/'],['/whalepool/','/whalepools/'],['/whalepool/app.js?v=1','/whalepools/app.js?v=1']]){
  const r=await demoFetch(req(input),env);assert.equal(r.status,308);assert.equal(r.headers.get('location'),'https://arwyn.party'+output);
 }
 for(const p of ['/whalepooling/','/whalepool-other','/whalepool-other/app.js'])assert.equal((await demoFetch(req(p),env)).status,404);
});
test('demo rewrites allowed static assets under the exact prefix',async()=>{
 for(const p of demoPaths){const r=await demoFetch(req('/whalepools'+p),env);assert.equal(r.status,200);assert.equal(await r.text(),p==='/'?'/index.html':p);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);}
 assert.equal((await demoFetch(req('/whalepools/app.js','HEAD'),env)).body,null);
 for(const p of ['/season.json','/worker.mjs','/art/sources.json','/.env','/missing'])assert.equal((await demoFetch(req('/whalepools'+p),env)).status,404);
});
test('demo has empty honest state and rejects all auth and financial writes without bindings',async()=>{
 const club=await (await demoFetch(req('/whalepools/api/club'),{})).json();assert.equal(club.demo,true);assert.equal(club.registrationOpen,false);assert.equal(club.me,null);assert.equal(club.season.access.founderWallets,undefined);assert.deepEqual(club.season.access.balanceCollections,['rarewhales','whalestreet']);
 const crew=await (await demoFetch(req('/whalepools/api/crew'),{})).json();assert.deepEqual(crew.seats,[]);assert.equal(crew.hasPerformance,false);
 for(const p of ['auth/challenge','auth/verify','seat','claim','stake','deposit'])for(const method of ['GET','POST','DELETE']){const r=await demoFetch(req('/whalepools/api/'+p,method),{});assert.equal(r.status,403);assert.equal(r.headers.get('set-cookie'),null);}
});
test('demo local root mode and unavailable assets fail explicitly',async()=>{
 assert.equal(await (await demoFetch(req('/app.js'),{...env,BASE_PATH:''})).text(),'/app.js');assert.equal((await demoFetch(req('/whalepools/app.js'),{})).status,503);
});
