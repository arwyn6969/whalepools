import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {demoPaths} from '../src/demo-worker.mjs';
const base=(process.argv[2]||'https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools').replace(/\/$/,''),output=process.argv[3];
const paperRules=JSON.parse(await readFile(new URL('../build/public/paper-rules.json',import.meta.url))),tideRules=JSON.parse(await readFile(new URL('../build/public/tide-rules.json',import.meta.url)));
const get=(path,init={})=>fetch(base+path,{...init,signal:AbortSignal.timeout(20000)}),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const assets=[];
for(const path of [...demoPaths].filter(p=>p!='/')){
 const response=await get(path);assert.equal(response.status,200,path);const expected=await readFile(new URL('../build/public'+path,import.meta.url)),actual=Buffer.from(await response.arrayBuffer());assert.equal(sha(actual),sha(expected),path);
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');assets.push({path,sha256:sha(actual),bytes:actual.length});
}
const paper=await (await get('/api/paper')).json(),tide=await (await get('/api/tide')).json();assert.equal(paper.rulesHash,paperRules.ruleHash);assert.equal(tide.rulesHash,tideRules.ruleHash);assert.equal(tide.paperHash,paperRules.ruleHash);assert.equal(paper.enabled,true);assert.equal(tide.enabled,true);
assert.equal(paper.labs.length,3);const currentIds=paper.labs.map(r=>r.id).sort();assert.equal(new Set(currentIds).size,3);
assert.ok(paper.labs.every(r=>r.owner===null&&r.rulesHash===paperRules.ruleHash&&r.createdAt===paper.labs[0].createdAt&&r.createdAt<=paper.serverTime&&r.endsAt===r.createdAt+paperRules.duration&&['running','completed'].includes(r.status)));
assert.deepEqual(paper.labs.flatMap(r=>r.agents.map(a=>a.preset)).sort(),Object.keys(paperRules.presets).sort());
const ids=[1,2,3].map(i=>'e2a7f522-8010-4d1b-8a97-00000000000'+i),originals=[];
for(const id of ids){
 const response=await get('/api/paper/run/'+id);assert.equal(response.status,200,'original dated watch remains public');const {run}=await response.json();
 assert.equal(run.id,id);assert.equal(run.owner,null);assert.equal(run.rulesHash,paperRules.ruleHash);assert.equal(run.createdAt,1791380323311);assert.equal(run.endsAt,run.createdAt+paperRules.duration);assert.ok(run.observedBars>0&&run.history.length>0,'original observations remain saved');originals.push(run);
}
if(paper.referenceArchive!==undefined){
 assert.ok(Array.isArray(paper.referenceArchive)&&paper.referenceArchive.length<=12);assert.equal(new Set(paper.referenceArchive.map(r=>r.id)).size,paper.referenceArchive.length);
 for(const row of paper.referenceArchive){
  assert.ok(!currentIds.includes(row.id));assert.equal(row.rulesHash,paperRules.ruleHash);assert.ok(row.createdAt<paper.labs[0].createdAt&&row.endsAt===row.createdAt+paperRules.duration);assert.ok(['completed','stopped'].includes(row.status));
  const original=originals.find(r=>r.id===row.id);if(original){assert.equal(row.createdAt,original.createdAt);assert.equal(row.endsAt,original.endsAt);assert.equal(row.status,original.status);}
 }
}
assert.ok(tide.rounds.some(r=>r.status==='queued'&&r.startsAt>tide.serverTime));assert.ok(tide.rounds.every(r=>r.rulesHash===tideRules.ruleHash));
const origin=new URL(base).origin;
assert.equal((await get('/api/paper/history')).status,401);
assert.equal((await get('/api/tide/join',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'})).status,401);
assert.equal((await get('/api/tide/join',{method:'POST',headers:{origin:'https://other.invalid','content-type':'application/json'},body:'{}'})).status,403);
assert.equal((await get('/api/tide',{headers:{'sec-fetch-site':'cross-site'}})).status,403);
assert.equal((await get('/../operator/secrets.json')).status,404);
const receipt={checkedAt:new Date().toISOString(),base,assets,paperHash:paperRules.ruleHash,tideHash:tideRules.ruleHash,existingWatchIdsPreserved:ids,existingWatchCreatedAtPreserved:1791380323311,currentReferenceWatches:paper.labs.map(r=>({id:r.id,createdAt:r.createdAt,endsAt:r.endsAt,status:r.status})),referenceArchive:paper.referenceArchive??null,feed:paper.feed,rounds:tide.rounds.map(r=>({id:r.id,status:r.status,startsAt:r.startsAt,endsAt:r.endsAt,quality:r.quality,observations:r.strategies.map(s=>s.observedBars)})),realMarket:true,realEligibleWallet:false,production:false,checks:[`${assets.length} exact served asset hashes`,'three current dated preset watches','v1 IDs, original start dates and saved observations preserved through direct reads','bounded reference archive metadata when present','current rules identity','prospective UTC queue','private archive authentication','unsigned and cross-origin writes refused','cross-site read refused','private operator files unavailable']};
if(output)await writeFile(output,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:true,assets:assets.length,output,rounds:receipt.rounds},null,2));
