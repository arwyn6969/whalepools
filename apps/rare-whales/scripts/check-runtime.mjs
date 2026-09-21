import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
// Exercise Wrangler's actual workerd runtime; Node's Response ignores encodeBody.
const require=createRequire(import.meta.url);
const wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare,convertV4MiniflareOptions}=await import(pathToFileURL(wranglerRequire.resolve('miniflare')));
const mf=new Miniflare(convertV4MiniflareOptions({name:'whale-pools-demo',modules:true,scriptPath:fileURLToPath(new URL('../build/cloudflare-worker.mjs',import.meta.url)),compatibilityDate:'2026-09-21',port:0}));
try{
 const origin=await mf.ready;
 for(const name of ['index.html','app.js','style.css','practice.json','whale.avif','art/whalestreet-1.avif']){
  const r=await fetch(new URL('/whalepools/'+name,origin));assert.equal(r.status,200);
  assert.deepEqual(Buffer.from(await r.arrayBuffer()),await readFile(new URL('../build/public/'+name,import.meta.url)),'HTTP decoded bytes differ for '+name);
 }
 const alias=await fetch(new URL('/whalepool/?crew=1',origin),{redirect:'manual'});assert.equal(alias.status,308);assert.equal(new URL(alias.headers.get('location')).pathname,'/whalepools/');assert.equal(new URL(alias.headers.get('location')).search,'?crew=1');
 console.log('Cloudflare runtime HTTP check passed: HTML, JS, CSS, data and image decode correctly.');
}finally{await mf.dispose();}
