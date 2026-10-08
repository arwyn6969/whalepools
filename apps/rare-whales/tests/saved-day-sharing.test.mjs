import test from 'node:test';
import assert from 'node:assert/strict';
import {recapURL,validRecapDate,recapShareData,recapCard,sharePaperLink} from '../public/paper-share.mjs';
import {watchPreview} from '../src/watch-preview.mjs';
import {createLivePilot,livePilotProgress} from '../public/live-pilot.mjs';
const id='11111111-1111-4111-8111-111111111111',hash='a'.repeat(64),start=Date.UTC(2026,9,7),DAY=86400000;
const recap={id,rulesHash:hash,day:'2026-10-07',completeDay:true,status:'running',from:start,until:start+DAY,lastValuation:start+DAY,balance:998,change:-2,fees:.16,slippage:.1,buys:1,sells:1,coverage:{recorded:287,actionable:286,expected:288,missing:1}};
const share=()=>recapShareData(recap,'The day crew','https://user:secret@app.invalid/whalepools/watch/'+id+'?private=1#seat');
test('day destinations retain only a valid UTC day and canonical public ID',()=>{
 assert.equal(share().url,'https://app.invalid/whalepools/watch/'+id+'?day=2026-10-07');
 for(const day of ['2026-02-30','2026-10-7','<script>','2026-10-07T12:00',null]){assert.equal(validRecapDate(day),null);assert.throws(()=>recapURL('https://app.invalid/',id,day));}
 assert.equal(validRecapDate('2028-02-29'),'2028-02-29');
 assert.throws(()=>recapURL('javascript:alert(1)',id,recap.day));
});
test('day cards keep partial coverage, dates, costs and frozen rules without implying realized profit',()=>{
 const card=recapCard(recap,'A <script> & crew','https://app.invalid/');
 assert.match(card,/SAVED UTC DAY.*2026-10-07/);assert.match(card,/PARTIAL \/ WAITING/);assert.match(card,/Recorded fees \$0.16/);assert.match(card,/not realized profit/);assert.match(card,RegExp(hash));assert.match(card,/A &lt;script&gt; &amp; crew/);assert.doesNotMatch(card,/<script>/);
 assert.match(share().text,/coverage partial/);
 const waiting={...recap,completeDay:false,lastValuation:null,balance:null,change:null,coverage:{recorded:0,actionable:0,expected:0,missing:0}};
 assert.match(recapShareData(waiting,'Waiting','https://app.invalid/').text,/not recorded.*partial or waiting/);
 assert.match(recapCard(waiting,'Waiting','https://app.invalid/'),/UTC DAY SO FAR/);
 assert.throws(()=>recapShareData({...recap,coverage:{...recap.coverage,missing:0}},'Bad','https://app.invalid/'));
});
test('native share receives the frozen snapshot and never reports destination delivery',async()=>{
 const calls=[];const outcome=await sharePaperLink(share(),{browser:{share:async data=>calls.push(data),clipboard:{writeText:async()=>assert.fail('must not copy')}}});
 assert.equal(outcome,'sheet');assert.deepEqual(calls,[share()]);
});
test('cancelled or missing-target native sheets do not copy or count outputs',async()=>{
 const outcome=await sharePaperLink(share(),{browser:{share:async()=>{throw {name:'AbortError'};},clipboard:{writeText:async()=>assert.fail('cancel must not copy')}}});assert.equal(outcome,'cancelled');
});
test('unsupported or denied sharing falls back to one copy; denied clipboard stays manual',async()=>{
 for(const native of [undefined,async()=>{throw {name:'NotAllowedError'};}]){const copied=[];assert.equal(await sharePaperLink(share(),{browser:{share:native,clipboard:{writeText:async value=>copied.push(value)}}}),'copied');assert.deepEqual(copied,[share().url]);}
 assert.equal(await sharePaperLink(share(),{browser:{}}),'manual');
});
test('a stale route or wallet cannot trigger fallback copying after a failed sheet',async()=>{
 let current=true;const outcome=await sharePaperLink(share(),{current:()=>current,browser:{share:async()=>{current=false;throw Error('Failed');},clipboard:{writeText:async()=>assert.fail('stale context must not copy')}}});assert.equal(outcome,'stale');
});
test('server day metadata and no-JavaScript fallback summarize the selected UTC day',async()=>{
 const run={id,nickname:'Saved day crew',stats:{equity:2000},history:[{t:start+2*DAY}],rulesHash:hash,status:'running',createdAt:start,observedBars:300,gapBars:1};
 const shell='<html><head><title>old</title><meta name="description" content="old"></head><body></body></html>';
 const env={DB:{prepare(sql){assert.equal(sql,'SELECT nickname,rules_hash FROM wp_paper_runs WHERE id=?');return {bind(value){assert.equal(value,id);return {first:async()=>({nickname:run.nickname,rules_hash:hash})};}};}},PAPER_ENABLED:'1',APP_ORIGIN:'https://app.invalid',ASSETS:{fetch:async()=>new Response(shell)}};
 let reads=0;const options={base:'/whalepools',paper:{read:async()=>({run})},recaps:{read:async({url})=>{reads++;assert.equal(url.searchParams.get('day'),recap.day);return recap;}}};
 const url='https://app.invalid/whalepools/watch/'+id;
 const result=await watchPreview(new Request(url+'?day='+recap.day),env,options),html=await result.text();assert.equal(result.status,200);assert.match(html,/paper|Paper|simulated/);assert.match(html,/Balance \$998.00/);assert.match(html,/coverage partial/);assert.match(html,/rel="canonical" href="[^\"]+\?day=2026-10-07"/);assert.match(html,/<noscript>/);assert.doesNotMatch(html,/\$2000/);assert.equal(reads,1);
 assert.equal((await watchPreview(new Request(url+'?day=2026-02-30'),env,options)).status,400);
 assert.equal((await watchPreview(new Request(url+'?day=2026-10-07&day=2026-10-08'),env,options)).status,400);assert.equal(reads,1);
 assert.equal((await watchPreview(new Request(url+'?day=2026-10-09'),env,{...options,recaps:{read:async()=>{throw {status:404};}}})).status,404);
});
test('participant progress uses existing first-start and later-day rules without counting sharing or picks',()=>{
 let now=start+1000;const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},pilot=createLivePilot(storage,()=>now);
 pilot.start('P01');assert.match(livePilotProgress(pilot.report(),now).start,/Waiting/);
 pilot.record('live_ready_new');now+=120000;pilot.record('live_started');const first=now;
 assert.match(livePilotProgress(pilot.report(),now).start,/120 seconds/);
 now+=DAY;pilot.record('live_shared');pilot.record('tide_joined');assert.match(livePilotProgress(pilot.report(),now).returned,/No qualifying/);
 pilot.record('live_reviewed',now-1000);assert.match(livePilotProgress(pilot.report(),now).returned,/meaningful later-day/);
 now=first+7*DAY;assert.match(livePilotProgress(pilot.report(),now).next,/Window finished/);
 pilot.erase();pilot.start('P02');pilot.record('live_ready_existing');assert.match(livePilotProgress(pilot.report(),now).start,/unavailable/);
});
