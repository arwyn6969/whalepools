import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPaperDraft,savePaperDraft,reconcilePaperDraft} from '../public/paper-draft.mjs';
import {signInLanding} from '../public/auth-journey.mjs';
const a='0x'+'a'.repeat(40),b='0x'+'b'.repeat(40),rules='c'.repeat(64);
const whale={collection:'rarewhales',tokenId:245},other={collection:'whalestreet',tokenId:1};
const draft={nickname:'New currents',preset:'breakout',agents:[other,whale]};
const storage=()=>{const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};
test('live choices restore by normalized wallet and exact rules, preserving crew order',()=>{
 const s=storage();assert.equal(savePaperDraft(s,a,rules,draft).status,'saved');
 assert.deepEqual(loadPaperDraft(s,a.toUpperCase(),rules).draft,draft);
 assert.equal(loadPaperDraft(s,b,rules).status,'missing');assert.equal(loadPaperDraft(s,a,'d'.repeat(64)).status,'missing');
 savePaperDraft(s,b,rules,{...draft,nickname:'Another holder'});assert.equal(loadPaperDraft(s,a,rules).draft.nickname,draft.nickname);
});
test('empty choices are intentional and private data is whitelisted',()=>{
 const s=storage();const input={...draft,agents:[],publish:true,signature:'secret',session:'cookie',mutationId:'retry',stats:{equity:1}};
 savePaperDraft(s,a,rules,input);assert.deepEqual(loadPaperDraft(s,a,rules).draft,{nickname:draft.nickname,preset:draft.preset,agents:[]});
 const saved=[...s.values.values()][0];for(const value of ['publish','secret','cookie','retry','equity'])assert.equal(saved.includes(value),false);
});
test('invalid or corrupt choices cannot replace a valid live setup',()=>{
 const s=storage();savePaperDraft(s,a,rules,draft);
 for(const value of [null,{...draft,nickname:'<script>'},{...draft,nickname:'x'.repeat(33)},{...draft,preset:'famous-trader'},
 {...draft,agents:[whale,whale]},{...draft,agents:[{...whale,tokenId:0}]},{...draft,agents:Array.from({length:13},(_,i)=>({...whale,tokenId:i+1}))}])assert.equal(savePaperDraft(s,a,rules,value).status,'invalid');
 assert.deepEqual(loadPaperDraft(s,a,rules).draft,draft);
 s.values.set([...s.values.keys()][0],'{broken');assert.equal(loadPaperDraft(s,a,rules).status,'corrupt');
 assert.equal(savePaperDraft(s,a,'rules',draft).status,'invalid');
});
test('storage denial is recoverable and historical choices never load as live choices',()=>{
 const denied={getItem(){throw Error('Denied');},setItem(){throw Error('Full');}};
 assert.equal(loadPaperDraft(denied,a,rules).status,'unavailable');assert.equal(savePaperDraft(denied,a,rules,draft).status,'unavailable');
 const s=storage();s.setItem('whale-pools-company-draft-v1:'+a+':'+rules,JSON.stringify(draft));assert.equal(loadPaperDraft(s,a,rules).status,'missing');
});
test('completed inventory reconciliation removes transfers without changing style or selecting replacements',()=>{
 assert.deepEqual(reconcilePaperDraft(draft,[whale]),{draft:{...draft,agents:[whale]},removed:1});
 assert.deepEqual(reconcilePaperDraft({...draft,agents:[]},[whale]),{draft:{...draft,agents:[]},removed:0});
 assert.throws(()=>reconcilePaperDraft(draft,null),/inventory/);
});
test('sign-in respects live routes and navigation during a wallet prompt',()=>{
 for(const suffix of ['#paper','#paper/123','#tide','#tide/round','#live-pilot','/watch/123']){const url='https://example.com/whalepools/'+suffix;assert.equal(signInLanding(url,url),null);}
 assert.equal(signInLanding('https://example.com/#paper','https://example.com/#practice'),null);
 assert.equal(signInLanding('https://example.com/#practice','https://example.com/#practice'),'seat');
});
