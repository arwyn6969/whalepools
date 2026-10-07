export const LIVE_PILOT_VERSION='holder-live-pilot-v1',LIVE_PILOT_KEY='whale-pools-holder-live-pilot-v1';
const day=86400000,retention=30*day;
const types=new Set(['live_ready_new','live_ready_existing','live_started','live_followup_started','live_reviewed','live_shared','live_inventory_error','live_start_error','tide_joined']);
export function validateLivePilot(value){
 if(!value||value.version!==LIVE_PILOT_VERSION||!/^P(0[1-9]|10)$/.test(value.code)||!Number.isSafeInteger(value.startedAt)||value.startedAt<0||!Number.isSafeInteger(value.expiresAt)||value.expiresAt>8640000000000000||value.expiresAt!==value.startedAt+retention||typeof value.active!=='boolean'||typeof value.assisted!=='boolean'||!Array.isArray(value.events)||value.events.length>500)throw Error('Invalid live pilot report.');
 let previous=value.startedAt;
 const events=value.events.map(event=>{
  if(!types.has(event.type)||!Number.isSafeInteger(event.at)||event.at<previous||event.at>value.expiresAt)throw Error('Invalid live pilot event.');
  previous=event.at;
  if(event.type==='live_reviewed'){
   if(!Number.isSafeInteger(event.observationAt)||event.observationAt<value.startedAt||event.observationAt>event.at)throw Error('Invalid reviewed observation.');
   return {type:event.type,at:event.at,observationAt:event.observationAt};
  }
  return {type:event.type,at:event.at};
 });
 return {version:LIVE_PILOT_VERSION,code:value.code,startedAt:value.startedAt,expiresAt:value.expiresAt,active:value.active,assisted:value.assisted,events};
}
export function createLivePilot(storage,now=Date.now){
 let state=null,unavailable=false;
 const remove=()=>{try{storage.removeItem(LIVE_PILOT_KEY);}catch{unavailable=true;}};
 try{const raw=storage.getItem(LIVE_PILOT_KEY);if(raw){state=validateLivePilot(JSON.parse(raw));if(now()>=state.expiresAt){state=null;remove();}}}catch{unavailable=true;}
 const current=()=>{if(state&&now()>=state.expiresAt){state=null;remove();}return state;};
 const save=()=>{try{storage.setItem(LIVE_PILOT_KEY,JSON.stringify(state));return true;}catch{unavailable=true;return false;}};
 return {
  status:()=>({state:current()?structuredClone(state):null,unavailable}),
  start(code){if(current())throw Error('Export or erase your existing live report first.');const t=Math.trunc(now());state=validateLivePilot({version:LIVE_PILOT_VERSION,code,startedAt:t,expiresAt:t+retention,active:true,assisted:false,events:[]});return save();},
  record(type,observationAt){
   if(!current()?.active||!types.has(type)||state.events.length>=500)return false;
   if(type.startsWith('live_ready_')&&state.events.some(e=>e.type.startsWith('live_ready_')))return false;
   const at=Math.trunc(now());if(at<state.startedAt||at<(state.events.at(-1)?.at??0))return false;
   const event={type,at};
   if(type==='live_reviewed'){
    const started=state.events.find(e=>e.type==='live_started');
    const last=state.events.filter(e=>e.type==='live_reviewed').at(-1);
    if(!started||!Number.isSafeInteger(observationAt)||observationAt<=started.at||observationAt>at||observationAt<state.startedAt||last&&observationAt<=last.observationAt)return false;
    event.observationAt=observationAt;
   }
   state.events.push(event);return save();
  },
  assistance(value){if(current()){state.assisted=!!value;save();}},
  stop(){if(current()){state.active=false;save();}},
  erase(){state=null;remove();},
  report(){if(!current())throw Error('Start an assigned live pilot report first.');return validateLivePilot(state);}
 };
}
export function livePilotReadout(reports,now=Date.now()){
 const clean=reports.map(validateLivePilot);
 if(clean.some(r=>r.startedAt>now||r.events.some(e=>e.at>now)))throw Error('Live pilot report contains future events.');
 if(new Set(clean.map(r=>r.code)).size!==clean.length)throw Error('Duplicate participant code. Use the latest live report per participant.');
 const rows=clean.map(report=>{
  const ready=report.events.find(e=>e.type==='live_ready_new'),start=report.events.find(e=>e.type==='live_started');
  const activated=!!ready&&!!start&&start.at>=ready.at;
  const later=activated?report.events.filter(e=>['live_reviewed','live_followup_started'].includes(e.type)&&e.at>start.at&&Math.floor(e.at/day)>Math.floor(start.at/day)&&e.at<=start.at+7*day&& (e.type!=='live_reviewed'||e.observationAt>start.at)):[];
  return {code:report.code,activated,unaided:activated&&!report.assisted,creationMs:activated?start.at-ready.at:null,meaningfulReturn:later.length>0,returnWindowComplete:activated&&now>=start.at+7*day,shares:report.events.filter(e=>e.type==='live_shared').length,roundPicks:report.events.filter(e=>e.type==='tide_joined').length,errors:report.events.filter(e=>e.type.endsWith('_error')).length};
 });
 const durations=rows.filter(r=>r.unaided).map(r=>r.creationMs).sort((a,b)=>a-b),n=durations.length;
 return {version:LIVE_PILOT_VERSION,participants:rows.length,targetParticipants:10,missingParticipants:10-rows.length,unaidedStarts:rows.filter(r=>r.unaided).length,medianCreationMs:n?(durations[Math.floor((n-1)/2)]+durations[Math.floor(n/2)])/2:null,meaningfulReturns:rows.filter(r=>r.meaningfulReturn).length,returnWindowsComplete:rows.filter(r=>r.returnWindowComplete).length,rows};
}
