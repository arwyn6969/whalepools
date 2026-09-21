import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {verifyMessage} from 'viem';
import {createApi} from '../src/api.mjs';
import {checkSeat} from '../src/access.mjs';
import {CHAIN_ID,COLLECTIONS,validateSeason} from '../src/config.mjs';
import {database} from '../scripts/database.mjs';
import {buildPractice} from '../src/practice.mjs';
import {backtest,buildSignals} from '../../../dist/engine.mjs';
import worker from '../src/worker.mjs';
import {whaleDNA,validateRoster,NEUTRAL_PROFILE} from '../src/dna.mjs';
import {replayAgent,replayPool} from '../src/pool.mjs';

let practicePromise;
function historicalPractice(){return practicePromise??=(async()=>{const read=async n=>JSON.parse(await readFile(new URL('../../../'+n,import.meta.url)));const [bars,context,protocol]=await Promise.all([read('research/data/UBTC-1h.json'),read('research/data/UBTC-4h.json'),read('dist/protocol.json')]);return buildPractice({bars,context,protocol,sourceHashes:{}});})();}
const original=JSON.parse(await readFile(new URL('../season.json',import.meta.url)));
const account=()=>privateKeyToAccount(generatePrivateKey());
function fixture(){
 const owner=account(),other=account(),founder=account(),season=structuredClone(original);
 const t=Date.parse('2030-01-01T00:00:00Z');
 Object.assign(season,{status:'registration',registrationClosesAt:new Date(t+3600000).toISOString(),startsAt:new Date(t+7200000).toISOString(),endsAt:new Date(t+86400000).toISOString()});
 Object.assign(season.access,{confirmed:true,promoTokenIds:[7],founderWallets:[founder.address]});
 let current=t,chain=CHAIN_ID,tokenOwner=owner.address,balances={rarewhales:6n,whalestreet:4n};
 const reads=[],client={getChainId:async()=>chain,getBlockNumber:async()=>100n,verifyMessage:async p=>verifyMessage(p),readContract:async p=>{reads.push(p);if(p.functionName==='ownerOf')return tokenOwner;const key=Object.keys(COLLECTIONS).find(k=>COLLECTIONS[k].address===p.address);return balances[key];}};
 const DB=database(),env={DB,APP_ORIGIN:'https://club.example'},api=createApi({season,client,now:()=>current});
 const send=async(path,{data,method=data?'POST':'GET',cookie,origin=env.APP_ORIGIN,headers={}}={})=>{
  const response=await api(new Request(env.APP_ORIGIN+path,{method,headers:{origin,...(data?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})}),env);
  return {status:response.status,headers:response.headers,data:await response.json()};
 };
 async function challenge(who=owner){const r=await send('/api/auth/challenge',{data:{address:who.address}});assert.equal(r.status,200);return {...r.data,signature:await who.signMessage({message:r.data.message})};}
 async function login(who=owner){const proof=await challenge(who),r=await send('/api/auth/verify',{data:proof});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
 const seat={nickname:'Test-only desk',collection:'rarewhales',tokenId:3,strategy:'trend',publish:true};
 const check=(overrides={})=>checkSeat({address:owner.address,collection:'rarewhales',tokenId:3,season,client,...overrides});
 return {owner,other,founder,season,client,DB,env,api,send,challenge,login,seat,check,reads,setTime:v=>current=v,setChain:v=>chain=v,setOwner:v=>tokenOwner=v,setBalances:v=>balances=v,t};
}
test('combined holdings: 6+4 qualifies, 5+4 does not; one coherent block',async t=>{
 const f=fixture();t.after(()=>f.DB.close());assert.equal((await f.check()).eligible,true);assert.deepEqual((await f.check()).balances,{rarewhales:6,whalestreet:4});assert.ok(f.reads.every(p=>p.blockNumber===98n));f.setBalances({rarewhales:5n,whalestreet:4n});assert.equal((await f.check()).eligible,false);
});
test('1/1 route requires the exact allowlisted token and current ownership',async t=>{
 const f=fixture();t.after(()=>f.DB.close());f.setBalances({rarewhales:1n,whalestreet:0n});assert.equal((await f.check({tokenId:7})).basis,'promo');assert.equal((await f.check({tokenId:8})).eligible,false);f.setOwner(f.other.address);assert.equal((await f.check({tokenId:7})).eligible,false);
});
test('founder seat works without an NFT; unlisted wallets cannot claim it',async t=>{
 const f=fixture();t.after(()=>f.DB.close());assert.equal((await f.check({address:f.founder.address,collection:null,tokenId:null})).basis,'founder');assert.equal((await f.check({collection:null,tokenId:null})).eligible,false);
});
test('unconfirmed rules and wrong chain grant no eligibility',async t=>{
 const f=fixture();t.after(()=>f.DB.close());f.season.access.confirmed=false;assert.equal((await f.check()).pending,true);f.season.access.confirmed=true;f.setChain(1);await assert.rejects(f.check(),/wrong network/);
});
test('real EOA sign-in consumes its nonce, uses opaque secure session, and logout revokes it',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const proof=await f.challenge(),r=await f.send('/api/auth/verify',{data:proof});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly; SameSite=Strict; Max-Age=43200; Secure/);assert.ok(!cookie.includes(f.owner.address));assert.equal((await f.send('/api/auth/verify',{data:proof})).status,401);assert.equal((await f.send('/api/club',{cookie})).data.me.address,f.owner.address.toLowerCase());await f.send('/api/auth/logout',{data:{},cookie});assert.equal((await f.send('/api/club',{cookie})).data.me,null);
});
test('wrong signer and expired challenges fail closed',async t=>{
 const f=fixture();t.after(()=>f.DB.close());let proof=await f.challenge();proof.signature=await f.other.signMessage({message:proof.message});assert.equal((await f.send('/api/auth/verify',{data:proof})).status,401);proof=await f.challenge();f.setTime(f.t+300001);assert.equal((await f.send('/api/auth/verify',{data:proof})).status,401);
});
test('expired sessions cannot access membership writes',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const cookie=await f.login();f.setTime(f.t+43200001);assert.equal((await f.send('/api/seat',{data:f.seat,cookie})).status,401);
});
test('cross-origin requests, anonymous writes, and oversized payloads are refused',async t=>{
 const f=fixture();t.after(()=>f.DB.close());assert.equal((await f.send('/api/auth/challenge',{data:{address:f.owner.address},origin:'https://evil.example'})).status,403);assert.equal((await f.send('/api/club',{headers:{'sec-fetch-site':'cross-site'}})).status,403);assert.equal((await f.send('/api/seat',{data:f.seat})).status,401);assert.equal((await f.send('/api/auth/challenge',{data:{address:'x'.repeat(9000)}})).status,413);
});
test('saving twice updates one wallet seat; public crew omits wallet and policy internals',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const cookie=await f.login();assert.equal((await f.send('/api/seat',{data:f.seat,cookie})).status,200);assert.equal((await f.send('/api/seat',{data:{...f.seat,strategy:'recovery'},cookie})).status,200);const crew=(await f.send('/api/crew')).data;assert.equal(crew.seats.length,1);assert.equal(crew.seats[0].strategy,'recovery');assert.equal(crew.hasPerformance,false);assert.ok(!JSON.stringify(crew).includes(f.owner.address.toLowerCase()));assert.ok(!('policy_hash' in crew.seats[0]));const config=(await f.send('/api/club')).data;assert.equal(config.season.access.founderWallets,undefined);
});
test('wallet membership and selected NFT ownership are rechecked on save',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const cookie=await f.login();assert.equal((await f.send('/api/eligibility',{data:f.seat,cookie})).data.eligible,true);f.setOwner(f.other.address);assert.equal((await f.send('/api/seat',{data:f.seat,cookie})).status,403);assert.equal((await f.send('/api/crew')).data.seats.length,0);
});
test('one NFT cannot register two wallets, including after a transfer',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const first=await f.login();assert.equal((await f.send('/api/seat',{data:f.seat,cookie:first})).status,200);f.setOwner(f.other.address);const second=await f.login(f.other);assert.equal((await f.send('/api/seat',{data:f.seat,cookie:second})).status,409);
});
test('registration closes exactly at deadline, locking updates and withdrawals',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const cookie=await f.login();assert.equal((await f.send('/api/seat',{data:f.seat,cookie})).status,200);f.setTime(Date.parse(f.season.registrationClosesAt));assert.equal((await f.send('/api/seat',{data:f.seat,cookie})).status,409);assert.equal((await f.send('/api/seat',{method:'DELETE',cookie})).status,409);assert.equal((await f.send('/api/club')).data.registrationOpen,false);
});
test('rules cannot silently change after the first registration',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const cookie=await f.login();assert.equal((await f.send('/api/seat',{data:f.seat,cookie})).status,200);f.season.settings.risk=.5;assert.equal((await f.send('/api/seat',{data:f.seat,cookie})).status,409);
});
test('public consent, fixed strategy and clean nickname are required',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const cookie=await f.login();for(const change of [{publish:false},{strategy:'invented'},{nickname:'<script>'}])assert.equal((await f.send('/api/seat',{data:{...f.seat,...change},cookie})).status,400);
});
test('draft configuration never opens registration; incomplete activation is rejected',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const draft=createApi({season:original,client:f.client,now:()=>f.t});const response=await draft(new Request(f.env.APP_ORIGIN+'/api/club'),f.env);assert.equal((await response.json()).registrationOpen,false);assert.throws(()=>validateSeason({...original,status:'registration'}));
});
test('worker serves only declared assets with CSP, and refuses unconfigured hosts',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const env={...f.env,ASSETS:{fetch:async()=>new Response('asset')}};const r=await worker.fetch(new Request(f.env.APP_ORIGIN+'/'),env);assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal((await worker.fetch(new Request(f.env.APP_ORIGIN+'/season.json'),env)).status,404);assert.equal((await worker.fetch(new Request('https://wrong.example/'),env)).status,503);
});
test('historical practice exactly preserves the frozen strategy paths and accounting',async()=>{
 const load=async name=>JSON.parse(await readFile(new URL('../../../'+name,import.meta.url)));
 const bars=await load('research/data/UBTC-1h.json'),context=await load('research/data/UBTC-4h.json'),protocol=await load('dist/protocol.json');
 const data=buildPractice({bars,context,protocol,sourceHashes:{}}),raw=bars.filter(b=>b.T<data.until),higher=context.filter(b=>b.T<data.until),start=raw.findIndex(b=>b.t>=data.from);
 for(const mode of ['trend','recovery']){
  const direct=backtest(buildSignals(raw,higher,mode,{patternStart:data.from}),{...protocol.settings,decimals:5},start,raw.length);assert.deepEqual(data.strategies[mode].trades,direct.trades);assert.deepEqual(data.strategies[mode].curve,direct.curve);assert.equal(data.strategies[mode].stats.endEquity,1000+direct.trades.reduce((n,t)=>n+t.pnl,0));assert.ok(direct.trades.every(t=>t.entryTime>=data.from&&t.exitTime<=data.until));
 }
 const last=raw.at(-1),f=protocol.settings.fee/100,s=protocol.settings.slippage/100;const expected=750+250/(raw[start].o*(1+s)*(1+f))*last.c*(1-s)*(1-f);assert.ok(Math.abs(data.hold.at(-1).equity-expected)<1e-10);assert.equal(data.kind,'historical-practice');
});

test('DNA is deterministic, identity-bound and bounded; rarity and owner are not inputs',async()=>{
 const first=await whaleDNA('rarewhales',245);assert.deepEqual(await whaleDNA('rarewhales',245),first);assert.equal(first.hash,'4771ada311ddf4d9880fb2543d1ac3d9562c2c754e497def7bdc6d71d99f12db');
 assert.notEqual((await whaleDNA('whalestreet',245)).hash,first.hash);assert.notEqual((await whaleDNA('rarewhales',246)).hash,first.hash);
 for(let id=0;id<30;id++){const p=await whaleDNA('rarewhales',id);assert.ok(p.risk>=.225&&p.risk<=.275);assert.ok(p.allocation>=22.5&&p.allocation<=27.5);assert.ok(p.targetMultiplier>=.95&&p.targetMultiplier<=1.05);}
 await assert.rejects(whaleDNA('other',1));await assert.rejects(whaleDNA('rarewhales',1.5));await assert.rejects(whaleDNA('rarewhales',NaN));
});
test('rosters reject duplicate NFTs, unsupported modes and excess agents',()=>{
 const a={collection:'rarewhales',tokenId:245,strategy:'trend'};assert.throws(()=>validateRoster([a,a]),/once/);assert.throws(()=>validateRoster([{...a,strategy:'unknown'}]));assert.throws(()=>validateRoster(Array.from({length:13},(_,i)=>({...a,tokenId:i}))));assert.deepEqual(validateRoster([{...a,profile:{risk:900}}]),[a]);
});
test('neutral DNA exactly reproduces both frozen runs, including every fill and curve point',async()=>{
 const data=await historicalPractice();
 for(const mode of ['trend','recovery']){const run=replayAgent(data,mode,NEUTRAL_PROFILE);assert.deepEqual(run.trades,data.strategies[mode].trades);assert.deepEqual(run.curve,data.strategies[mode].curve);assert.deepEqual(run.stats,data.strategies[mode].stats);}
});
test('a company shares exactly $1,000 and aggregates simultaneous equity, trades and drawdown',async()=>{
 const data=await historicalPractice();
 const roster=[245,246,247,248].map((tokenId,i)=>({collection:'rarewhales',tokenId,strategy:i%2?'recovery':'trend'}));const run=await replayPool(data,roster);
 assert.equal(run.agents.reduce((s,a)=>s+a.startEquity,0),1000);assert.equal(run.agents.length,4);
 assert.ok(Math.abs(run.stats.endEquity-run.agents.reduce((s,a)=>s+a.result.stats.endEquity,0))<1e-9);
 for(let i=0;i<run.curve.length;i++)assert.ok(Math.abs(run.curve[i].equity-run.agents.reduce((s,a)=>s+a.result.curve[i].equity,0))<1e-9);
 let peak=1000,dd=0;for(const p of run.curve){peak=Math.max(peak,p.equity);dd=Math.max(dd,(peak-p.equity)/peak*100);}assert.equal(run.stats.maxDrawdown,dd);
 assert.equal(run.stats.count,run.agents.reduce((s,a)=>s+a.result.trades.length,0));assert.equal(run.trades.length,run.stats.count);assert.notEqual(run.agents[0].result.stats.endEquity,run.agents[0].baseline.stats.endEquity);
 const snapshot=JSON.stringify(data),again=await replayPool(data,roster);assert.deepEqual(run,again);assert.equal(JSON.stringify(data),snapshot);
 const empty=await replayPool(data,[]);assert.equal(empty.stats.endEquity,1000);assert.equal(empty.stats.count,0);
});
test('future prices cannot alter earlier DNA replay equity',async()=>{
 const data=await historicalPractice(),changed=structuredClone(data),cut=data.replay.bars[Math.floor(data.replay.bars.length*.8)].t;
 for(const b of changed.replay.bars)if(b.t>=cut){b.o*=1.15;b.h*=1.15;b.l*=1.15;b.c*=1.15;}
 const profile=await whaleDNA('rarewhales',245);for(const mode of ['trend','recovery']){const before=replayAgent(data,mode,profile),after=replayAgent(changed,mode,profile);assert.deepEqual(before.curve.filter(p=>p.t<cut),after.curve.filter(p=>p.t<cut));}
});
test('the server derives and persists every agent profile, ignoring forged client modifiers',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const cookie=await f.login();
 const agents=[{collection:'rarewhales',tokenId:3,strategy:'trend',profile:{risk:100,hash:'forged'}},{collection:'whalestreet',tokenId:8,strategy:'recovery'}];
 assert.equal((await f.send('/api/seat',{cookie,data:{...f.seat,agents}})).status,200);
 const mine=(await f.send('/api/club',{cookie})).data.me.seat;assert.equal(mine.agents.length,2);assert.deepEqual(mine.agents[0].profile,await whaleDNA('rarewhales',3));assert.equal(mine.agents[1].strategy,'recovery');
 assert.equal((await f.send('/api/crew')).data.seats[0].agents.length,2);
 assert.equal((await f.send('/api/seat',{method:'DELETE',cookie})).status,200);assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM rw_agents').first()).n,0);
});
test('every agent must be owned, and another wallet cannot control the company',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const cookie=await f.login();assert.equal((await f.send('/api/seat',{cookie,data:f.seat})).status,200);
 const read=f.client.readContract;f.client.readContract=async p=>p.functionName==='ownerOf'&&p.args[0]===8n?f.other.address:read(p);
 const attempt=await f.send('/api/seat',{cookie,data:{...f.seat,agents:[{collection:'rarewhales',tokenId:3,strategy:'trend'},{collection:'rarewhales',tokenId:8,strategy:'trend'}]}});assert.equal(attempt.status,403);
 assert.equal((await f.send('/api/club',{cookie})).data.me.seat.agents.length,1);
 const outsider=await f.login(f.other);assert.equal((await f.send('/api/seat',{cookie:outsider,data:{...f.seat,agents:[]}})).status,403);
 assert.equal((await f.send('/api/crew')).data.seats.length,1);
});
test('cross-pool agent collision rolls back the entire roster update',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const first=await f.login();await f.send('/api/seat',{cookie:first,data:{...f.seat,agents:[{collection:'rarewhales',tokenId:3,strategy:'trend'},{collection:'rarewhales',tokenId:8,strategy:'recovery'}]}});
 f.setOwner(f.other.address);const second=await f.login(f.other);assert.equal((await f.send('/api/seat',{cookie:second,data:{...f.seat,tokenId:9}})).status,200);
 const r=await f.send('/api/seat',{cookie:second,data:{...f.seat,tokenId:9,nickname:'Changed name',agents:[{collection:'rarewhales',tokenId:9,strategy:'trend'},{collection:'rarewhales',tokenId:8,strategy:'trend'}]}});assert.equal(r.status,409);
 const mine=(await f.send('/api/club',{cookie:second})).data.me.seat;assert.equal(mine.nickname,f.seat.nickname);assert.deepEqual(mine.agents.map(a=>a.tokenId),[9]);assert.equal((await f.send('/api/crew')).data.seats.length,2);
});
