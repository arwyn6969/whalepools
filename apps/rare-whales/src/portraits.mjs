import {createPublicClient,http,parseAbi} from 'viem';
import {COLLECTIONS,RPC_URL} from './config.mjs';

export const ART_GATEWAY='https://gateway.pinata.cloud/ipfs/';
const abi=parseAbi(['function tokenURI(uint256) view returns (string)']);
const client=createPublicClient({transport:http(RPC_URL,{timeout:10000,retryCount:0})});
const bundled={'rarewhales:245':'/whale.avif','rarewhales:246':'/art/whale-246.avif','rarewhales:247':'/art/whale-247.avif','rarewhales:248':'/art/whale-248.avif','whalestreet:1':'/art/whalestreet-1.avif'};
export function portraitIdentity(collection,tokenId){
 if(!Object.hasOwn(COLLECTIONS,collection)||!Number.isSafeInteger(tokenId)||tokenId<1||tokenId>1000000)throw Error('Invalid NFT portrait identity.');
 return `${collection}:${tokenId}`;
}
export function ipfsArtworkURL(uri){
 if(typeof uri!=='string'||uri.length>300)throw Error('Unsupported artwork URI.');
 const match=/^ipfs:\/\/(?:ipfs\/)?(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,120})((?:\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?)*)$/.exec(uri);
 if(!match)throw Error('Unsupported artwork URI.');
 return ART_GATEWAY+match[1]+match[2];
}
export async function readMetadata(response,maxBytes=16384){
 if(!response.ok||!response.body)throw Error('Artwork metadata unavailable.');
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw Error('Artwork metadata too large.');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const data=JSON.parse(new TextDecoder().decode(bytes));
 return ipfsArtworkURL(data?.image);
}
// A browser-local, bounded queue/cache. Only public tokenURI reads; never wallet requests.
export function createPortraitResolver({fetcher=fetch,readURI=(collection,tokenId)=>client.readContract({address:COLLECTIONS[collection].address,abi,functionName:'tokenURI',args:[BigInt(tokenId)]}),asset=x=>x,limit=128,concurrency=3}={}){
 const cache=new Map(),queue=[];let active=0;
 function drain(){while(active<concurrency&&queue.length){active++;const {run,resolve,reject}=queue.shift();Promise.resolve().then(run).then(resolve,reject).finally(()=>{active--;drain();});}}
 function resolve(collection,tokenId){
  const key=portraitIdentity(collection,tokenId);
  if(bundled[key])return Promise.resolve(asset(bundled[key]));
  if(cache.has(key))return cache.get(key);
  const promise=new Promise((resolve,reject)=>{queue.push({resolve,reject,run:async()=>{
   const uri=await readURI(collection,tokenId),url=ipfsArtworkURL(uri);
   const response=await fetcher(url,{signal:AbortSignal.timeout(12000),credentials:'omit',referrerPolicy:'no-referrer',redirect:'error'});
   return readMetadata(response);
  }});drain();});
  cache.set(key,promise);if(cache.size>limit)cache.delete(cache.keys().next().value);
  return promise;
 }
 return {resolve,retry(collection,tokenId){cache.delete(portraitIdentity(collection,tokenId));}};
}
