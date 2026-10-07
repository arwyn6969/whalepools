import {HttpError} from './api.mjs';
import {PAPER_RULES,initialState,stepPaper,paperStats} from './paper-engine.mjs';
import {readPaperMarket} from './paper-feed.mjs';
import {validateRoster,whaleDNA,NEUTRAL_PROFILE} from './dna.mjs';
import {checkSeat,ownsAgents,chainClient} from './access.mjs';
const fail=(status,message)=>{throw new HttpError(status,message);};
const uuid=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'');
export function projectRun(row){
 if(!row)return null;const s=JSON.parse(row.state_json);
 return {id:row.id,nickname:row.nickname,owner:row.wallet,status:row.status,createdAt:row.created_at,endsAt:row.ends_at,rulesHash:row.rules_hash,ownershipBlock:row.ownership_block,stats:paperStats(s),observedBars:s.observedBars,gapBars:s.gapBars,history:s.history.slice(-288),agents:s.agents.map(a=>({collection:a.collection,tokenId:a.tokenId,preset:a.preset,profile:a.profile,qty:a.qty,cash:a.cash,entry:a.entry,stop:a.stop,target:a.target,action:a.action,pending:a.pending?.side??null,trades:a.tradeCount,realized:a.realized}))};
}
export function createPaperService({rulesHash,season,client,now=Date.now}){
 const withEvents=async(db,row)=>{const run=projectRun(row);if(run)run.events=(await db.prepare('SELECT event_json FROM wp_paper_events WHERE run_id=? ORDER BY bar_t DESC,ordinal DESC LIMIT 30').bind(row.id).all()).results.map(e=>JSON.parse(e.event_json)).reverse();return run;};
 const readRun=async(db,id)=>withEvents(db,await db.prepare('SELECT * FROM wp_paper_runs WHERE id=?').bind(id).first());
 return {
  async read({db,me,env,id}){
   if(env.PAPER_ENABLED!=='1')return {enabled:false,rules:PAPER_RULES,rulesHash};
   if(id){if(!uuid(id))fail(404,'This paper company is unavailable.');const run=await readRun(db,id);if(!run)fail(404,'This paper company is unavailable.');return {enabled:true,run};}
   const feed=await db.prepare('SELECT coin,last_ok,last_attempt,error,halted FROM wp_paper_feed WHERE id=1').first();
   const price=await db.prepare('SELECT t,c,observed_at FROM wp_paper_bars ORDER BY t DESC LIMIT 1').first();
   const labs=await Promise.all((await db.prepare('SELECT * FROM wp_paper_runs WHERE wallet IS NULL AND rules_hash=? ORDER BY id').bind(rulesHash).all()).results.map(row=>withEvents(db,row)));
   const own=me?await db.prepare('SELECT * FROM wp_paper_runs WHERE wallet=? ORDER BY created_at DESC,id DESC LIMIT 1').bind(me.address).first():null;
   return {enabled:true,rules:PAPER_RULES,rulesHash,serverTime:now(),feed:{...feed,price,stale:!price||now()-(price.t+PAPER_RULES.interval)>PAPER_RULES.interval+PAPER_RULES.maxDelay},labs,me:me?{address:me.address,run:await withEvents(db,own)}:null};
  },
  async handle({request,db,me,env,data}){
   if(env.PAPER_ENABLED!=='1')fail(409,'Live paper trading is not enabled on this preview.');
   if(data?.wallet!==me.address)fail(409,'The signed-in wallet changed. Refresh before using the paper controls.');
   const path=new URL(request.url).pathname;
   if(request.method!=='POST')fail(405,'Use the paper company controls.');
   if(path==='/api/paper/stop'){
    if(!uuid(data.id))fail(400,'Choose a valid paper company.');
    const result=await db.prepare("UPDATE wp_paper_runs SET status='stopped',revision=revision+1,commit_token=NULL WHERE id=? AND wallet=? AND status='running'").bind(data.id,me.address).run();
    const row=await db.prepare('SELECT * FROM wp_paper_runs WHERE id=? AND wallet=?').bind(data.id,me.address).first();if(!row)fail(404,'This is not your paper company.');
    return {ok:true,stopped:result.meta.changes===1,run:projectRun(row)};
   }
   if(path!=='/api/paper/start')fail(404,'Not found.');
   if(data.rulesHash!==rulesHash)fail(409,'Paper rules changed. Reload before starting a new run.');
   if(!uuid(data.mutationId))fail(400,'Reload the paper controls before starting.');
   if(data.publish!==true)fail(400,'Confirm that this dated paper company and wallet can appear publicly.');
   const nickname=typeof data.nickname==='string'?data.nickname.trim():'';
   if(nickname.length<2||nickname.length>32||/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/.test(nickname))fail(400,'Use a public company name of 2–32 characters without markup.');
   if(!['balanced',...Object.keys(PAPER_RULES.presets)].includes(data.preset))fail(400,'Choose a ready-made paper style.');
   let clean;try{clean=validateRoster(data.agents?.map(a=>({collection:a.collection,tokenId:a.tokenId,strategy:'trend'})));}catch(e){fail(400,e.message);}
   if(!clean?.length||clean.some(a=>a.tokenId<1))fail(400,'Choose at least one whale you own.');
   const input=JSON.stringify({nickname,preset:data.preset,agents:clean.map(({collection,tokenId})=>({collection,tokenId})),rulesHash});
   const repeated=await db.prepare('SELECT * FROM wp_paper_runs WHERE wallet=? AND mutation_id=?').bind(me.address,data.mutationId).first();
   if(repeated){if(repeated.input_json!==input)fail(409,'This request was already used for a different crew.');return {ok:true,run:projectRun(repeated)};}
   if(await db.prepare("SELECT id FROM wp_paper_runs WHERE wallet=? AND status='running'").bind(me.address).first())fail(409,'Your paper company is already running. Stop it before starting a new dated record.');
   let eligibility;const provider=client||chainClient(env);
   try{eligibility=await checkSeat({address:me.address,collection:clean[0].collection,tokenId:clean[0].tokenId,season,client:provider});if(eligibility.eligible&&!await ownsAgents({address:me.address,agents:clean,block:eligibility.block,client:provider}))fail(403,'Every whale must belong to this wallet.');}
   catch(e){if(e instanceof HttpError)throw e;fail(503,'Ownership could not be checked. Your existing records are kept; try again.');}
   if(!eligibility.eligible)fail(403,eligibility.reason||'Own one Rare Whales or WhaleStreet NFT to start.');
   const feed=await db.prepare('SELECT last_ok,error,halted FROM wp_paper_feed WHERE id=1').first(),t=now();
   if(!feed?.last_ok||t-feed.last_ok>180000||feed.halted||feed.error)fail(503,'The market recorder is recovering. Wait for fresh data before starting.');
   const ids=Object.keys(PAPER_RULES.presets),agents=await Promise.all(clean.map(async(a,i)=>({collection:a.collection,tokenId:a.tokenId,preset:data.preset==='balanced'?ids[i%ids.length]:data.preset,profile:await whaleDNA(a.collection,a.tokenId)})));
   const id=crypto.randomUUID(),lastT=Math.floor(t/PAPER_RULES.interval)*PAPER_RULES.interval-PAPER_RULES.interval;
   try{const result=await db.prepare("INSERT INTO wp_paper_runs(id,wallet,nickname,mutation_id,input_json,rules_hash,ownership_block,created_at,ends_at,status,state_json) SELECT ?,?,?,?,?,?,?,?,?,'running',? WHERE (SELECT COUNT(*) FROM wp_paper_runs WHERE status='running' AND wallet IS NOT NULL)<20").bind(id,me.address,nickname,data.mutationId,input,rulesHash,eligibility.block,t,t+PAPER_RULES.duration,JSON.stringify(initialState(agents,t,lastT))).run();if(!result.meta.changes)fail(409,'The small beta is full. Please try a later round.');}
   catch(e){if(e instanceof HttpError)throw e;const saved=await db.prepare('SELECT * FROM wp_paper_runs WHERE wallet=? AND mutation_id=?').bind(me.address,data.mutationId).first();if(saved?.input_json===input)return {ok:true,run:projectRun(saved)};fail(409,'Another run was saved first. Refresh your paper company.');}
   return {ok:true,run:await readRun(db,id)};
  }
 };
}
export async function tickPaper(env,{rulesHash,now:fixedTime,clock=Date.now,market=readPaperMarket}={}){
 if(env.PAPER_ENABLED!=='1')return {disabled:true};
 let now=fixedTime??clock();
 const db=env.DB,token=crypto.randomUUID();
 const acquired=await db.prepare('UPDATE wp_paper_feed SET lock_owner=?,lock_until=?,last_attempt=? WHERE id=1 AND lock_until<=?').bind(token,now+60000,now,now).run();
 if(!acquired.meta.changes)return {busy:true};
 try{
  const feed=await db.prepare('SELECT * FROM wp_paper_feed WHERE id=1').first();if(feed.halted)throw Error('A recorded candle was revised. Operator review is required before trading resumes.');
  const {coin,bars}=await market({coin:feed.coin,now});
  // Receipt time, rather than request time, determines whether a close arrived promptly.
  now=fixedTime??clock();
  const prior=(await db.prepare('SELECT * FROM wp_paper_bars WHERE t>=? ORDER BY t').bind(bars[0].t).all()).results,byTime=new Map(prior.map(b=>[b.t,b]));
  if(bars.some(b=>{const old=byTime.get(b.t);return old&&['o','h','l','c'].some(k=>b[k]!==old[k]);})){await db.prepare('UPDATE wp_paper_feed SET halted=1 WHERE id=1 AND lock_owner=?').bind(token).run();throw Error('A recorded candle was revised. Operator review is required before trading resumes.');}
  const fresh=bars.filter(b=>!byTime.has(b.t));
  for(let i=0;i<fresh.length;i+=40)await db.batch(fresh.slice(i,i+40).map(b=>db.prepare('INSERT OR IGNORE INTO wp_paper_bars(t,o,h,l,c,observed_at,fresh) VALUES (?,?,?,?,?,?,?)').bind(b.t,b.o,b.h,b.l,b.c,now,Number(now-(b.t+PAPER_RULES.interval)<=PAPER_RULES.maxDelay))));
  if(now-(bars.at(-1).t+PAPER_RULES.interval)>PAPER_RULES.interval+PAPER_RULES.maxDelay)throw Error('Waiting for the provider to deliver a fresh completed candle.');
  const lastT=Math.floor(now/PAPER_RULES.interval)*PAPER_RULES.interval-PAPER_RULES.interval;
  for(const [i,preset] of Object.keys(PAPER_RULES.presets).entries()){
   const id=rulesHash.slice(0,8)+'-'+rulesHash.slice(8,12)+'-4'+rulesHash.slice(13,16)+'-8'+rulesHash.slice(17,20)+'-'+String(i+1).padStart(12,'0'),a={collection:'rarewhales',tokenId:245+i,preset,profile:NEUTRAL_PROFILE};
   await db.prepare("INSERT OR IGNORE INTO wp_paper_runs(id,wallet,nickname,input_json,rules_hash,created_at,ends_at,status,state_json) VALUES (?,NULL,?,'{}',?,?,?,'running',?)").bind(id,PAPER_RULES.presets[preset].name+' · preset watch',rulesHash,now,now+PAPER_RULES.duration,JSON.stringify(initialState([a],now,lastT))).run();
  }
  await db.prepare("UPDATE wp_paper_runs SET status='stopped',revision=revision+1,commit_token=NULL WHERE wallet IS NULL AND status='running' AND rules_hash<>?").bind(rulesHash).run();
  const runs=(await db.prepare("SELECT * FROM wp_paper_runs WHERE status='running' AND rules_hash=? ORDER BY created_at LIMIT 23").bind(rulesHash).all()).results;
  const history=(await db.prepare('SELECT * FROM wp_paper_bars ORDER BY t DESC LIMIT 180').all()).results.reverse();
  for(const run of runs){
   if(run.rules_hash!==rulesHash)continue;
   let state=JSON.parse(run.state_json);
   // A bounded catch-up marks late data and cancels pending orders. It never fills retrospectively.
   const pending=history.filter(b=>b.t>state.lastT&&b.t+PAPER_RULES.interval<=Math.min(now,run.ends_at)).slice(-12),events=[];
   for(const b of pending){const next=stepPaper(state,b,history.filter(x=>x.t<=b.t).slice(-100),now);state=next.state;next.events.forEach((event,ordinal)=>events.push({t:b.t,ordinal,event}));}
   if(!pending.length&&now<run.ends_at)continue;
   const commit=crypto.randomUUID(),status=now>=run.ends_at?'completed':'running';
   await db.batch([
    db.prepare("UPDATE wp_paper_runs SET state_json=?,revision=revision+1,commit_token=?,status=? WHERE id=? AND revision=? AND status='running'").bind(JSON.stringify(state),commit,status,run.id,run.revision),
    ...events.map(e=>db.prepare('INSERT OR IGNORE INTO wp_paper_events(run_id,bar_t,ordinal,event_json) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM wp_paper_runs WHERE id=? AND commit_token=?)').bind(run.id,e.t,e.ordinal,JSON.stringify(e.event),run.id,commit))
   ]);
  }
  await db.prepare('UPDATE wp_paper_feed SET coin=?,last_ok=?,error=NULL WHERE id=1 AND lock_owner=?').bind(coin,now,token).run();
  return {recorded:fresh.length,runs:runs.length};
 }catch(e){const message=e.message?.slice(0,200)||'Market recording failed.';await db.prepare('UPDATE wp_paper_feed SET error=? WHERE id=1 AND lock_owner=?').bind(message,token).run();console.error(JSON.stringify({event:'paper-recorder-failure',message}));return {error:message};}
 finally{await db.prepare('UPDATE wp_paper_feed SET lock_owner=NULL,lock_until=0 WHERE id=1 AND lock_owner=?').bind(token).run();}
}
