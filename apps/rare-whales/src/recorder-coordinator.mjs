import {observeScheduled} from './recorder-observer.mjs';

// One coordinator per market/rules pair. Company truth stays in D1; this tiny
// checkpoint only bounds duplicate wake-ups and retries across object restarts.
export function createRecorderCoordinator({storage,env,tick,clock=Date.now,log=console}){
 let inFlight=null;
 async function execute(scheduledTime){
  const startedAt=clock(),minute=Math.floor(startedAt/60000);
  const previous=await storage.get('checkpoint');
  if(previous?.completedMinute>=minute)return {duplicate:true};
  const attempts=previous?.minute===minute?previous.attempts:0;
  if(attempts>=2)throw Error('Recorder retry budget used. The next scheduled minute can retry.');
  const checkpoint={minute,attempts:attempts+1,completedMinute:previous?.completedMinute??null,startedAt,status:'started'};
  await storage.put('checkpoint',checkpoint);
  log.info({event:'paper-durable-recorder',phase:'started',minute,attempt:checkpoint.attempts});
  try{
   const result=await observeScheduled({scheduledTime},env,{tick,clock,log});
   const status=result?.busy?'busy':result?.disabled?'disabled':'ok';
   const count=n=>Number.isSafeInteger(n)&&n>=0?n:null;
   const summary={status,recorded:count(result?.recorded),runs:count(result?.runs),tideAdvanced:count(result?.tide?.advanced)};
   await storage.put('checkpoint',{...checkpoint,...summary,finishedAt:clock(),completedMinute:status==='ok'?minute:checkpoint.completedMinute});
   log.info({event:'paper-durable-recorder',phase:'finished',minute,...summary});
   return summary;
  }catch{
   await storage.put('checkpoint',{...checkpoint,status:'failed',finishedAt:clock()});
   throw Error('Durable recorder failed. Saved records are kept; a later wake-up can retry.');
  }
 }
 return {
  run(scheduledTime){
   if(!inFlight)inFlight=execute(Number.isFinite(scheduledTime)?scheduledTime:null).finally(()=>{inFlight=null;});
   return inFlight;
  },
  async status(){return (await storage.get('checkpoint'))??null;}
 };
}

export async function wakeDurableRecorder(controller,env,{name,log=console}){
 if(!env.PAPER_RECORDER)throw Error('Durable recorder binding is missing. No direct fallback was attempted.');
 try{
  const result=await env.PAPER_RECORDER.getByName(name).run(controller?.scheduledTime??null);
  log.info({event:'paper-recorder-wakeup',executor:'durable-object',status:result.duplicate?'duplicate':result.status});
 }catch{
  log.error({event:'paper-recorder-wakeup',executor:'durable-object',status:'failed'});
  throw Error('Durable recorder wake-up failed. Inspect the recorder invocation.');
 }
}

export function scheduleRecorder(controller,env,{tick,name,log=console}){
 if(env.RECORDER_MODE==='durable-object')return wakeDurableRecorder(controller,env,{name,log});
 if(env.RECORDER_MODE==='paused'){
  log.info({event:'paper-recorder-wakeup',status:'paused'});
  return Promise.resolve({paused:true});
 }
 if(env.RECORDER_MODE&&env.RECORDER_MODE!=='direct')return Promise.reject(Error('Unknown recorder mode. Recording remains paused.'));
 return observeScheduled(controller,env,{tick,log});
}
