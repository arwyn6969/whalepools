import {companyId} from '../public/company-share.mjs';
import {paperURL} from '../public/paper-share.mjs';
import {demoHeaders} from './demo-worker.mjs';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=t=>t?new Date(t).toISOString().slice(0,16).replace('T',' ')+' UTC':'not observed yet';
export async function watchPreview(request,env,{paper,base}){
 const url=new URL(request.url),path=url.pathname.slice(base.length),id=path.slice('/watch/'.length);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not supported',{status:405,headers:demoHeaders});
 if(env.PAPER_ENABLED!=='1'||!companyId(id))return new Response('That dated paper watch was not found.',{status:404,headers:demoHeaders});
 if(!env.APP_ORIGIN||url.origin!==env.APP_ORIGIN)return new Response('Application origin is not configured for this host.',{status:503,headers:demoHeaders});
 try{
  const {run}=await paper.read({db:env.DB,env,id:id.toLowerCase()});
  const last=run.history.at(-1),canonical=paperURL(env.APP_ORIGIN+base+'/',run.id);
  const title=run.nickname+' · Whale Pools paper watch';
  const description=`Live market, simulated money. $${run.stats.equity.toFixed(2)} paper balance at ${stamp(last?.t)}. ${run.status}. Started ${stamp(run.createdAt)}. ${run.observedBars} timely observations; ${run.gapBars} skipped/gap bars. Different start dates are not league ranks.`;
  const asset=await env.ASSETS.fetch(new Request(env.APP_ORIGIN+'/index.html'));
  if(asset.status!==200)throw Error('Missing preview shell');
  const decoded=asset.headers.get('content-encoding')==='gzip'?new Response(asset.body.pipeThrough(new DecompressionStream('gzip'))):asset;
  let html=await decoded.text();
  html=html.replace(/<title>[\s\S]*?<\/title>/,`<title>${esc(title)}</title>`).replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${esc(description)}">`);
  const cover=env.APP_ORIGIN+base+'/art/paper-preview.png';
  html=html.replace('</head>',`<link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(cover)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Whale Pools live market, simulated money. Open the watch for its dated results."><meta name="twitter:card" content="summary_large_image"></head>`);
  // CSP forbids <base>. Only the shell's relative asset references are rewritten.
  html=html.replace(/(src|href)="\.\//g,`$1="${esc(base)}/`);
  html=html.replace('<body>',`<body><noscript><article class="panel watch-fallback"><h1>${esc(run.nickname)}</h1><p>${esc(description)}</p><p>Rules ${esc(run.rulesHash)} · $1,000 starting paper budget · 0.08% fee + 0.05% slippage per side.</p><p>Enable JavaScript to inspect this public watch and its daily recap.</p><a href="${esc(env.APP_ORIGIN+base+'/#paper/'+run.id)}">Open the dated watch →</a></article></noscript>`);
  return new Response(request.method==='HEAD'?null:html,{headers:{...demoHeaders,'content-type':'text/html; charset=utf-8'}});
 }catch(e){return new Response(e.status===404?'That dated paper watch was not found.':'Could not load this watch. Please try again.',{status:e.status===404?404:503,headers:demoHeaders});}
}
