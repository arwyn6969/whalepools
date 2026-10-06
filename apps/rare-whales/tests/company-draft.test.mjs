import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDraft,saveDraft} from '../public/company-draft.mjs';

const walletA='0x'+ 'a'.repeat(40),walletB='0x'+'b'.repeat(40),rules='arcade-rules-1';
const storage=()=>{
 const items=new Map();
 return {items,getItem:key=>items.has(key)?items.get(key):null,setItem:(key,value)=>items.set(key,value)};
};
const draft=()=>({agents:[{collection:'rarewhales',tokenId:245,strategy:'magnet'},{collection:'whalestreet',tokenId:1,strategy:'breakout'}],nickname:'Sea company',captain:'whalestreet:1',selected:'rarewhales:245'});

test('a returning wallet restores tactics, captain, name and selected whale',()=>{
 const s=storage(),input=draft();
 assert.deepEqual(saveDraft(s,walletA,rules,input),{status:'saved',draft:input});
 input.agents[0].strategy='trend';
 assert.deepEqual(loadDraft(s,walletA.toUpperCase(),rules),{status:'loaded',draft:draft()});
 assert.equal(s.items.size,1);
});

test('wallets and exact rules versions have separate draft namespaces',()=>{
 const s=storage();
 saveDraft(s,walletA,rules,draft());
 assert.equal(loadDraft(s,walletB,rules).status,'missing');
 assert.equal(loadDraft(s,walletA,rules+'-2').status,'missing');
 saveDraft(s,walletB,rules,{...draft(),nickname:'Other holder'});
 saveDraft(s,walletA,rules+'-2',{...draft(),nickname:'New rules'});
 assert.equal(loadDraft(s,walletA,rules).draft.nickname,'Sea company');
 assert.equal(loadDraft(s,walletB,rules).draft.nickname,'Other holder');
 assert.equal(loadDraft(s,walletA,rules+'-2').draft.nickname,'New rules');
 // Encoded punctuation cannot turn one namespace into another.
 saveDraft(s,walletA,'rules:a/b',draft());
 assert.equal(loadDraft(s,walletA,'rules:a%2Fb').status,'missing');
});

test('missing drafts differ from intentionally empty unfinished drafts',()=>{
 const s=storage();
 assert.deepEqual(loadDraft(s,walletA,rules),{status:'missing'});
 const empty={agents:[],nickname:'',captain:null,selected:null};
 assert.deepEqual(saveDraft(s,walletA,rules,empty),{status:'saved',draft:empty});
 assert.deepEqual(loadDraft(s,walletA,rules),{status:'loaded',draft:empty});
});

test('publication consent, signatures, sessions and generated results never persist',()=>{
 const s=storage(),input={...draft(),publish:true,signature:'private signature',session:'private session',cookie:'credential',ownershipBlock:123,stats:{returnPct:8}};
 input.agents[0].profile={hash:'generated DNA'};
 saveDraft(s,walletA,rules,input);
 assert.deepEqual(loadDraft(s,walletA,rules).draft,draft());
 const saved=JSON.parse([...s.items.values()][0]);
 assert.deepEqual(Object.keys(saved.draft).sort(),['agents','captain','nickname','selected']);
 for(const secret of ['private signature','private session','credential','generated DNA'])assert.equal(JSON.stringify(saved).includes(secret),false);
});

test('an unscoped sandbox is never loaded as a holder draft',()=>{
 const s=storage();s.setItem('whale-pools-sandbox-v1',JSON.stringify(draft().agents));
 assert.equal(loadDraft(s,walletA,rules).status,'missing');
 assert.equal(s.items.size,1);
});

test('invalid names, rosters and selections cannot replace a valid draft',()=>{
 const s=storage();saveDraft(s,walletA,rules,draft());
 for(const input of [
  null,{...draft(),agents:null},{...draft(),agents:[...draft().agents,draft().agents[0]]},
  {...draft(),agents:[{collection:'rarewhales',tokenId:245,strategy:'unknown'}]},
  {...draft(),agents:[{collection:'unknown',tokenId:245,strategy:'trend'}]},
  {...draft(),agents:[{collection:'rarewhales',tokenId:1.2,strategy:'trend'}]},
  {...draft(),nickname:'x'.repeat(33)},{...draft(),nickname:'<company>'},{...draft(),nickname:'Bad\u202ename'},
  {...draft(),nickname:42},{...draft(),captain:'rarewhales:99'},{...draft(),selected:'whalestreet:2'}
 ])assert.equal(saveDraft(s,walletA,rules,input).status,'invalid');
 assert.deepEqual(loadDraft(s,walletA,rules).draft,draft());
});

test('invalid wallet and rules identities do not touch storage',()=>{
 let accesses=0;const s={getItem:()=>{accesses++;return null;},setItem:()=>{accesses++;}};
 for(const [wallet,ruleHash] of [[null,rules],['holder',rules],[walletA.slice(0,-1),rules],[walletA,''],[walletA,' rules'],[walletA,'rules\n'],[walletA,'x'.repeat(129)]]){
  assert.equal(loadDraft(s,wallet,ruleHash).status,'invalid');
  assert.equal(saveDraft(s,wallet,ruleHash,draft()).status,'invalid');
 }
 assert.equal(accesses,0);
});

test('unavailable storage is reported without throwing or losing the in-memory draft',()=>{
 for(const s of [null,{}, {getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('quota');}}]){
  assert.equal(loadDraft(s,walletA,rules).status,'unavailable');
  assert.equal(saveDraft(s,walletA,rules,draft()).status,'unavailable');
 }
});

test('corrupt or mismatched persisted data is reported and never silently substituted',()=>{
 const s=storage();saveDraft(s,walletA,rules,draft());const key=[...s.items.keys()][0],saved=JSON.parse(s.getItem(key));
 for(const value of ['{','',JSON.stringify(null),JSON.stringify({...saved,version:2}),JSON.stringify({...saved,wallet:walletB}),JSON.stringify({...saved,ruleHash:'older'}),JSON.stringify({...saved,draft:{...draft(),agents:[]}})]){
  s.setItem(key,value);assert.deepEqual(loadDraft(s,walletA,rules),{status:'corrupt'});
  assert.equal(s.getItem(key),value);
 }
 // A fresh valid save offers recovery without deleting other wallets' drafts.
 assert.equal(saveDraft(s,walletA,rules,draft()).status,'saved');
 assert.equal(loadDraft(s,walletA,rules).status,'loaded');
});
