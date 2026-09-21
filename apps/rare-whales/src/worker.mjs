import season from '../season.json' with {type:'json'};
import { createApi } from './api.mjs';
const api=createApi({season});
const paths=new Set(['/','/index.html','/app.js','/style.css','/practice.json','/whale.avif','/art/pixel.ttf','/art/OFL.txt','/art/whale-246.avif','/art/whale-247.avif','/art/whale-248.avif']);
export default {
  async fetch(request,env) {
    const response=await api(request,env);
    if(response)return response;
    const url=new URL(request.url);
    if(!['GET','HEAD'].includes(request.method)||!paths.has(url.pathname))return new Response('Not found',{status:404});
    if(!env.ASSETS)return new Response('Assets unavailable',{status:503});
    const asset=await env.ASSETS.fetch(request),headers=new Headers(asset.headers);
    for(const [k,v]of Object.entries(securityHeaders))headers.set(k,v);
    return new Response(asset.body,{status:asset.status,headers});
  }
};
export const securityHeaders={
  'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()',
  'cache-control':'no-store'
};
