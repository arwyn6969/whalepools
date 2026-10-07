import {PAPER_RULES,initialState,stepPaper,paperStats} from './paper-engine.mjs';
import {NEUTRAL_PROFILE} from './dna.mjs';

export const TIDE_RULES=Object.freeze({
 id:'daily-tide-v1', title:'Daily Tide', duration:86400000, capacity:20,
 interval:PAPER_RULES.interval, market:PAPER_RULES.market, initialEquity:1000,
 presets:Object.keys(PAPER_RULES.presets), names:Object.fromEntries(Object.entries(PAPER_RULES.presets).map(([id,p])=>[id,p.name])), profile:NEUTRAL_PROFILE,
 membership:'One confirmed, locked preset pick per eligible wallet, before the UTC start. An owned whale is an entry badge; all strategies use equal neutral stats.',
 execution:PAPER_RULES.execution,
 ranking:'Net return rounded to six decimals; matching returns tie. Only a full 288-candle, gap-free round has final ranks. Partial rounds remain readable without final ranks.',
 costs:{fee:PAPER_RULES.fee,slippage:PAPER_RULES.slippage},
 calendar:'Daily UTC midnight start, 24 hours, end inclusive for the final completed candle. No retrospective round creation or fills.',
});
export function nextTideStart(now){return (Math.floor(now/TIDE_RULES.duration)+1)*TIDE_RULES.duration;}
export function tideId(hash,start){return 'tide-'+hash.slice(0,12)+'-'+new Date(start).toISOString().slice(0,10);}
export function initialTide(start){
 return Object.fromEntries(TIDE_RULES.presets.map((preset,i)=>[preset,initialState([{collection:'rarewhales',tokenId:245+i,preset,profile:NEUTRAL_PROFILE}],start,start-PAPER_RULES.interval)]));
}
export function tideQuality(states){
 const expected=TIDE_RULES.duration/PAPER_RULES.interval;
 return TIDE_RULES.presets.every(p=>states[p].observedBars===expected&&states[p].gapBars===0&&states[p].history.length===expected)?'complete':'partial';
}
export function projectTide(row){
 const states=JSON.parse(row.state_json),rules=JSON.parse(row.rules_json);
 const ranked=row.status==='completed'&&row.quality==='complete';
 const strategies=rules.presets.map(preset=>{
  const s=states[preset],a=s.agents[0];
  return {preset,name:rules.names?.[preset]??PAPER_RULES.presets[preset].name,stats:paperStats(s),observedBars:s.observedBars,gapBars:s.gapBars,lastObservation:s.history.at(-1)?.t??null,action:a.action,position:a.qty>0,pending:a.pending?.side??null};
 });
 const scores=strategies.map(s=>Number(s.stats.returnPct.toFixed(6)));
 for(const s of strategies)s.rank=ranked?1+scores.filter(v=>v>Number(s.stats.returnPct.toFixed(6))).length:null;
 return {id:row.id,rulesHash:row.rules_hash,rules,startsAt:row.starts_at,endsAt:row.ends_at,status:row.status,quality:row.quality,strategies};
}

// Reads the existing immutable recorder; never alters the paper-v1 tables or scoring identity.
export async function tickTide(env,{rulesHash,paperHash,now=Date.now()}={}){
 if(env.PAPER_ENABLED!=='1'||env.TIDE_ENABLED!=='1')return {disabled:true};
 const db=env.DB,lock=crypto.randomUUID();
 const acquired=await db.prepare('UPDATE wp_tide_runtime SET lock_owner=?,lock_until=? WHERE id=1 AND lock_until<=?').bind(lock,now+60000,now).run();
 if(!acquired.meta.changes)return {busy:true};
 try{
  const start=nextTideStart(now),rules={...TIDE_RULES,paperHash};
  await db.prepare("INSERT OR IGNORE INTO wp_tide_rounds(id,rules_hash,rules_json,starts_at,ends_at,created_at,status,state_json) VALUES(?,?,?,?,?,?,'queued',?)")
   .bind(tideId(rulesHash,start),rulesHash,JSON.stringify(rules),start,start+TIDE_RULES.duration,now,JSON.stringify(initialTide(start))).run();
  await db.prepare("UPDATE wp_tide_rounds SET status='paused',revision=revision+1,commit_token=NULL WHERE status IN('queued','running') AND rules_hash<>?").bind(rulesHash).run();
  const feed=await db.prepare('SELECT last_ok,error,halted FROM wp_paper_feed WHERE id=1').first();
  const healthy=feed?.last_ok&&now-feed.last_ok<=180000&&!feed.error&&!feed.halted;
  const history=healthy?(await db.prepare('SELECT * FROM wp_paper_bars ORDER BY t DESC LIMIT 180').all()).results.reverse():[];
  const rounds=(await db.prepare("SELECT * FROM wp_tide_rounds WHERE rules_hash=? AND status IN('queued','running') AND starts_at<=? ORDER BY starts_at LIMIT 3").bind(rulesHash,now).all()).results;
  let advanced=0;
  for(const row of rounds){
   let states=JSON.parse(row.state_json);const events=[];
   const lastT=states[TIDE_RULES.presets[0]].lastT;
   const pending=history.filter(b=>b.t>=row.starts_at&&b.t>lastT&&b.t+PAPER_RULES.interval<=Math.min(now,row.ends_at)).slice(-12);
   for(const b of pending)for(const preset of TIDE_RULES.presets){
    const next=stepPaper(states[preset],b,history.filter(x=>x.t<=b.t).slice(-100),now);states[preset]=next.state;
    next.events.forEach((event,ordinal)=>events.push({preset,t:b.t,ordinal,event}));
   }
   const ended=now>=row.ends_at,status=ended?'completed':'running',quality=ended?(healthy?tideQuality(states):'partial'):'pending';
   if(!pending.length&&row.status===status&&!ended)continue;
   const commit=crypto.randomUUID();
   await db.batch([
    db.prepare("UPDATE wp_tide_rounds SET state_json=?,status=?,quality=?,revision=revision+1,commit_token=? WHERE id=? AND revision=? AND status IN('queued','running')")
     .bind(JSON.stringify(states),status,quality,commit,row.id,row.revision),
    ...events.map(e=>db.prepare('INSERT OR IGNORE INTO wp_tide_events(round_id,preset,bar_t,ordinal,event_json) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM wp_tide_rounds WHERE id=? AND commit_token=?)')
     .bind(row.id,e.preset,e.t,e.ordinal,JSON.stringify(e.event),row.id,commit))
   ]);
   advanced+=pending.length;
  }
  return {rounds:rounds.length,advanced};
 }finally{await db.prepare('UPDATE wp_tide_runtime SET lock_owner=NULL,lock_until=0 WHERE id=1 AND lock_owner=?').bind(lock).run();}
}
