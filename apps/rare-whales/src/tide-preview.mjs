import {validTideId,tideShareData,tideStory} from '../public/tide-share.mjs';
import {demoHeaders} from './demo-worker.mjs';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function tidePreview(request,env,{social,base}){
 const url=new URL(request.url),id=url.pathname.slice((base+'/tide/').length);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not supported',{status:405,headers:demoHeaders});
 if(env.PAPER_ENABLED!=='1'||env.TIDE_ENABLED!=='1'||!validTideId(id))return new Response('That dated round was not found.',{status:404,headers:demoHeaders});
 if(!env.APP_ORIGIN||url.origin!==env.APP_ORIGIN)return new Response('Application origin is not configured for this host.',{status:503,headers:demoHeaders});
 try{
  const query=new URL(env.APP_ORIGIN+'/api/tide');query.searchParams.set('round',id);
  const result=await social.tide({db:env.DB,me:null,env,url:query}),round=result.rounds.find(r=>r.id===id);if(!round)throw {status:404};
  const share=tideShareData(round,env.APP_ORIGIN+base+'/'),story=tideStory(round);
  const asset=await env.ASSETS.fetch(new Request(env.APP_ORIGIN+'/index.html'));if(asset.status!==200)throw Error('Missing shell');
  // This is the fixed allowlisted shell, not an unbounded remote HTML response.
  const decoded=asset.headers.get('content-encoding')==='gzip'?new Response(asset.body.pipeThrough(new DecompressionStream('gzip'))):asset;
  let html=await decoded.text();html=html.replace(/<title>[\s\S]*?<\/title>/,`<title>${esc(share.title)}</title>`).replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${esc(share.text)}">`);
  html=html.replace('</head>',`<link rel="canonical" href="${esc(share.url)}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(share.title)}"><meta property="og:description" content="${esc(share.text)}"><meta property="og:url" content="${esc(share.url)}"><meta property="og:image" content="${esc(env.APP_ORIGIN+base+'/art/paper-preview.png')}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Whale Pools live market, simulated money. Open the dated Tide for its actual results."><meta name="twitter:card" content="summary_large_image"></head>`);
  html=html.replace(/(src|href)="\.\//g,`$1="${esc(base)}/`);
  const balances=round.strategies.map(s=>`<li>${esc(s.name)}: $${s.stats.equity.toFixed(2)} · ${s.stats.returnPct.toFixed(3)}% net · ${s.observedBars}/288 timely observations · ${s.gapBars} skipped/gap bars${story.final?' · rank '+s.rank:''}</li>`).join('');
  html=html.replace('<body>',`<body><noscript><article class="panel watch-fallback"><h1>${esc(share.title)}</h1><h2>${esc(story.title)}</h2><p>${esc(share.text)}</p><ul>${balances}</ul><p>Rules ${esc(round.rulesHash)}. Marked balances include modeled costs; they are not realized profit.</p><a href="${esc(env.APP_ORIGIN+base+'/#tide/'+id)}">Inspect this dated round →</a></article></noscript>`);
  return new Response(request.method==='HEAD'?null:html,{headers:{...demoHeaders,'content-type':'text/html; charset=utf-8'}});
 }catch(e){return new Response(e.status===404?'That dated round was not found.':'Could not load this round. Please retry.',{status:e.status===404?404:503,headers:demoHeaders});}
}
