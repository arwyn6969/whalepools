import {initialTide,tideId} from '../../src/daily-tide.mjs';
import {readFile} from 'node:fs/promises';
// Presentation cases only, inserted into the named disposable fixture database.
// Existing complete-round/runtime suites test actual execution separately.
export async function seedTideOutcomes(fixture){
 const rules=JSON.parse(await readFile(new URL('../../build/public/tide-rules.json',import.meta.url),'utf8'));
 const day=Math.floor(fixture.state.paperNow/86400000)*86400000;
 const ids={};
 for(const [kind,offset] of [['partial',1],['complete',2],['paused',3],...Array.from({length:5},(_,i)=>['older-'+i,4+i]),['archived',12]]){
  const start=day-offset*86400000,states=initialTide(start),complete=kind==='complete',paused=kind==='paused';
  for(const [i,s] of Object.values(states).entries()){
   const total=complete?288:274;
   s.observedBars=total;s.gapBars=complete?0:14;s.maxDrawdown=.2;s.lastT=start+86400000-300000;s.exposureSum=0;
   s.agents[0].cash=complete?1001+(i===2?0:1):999+i;s.agents[0].tradeCount=kind==='partial'?0:2;
   s.agents[0].action='Waiting for the next preset signal.';
   s.history=Array.from({length:complete?288:274},(_,j)=>({t:start+(j+1)*300000,observedAt:start+(j+1)*300000+1000,equity:s.agents[0].cash,hold:1000,price:200,actionable:true}));
  }
  const id=tideId(rules.ruleHash,start);ids[kind]=id;
  await fixture.db.prepare('INSERT INTO wp_tide_rounds(id,rules_hash,rules_json,starts_at,ends_at,created_at,status,quality,state_json) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,rules.ruleHash,JSON.stringify(rules),start,start+86400000,start-1000,paused?'paused':'completed',complete?'complete':'partial',JSON.stringify(states)).run();
 }
 ids.next=(await fixture.db.prepare("SELECT id FROM wp_tide_rounds WHERE status='queued' ORDER BY starts_at LIMIT 1").first()).id;
 return ids;
}
