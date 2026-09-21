import {CHAIN_ID,COLLECTIONS} from './config.mjs';

export const DNA_VERSION='whale-dna-v1';
export const MAX_AGENTS=12;
export const NEUTRAL_PROFILE=Object.freeze({version:DNA_VERSION,hash:null,build:'1-1-1',name:'Cruiser',risk:.25,targetMultiplier:1,allocation:25,levels:[1,1,1]});
const risks=[.225,.25,.275],targets=[.95,1,1.05],allocations=[22.5,25,27.5];

export async function whaleDNA(collection,tokenId){
 if(!Object.hasOwn(COLLECTIONS,collection)||!Number.isSafeInteger(tokenId)||tokenId<0||tokenId>1000000)throw Error('Choose a valid collection and whole token number.');
 const input=`${DNA_VERSION}:${CHAIN_ID}:${COLLECTIONS[collection].address.toLowerCase()}:${tokenId}`;
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input)));
 const levels=[bytes[0]%3,bytes[1]%3,bytes[2]%3];
 return {version:DNA_VERSION,hash:[...bytes].map(v=>v.toString(16).padStart(2,'0')).join(''),build:levels.join('-'),name:['Anchor','Cruiser','Cannonball'][levels[0]],risk:risks[levels[0]],targetMultiplier:targets[levels[1]],allocation:allocations[levels[2]],levels};
}

export function validateRoster(agents){
 if(!Array.isArray(agents)||agents.length>MAX_AGENTS)throw Error(`A pool can contain up to ${MAX_AGENTS} agents.`);
 const keys=new Set();
 return agents.map(a=>{
  if(!a||!Object.hasOwn(COLLECTIONS,a.collection)||!Number.isSafeInteger(a.tokenId)||a.tokenId<0||a.tokenId>1000000||!['trend','recovery'].includes(a.strategy))throw Error('Each agent needs a valid collection, token number and strategy.');
  const key=`${a.collection}:${a.tokenId}`;if(keys.has(key))throw Error('A whale can only appear once in a pool.');keys.add(key);
  return {collection:a.collection,tokenId:a.tokenId,strategy:a.strategy};
 });
}
