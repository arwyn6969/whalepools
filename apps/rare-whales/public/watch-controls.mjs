import {companyId} from './company-share.mjs';

// A read-only description. The server remains responsible for authorising Stop.
export function stopReview(run, wallet) {
 if(!wallet||run?.owner!==wallet||run.status!=='running'||!companyId(run.id)||!Number.isFinite(run.stats?.equity)||!Array.isArray(run.agents))return null;
 return {
  id:run.id,wallet,nickname:run.nickname,equity:run.stats.equity,
  lastValuation:run.history?.at(-1)?.t??null,
  positions:run.agents.filter(a=>a.qty>0).length,
  queued:run.agents.filter(a=>a.pending).length
 };
}

export function followUpMessage(run) {
 if(!['stopped','completed'].includes(run?.status))return '';
 return `${run.status==='stopped'?'Your watch has stopped':'Your watch has finished'}. Its dated public record stays in My dated watches. Choose your next crew and style below; Start creates a separate 14-day record with a fresh $1,000 paper budget.`;
}
