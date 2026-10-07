import {HttpError} from './api.mjs';
import {checkSeat,chainClient} from './access.mjs';
import {validateRoster} from './dna.mjs';
import {paperStats} from './paper-engine.mjs';
import {TIDE_RULES,projectTide} from './daily-tide.mjs';
const fail=(status,message)=>{throw new HttpError(status,message);};
const uuid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const pick=row=>row?{id:row.id,roundId:row.round_id,owner:row.wallet,nickname:row.nickname,preset:row.preset,badge:{collection:row.collection,tokenId:row.token_id},ownershipBlock:row.ownership_block,joinedAt:row.joined_at}:null;
export function decodeArchiveCursor(value){
 if(!value)return null;
 try{if(value.length>180)throw Error();const [time,id]=JSON.parse(atob(value));if(!Number.isSafeInteger(time)||time<0||!uuid(id))throw Error();return {time,id};}
 catch{fail(400,'The archive page link is invalid. Refresh your archive.');}
}
export function createFleetSocialService({season,tideHash,paperHash,client,now=Date.now}){
 return {
  async archive({db,me,env,url}){
   if(env.PAPER_ENABLED!=='1')return {enabled:false,runs:[],next:null};
   if(!me)fail(401,'Sign in to see your own dated watch archive.');
   const cursor=decodeArchiveCursor(url.searchParams.get('cursor'));
   const query='SELECT id,nickname,rules_hash,created_at,ends_at,status,state_json FROM wp_paper_runs WHERE wallet=?'+(cursor?' AND (created_at<? OR (created_at=? AND id<?))':'')+' ORDER BY created_at DESC,id DESC LIMIT 11';
   const params=cursor?[me.address,cursor.time,cursor.time,cursor.id]:[me.address];
   const rows=(await db.prepare(query).bind(...params).all()).results,visible=rows.slice(0,10),last=visible.at(-1);
   return {enabled:true,address:me.address,runs:visible.map(r=>{
    const state=JSON.parse(r.state_json);
    return {id:r.id,nickname:r.nickname,rulesHash:r.rules_hash,createdAt:r.created_at,endsAt:r.ends_at,status:r.status,stats:paperStats(state),lastObservation:state.history.at(-1)?.t??null};
   }),next:rows.length>10?btoa(JSON.stringify([last.created_at,last.id])):null};
  },
  async tide({db,me,env,url}){
   if(env.PAPER_ENABLED!=='1'||env.TIDE_ENABLED!=='1')return {enabled:false,rules:TIDE_RULES,rounds:[]};
   const id=url.searchParams.get('round');
   if(id&&!/^tide-[0-9a-f]{12}-\d{4}-\d{2}-\d{2}$/.test(id))fail(404,'This Daily Tide round is unavailable.');
   const rows=(await (id?db.prepare('SELECT * FROM wp_tide_rounds WHERE id=?').bind(id):db.prepare('SELECT * FROM wp_tide_rounds ORDER BY starts_at DESC,id DESC LIMIT 7')).all()).results;
   if(id&&!rows.length)fail(404,'This Daily Tide round is unavailable.');
   const rounds=await Promise.all(rows.map(async row=>{
    const entries=(await db.prepare('SELECT * FROM wp_tide_picks WHERE round_id=? ORDER BY joined_at,id LIMIT 20').bind(row.id).all()).results;
    return {...projectTide(row),picks:entries.map(pick),mine:me?pick(entries.find(e=>e.wallet===me.address)):null};
   }));
   return {enabled:true,rules:TIDE_RULES,rulesHash:tideHash,paperHash,serverTime:now(),rounds};
  },
  async join({db,me,env,data,request}){
   if(request.method!=='POST')fail(405,'Use the Daily Tide pick control.');
   if(env.PAPER_ENABLED!=='1'||env.TIDE_ENABLED!=='1')fail(409,'Daily Tide is not enabled here.');
   if(data?.wallet!==me.address)fail(409,'The signed-in wallet changed. Refresh before choosing a preset.');
   if(data.rulesHash!==tideHash)fail(409,'Daily Tide rules changed. Reload before choosing a round.');
   if(!uuid(data.mutationId)||typeof data.roundId!=='string'||!TIDE_RULES.presets.includes(data.preset))fail(400,'Choose an available Daily Tide round and preset.');
   if(data.publish!==true)fail(400,'Confirm that your round pick, nickname, wallet and entry badge can appear publicly.');
   const nickname=typeof data.nickname==='string'?data.nickname.trim():'';
   if(nickname.length<2||nickname.length>32||/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/.test(nickname))fail(400,'Use a public name of 2–32 characters without markup.');
   let badge;try{badge=validateRoster([{...data.badge,strategy:'trend'}])[0];}catch(e){fail(400,e.message);}
   if(!badge||badge.tokenId<1)fail(400,'Choose one owned whale as your entry badge.');
   const input=JSON.stringify({roundId:data.roundId,preset:data.preset,nickname,badge:{collection:badge.collection,tokenId:badge.tokenId},rulesHash:tideHash});
   const repeated=await db.prepare('SELECT * FROM wp_tide_picks WHERE wallet=? AND mutation_id=?').bind(me.address,data.mutationId).first();
   if(repeated){if(repeated.input_json!==input)fail(409,'This request was used for another pick.');return {ok:true,pick:pick(repeated)};}
   const row=await db.prepare('SELECT * FROM wp_tide_rounds WHERE id=? AND rules_hash=?').bind(data.roundId,tideHash).first();
   if(!row||row.status!=='queued'||now()>=row.starts_at)fail(409,'This round has started or is unavailable. Choose the next UTC round.');
   if(await db.prepare('SELECT id FROM wp_tide_picks WHERE round_id=? AND wallet=?').bind(row.id,me.address).first())fail(409,'Your confirmed preset is already locked for this round.');
   let ownership;
   try{ownership=await checkSeat({address:me.address,collection:badge.collection,tokenId:badge.tokenId,season,client:client||chainClient(env)});}
   catch{fail(503,'Ownership could not be checked. Your company is kept; retry this unchanged pick.');}
   if(!ownership.eligible)fail(403,ownership.reason||'Your entry badge must belong to this wallet.');
   const t=now(),feed=await db.prepare('SELECT last_ok,error,halted FROM wp_paper_feed WHERE id=1').first();
   if(!feed?.last_ok||t-feed.last_ok>180000||feed.error||feed.halted)fail(503,'The market recorder is recovering. Retry when it has fresh data.');
   if(t>=row.starts_at)fail(409,'The round started while ownership was checked. Choose the next UTC round.');
   const id=crypto.randomUUID();
   try{
    const result=await db.prepare("INSERT INTO wp_tide_picks(id,round_id,wallet,nickname,preset,collection,token_id,ownership_block,joined_at,mutation_id,input_json) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM wp_tide_rounds WHERE id=? AND status='queued' AND starts_at>?) AND (SELECT COUNT(*) FROM wp_tide_picks WHERE round_id=?)<?")
     .bind(id,row.id,me.address,nickname,data.preset,badge.collection,badge.tokenId,ownership.block,t,data.mutationId,input,row.id,t,row.id,TIDE_RULES.capacity).run();
    if(!result.meta.changes)fail(409,'This round started or its small beta is full. Refresh the round.');
   }catch(e){
    if(e instanceof HttpError)throw e;
    const saved=await db.prepare('SELECT * FROM wp_tide_picks WHERE wallet=? AND mutation_id=?').bind(me.address,data.mutationId).first();
    if(saved?.input_json===input)return {ok:true,pick:pick(saved)};
    fail(409,'Another pick was saved first. Refresh the round.');
   }
   return {ok:true,pick:pick(await db.prepare('SELECT * FROM wp_tide_picks WHERE id=?').bind(id).first())};
  }
 };
}
