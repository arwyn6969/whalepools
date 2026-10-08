const DAY=86400000;
// Evidence gates require consecutive full saved days. A failed read is a gap in
// evidence, never a reason to skip forward to older apparently clean days.
export function diarySummary(results,{rulesHash,checkedAt}){
 const today=Math.floor(checkedAt/DAY)*DAY;
 const days=results.map(r=>{
  const start=Date.parse(r.day+'T00:00:00Z'),fullWindow=r.from===start&&r.expected===288;
  const clean=!r.error&&r.rulesHash===rulesHash&&r.completeDay===true&&fullWindow&&r.receipt?.onTime===288&&r.receipt.late+r.receipt.missing+r.receipt.waiting===0&&r.reference?.available===true&&r.reference.actionable===288&&r.reference.valuationOnly+r.reference.missing+r.reference.waiting===0;
  return {day:r.day,error:r.error??null,checkedAt:r.checkedAt??null,rulesHash:r.rulesHash??null,completeDay:r.completeDay??false,fullWindow,expected:r.expected??null,receipt:r.receipt??null,reference:r.reference??null,clean};
 });
 let expectedDay=today-DAY,consecutiveCleanDays=0;
 // Midnight's final close needs its delivery grace before the ending day can qualify.
 if(checkedAt-today<90000)expectedDay-=DAY;
 for(const r of days){const start=Date.parse(r.day+'T00:00:00Z');if(start>expectedDay)continue;if(start!==expectedDay||!r.clean)break;consecutiveCleanDays++;expectedDay-=DAY;}
 return {days,consecutiveCleanDays,sevenDayCoverageGate:consecutiveCleanDays>=7};
}
