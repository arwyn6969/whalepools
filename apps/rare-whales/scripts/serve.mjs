import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {database} from './database.mjs';
const app=fileURLToPath(new URL('..',import.meta.url));
const localAuth=process.env.RW_LOCAL_AUTH==='1';
const module=await import(localAuth?'../build/worker.mjs':'../build/launch-worker.mjs'),worker=module.default;
await mkdir(path.join(app,'work'),{recursive:true});
const paperEnabled=process.env.RW_PAPER==='1';
const DB=database(path.join(app,'work',paperEnabled?'paper.sqlite':localAuth?'club.sqlite':'arcade.sqlite'));
const port=Number(process.env.RW_PORT||48372),origin=`http://127.0.0.1:${port}`;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.avif':'image/avif','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
const ASSETS={async fetch(request){let name=new URL(request.url).pathname;if(name==='/')name='/index.html';try{const data=await readFile(path.join(app,'build/public',name));return new Response(request.method==='HEAD'?null:data,{headers:{'content-type':types[path.extname(name)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}}};
const env={DB,ASSETS,APP_ORIGIN:origin,BASE_PATH:process.env.RW_BASE_PATH||'',PAPER_ENABLED:paperEnabled?'1':'0'};
let recording=Promise.resolve(),recordingBusy=false;
async function record(){if(recordingBusy||!paperEnabled)return;recordingBusy=true;try{console.log(JSON.stringify({event:'local-paper-tick',...await module.launchTick(env)}));}catch(e){console.error('Paper recorder failed: '+e.message);}finally{recordingBusy=false;}}
const timer=paperEnabled?setInterval(()=>{recording=record();},60000):null;
if(paperEnabled)recording=record();
const server=http.createServer(async(req,res)=>{
 try{
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>8192){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
  const headers=new Headers(req.headers);headers.set('cf-connecting-ip',req.socket.remoteAddress||'local');
  const request=new Request(origin+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await worker.fetch(request,env);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Preview unavailable.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Rare Whales preview: ${origin}/`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(timer);server.close(async()=>{await recording;DB.close();process.exit(0);});});
