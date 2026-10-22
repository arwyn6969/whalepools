import assert from 'node:assert/strict';
import test from 'node:test';
import {createRecorderCoordinator,wakeDurableRecorder,scheduleRecorder} from '../src/recorder-coordinator.mjs';

function fixture(tick){
 let now=60001;const values=new Map(),logs=[];
 const storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v))};
 const options={storage,env:{},tick,clock:()=>now,log:{info:v=>logs.push(v),error:v=>logs.push(v)}};
 return {make:()=>createRecorderCoordinator(options),advance:t=>now=t,values,logs};
}
test('one successful minute persists across reconstruction; new minutes use current clock, never replay the trigger time',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return {runs:3,recorded:1,tide:{advanced:1},wallet:'private'};});
 const a=f.make();assert.equal((await a.run(0)).runs,3);assert.equal(calls,1);
 assert.deepEqual(await f.make().run(0),{duplicate:true});assert.equal(calls,1);
 f.advance(180001);await f.make().run(0);assert.equal(calls,2);
 assert.equal((await a.status()).completedMinute,3);assert.doesNotMatch(JSON.stringify(f.values.get('checkpoint')),/wallet|private/);
});
test('overlapping RPC wake-ups share one execution including external waits',async()=>{
 let finish,calls=0;const gate=new Promise(resolve=>finish=resolve),f=fixture(async()=>{calls++;await gate;return {runs:3};}),a=f.make();
 const results=[a.run(60000),a.run(60000),a.run(60000)];finish();await Promise.all(results);assert.equal(calls,1);
});
test('failed execution rejects safely, permits one same-minute retry, and cannot consume an unbounded retry budget',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return {error:'private provider URL'};});
 await assert.rejects(f.make().run(60000),/Durable recorder failed/);
 await assert.rejects(f.make().run(60000),/Durable recorder failed/);
 await assert.rejects(f.make().run(60000),/retry budget/);assert.equal(calls,2);
 f.advance(120001);await assert.rejects(f.make().run(120000));assert.equal(calls,3);
 assert.equal(f.values.get('checkpoint').completedMinute,null);assert.doesNotMatch(JSON.stringify([...f.values,f.logs]),/private provider/);
});
test('a busy lease is not a completed minute; later retries can recover without replaying saved work',async()=>{
 let calls=0;const f=fixture(async()=>++calls===1?{busy:true}:{recorded:0,runs:3});
 assert.equal((await f.make().run(60000)).status,'busy');assert.equal(f.values.get('checkpoint').completedMinute,null);
 assert.equal((await f.make().run(60000)).status,'ok');assert.equal(f.values.get('checkpoint').completedMinute,1);
});
test('a lost checkpoint write does not claim completion and recovery keeps engine commits authoritative',async()=>{
 let calls=0,failWrite=true;const stored=new Map(),storage={get:async k=>stored.get(k),put:async(k,v)=>{if(v.status==='ok'&&failWrite){failWrite=false;throw Error('storage unavailable');}stored.set(k,v);}};
 const make=()=>createRecorderCoordinator({storage,env:{},tick:async()=>{calls++;return {recorded:0,runs:3};},clock:()=>60001,log:{info(){},error(){}}});
 await assert.rejects(make().run(60000));assert.equal(stored.get('checkpoint').status,'failed');
 await make().run(60000);assert.equal(calls,2);assert.equal(stored.get('checkpoint').completedMinute,1);
});
test('the thin scheduled wake-up fails closed on a missing binding and propagates RPC failures without private text',async()=>{
 const log={info(){},error(){}};
 await assert.rejects(wakeDurableRecorder({}, {},{name:'market',log}),/binding is missing/);
 await assert.rejects(wakeDurableRecorder({}, {PAPER_RECORDER:{getByName(){return {run:async()=>{throw Error('private data');}};}}},{name:'market',log}),e=>/wake-up failed/.test(e.message)&&!e.message.includes('private'));
});
test('operator pause and invalid mode never fall back to direct execution; legacy defaults stay supported',async()=>{
 let calls=0;const options={tick:async()=>{calls++;return {runs:3};},name:'market',log:{info(){},error(){}}};
 assert.deepEqual(await scheduleRecorder({}, {RECORDER_MODE:'paused'},options),{paused:true});
 await assert.rejects(scheduleRecorder({}, {RECORDER_MODE:'typo'},options),/Unknown recorder mode/);
 await assert.rejects(scheduleRecorder({}, {RECORDER_MODE:'durable-object'},options));assert.equal(calls,0);
 await scheduleRecorder({}, {},options);await scheduleRecorder({}, {RECORDER_MODE:'direct'},options);assert.equal(calls,2);
});
