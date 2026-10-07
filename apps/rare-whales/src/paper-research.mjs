import {PAPER_RULES as R,initialState,stepPaper,paperStats} from './paper-engine.mjs';
import {NEUTRAL_PROFILE} from './dna.mjs';
export function buildPaperResearch(sample,ruleHash,dataSha256){
 const results={};
 for(const preset of Object.keys(R.presets)){
  let state=initialState([{collection:'rarewhales',tokenId:245,preset,profile:NEUTRAL_PROFILE}],sample.from,sample.from-R.interval),fills=0,fees=0,slippage=0;
  for(let i=0;i<sample.bars.length;i++){
   const b=sample.bars[i];if(b.t<sample.from||b.t>=sample.until)continue;
   const now=b.t+R.interval+1000,step=stepPaper(state,{...b,observed_at:now,fresh:1},sample.bars.slice(Math.max(0,i-99),i+1),now);state=step.state;fills+=step.events.length;for(const e of step.events){fees+=e.fee;slippage+=Math.abs(e.price-b.c)*e.qty;}
  }
  results[preset]={...paperStats(state),fills,fees,slippage,observedBars:state.observedBars,gapBars:state.gapBars};
 }
 return {kind:'inspected-development-backtest',ruleHash,from:sample.from,until:sample.until,market:sample.market,source:sample.source,dataSha256,bars:sample.bars.length,results,disclosure:'New simplified paper presets on recently inspected history. Reconstructed close observations assume timely arrival; this does not reproduce live outages, order-book fills or demonstrate profitability. No parameter optimisation or independent holdout is claimed.'};
}
