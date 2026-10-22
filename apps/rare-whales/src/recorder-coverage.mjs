import {HttpError} from './api.mjs';
import {recapDay} from './watch-recap.mjs';
import {PAPER_RULES as R} from './paper-engine.mjs';
import {referenceCohorts} from './reference-watches.mjs';
const DAY=86400000,date=t=>new Date(t).toISOString().slice(0,10);
export function coverageWindow({day,now,startedAt}){
 const today=Math.floor(now/DAY)*DAY,first=Math.max(Math.floor(startedAt/DAY)*DAY,today-13*DAY);
 const days=Array.from({length:Math.max(0,Math.min(14,1+(today-first)/DAY))},(_,i)=>date(today-i*DAY));
 const start=day===null?today:recapDay(day);
 if(!days.includes(date(start)))throw new HttpError(404,'Choose a recorded day from the last fourteen UTC days.');
 return {day:date(start),days,from:Math.max(start,startedAt),until:Math.min(start+DAY,now),completeDay:now>=start+DAY+R.maxDelay};
}
// Read receipt metadata and saved public neutral-watch decisions. Never replay,
// retry a tick, rescore a round, or infer why an interruption happened.
export function recorderCoverage(bars,references,{day,now,rulesHash,startedAt=Math.min(...references.map(r=>r.created_at))}){
 const window=coverageWindow({day,now,startedAt});
 const stored=new Map(bars.map(b=>[b.t+R.interval,b]));
 const cohorts=referenceCohorts(references).map(c=>({...c,histories:c.rows.map(row=>{const points=row.history??JSON.parse(row.state_json).history;return {row,points,index:new Map(points.map(p=>[p.t,p]))};})}));
 const at=close=>cohorts.find(c=>c.histories.length===3&&c.histories.every(({row,points})=>row.created_at<close&&row.ends_at>=close&&((row.history_length??points.length)<4032||(row.first_close??points[0]?.t)<=close)));
 const closes=[];let comparable=0;
 for(let close=(Math.floor(window.from/R.interval)+1)*R.interval;close<=window.until;close+=R.interval){
  const b=stored.get(close),inGrace=now-close<=R.maxDelay;
  const receipt=b?(b.fresh===1&&b.observed_at>=close&&b.observed_at-close<=R.maxDelay?'on-time':'late'):inGrace?'waiting':'missing';
  const cohort=at(close),saved=cohort?.histories.map(h=>h.index.get(close));
  if(cohort)comparable++;
  const execution=!cohort?'missing':saved.every(Boolean)?saved.every(p=>p.actionable===true)?'actionable':'valuation-only':inGrace?'waiting':'missing';
  closes.push({close,receipt,delayMs:b?b.observed_at-close:null,execution});
 }
 const available=comparable>0||closes.length===0&&cohorts.some(c=>c.histories.length===3);
 if(!available)for(const close of closes)close.execution='unavailable';
 const count=(field,value)=>closes.filter(c=>c[field]===value).length;
 return {...window,checkedAt:now,startedAt,rulesHash,interval:R.interval,maxDelayMs:R.maxDelay,expected:closes.length,
  receipt:{onTime:count('receipt','on-time'),late:count('receipt','late'),missing:count('receipt','missing'),waiting:count('receipt','waiting')},
  reference:{available,watches:Math.min(3,references.length),actionable:available?count('execution','actionable'):null,valuationOnly:available?count('execution','valuation-only'):null,missing:available?count('execution','missing'):null,waiting:available?count('execution','waiting'):null},closes,
  referenceCohorts:cohorts.map(c=>({key:c.key,createdAt:c.createdAt,endsAt:c.endsAt,ids:c.rows.map(r=>r.id).filter(Boolean)})),
  note:'Receipt is when a candle was first saved. Usable means all three public preset watches saved an actionable decision. Each close uses the dated cohort active then; renewal warmup and gaps remain missing. A timely receipt can still be unusable after interrupted execution. This view cannot identify the cause, prove uptime, or determine Daily Tide ranks. Late or missing closes cannot create catch-up fills.'};
}
export function createRecorderCoverage({rulesHash,now=Date.now}){
 return {async read({db,env,url}){
  if(env.PAPER_ENABLED!=='1')throw new HttpError(404,'Paper watches are not enabled here.');
  const day=url.searchParams.get('day');if(day!==null)recapDay(day);
  const first=await db.prepare('SELECT MIN(created_at) AS started_at FROM wp_paper_runs WHERE wallet IS NULL AND rules_hash=?').bind(rulesHash).first();
  if(first?.started_at===null||first?.started_at===undefined)throw new HttpError(503,'The recorder is preparing its first public watches. Try again shortly.');
  const t=now(),window=coverageWindow({day,now:t,startedAt:first.started_at});
  const references=(await db.prepare("SELECT id,input_json,created_at,ends_at,json_array_length(state_json,'$.history') AS history_length,json_extract(state_json,'$.history[0].t') AS first_close FROM wp_paper_runs WHERE wallet IS NULL AND rules_hash=? AND created_at<=? AND ends_at>? ORDER BY created_at,id LIMIT 9").bind(rulesHash,window.until,window.from).all()).results;
  const bars=(await db.prepare('SELECT t,observed_at,fresh FROM wp_paper_bars WHERE t>=? AND t<? ORDER BY t LIMIT 288').bind(Math.floor(window.from/R.interval)*R.interval,Math.floor(window.until/R.interval)*R.interval).all()).results;
  // Filter each bounded public history in D1 so the Worker never parses fourteen
  // days of equity/agent state to present one day of decision flags.
  const compact=references.length?(await db.prepare("SELECT r.id,json_extract(p.value,'$.t') AS t,json_extract(p.value,'$.actionable') AS actionable FROM wp_paper_runs r,json_each(r.state_json,'$.history') p WHERE r.id IN ("+references.map(()=>'?').join(',')+") AND json_extract(p.value,'$.t')>? AND json_extract(p.value,'$.t')<=? ORDER BY r.id,t LIMIT 2592").bind(...references.map(r=>r.id),window.from,window.until).all()).results:[];
  for(const r of references)r.history=compact.filter(p=>p.id===r.id).map(p=>({t:p.t,actionable:p.actionable===1}));
  return recorderCoverage(bars,references,{day:window.day,now:t,rulesHash,startedAt:first.started_at});
 }};
}
