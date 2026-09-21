import {createPortraitResolver} from '../src/portraits.mjs';
import {COLLECTIONS} from '../src/config.mjs';

export function createPortraitLoader({asset,resolver=createPortraitResolver({asset}),timeout=20000}={}){
 const jobs=new WeakMap();
 async function load(img){
  const previous=jobs.get(img);if(previous)previous();
  let cancelled=false,timer;
  const stop=()=>{cancelled=true;clearTimeout(timer);img.onload=null;img.onerror=null;};
  jobs.set(img,stop);
  const collection=img.dataset.collection,tokenId=Number(img.dataset.token),name=`${COLLECTIONS[collection]?.name||'Whale'} #${tokenId}`;
  const current=()=>!cancelled&&img.isConnected&&img.dataset.collection===collection&&Number(img.dataset.token)===tokenId;
  const fail=()=>{if(!current())return;stop();img.dataset.artState='error';img.src=asset('/art/portrait-missing.svg');img.alt=`Artwork unavailable for ${name}. Use Retry portraits.`;};
  img.dataset.artState='loading';img.alt=`Loading artwork for ${name}`;img.src=asset('/art/portrait-loading.svg');
  try{
   const url=await resolver.resolve(collection,tokenId);if(!current())return;
   img.onload=()=>{if(!current())return;stop();img.dataset.artState='ready';img.alt=name;};
   img.onerror=fail;timer=setTimeout(fail,timeout);img.src=url;
  }catch{fail();}
 }
 return {
  hydrate(root){for(const img of root.querySelectorAll('img[data-whale-art]'))if(!jobs.has(img))void load(img);},
  retry(root){const reset=new Set();for(const img of root.querySelectorAll('img[data-whale-art]'))if(img.dataset.artState==='error'){try{const key=img.dataset.collection+':'+img.dataset.token;if(!reset.has(key)){resolver.retry(img.dataset.collection,Number(img.dataset.token));reset.add(key);}void load(img);}catch{/* Invalid draft identity keeps its explicit fallback. */}}}
 };
}
