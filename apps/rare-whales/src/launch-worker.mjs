import season from '../arcade.json' with {type:'json'};
import scores from '../build/arcade-scores.json' with {type:'json'};
import {createApi} from './api.mjs';
import {createArcadeBoard} from './arcade-board.mjs';
import {demoFetch,demoHeaders} from './demo-worker.mjs';
const board=createArcadeBoard({season,scores,ruleHash:scores.ruleHash}),api=createApi({season,board});
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
export default {fetch:launchFetch};
