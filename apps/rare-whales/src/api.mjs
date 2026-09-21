import { createSiweMessage } from 'viem/siwe';
import { getAddress } from 'viem';
import { CHAIN_ID, COLLECTIONS, STRATEGIES, validateSeason } from './config.mjs';
import { chainClient, checkSeat, ownsAgents } from './access.mjs';
import {DNA_VERSION,whaleDNA,validateRoster} from './dna.mjs';

const json = (data,status=200,extra={}) => Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
export const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
export const policyRecord = s => ({id:s.id,registrationClosesAt:s.registrationClosesAt,startsAt:s.startsAt,endsAt:s.endsAt,market:s.market,venue:s.venue,chartInterval:s.chartInterval,contextInterval:s.contextInterval,settings:s.settings,strategies:s.strategies,access:s.access,modifierVersion:s.modifierVersion,tacticVersion:s.tacticVersion,pool:s.pool});
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const reject = (status,message) => {throw new HttpError(status,message);};
async function body(request) {
  if (!(request.headers.get('content-type')||'').startsWith('application/json')) reject(415,'Send JSON.');
  if (Number(request.headers.get('content-length')) > 8192) reject(413,'Request too large.');
  const reader=request.body?.getReader(); if(!reader) reject(400,'Missing request.');
  let length=0,parts=[];
  try { while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>8192){await reader.cancel();reject(413,'Request too large.');}parts.push(value);} }
  finally {reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
  try {const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||Array.isArray(value)||typeof value!=='object')throw Error();return value;}catch{reject(400,'Invalid request.');}
}
const cookie = (token,origin,maxAge=43200) => `rw_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${origin.startsWith('https://')?'; Secure':''}`;
async function session(request,db,now) {
  const token=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('rw_session='))?.slice(11);
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  return db.prepare('SELECT address,hash FROM rw_sessions WHERE hash=? AND expires>?').bind(await digest(token),now).first();
}
async function limit(db,key,now,max=20) {
  const bucket=Math.floor(now/600000),id=`${key}:${bucket}`;
  const row=await db.prepare('INSERT INTO rw_limits(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(id,now+1200000).first();
  if(row.count>max)reject(429,'Too many requests. Try again in ten minutes.');
}
function registrationOpen(season,now) {return season.status==='registration' && now<Date.parse(season.registrationClosesAt) && now<Date.parse(season.startsAt);}
function publicSeat(row,agents=[]){return row?{id:row.id,nickname:row.nickname,collection:row.collection,tokenId:row.token_id,strategy:row.strategy,joinedAt:row.joined_at,basis:row.access_basis,agents:agents.filter(a=>a.pool_id===row.id).map(a=>({collection:a.collection,tokenId:a.token_id,strategy:a.strategy,profile:JSON.parse(a.modifier_json)}))}:null;}
export function createApi({season,client:injectedClient,now=Date.now}={}) {
  validateSeason(season);
  return async function handle(request,env) {
    const url=new URL(request.url),origin=env.APP_ORIGIN;
    if(!origin || url.origin!==origin)return json({error:'Application origin is not configured for this host.'},503);
    if(!url.pathname.startsWith('/api/'))return null;
    try {
      const t=now(), db=env.DB;
      if(!db)reject(503,'Seat storage is unavailable.');
      if(!['GET','POST','DELETE'].includes(request.method))reject(405,'Method not supported.');
      if(request.method!=='GET' && request.headers.get('origin')!==origin)reject(403,'Open this action from the club website.');
      if(request.method==='GET' && request.headers.get('sec-fetch-site')==='cross-site')reject(403,'Cross-site request refused.');
      const me=await session(request,db,t);
      if(request.method==='GET' && url.pathname==='/api/club') {
        const count=await db.prepare('SELECT COUNT(*) AS n FROM rw_seats WHERE season=?').bind(season.id).first();
        const seat=me?await db.prepare('SELECT * FROM rw_seats WHERE season=? AND wallet=?').bind(season.id,me.address).first():null;
        const agents=seat?(await db.prepare('SELECT * FROM rw_agents WHERE pool_id=? ORDER BY joined_at,collection,token_id').bind(seat.id).all()).results:[];
        return json({season:{...season,access:{...season.access,founderWallets:undefined,founderCount:season.access.founderWallets.length}},collections:COLLECTIONS,strategies:STRATEGIES,registrationOpen:registrationOpen(season,t),seats:count.n,me:me?{address:me.address,seat:publicSeat(seat,agents)}:null});
      }
      if(request.method==='GET' && url.pathname==='/api/crew') {
        const rows=await db.prepare('SELECT id,nickname,collection,token_id,strategy,joined_at,access_basis FROM rw_seats WHERE season=? ORDER BY joined_at LIMIT 100').bind(season.id).all();
        const agents=await db.prepare('SELECT * FROM rw_agents WHERE pool_id IN (SELECT id FROM rw_seats WHERE season=? ORDER BY joined_at LIMIT 100) ORDER BY joined_at,collection,token_id').bind(season.id).all();
        return json({seats:rows.results.map(row=>publicSeat(row,agents.results)),status:season.status,hasPerformance:false});
      }
      const ipHash=await digest(request.headers.get('cf-connecting-ip')||'local');
      if(request.method==='POST' && url.pathname==='/api/auth/challenge') {
        await limit(db,`auth:${ipHash}`,t,15);
        const data=await body(request);let address;try{address=getAddress(data.address);}catch{reject(400,'Enter a valid wallet address.');}
        const id=crypto.randomUUID(),nonce=crypto.randomUUID().replaceAll('-',''),expires=t+300000;
        const message=createSiweMessage({address,chainId:CHAIN_ID,domain:new URL(origin).host,uri:origin,version:'1',nonce,issuedAt:new Date(t),expirationTime:new Date(expires),statement:'Sign in to Rare Whales Vector Club. This does not authorize transactions or NFT transfers.'});
        await db.batch([
          db.prepare('DELETE FROM rw_challenges WHERE expires<?').bind(t),db.prepare('DELETE FROM rw_sessions WHERE expires<?').bind(t),db.prepare('DELETE FROM rw_limits WHERE expires<?').bind(t),
          db.prepare('INSERT INTO rw_challenges(id,address,message,expires) VALUES (?,?,?,?)').bind(id,address.toLowerCase(),message,expires)
        ]);
        return json({id,message,chainId:CHAIN_ID});
      }
      if(request.method==='POST' && url.pathname==='/api/auth/verify') {
        await limit(db,`verify:${ipHash}`,t,20);
        const data=await body(request);
        if(typeof data.id!=='string'||!/^0x[0-9a-fA-F]+$/.test(data.signature||'')||data.signature.length>4098)reject(400,'Invalid signature.');
        const challenge=await db.prepare('UPDATE rw_challenges SET used=1 WHERE id=? AND used=0 AND expires>? RETURNING *').bind(data.id,t).first();
        if(!challenge)reject(401,'Sign-in expired or was already used. Please reconnect.');
        const client=injectedClient||chainClient(env);
        let valid=false;
        try {if(await client.getChainId()!==CHAIN_ID)throw Error();valid=await client.verifyMessage({address:challenge.address,message:challenge.message,signature:data.signature});}catch{reject(503,'Wallet verification is unavailable. Please try again.');}
        if(!valid)reject(401,'The signature does not match this wallet.');
        const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
        if(me)await db.prepare('DELETE FROM rw_sessions WHERE hash=?').bind(me.hash).run();
        await db.prepare('INSERT INTO rw_sessions(hash,address,expires) VALUES (?,?,?)').bind(await digest(token),challenge.address,t+43200000).run();
        return json({address:challenge.address},200,{'set-cookie':cookie(token,origin)});
      }
      if(request.method==='POST' && url.pathname==='/api/auth/logout') {
        if(me)await db.prepare('DELETE FROM rw_sessions WHERE hash=?').bind(me.hash).run();
        return json({ok:true},200,{'set-cookie':cookie('',origin,0)});
      }
      if(!me)reject(401,'Connect and sign in with your wallet first.');
      await limit(db,`member:${me.address}`,t,40);
      if(request.method==='DELETE' && url.pathname==='/api/seat') {
        if(!registrationOpen(season,t))reject(409,'Registration is closed; season entries are fixed.');
        await db.prepare('DELETE FROM rw_seats WHERE wallet=? AND season=?').bind(me.address,season.id).run();
        return json({ok:true});
      }
      if(request.method==='POST' && ['/api/eligibility','/api/seat'].includes(url.pathname)) {
        const data=await body(request),collection=data.collection??null,tokenId=data.tokenId??null;
        let eligibility;
        try {eligibility=await checkSeat({address:me.address,collection,tokenId,season,client:injectedClient||chainClient(env)});}catch{reject(503,'Could not verify ownership on Robinhood. Check the token number and try again. No seat has been granted.');}
        if(url.pathname==='/api/eligibility')return json(eligibility);
        if(!registrationOpen(season,now()))reject(409,'The founding season is not open for registration yet.');
        if(!eligibility.eligible)reject(403,eligibility.reason||'This wallet does not qualify for a seat.');
        const nickname=typeof data.nickname==='string'?data.nickname.trim():'';
        if(nickname.length<2||nickname.length>32||/[\u0000-\u001f\u007f<>]/.test(nickname))reject(400,'Use a public desk name of 2–32 characters, without markup.');
        if(!season.strategies.includes(data.strategy))reject(400,'Choose one of this season’s fixed strategies.');
        if(data.publish!==true)reject(400,'Confirm that your desk name, NFT and strategy can appear publicly.');
        let agents;
        try{agents=validateRoster(data.agents??(collection===null?[]:[{collection,tokenId,strategy:data.strategy}]));}catch(error){reject(400,error.message);}
        if(!agents.length&&eligibility.basis!=='founder')reject(400,'Add at least one whale agent to your pool.');
        if(collection!==null&&!agents.some(a=>a.collection===collection&&a.tokenId===tokenId))reject(400,'Your captain NFT must be on your pool roster.');
        try{if(!await ownsAgents({address:me.address,agents,block:eligibility.block,client:injectedClient||chainClient(env)}))reject(403,'Every agent in your pool must belong to this wallet.');}catch(error){if(error instanceof HttpError)throw error;reject(503,'Could not verify every agent. Your previous pool has been kept.');}
        const profiles=await Promise.all(agents.map(a=>whaleDNA(a.collection,a.tokenId)));
        if(!registrationOpen(season,now()))reject(409,'Registration closed while checking your roster.');
        const hash=await digest(JSON.stringify(policyRecord(season)));
        await db.prepare('INSERT OR IGNORE INTO rw_rule_locks(season,hash) VALUES (?,?)').bind(season.id,hash).run();
        const lock=await db.prepare('SELECT hash FROM rw_rule_locks WHERE season=?').bind(season.id).first();
        if(lock.hash!==hash)reject(409,'Season rules changed after registration began. A new season version is required.');
        const existing=await db.prepare('SELECT id FROM rw_seats WHERE season=? AND wallet=?').bind(season.id,me.address).first();
        const poolId=existing?.id||crypto.randomUUID();
        try {await db.batch([
          db.prepare('INSERT INTO rw_seats(id,season,wallet,nickname,collection,token_id,strategy,access_basis,ownership_block,policy_hash,joined_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(season,wallet) DO UPDATE SET nickname=excluded.nickname,collection=excluded.collection,token_id=excluded.token_id,strategy=excluded.strategy,access_basis=excluded.access_basis,ownership_block=excluded.ownership_block,updated_at=excluded.updated_at').bind(poolId,season.id,me.address,nickname,collection,tokenId,data.strategy,eligibility.basis,eligibility.block,hash,t,t),
          db.prepare('DELETE FROM rw_agents WHERE pool_id=?').bind(poolId),
          ...agents.map((a,i)=>db.prepare('INSERT INTO rw_agents(season,collection,token_id,pool_id,strategy,modifier_version,modifier_json,ownership_block,joined_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(season.id,a.collection,a.tokenId,poolId,a.strategy,DNA_VERSION,JSON.stringify(profiles[i]),eligibility.block,t+i))
        ]);}
        catch(e){if(String(e).includes('UNIQUE'))reject(409,'This whale already has a seat in this season.');throw e;}
        return json({ok:true});
      }
      reject(404,'Not found.');
    } catch(error) {
      if(error instanceof HttpError)return json({error:error.message},error.status);
      console.error('rare-whales-api-failure',error?.name||'Error');
      return json({error:'The club is temporarily unavailable. Please try again.'},503);
    }
  };
}
