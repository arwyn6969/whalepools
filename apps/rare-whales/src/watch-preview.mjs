import {companyId} from '../public/company-share.mjs';
import {paperURL,recapShareData,validRecapDate} from '../public/paper-share.mjs';
import {demoHeaders} from './demo-worker.mjs';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=t=>t?new Date(t).toISOString().slice(0,16).replace('T',' ')+' UTC':'not observed yet';
export async function watchPreview(request,env,{paper,base,recaps}){
 const url=new URL(request.url),path=url.pathname.slice(base.length),id=path.slice('/watch/'.length);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not supported',{status:405,headers:demoHeaders});
 if(env.PAPER_ENABLED!=='1'||!companyId(id))return new Response('That dated paper watch was not found.',{status:404,headers:demoHeaders});
 if(!env.APP_ORIGIN||url.origin!==env.APP_ORIGIN)return new Response('Application origin is not configured for this host.',{status:503,headers:demoHeaders});
 try{
  const day=url.searchParams.get('day');
  if(url.searchParams.has('day')&&(!validRecapDate(day)||url.searchParams.getAll('day').length!==1))throw {status:400};
  // Day previews need the public name, not a second full watch/history decode.
  let run;
  if(day){const meta=await env.DB.prepare('SELECT nickname,rules_hash FROM wp_paper_runs WHERE id=?').bind(id.toLowerCase()).first();if(!meta)throw {status:404};run={id:id.toLowerCase(),nickname:meta.nickname,rulesHash:meta.rules_hash};}
  else{({run}=await paper.read({db:env.DB,env,id:id.toLowerCase()}));}
  const recap=day?await recaps.read({db:env.DB,env,id:run.id,url}):null,share=recap?recapShareData(recap,run.nickname,env.APP_ORIGIN+base+'/'):null;
  const last=run.history?.at(-1),canonical=share?.url??paperURL(env.APP_ORIGIN+base+'/',run.id);
  const title=share?.title??run.nickname+' · Whale Pools paper watch';
  const description=share?.text??`Live market, simulated money. $${run.stats.equity.toFixed(2)} paper balance at ${stamp(last?.t)}. ${run.status}. Started ${stamp(run.createdAt)}. ${run.observedBars} timely observations; ${run.gapBars} skipped/gap bars. Different start dates are not league ranks.`;
  const asset=await env.ASSETS.fetch(new Request(env.APP_ORIGIN+'/index.html'));
  if(asset.status!==200)throw Error('Missing preview shell');
  const decoded=asset.headers.get('content-encoding')==='gzip'?new Response(asset.body.pipeThrough(new DecompressionStream('gzip'))):asset;
  let html=await decoded.text();
  html=html.replace(/<title>[\s\S]*?<\/title>/,`<title>${esc(title)}</title>`).replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${esc(description)}">`);
  const cover=env.APP_ORIGIN+base+'/art/paper-preview.png';
  html=html.replace('</head>',`<link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(cover)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Whale Pools live market, simulated money. Open the watch for its dated results."><meta name="twitter:card" content="summary_large_image"></head>`);
  // CSP forbids <base>. Only the shell's relative asset references are rewritten.
  html=html.replace(/(src|href)="\.\//g,`$1="${esc(base)}/`);
  html=html.replace('<body>',`<body><noscript><article class="panel watch-fallback"><h1>${esc(run.nickname)}</h1><p>${esc(description)}</p><p>Rules ${esc(run.rulesHash)} · $1,000 starting paper budget · 0.08% fee + 0.05% slippage per side.</p><p>Enable JavaScript to inspect this public watch and its daily recap.</p><a href="${esc(recap?canonical:env.APP_ORIGIN+base+'/#paper/'+run.id)}">Open the dated watch →</a></article></noscript>`);
  return new Response(request.method==='HEAD'?null:html,{headers:{...demoHeaders,'content-type':'text/html; charset=utf-8'}});
 }catch(e){return new Response(e.status===400?'Choose a valid saved UTC day.':e.status===404?'That watch or UTC day was not found.':'Could not load this watch. Please try again.',{status:[400,404].includes(e.status)?e.status:503,headers:demoHeaders});}
}
