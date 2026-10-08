import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptanceTemplate,acceptanceReadout,ACCEPTANCE_CHECKS} from '../src/holder-acceptance.mjs';
import {stopReview,followUpMessage} from '../public/watch-controls.mjs';
const now=Date.parse('2026-10-08T13:00:00.000Z'),context={candidateCommit:'a'.repeat(40),base:'https://staging.example/whalepools/',paperHash:'b'.repeat(64),tideHash:'c'.repeat(64)};
const template=()=>acceptanceTemplate(context,now-1000);
const fill=(source='fixture')=>{const value=template();value.observations=value.observations.map((r,i)=>({...r,status:'pass',source:source==='fixture'?source:ACCEPTANCE_CHECKS[i].source,observedAt:new Date(now).toISOString(),browser:'Test Browser 1.0'}));return value;};
test('An untouched acceptance template leaves every real check pending and never approves launch',()=>{
 const r=acceptanceReadout(template(),context,now);assert.equal(r.pending.length,18);assert.equal(r.realHolderPasses,0);assert.equal(r.realHolderChecksPass,false);assert.equal(r.launchReady,false);
});
test('Passing fixtures cannot satisfy desktop, mobile or operator acceptance',()=>{
 const r=acceptanceReadout(fill(),context,now);assert.equal(r.fixturePasses,18);assert.equal(r.pending.length,18);assert.equal(r.realHolderChecksPass,false);assert.equal(r.operatorChecksPass,false);
});
test('Explicit real observations remain declarations and require a separate release review',()=>{
 const r=acceptanceReadout(fill('real'),context,now);assert.equal(r.realHolderPasses,16);assert.equal(r.realHolderChecksPass,true);assert.equal(r.operatorChecksPass,true);assert.equal(r.launchReady,false);assert.match(r.note,/Manual declarations only/);
});
test('A real failure stays open even when all other observations pass',()=>{
 const value=fill('real');Object.assign(value.observations[8],{status:'fail',failureTheme:'wallet'});const r=acceptanceReadout(value,context,now);assert.equal(r.realHolderFailures,1);assert.deepEqual(r.pending,['mobile.sign_in']);assert.equal(r.realHolderChecksPass,false);
});
test('Stale commit, environment and rule identities cannot qualify',()=>{
 for(const key of ['candidateCommit','base','paperHash','tideHash']){const v=template();v[key]=key==='base'?'https://production.example/': 'd'.repeat(key==='candidateCommit'?40:64);assert.throws(()=>acceptanceReadout(v,context,now),/context differs/);}
 assert.throws(()=>acceptanceTemplate({...context,base:'https://staging.example/?credential=secret'}),/plain app/);
});
test('Future, duplicate, missing and wrongly sourced evidence is rejected',()=>{
 const future=fill();future.observations[0].observedAt=new Date(now+1).toISOString();assert.throws(()=>acceptanceReadout(future,context,now),/actual UTC/);
 const duplicate=template();duplicate.observations[1]=duplicate.observations[0];assert.throws(()=>acceptanceReadout(duplicate,context,now),/duplicate/);
 const missing=template();missing.observations.pop();assert.throws(()=>acceptanceReadout(missing,context,now),/Keep all/);
 const wrong=fill('real');wrong.observations[0].source='operator-review';assert.throws(()=>acceptanceReadout(wrong,context,now),/evidence source/);
});
test('Acceptance records reject extra identity/signature fields and invalid pending claims',()=>{
 const identity=template();identity.observations[0].wallet='0x'+'1'.repeat(40);assert.throws(()=>acceptanceReadout(identity,context,now),/extra acceptance fields/);
 const signature=template();signature.signature='secret';assert.throws(()=>acceptanceReadout(signature,context,now),/Extra fields/);
 const pending=template();pending.observations[0].observedAt=new Date(now).toISOString();assert.throws(()=>acceptanceReadout(pending,context,now),/Pending checks/);
});
const run={id:'11111111-1111-1111-1111-111111111111',owner:'holder',status:'running',nickname:'My current',stats:{equity:998.5},history:[{t:now}],agents:[{qty:1,pending:null},{qty:0,pending:{side:'buy'}}]};
test('Stop review describes the owned running watch without changing it',()=>{
 const before=structuredClone(run);assert.deepEqual(stopReview(run,'holder'),{id:run.id,wallet:'holder',nickname:'My current',equity:998.5,lastValuation:now,positions:1,queued:1});assert.deepEqual(run,before);
});
test('A visitor, switched wallet, malformed or finished watch has no Stop review',()=>{
 assert.equal(stopReview(run,'other'),null);assert.equal(stopReview(run,null),null);assert.equal(stopReview({...run,status:'stopped'},'holder'),null);assert.equal(stopReview({...run,stats:{equity:NaN}},'holder'),null);
});
test('Follow-up explanation appears only for frozen watches and distinguishes a new record',()=>{
 assert.equal(followUpMessage(run),'');assert.match(followUpMessage({...run,status:'stopped'}),/separate 14-day record/);assert.match(followUpMessage({...run,status:'completed'}),/has finished/);
});
