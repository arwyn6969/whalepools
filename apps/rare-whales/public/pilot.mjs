export const PILOT_VERSION='holder-pilot-v1',PILOT_KEY='whale-pools-holder-pilot-v1';
const retention=30*86400000,types=new Set(['wallet_ready_new','wallet_ready_existing','inventory_error','publish_error','published_create','published_edit','company_shared','challenge_completed']);
export function validatePilot(value){
 if(!value||value.version!==PILOT_VERSION||!/^P(0[1-9]|10)$/.test(value.code)||!Number.isSafeInteger(value.startedAt)||value.startedAt<0||!Number.isSafeInteger(value.expiresAt)||value.expiresAt>8640000000000000||value.expiresAt!==value.startedAt+retention||typeof value.active!=='boolean'||typeof value.assisted!=='boolean'||!Array.isArray(value.events)||value.events.length>500)throw Error('Invalid pilot report.');
 let previous=value.startedAt;
 const events=value.events.map(event=>{if(!types.has(event.type)||!Number.isSafeInteger(event.at)||event.at<previous||event.at>value.expiresAt)throw Error('Invalid pilot event.');previous=event.at;return {type:event.type,at:event.at};});
 // Whitelist every field, including imports used by the operator readout.
 return {version:PILOT_VERSION,code:value.code,startedAt:value.startedAt,expiresAt:value.expiresAt,active:value.active,assisted:value.assisted,events};
}
export function createPilot(storage,now=Date.now){
 let state=null,unavailable=false;
 try{const raw=storage.getItem(PILOT_KEY);if(raw){state=validatePilot(JSON.parse(raw));if(now()>=state.expiresAt){storage.removeItem(PILOT_KEY);state=null;}}}catch{unavailable=true;}
 const save=()=>{try{storage.setItem(PILOT_KEY,JSON.stringify(state));return true;}catch{unavailable=true;return false;}};
 const current=()=>{if(state&&now()>=state.expiresAt){state=null;try{storage.removeItem(PILOT_KEY);}catch{unavailable=true;}}return state;};
 return {
  status:()=>({state:current()?structuredClone(state):null,unavailable}),
  start(code){const old=current();if(old)throw Error('Export or erase the existing report before starting another participant.');const t=Math.trunc(now());state=validatePilot({version:PILOT_VERSION,code,startedAt:t,expiresAt:t+retention,active:true,assisted:false,events:[]});return save();},
  record(type){if(type.startsWith('wallet_ready_')&&current()?.events.some(e=>e.type.startsWith('wallet_ready_')))return false;if(!current()?.active||!types.has(type)||state.events.length>=500)return false;const at=Math.trunc(now());if(at<state.startedAt||at<(state.events.at(-1)?.at??0))return false;state.events.push({type,at});return save();},
  assistance(value){if(current()){state.assisted=!!value;save();}},
  stop(){if(current()){state.active=false;save();}},
  erase(){state=null;try{storage.removeItem(PILOT_KEY);unavailable=false;}catch{unavailable=true;}},
  report(){if(!current())throw Error('Start a pilot report first.');return validatePilot(state);}
 };
}
export function pilotReadout(reports){
 const clean=reports.map(validatePilot),codes=clean.map(r=>r.code);if(new Set(codes).size!==codes.length)throw Error('Duplicate participant code. Use only the latest report per participant.');
 const rows=clean.map(report=>{
  const ready=report.events.find(e=>e.type==='wallet_ready_new'),publish=report.events.find(e=>e.type==='published_create'),activated=!!ready&&!!publish&&publish.at>=ready.at;
  const returns=publish?report.events.filter(e=>['company_shared','challenge_completed','published_edit'].includes(e.type)&&e.at>publish.at&&Math.floor(e.at/86400000)>Math.floor(publish.at/86400000)&&e.at<=publish.at+7*86400000):[];
  return {code:report.code,activated,unaided:activated&&!report.assisted,creationMs:activated?publish.at-ready.at:null,meaningfulReturn:returns.length>0,errors:report.events.filter(e=>e.type.endsWith('_error')).length};
 });
 const durations=rows.filter(r=>r.unaided).map(r=>r.creationMs).sort((a,b)=>a-b),n=durations.length,median=n?(durations[Math.floor((n-1)/2)]+durations[Math.floor(n/2)])/2:null;
 return {version:PILOT_VERSION,participants:rows.length,targetParticipants:10,unaidedPublishes:rows.filter(r=>r.unaided).length,medianCreationMs:median,meaningfulReturns:rows.filter(r=>r.meaningfulReturn).length,errors:rows.reduce((s,r)=>s+r.errors,0),rows};
}
