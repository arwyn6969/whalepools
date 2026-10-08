import test from 'node:test';
import assert from 'node:assert/strict';
import {watchSnapshot,loadWatchBookmark,rememberWatch,forgetWatch,watchReturnStory,watchReturnHTML} from '../public/watch-return.mjs';

const wallet='0x'+'a'.repeat(40),second='0x'+'b'.repeat(40),hash='c'.repeat(64),otherHash='d'.repeat(64),now=1791477000000;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const storage=()=>({values:new Map(),getItem(k){return this.values.get(k)??null;},setItem(k,v){this.values.set(k,v);}});
const run=(n=1)=>({id:id(n),owner:wallet,rulesHash:hash,status:'running',nickname:'A returning crew',stats:{equity:999.5,trades:2},observedBars:20,gapBars:1,history:[{t:now-300000}],agents:[{preset:'trend',qty:1,pending:'sell',action:'Exit queued.'}]});
const rules={presets:{trend:{name:'Current Surfer'}}};

test('bookmarks isolate holder, exact rules and dated watch; projection never stores identities or crew',()=>{
 const s=storage(),r=run();r.signature='private';r.agents[0].tokenId=123;
 const before=structuredClone(r);assert.equal(rememberWatch(s,wallet,hash,r,now).status,'saved');assert.deepEqual(r,before);
 assert.equal(loadWatchBookmark(s,second,hash,r.id,now).bookmark,null);
 assert.equal(loadWatchBookmark(s,wallet,otherHash,r.id,now).bookmark,null);
 assert.equal(loadWatchBookmark(s,wallet,hash,id(2),now).bookmark,null);
 const d=JSON.parse([...s.values.values()][0]);assert.deepEqual(Object.keys(d.records[r.id]).sort(),['closedTrades','equity','gaps','rememberedAt','status','timely','valuationAt']);
 for(const forbidden of ['signature','private','tokenId','nickname','agents'])assert.equal(JSON.stringify(d).includes(forbidden),false);
});
test('a first observation is required; reading and computing a story never saves automatically',()=>{
 const s=storage(),r={...run(),history:[]};assert.equal(watchSnapshot(r,wallet,hash,now),null);
 assert.equal(rememberWatch(s,wallet,hash,r,now).status,'waiting');assert.equal(s.values.size,0);
 assert.deepEqual(watchReturnStory(null,null),{state:'waiting'});
 assert.equal(watchReturnStory(watchSnapshot(run(),wallet,hash,now),null).state,'first');assert.equal(s.values.size,0);
});
test('return delta uses cumulative counters beyond the rolling chart and labels timely/gap overlap',()=>{
 const bookmark=watchSnapshot(run(),wallet,hash,now);
 const newer={...run(),stats:{equity:1001.25,trades:7},observedBars:390,gapBars:3,history:[{t:now+86400000}]};
 const story=watchReturnStory(watchSnapshot(newer,wallet,hash,now),bookmark);
 assert.deepEqual(story,{state:'new',from:now-300000,until:now+86400000,change:1.75,timely:370,gaps:2,closedTrades:5});
 const html=watchReturnHTML(newer,{snapshot:watchSnapshot(newer,wallet,hash,now),bookmark,rules});
 assert.match(html,/not realized profit/);assert.match(html,/gap counts can overlap/);assert.match(html,/actual fills and costs/);
});
test('same valuation stays current and negative marked change is not described as realized profit',()=>{
 const r=run(),bookmark=watchSnapshot(r,wallet,hash,now);assert.equal(watchReturnStory(bookmark,bookmark).state,'current');
 const newer={...r,stats:{equity:997,trades:2},history:[{t:now}]};
 const html=watchReturnHTML(newer,{snapshot:watchSnapshot(newer,wallet,hash,now),bookmark,rules});
 assert.match(html,/−\$2.50/);assert.match(html,/No new closed trades/);assert.match(html,/marked open positions/);
});
test('older time or regressed counters cannot replace a newer remembered snapshot',()=>{
 const s=storage(),r=run();rememberWatch(s,wallet,hash,r,now);const before=[...s.values.values()][0];
 for(const old of [{...r,history:[{t:now-600000}]},{...r,observedBars:19},{...r,gapBars:0},{...r,stats:{...r.stats,trades:1}}]){
  assert.equal(rememberWatch(s,wallet,hash,old,now).status,'older');assert.equal([...s.values.values()][0],before);
 }
});
test('storage denial leaves server data and unrelated draft keys intact',()=>{
 const denied={getItem(){throw Error('Denied');},setItem(){throw Error('Full');}};
 assert.equal(loadWatchBookmark(denied,wallet,hash,id(1),now).status,'unavailable');assert.equal(rememberWatch(denied,wallet,hash,run(),now).status,'unavailable');assert.equal(forgetWatch(denied,wallet,hash,id(1),now).status,'unavailable');
 const s=storage();s.setItem('whale-pools-paper-draft-v1:private','unchanged');rememberWatch(s,wallet,hash,run(),now);assert.equal(s.getItem('whale-pools-paper-draft-v1:private'),'unchanged');
});
test('corrupt, oversized, extra-field and future-dated bookmarks are rejected and explicitly recoverable',()=>{
 const s=storage();rememberWatch(s,wallet,hash,run(),now);const [key,value]=[...s.values.entries()][0],valid=JSON.parse(value);
 const bad=[null,'x'.repeat(16385),'{bad',JSON.stringify({...valid,signature:'private'})];
 for(const alter of [v=>v.records[id(1)].rememberedAt=now+1,v=>v.records[id(1)].valuationAt=Number.MAX_SAFE_INTEGER,v=>v.records[id(1)].gaps=-1,v=>v.records[id(1)].extra=true]){const v=structuredClone(valid);alter(v);bad.push(JSON.stringify(v));}
 for(const value of bad){s.setItem(key,value);assert.equal(loadWatchBookmark(s,wallet,hash,id(1),now).status,value===null?'missing':'corrupt');assert.equal(rememberWatch(s,wallet,hash,run(),now).status,'saved');}
});
test('thirty-day expiry requires a new deliberate bookmark and does not silently advance it',()=>{
 const s=storage();rememberWatch(s,wallet,hash,run(),now);const before=[...s.values.values()][0];
 assert.ok(loadWatchBookmark(s,wallet,hash,id(1),now+30*86400000-1).bookmark);
 assert.equal(loadWatchBookmark(s,wallet,hash,id(1),now+30*86400000).bookmark,null);assert.equal([...s.values.values()][0],before);
});
test('bounded retention keeps the newest twenty even when timestamps tie',()=>{
 const s=storage();for(let n=1;n<=21;n++)assert.equal(rememberWatch(s,wallet,hash,run(n),now).status,'saved');
 const d=JSON.parse([...s.values.values()][0]);assert.equal(Object.keys(d.records).length,20);assert.ok(d.records[id(21)]);assert.equal(d.records[id(1)],undefined);
});
test('forgetting one bookmark keeps other watches, wallets and private drafts',()=>{
 const s=storage();rememberWatch(s,wallet,hash,run(),now);rememberWatch(s,wallet,hash,run(2),now);rememberWatch(s,second,hash,{...run(),owner:second},now);
 assert.equal(forgetWatch(s,wallet,hash,id(1),now).status,'forgotten');assert.equal(loadWatchBookmark(s,wallet,hash,id(1),now).bookmark,null);assert.ok(loadWatchBookmark(s,wallet,hash,id(2),now).bookmark);assert.ok(loadWatchBookmark(s,second,hash,id(1),now).bookmark);
});
test('wrong owner/rules, invalid identity and incomplete saved values cannot overwrite a valid bookmark',()=>{
 const s=storage();rememberWatch(s,wallet,hash,run(),now);const before=[...s.values.values()][0];
 for(const r of [{...run(),owner:second},{...run(),rulesHash:otherHash},{...run(),id:'bad'},{...run(),stats:{equity:NaN,trades:2}},{...run(),status:'unknown'}])assert.equal(rememberWatch(s,wallet,hash,r,now).status,'invalid');
 assert.equal([...s.values.values()][0],before);
});
test('crew reasons and names are escaped; stopped-before-first-close does not promise future observations',()=>{
 const r=run();r.nickname='<script>';r.agents[0].action='<img onerror=alert(1)>';const html=watchReturnHTML(r,{snapshot:watchSnapshot(r,wallet,hash,now),rules,expanded:true});assert.match(html,/<details open>/);
 assert.equal(html.includes('<script>'),false);assert.equal(html.includes('<img onerror'),false);assert.match(html,/1 holding · 1 order queued · 0 watching/);
 const stopped=watchReturnHTML({...r,status:'stopped',history:[]},{snapshot:null,rules});assert.match(stopped,/froze before its first saved valuation/);assert.equal(stopped.includes('first saved observation is still ahead'),false);
});
