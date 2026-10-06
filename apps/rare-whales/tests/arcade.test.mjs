import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {verifyMessage} from 'viem';
import {createApi} from '../src/api.mjs';
import {createArcadeBoard} from '../src/arcade-board.mjs';
import {buildArcadeScores,scoreArcade} from '../src/arcade-score.mjs';
import {buildPractice} from '../src/practice.mjs';
import {replayPool,replayAgent} from '../src/pool.mjs';
import {database} from '../scripts/database.mjs';
import {COLLECTIONS} from '../src/config.mjs';
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url)));
const season=await read('../arcade.json'),practice=buildPractice({bars:await read('../../../research/data/UBTC-1h.json'),context:await read('../../../research/data/UBTC-4h.json'),protocol:await read('../../../dist/protocol.json'),sourceHashes:{}}),scores=buildArcadeScores(practice),ruleHash='test-fixture-rules';
function fixture(t){
 const owner=privateKeyToAccount(generatePrivateKey()),other=privateKeyToAccount(generatePrivateKey()),DB=database();t.after(()=>DB.close());let time=1000000,chain=4663,nftOwner=owner.address,balance=10n,beforeRead=async()=>{};const reads=[],wallets=new Map();
 const client={getChainId:async()=>chain,getBlockNumber:async()=>100n,verifyMessage:async args=>verifyMessage(args),readContract:async p=>{reads.push(p);await beforeRead(p);return p.functionName==='ownerOf'?nftOwner:balance;}};
 const board=createArcadeBoard({season,scores,ruleHash,client,now:()=>time}),api=createApi({season,board,client,now:()=>time}),origin='https://arcade.test',env={DB,APP_ORIGIN:origin,COOKIE_NAME:'wp_arcade_session',COOKIE_PATH:'/whalepools/'};
 const send=async(path,{data,cookie,method=data?'POST':'GET',requestOrigin=origin,headers={}}={})=>{
  let mutationHeaders={};
  if(path==='/api/seat'&&['POST','DELETE'].includes(method)&&wallets.has(cookie)){
   const current=await DB.prepare('SELECT revision FROM rw_arcade_revisions WHERE season=? AND wallet=?').bind(season.id,wallets.get(cookie)).first();
   mutationHeaders={'x-whale-revision':String(current?.revision??0),'x-whale-mutation':crypto.randomUUID()};
  }
  const requestHeaders=new Headers({origin:requestOrigin,...(cookie?{cookie}:{}),...(data?{'content-type':'application/json'}:{}),...mutationHeaders});
  for(const [name,value]of Object.entries(headers)){if(value===null)requestHeaders.delete(name);else requestHeaders.set(name,String(value));}
  const r=await api(new Request(origin+path,{method,headers:requestHeaders,...(data?{body:JSON.stringify(data)}:{})}),env);return {status:r.status,headers:r.headers,data:await r.json()};
 };
 const challenge=async(who=owner)=>{const r=await send('/api/auth/challenge',{data:{address:who.address}});assert.equal(r.status,200);return {...r.data,signature:await who.signMessage({message:r.data.message})};};
 const login=async(who=owner)=>{const proof=await challenge(who),r=await send('/api/auth/verify',{data:proof});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie');wallets.set(cookie,who.address.toLowerCase());return cookie;};
 const input={nickname:'Test crew',collection:'rarewhales',tokenId:1,strategy:'trend',publish:true,ruleHash,agents:[{collection:'rarewhales',tokenId:1,strategy:'trend'},{collection:'whalestreet',tokenId:2,strategy:'magnet'}]};
 return {owner,other,DB,send,challenge,login,input,reads,setOwner:v=>nftOwner=v,setTime:v=>time=v,setChain:v=>chain=v,setBalance:v=>balance=v,setBeforeRead:v=>beforeRead=v};
}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function holdNextOwnership(f){const started=deferred(),release=deferred();let held=false;f.setBeforeRead(async p=>{if(p.functionName==='ownerOf'&&!held){held=true;started.resolve();await release.promise;}});return {started:started.promise,release:release.resolve};}
test('compressed score table preserves every original equity point and trade input across all 1296 paths',()=>{
 assert.equal(Object.keys(scores.runs).length,1296);
 for(const [key,stored]of Object.entries(scores.runs)){
  const [n,build,tactic]=key.split(':'),[r,t,a]=build.split('-').map(Number),direct=replayAgent(practice,tactic,{risk:[.225,.25,.275][r],targetMultiplier:[.95,1,1.05][t],allocation:[22.5,25,27.5][a]},1000/Number(n));
  let cursor=0;for(let i=0;i<direct.curve.length;i++){while(cursor+1<stored.curve.length&&stored.curve[cursor+1][0]<=i)cursor++;assert.equal(stored.curve[cursor][1],direct.curve[i].equity,key+' candle '+i);}
  assert.equal(stored.trades.reduce((s,t)=>s+t.pnl,0),direct.stats.pnl);assert.equal(stored.trades.length,direct.trades.length);
 }
});
test('server company scores equal direct mixed-roster replays at every budget split and ignore input profile/score tampering',async()=>{
 for(let n=1;n<=12;n++){
  const roster=Array.from({length:n},(_,i)=>({collection:i%2?'whalestreet':'rarewhales',tokenId:i+1,strategy:['trend','recovery','breakout','magnet'][i%4],profile:{risk:999},stats:{pnl:999999}}));
  const scored=await scoreArcade(scores,roster),direct=await replayPool(practice,roster.sort((a,b)=>a.collection.localeCompare(b.collection)||a.tokenId-b.tokenId));
  for(const key of Object.keys(scored.stats))assert.ok(Math.abs(scored.stats[key]-direct.stats[key])<1e-9,key+' split '+n);
  assert.deepEqual(await scoreArcade(scores,roster.toReversed()),scored);
 }
 await assert.rejects(scoreArcade(scores,[]));
});
test('arcade login proves wallet control, scopes cookie, expires sessions and rejects signature replay',async t=>{
 const f=fixture(t),proof=await f.challenge();assert.match(proof.message,/URI: https:\/\/arcade.test\/whalepools\//);
 const r=await f.send('/api/auth/verify',{data:proof});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/^wp_arcade_session=.*Path=\/whalepools\/; HttpOnly; SameSite=Strict;.*Secure$/);
 assert.equal((await f.send('/api/auth/verify',{data:proof})).status,401);
 const cookie=r.headers.get('set-cookie');assert.equal((await f.send('/api/club',{cookie})).data.me.address,f.owner.address.toLowerCase());f.setTime(1000000+43200001);assert.equal((await f.send('/api/club',{cookie})).data.me,null);
 const invalid=await f.challenge();invalid.signature=await f.other.signMessage({message:invalid.message});assert.equal((await f.send('/api/auth/verify',{data:invalid})).status,401);
});
test('publish verifies both collections at one block and ignores forged score fields',async t=>{
 const f=fixture(t),cookie=await f.login(),r=await f.send('/api/seat',{cookie,data:{...f.input,stats:{returnPct:999999},rankScore:99999999}});assert.equal(r.status,200);
 assert.deepEqual(r.data.stats,(await scoreArcade(scores,f.input.agents)).stats);assert.ok(f.reads.every(p=>p.blockNumber===98n));assert.ok(f.reads.some(p=>p.address===COLLECTIONS.whalestreet.address));
 const crew=(await f.send('/api/crew')).data;assert.equal(crew.total,1);assert.equal(crew.seats[0].owner,f.owner.address.toLowerCase());assert.equal(crew.seats[0].rank,1);assert.equal(crew.hasPerformance,false);assert.equal(crew.arcade.mode,'arcade');
 const publicJSON=JSON.stringify(crew);assert.ok(!publicJSON.includes('signature'));assert.ok(!publicJSON.includes('wp_arcade_session'));
});
test('failed ownership, wrong chain, stale rules, missing consent, invalid captain and duplicate rosters preserve the saved entry',async t=>{
 const f=fixture(t),cookie=await f.login();assert.equal((await f.send('/api/seat',{cookie,data:f.input})).status,200);
 for(const input of [{...f.input,publish:false},{...f.input,tokenId:99},{...f.input,agents:[...f.input.agents,f.input.agents[0]]},{...f.input,nickname:'<script>'}])assert.equal((await f.send('/api/seat',{cookie,data:input})).status,400);
 assert.equal((await f.send('/api/seat',{cookie,data:{...f.input,ruleHash:'old'}})).status,409);
 f.setOwner(f.other.address);assert.equal((await f.send('/api/seat',{cookie,data:{...f.input,nickname:'Changed'}})).status,403);f.setOwner(f.owner.address);f.setChain(1);assert.equal((await f.send('/api/seat',{cookie,data:f.input})).status,503);
 assert.equal((await f.send('/api/crew')).data.seats[0].nickname,'Test crew');
});
test('one latest entry per wallet, shared tie ranks, ownership snapshots on transfer and owner-only withdrawal',async t=>{
 const f=fixture(t),cookie=await f.login();await f.send('/api/seat',{cookie,data:f.input});await f.send('/api/seat',{cookie,data:{...f.input,nickname:'Updated crew'}});assert.equal((await f.send('/api/crew')).data.total,1);
 f.setOwner(f.other.address);f.setTime(1000001);const cookie2=await f.login(f.other);await f.send('/api/seat',{cookie:cookie2,data:{...f.input,nickname:'Second owner'}});
 let crew=(await f.send('/api/crew')).data;assert.equal(crew.total,2);assert.deepEqual(crew.seats.map(p=>p.rank),[1,1]);
 assert.equal((await f.send('/api/seat',{method:'DELETE'})).status,401);assert.equal((await f.send('/api/seat',{cookie:cookie2,method:'DELETE',requestOrigin:'https://evil.test'})).status,403);
 assert.equal((await f.send('/api/seat',{cookie:cookie2,method:'DELETE'})).status,200);crew=(await f.send('/api/crew')).data;assert.equal(crew.total,1);assert.equal(crew.seats[0].nickname,'Updated crew');
 await f.send('/api/auth/logout',{cookie,data:{}});assert.equal((await f.send('/api/club',{cookie})).data.me,null);
});
test('free arcade needs the configured NFT balance and rate limits unauthenticated challenges',async t=>{
 const f=fixture(t),cookie=await f.login();f.setBalance(0n);assert.equal((await f.send('/api/seat',{cookie,data:f.input})).status,403);f.setBalance(BigInt(season.access.minimumBalance));assert.equal((await f.send('/api/seat',{cookie,data:f.input})).status,200);
 let status;for(let i=0;i<20;i++)status=(await f.send('/api/auth/challenge',{data:{address:f.owner.address}})).status;assert.equal(status,429);
});

test('publish and withdrawal require a valid saved-entry revision and mutation ID; eligibility does not',async t=>{
 const f=fixture(t),cookie=await f.login();
 const initial=(await f.send('/api/club',{cookie})).data.me;assert.equal(initial.revision,0);assert.equal(initial.mutationId,null);
 for(const method of ['POST','DELETE']){
  const options={cookie,method,...(method==='POST'?{data:f.input}:{})};
  for(const headers of [{'x-whale-revision':null},{'x-whale-mutation':null},{'x-whale-revision':'01'},{'x-whale-revision':'-1'},{'x-whale-revision':'1.5'},{'x-whale-revision':String(Number.MAX_SAFE_INTEGER)},{'x-whale-mutation':'not-a-uuid'}]){
   const r=await f.send('/api/seat',{...options,headers});assert.equal(r.status,400);assert.match(r.data.error,/Reload your company/);
  }
 }
 assert.equal((await f.send('/api/eligibility',{cookie,data:f.input})).status,200);
 assert.equal((await f.send('/api/club',{cookie})).data.me.revision,0);
});

test('mutation receipts distinguish unchanged-payload publication and survive withdrawal privately',async t=>{
 const f=fixture(t),cookie=await f.login(),first=crypto.randomUUID(),second=crypto.randomUUID(),removal=crypto.randomUUID();
 const publish=await f.send('/api/seat',{cookie,data:f.input,headers:{'x-whale-revision':0,'x-whale-mutation':first}});
 assert.equal(publish.status,200);assert.equal(publish.data.revision,1);assert.equal(publish.data.mutationId,first);
 let me=(await f.send('/api/club',{cookie})).data.me;assert.equal(me.revision,1);assert.equal(me.mutationId,first);
 const unchanged=await f.send('/api/seat',{cookie,data:f.input,headers:{'x-whale-revision':1,'x-whale-mutation':second}});
 assert.equal(unchanged.status,200);me=(await f.send('/api/club',{cookie})).data.me;assert.equal(me.revision,2);assert.equal(me.mutationId,second);assert.equal(me.seat.nickname,f.input.nickname);
 const remove=await f.send('/api/seat',{cookie,method:'DELETE',headers:{'x-whale-revision':2,'x-whale-mutation':removal}});
 assert.equal(remove.status,200);assert.equal(remove.data.revision,3);
 me=(await f.send('/api/club',{cookie})).data.me;assert.equal(me.seat,null);assert.equal(me.revision,3);assert.equal(me.mutationId,removal);assert.equal(Object.hasOwn(me,'commit_token'),false);
 const tombstone=await f.DB.prepare('SELECT revision FROM rw_arcade_revisions WHERE season=? AND wallet=?').bind(season.id,f.owner.address.toLowerCase()).first();assert.equal(tombstone.revision,3);
 assert.equal(JSON.stringify((await f.send('/api/crew')).data).includes(removal),false);
});

test('late ownership responses cannot overwrite a newer company mutation',async t=>{
 const f=fixture(t),cookie=await f.login(),gate=holdNextOwnership(f),oldId=crypto.randomUUID();
 const old=f.send('/api/seat',{cookie,data:{...f.input,nickname:'Slow company'},headers:{'x-whale-revision':0,'x-whale-mutation':oldId}});
 await gate.started;
 const newest=await f.send('/api/seat',{cookie,data:{...f.input,nickname:'New company'},headers:{'x-whale-revision':0,'x-whale-mutation':crypto.randomUUID()}});assert.equal(newest.status,200);
 gate.release();assert.equal((await old).status,409);
 const me=(await f.send('/api/club',{cookie})).data.me;assert.equal(me.seat.nickname,'New company');assert.equal(me.revision,1);assert.equal(me.mutationId,newest.data.mutationId);
});

test('two concurrent absent-entry creates based on revision zero have exactly one winner',async t=>{
 const f=fixture(t),cookie=await f.login();
 const attempts=await Promise.all(['First crew','Second crew'].map(nickname=>f.send('/api/seat',{cookie,data:{...f.input,nickname},headers:{'x-whale-revision':0,'x-whale-mutation':crypto.randomUUID()}})));
 assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
 assert.equal((await f.send('/api/crew')).data.total,1);assert.equal((await f.send('/api/club',{cookie})).data.me.revision,1);
});

test('withdrawal tombstone prevents a slow old create from recreating a removed company',async t=>{
 const f=fixture(t),cookie=await f.login(),gate=holdNextOwnership(f);
 const old=f.send('/api/seat',{cookie,data:{...f.input,nickname:'Old slow create'},headers:{'x-whale-revision':0,'x-whale-mutation':crypto.randomUUID()}});
 await gate.started;
 assert.equal((await f.send('/api/seat',{cookie,data:{...f.input,nickname:'Current company'}})).status,200);
 assert.equal((await f.send('/api/seat',{cookie,data:{...f.input,nickname:'Edited company'}})).status,200);
 assert.equal((await f.send('/api/seat',{cookie,method:'DELETE'})).status,200);
 gate.release();assert.equal((await old).status,409);
 const me=(await f.send('/api/club',{cookie})).data.me;assert.equal(me.seat,null);assert.equal(me.revision,3);assert.equal((await f.send('/api/crew')).data.total,0);
 assert.equal((await f.send('/api/seat',{cookie,data:{...f.input,nickname:'Fresh company'}})).status,200);assert.equal((await f.send('/api/club',{cookie})).data.me.revision,4);
});

test('replaying an accepted mutation cannot execute a second write or replace its payload',async t=>{
 const f=fixture(t),cookie=await f.login(),id=crypto.randomUUID(),headers={'x-whale-revision':0,'x-whale-mutation':id};
 const accepted=await f.send('/api/seat',{cookie,data:f.input,headers});assert.equal(accepted.status,200);
 assert.equal((await f.send('/api/seat',{cookie,data:{...f.input,nickname:'Forged replay'},headers})).status,409);
 assert.equal((await f.send('/api/seat',{cookie,data:{...f.input,nickname:'Reused ID'},headers:{...headers,'x-whale-revision':1}})).status,409);
 assert.equal((await f.send('/api/seat',{cookie,method:'DELETE',headers})).status,409);
 const me=(await f.send('/api/club',{cookie})).data.me;assert.equal(me.seat.nickname,f.input.nickname);assert.equal(me.revision,1);assert.equal(me.mutationId,id);
});

test('existing published companies without revision records load at zero and upgrade on their next edit',async t=>{
 const f=fixture(t),cookie=await f.login();assert.equal((await f.send('/api/seat',{cookie,data:f.input})).status,200);
 const published=(await f.send('/api/club',{cookie})).data.me.seat;
 // Emulate an entry created before migration 0004, which has no revision row.
 await f.DB.prepare('DELETE FROM rw_arcade_revisions WHERE season=? AND wallet=?').bind(season.id,f.owner.address.toLowerCase()).run();
 const legacy=(await f.send('/api/club',{cookie})).data.me;assert.deepEqual(legacy.seat,published);assert.equal(legacy.revision,0);assert.equal(legacy.mutationId,null);
 const changed=await f.send('/api/seat',{cookie,data:{...f.input,nickname:'Legacy edit'},headers:{'x-whale-revision':0,'x-whale-mutation':crypto.randomUUID()}});assert.equal(changed.status,200);assert.equal(changed.data.revision,1);
 const current=(await f.send('/api/club',{cookie})).data.me;assert.equal(current.seat.id,published.id);assert.equal(current.seat.joinedAt,published.joinedAt);assert.equal(current.seat.nickname,'Legacy edit');assert.equal(current.revision,1);
});
