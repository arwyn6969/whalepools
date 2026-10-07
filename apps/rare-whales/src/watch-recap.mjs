import {HttpError} from './api.mjs';
import {PAPER_RULES as R} from './paper-engine.mjs';
import {companyId} from '../public/company-share.mjs';

const DAY=86400000;
const date=t=>new Date(t).toISOString().slice(0,10);
export function recapDay(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new HttpError(400,'Choose a saved UTC day.');
 const t=Date.parse(value+'T00:00:00Z');
 if(!Number.isFinite(t)||date(t)!==value)throw new HttpError(400,'Choose a valid UTC day.');
 return t;
}
// A presentation of the saved ledger, never a replay or a change to execution.
export function watchRecap(row,events,{day,now,rulesHash}){
 const state=JSON.parse(row.state_json),history=state.history.slice(-4032),last=history.at(-1);
 const frozen=row.status!=='running'||row.rules_hash!==rulesHash;
 const until=Math.min(row.ends_at,now,row.status==='completed'?row.ends_at:frozen?(last?.t??row.created_at):now);
 const firstDay=Math.floor(row.created_at/DAY)*DAY,lastDay=Math.max(firstDay,Math.floor(Math.max(row.created_at,until-1)/DAY)*DAY);
 const days=Array.from({length:Math.min(15,1+(lastDay-firstDay)/DAY)},(_,i)=>date(firstDay+i*DAY)).reverse();
 const start=day===null?recapDay(days[0]):recapDay(day);
 if(!days.includes(date(start)))throw new HttpError(404,'This watch has no saved window for that day.');
 const from=Math.max(start,row.created_at),end=Math.min(start+DAY,until);
 const points=history.filter(p=>p.t>from&&p.t<=end);
 const previous=history.filter(p=>p.t<=from).at(-1);
 const baseline=previous??(from===row.created_at?{t:row.created_at,equity:R.initialEquity,hold:R.initialEquity}:null);
 const marked=points.at(-1),expected=Math.max(0,Math.floor(end/R.interval)-Math.floor(from/R.interval));
 const closes=new Set(points.map(p=>p.t));
 const fills=events.filter(e=>closes.has(e.bar_t+R.interval)).map(e=>JSON.parse(e.event_json)).filter(e=>e.kind==='buy'||e.kind==='sell');
 const buys=fills.filter(e=>e.kind==='buy').length,sells=fills.length-buys;
 const fees=fills.reduce((n,e)=>n+e.fee,0),knownRules=row.rules_hash===rulesHash;
 const slippage=knownRules?fills.reduce((n,e)=>n+e.qty*e.price/(1+(e.kind==='buy'?R.slippage:-R.slippage))*R.slippage,0):null;
 return {id:row.id,rulesHash:row.rules_hash,day:date(start),days,from,until:end,status:row.status,
  completeDay:start+DAY<=until,baselineAt:baseline?.t??null,lastValuation:marked?.t??null,
  balance:marked?.equity??null,change:marked&&baseline?marked.equity-baseline.equity:null,
  holdChange:marked&&baseline?marked.hold-baseline.hold:null,
  coverage:{recorded:points.length,actionable:points.filter(p=>p.actionable===true).length,expected,missing:Math.max(0,expected-points.length)},
  buys,sells,fees,slippage,ledgerComplete:events.length<=3456,
  // Only the day's last twelve actual fills, with counts/costs from the full day.
  events:fills.slice(-12).reverse().map(e=>({kind:e.kind,at:e.at,agent:e.agent,reason:e.reason,fee:e.fee,pnl:e.pnl})),
  note:'UTC days include candle closes after 00:00 through the next 00:00. Balance change includes marked open positions and modeled exit costs; it is not realized profit. Missing or late observations cannot invent trades.'};
}
export function createWatchRecaps({rulesHash,now=Date.now}){
 return {async read({db,env,id,url}){
  if(env.PAPER_ENABLED!=='1')throw new HttpError(404,'Paper watches are not enabled here.');
  if(!companyId(id))throw new HttpError(404,'That dated watch was not found.');
  const row=await db.prepare('SELECT id,rules_hash,created_at,ends_at,status,state_json FROM wp_paper_runs WHERE id=?').bind(id.toLowerCase()).first();
  if(!row)throw new HttpError(404,'That dated watch was not found.');
  const day=url.searchParams.get('day'),t=now();
  // Validate the requested/default window before its bounded indexed ledger read.
  const window=watchRecap(row,[],{day,now:t,rulesHash}),start=recapDay(window.day);
  const events=(await db.prepare('SELECT bar_t,event_json FROM wp_paper_events WHERE run_id=? AND bar_t>=? AND bar_t<? ORDER BY bar_t,ordinal LIMIT 3457').bind(id.toLowerCase(),start,start+DAY).all()).results;
  if(events.length>3456)throw new HttpError(503,'This day’s ledger needs review. The saved watch is kept.');
  return watchRecap(row,events,{day:window.day,now:t,rulesHash});
 }};
}
