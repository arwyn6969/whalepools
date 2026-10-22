import {diarySummary} from '../src/recorder-evidence.mjs';
import {readFile,writeFile} from 'node:fs/promises';
const base=new URL(process.argv[2]||'https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/');
if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw Error('Use a plain public app base URL.');
if(!base.pathname.endsWith('/'))base.pathname+='/';
const rules=JSON.parse(await readFile(new URL('../build/public/paper-rules.json',import.meta.url)));
const get=async path=>{
 const response=await fetch(new URL(path,base),{signal:AbortSignal.timeout(20000),redirect:'error',headers:{accept:'application/json'}});
 if(!response.ok)throw Error(path+' returned '+response.status);
 const text=await response.text();if(text.length>131072)throw Error('Coverage response exceeded the bounded diary size.');return JSON.parse(text);
};
const first=await get('api/paper/coverage'),days=first.days.slice(0,14),results=[first];
// Three simultaneous read-only requests at most; do not hammer the recorder.
for(let i=1;i<days.length;i+=3){
 const batch=await Promise.allSettled(days.slice(i,i+3).map(day=>get('api/paper/coverage?day='+day)));
 for(let j=0;j<batch.length;j++)results.push(batch[j].status==='fulfilled'?batch[j].value:{day:days[i+j],error:batch[j].reason.message});
}
const checkedAt=Date.now(),summary=diarySummary(results,{rulesHash:rules.ruleHash,checkedAt});
const report={kind:'whale-pools-recorder-diary-v1',checkedAt:new Date(checkedAt).toISOString(),base:base.href,readOnly:true,paperHash:rules.ruleHash,...summary,launchReady:false,realEligibleWallet:false,note:'Saved candle receipt and all three public neutral-watch decision flags, not proof of continuous scheduler uptime or holder acceptance. The partial bootstrap day does not qualify. Keep dated exports alongside invocation logs; never recreate missed fills. No pilot participants are measured by this script.'};
const text=JSON.stringify(report,null,2);if(process.argv[3])await writeFile(process.argv[3],text+'\n');console.log(text);
