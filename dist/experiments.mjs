import {buildSignals,backtest} from './engine.mjs';
import {auditCandles,sameTradeCostStress} from './research.mjs';
const DECIMALS={UBTC:5,UETH:4,HYPE:2};
export function reviewArm(treatment,control,minimum=30){
  if(treatment.base.count<minimum||control.base.count<minimum)return 'insufficient';
  return treatment.base.pnl>0&&treatment.stress.pnl>0&&treatment.base.avgR>control.base.avgR&&treatment.stress.avgR>control.stress.avgR?'review':'unsupported';
}
export function evaluateMarket(bars,context,market,protocol,{period='historical',now=Date.now()}={}){
  if(!['historical','forward'].includes(period)||!Object.hasOwn(DECIMALS,market))throw Error('Unknown period or market.');
  const start=Date.parse(period==='forward'?protocol.forwardStart:protocol.historicalStart),end=Date.parse(period==='forward'?protocol.forwardEndExclusive:protocol.historicalEndExclusive);
  const result={market,period,start,end,status:'not-started',complete:false,experiments:[]};
  if(now<start)return result;
  // Never consume a future or unfinished candle, even if supplied by an imported dataset.
  const visible=bars.filter(b=>b.T<Math.min(now,end)),higher=context.filter(b=>b.T<Math.min(now,end));
  const health={chart:auditCandles(visible,3600000),context:auditCandles(higher,14400000)};
  if(health.chart.gaps||health.chart.irregular||health.context.gaps||health.context.irregular)return {...result,status:'data-gap',health};
  if(visible.filter(b=>b.T<start).length<200||higher.filter(b=>b.T<start).length<201)return {...result,status:'missing-warmup',health};
  const from=visible.findIndex(b=>b.t>=start);
  if(from<0)return {...result,status:'awaiting-candles',health};
  if(visible[from].t!==start)return {...result,status:'missing-start',health};
  const complete=visible.at(-1).T+1>=end;
  const cfg={...protocol.settings,decimals:DECIMALS[market]};
  const experiments=protocol.experiments.map(experiment=>{
    const arms={};
    for(const [name,volumeGate] of [['treatment','standard'],['control','none']]){
      const model=buildSignals(visible,higher,experiment.mode,{volumeGate,patternStart:start});
      const r=backtest(model,cfg,from,visible.length),stress=sameTradeCostStress(r.trades,cfg.fee*2,cfg.slippage*2,cfg.equity);
      arms[name]={base:r.stats,stress:stress.stats,trades:r.trades,skipped:r.skipped};
    }
    return {id:experiment.id,name:experiment.name,...arms,screen:reviewArm(arms.treatment,arms.control,protocol.minimumTradesPerArm)};
  });
  return {...result,status:complete?'window-complete':'in-progress',complete,health,observedThrough:visible.at(-1).T,settings:cfg,experiments};
}
export function protocolVerdict(results,protocol){
  return protocol.experiments.map(e=>{
    const primary=results.find(r=>r.market===protocol.primaryMarket),arm=primary?.experiments.find(x=>x.id===e.id);
    if(!primary?.complete||!arm)return {id:e.id,verdict:'incomplete'};
    if(arm.screen!=='review')return {id:e.id,verdict:arm.screen};
    const replication=results.filter(r=>protocol.replicationMarkets.includes(r.market)&&r.complete).some(r=>r.experiments.find(x=>x.id===e.id)?.screen==='review');
    return {id:e.id,verdict:replication?'review-candidate':'not-replicated'};
  });
}
