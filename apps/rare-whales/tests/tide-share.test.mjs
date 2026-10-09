import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {validTideId,tidePath,tideURL,tideStory,tideShareData,tideCard} from '../public/tide-share.mjs';
import {paperURL} from '../public/paper-share.mjs';
import {tidePreview} from '../src/tide-preview.mjs';
const hash='a'.repeat(64),start=Date.UTC(2026,9,8),id='tide-'+hash.slice(0,12)+'-2026-10-08';
function round(status='running',quality='pending'){
 return {id,rulesHash:hash,startsAt:start,endsAt:start+86400000,status,quality,mine:{preset:'trend',owner:'private wallet'},picks:[{nickname:'private pick'}],strategies:['trend','breakout','recovery'].map((preset,i)=>({preset,name:['Current Surfer','Cannonball','Reef Reclaimer'][i],rank:null,observedBars:2,gapBars:0,lastObservation:start+600000,stats:{equity:1000+i,returnPct:i/10,maxDrawdown:.2,trades:0,exposure:10,hold:1001}}))};
}
const complete=()=>{const r=round('completed','complete');r.strategies.forEach((s,i)=>Object.assign(s,{rank:i===2?2:1,observedBars:288,lastObservation:r.endsAt}));return r;};
test('dated Tide links strip credentials/query/hash and old record suffixes while preserving app prefix',()=>{
 for(const path of ['/whalepools/','/whalepools/index.html','/whalepools/tide/'+id,'/whalepools/watch/11111111-1111-4111-8111-111111111111'])assert.equal(tideURL('https://user:secret@app.invalid'+path+'?private=1#paper',id),'https://app.invalid/whalepools/tide/'+id);
 assert.equal(tideURL('http://127.0.0.1:48393/',id),'http://127.0.0.1:48393/tide/'+id);assert.equal(tidePath('/whalepools/tide/'+id),id);
 assert.equal(paperURL('https://app.invalid/whalepools/tide/'+id,'11111111-1111-4111-8111-111111111111'),'https://app.invalid/whalepools/watch/11111111-1111-4111-8111-111111111111');
 for(const v of ['tide-'+hash.slice(0,12)+'-2026-02-30','bad',id+'/extra',id.toUpperCase()])assert.equal(validTideId(v),false);
 assert.throws(()=>tideURL('javascript:alert(1)',id));assert.equal(tidePath('/tide/bad'),null);
});
test('queued round explains no observations; running zero-trade decisions do not claim profits or final ranks',()=>{
 const r=round('queued');r.strategies.forEach(s=>Object.assign(s,{observedBars:0,lastObservation:null}));assert.match(tideStory(r).activity,/No round observations/);
 const s=tideStory(round());assert.equal(s.final,false);assert.match(s.activity,/No preset closed a trade/);assert.match(s.description,/not final ranks/);
 const share=tideShareData(round(),'https://app.invalid/');assert.match(share.text,/simulated money|Simulated money/i);assert.match(share.text,/No retrospective fills or proven strategy edge/);assert.doesNotMatch(JSON.stringify(share),/private wallet|private pick|winner|rank 1/);
});
test('interrupted running/completed rounds retain honest coverage even when every marked balance is positive',()=>{
 const r=round();r.strategies[1].gapBars=2;assert.equal(tideStory(r).interrupted,true);assert.match(tideStory(r).description,/partial results/);
 r.status='completed';r.quality='partial';const s=tideStory(r);assert.equal(s.final,false);assert.equal(s.gaps,2);assert.match(s.description,/no final ranks/);
 const card=tideCard(r,'https://app.invalid/');assert.match(card,/NO FINAL RANKS/);assert.doesNotMatch(card,/Rank [123]/);assert.match(card,/estimated exit costs/);assert.match(card,/not realized profit/);assert.match(card,RegExp(hash));
});
test('complete results preserve server ties without recomputing rank or turning holder picks into independent trials',()=>{
 const r=complete(),s=tideStory(r);assert.equal(s.final,true);assert.deepEqual(s.leaders,['Current Surfer','Cannonball']);assert.match(s.description,/share rank 1/);assert.match(tideCard(r,'https://app.invalid/'),/Rank 1/);
 r.strategies[0].stats.trades=2;assert.match(tideStory(r).activity,/holder picks do not create separate executions/);
});
test('paused older records and absent observations remain readable without promising a new candle',()=>{
 const r=round('paused','partial');r.strategies.forEach(s=>Object.assign(s,{observedBars:0,lastObservation:null}));assert.equal(tideStory(r).frozen,true);assert.match(tideStory(r).description,/earlier rules/);assert.match(tideCard(r,'https://app.invalid/'),/not observed yet/);assert.doesNotMatch(tideShareData(r,'https://app.invalid/').text,/rank 1/);
});
test('invalid or inconsistent snapshots fail closed, including false complete ranks and wrong dated rules',()=>{
 for(const alter of [r=>r.rulesHash='b'.repeat(64),r=>r.startsAt++,r=>r.strategies.pop(),r=>r.strategies[0].preset='breakout',r=>r.strategies[0].stats.equity=NaN,r=>r.strategies[0].lastObservation=r.endsAt+1,r=>r.strategies[0].observedBars=289]){const r=round();alter(r);assert.throws(()=>tideCard(r,'https://app.invalid/'));}
 const r=complete();r.strategies[0].gapBars=1;assert.throws(()=>tideShareData(r,'https://app.invalid/'),/Final ranks/);
});
test('cards escape public preset names and never copy a wallet/pick/session into the exported result',()=>{
 const r=round();r.strategies[0].name='A & "B" <script>';const card=tideCard(r,'https://user:secret@app.invalid/whalepools/?session=private#tide');assert.match(card,/A &amp; &quot;B&quot; &lt;script&gt;/);assert.doesNotMatch(card,/<script>|private wallet|private pick|session=|secret/);assert.match(card,/0.08% fee \+ 0.05% slippage/);
});
const shell='<html><head><title>old</title><meta name="description" content="old"><link href="./style.css"><script src="./app.js"></script></head><body></body></html>';
test('compressed server preview is public, read-only, escaped and prefix-safe with no-JavaScript results',async()=>{
 const r=round('completed','partial');r.strategies[0].name='A <unsafe>';let reads=0;
 const social={tide:async args=>{reads++;assert.equal(args.me,null);assert.equal(args.url.searchParams.get('round'),id);return {rounds:[r]};}},env={PAPER_ENABLED:'1',TIDE_ENABLED:'1',APP_ORIGIN:'https://app.invalid',ASSETS:{fetch:async()=>new Response(gzipSync(shell),{headers:{'content-encoding':'gzip'}})}};
 const request=new Request('https://app.invalid/whalepools/tide/'+id+'?private=1'),response=await tidePreview(request,env,{social,base:'/whalepools'}),html=await response.text();assert.equal(response.status,200);assert.match(html,/og:title/);assert.match(html,/THIS TIDE ENDED WITH GAPS/);assert.match(html,/A &lt;unsafe&gt;/);assert.match(html,/<noscript>/);assert.match(html,/src="\/whalepools\/app.js"/);assert.match(html,/canonical.*\/whalepools\/tide\/tide-/);assert.doesNotMatch(html,/private=|private wallet|private pick|<base/);assert.equal(response.headers.get('content-encoding'),null);assert.match(response.headers.get('content-security-policy'),/base-uri 'none'/);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal((await tidePreview(new Request(request,{method:'HEAD'}),env,{social,base:'/whalepools'})).body,null);assert.equal(reads,2);
});
test('preview gates method, origin, enabled status and unavailable records with recoverable failure',async()=>{
 const request=new Request('https://app.invalid/tide/'+id),env={PAPER_ENABLED:'1',TIDE_ENABLED:'1',APP_ORIGIN:'https://app.invalid'},social={tide:async()=>{throw {status:404};}};
 assert.equal((await tidePreview(request,env,{social,base:''})).status,404);assert.equal((await tidePreview(request,env,{social:{tide:async()=>{throw Error('database');}},base:''})).status,503);
 assert.equal((await tidePreview(new Request(request,{method:'POST'}),env,{social,base:''})).status,405);assert.equal((await tidePreview(request,{...env,TIDE_ENABLED:'0'},{social,base:''})).status,404);assert.equal((await tidePreview(new Request('https://other.invalid/tide/'+id),env,{social,base:''})).status,503);assert.equal((await tidePreview(new Request('https://app.invalid/tide/bad'),env,{social,base:''})).status,404);
});
