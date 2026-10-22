import {PAPER_RULES,initialState} from './paper-engine.mjs';
import {NEUTRAL_PROFILE} from './dna.mjs';

export const REFERENCE_VERSION='whale-pools-neutral-reference-v1';
export function referenceCohortKey(row){
 const input=typeof row.input_json==='string'?JSON.parse(row.input_json):null;
 return input?.referenceVersion===REFERENCE_VERSION&&typeof input.referenceCohort==='string'?input.referenceCohort:'original';
}
export function referenceCohorts(rows){
 const groups=new Map();
 for(const row of rows){const key=referenceCohortKey(row);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 return [...groups].map(([key,items])=>({key,rows:items,createdAt:Math.min(...items.map(r=>r.created_at)),endsAt:Math.min(...items.map(r=>r.ends_at))})).sort((a,b)=>b.createdAt-a.createdAt||a.key.localeCompare(b.key));
}
const originalId=(hash,index)=>hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-8'+hash.slice(17,20)+'-'+String(index+1).padStart(12,'0');
async function datedId(hash,at,index){
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(REFERENCE_VERSION+'|'+hash+'|'+at+'|'+index)))].map(n=>n.toString(16).padStart(2,'0')).join('');
 return digest.slice(0,8)+'-'+digest.slice(8,12)+'-4'+digest.slice(13,16)+'-8'+digest.slice(17,20)+'-'+digest.slice(20,32);
}
// Renewal is a new prospective record. Existing IDs, times, states and gaps are
// never reset. One atomic statement creates all three, including after a crash.
export async function ensureReferenceWatches({db,rulesHash,now,lastT}){
 const rows=(await db.prepare("SELECT id,input_json,created_at,ends_at,status,COUNT(*) OVER () AS reference_count FROM wp_paper_runs WHERE wallet IS NULL AND rules_hash=? ORDER BY created_at DESC,id DESC LIMIT 6").bind(rulesHash).all()).results;
 const latest=referenceCohorts(rows)[0];
 if(latest){
  if(latest.rows.length!==3)throw Error('The saved public reference cohort needs review.');
  if(!latest.rows.every(r=>r.status==='completed'&&r.ends_at<=now))return {created:false};
 }
 const presets=Object.keys(PAPER_RULES.presets),ids=await Promise.all(presets.map((_,i)=>latest?datedId(rulesHash,now,i):originalId(rulesHash,i)));
 const cohort=ids[0],records=presets.map((preset,i)=>({
  id:ids[i],nickname:PAPER_RULES.presets[preset].name+' · preset watch'+(latest?' · '+new Date(now).toISOString().slice(0,10):''),
  input:latest?JSON.stringify({referenceVersion:REFERENCE_VERSION,referenceCohort:cohort,preset}):'{}',
  state:JSON.stringify(initialState([{collection:'rarewhales',tokenId:245+i,preset,profile:NEUTRAL_PROFILE}],now,lastT))
 }));
 // The count guard makes two contenders with different timestamps harmless:
 // once either statement creates its three rows the other's premise is false.
 const result=await db.prepare("INSERT OR IGNORE INTO wp_paper_runs(id,wallet,nickname,input_json,rules_hash,created_at,ends_at,status,state_json) SELECT json_extract(value,'$.id'),NULL,json_extract(value,'$.nickname'),json_extract(value,'$.input'),?,?,?,'running',json_extract(value,'$.state') FROM json_each(?) WHERE NOT EXISTS (SELECT 1 FROM wp_paper_runs WHERE wallet IS NULL AND rules_hash=? AND status='running') AND (SELECT COUNT(*) FROM wp_paper_runs WHERE wallet IS NULL AND rules_hash=?)=?").bind(rulesHash,now,now+PAPER_RULES.duration,JSON.stringify(records),rulesHash,rulesHash,rows[0]?.reference_count??0).run();
 return {created:result.meta.changes===3,cohort:latest?cohort:'original',ids};
}
