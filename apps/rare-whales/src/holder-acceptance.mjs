export const ACCEPTANCE_VERSION='whale-pools-holder-acceptance-v1';
const journeys=[
 ['sign_in','Wallet sign-in on Robinhood Chain; rejected signing remains recoverable'],
 ['inventory','Owned whales load; an inventory failure preserves choices and can be retried'],
 ['historical','Historical publish, edit and withdraw preserve the frozen result'],
 ['drafts','Reload, wallet switch and visitor inspection preserve separate private drafts'],
 ['start','Paper Start, a new observation and saved-day recap are understandable'],
 ['stop','Keep watching, confirmed Stop, follow-up Start and private archive work'],
 ['tide','One owned badge confirms the understood, immutable future Tide pick'],
 ['sharing','Saved-day link, PNG/SVG and actual chosen sharing destination work']
];
export const ACCEPTANCE_CHECKS=[...['desktop','mobile'].flatMap(device=>journeys.map(([journey,label])=>({id:device+'.'+journey,device,label,source:'real-holder'}))),
 {id:'operator.maintenance',device:'operator',label:'Maintenance stack and public retention/consent reviewed',source:'operator-review'},
 {id:'operator.capacity',device:'operator',label:'Free account quotas and deployed cohort capacity reviewed',source:'operator-review'}];
const keys=(value,expected)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>expected.includes(k))&&expected.every(k=>Object.hasOwn(value,k));
const utc=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function acceptanceContext({candidateCommit,base,paperHash,tideHash}) {
 const url=new URL(base);
 if(!/^[0-9a-f]{40}$/.test(candidateCommit)||![paperHash,tideHash].every(h=>/^[0-9a-f]{64}$/.test(h||'')))throw Error('Use the exact tested commit and built paper/Tide hashes.');
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('Use a plain app base URL without credentials or query parameters.');
 if(!url.pathname.endsWith('/'))url.pathname+='/';
 return {candidateCommit,base:url.href,paperHash,tideHash};
}
export function acceptanceTemplate(context,now=Date.now()) {
 return {kind:ACCEPTANCE_VERSION,...acceptanceContext(context),createdAt:new Date(now).toISOString(),observations:ACCEPTANCE_CHECKS.map(c=>({check:c.id,status:'pending',source:null,observedAt:null,browser:'',failureTheme:null}))};
}
export function acceptanceReadout(document,expected,now=Date.now()) {
 const context=acceptanceContext(expected);
 if(!keys(document,['kind','candidateCommit','base','paperHash','tideHash','createdAt','observations'])||document.kind!==ACCEPTANCE_VERSION)throw Error('Use the current acceptance template. Extra fields, identities and older report formats are not accepted.');
 for(const [key,value] of Object.entries(context))if(document[key]!==value)throw Error('Acceptance context differs: '+key+'. Create a template for the current tested candidate.');
 if(!utc(document.createdAt)||Date.parse(document.createdAt)>now)throw Error('The template date is invalid or in the future.');
 if(!Array.isArray(document.observations)||document.observations.length!==ACCEPTANCE_CHECKS.length)throw Error('Keep all desktop, mobile and operator checks in the template.');
 const seen=new Set(),checks=[];
 for(const row of document.observations){
  const spec=ACCEPTANCE_CHECKS.find(c=>c.id===row?.check);
  if(!keys(row,['check','status','source','observedAt','browser','failureTheme'])||!spec||seen.has(row.check))throw Error('Unknown, duplicate or extra acceptance fields.');
  seen.add(row.check);
  if(!['pending','pass','fail'].includes(row.status)||typeof row.browser!=='string'||row.browser.length>80||!/^[\w .()/+-]*$/.test(row.browser)||/0x[0-9a-f]{8}/i.test(row.browser))throw Error('Use pending/pass/fail and a plain browser/version label without private identifiers.');
  if(row.status==='pending'){
   if(row.source!==null||row.observedAt!==null||row.failureTheme!==null)throw Error('Pending checks must not claim an observation.');
  }else{
   if(![spec.source,'fixture'].includes(row.source)||!utc(row.observedAt)||Date.parse(row.observedAt)>now||Date.parse(row.observedAt)<Date.parse(document.createdAt))throw Error('Record the correct evidence source and an actual UTC observation after the template was created.');
   if(!row.browser.trim())throw Error('Record the browser/device version or operator tool used.');
   if(row.status==='fail'?!['wallet','network','inventory','privacy','clarity','execution','sharing','other'].includes(row.failureTheme):row.failureTheme!==null)throw Error('A failure needs a non-identifying failure theme; a pass has none.');
  }
  checks.push({...spec,status:row.status,source:row.source,observedAt:row.observedAt,browser:row.browser,failureTheme:row.failureTheme,accepted:row.status==='pass'&&row.source===spec.source});
 }
 const holder=checks.filter(c=>c.device!=='operator'),operator=checks.filter(c=>c.device==='operator');
 return {kind:'whale-pools-holder-acceptance-readout-v1',...context,checkedAt:new Date(now).toISOString(),
  realHolderChecksPass:holder.every(c=>c.accepted),operatorChecksPass:operator.every(c=>c.accepted),
  realHolderPasses:holder.filter(c=>c.accepted).length,realHolderFailures:holder.filter(c=>c.source==='real-holder'&&c.status==='fail').length,
  fixturePasses:checks.filter(c=>c.source==='fixture'&&c.status==='pass').length,
  pending:checks.filter(c=>!c.accepted).map(c=>c.id),checks,launchReady:false,
  note:'Manual declarations only, not verification of holder identity, signatures or delivery. Fixture passes never close real-holder/operator checks. Reconcile fresh staging assets/readiness, elapsed recorder/Tide evidence and the owner production decision separately. This report measures no pilot participants or returns.'};
}
