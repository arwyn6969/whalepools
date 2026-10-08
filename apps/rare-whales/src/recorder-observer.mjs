// Observe the frozen recorder without changing its clock, order or fill rules.
export async function observeScheduled(controller,env,{tick,clock=Date.now,log=console}={}){
 const startedAt=clock(),scheduledAt=Number.isFinite(controller?.scheduledTime)?controller.scheduledTime:null;
 const base={event:'paper-scheduled',startedAt,scheduledAt,scheduleLagMs:scheduledAt===null?null:Math.max(0,startedAt-scheduledAt)};
 log.info({...base,phase:'started'});
 let result;
 try{
  result=await tick(env);
  if(result?.error)throw Error('The paper recorder reported a failure. Inspect paper-recorder-failure logs.');
 }catch{
  // Caught engine errors have their own log. Do not copy secrets,
  // wallet data or arbitrary exception text into this invocation summary.
  log.error({...base,phase:'finished',status:'failed',durationMs:Math.max(0,clock()-startedAt)});
  throw Error('Scheduled paper recording failed. Saved records are kept.');
 }
 const count=n=>Number.isSafeInteger(n)&&n>=0?n:null;
 log.info({...base,phase:'finished',status:result?.busy?'busy':result?.disabled?'disabled':'ok',durationMs:Math.max(0,clock()-startedAt),recorded:count(result?.recorded),runs:count(result?.runs),tideAdvanced:count(result?.tide?.advanced),tideStatus:result?.tide?.busy?'busy':result?.tide?.disabled?'disabled':'ok'});
 return result;
}
