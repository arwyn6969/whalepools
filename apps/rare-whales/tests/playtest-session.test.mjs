import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {sessionTemplate,sessionReadout,playtestReadout,SESSION_RETENTION} from '../src/playtest-session.mjs';
import {acceptanceReadout} from '../src/holder-acceptance.mjs';
import {startPlaytestServer} from '../scripts/serve-playtest.mjs';
const context={candidateCommit:'a'.repeat(40),base:'https://staging.example/whalepools/',paperHash:'b'.repeat(64),tideHash:'c'.repeat(64)},now=Date.parse('2026-10-09T14:00:00.000Z');
const template=()=>sessionTemplate(context,'P01',now);
const observed=()=>{const r=template();r.source='observed-holder';r.consented=true;r.observedAt=new Date(now).toISOString();return r;};
const pass=(r,id='desktop.sign_in',source='real-holder')=>{Object.assign(r.acceptance.observations.find(c=>c.check===id),{status:'pass',source,browser:'Safari 26',observedAt:new Date(now).toISOString()});return r;};
const interview=r=>{r.interview={completed:true,preference:'safe-harbour',reason:'protect-budget',confusions:['none']};return r;};
test('A blank or rehearsed preference never becomes real interview, delivery or acceptance evidence',()=>{
 const empty=playtestReadout([],context,now);assert.equal(empty.observedSessions,0);assert.equal(empty.observedInterviews,0);assert.equal(empty.challengeEnabled,false);assert.equal(empty.launchReady,false);
 const r=interview(pass(template(),'desktop.sign_in','fixture'));r.sharing={destination:'social',delivered:true};
 const out=playtestReadout([r],context,now);assert.equal(out.observedInterviews,0);assert.equal(out.preferences['safe-harbour'],0);assert.equal(out.statedDeliveries,0);assert.equal(out.rows[0].fixturePasses,1);assert.equal(out.rows[0].realHolderPasses,0);
});
test('Observed preference is a manual conversation measure; existing-format acceptance stays separable',()=>{
 const r=interview(pass(observed()));const out=playtestReadout([r],context,now);assert.equal(out.observedInterviews,1);assert.equal(out.preferences['safe-harbour'],1);assert.equal(out.rows[0].realHolderPasses,1);assert.equal(out.launchReady,false);assert.equal(out.challengeEnabled,false);assert.ok(!Object.hasOwn(out,'meaningfulReturns'));assert.equal(acceptanceReadout(r.acceptance,context,now).realHolderPasses,1);
});
test('Consent, timestamps and answered confusion are required; an observed record cannot carry rehearsed checks',()=>{
 for(const mutate of [r=>r.consented=false,r=>r.observedAt=null,r=>r.observedAt=new Date(now+1).toISOString(),r=>r.observedAt=new Date(now-1).toISOString(),r=>r.interview.confusions=[]]){const r=interview(observed());mutate(r);assert.throws(()=>sessionReadout(r,context,now));}
 assert.throws(()=>sessionReadout(pass(observed(),'desktop.sign_in','fixture'),context,now));assert.throws(()=>sessionReadout(pass(template()),context,now));
});
test('Wrong device and operator checks cannot be passed by a holder session',()=>{
 assert.throws(()=>sessionReadout(pass(observed(),'mobile.sign_in'),context,now));assert.throws(()=>sessionReadout(pass(observed(),'operator.capacity','operator-review'),context,now));
 const r=observed();r.observedAt=new Date(now+1000).toISOString();pass(r);assert.throws(()=>sessionReadout(r,context,now+2000));
});
test('Actual sharing acceptance requires inspected delivery in a destination; delivery is still a declaration',()=>{
 const r=pass(observed(),'desktop.sharing');assert.throws(()=>sessionReadout(r,context,now),/destination delivery/);r.sharing.delivered=true;assert.throws(()=>sessionReadout(r,context,now),/actual destination/);r.sharing.destination='messaging';assert.equal(playtestReadout([r],context,now).statedDeliveries,1);
});
test('Imported reports reject private fields at every level, arbitrary themes, duplicate/conflicting codes and stale context',()=>{
 for(const mutate of [r=>r.wallet='0x1234',r=>r.interview.notes='private',r=>r.sharing.url='private',r=>r.acceptance.wallet='private',r=>r.acceptance.observations[0].signature='private',r=>r.interview.confusions=['none','wallet'],r=>r.interview.confusions=['wallet','wallet'],r=>r.interview.preference='winner',r=>r.code='P11',r=>r.conceptVersion='unversioned']){const r=template();mutate(r);assert.throws(()=>sessionReadout(r,context,now));}
 assert.throws(()=>playtestReadout([template(),template()],context,now),/Duplicate/);assert.throws(()=>playtestReadout(Array(11).fill(template()),context,now),/at most ten/);
 for(const field of ['candidateCommit','base','paperHash','tideHash']){const r=template();r.acceptance[field]=field==='base'?'https://other.example/': 'd'.repeat(field==='candidateCommit'?40:64);assert.throws(()=>sessionReadout(r,context,now),/context differs/);}
});
test('Thirty-day expiry is enforced and cannot be extended by editing the exported record',()=>{
 assert.doesNotThrow(()=>sessionReadout(template(),context,now+SESSION_RETENTION-1));assert.throws(()=>sessionReadout(template(),context,now+SESSION_RETENTION),/expired/);const r=template();r.expiresAt=new Date(now+SESSION_RETENTION+1).toISOString();assert.throws(()=>sessionReadout(r,context,now),/retention/);
});
test('Local desk serves only an explicit no-store allowlist and no write/API/operator export route',async()=>{
 const server=await startPlaytestServer({context,port:0});try{
  for(const route of ['/','/context.json','/playtest.mjs','/playtest.css','/playtest-session.mjs','/holder-acceptance.mjs']){const res=await fetch(server.origin+route);assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');assert.match(res.headers.get('content-security-policy'),/connect-src 'self'/);}
  for(const route of ['/work/P01.json','/operator/playtest.html','/api/paper','/src/playtest-session.mjs','/context.json?wallet=private'])assert.equal((await fetch(server.origin+route)).status,404);
  assert.equal((await fetch(server.origin,{method:'POST',body:'private'})).status,405);
  const foreign=await new Promise((resolve,reject)=>{const req=request(server.origin,{headers:{Host:'remote.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
  assert.equal(foreign,403);assert.equal((await fetch(server.origin,{method:'HEAD'})).status,200);
 }finally{await server.close();}
});
