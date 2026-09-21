import season from '../season.json' with {type:'json'};
import {COLLECTIONS,STRATEGIES} from './config.mjs';

export const demoPaths=new Set(['/','/index.html','/app.js','/style.css','/practice.json','/whale.avif','/art/pixel.ttf','/art/OFL.txt','/art/whale-246.avif','/art/whale-247.avif','/art/whale-248.avif']);
export const demoHeaders={
 'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()',
 'cache-control':'no-store'
};
const json=(data,status=200)=>Response.json(data,{status,headers:demoHeaders});
// This demo has no database, wallet authentication, RPC calls, secrets or transaction handlers.
export async function demoFetch(request,env){
 const url=new URL(request.url),base=env.BASE_PATH??'/whalepools';
 if(base&&url.pathname===base){url.pathname=base+'/';return new Response(null,{status:308,headers:{...demoHeaders,location:url.href}});}
 if(base&&!url.pathname.startsWith(base+'/'))return new Response('Not found',{status:404,headers:demoHeaders});
 const path=url.pathname.slice(base.length)||'/';
 if(path.startsWith('/api/')){
  if(request.method==='GET'&&path==='/api/club')return json({demo:true,season:{...season,status:'draft',access:{...season.access,founderWallets:undefined,founderCount:season.access.founderWallets.length}},collections:COLLECTIONS,strategies:STRATEGIES,registrationOpen:false,seats:0,me:null});
  if(request.method==='GET'&&path==='/api/crew')return json({demo:true,seats:[],status:'draft',hasPerformance:false});
  return json({error:'Public demo only. Wallet registration, staking, claims and deposits are not open.'},403);
 }
 if(!['GET','HEAD'].includes(request.method)||!demoPaths.has(path))return new Response('Not found',{status:404,headers:demoHeaders});
 if(!env.ASSETS)return new Response('Demo assets unavailable',{status:503,headers:demoHeaders});
 url.pathname=path==='/'?'/index.html':path;
 const result=await env.ASSETS.fetch(new Request(url,{method:request.method}));
 const headers=new Headers(result.headers);for(const [k,v]of Object.entries(demoHeaders))headers.set(k,v);
 return new Response(request.method==='HEAD'?null:result.body,{status:result.status,headers});
}
export default {fetch:demoFetch};
