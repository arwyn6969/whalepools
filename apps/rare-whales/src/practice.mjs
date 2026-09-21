import { buildSignals, backtest } from '../../../dist/engine.mjs';

export function buildPractice({bars,context,protocol,sourceHashes}) {
  const from=Date.parse(protocol.historicalStart),until=Date.parse(protocol.historicalEndExclusive);
  const raw=bars.filter(b=>b.T<until),higher=context.filter(b=>b.T<until);
  const start=raw.findIndex(b=>b.t>=from);
  if(start<200 || higher.length<205)throw Error('Practice data needs the complete historical warmup.');
  const settings={...protocol.settings,decimals:5},strategies={},replay={signals:{}};
  const projected=run=>({trades:run.trades,curve:run.curve,stats:run.stats,skipped:run.skipped});
  for(const mode of ['trend','recovery']) {
    const model=buildSignals(raw,higher,mode,{patternStart:from});
    const control=buildSignals(raw,higher,mode,{volumeGate:'none',patternStart:from});
    replay.bars=model.bars.slice(start-1).map(({t,T,o,h,l,c,atr})=>({t,T,o,h,l,c,atr}));
    replay.signals[mode]=model.signals.filter(s=>s.i>=start).map(s=>({...s,i:s.i-start+1}));
    strategies[mode]={...projected(backtest(model,settings,start,raw.length)),control:projected(backtest(control,settings,start,raw.length)),signals:model.signals.filter(s=>s.t>=from),states:model.states.slice(start).map((s,i)=>({t:raw[start+i].T+1,bias:s.bias,armed:s.armed,confirmed:!!s.signal,unavailable:s.contextStale})),bars:model.bars.slice(start).map(({t,T,o,h,l,c,v,vector,climax})=>({t,T,o,h,l,c,v,vector,climax}))};
  }
  const f=settings.fee/100,s=settings.slippage/100,budget=settings.equity*settings.allocation/100;
  const qty=budget/(raw[start].o*(1+s)*(1+f));
  const hold=raw.slice(start).map(b=>({t:b.T+1,equity:settings.equity-budget+qty*b.c*(1-s)*(1-f)}));
  return {kind:'historical-practice',market:'UBTC / USDC',venue:'Hyperliquid spot',from,until,settings,sourceHashes,strategies,replay,hold,holdLabel:'Hold 25% / keep 75% cash',disclosure:'Reconstructed historical simulations on previously inspected data. These are not season results, real fills, Robinhood token returns or evidence of a profitable edge.'};
}
