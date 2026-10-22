import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildChallenge,evaluateChallenge,enumerateChallenge,episodePractice} from '../src/challenge.mjs';
import {replayPool} from '../src/pool.mjs';
import {buildPractice} from '../src/practice.mjs';
import {companyURL,companyCard} from '../public/company-share.mjs';
import {createPilot,pilotReadout,validatePilot,PILOT_KEY} from '../public/pilot.mjs';
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url)));
const practice=buildPractice({bars:await read('../../../research/data/UBTC-1h.json'),context:await read('../../../research/data/UBTC-4h.json'),protocol:await read('../../../dist/protocol.json'),sourceHashes:{}}),challenge=await buildChallenge(practice);
const crew=challenge.rules.loaners.slice(0,3).map((a,i)=>({...a,strategy:['trend','recovery','breakout'][i]}));
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};};

test('challenge scores match direct frozen-engine replays in both bounded, reset episodes',async()=>{
 const before=JSON.stringify(practice),result=evaluateChallenge(challenge,crew);
 for(let i=0;i<2;i++){
  const episode=challenge.rules.episodes[i],sample=episodePractice(practice,episode),direct=await replayPool(sample,crew);
  for(const field of Object.keys(result.episodes[i].stats))assert.ok(Math.abs(result.episodes[i].stats[field]-direct.stats[field])<1e-9,field);
  assert.ok(direct.trades.every(t=>t.entryTime>=episode.from&&t.exitTime<=episode.until));
  assert.equal(direct.curve[0].equity,1000);
  for(const [tactic,signals]of Object.entries(sample.replay.signals))for(const s of signals){assert.ok(s.i>=1&&s.i<sample.replay.bars.length);assert.ok(practice.replay.signals[tactic].some(original=>original.t===s.t&&original.entry===s.entry&&original.target===s.target));}
 }
 assert.equal(JSON.stringify(practice),before);
 assert.equal(result.worstReturn,Math.min(...result.episodes.map(e=>e.stats.returnPct)));
 assert.deepEqual(evaluateChallenge(challenge,crew.toReversed()),result);
});
test('all 1280 legal choices are distinct and the saved enumeration evaluates the declared risk objective',()=>{
 const choices=enumerateChallenge(challenge);assert.equal(choices.length,1280);assert.equal(new Set(choices.map(c=>JSON.stringify(c.roster))).size,1280);
 const cleared=choices.filter(c=>c.episodes.every(e=>e.stats.count>0&&e.stats.maxDrawdown<=.25));assert.equal(challenge.analysis.cleared,cleared.length);assert.ok(cleared.length>0&&cleared.length<1280);
 assert.equal(challenge.analysis.bestWorstReturn,Math.max(...cleared.map(c=>c.worstReturn)));
 assert.ok(choices.some(c=>c.episodes.some(e=>e.stats.maxDrawdown>.25)));
 assert.ok(choices.some(c=>!c.episodes[0].stats.count));
 for(const bad of [[],crew.slice(0,2),[...crew,challenge.rules.loaners[3]],crew.map((a,i)=>i?{...a}: {...a,tokenId:999}),[crew[0],crew[0],crew[2]],crew.map(a=>({...a,strategy:'auto'}))])assert.throws(()=>evaluateChallenge(challenge,bad));
 assert.throws(()=>episodePractice(practice,{from:practice.from-1,until:practice.until}));
});
test('public URLs retain the deployment prefix, strip unrelated query data and reject malformed destinations',()=>{
 const id='11111111-2222-4333-8444-555555555555';assert.equal(companyURL('https://arwyn.party/whalepools/?private=secret#seat',id),'https://arwyn.party/whalepools/#company/'+id);assert.throws(()=>companyURL('https://arwyn.party/whalepools/','../seat'));
});
test('share card escapes public text, labels exact history and avoids unverified artwork',()=>{
 const id='11111111-2222-4333-8444-555555555555',svg=companyCard({id,nickname:'A & <B> "Crew"',updatedAt:Date.now(),agents:crew,stats:{returnPct:.1,maxDrawdown:.25,count:4}},{ruleHash:'abc123',from:practice.from,until:practice.until},'https://example.test/#company/'+id);
 assert.ok(svg.includes('A &amp; &lt;B&gt; &quot;Crew&quot;'));assert.ok(!svg.includes('<B>'));assert.match(svg,/HISTORICAL ARCADE/);assert.match(svg,/end exclusive/);assert.match(svg,/rules abc123/);assert.match(svg,/Rare Whales #245/);assert.ok(!svg.includes('<image'));assert.throws(()=>companyCard({id:'bad'},{}));
});
test('pilot is off until opted in, restores locally, records readiness once and strips arbitrary sensitive fields',()=>{
 const storage=memory();let time=Date.parse('2026-10-06T12:00Z');const pilot=createPilot(storage,()=>time);
 assert.equal(pilot.record('published_create'),false);assert.equal(storage.data.size,0);pilot.start('P01');assert.throws(()=>pilot.start('P02'));
 pilot.record('wallet_ready_new');time+=5000;assert.equal(pilot.record('wallet_ready_existing'),false);pilot.record('published_create');assert.equal(pilot.record('signature'),false);
 const raw={...pilot.report(),wallet:'0xsecret',signature:'secret',events:pilot.report().events.map(e=>({...e,roster:'private'}))};storage.setItem(PILOT_KEY,JSON.stringify(raw));
 const restored=createPilot(storage,()=>time);assert.equal(restored.report().events.length,2);assert.ok(!JSON.stringify(restored.report()).includes('secret'));assert.ok(!JSON.stringify(restored.report()).includes('private'));
 restored.stop();assert.equal(restored.record('company_shared'),false);restored.erase();assert.equal(storage.data.size,0);
});
test('pilot expires after 30 days, handles storage failure and refuses malformed reports',()=>{
 const storage=memory();let time=1000000;const p=createPilot(storage,()=>time);p.start('P02');time+=30*86400000;assert.equal(p.status().state,null);assert.equal(storage.data.size,0);
 const broken=createPilot({getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}},()=>1000000);assert.equal(broken.start('P01'),false);assert.equal(broken.status().unavailable,true);assert.equal(broken.record('wallet_ready_new'),false);
 assert.throws(()=>p.start('P11'));assert.throws(()=>validatePilot({...broken.report(),events:[{type:'unknown',at:1000000}]}));
});
test('pilot readout calculates unaided activation, median time and later-day seven-day returns without inventing missing participants',()=>{
 let time=Date.parse('2026-10-06T12:00Z');const p=createPilot(memory(),()=>time);p.start('P01');p.record('wallet_ready_new');time+=120000;p.record('published_create');p.record('company_shared');assert.equal(pilotReadout([p.report()]).meaningfulReturns,0);
 time+=86400000;p.record('challenge_completed');const r=pilotReadout([p.report()]);assert.equal(r.participants,1);assert.equal(r.targetParticipants,10);assert.equal(r.unaidedPublishes,1);assert.equal(r.medianCreationMs,120000);assert.equal(r.meaningfulReturns,1);
 p.assistance(true);assert.equal(pilotReadout([p.report()]).unaidedPublishes,0);assert.equal(pilotReadout([p.report()]).medianCreationMs,null);assert.throws(()=>pilotReadout([p.report(),p.report()]));assert.equal(pilotReadout([]).participants,0);
});
