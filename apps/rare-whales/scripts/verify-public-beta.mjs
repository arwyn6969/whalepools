import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {demoPaths} from '../src/demo-worker.mjs';

// Usage: node scripts/verify-public-beta.mjs [base] [output.json] [--created-after=ISO]
// Guard probes are deliberately unsigned. This never creates an auth challenge,
// sends a wallet signature, or submits an authenticated mutation.
const args=process.argv.slice(2),flags=args.filter(value=>value.startsWith('--'));
assert.ok(flags.every(value=>value.startsWith('--created-after=')),'Unknown option.');
assert.ok(flags.length<=1,'Use --created-after at most once.');
const positional=args.filter(value=>!value.startsWith('--'));
assert.ok(positional.length<=2,'Use a base URL and an optional output file.');
const target=new URL(positional[0]||'https://arwyn.party/whalepools');
assert.ok(['https:','http:'].includes(target.protocol)&&!target.username&&!target.password&&!target.search&&!target.hash,'Use a plain public app base URL.');
const base=target.href.replace(/\/$/,''),output=positional[1];
const createdAfter=flags.length?Date.parse(flags[0].slice('--created-after='.length)):null;
assert.ok(createdAfter===null||Number.isFinite(createdAfter),'Use a valid ISO time for --created-after.');
const report={kind:'whale-pools-public-beta-verification-v1',checkedAt:new Date().toISOString(),base,
  readOnly:true,production:true,realEligibleWallet:false,reliabilityCertified:false,
  createdAfter:createdAfter===null?null:new Date(createdAfter).toISOString(),checks:[],assets:[],
  note:'A public experimental paper-beta smoke check. This does not certify recorder continuity, capacity, real-wallet acceptance, or investment performance. No auth challenges, signatures, or authenticated writes are issued.'};
const check=(name,evidence)=>report.checks.push({name,pass:true,evidence});
const get=(path,init={})=>fetch(base+path,{...init,redirect:'error',signal:AbortSignal.timeout(20000)});
const json=async path=>{const response=await get(path);assert.equal(response.status,200,path);assert.equal(response.headers.get('cache-control'),'no-store',path+' must not cache wallet-dependent responses');return response.json();};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const date=t=>new Date(t).toISOString().slice(0,10);
const canonical=html=>{
  const matches=[...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"\s*\/?>/g)];
  assert.equal(matches.length,1,'Exactly one canonical URL is required.');
  return matches[0][1].replaceAll('&amp;','&');
};
const preview=async(path,expected)=>{
  const response=await get(path);assert.equal(response.status,200,path);
  const html=await response.text();assert.equal(canonical(html),expected,path+' canonical');
  assert.ok(html.includes('property="og:title"'),path+' share title');
  assert.ok(html.includes('property="og:url" content="'+expected+'"'),path+' share URL');
  return expected;
};

try{
  const paperRules=JSON.parse(await readFile(new URL('../build/public/paper-rules.json',import.meta.url)));
  const tideRules=JSON.parse(await readFile(new URL('../build/public/tide-rules.json',import.meta.url)));
  const paths=[...demoPaths].filter(path=>path!='/');assert.equal(paths.length,23,'The scoped build must contain exactly 23 served assets.');
  for(const path of paths){
    const response=await get(path);assert.equal(response.status,200,path);
    const expected=await readFile(new URL('../build/public'+path,import.meta.url));
    const actual=Buffer.from(await response.arrayBuffer());assert.equal(sha(actual),sha(expected),path+' exact built asset');
    assert.equal(response.headers.get('x-content-type-options'),'nosniff',path);
    report.assets.push({path,sha256:sha(actual),bytes:actual.length});
  }
  check('23 exact served asset hashes',{count:report.assets.length});

  const paper=await json('/api/paper'),tide=await json('/api/tide');
  assert.equal(paper.enabled,true);assert.equal(tide.enabled,true);
  assert.equal(paper.rulesHash,paperRules.ruleHash);assert.equal(tide.rulesHash,tideRules.ruleHash);assert.equal(tide.paperHash,paperRules.ruleHash);
  report.paperHash=paper.rulesHash;report.tideHash=tide.rulesHash;
  check('Paper and Daily Tide enabled with exact built rules',{paperHash:paper.rulesHash,tideHash:tide.rulesHash});
  assert.equal(paper.me,null,'Anonymous response must not expose a signed-in wallet.');
  assert.ok(Number.isFinite(paper.serverTime)&&Math.abs(Date.now()-paper.serverTime)<180000,'Current paper server time');
  assert.ok(!paper.feed?.error&&!paper.feed?.halted&&paper.feed?.stale===false,'Recorder must not report an error, halt, or stale feed.');
  assert.ok(Number.isFinite(paper.feed.last_ok)&&paper.serverTime-paper.feed.last_ok>=-10000&&paper.serverTime-paper.feed.last_ok<180000,'Recorder must have succeeded within three minutes.');
  report.feed=paper.feed;check('Recorder currently healthy and fresh',paper.feed);

  assert.equal(paper.labs.length,3);assert.equal(new Set(paper.labs.map(run=>run.id)).size,3);
  assert.ok(paper.labs.every(run=>run.owner===null&&run.status==='running'&&run.rulesHash===paperRules.ruleHash&&
    Number.isFinite(run.createdAt)&&run.createdAt===paper.labs[0].createdAt&&run.createdAt<=paper.serverTime&&
    run.endsAt===run.createdAt+paperRules.duration&&run.endsAt>paper.serverTime&&
    (createdAfter===null||run.createdAt>=createdAfter)),'Three current dated production reference watches are required.');
  assert.deepEqual(paper.labs.flatMap(run=>run.agents.map(agent=>agent.preset)).sort(),Object.keys(paperRules.presets).sort());
  assert.ok(paper.labs.every(run=>run.observedBars>0&&run.history.length>0),'Wait for the first prospective saved observation before verifying.');
  report.currentReferenceWatches=paper.labs.map(run=>({id:run.id,createdAt:run.createdAt,endsAt:run.endsAt,status:run.status,observedBars:run.observedBars,gapBars:run.gapBars,lastObservation:run.history.at(-1).t}));
  check('Three dated running preset watches with saved observations',report.currentReferenceWatches);

  const nextUTC=(Math.floor(tide.serverTime/86400000)+1)*86400000;
  const queued=tide.rounds.find(round=>round.status==='queued'&&round.startsAt===nextUTC&&round.endsAt===nextUTC+86400000&&round.rulesHash===tideRules.ruleHash);
  assert.ok(queued,'The next UTC Daily Tide round must be queued.');
  check('Next UTC Daily Tide round queued',{id:queued.id,startsAt:queued.startsAt,endsAt:queued.endsAt});

  const first=paper.labs[0],detail=await json('/api/paper/run/'+first.id);
  assert.equal(detail.enabled,true);assert.equal(detail.run.id,first.id);assert.equal(detail.run.rulesHash,paperRules.ruleHash);assert.equal(detail.run.owner,null);
  check('Public dated watch API',{id:first.id,status:detail.run.status});
  const publicURL=base+'/watch/'+first.id;
  check('Public watch canonical and share metadata use production origin',await preview('/watch/'+first.id,publicURL));
  const day=date(detail.run.history.at(-1).t-1),recap=await json('/api/paper/recap/'+first.id+'?day='+day);
  assert.equal(recap.id,first.id);assert.equal(recap.rulesHash,paperRules.ruleHash);assert.equal(recap.day,day);
  assert.ok(recap.coverage.recorded>0&&Number.isFinite(recap.lastValuation),'The saved recap must include a real recorded observation.');
  assert.equal('owner' in recap,false,'Recaps must not add private wallet state.');
  check('Public saved daily recap',{id:first.id,day,coverage:recap.coverage,lastValuation:recap.lastValuation});
  check('Saved-day canonical and share metadata use production origin',await preview('/watch/'+first.id+'?day='+day,publicURL+'?day='+day));

  const guard=async(name,path,status,init={})=>{const response=await get(path,init);assert.equal(response.status,status,name);assert.equal(response.headers.get('set-cookie'),null,name+' must not create a session');check(name,{path,status});};
  const unsigned={method:'POST',headers:{origin:target.origin,'content-type':'application/json'},body:'{}'};
  await guard('Private paper archive requires sign-in','/api/paper/history',401);
  await guard('Unsigned paper Start refused','/api/paper/start',401,unsigned);
  await guard('Unsigned Daily Tide join refused','/api/tide/join',401,unsigned);
  await guard('Cross-origin paper Start refused','/api/paper/start',403,{...unsigned,headers:{...unsigned.headers,origin:'https://other.invalid'}});
  await guard('Cross-site public API read refused','/api/tide',403,{headers:{'sec-fetch-site':'cross-site'}});
  await guard('Cross-site recap read refused','/api/paper/recap/'+first.id,403,{headers:{'sec-fetch-site':'cross-site'}});
  await guard('Private operator files unavailable','/operator/secrets.json',404);
  report.passed=true;
}catch(error){
  report.passed=false;report.error=error.message;process.exitCode=1;
}
report.finishedAt=new Date().toISOString();
const text=JSON.stringify(report,null,2);if(output)await writeFile(output,text+'\n');console.log(text);
