import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import worker from '../build/cloudflare-worker.mjs';
import {demoPaths} from '../src/demo-worker.mjs';
for(const p of demoPaths){
 const r=await worker.fetch(new Request('https://arwyn.party/whalepools'+p));
 assert.equal(r.status,200);assert.equal(r.headers.get('content-encoding'),'gzip');
 assert.deepEqual(gunzipSync(Buffer.from(await r.arrayBuffer())),await readFile(new URL('../build/public'+(p==='/'?'/index.html':p),import.meta.url)));
}
assert.equal((await worker.fetch(new Request('https://arwyn.party/vectordesk/'))).status,404);
assert.equal((await worker.fetch(new Request('https://arwyn.party/whalepools/api/auth/challenge',{method:'POST'}))).status,403);
assert.equal((await (await worker.fetch(new Request('https://arwyn.party/whalepools/api/club'))).json()).demo,true);
console.log('Compiled demo: all embedded asset bytes, prefix isolation and disabled auth verified.');
