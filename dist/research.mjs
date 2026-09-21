// Descriptive, matched-event research. These statistics are not trading returns.
export function auditCandles(bars,interval){
  let gaps=0,missing=0,irregular=0;
  for(let i=0;i<bars.length;i++){
    if(bars[i].T-bars[i].t+1!==interval)irregular++;
    if(i){const d=bars[i].t-bars[i-1].t;if(d!==interval){gaps++;missing+=Math.max(0,Math.round(d/interval)-1);}}
  }
  return {count:bars.length,gaps,missing,irregular,start:bars[0]?.t??null,end:bars.at(-1)?.T??null};
}
export function recoveryOutcome(bars,i,horizon=24){
  const b=bars[i];if(!b||!Number.isInteger(horizon)||horizon<1||i+horizon>=bars.length||!(b.atr>0)||b.o===b.c)return null;
  const interval=b.T-b.t+1,up=b.c>b.o,half=(b.o+b.c)/2,full=b.o,adverse=b.c+(up?1:-1)*b.atr;
  let halfBars=null,fullBars=null,first=null,ambiguous=false;
  for(let k=1;k<=horizon;k++){
    const n=bars[i+k];if(n.t-bars[i+k-1].t!==interval)return null;
    const hitHalf=up?n.l<=half:n.h>=half,hitFull=up?n.l<=full:n.h>=full,hitAdverse=up?n.h>=adverse:n.l<=adverse;
    if(hitHalf&&halfBars===null)halfBars=k;if(hitFull&&fullBars===null)fullBars=k;
    if(first===null){
      const openHalf=up?n.o<=half:n.o>=half,openAdverse=up?n.o>=adverse:n.o<=adverse;
      if(openHalf)first='recovery';else if(openAdverse)first='adverse';
      else if(hitHalf&&hitAdverse){first='ambiguous';ambiguous=true;}
      else if(hitAdverse)first='adverse';else if(hitHalf)first='recovery';
    }
  }
  return {i,t:b.t,up,halfBars,fullBars,halfBeforeAdverse:first==='recovery',first,ambiguous};
}
function aggregate(events){
  const n=events.length,half=events.filter(e=>e.halfBars!==null),full=events.filter(e=>e.fullBars!==null),times=half.map(e=>e.halfBars).sort((a,b)=>a-b);
  const median=times.length?(times[Math.floor((times.length-1)/2)]+times[Math.ceil((times.length-1)/2)])/2:null;
  return {count:n,halfRate:n?half.length/n:null,fullRate:n?full.length/n:null,halfBeforeAdverseRate:n?events.filter(e=>e.halfBeforeAdverse).length/n:null,ambiguous:events.filter(e=>e.ambiguous).length,medianBarsToHalf:median};
}
export function recoveryStudy(model,{horizon=24,direction='up',start=200,end=model.bars.length}={}){
  const bars=model.bars,ordinary=[],vectors=[];let censored=0,gapExcluded=0;
  const bucket=x=>x<.5?'0.25–0.5':x<1?'0.5–1':x<2?'1–2':'2+';
  for(let i=Math.max(200,start);i<Math.min(end,bars.length);i++){
    const b=bars[i],state=model.states[i],size=Math.abs(b.c-b.o)/b.atr;
    if(!state||state.bias==='warmup'||state.contextStale||!(size>=.25)||b.c===b.o)continue;
    if(direction==='up'&&!b.up||direction==='down'&&b.up)continue;
    if(i+horizon>=end){censored++;continue;}
    const outcome=recoveryOutcome(bars,i,horizon);if(!outcome){gapExcluded++;continue;}
    const event={...outcome,vector:b.vector,climax:b.climax,rv:b.rv,key:`${b.up}:${state.bias}:${bucket(size)}`,size,bias:state.bias};
    (b.vector?vectors:ordinary).push(event);
  }
  // Match without looking at outcomes; each ordinary candle is used only once.
  // Matching is descriptive and retrospective, not a tradable selection rule.
  const used=new Set(),pairs=[];
  for(const v of vectors){let best=null,distance=Infinity;
    for(const o of ordinary){if(used.has(o.i)||o.key!==v.key)continue;const d=Math.abs(o.t-v.t);if(d<=30*86400000&&d<distance){best=o;distance=d;}}
    if(best){used.add(best.i);pairs.push({vector:v,ordinary:best});}
  }
  const a=aggregate(pairs.map(p=>p.vector)),b=aggregate(pairs.map(p=>p.ordinary));
  const byRegime=['uptrend','mixed','downtrend'].map(bias=>{const group=pairs.filter(p=>p.vector.bias===bias);return {bias,vector:aggregate(group.map(p=>p.vector)),ordinary:aggregate(group.map(p=>p.ordinary))};});
  return {horizon,direction,start,end,byRegime,eligibleVectors:vectors.length,eligibleOrdinary:ordinary.length,unmatched:vectors.length-pairs.length,censored,gapExcluded,pairs,vector:a,ordinary:b,halfLift:a.count?a.halfRate-b.halfRate:null,firstLift:a.count?a.halfBeforeAdverseRate-b.halfBeforeAdverseRate:null,method:'Nearest-time unique control within 30 days, matched by direction, completed context regime, and body/ATR band. Overlapping observations; no causal or profitability claim.'};
}
// Reprice precisely the same historical entries/exits and quantities. No entry filtering or resizing.
export function sameTradeCostStress(trades,feePct,slippagePct,initialEquity){
  if(![feePct,slippagePct,initialEquity].every(Number.isFinite)||feePct<0||slippagePct<0||initialEquity<=0)throw Error('Invalid cost stress inputs.');
  const f=feePct/100,s=slippagePct/100;
  const repriced=trades.map(t=>{
    if(![t.entryReference,t.exitReference,t.riskCash].every(Number.isFinite))throw Error('Trade is missing its execution references. Re-run the test.');
    const pnl=t.qty*(t.exitReference*(1-s)*(1-f)-t.entryReference*(1+s)*(1+f));return {...t,pnl,r:pnl/t.riskCash};
  });
  const pnl=repriced.reduce((sum,t)=>sum+t.pnl,0),wins=repriced.filter(t=>t.pnl>0),losses=repriced.filter(t=>t.pnl<0),gain=wins.reduce((s,t)=>s+t.pnl,0),loss=-losses.reduce((s,t)=>s+t.pnl,0);
  return {trades:repriced,stats:{count:repriced.length,pnl,returnPct:pnl/initialEquity*100,avgR:repriced.length?repriced.reduce((s,t)=>s+t.r,0)/repriced.length:null,winRate:repriced.length?wins.length/repriced.length*100:null,profitFactor:loss?gain/loss:null},label:'Fixed trades and quantities; R uses each original planned loss.'};
}
export function overheadZone(bars,entry,target){
  if(!Number.isFinite(entry)||!Number.isFinite(target)||target<=entry)return null;
  return bars.filter(z=>z.hi>entry&&z.lo<target).sort((a,b)=>Math.max(entry,a.lo)-Math.max(entry,b.lo))[0]??null;
}
