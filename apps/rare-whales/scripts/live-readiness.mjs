import {readFile,writeFile} from 'node:fs/promises';
import {diarySummary} from '../src/recorder-evidence.mjs';
const base=new URL(process.argv[2]||'https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/');
if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw Error('Use a plain public app base URL.');
if(!base.pathname.endsWith('/'))base.pathname+='/';
const paperRules=JSON.parse(await readFile(new URL('../build/public/paper-rules.json',import.meta.url))),tideRules=JSON.parse(await readFile(new URL('../build/public/tide-rules.json',import.meta.url)));
const checkedAt=Date.now(),get=async path=>{const response=await fetch(new URL(path,base),{signal:AbortSignal.timeout(20000),redirect:'error',headers:{accept:'application/json'}});if(!response.ok)throw Error(path+' returned '+response.status);return response;};
const reads=await Promise.allSettled([get('api/paper').then(r=>r.json()),get('api/tide').then(r=>r.json())]);
const report={kind:'whale-pools-readiness-v1',checkedAt:new Date(checkedAt).toISOString(),base:base.href,readOnly:true,checks:[],manualAcceptance:'not observed by this script',realEligibleWallet:false,pilotParticipantsObserved:null};
const check=(name,pass,evidence)=>report.checks.push({name,pass,evidence});
for(let i=0;i<reads.length;i++)if(reads[i].status==='rejected')check(i?'tide API':'paper API',false,reads[i].reason.message);
if(reads.every(r=>r.status==='fulfilled')){
 const paper=reads[0].value,tide=reads[1].value;
 check('Exact paper rules',paper.enabled&&paper.rulesHash===paperRules.ruleHash,paper.rulesHash);
 check('Exact Daily Tide rules',tide.enabled&&tide.rulesHash===tideRules.ruleHash,tide.rulesHash);
 check('Recorder currently healthy',!paper.feed?.error&&!paper.feed?.halted&&paper.feed?.stale===false&&checkedAt-paper.feed.last_ok<180000,{lastOk:paper.feed?.last_ok,error:paper.feed?.error,halted:paper.feed?.halted,stale:paper.feed?.stale});
 check('Three current dated public preset watches',paper.labs.length===3&&paper.labs.every(r=>r.rulesHash===paperRules.ruleHash&&r.status==='running'&&r.endsAt>checkedAt),paper.labs.map(r=>({id:r.id,createdAt:r.createdAt,endsAt:r.endsAt,status:r.status,observedBars:r.observedBars,gapBars:r.gapBars})));
 const completed=tide.rounds.filter(r=>r.status==='completed');check('A real complete Daily Tide round is visible',completed.some(r=>r.quality==='complete'),completed.map(r=>({id:r.id,quality:r.quality})));
 try{
  const first=await get('api/paper/coverage').then(r=>r.json()),days=first.days.slice(0,14),results=[first];
  for(let i=1;i<days.length;i+=3){
   const batch=await Promise.allSettled(days.slice(i,i+3).map(day=>get('api/paper/coverage?day='+day).then(r=>r.json())));
   for(let j=0;j<batch.length;j++)results.push(batch[j].status==='fulfilled'?batch[j].value:{day:days[i+j],error:batch[j].reason.message});
  }
  report.recorderDiary=diarySummary(results,{rulesHash:paperRules.ruleHash,checkedAt:Date.now()});
  check('Seven consecutive clean completed UTC days',report.recorderDiary.sevenDayCoverageGate,{consecutiveCleanDays:report.recorderDiary.consecutiveCleanDays,meaning:'Actual saved receipt and all-three-watch decisions across dated cohorts. Watch age and renewal do not establish continuity.'});
 }catch(error){check('Seven consecutive clean completed UTC days',false,{error:error.message});}
 if(paper.labs[0]){
  const run=paper.labs[0];const detail=await Promise.allSettled([get('watch/'+run.id).then(r=>r.text()),get('api/paper/recap/'+run.id).then(r=>r.json())]);
  check('Public share metadata',detail[0].status==='fulfilled'&&detail[0].value.includes('property="og:title"')&&detail[0].value.includes('rel="canonical"'),detail[0].status==='fulfilled'?'Server HTML has canonical and dated preview metadata':detail[0].reason.message);
  check('Saved daily recap',detail[1].status==='fulfilled'&&detail[1].value.id===run.id&&detail[1].value.rulesHash===paperRules.ruleHash,detail[1].status==='fulfilled'?{day:detail[1].value.day,coverage:detail[1].value.coverage,lastValuation:detail[1].value.lastValuation}:detail[1].reason.message);
 }
}
report.automatedChecksPass=report.checks.every(c=>c.pass);
report.launchReady=false;
report.remaining=['Real eligible-wallet sign-in and inventory on desktop and mobile','Historical publish, edit and withdraw; cross-wallet draft isolation','Real paper Start, Stop, follow-up, archive and Daily Tide pick','Clipboard/PNG acceptance and public preview in the intended sharing destination','Seven to fourteen days of recorder evidence, including an actual complete UTC round','Maintenance and consent/release review','Owner-approved ten-holder pilot with elapsed seven-day return windows'];
const text=JSON.stringify(report,null,2);if(process.argv[3])await writeFile(process.argv[3],text+'\n');console.log(text);
