// Original, transparent research rules. No external dependencies; no order execution.
export const DEFAULTS = Object.freeze({equity:1000,risk:0.25,fee:0.08,slippage:0.05,allocation:25,mode:'trend',decimals:5});
export function normalize(rows,now=Date.now()) {
  if(!Array.isArray(rows))throw Error('Invalid candle response');
  const seen=new Set();
  return rows.map(r=>({t:+r.t,T:+r.T,o:+r.o,h:+r.h,l:+r.l,c:+r.c,v:+r.v})).filter(r=>{
    const ok=Object.values(r).every(Number.isFinite)&&r.T<now&&r.t<=r.T&&r.l>0&&r.h>=Math.max(r.o,r.c)&&r.l<=Math.min(r.o,r.c)&&r.v>=0&&!seen.has(r.t);
    if(ok)seen.add(r.t);return ok;
  }).sort((a,b)=>a.t-b.t);
}
export function enrich(bars){
  let e50,e200,atr;const out=[];
  for(let i=0;i<bars.length;i++){
    const b=bars[i],tr=Math.max(b.h-b.l,i?Math.abs(b.h-bars[i-1].c):0,i?Math.abs(b.l-bars[i-1].c):0);
    e50=i?e50+(b.c-e50)*2/51:b.c;e200=i?e200+(b.c-e200)*2/201:b.c;
    atr=i?((atr*13+tr)/14):tr;
    const prev=bars.slice(Math.max(0,i-10),i),avg=i>=10?prev.reduce((s,x)=>s+x.v,0)/10:0;
    const maxVS=i>=10?Math.max(...prev.map(x=>(x.h-x.l)*x.v)):Infinity;
    const rv=avg>0?b.v/avg:0,climax=avg>0&&b.v>0&&(rv>=2||(b.h-b.l)*b.v>=maxVS);
    const vector=climax||rv>=1.5;
    out.push({...b,e50,e200,atr,rv,climax,vector,up:b.c>b.o,index:i});
  }return out;
}
export function regime(bars,i){
  if(i<200)return 'warmup';const b=bars[i];
  if(b.c>b.e50&&b.e50>b.e200&&b.e50>bars[i-3].e50&&(b.e50-b.e200)>=0.25*b.atr)return 'uptrend';
  if(b.c<b.e50&&b.e50<b.e200&&b.e50<bars[i-3].e50&&(b.e200-b.e50)>=0.25*b.atr)return 'downtrend';
  return 'mixed';
}
export function plan(entry,stop,target,settings=DEFAULTS){
  const c={...DEFAULTS,...settings};
  if(![entry,stop,target,c.equity,c.risk,c.fee,c.slippage,c.allocation,c.decimals].every(Number.isFinite))return {valid:false,error:'Use finite numeric values.'};
  if(!(stop>0&&entry>stop&&target>entry))return {valid:false,error:'For a long: stop < entry < target, all above zero.'};
  if(!(c.equity>0&&c.risk>0&&c.risk<=1&&c.fee>=0&&c.fee<=50&&c.slippage>=0&&c.slippage<=50&&c.allocation>0&&c.allocation<=100&&c.decimals>=0&&c.decimals<=10))return {valid:false,error:'Check equity, risk (0–1%), costs (0–50%) and allocation (1–100%).'};
  const f=c.fee/100,s=c.slippage/100,entryFill=entry*(1+s),stopFill=stop*(1-s),targetFill=target*(1-s);
  const unitCost=entryFill*(1+f),unitLoss=unitCost-stopFill*(1-f),unitGain=targetFill*(1-f)-unitCost;
  const scale=10**c.decimals,qty=Math.floor(Math.min(c.equity*c.risk/100/unitLoss,c.equity*c.allocation/100/unitCost)*scale)/scale;
  if(!(qty>0&&Number.isFinite(qty)))return {valid:false,error:'Position is smaller than this market’s quantity step.'};
  return {valid:true,qty,entry,stop,target,entryFill,stopFill,targetFill,unitCost,unitLoss,unitGain,notional:qty*entry,cash:qty*unitCost,loss:qty*unitLoss,gain:qty*unitGain,rr:unitGain/unitLoss,settings:c};
}
export function buildSignals(raw,contextRaw,mode='trend',researchOptions={}){
  const {volumeGate='standard',patternStart=-Infinity}=researchOptions;
  if(!['standard','none'].includes(volumeGate))throw Error('Unknown volume gate.');
  const bars=enrich(raw),higher=enrich(contextRaw),signals=[],states=[];let hi=-1,trend=null,sweep=null;
  for(let i=0;i<bars.length;i++){
    const b=bars[i];while(hi+1<higher.length&&higher[hi+1].T<=b.T)hi++;
    const bias=regime(higher,hi);let signal=null;
    // Missing chart/context intervals invalidate pending patterns. Never join a setup across a gap.
    const chartGap=i>0&&b.t-bars[i-1].t!==bars[i-1].T-bars[i-1].t+1;
    const contextStale=hi<1||b.T-higher[hi].T>2*(higher[hi].t-higher[hi-1].t);
    if(chartGap||contextStale){trend=null;sweep=null;}
    if(i>=200&&bias!=='warmup'&&!chartGap&&!contextStale){
      if(trend&&(i-trend.i>8||b.c<trend.low||bias!=='uptrend'))trend=null;
      if(sweep&&(i-sweep.i>5||b.c<sweep.low||bias==='downtrend'))sweep=null;
      if(mode!=='recovery'&&trend&&i>trend.i&&b.l<=trend.mid&&b.h>=trend.mid&&b.c>trend.mid&&b.c>b.o&&b.c>b.e50){
        const stop=Math.min(trend.low,b.l)-.2*b.atr,distance=b.c-stop;
        if(distance>0&&distance<=4*b.atr)signal={i,t:b.T+1,kind:'Trend retest',entry:b.c,stop,target:b.c+2.5*distance,bias};
        trend=null;
      }
      if(!signal&&mode!=='trend'&&sweep&&i>sweep.i&&b.c>sweep.high){
        let target=Infinity;
        for(let j=Math.max(10,i-100);j<sweep.i;j++){
          const v=bars[j],mid=(v.o+v.c)/2;
          if(v.vector&&!v.up&&mid>b.c&&mid<target&&!bars.slice(j+1,i+1).some(x=>x.h>=mid))target=mid;
        }
        const stop=sweep.low-.2*b.atr;
        if(Number.isFinite(target)&&b.c>stop&&b.c-stop<=4*b.atr)signal={i,t:b.T+1,kind:'Sweep & recovery',entry:b.c,stop,target,bias};
        sweep=null;
      }
      if(signal)signals.push(signal);
      if(mode!=='recovery'&&bias==='uptrend'&&b.t>=patternStart&&(volumeGate==='none'||b.vector)&&b.up&&b.c>b.e50&&b.c>Math.max(...bars.slice(i-10,i).map(x=>x.h)))trend={i,low:b.l,mid:(b.o+b.c)/2};
      const prevLow=Math.min(...bars.slice(i-20,i).map(x=>x.l));
      if(mode!=='trend'&&bias!=='downtrend'&&b.t>=patternStart&&(volumeGate==='none'||b.climax)&&!b.up&&b.c<b.o&&b.l<prevLow&&b.c>prevLow&&(Math.min(b.o,b.c)-b.l)/(b.h-b.l)>=.35)sweep={i,low:b.l,high:b.h};
    }
    states.push({bias,contextIndex:hi,armed:trend?'Trend pullback pending':sweep?'Sweep confirmation pending':null,signal,contextStale});
  }return {bars,higher,signals,states};
}
// Unrecovered body zones, trimmed by subsequent highs/lows. Historical candle volume is a ranking proxy,
// not resting liquidity. The full volume remains attached to a partially recovered zone.
export function zones(bars,body=true,maxAge=500){
  const active=[];
  for(let i=Math.max(10,bars.length-maxAge);i<bars.length;i++){
    const b=bars[i];for(let j=active.length-1;j>=0;j--){const z=active[j];if(z.up){if(b.l<=z.lo)active.splice(j,1);else if(b.l<z.hi)z.hi=b.l;}else{if(b.h>=z.hi)active.splice(j,1);else if(b.h>z.lo)z.lo=b.h;}}
    if(b.vector&&b.c!==b.o){const lo=body?Math.min(b.o,b.c):b.l,hi=body?Math.max(b.o,b.c):b.h;if(hi>lo)active.push({lo,hi,originalLo:lo,originalHi:hi,mid:(lo+hi)/2,up:b.up,v:b.v,quoteProxy:b.v*(b.h+b.l+b.c)/3,t:b.t,index:i,rv:b.rv});}
  }
  const last=bars.at(-1)?.c||0;return active.map(z=>({...z,remaining:(z.hi-z.lo)/(z.originalHi-z.originalLo),side:z.lo>=last?'above':z.hi<=last?'below':'at price'}));
}
export function summarize(trades,startEquity,equityPoints){
  const pnl=trades.reduce((s,t)=>s+t.pnl,0),wins=trades.filter(t=>t.pnl>0),losses=trades.filter(t=>t.pnl<0),gp=wins.reduce((s,t)=>s+t.pnl,0),gl=-losses.reduce((s,t)=>s+t.pnl,0);
  let peak=startEquity,dd=0;for(const p of equityPoints){peak=Math.max(peak,p.equity);dd=Math.max(dd,(peak-p.equity)/peak*100);}
  return {count:trades.length,pnl,returnPct:pnl/startEquity*100,winRate:trades.length?wins.length/trades.length*100:0,avgR:trades.length?trades.reduce((s,t)=>s+t.r,0)/trades.length:0,profitFactor:gl?gp/gl:null,maxDrawdown:dd,endEquity:startEquity+pnl};
}
export function backtest(model,settings={},start=200,end=model.bars.length){
  const cfg={...DEFAULTS,...settings},bars=model.bars,signalMap=new Map(model.signals.map(s=>[s.i,s]));
  let cash=cfg.equity,pos=null,day='',dayStart=cash,dayPnl=0,losses=0,skipped=0;const trades=[],curve=[];
  for(let i=Math.max(start,1);i<Math.min(end,bars.length);i++){
    const b=bars[i],today=new Date(b.t).toISOString().slice(0,10);if(today!==day){day=today;dayStart=cash+(pos?pos.qty*bars[i-1].c:0);dayPnl=0;losses=0;}
    const signal=signalMap.get(i-1);
    const gap=b.t-bars[i-1].t>1.5*(bars[i-1].T-bars[i-1].t+1);
    if(!pos&&signal&&i-1>=start&&!gap&&losses<2&&dayPnl>-.01*dayStart){
      const p=plan(b.o,signal.stop,signal.target,{...cfg,equity:cash});
      if(p.valid&&p.rr>=1.5&&b.o>signal.stop&&b.o<signal.target&&Math.abs(b.o-signal.entry)<=.25*bars[i-1].atr){pos={...p,signal,entryIndex:i,entryTime:b.t};cash-=p.cash;}else skipped++;
    }
    if(pos){
      let exit=null,reason='';
      if(b.o<=pos.stop){exit=b.o;reason='Stop gap';}
      else if(b.o>=pos.target){exit=pos.target;reason='Target';}
      else if(i-pos.entryIndex>=24){exit=b.o;reason='Time exit';}
      else if(b.l<=pos.stop){exit=pos.stop;reason=b.h>=pos.target?'Stop (both touched)':'Stop';}
      else if(b.h>=pos.target){exit=pos.target;reason='Target';}
      if(i===end-1&&exit===null){exit=b.c;reason='Sample end';}
      if(exit!==null){const exitFill=exit*(1-cfg.slippage/100),proceeds=pos.qty*exitFill*(1-cfg.fee/100),pnl=proceeds-pos.cash;cash+=proceeds;dayPnl+=pnl;if(pnl<0)losses++;trades.push({kind:pos.signal.kind,entryTime:pos.entryTime,exitTime:(reason==='Stop gap'||reason==='Time exit'||(reason==='Target'&&b.o>=pos.target))?b.t:b.T+1,exitTimePrecision:(reason==='Stop gap'||reason==='Time exit'||(reason==='Target'&&b.o>=pos.target))?'open':'bar close proxy',entry:pos.entryFill,exit:exitFill,entryReference:pos.entry,exitReference:exit,riskCash:pos.loss,stop:pos.stop,target:pos.target,qty:pos.qty,pnl,r:pnl/pos.loss,reason});pos=null;}
    }
    // Liquidation-value close equity includes estimated exit fee and slippage, not just closed P/L.
    curve.push({t:b.T+1,equity:cash+(pos?pos.qty*b.c*(1-cfg.slippage/100)*(1-cfg.fee/100):0)});
  }
  return {trades,curve,skipped,stats:summarize(trades,cfg.equity,curve)};
}
