import season from '../arcade.json' with {type:'json'};
import scores from '../build/arcade-scores.json' with {type:'json'};
import {createApi} from './api.mjs';
import {createArcadeBoard} from './arcade-board.mjs';
import {demoFetch,demoHeaders} from './demo-worker.mjs';
import {createPaperService,tickPaper} from './paper-service.mjs';
import paperRules from '../build/public/paper-rules.json' with {type:'json'};
const board=createArcadeBoard({season,scores,ruleHash:scores.ruleHash}),paper=createPaperService({season,rulesHash:paperRules.ruleHash}),api=createApi({season,board,paper});
export function launchTick(env){return tickPaper(env,{rulesHash:paperRules.ruleHash});}
export async function launchFetch(request,env){
 const url=new URL(request.url),base=env.BASE_PATH??'/whalepools';
 if(url.pathname.startsWith(base+'/api/')){
  const path=url.pathname.slice(base.length),origin=env.APP_ORIGIN||'https://arwyn.party';
  url.pathname=path;
  const result=await api(new Request(url,request),{...env,APP_ORIGIN:origin,COOKIE_NAME:'wp_arcade_session',COOKIE_PATH:base+'/'});
  const headers=new Headers(result.headers);for(const [k,v]of Object.entries(demoHeaders))headers.set(k,v);
  return new Response(result.body,{status:result.status,headers});
 }
 return demoFetch(request,env);
}
export default {fetch:launchFetch,scheduled(_controller,env,ctx){ctx.waitUntil(launchTick(env));}};
