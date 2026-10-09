import {acceptanceContext, acceptanceTemplate, acceptanceReadout} from './holder-acceptance.mjs';

export const PLAYTEST_VERSION='whale-pools-playtest-v1';
export const CONCEPT_VERSION='safe-harbour-concept-v1';
export const SESSION_RETENTION=30*86400000;
export const PREFERENCES=['tide','safe-harbour','neither','undecided'];
export const REASONS=['decisions','competition','identity','protect-budget','none','other'];
export const CONFUSIONS=['time','coverage','costs','wallet','sharing','waiting','none'];
const exact=(v,ks)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export function sessionTemplate(context,code,now=Date.now()){
 if(!/^P(0[1-9]|10)$/.test(code))throw Error('Use an assigned anonymous code P01–P10.');
 return {kind:PLAYTEST_VERSION,conceptVersion:CONCEPT_VERSION,code,source:'rehearsal',device:'desktop',consented:false,observedAt:null,
  expiresAt:new Date(now+SESSION_RETENTION).toISOString(),acceptance:acceptanceTemplate(context,now),
  interview:{completed:false,preference:'undecided',reason:'none',confusions:[]},
  sharing:{destination:'not-tested',delivered:false}};
}
export function sessionReadout(report,expected,now=Date.now()){
 if(!exact(report,['kind','conceptVersion','code','source','device','consented','observedAt','expiresAt','acceptance','interview','sharing'])||report.kind!==PLAYTEST_VERSION||report.conceptVersion!==CONCEPT_VERSION||!/^P(0[1-9]|10)$/.test(report.code))throw Error('Use the current anonymous playtest format; extra fields and identities are rejected.');
 const acceptance=acceptanceReadout(report.acceptance,expected,now);
 if(!date(report.expiresAt)||Date.parse(report.expiresAt)!==Date.parse(report.acceptance.createdAt)+SESSION_RETENTION||now>=Date.parse(report.expiresAt))throw Error('The session has expired or its thirty-day retention date changed.');
 if(!['rehearsal','observed-holder'].includes(report.source)||!['desktop','mobile'].includes(report.device)||typeof report.consented!=='boolean')throw Error('Choose the evidence source, device and voluntary consent.');
 if(report.observedAt!==null&&(!date(report.observedAt)||Date.parse(report.observedAt)>now||Date.parse(report.observedAt)<Date.parse(report.acceptance.createdAt)))throw Error('Record an actual session time after the worksheet was created.');
 const i=report.interview,s=report.sharing;
 if(!exact(i,['completed','preference','reason','confusions'])||typeof i.completed!=='boolean'||!PREFERENCES.includes(i.preference)||!REASONS.includes(i.reason)||!Array.isArray(i.confusions)||i.confusions.length>CONFUSIONS.length||new Set(i.confusions).size!==i.confusions.length||i.confusions.some(c=>!CONFUSIONS.includes(c))||i.confusions.includes('none')&&i.confusions.length>1)throw Error('Use the bounded interview choices, without private free text.');
 if(i.completed&&!i.confusions.length)throw Error('Ask about confusion before marking the interview complete.');
 if(!exact(s,['destination','delivered'])||!['not-tested','messaging','social','email','other'].includes(s.destination)||typeof s.delivered!=='boolean'||s.delivered&&s.destination==='not-tested')throw Error('Delivery needs an actual destination category; opening a share sheet is not delivery.');
 if(report.source==='observed-holder'&&(!report.consented||report.observedAt===null))throw Error('An observed holder session needs voluntary consent and a recorded session time.');
 for(const c of acceptance.checks){
  if(c.status==='pending')continue;
  if(c.device==='operator'||c.device!==report.device||report.source==='rehearsal'&&c.source!=='fixture'||report.source==='observed-holder'&&(c.source!=='real-holder'||Date.parse(c.observedAt)<Date.parse(report.observedAt)))throw Error('Session checks must match the device, session time and evidence source. Operator review stays separate.');
 }
 if(report.source==='observed-holder'&&acceptance.checks.find(c=>c.id===report.device+'.sharing').accepted&&!s.delivered)throw Error('A sharing pass needs inspected destination delivery, not just a share sheet or download.');
 return {code:report.code,source:report.source,device:report.device,
  observedInterview:report.source==='observed-holder'&&i.completed,
  preference:i.completed?i.preference:null,reason:i.completed?i.reason:null,confusions:i.completed?i.confusions:[],
  statedDelivery:report.source==='observed-holder'&&s.delivered,
  realHolderPasses:acceptance.realHolderPasses,fixturePasses:acceptance.fixturePasses,pending:acceptance.pending};
}
export function playtestReadout(reports,expected,now=Date.now()){
 const context=acceptanceContext(expected);
 if(!Array.isArray(reports)||reports.length>10)throw Error('Use at most ten latest anonymous sessions.');
 const rows=reports.map(r=>sessionReadout(r,context,now));
 if(new Set(rows.map(r=>r.code)).size!==rows.length)throw Error('Duplicate code: choose one latest session per holder. Desktop/mobile acceptance worksheets can be reviewed separately.');
 const interviews=rows.filter(r=>r.observedInterview);
 return {kind:'whale-pools-playtest-readout-v1',...context,conceptVersion:CONCEPT_VERSION,checkedAt:new Date(now).toISOString(),
  observedSessions:rows.filter(r=>r.source==='observed-holder').length,rehearsals:rows.filter(r=>r.source==='rehearsal').length,
  observedInterviews:interviews.length,targetInterviews:5,
  preferences:Object.fromEntries(PREFERENCES.map(p=>[p,interviews.filter(r=>r.preference===p).length])),
  confusionThemes:Object.fromEntries(CONFUSIONS.map(c=>[c,interviews.filter(r=>r.confusions.includes(c)).length])),
  statedDeliveries:rows.filter(r=>r.statedDelivery).length,rows,challengeEnabled:false,launchReady:false,
  note:'Manual observations only. Preference is not retention, independent trading trials or a proven edge. Rehearsals close no real checks. Use the separate voluntary live-pilot reports for ten-holder activation and seven-day returns; reconcile real signing, destination delivery, reliability, capacity and release review separately.'};
}
