// Independently versioned forward simulator. Never imports or edits the frozen engine.
export const PAPER_RULES = Object.freeze({
 id:'whale-paper-v1', market:'UBTC / USDC', venue:'Hyperliquid spot', interval:300000,
 initialEquity:1000, fee:0.0008, slippage:0.0005, maxDelay:90000,
 duration:14*86400000, maxWhales:12, dailyLossLimit:0.01,
 execution:'Signal on an observed closed candle; fill at the next timely five-minute close. Close-only stops; no intrabar fills.',
 presets:{
  trend:{name:'Current Surfer',style:'Trend following',description:'Follow an established current. Exit when price falls below its short average.',stop:0.03},
  breakout:{name:'Cannonball',style:'Breakout',description:'Buy above the previous 20 highs. Exit below the previous 10 lows.',stop:0.03},
  recovery:{name:'Reef Reclaimer',style:'Mean reversion',description:'Buy a dip below the 20-bar average with RSI below 40. Exit on a return to the average.',stop:0.02}
 }
});
const ema=(values,n)=>values.reduce((v,x,i)=>i?v+(x-v)*2/(n+1):x,0);
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
export function signal(style,bars){
 if(!Object.hasOwn(PAPER_RULES.presets,style))throw Error('Unknown paper preset.');
 if(bars.length<51 || bars.slice(-51).some((b,i,a)=>i&&b.t!==a[i-1].t+PAPER_RULES.interval))return {buy:false,sell:false,reason:'Waiting for 51 continuous five-minute candles.'};
 const closes=bars.map(b=>b.c),price=closes.at(-1),e20=ema(closes,20),e50=ema(closes,50);
 if(style==='trend')return {buy:price>e20&&e20>e50,sell:price<e20,reason:price>e20&&e20>e50?'Price and short average confirm an upward current.':'Waiting for price above the short average and an upward current.'};
 if(style==='breakout')return {buy:price>Math.max(...bars.slice(-21,-1).map(b=>b.h)),sell:price<Math.min(...bars.slice(-11,-1).map(b=>b.l)),reason:price>Math.max(...bars.slice(-21,-1).map(b=>b.h))?'Price closed above the previous 20 highs.':'Waiting for a close above the previous 20 highs.'};
 const average=mean(closes.slice(-20)),changes=closes.slice(-15).slice(1).map((x,i)=>x-closes.slice(-15)[i]);
 const up=changes.reduce((v,x)=>v+Math.max(0,x),0),down=changes.reduce((v,x)=>v+Math.max(0,-x),0),rsi=down?100-100/(1+up/down):up?100:50;
 return {buy:price<average*0.99&&rsi<40,sell:price>=average,reason:price<average*0.99&&rsi<40?'A dip below the average has RSI below 40.':'Waiting for a 1% dip below the 20-bar average and RSI below 40.'};
}
export function initialState(agents,startAt,lastT){
 return {lastT,startAt,agents:agents.map(a=>({...a,cash:1000/agents.length,qty:0,pending:null,entry:0,stop:0,target:0,tradeCount:0,realized:0,day:null,dayPnl:0,action:'Waiting for the next new candle.'})),passive:null,peak:1000,maxDrawdown:0,gapBars:0,observedBars:0,exposureSum:0,history:[]};
}
const value=(a,price)=>a.cash+a.qty*price*(1-PAPER_RULES.slippage)*(1-PAPER_RULES.fee);
export function stepPaper(previous,bar,bars,now){
 const s=structuredClone(previous),r=PAPER_RULES,events=[];
 if(bar.t<=s.lastT)return {state:s,events};
 const timely=bar.fresh===1&&now-(bar.t+r.interval)<=r.maxDelay&&now>=bar.t+r.interval&&bar.t+r.interval>s.startAt;
 const continuous=s.lastT===bar.t-r.interval;
 const safe=timely&&continuous;
 if(!safe)s.gapBars++;
 if(timely)s.observedBars++;
 for(const [i,a] of s.agents.entries()){
  const day=Math.floor(bar.t/86400000);if(a.day!==day){a.day=day;a.dayPnl=0;}
  if(!safe){a.pending=null;a.action=timely?'Data gap: orders cancelled; rebuilding a continuous signal.':'Late or warmup candle: valuation only, no simulated fill.';continue;}
  if(a.pending?.side==='buy'&&!a.qty){
   const fill=bar.c*(1+r.slippage),equity=value(a,bar.c),stopDistance=r.presets[a.preset].stop;
   const spend=Math.min(a.cash,equity*a.profile.allocation/100,equity*a.profile.risk/100/stopDistance);
   if(spend>0&&a.dayPnl>-1000/s.agents.length*r.dailyLossLimit){a.qty=spend/(fill*(1+r.fee));a.cash-=spend;a.entry=fill;a.cost=spend;a.entryAt=now;a.stop=fill*(1-stopDistance);a.target=fill*(1+2*stopDistance*a.profile.targetMultiplier);events.push({agent:i,kind:'buy',at:now,price:fill,qty:a.qty,fee:a.qty*fill*r.fee,reason:a.pending.reason,signalAt:a.pending.at});}
  }else if(a.pending?.side==='sell'&&a.qty){
   const fill=bar.c*(1-r.slippage),proceeds=a.qty*fill*(1-r.fee),pnl=proceeds-a.cost;
   events.push({agent:i,kind:'sell',at:now,price:fill,qty:a.qty,fee:a.qty*fill*r.fee,pnl,reason:a.pending.reason,signalAt:a.pending.at});
   a.cash+=proceeds;a.qty=0;a.realized+=pnl;a.dayPnl+=pnl;a.tradeCount++;
  }
  a.pending=null;const decision=signal(a.preset,bars);
  if(a.qty){
   const reason=bar.c<=a.stop?'Close crossed the stop level.':bar.c>=a.target?'Close reached the DNA target.':decision.sell?'Preset exit condition confirmed.':null;
   if(reason)a.pending={side:'sell',reason,at:now};
   a.action=reason?'Exit queued for the next fresh close.':'Holding a paper position; watching the exit rules.';
  }else if(a.dayPnl<=-1000/s.agents.length*r.dailyLossLimit)a.action='Daily loss limit reached; resting until the next UTC day.';
  else{if(decision.buy)a.pending={side:'buy',reason:decision.reason,at:now};a.action=decision.buy?'Entry queued for the next fresh close.':decision.reason;}
 }
 if(safe&&!s.passive){const spent=250,fill=bar.c*(1+r.slippage);s.passive={cash:750,qty:spent/(fill*(1+r.fee)),at:now};}
 const equity=s.agents.reduce((v,a)=>v+value(a,bar.c),0),exposure=s.agents.reduce((v,a)=>v+a.qty*bar.c,0)/Math.max(equity,1);
 s.peak=Math.max(s.peak,equity);s.maxDrawdown=Math.max(s.maxDrawdown,(s.peak-equity)/s.peak*100);s.exposureSum+=exposure;
 s.history.push({t:bar.t+r.interval,observedAt:bar.observed_at,equity,hold:s.passive?value(s.passive,bar.c):1000,price:bar.c,actionable:safe});
 s.history=s.history.slice(-4032);s.lastT=bar.t;
 return {state:s,events};
}
export function paperStats(s){const last=s.history.at(-1);return {equity:last?.equity??1000,returnPct:((last?.equity??1000)/1000-1)*100,maxDrawdown:s.maxDrawdown,hold:last?.hold??1000,cash:1000,trades:s.agents.reduce((n,a)=>n+a.tradeCount,0),exposure:s.history.length?s.exposureSum/s.history.length*100:0};}
