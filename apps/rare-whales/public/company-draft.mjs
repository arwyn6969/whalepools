import {validateRoster} from '../src/dna.mjs';

const VERSION=1;
const PREFIX='whale-pools-company-draft-v1';
const keyFor=a=>`${a.collection}:${a.tokenId}`;

function namespace(wallet,ruleHash){
 if(typeof wallet!=='string'||!/^0x[0-9a-f]{40}$/i.test(wallet))throw Error('A draft needs a valid wallet address.');
 if(typeof ruleHash!=='string'||! /^[\x21-\x7e]{1,128}$/.test(ruleHash))throw Error('A draft needs the current rules version.');
 const address=wallet.toLowerCase();
 return {wallet:address,ruleHash,key:`${PREFIX}:${address}:${encodeURIComponent(ruleHash)}`};
}

function cleanDraft(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('The company draft is invalid.');
 const agents=validateRoster(input.agents);
 const nickname=input.nickname??'';
 if(typeof nickname!=='string'||nickname.length>32||/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/.test(nickname))throw Error('Use a company name of up to 32 characters without markup or control characters.');
 const keys=new Set(agents.map(keyFor));
 const selection=(value,name)=>{
  if(value===undefined||value===null||value==='')return null;
  if(typeof value!=='string'||!keys.has(value))throw Error(`The draft ${name} must belong to its crew.`);
  return value;
 };
 // Only unfinished company choices belong here. Consent, signatures and sessions
 // are deliberately excluded even when callers supply a full publish payload.
 return {agents,nickname,captain:selection(input.captain,'captain'),selected:selection(input.selected,'selected whale')};
}

/** Read a private draft without accessing global browser storage. */
export function loadDraft(storage,wallet,ruleHash){
 let scope;
 try{scope=namespace(wallet,ruleHash);}catch(error){return {status:'invalid',error:error.message};}
 let raw;
 try{
  if(!storage||typeof storage.getItem!=='function')return {status:'unavailable'};
  raw=storage.getItem(scope.key);
 }catch{return {status:'unavailable'};}
 if(raw===null)return {status:'missing'};
 try{
  const saved=JSON.parse(raw);
  if(saved?.version!==VERSION||saved.wallet!==scope.wallet||saved.ruleHash!==scope.ruleHash)throw Error('The stored draft belongs to a different wallet or rules version.');
  return {status:'loaded',draft:cleanDraft(saved.draft)};
 }catch{return {status:'corrupt'};}
}

/** Save only validated company choices; an empty crew is an intentional draft. */
export function saveDraft(storage,wallet,ruleHash,draft){
 let scope,clean;
 try{scope=namespace(wallet,ruleHash);clean=cleanDraft(draft);}catch(error){return {status:'invalid',error:error.message};}
 try{
  if(!storage||typeof storage.setItem!=='function')return {status:'unavailable'};
  storage.setItem(scope.key,JSON.stringify({version:VERSION,wallet:scope.wallet,ruleHash:scope.ruleHash,draft:clean}));
  return {status:'saved',draft:clean};
 }catch{return {status:'unavailable'};}
}
