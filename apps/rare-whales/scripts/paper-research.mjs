import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PAPER_RULES as R} from '../src/paper-engine.mjs';
import {readPaperMarket} from '../src/paper-feed.mjs';
import {buildPaperResearch} from '../src/paper-research.mjs';
const root=new URL('../research/',import.meta.url);await mkdir(root,{recursive:true});
const file=new URL('paper-v1-5m.json',root),refresh=process.argv.includes('--fetch');
let sample;
if(refresh){
 try{await readFile(file);throw Error('The v1 development archive already exists. Keep its fixed dates and checksum; use a new version for another sample.');}catch(e){if(e.code!=='ENOENT')throw e;}
 const cache=new URL('../work/paper-research-download.json',import.meta.url);let saved;try{saved=JSON.parse(await readFile(cache));}catch{}
 const until=saved?.until??Math.floor(Date.now()/R.interval)*R.interval,from=until-14*86400000,all=new Map(saved?.bars?.map(b=>[b.t,b])??[]);let coin=saved?.coin;
 for(let end=saved?.nextTime??from;end<=until;end=Math.min(end+144*R.interval,until)){
  let fetched;for(let retry=0;retry<3;retry++){try{fetched=await readPaperMarket({coin,now:end});break;}catch(e){if(retry===2)throw e;await new Promise(r=>setTimeout(r,1500));}}coin=fetched.coin;for(const b of fetched.bars)all.set(b.t,b);
  await writeFile(cache,JSON.stringify({until,coin,nextTime:Math.min(end+144*R.interval,until),bars:[...all.values()]}));
  console.log('Archived market window ending '+new Date(end).toISOString());if(end===until)break;
 }
 sample={source:'https://api.hyperliquid.xyz/info',market:R.market,coin,interval:'5m',retrievedAt:new Date().toISOString(),from,until,bars:[...all.values()].sort((a,b)=>a.t-b.t)};
 await writeFile(file,JSON.stringify(sample));
}else sample=JSON.parse(await readFile(file));
const raw=await readFile(file),dataHash=createHash('sha256').update(raw).digest('hex'),rules=JSON.parse(await readFile(new URL('../build/public/paper-rules.json',import.meta.url)));
const output=buildPaperResearch(sample,rules.ruleHash,dataHash);
await writeFile(new URL('../build/public/paper-research.json',import.meta.url),JSON.stringify(output));console.log(JSON.stringify(output,null,2));
