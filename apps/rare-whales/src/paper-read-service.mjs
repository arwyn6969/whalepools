import {HttpError} from './api.mjs';
import {PAPER_RULES, paperStats} from './paper-engine.mjs';
import {referenceCohorts} from './reference-watches.mjs';
import {decodeArchiveCursor} from './fleet-social-service.mjs';

// Keep the historical rule identity and mutation service frozen. Only the read
// model changes: D1 returns the same last 288 points the API already exposes,
// rather than sending fourteen days of private engine state to the Worker.
const columns = "r.id,r.wallet,r.nickname,r.input_json,r.rules_hash,r.ownership_block,r.created_at,r.ends_at,r.status,json_remove(r.state_json,'$.history') AS state_json,json_array_length(r.state_json,'$.history') AS history_length,json_extract(r.state_json,'$.history[#-1]') AS last_point_json";
const start = "max(0,json_array_length(r.state_json,'$.history')-288)";
// json_each would scan 4032 virtual rows for each state at every UI refresh.
// Multi-path json_extract keeps row reads constant. D1 permits 32 function
// arguments, so each chunk contains at most 31 paths plus its input JSON.
const chunks = Array.from({length: 10}, (_, chunk) => {
  const paths = Array.from({length: Math.min(31, 288 - chunk * 31)}, (_, i) =>
    "'$.history['||(" + start + '+' + (chunk * 31 + i) + ")||']'");
  return 'json_extract(r.state_json,' + paths.join(',') + ') AS history_' + chunk;
}).filter((_, i) => i * 31 < 288);
export const paperReadColumns = ({history = true} = {}) => columns + (history ? ',' + chunks.join(',') : '');

export function projectPaperRead(row) {
  if (!row) return null;
  const state = JSON.parse(row.state_json), length = row.history_length;
  // paperStats only uses history.length and its last point. Preserve its exact
  // exposure denominator even though the response carries only one UTC day.
  const statsHistory = new Array(length);
  if (length) statsHistory[length - 1] = JSON.parse(row.last_point_json);
  const history = chunks.flatMap((_, i) => row['history_' + i] === undefined ? [] : JSON.parse(row['history_' + i])).slice(0, Math.min(288, length));
  return {id: row.id, nickname: row.nickname, owner: row.wallet, status: row.status,
    createdAt: row.created_at, endsAt: row.ends_at, rulesHash: row.rules_hash, ownershipBlock: row.ownership_block,
    stats: paperStats({...state, history: statsHistory}), observedBars: state.observedBars, gapBars: state.gapBars,
    history, agents: state.agents.map(a => ({collection: a.collection, tokenId: a.tokenId, preset: a.preset, profile: a.profile,
      qty: a.qty, cash: a.cash, entry: a.entry, stop: a.stop, target: a.target, action: a.action,
      pending: a.pending?.side ?? null, trades: a.tradeCount, realized: a.realized}))};
}

export function createPaperReadService({rulesHash, now = Date.now}) {
  const withEvents = async (db, row) => {
    const run = projectPaperRead(row);
    if (run) run.events = (await db.prepare('SELECT event_json FROM wp_paper_events WHERE run_id=? ORDER BY bar_t DESC,ordinal DESC LIMIT 30').bind(row.id).all()).results.map(e => JSON.parse(e.event_json)).reverse();
    return run;
  };
  const select = 'SELECT ' + paperReadColumns() + ' FROM wp_paper_runs r';
  return {async read({db, me, env, id}) {
    if (env.PAPER_ENABLED !== '1') return {enabled: false, rules: PAPER_RULES, rulesHash};
    if (id) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new HttpError(404, 'This paper company is unavailable.');
      const run = await withEvents(db, await db.prepare(select + ' WHERE r.id=?').bind(id).first());
      if (!run) throw new HttpError(404, 'This paper company is unavailable.');
      return {enabled: true, run};
    }
    const feed = await db.prepare('SELECT coin,last_ok,last_attempt,error,halted FROM wp_paper_feed WHERE id=1').first();
    const price = await db.prepare('SELECT t,c,observed_at FROM wp_paper_bars ORDER BY t DESC LIMIT 1').first();
    const metadata = (await db.prepare('SELECT id,input_json,created_at,ends_at FROM wp_paper_runs WHERE wallet IS NULL AND rules_hash=? ORDER BY created_at DESC,id LIMIT 15').bind(rulesHash).all()).results;
    const cohorts = referenceCohorts(metadata), latest = cohorts[0]?.rows ?? [];
    const labs = latest.length ? await Promise.all((await db.prepare(select + ' WHERE r.id IN (' + latest.map(() => '?').join(',') + ') ORDER BY r.id').bind(...latest.map(r => r.id)).all()).results.map(row => withEvents(db, row))) : [];
    const archived = cohorts.slice(1).flatMap(c => c.rows).slice(0, 12);
    const referenceArchive = archived.length ? (await db.prepare('SELECT ' + paperReadColumns({history: false}) + ' FROM wp_paper_runs r WHERE r.id IN (' + archived.map(() => '?').join(',') + ') ORDER BY r.created_at DESC,r.id').bind(...archived.map(r => r.id)).all()).results.map(row => {
      const run = projectPaperRead(row);
      return {id: run.id, nickname: run.nickname, status: run.status, createdAt: run.createdAt, endsAt: run.endsAt, rulesHash: run.rulesHash,
        stats: run.stats, lastObservation: row.history_length ? JSON.parse(row.last_point_json).t : null};
    }) : [];
    const own = me ? await db.prepare(select + ' WHERE r.wallet=? ORDER BY r.created_at DESC,r.id DESC LIMIT 1').bind(me.address).first() : null;
    return {enabled: true, rules: PAPER_RULES, rulesHash, serverTime: now(), feed: {...feed, price,
      stale: !price || now() - (price.t + PAPER_RULES.interval) > PAPER_RULES.interval + PAPER_RULES.maxDelay},
      labs, referenceArchive, me: me ? {address: me.address, run: await withEvents(db, own)} : null};
  }};
}

export function createPaperArchiveReadService() {
  return {async archive({db, me, env, url}) {
    if (env.PAPER_ENABLED !== '1') return {enabled: false, runs: [], next: null};
    if (!me) throw new HttpError(401, 'Sign in to see your own dated watch archive.');
    const cursor = decodeArchiveCursor(url.searchParams.get('cursor'));
    const query = 'SELECT ' + paperReadColumns({history: false}) + ' FROM wp_paper_runs r WHERE r.wallet=?' +
      (cursor ? ' AND (r.created_at<? OR (r.created_at=? AND r.id<?))' : '') + ' ORDER BY r.created_at DESC,r.id DESC LIMIT 11';
    const params = cursor ? [me.address, cursor.time, cursor.time, cursor.id] : [me.address];
    const rows = (await db.prepare(query).bind(...params).all()).results, visible = rows.slice(0, 10), last = visible.at(-1);
    return {enabled: true, address: me.address, runs: visible.map(row => {
      const run = projectPaperRead(row);
      return {id: run.id, nickname: run.nickname, rulesHash: run.rulesHash, createdAt: run.createdAt, endsAt: run.endsAt,
        status: run.status, stats: run.stats, lastObservation: row.history_length ? JSON.parse(row.last_point_json).t : null};
    }), next: rows.length > 10 ? btoa(JSON.stringify([last.created_at, last.id])) : null};
  }};
}
