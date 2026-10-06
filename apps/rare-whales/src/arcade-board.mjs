import {HttpError,digest,policyRecord} from './api.mjs';
import {checkSeat,ownsAgents,chainClient} from './access.mjs';
import {validateRoster} from './dna.mjs';
import {COLLECTIONS,STRATEGIES} from './config.mjs';
import {scoreArcade} from './arcade-score.mjs';
const reject=(status,message)=>{throw new HttpError(status,message);};
const project=row=>row?{id:row.id,nickname:row.nickname,owner:row.wallet,collection:row.captain_collection,tokenId:row.captain_id,agents:JSON.parse(row.agents_json),stats:JSON.parse(row.stats_json),rank:row.rank??null,basis:'holder',ownershipBlock:row.ownership_block,updatedAt:row.updated_at,joinedAt:row.joined_at}:null;
function mutationFor(request){
 const raw=request.headers.get('x-whale-revision'),id=request.headers.get('x-whale-mutation');
 if(raw===null||! /^(0|[1-9][0-9]*)$/.test(raw)||!Number.isSafeInteger(Number(raw))||Number(raw)>=Number.MAX_SAFE_INTEGER||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||''))reject(400,'Reload your company before publishing or removing it. This request is missing a valid saved-entry version.');
 return {revision:Number(raw),id:id.toLowerCase(),token:crypto.randomUUID()};
}
async function commitMutation(db,season,wallet,mutation,write){
 // D1 batch executes sequentially as one transaction. The per-attempt token
 // ensures a failed CAS cannot reuse an earlier success with the same client ID.
 const result=await db.batch([
  db.prepare('INSERT OR IGNORE INTO rw_arcade_revisions(season,wallet,revision) VALUES (?,?,0)').bind(season,wallet),
  db.prepare('UPDATE rw_arcade_revisions SET revision=revision+1,mutation_id=?,commit_token=? WHERE season=? AND wallet=? AND revision=? AND (mutation_id IS NULL OR mutation_id<>?)').bind(mutation.id,mutation.token,season,wallet,mutation.revision,mutation.id),
  write(mutation.token)
 ]);
 if(result[1].meta.changes!==1)reject(409,'A newer company change is saved for this wallet. Check your saved entry, then review your draft and try again.');
 return {revision:mutation.revision+1,mutationId:mutation.id};
}
export function createArcadeBoard({season,scores,ruleHash,client:injectedClient,now=Date.now}){
 const meta={mode:'arcade',id:season.id,title:season.title,from:scores.from,until:scores.until,ruleHash,ranking:'net-return-1e-6-pct',ownership:'at-submission',minimumBalance:season.access.minimumBalance};
 return {
  async club(db,me){const row=me?await db.prepare('SELECT e.*,r.revision,r.mutation_id FROM rw_arcade_revisions r LEFT JOIN rw_arcade_entries e ON e.season=r.season AND e.wallet=r.wallet WHERE r.season=? AND r.wallet=?').bind(season.id,me.address).first():null;const legacy=me&&!row?await db.prepare('SELECT * FROM rw_arcade_entries WHERE season=? AND wallet=?').bind(season.id,me.address).first():null;const count=await db.prepare('SELECT COUNT(*) AS n FROM rw_arcade_entries WHERE season=?').bind(season.id).first();return {arcade:meta,season,collections:COLLECTIONS,strategies:STRATEGIES,registrationOpen:true,seats:count.n,me:me?{address:me.address,seat:project(row?.id?row:legacy),revision:row?.revision??0,mutationId:row?.mutation_id??null}:null};},
  async crew(db){const rows=await db.prepare('SELECT *, RANK() OVER (ORDER BY rank_score DESC) AS rank FROM rw_arcade_entries WHERE season=? ORDER BY rank_score DESC,updated_at,id LIMIT 100').bind(season.id).all();const count=await db.prepare('SELECT COUNT(*) AS n FROM rw_arcade_entries WHERE season=?').bind(season.id).first();return {arcade:meta,status:'arcade',hasPerformance:false,total:count.n,seats:rows.results.map(project)};},
  async handle({request,db,me,env,data}){
   const path=new URL(request.url).pathname,t=now();
   const mutation=path==='/api/seat'&&['POST','DELETE'].includes(request.method)?mutationFor(request):null;
   if(request.method==='DELETE'&&path==='/api/seat'){
    const saved=await commitMutation(db,season.id,me.address,mutation,token=>db.prepare('DELETE FROM rw_arcade_entries WHERE season=? AND wallet=? AND EXISTS (SELECT 1 FROM rw_arcade_revisions WHERE season=? AND wallet=? AND revision=? AND commit_token=?)').bind(season.id,me.address,season.id,me.address,mutation.revision+1,token));
    return {ok:true,...saved};
   }
   if(request.method!=='POST'||!['/api/seat','/api/eligibility'].includes(path))reject(404,'Not found.');
   let agents;try{agents=validateRoster(data.agents);}catch(e){reject(400,e.message);}
   if(!agents.length||agents.some(a=>a.tokenId<1))reject(400,'Add at least one whale NFT you own.');
   const collection=data.collection,tokenId=data.tokenId,captain=agents.find(a=>a.collection===collection&&a.tokenId===tokenId);
   if(!captain)reject(400,'Choose a captain from your company roster.');
   if(path==='/api/seat'){
    if(data.publish!==true)reject(400,'Confirm that your wallet, company, NFTs and score can appear publicly.');
    if(typeof data.nickname!=='string'||data.nickname.trim().length<2||data.nickname.trim().length>32||/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/.test(data.nickname))reject(400,'Use a company name of 2–32 characters without markup or control characters.');
    if(data.ruleHash!==ruleHash)reject(409,'The arcade rules changed. Reload before publishing your crew.');
   }
   const client=injectedClient||chainClient(env);let eligibility;
   try{eligibility=await checkSeat({address:me.address,collection,tokenId,season,client});if(eligibility.eligible&&!await ownsAgents({address:me.address,agents,block:eligibility.block,client}))reject(403,'Every NFT in your crew must belong to the signed-in wallet. Remove the example whales first.');}
   catch(e){if(e instanceof HttpError)throw e;const causes=[];for(let cause=e;cause&&causes.length<5;cause=cause.cause)causes.push({name:cause.name,code:cause.code,summary:String(cause.shortMessage||cause.details||cause.message||'').replace(/0x[0-9a-fA-F]{40,}/g,'[redacted]').replace(/https?:\/\/\S+/g,'[redacted]').slice(0,180)});console.error('arcade-ownership-failure',JSON.stringify(causes));reject(503,'NFT ownership could not be verified. Check your token numbers and try again. Your saved company has not changed.');}
   if(path==='/api/eligibility')return eligibility;
   if(!eligibility.eligible)reject(403,eligibility.reason||'This wallet does not qualify.');
   const computed=await scoreArcade(scores,agents),policyHash=await digest(JSON.stringify(policyRecord(season))+ruleHash);
   await db.prepare('INSERT OR IGNORE INTO rw_rule_locks(season,hash) VALUES (?,?)').bind(season.id,policyHash).run();
   const lock=await db.prepare('SELECT hash FROM rw_rule_locks WHERE season=?').bind(season.id).first();if(lock.hash!==policyHash)reject(409,'Published rules changed. A new arcade version is required.');
   const previous=await db.prepare('SELECT joined_at,id FROM rw_arcade_entries WHERE season=? AND wallet=?').bind(season.id,me.address).first();
   const saved=await commitMutation(db,season.id,me.address,mutation,token=>db.prepare('INSERT INTO rw_arcade_entries(season,wallet,id,nickname,captain_collection,captain_id,agents_json,stats_json,rank_score,ownership_block,rule_hash,joined_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM rw_arcade_revisions WHERE season=? AND wallet=? AND revision=? AND commit_token=?) ON CONFLICT(season,wallet) DO UPDATE SET nickname=excluded.nickname,captain_collection=excluded.captain_collection,captain_id=excluded.captain_id,agents_json=excluded.agents_json,stats_json=excluded.stats_json,rank_score=excluded.rank_score,ownership_block=excluded.ownership_block,rule_hash=excluded.rule_hash,updated_at=excluded.updated_at').bind(season.id,me.address,previous?.id||crypto.randomUUID(),data.nickname.trim(),collection,tokenId,JSON.stringify(computed.agents),JSON.stringify(computed.stats),computed.rankScore,eligibility.block,ruleHash,previous?.joined_at||t,t,season.id,me.address,mutation.revision+1,token));
   return {ok:true,stats:computed.stats,...saved};
  }
 };
}
