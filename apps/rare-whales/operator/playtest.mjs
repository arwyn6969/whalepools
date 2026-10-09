import {sessionTemplate,sessionReadout,playtestReadout} from '/playtest-session.mjs';
import {ACCEPTANCE_CHECKS} from '/holder-acceptance.mjs';
const $=id=>document.getElementById(id);
let context,report=null;
const status=message=>{$('session-status').textContent=message;};
const download=(value,name)=>{const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const swap=()=>{$('mission-cards').append($('mission-cards').firstElementChild);};
const actions=['begin','observe','export','worksheet'];actions.forEach(id=>$(id).disabled=true);
for(let n=1;n<=10;n++){const o=document.createElement('option');o.value='P'+String(n).padStart(2,'0');o.textContent=o.value;$('code').append(o);}
function checks(){
 $('checks').replaceChildren();
 for(const spec of ACCEPTANCE_CHECKS.filter(c=>c.device===report.device)){
  const label=document.createElement('label'),select=document.createElement('select');select.id='check-'+spec.id;label.htmlFor=select.id;label.textContent=spec.label;
  for(const [value,text] of [['pending','Not observed'],['pass','Pass'],['fail','Fail']]){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o);}
  const theme=document.createElement('select');theme.id='theme-'+spec.id;theme.setAttribute('aria-label','Failure theme: '+spec.label);
  for(const value of ['other','wallet','network','inventory','privacy','clarity','execution','sharing']){const o=document.createElement('option');o.value=value;o.textContent=value;theme.append(o);}
  theme.disabled=true;select.addEventListener('change',()=>{theme.disabled=select.value!=='fail';});
  const row=document.createElement('div');row.className='fields';row.append(select,theme);$('checks').append(label,row);
 }
}
function current(){
 if(!report)throw Error('Begin a session first.');
 const next=structuredClone(report);next.consented=$('consent').checked;
 next.interview={completed:$('interview').checked,preference:$('preference').value,reason:$('reason').value,confusions:$('confusion').value?[$('confusion').value]:[]};
 next.sharing={destination:$('destination').value,delivered:$('delivered').checked};
 const now=new Date().toISOString();
 for(const row of next.acceptance.observations.filter(c=>c.check.startsWith(next.device+'.'))){
  const value=$('check-'+row.check).value;row.status=value;row.source=value==='pending'?null:next.source==='rehearsal'?'fixture':'real-holder';row.observedAt=value==='pending'?null:now;row.browser=value==='pending'?'':$('browser').value;row.failureTheme=value==='fail'?$('theme-'+row.check).value:null;
 }
 sessionReadout(next,context);return next;
}
function show(value){const r=playtestReadout([value],context);$('readout').textContent=`${r.observedInterviews} observed interview(s) · ${r.rehearsals} rehearsal(s)\n${r.rows[0].realHolderPasses} real-holder checks · ${r.rows[0].fixturePasses} fixture checks\n${r.statedDeliveries} stated destination delivery(s)\nSafe Harbour remains a concept. Launch approval and measured returns remain separate.`;}
function run(fn){try{fn();}catch(e){status(e.message);}}
$('swap').addEventListener('click',swap);
$('begin').addEventListener('click',()=>run(()=>{
 report=sessionTemplate(context,$('code').value);report.device=$('device').value;
 const first=Number(report.code.slice(1))%2===0?'mission-harbour':'mission-tide';if($('mission-cards').firstElementChild.id!==first)swap();
 $('record').hidden=false;$('code').disabled=true;$('device').disabled=true;$('begin').disabled=true;
 actions.filter(id=>id!=='begin').forEach(id=>$(id).disabled=false);checks();status('Rehearsal started. Kept in memory only; refresh clears it.');show(report);
}));
$('observe').addEventListener('click',()=>run(()=>{
 if(!$('consent').checked)throw Error('Get voluntary consent before marking an observed holder session.');
 if(ACCEPTANCE_CHECKS.filter(c=>c.device===report.device).some(c=>$('check-'+c.id).value!=='pending')||$('interview').checked||$('delivered').checked)throw Error('Begin a fresh session to observe a holder; rehearsal results cannot be relabelled.');
 report.source='observed-holder';report.consented=true;report.observedAt=new Date().toISOString();$('observe').disabled=true;status('Observed holder session marked. Record actual observations only.');show(report);
}));
$('export').addEventListener('click',()=>run(()=>{const value=current();download(value,report.code+'-private-playtest.json');show(value);status('Private export downloaded. Keep it outside Git; this is a manual observation record.');}));
$('worksheet').addEventListener('click',()=>run(()=>{const value=current();download(value.acceptance,report.code+'-'+report.device+'-acceptance.json');show(value);status('Existing-format acceptance worksheet downloaded. Other device and operator checks remain pending.');}));
$('reset').addEventListener('click',()=>{report=null;$('record').hidden=true;for(const id of ['consent','interview','delivered'])$(id).checked=false;for(const [id,value] of [['preference','undecided'],['reason','none'],['confusion',''],['destination','not-tested'],['code',''],['browser','']])$(id).value=value;$('code').disabled=false;$('device').disabled=false;$('begin').disabled=!context;$('readout').textContent='';status('Session cleared. No local storage, wallet or company draft was changed.');});
try{
 const response=await fetch('/context.json',{cache:'no-store'});if(!response.ok)throw Error('Context unavailable');context=await response.json();sessionTemplate(context,'P01');
 $('context').textContent='Staging candidate '+context.candidateCommit+' · '+context.base;$('stage').href=new URL('#paper',context.base).href;$('begin').disabled=false;
}catch{status('Candidate context could not load. Restart the local desk with the exact tested commit and app URL. No session was started.');}
