import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {acceptanceContext} from '../src/holder-acceptance.mjs';

const files=new Map([
 ['/', ['../operator/playtest.html','text/html; charset=utf-8']],
 ['/playtest.css',['../operator/playtest.css','text/css; charset=utf-8']],
 ['/playtest.mjs',['../operator/playtest.mjs','text/javascript; charset=utf-8']],
 ['/playtest-session.mjs',['../src/playtest-session.mjs','text/javascript; charset=utf-8']],
 ['/holder-acceptance.mjs',['../src/holder-acceptance.mjs','text/javascript; charset=utf-8']]
]);
export async function startPlaytestServer({context,port=48395}){
 context=acceptanceContext(context);
 const buffers=new Map(await Promise.all([...files].map(async([p,[file,type]])=>[p,{type,body:await readFile(new URL(file,import.meta.url))}])));
 const server=createServer((req,res)=>{
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"};
  const host=req.headers.host;
  if(![`127.0.0.1:${server.address().port}`,`localhost:${server.address().port}`].includes(host)){res.writeHead(403,headers);res.end('Local host only');return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{...headers,Allow:'GET, HEAD'});res.end();return;}
  const url=new URL(req.url,'http://'+host);
  const entry=url.pathname==='/context.json'?{type:'application/json',body:JSON.stringify(context)}:buffers.get(url.pathname);
  if(url.search||!entry){res.writeHead(404,headers);res.end('Not found');return;}
  res.writeHead(200,{...headers,'Content-Type':entry.type});res.end(req.method==='HEAD'?undefined:entry.body);
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [candidateCommit,base]=process.argv.slice(2);
 const paper=JSON.parse(await readFile(new URL('../build/public/paper-rules.json',import.meta.url))),tide=JSON.parse(await readFile(new URL('../build/public/tide-rules.json',import.meta.url)));
 const server=await startPlaytestServer({context:{candidateCommit,base,paperHash:paper.ruleHash,tideHash:tide.ruleHash},port:Number(process.env.RW_PLAYTEST_PORT||48395)});
 console.log('Private, loopback-only playtest desk: '+server.origin+' · candidate '+candidateCommit+'. No uploads, app state changes or challenge activation.');
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
}
