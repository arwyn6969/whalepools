import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {build} from 'esbuild';
import {demoPaths} from '../src/demo-worker.mjs';
const app=fileURLToPath(new URL('..',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.avif':'image/avif','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
const assets={};
for(const name of demoPaths){if(name==='/')continue;const data=await readFile(path.join(app,'build/public',name));assets[name]={type:types[path.extname(name)],gzip:gzipSync(data,{level:9}).toString('base64')};}
const entry=`import {launchFetch} from '../src/launch-worker.mjs';\nconst assets=${JSON.stringify(assets)};\nexport default {fetch(request,env){return launchFetch(request,{...env,ASSETS:{fetch:async request=>{const asset=assets[new URL(request.url).pathname];if(!asset)return new Response('Not found',{status:404});const bytes=request.method==='HEAD'?null:Uint8Array.from(atob(asset.gzip),c=>c.charCodeAt(0));return new Response(bytes,{headers:{'content-type':asset.type,'content-encoding':'gzip'}});}}});}};\n`;
await writeFile(path.join(app,'build/demo-entry.mjs'),entry);
await build({entryPoints:[path.join(app,'build/demo-entry.mjs')],outfile:path.join(app,'build/cloudflare-worker.mjs'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
console.log('Self-contained read-only Cloudflare demo bundled; '+Object.keys(assets).length+' explicit assets.');
