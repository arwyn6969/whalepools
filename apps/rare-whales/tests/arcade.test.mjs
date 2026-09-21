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
 const owner=privateKeyToAccount(generatePrivateKey()),other=privateKeyToAccount(generatePrivateKey()),DB=database();t.after(()=>DB.close());let time=1000000,chain=4663,nftOwner=owner.address,balance=10n;const reads=[];
 const client={getChainId:async()=>chain,getBlockNumber:async()=>100n,verifyMessage:async args=>verifyMessage(args),readContract:async p=>{reads.push(p);return p.functionName==='ownerOf'?nftOwner:balance;}};
 const board=createArcadeBoard({season,scores,ruleHash,client,holdings:async({address})=>({address,block:'98',items:[{collection:'rarewhales',tokenId:1}]}),now:()=>time}),api=createApi({season,board,client,now:()=>time}),origin='https://arcade.test',env={DB,APP_ORIGIN:origin,COOKIE_NAME:'wp_arcade_session',COOKIE_PATH:'/whalepools/'};
 const send=async(path,{data,cookie,method=data?'POST':'GET',requestOrigin=origin}={})=>{const r=await api(new Request(origin+path,{method,headers:{origin:requestOrigin,...(cookie?{cookie}:{}),...(data?{'content-type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})}),env);return {status:r.status,headers:r.headers,data:await r.json()};};
 const challenge=async(who=owner)=>{const r=await send('/api/auth/challenge',{data:{address:who.address}});assert.equal(r.status,200);return {...r.data,signature:await who.signMessage({message:r.data.message})};};
 const login=async(who=owner)=>{const proof=await challenge(who),r=await send('/api/auth/verify',{data:proof});assert.equal(r.status,200);return r.headers.get('set-cookie');};
 const input={nickname:'Test crew',collection:'rarewhales',tokenId:1,strategy:'trend',publish:true,ruleHash,agents:[{collection:'rarewhales',tokenId:1,strategy:'trend'},{collection:'whalestreet',tokenId:2,strategy:'magnet'}]};
 return {owner,other,DB,send,challenge,login,input,reads,setOwner:v=>nftOwner=v,setTime:v=>time=v,setChain:v=>chain=v,setBalance:v=>balance=v};
}
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

test('inventory requires authentication and uses the session wallet rather than a supplied address',async t=>{
 const f=fixture(t);assert.equal((await f.send('/api/whales')).status,401);const cookie=await f.login();const r=await f.send('/api/whales?address='+f.other.address,{cookie});assert.equal(r.status,200);assert.equal(r.data.address,f.owner.address.toLowerCase());assert.equal(r.data.items.length,1);
});
