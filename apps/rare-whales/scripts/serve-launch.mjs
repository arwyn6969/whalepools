import http from 'node:http';
import {readFile} from 'node:fs/promises';
const port=48374,origin=`http://127.0.0.1:${port}`;
const types={'/index.html':'text/html','/style.css':'text/css','/launch.js':'application/javascript','/launch.json':'application/json','/standard-input.json':'application/json','/wax-tub.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,origin),name=url.pathname==='/'?'/index.html':url.pathname;
 if(req.headers.host!==`127.0.0.1:${port}`||!['GET','HEAD'].includes(req.method)||!types[name]){res.writeHead(404);res.end();return;}
 try{const bytes=await readFile(new URL('../build/launch'+name,import.meta.url));res.writeHead(200,{'content-type':types[name],'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://rpc.mainnet.chain.robinhood.com; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"});res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(503);res.end('Run npm run launch:prepare first.');}
}).listen(port,'127.0.0.1',()=>console.log('WWAX launch desk: '+origin+'/ — local operator page; no server wallet or private keys.'));
