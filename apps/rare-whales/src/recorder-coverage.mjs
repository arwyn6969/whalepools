import {HttpError} from './api.mjs';
import {recapDay} from './watch-recap.mjs';
import {PAPER_RULES as R} from './paper-engine.mjs';
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
export function recorderCoverage(bars,references,{day,now,rulesHash}){
 const startedAt=Math.min(...references.map(r=>r.created_at)),window=coverageWindow({day,now,startedAt});
 const stored=new Map(bars.map(b=>[b.t+R.interval,b]));
 const histories=references.map(r=>({row:r,points:r.history??JSON.parse(r.state_json).history}));
 const available=histories.length===3&&histories.every(({row,points})=>row.created_at<=window.from&&row.ends_at>=window.until&&((row.history_length??points.length)<4032||(row.first_close??points[0]?.t)<=window.from+R.interval));
 const points=histories.map(h=>new Map(h.points.map(p=>[p.t,p])));
 const closes=[];
 for(let close=(Math.floor(window.from/R.interval)+1)*R.interval;close<=window.until;close+=R.interval){
  const b=stored.get(close),inGrace=now-close<=R.maxDelay;
  const receipt=b?(b.fresh===1&&b.observed_at>=close&&b.observed_at-close<=R.maxDelay?'on-time':'late'):inGrace?'waiting':'missing';
  const saved=points.map(p=>p.get(close));
  const execution=!available?'unavailable':saved.every(Boolean)?saved.every(p=>p.actionable===true)?'actionable':'valuation-only':inGrace?'waiting':'missing';
  closes.push({close,receipt,delayMs:b?b.observed_at-close:null,execution});
 }
 const count=(field,value)=>closes.filter(c=>c[field]===value).length;
 return {...window,checkedAt:now,startedAt,rulesHash,interval:R.interval,maxDelayMs:R.maxDelay,expected:closes.length,
  receipt:{onTime:count('receipt','on-time'),late:count('receipt','late'),missing:count('receipt','missing'),waiting:count('receipt','waiting')},
  reference:{available,watches:references.length,actionable:available?count('execution','actionable'):null,valuationOnly:available?count('execution','valuation-only'):null,missing:available?count('execution','missing'):null,waiting:available?count('execution','waiting'):null},closes,
  note:'Receipt is when a candle was first saved. Usable means all three public preset watches saved an actionable decision. A timely receipt can still be unusable after interrupted execution. This view cannot identify the cause, prove uptime, or determine Daily Tide ranks. Late or missing closes cannot create catch-up fills.'};
}
export function createRecorderCoverage({rulesHash,now=Date.now}){
 return {async read({db,env,url}){
  if(env.PAPER_ENABLED!=='1')throw new HttpError(404,'Paper watches are not enabled here.');
  const day=url.searchParams.get('day');if(day!==null)recapDay(day);
  const references=(await db.prepare("SELECT id,created_at,ends_at,json_array_length(state_json,'$.history') AS history_length,json_extract(state_json,'$.history[0].t') AS first_close FROM wp_paper_runs WHERE wallet IS NULL AND rules_hash=? ORDER BY created_at,id LIMIT 3").bind(rulesHash).all()).results;
  if(!references.length)throw new HttpError(503,'The recorder is preparing its first public watches. Try again shortly.');
  const t=now(),window=coverageWindow({day,now:t,startedAt:Math.min(...references.map(r=>r.created_at))});
  const bars=(await db.prepare('SELECT t,observed_at,fresh FROM wp_paper_bars WHERE t>=? AND t<? ORDER BY t LIMIT 288').bind(Math.floor(window.from/R.interval)*R.interval,Math.floor(window.until/R.interval)*R.interval).all()).results;
  // Filter each bounded public history in D1 so the Worker never parses fourteen
  // days of equity/agent state to present one day of decision flags.
  const compact=(await db.prepare("SELECT r.id,json_extract(p.value,'$.t') AS t,json_extract(p.value,'$.actionable') AS actionable FROM wp_paper_runs r,json_each(r.state_json,'$.history') p WHERE r.id IN (?,?,?) AND json_extract(p.value,'$.t')>? AND json_extract(p.value,'$.t')<=? ORDER BY r.id,t LIMIT 864").bind(...Array.from({length:3},(_,i)=>references[i]?.id??''),window.from,window.until).all()).results;
  for(const r of references)r.history=compact.filter(p=>p.id===r.id).map(p=>({t:p.t,actionable:p.actionable===1}));
  return recorderCoverage(bars,references,{day:window.day,now:t,rulesHash});
 }};
}
