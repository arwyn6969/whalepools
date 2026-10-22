// Disposable capacity instrumentation. Never deploy against staging/production
// data. Every route requires a separate CAPACITY_TOKEN secret. There are no crons.
// Load the compiled candidate after setting its clock so API/service defaults
// capture the same fixture clock as the actual Durable Object recorder.
let fixtureNow = Date.UTC(2026, 9, 20, 12) + 1000;
Date.now = () => fixtureNow;
// The unchanged market parser still parses and validates a normal response.
// Synthetic market data avoids trading on or sending load to a real provider.
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  if (request.url !== 'https://api.hyperliquid.xyz/info') throw Error('External I/O is disabled in the capacity fixture.');
  const data = await request.json();
  if (data.type === 'spotMeta') return Response.json({tokens: [{name: 'UBTC', index: 1}, {name: 'USDC', index: 0}], universe: [{index: 7, tokens: [1, 0]}]});
  const interval = 300000, latest = Math.floor(fixtureNow / interval) * interval - interval;
  return Response.json(Array.from({length: 100}, (_, i) => {
    const t = latest - (99 - i) * interval, p = 1000 + (t - Date.UTC(2026, 9, 20, 12)) / interval;
    return {t, T: t + interval - 1, s: '@7', i: '5m', o: String(p), h: String(p + .1), l: String(p - .1), c: String(p)};
  }));
};
const {default: worker, PaperRecorder: CandidateRecorder, PaperReadExecutor: CandidateReader} = await import('../build/paper-worker.mjs');
const {PAPER_RULES: rules, initialState} = await import('../src/paper-engine.mjs');
const {NEUTRAL_PROFILE} = await import('../src/dna.mjs');
const {default: paper} = await import('../build/public/paper-rules.json', {with: {type: 'json'}});

async function authorized(request, secret) {
  if (!secret) return false;
  const digest = value => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const [actual, expected] = await Promise.all([digest(request.headers.get('authorization') ?? ''), digest('Bearer ' + secret)]);
  const a = new Uint8Array(actual), b = new Uint8Array(expected);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

const emptyMetrics = () => ({bindingCalls: 0, statements: 0, rowsRead: 0, rowsWritten: 0, sqlDurationMs: 0});
function measuredDatabase(db, metrics) {
  const originals = new WeakMap();
  const record = result => {
    const meta = result?.meta ?? {};
    metrics.rowsRead += meta.rows_read ?? 0;
    metrics.rowsWritten += meta.rows_written ?? 0;
    metrics.sqlDurationMs += meta.duration ?? 0;
    return result;
  };
  const statement = original => {
    const wrapped = {
      bind(...values) { return statement(original.bind(...values)); },
      async all() { metrics.bindingCalls++; metrics.statements++; return record(await original.all()); },
      async run() { metrics.bindingCalls++; metrics.statements++; return record(await original.run()); },
      // D1 first() omits metadata. The same SQL runs once through all() here;
      // only the first row/column is returned to the unchanged application.
      async first(column) {
        const row = (await wrapped.all()).results[0];
        return row ? (column === undefined ? row : row[column]) : null;
      }
    };
    originals.set(wrapped, original);
    return wrapped;
  };
  return {
    prepare(sql) { return statement(db.prepare(sql)); },
    async batch(statements) {
      metrics.bindingCalls++;
      metrics.statements += statements.length;
      return (await db.batch(statements.map(s => originals.get(s)))).map(record);
    }
  };
}

async function seedFixtures(db, {holders, savedCloses}) {
  const lastClose = Math.floor(fixtureNow / rules.interval) * rules.interval;
  const startAt = lastClose - savedCloses * rules.interval;
  await db.prepare("UPDATE wp_paper_runs SET status='stopped' WHERE wallet IS NOT NULL AND status='running'").run();
  const referenceRows = (await db.prepare('SELECT id,state_json FROM wp_paper_runs WHERE wallet IS NULL AND rules_hash=?').bind(paper.ruleHash).all()).results;
  const history = Array.from({length: savedCloses}, (_, i) => ({t: startAt + (i + 1) * rules.interval,
    observedAt: startAt + (i + 1) * rules.interval + 1000, equity: 1000 + (i % 97) / 7,
    hold: 1000 + (i % 83) / 9, price: 85000 + (i % 61) / 11, actionable: true}));
  const grow = state => ({...state, startAt, lastT: lastClose - rules.interval, history, observedBars: savedCloses});
  for (const row of referenceRows) await db.prepare('UPDATE wp_paper_runs SET state_json=?,created_at=?,ends_at=? WHERE id=?')
    .bind(JSON.stringify(grow(JSON.parse(row.state_json))), startAt, lastClose + 86400000, row.id).run();
  const fixtures = [];
  for (let i = 0; i < holders; i++) {
    const id = crypto.randomUUID(), wallet = '0x' + String(holders * 100 + i).padStart(40, '0');
    const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    const tokenHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(n => n.toString(16).padStart(2, '0')).join('');
    const crew = Array.from({length: 12}, (_, n) => ({collection: 'rarewhales', tokenId: n + 1, preset: 'trend', profile: NEUTRAL_PROFILE}));
    const state = grow(initialState(crew, startAt, lastClose - rules.interval));
    for (const agent of state.agents) agent.pending = {side: 'buy', reason: 'Disposable capacity fixture', at: fixtureNow - rules.interval};
    await db.prepare('INSERT INTO rw_sessions(hash,address,expires) VALUES(?,?,?)').bind(tokenHash, wallet, fixtureNow + 86400000).run();
    await db.prepare("INSERT INTO wp_paper_runs(id,wallet,nickname,input_json,rules_hash,created_at,ends_at,status,state_json) VALUES(?,?,?,'{}',?,?,?,'running',?)")
      .bind(id, wallet, 'Disposable capacity holder ' + i, paper.ruleHash, startAt, lastClose + 86400000, JSON.stringify(state)).run();
    fixtures.push({id, token});
  }
  // Ten archived long watches for the first holder exercise the supported
  // restart/archive journey without sending their full histories to the Worker.
  const archiveIds = Array.from({length: 10}, () => crypto.randomUUID());
  await db.prepare("INSERT INTO wp_paper_runs(id,wallet,nickname,input_json,rules_hash,created_at,ends_at,status,state_json) SELECT json_extract(value,'$.id'),r.wallet,'Disposable archived watch','{}',r.rules_hash,r.created_at-json_extract(value,'$.offset'),r.ends_at,'stopped',r.state_json FROM json_each(?) CROSS JOIN wp_paper_runs r WHERE r.id=?")
    .bind(JSON.stringify(archiveIds.map((id, i) => ({id, offset: (i + 1) * 1000}))), fixtures[0].id).run();
  return {holders, savedCloses, fixtures, references: referenceRows.length};
}

export class CapacityRecorder extends CandidateRecorder {
  constructor(ctx, env) {
    const metrics = emptyMetrics();
    super(ctx, {...env, DB: measuredDatabase(env.DB, metrics)});
    this.metrics = metrics;
    this.fixtureDatabase = env.DB;
    this.fixtureStorage = ctx.storage;
  }
  resetMetrics() { Object.assign(this.metrics, emptyMetrics()); }
  capacityMetrics() { return {...this.metrics}; }
  run(scheduledTime) { fixtureNow = scheduledTime + 1000; return super.run(scheduledTime); }
  async seed(parameters) {
    fixtureNow = parameters.now;
    // A rerun may reuse the disposable Worker. This checkpoint belongs only to
    // the synthetic test namespace and must not suppress the new probe tick.
    await this.fixtureStorage.delete('checkpoint');
    return seedFixtures(this.fixtureDatabase, parameters);
  }
}

export class CapacityPaperReadExecutor extends CandidateReader {
  constructor(ctx, env) {
    const metrics = emptyMetrics();
    super(ctx, {...env, DB: measuredDatabase(env.DB, metrics)});
    this.metrics = metrics;
  }
  async read(request) {
    const suppliedNow = Number(request.headers.get('fixture-now'));
    if (Number.isSafeInteger(suppliedNow) && suppliedNow > 0) fixtureNow = suppliedNow;
    Object.assign(this.metrics, emptyMetrics());
    const response = await super.read(request);
    const headers = new Headers(response.headers);
    headers.set('x-local-capacity-d1', JSON.stringify(this.metrics));
    return new Response(response.body, {status: response.status, headers});
  }
}

export default {
  async fetch(request, env) {
    if (!await authorized(request, env.CAPACITY_TOKEN)) return new Response('Forbidden', {status: 403});
    const suppliedNow = Number(request.headers.get('fixture-now'));
    if (Number.isSafeInteger(suppliedNow) && suppliedNow > 0) fixtureNow = suppliedNow;
    const url = new URL(request.url);
    if (url.pathname === '/__capacity/tick') {
      if (request.method !== 'POST') return new Response('Use POST', {status: 405});
      const stub = env.PAPER_RECORDER.getByName(env.CAPACITY_RECORDER_NAME);
      await stub.resetMetrics();
      const jobs = [];
      worker.scheduled({scheduledTime: fixtureNow - 1000}, env, {waitUntil: job => jobs.push(job)});
      await Promise.all(jobs);
      return Response.json({checkpoint: await stub.status(), d1: await stub.capacityMetrics()});
    }
    if (url.pathname === '/__capacity/seed') {
      if (request.method !== 'POST') return new Response('Use POST', {status: 405});
      const {holders, savedCloses = 3800} = await request.json();
      if (![10, 20].includes(holders) || ![3800, 4032].includes(savedCloses)) return new Response('Invalid fixture size', {status: 400});
      return Response.json(await env.PAPER_RECORDER.getByName(env.CAPACITY_RECORDER_NAME).seed({holders, savedCloses, now: fixtureNow}));
    }
    if (url.pathname === '/__capacity/state') {
      const runs = (await env.DB.prepare("SELECT id,revision,json_array_length(state_json,'$.history') AS historyLength,length(CAST(state_json AS BLOB)) AS stateBytes FROM wp_paper_runs WHERE status='running' AND wallet IS NOT NULL ORDER BY id").all()).results;
      const events = await env.DB.prepare("SELECT COUNT(*) AS n FROM wp_paper_events WHERE run_id IN (SELECT id FROM wp_paper_runs WHERE status='running' AND wallet IS NOT NULL) AND json_extract(event_json,'$.kind')='buy'").first();
      const stored = await env.DB.prepare('SELECT SUM(length(CAST(state_json AS BLOB))) AS allStateBytes FROM wp_paper_runs').all();
      return Response.json({runs, buyEvents: events.n, allStateBytes: stored.results[0].allStateBytes, databaseBytes: stored.meta.size_after});
    }
    // The disposable service only probes read endpoints. No wallet or member
    // mutations are made available, even with the capacity secret.
    if (request.method !== 'GET') return new Response('Read probes only', {status: 405});
    const metrics = emptyMetrics();
    const response = await worker.fetch(request, {...env, DB: measuredDatabase(env.DB, metrics)});
    const headers = new Headers(response.headers);
    if (!headers.has('x-local-capacity-d1')) headers.set('x-local-capacity-d1', JSON.stringify(metrics));
    return new Response(response.body, {status: response.status, headers});
  }
};
