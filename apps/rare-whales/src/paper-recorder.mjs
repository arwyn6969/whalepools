// Operational recorder for the frozen paper-v1 rules. The legacy service file
// remains byte-identical as part of the original rules provenance. This module
// changes persistence and observability, never the strategy or execution rules.
import {PAPER_RULES,stepPaper} from './paper-engine.mjs';
import {readPaperMarket} from './paper-feed.mjs';
import {ensureReferenceWatches} from './reference-watches.mjs';

export async function tickPaper(env,{rulesHash,now:fixedTime,clock=Date.now,market=readPaperMarket,log=console}={}){
 if(env.PAPER_ENABLED!=='1')return {disabled:true};
 let now=fixedTime??clock();
 const db=env.DB,token=crypto.randomUUID();
 let phase='lease',closeAt=null,receiptDelayMs=null;
 const reportFailure=e=>{const message=e.message?.slice(0,200)||'Market recording failed.';log.error(JSON.stringify({event:'paper-recorder-failure',phase,closeAt,receiptDelayMs,message}));return message;};
 let acquired;
 try{acquired=await db.prepare('UPDATE wp_paper_feed SET lock_owner=?,lock_until=?,last_attempt=? WHERE id=1 AND lock_until<=?').bind(token,now+60000,now,now).run();}
 catch(e){return {error:reportFailure(e)};}
 if(!acquired.meta.changes)return {busy:true};
 phase='market';
 try{
  const feed=await db.prepare('SELECT * FROM wp_paper_feed WHERE id=1').first();if(feed.halted)throw Error('A recorded candle was revised. Operator review is required before trading resumes.');
  const {coin,bars}=await market({coin:feed.coin,now});
  // Receipt time, rather than request time, determines whether a close arrived promptly.
  now=fixedTime??clock();
  closeAt=bars.at(-1).t+PAPER_RULES.interval;receiptDelayMs=now-closeAt;
  phase='receipt';
  const prior=(await db.prepare('SELECT * FROM wp_paper_bars WHERE t>=? ORDER BY t').bind(bars[0].t).all()).results,byTime=new Map(prior.map(b=>[b.t,b]));
  if(bars.some(b=>{const old=byTime.get(b.t);return old&&['o','h','l','c'].some(k=>b[k]!==old[k]);})){await db.prepare('UPDATE wp_paper_feed SET halted=1 WHERE id=1 AND lock_owner=?').bind(token).run();throw Error('A recorded candle was revised. Operator review is required before trading resumes.');}
  const fresh=bars.filter(b=>!byTime.has(b.t));
  // One bounded JSON input also keeps bootstrap/recovery below the Free query
  // allowance. INSERT OR IGNORE retains the original first receipt forever.
  if(fresh.length)await db.prepare("INSERT OR IGNORE INTO wp_paper_bars(t,o,h,l,c,observed_at,fresh) SELECT json_extract(value,'$.t'),json_extract(value,'$.o'),json_extract(value,'$.h'),json_extract(value,'$.l'),json_extract(value,'$.c'),?,CASE WHEN ?-(json_extract(value,'$.t')+?)<=? THEN 1 ELSE 0 END FROM json_each(?)").bind(now,now,PAPER_RULES.interval,PAPER_RULES.maxDelay,JSON.stringify(fresh)).run();
  if(now-(bars.at(-1).t+PAPER_RULES.interval)>PAPER_RULES.interval+PAPER_RULES.maxDelay)throw Error('Waiting for the provider to deliver a fresh completed candle.');
  phase='prepare';
  const lastT=Math.floor(now/PAPER_RULES.interval)*PAPER_RULES.interval-PAPER_RULES.interval;
  await ensureReferenceWatches({db,rulesHash,now,lastT});
  await db.prepare("UPDATE wp_paper_runs SET status='stopped',revision=revision+1,commit_token=NULL WHERE wallet IS NULL AND status='running' AND rules_hash<>?").bind(rulesHash).run();
  const runs=(await db.prepare("SELECT * FROM wp_paper_runs WHERE status='running' AND rules_hash=? ORDER BY created_at LIMIT 23").bind(rulesHash).all()).results;
  const history=(await db.prepare('SELECT * FROM wp_paper_bars ORDER BY t DESC LIMIT 180').all()).results.reverse();
  const commits=[],ledger=[];let actionable=0,valuationOnly=0;
  for(const run of runs){
   if(run.rules_hash!==rulesHash)continue;
   let state=JSON.parse(run.state_json);
   // A bounded catch-up marks late data and cancels pending orders. It never fills retrospectively.
   const pending=history.filter(b=>b.t>state.lastT&&b.t+PAPER_RULES.interval<=Math.min(now,run.ends_at)).slice(-12),events=[];
   if(!pending.length&&now<run.ends_at)continue;
   // Saved points are append-only output, not step inputs. Keep them outside
   // the frozen engine's structuredClone, then restore its exact bounded list.
   const savedHistory=state.history;state.history=[];
   for(const b of pending){const next=stepPaper(state,b,history.filter(x=>x.t<=b.t).slice(-100),now);state=next.state;next.events.forEach((event,ordinal)=>events.push({t:b.t,ordinal,event}));}
   actionable+=state.history.filter(p=>p.actionable).length;valuationOnly+=state.history.filter(p=>!p.actionable).length;
   state.history=[...savedHistory,...state.history].slice(-4032);
   const commit=crypto.randomUUID(),status=now>=run.ends_at?'completed':'running';
   commits.push(db.prepare("UPDATE wp_paper_runs SET state_json=?,revision=revision+1,commit_token=?,status=? WHERE id=? AND revision=? AND status='running' AND EXISTS (SELECT 1 FROM wp_paper_feed WHERE id=1 AND lock_owner=?)").bind(JSON.stringify(state),commit,status,run.id,run.revision,token));
   ledger.push(...events.map(e=>({...e,run:run.id,commit})));
  }
  // Cohort decisions, fills and success are one transaction. A later statement
  // failure cannot leave just the first preset actionable. JSON events bound
  // this to 25 statements for 23 runs regardless of whale/fill count.
  const runCommits=commits.length;
  if(ledger.length)commits.push(db.prepare("INSERT OR IGNORE INTO wp_paper_events(run_id,bar_t,ordinal,event_json) SELECT r.id,json_extract(e.value,'$.t'),json_extract(e.value,'$.ordinal'),json_extract(e.value,'$.event') FROM json_each(?) e JOIN wp_paper_runs r ON r.id=json_extract(e.value,'$.run') AND r.commit_token=json_extract(e.value,'$.commit')").bind(JSON.stringify(ledger)));
  commits.push(db.prepare('UPDATE wp_paper_feed SET coin=?,last_ok=?,error=NULL WHERE id=1 AND lock_owner=?').bind(coin,now,token));
  phase='commit';
  log.info({event:'paper-recorder-commit',phase:'started',closeAt,receiptDelayMs,preparedRuns:runCommits,preparedActionable:actionable,preparedValuationOnly:valuationOnly,preparedEvents:ledger.length,statements:commits.length});
  const results=await db.batch(commits);
  if(!results.at(-1).meta.changes){log.info({event:'paper-recorder-commit',phase:'finished',status:'lease-lost',closeAt});return {busy:true};}
  log.info({event:'paper-recorder-commit',phase:'finished',status:'ok',closeAt,committedRuns:results.slice(0,runCommits).filter(r=>r.meta.changes===1).length});
  return {recorded:fresh.length,runs:runs.length};
 }catch(e){const message=reportFailure(e);await db.prepare('UPDATE wp_paper_feed SET error=? WHERE id=1 AND lock_owner=?').bind(message,token).run();return {error:message};}
 finally{phase='release';try{await db.prepare('UPDATE wp_paper_feed SET lock_owner=NULL,lock_until=0 WHERE id=1 AND lock_owner=?').bind(token).run();}catch(e){reportFailure(e);throw e;}}
}
