import {COLLECTIONS} from '../src/config.mjs';
export const whaleKey=a=>`${a.collection}:${a.tokenId}`;
export function inventoryItems(items){
 if(!Array.isArray(items)||items.length>10000)throw Error('Invalid wallet inventory.');
 const seen=new Set();return items.map(a=>{if(!a||!Object.hasOwn(COLLECTIONS,a.collection)||!Number.isSafeInteger(a.tokenId)||a.tokenId<1||a.tokenId>1000000||seen.has(whaleKey(a)))throw Error('Invalid wallet inventory.');seen.add(whaleKey(a));return {collection:a.collection,tokenId:a.tokenId};}).sort((a,b)=>a.collection.localeCompare(b.collection)||a.tokenId-b.tokenId);
}
export function retainOwned(roster,inventory){const owned=new Set(inventory.map(whaleKey));return roster.filter(a=>owned.has(whaleKey(a)));}
export function chooseCaptain(roster,previous){return roster.some(a=>whaleKey(a)===previous)?previous:roster[0]?whaleKey(roster[0]):'';}
