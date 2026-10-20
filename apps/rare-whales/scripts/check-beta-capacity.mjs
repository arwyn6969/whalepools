import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {PAPER_RULES as R, initialState} from '../src/paper-engine.mjs';
import {NEUTRAL_PROFILE} from '../src/dna.mjs';

// Run npm run build:demo first. Every database and Durable Object used below
// exists only in local workerd; no remote resources or real wallets are used.
const app = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, app), 'utf8');
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const {Miniflare, convertV4MiniflareOptions} = await import(pathToFileURL(wranglerRequire.resolve('miniflare')));
const paper = JSON.parse(await read('build/public/paper-rules.json'));
const tide = JSON.parse(await read('build/public/tide-rules.json'));
const bundleHash = createHash('sha256').update(await read('build/paper-worker.mjs')).digest('hex');
await mkdir(new URL('work/', app), {recursive: true});
await build({entryPoints: [fileURLToPath(new URL('./capacity-fixture-worker.mjs', import.meta.url))],
  outfile: fileURLToPath(new URL('work/beta-capacity-worker.mjs', app)), bundle: true,
  format: 'esm', platform: 'browser', target: 'es2022', external: ['cloudflare:workers']});

const base = Date.UTC(2026, 9, 20, 12);
let clock = base + 1000;
const crew = Array.from({length: 12}, (_, i) => ({collection: 'rarewhales', tokenId: i + 1, preset: 'trend', profile: NEUTRAL_PROFILE}));
const origin = 'https://capacity.invalid';
const mf = new Miniflare(convertV4MiniflareOptions({
  name: 'whale-pools-local-beta-capacity', modules: true, port: 0,
  scriptPath: fileURLToPath(new URL('work/beta-capacity-worker.mjs', app)),
  compatibilityDate: '2026-09-21', d1Databases: {DB: 'isolated-beta-capacity'},
  durableObjects: {PAPER_RECORDER: {className: 'CapacityRecorder', useSQLite: true}, PAPER_READS: {className: 'CapacityPaperReadExecutor', useSQLite: true}},
  bindings: {PAPER_ENABLED: '1', TIDE_ENABLED: '1', RECORDER_MODE: 'durable-object',
    PAPER_READ_MODE: 'durable-object', APP_ORIGIN: origin, CAPACITY_TOKEN: 'local-disposable-capacity', CAPACITY_RECORDER_NAME: `market-v1:${paper.ruleHash}:${tide.ruleHash}`},
  outboundService: async request => {
    const data = await request.json();
    if (data.type === 'spotMeta') return Response.json({tokens: [{name: 'UBTC', index: 1}, {name: 'USDC', index: 0}], universe: [{index: 7, tokens: [1, 0]}]});
    const latest = Math.floor(clock / R.interval) * R.interval - R.interval;
    return Response.json(Array.from({length: 100}, (_, i) => {
      const t = latest - (99 - i) * R.interval;
      const p = 1000 + (t - base) / R.interval;
      return {t, T: t + R.interval - 1, s: '@7', i: '5m', o: String(p), h: String(p + .1), l: String(p - .1), c: String(p)};
    }));
  }
}));

const round = n => Math.round(n * 100) / 100;
const tick = async () => {
  const started = performance.now();
  const response = await mf.dispatchFetch(origin + '/__capacity/tick', {method: 'POST', headers: {'fixture-now': String(clock), authorization: 'Bearer local-disposable-capacity'}});
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.checkpoint.status, 'ok');
  return {...data, wallMs: round(performance.now() - started)};
};
const get = async (path, token) => {
  const started = performance.now();
  const response = await mf.dispatchFetch(origin + '/whalepools' + path, {headers: {'fixture-now': String(clock), authorization: 'Bearer local-disposable-capacity', ...(token ? {cookie: 'wp_arcade_session=' + token} : {})}});
  const text = await response.text();
  assert.equal(response.status, 200, path + ': ' + text.slice(0, 150));
  return {wallMs: round(performance.now() - started), bytes: Buffer.byteLength(text),
    d1: JSON.parse(response.headers.get('x-local-capacity-d1')), data: JSON.parse(text)};
};
const brief = ({data, ...measurement}) => measurement;
const scenarios = [];
try {
  await mf.ready;
  assert.equal((await mf.dispatchFetch(origin + '/__capacity/state')).status, 403);
  const db = await mf.getD1Database('DB');
  for (const name of ['0001_club.sql', '0002_pool_agents.sql', '0003_arcade.sql', '0004_arcade_revisions.sql', '0005_paper.sql', '0006_daily_tide.sql']) {
    await db.exec((await read('migrations/' + name)).replace(/--[^\n]*/g, '').replace(/\n/g, ' '));
  }
  const bootstrap = await tick();
  for (const holders of [10, 20]) {
    // Stop prior fixture companies without removing their archived histories.
    await db.prepare("UPDATE wp_paper_runs SET status='stopped' WHERE wallet IS NOT NULL").run();
    const ids = [], tokens = [];
    for (let i = 0; i < holders; i++) {
      const id = crypto.randomUUID(), wallet = '0x' + String(holders * 100 + i).padStart(40, '0');
      const token = createHash('sha256').update(id).digest('hex');
      ids.push(id); tokens.push(token);
      await db.prepare('INSERT INTO rw_sessions(hash,address,expires) VALUES(?,?,?)')
        .bind(createHash('sha256').update(token).digest('hex'), wallet, clock + 86400000).run();
      await db.prepare("INSERT INTO wp_paper_runs(id,wallet,nickname,input_json,rules_hash,created_at,ends_at,status,state_json) VALUES(?,?,?,'{}',?,?,?,'running',?)")
        .bind(id, wallet, 'Disposable holder ' + i, paper.ruleHash, clock, clock + R.duration,
          JSON.stringify(initialState(crew, clock, Math.floor(clock / R.interval) * R.interval - R.interval))).run();
    }
    clock += R.interval; await tick();
    clock += R.interval; const fills = await tick();
    const fillCount = (await db.prepare("SELECT COUNT(*) AS n FROM wp_paper_events WHERE run_id IN (SELECT id FROM wp_paper_runs WHERE status='running' AND wallet IS NOT NULL) AND json_extract(event_json,'$.kind')='buy'").first()).n;
    assert.equal(fillCount, holders * 12);

    // Give holders and all three reference watches fourteen-day-sized states.
    const longStart = Math.floor(clock / R.interval) * R.interval - 3800 * R.interval;
    const rows = (await db.prepare("SELECT id,wallet,state_json FROM wp_paper_runs WHERE status='running' AND rules_hash=?").bind(paper.ruleHash).all()).results;
    for (const row of rows) {
      const state = JSON.parse(row.state_json);
      state.startAt = longStart; state.lastT = Math.floor(clock / R.interval) * R.interval - R.interval;
      state.history = Array.from({length: 3800}, (_, i) => ({t: longStart + (i + 1) * R.interval,
        observedAt: longStart + (i + 1) * R.interval + 1000, equity: 1000 + (i % 97) / 7,
        hold: 1000 + (i % 83) / 9, price: 85000 + (i % 61) / 11, actionable: true}));
      state.observedBars = 3800;
      await db.prepare('UPDATE wp_paper_runs SET state_json=?,created_at=?,ends_at=? WHERE id=?')
        .bind(JSON.stringify(state), longStart, longStart + R.duration, row.id).run();
    }
    clock += R.interval;
    const longTick = await tick();
    assert.equal(longTick.checkpoint.runs, holders + 3);
    for (const id of ids) {
      const state = JSON.parse((await db.prepare('SELECT state_json FROM wp_paper_runs WHERE id=?').bind(id).first()).state_json);
      assert.equal(state.history.length, 3801); assert.equal(state.history.at(-1).actionable, true);
    }
    const anonymous = await get('/api/paper');
    const signedIn = await get('/api/paper', tokens[0]);
    assert.equal(anonymous.data.labs.length, 3);
    assert.equal(signedIn.data.me.run.id, ids[0]);
    assert.equal(signedIn.data.me.run.history.length, 288);
    const recap = await get('/api/paper/recap/' + ids[0]);
    const coverage = await get('/api/paper/coverage');
    const beforeReads = (await db.prepare("SELECT SUM(revision) AS n FROM wp_paper_runs").first()).n;
    const concurrent = await Promise.all(tokens.map(token => get('/api/paper', token)));
    assert.equal((await db.prepare('SELECT SUM(revision) AS n FROM wp_paper_runs').first()).n, beforeReads);
    const storageResult = await db.prepare('SELECT MAX(length(CAST(state_json AS BLOB))) AS maxStateBytes,SUM(length(CAST(state_json AS BLOB))) AS allStateBytes FROM wp_paper_runs').all();
    const storage = storageResult.results[0];
    assert.ok(storage.maxStateBytes < 2000000, 'D1 state row must fit documented 2 MB row bound');
    const walls = concurrent.map(r => r.wallMs).sort((a, b) => a - b);
    scenarios.push({holders, whalesPerHolder: 12, savedCloses: 3800, filledOrders: fillCount,
      fillTick: fills, longTick, reads: {anonymous: brief(anonymous), signedIn: brief(signedIn), recap: brief(recap), coverage: brief(coverage),
        concurrent: {requests: holders, allSucceeded: true, p50WallMs: walls[Math.ceil(walls.length * .5) - 1], p95WallMs: walls[Math.ceil(walls.length * .95) - 1]}},
      storage: {...storage, databaseBytes: storageResult.meta.size_after}});
  }
  const seedResponse = await mf.dispatchFetch(origin + '/__capacity/seed', {method: 'POST',
    headers: {'fixture-now': String(clock), authorization: 'Bearer local-disposable-capacity', 'content-type': 'application/json'},
    body: JSON.stringify({holders: 10, savedCloses: 3800})});
  assert.equal(seedResponse.status, 200);
  const seeded = await seedResponse.json();
  assert.equal(seeded.fixtures.length, 10); assert.equal(seeded.references, 3);
  clock += R.interval; await tick();
  const seededFills = (await db.prepare("SELECT COUNT(*) AS n FROM wp_paper_events WHERE run_id IN (SELECT id FROM wp_paper_runs WHERE status='running' AND wallet IS NOT NULL) AND json_extract(event_json,'$.kind')='buy'").first()).n;
  assert.equal(seededFills, 120);
  const archiveSeedProbe = await get('/api/paper/history', seeded.fixtures[0].token);
  assert.equal(archiveSeedProbe.data.runs.length, 10); assert.ok(archiveSeedProbe.data.next);
  const archiveSeedPage2 = await get('/api/paper/history?cursor=' + encodeURIComponent(archiveSeedProbe.data.next), seeded.fixtures[0].token);
  assert.ok(archiveSeedPage2.data.runs.length >= 1);
  const report = {passed: true, checkedAt: new Date().toISOString(), runtime: 'local workerd, exact compiled candidate, SQLite Durable Object and D1',
    bundleSha256: bundleHash, paperHash: paper.ruleHash, tideHash: tide.ruleHash,
    realWallet: false, realMarket: false, remoteCapacityProved: false, cpuTimeMeasured: false, planQuotasSimulated: false,
    measurementNotes: ['Wall time includes local D1 and instrumentation; it is not Worker/DO CPU time.',
      'D1 metrics come from local query metadata. first() runs the same SQL through all() once to expose metadata.',
      'Statement counts and binding calls are both reported; deployed per-invocation limits must be checked in the actual account.',
      'Storage includes stopped first-cohort histories; row-size check measures state_json plus a small row metadata overhead.'],
    guardedRemoteSeedValidatedLocally: true, archiveSeedProbe: brief(archiveSeedProbe), archiveSeedPage2: brief(archiveSeedPage2), bootstrap, scenarios};
  await writeFile(new URL('work/beta-capacity.json', app), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await mf.dispose(); }
