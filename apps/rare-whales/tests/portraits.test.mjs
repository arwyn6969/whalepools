import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortraitResolver,ipfsArtworkURL,readMetadata} from '../src/portraits.mjs';
import {createPortraitLoader} from '../public/portraits.mjs';
const cid='bafkreib76ukgbyyd6n6l74oi2uipi6xnwzezxralsek6bfoh537g2jstau',uri='ipfs://'+cid;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('portraits reject unsafe identities and URI destinations',()=>{
 for(const x of ['https://evil.example/a','data:image/svg+xml,test','ipfs://'+cid+'/../secret','ipfs://'+cid+'/%2e%2e/a','ipfs://'+cid+'?x=1','ipfs://'+cid+'/a#b'])assert.throws(()=>ipfsArtworkURL(x));
 assert.equal(ipfsArtworkURL(uri+'/2.json'),'https://gateway.pinata.cloud/ipfs/'+cid+'/2.json');
 const r=createPortraitResolver();for(const [c,id] of [['constructor',1],['whalestreet',0],['rarewhales',1.5],['whalestreet',1000001]])assert.throws(()=>r.resolve(c,id));
});
test('metadata limits streamed bytes and fails on missing images or invalid responses',async()=>{
 await assert.rejects(readMetadata(new Response('x'.repeat(16385))));
 await assert.rejects(readMetadata(Response.json({image:'javascript:alert(1)'})));
 await assert.rejects(readMetadata(Response.json({})));await assert.rejects(readMetadata(new Response(null,{status:503})));
 assert.equal(await readMetadata(Response.json({image:uri})),ipfsArtworkURL(uri));
});
test('arbitrary portraits resolve both collections, deduplicate concurrent views, preserve local art and bound concurrency',async()=>{
 let calls=[],active=0,max=0;
 const r=createPortraitResolver({asset:p=>'/base'+p,readURI:async(c,id)=>{calls.push([c,id]);active++;max=Math.max(max,active);await tick();active--;return uri+'/'+id;},fetcher:async()=>Response.json({image:uri})});
 await Promise.all([r.resolve('whalestreet',2),r.resolve('whalestreet',2),r.resolve('rarewhales',2),r.resolve('whalestreet',3319),r.resolve('rarewhales',420)]);
 assert.equal(calls.length,4);assert.ok(max<=3);assert.ok(calls.some(x=>x[0]==='rarewhales'&&x[1]===2));
 assert.equal(await r.resolve('whalestreet',1),'/base/art/whalestreet-1.avif');assert.equal(calls.length,4);
});
test('failed metadata can be retried without repeatedly hammering an unavailable gateway',async()=>{
 let attempts=0;const r=createPortraitResolver({readURI:async()=>uri,fetcher:async()=>{if(++attempts===1)throw Error('offline');return Response.json({image:uri});}});
 await assert.rejects(r.resolve('whalestreet',2));await assert.rejects(r.resolve('whalestreet',2));assert.equal(attempts,1);
 r.retry('whalestreet',2);assert.equal(await r.resolve('whalestreet',2),ipfsArtworkURL(uri));assert.equal(attempts,2);
});
function image(){return {dataset:{collection:'whalestreet',token:'2'},isConnected:true,src:'',alt:'',onload:null,onerror:null};}
test('portrait lifecycle covers image failure, retry, detached/stale views and successful load',async()=>{
 const pending=[];const loader=createPortraitLoader({asset:p=>p,resolver:{resolve:()=>new Promise(resolve=>pending.push(resolve)),retry(){}},timeout:100});
 const img=image(),root={querySelectorAll:()=>[img]};loader.hydrate(root);loader.hydrate(root);assert.equal(pending.length,1);
 pending.shift()('https://gateway.pinata.cloud/a');await tick();img.onerror();assert.equal(img.dataset.artState,'error');assert.match(img.src,/missing/);
 loader.retry(root);pending.shift()('https://gateway.pinata.cloud/b');await tick();img.onload();assert.equal(img.dataset.artState,'ready');assert.equal(img.alt,'WhaleStreet #2');
 const stale=image();loader.hydrate({querySelectorAll:()=>[stale]});stale.dataset.token='3';pending.shift()('wrong');await tick();assert.notEqual(stale.src,'wrong');
 const detached=image();loader.hydrate({querySelectorAll:()=>[detached]});detached.isConnected=false;pending.shift()('wrong');await tick();assert.notEqual(detached.src,'wrong');
});
test('an image that never finishes gets an explicit retryable fallback',async()=>{
 const loader=createPortraitLoader({asset:p=>p,resolver:{resolve:async()=>'/unresponsive',retry(){}},timeout:5}),img=image();loader.hydrate({querySelectorAll:()=>[img]});
 await new Promise(resolve=>setTimeout(resolve,20));assert.equal(img.dataset.artState,'error');
});

test('retrying several views of one failed NFT reuses a single metadata read',async()=>{
 let calls=0,fail=true;const resolver=createPortraitResolver({readURI:async()=>{calls++;if(fail)throw Error('offline');return uri;},fetcher:async()=>Response.json({image:uri})});
 const loader=createPortraitLoader({asset:p=>p,resolver}),a=image(),b=image(),root={querySelectorAll:()=>[a,b]};loader.hydrate(root);await tick();assert.equal(calls,1);assert.equal(a.dataset.artState,'error');assert.equal(b.dataset.artState,'error');
 fail=false;loader.retry(root);await tick();a.onload();b.onload();assert.equal(calls,2);assert.equal(a.dataset.artState,'ready');assert.equal(b.dataset.artState,'ready');
});
test('the session metadata cache evicts old entries at its bound',async()=>{
 let calls=0;const r=createPortraitResolver({limit:2,readURI:async()=>{calls++;return uri;},fetcher:async()=>Response.json({image:uri})});
 for(const id of [2,3,4,2])await r.resolve('whalestreet',id);assert.equal(calls,4);
});
