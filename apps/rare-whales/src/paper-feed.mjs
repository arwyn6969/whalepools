import {PAPER_RULES} from './paper-engine.mjs';
const ENDPOINT='https://api.hyperliquid.xyz/info';
async function info(data,fetcher){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetcher(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),signal:controller.signal});
  if(!response.ok)throw Error('Market provider is unavailable.');
  const reader=response.body.getReader();let length=0,parts=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>524288){await reader.cancel();throw Error('Market response exceeded its limit.');}parts.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return JSON.parse(new TextDecoder().decode(bytes));
 }finally{clearTimeout(timer);}
}
export async function readPaperMarket({coin,now=Date.now(),fetcher=fetch}={}){
 if(!coin){
  const meta=await info({type:'spotMeta'},fetcher),tokens=meta.tokens;
  const btc=tokens?.find(t=>t.name==='UBTC'),usd=tokens?.find(t=>t.name==='USDC');
  const pair=meta.universe?.find(p=>p.tokens?.[0]===btc?.index&&p.tokens?.[1]===usd?.index);
  if(!btc||!usd||!pair||!Number.isSafeInteger(pair.index))throw Error('UBTC / USDC market could not be identified.');coin='@'+pair.index;
 }
 if(!/^@\d+$/.test(coin))throw Error('Invalid spot market.');
 const rows=await info({type:'candleSnapshot',req:{coin,interval:'5m',startTime:now-144*PAPER_RULES.interval,endTime:now}},fetcher);
 if(!Array.isArray(rows)||rows.length>160)throw Error('Invalid market candles.');
 const bars=rows.filter(b=>b.t+PAPER_RULES.interval<=now).map(b=>{
  const out={t:Number(b.t),o:Number(b.o),h:Number(b.h),l:Number(b.l),c:Number(b.c)};
  if(b.s!==coin||b.i!=='5m'||!Number.isSafeInteger(out.t)||out.t%PAPER_RULES.interval||Object.values(out).some(x=>!Number.isFinite(x))||Math.min(out.o,out.h,out.l,out.c)<=0||out.h<Math.max(out.o,out.c,out.l)||out.l>Math.min(out.o,out.c,out.h)||Number(b.T)!==out.t+PAPER_RULES.interval-1)throw Error('Invalid market candle.');
  return out;
 }).sort((a,b)=>a.t-b.t);
 if(!bars.length||new Set(bars.map(b=>b.t)).size!==bars.length)throw Error('Market candles are missing or duplicated.');
 return {coin,bars};
}
