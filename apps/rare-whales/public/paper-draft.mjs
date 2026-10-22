import {inventoryItems} from './owned-crew.mjs';

const PREFIX='whale-pools-paper-draft-v1';
const styles=new Set(['balanced','trend','breakout','recovery']);
const key=a=>`${a.collection}:${a.tokenId}`;
function scope(wallet,rulesHash){
 if(typeof wallet!=='string'||!/^0x[0-9a-f]{40}$/i.test(wallet)||typeof rulesHash!=='string'||! /^[0-9a-f]{64}$/.test(rulesHash))throw Error('A live draft needs a wallet and exact paper rules.');
 wallet=wallet.toLowerCase();return {wallet,rulesHash,key:`${PREFIX}:${wallet}:${rulesHash}`};
}
function clean(input){
 if(!input||typeof input.nickname!=='string'||input.nickname.length>32||/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/.test(input.nickname))throw Error('Use a name of up to 32 characters without markup or control characters.');
 if(!styles.has(input.preset)||!Array.isArray(input.agents)||input.agents.length>12)throw Error('Choose a ready-made style and up to twelve whales.');
 const agents=inventoryItems(input.agents);
 if(agents.length!==input.agents.length)throw Error('Choose distinct whales from the supported collections.');
 // Keep crew order; only choices belong in browser storage, never publication
 // consent, authentication, mutation IDs or simulated results.
 const byKey=new Map(agents.map(a=>[key(a),a]));
 return {nickname:input.nickname,preset:input.preset,agents:input.agents.map(a=>byKey.get(key(a)))};
}
export function loadPaperDraft(storage,wallet,rulesHash){
 let s;try{s=scope(wallet,rulesHash);}catch{return {status:'invalid'};}
 let raw;try{raw=storage.getItem(s.key);}catch{return {status:'unavailable'};}
 if(raw===null)return {status:'missing'};
 try{const saved=JSON.parse(raw);if(saved.version!==1||saved.wallet!==s.wallet||saved.rulesHash!==s.rulesHash)throw Error('Wrong scope');return {status:'loaded',draft:clean(saved.draft)};}catch{return {status:'corrupt'};}
}
export function savePaperDraft(storage,wallet,rulesHash,draft){
 let s,value;try{s=scope(wallet,rulesHash);value=clean(draft);}catch(error){return {status:'invalid',error:error.message};}
 try{storage.setItem(s.key,JSON.stringify({version:1,wallet:s.wallet,rulesHash:s.rulesHash,draft:value}));return {status:'saved',draft:value};}catch{return {status:'unavailable'};}
}
/** Call only with a completed, verified inventory; failures are not empty wallets. */
export function reconcilePaperDraft(draft,inventory){
 const value=clean(draft),owned=new Set(inventoryItems(inventory).map(key)),agents=value.agents.filter(a=>owned.has(key(a)));
 return {draft:{...value,agents},removed:value.agents.length-agents.length};
}
