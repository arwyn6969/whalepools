import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {initialState, PAPER_RULES as R} from '../src/paper-engine.mjs';
import {NEUTRAL_PROFILE} from '../src/dna.mjs';

const require = createRequire(import.meta.url), wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const {Miniflare, convertV4MiniflareOptions} = await import(pathToFileURL(wranglerRequire.resolve('miniflare')));
const app = new URL('../', import.meta.url), read = path => readFile(new URL(path, app), 'utf8');
const rules = JSON.parse(await read('build/public/paper-rules.json')), origin = 'https://read-runtime.invalid';
const now = Date.UTC(2026, 9, 20, 12) + 1000;
await mkdir(new URL('work/', app), {recursive: true});
const source = `Date.now=()=>${now};const {default:worker,PaperReadExecutor}=await import('../build/paper-worker.mjs');export {PaperReadExecutor};export default{fetch(request,env){const options={...env};const mode=request.headers.get('fixture-read-mode');if(mode)options.PAPER_READ_MODE=mode;if(request.headers.has('fixture-missing-binding'))delete options.PAPER_READS;return worker.fetch(request,options);}};`;
await writeFile(new URL('work/read-runtime-entry.mjs', app), source);
await build({entryPoints: [fileURLToPath(new URL('work/read-runtime-entry.mjs', app))], outfile: fileURLToPath(new URL('work/read-runtime-worker.mjs', app)),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', external: ['cloudflare:workers']});
const mf = new Miniflare(convertV4MiniflareOptions({name: 'paper-read-runtime', modules: true, port: 0,
  scriptPath: fileURLToPath(new URL('work/read-runtime-worker.mjs', app)), compatibilityDate: '2026-09-21',
  d1Databases: {DB: 'isolated-paper-read-runtime'}, durableObjects: {PAPER_READS: {className: 'PaperReadExecutor', useSQLite: true}},
  bindings: {PAPER_ENABLED: '1', PAPER_READ_MODE: 'durable-object', APP_ORIGIN: origin}}));
const request = (path, headers = {}, host = origin, method = 'GET') => mf.dispatchFetch(host + '/whalepools' + path, {method, headers});
try {
  await mf.ready;
  const db = await mf.getD1Database('DB');
  for (const name of ['0001_club.sql', '0002_pool_agents.sql', '0003_arcade.sql', '0004_arcade_revisions.sql', '0005_paper.sql', '0006_daily_tide.sql']) await db.exec((await read('migrations/' + name)).replace(/--[^\n]*/g, '').replace(/\n/g, ' '));
  const holders = [];
  for (let i = 0; i < 5; i++) {
    const id = crypto.randomUUID(), wallet = i < 3 ? null : '0x' + String(i).repeat(40), token = String(i).repeat(64);
    const state = initialState([{collection: 'rarewhales', tokenId: 245 + i, preset: 'trend', profile: NEUTRAL_PROFILE}], now - 3800 * R.interval, now - R.interval);
    state.history = Array.from({length: 3800}, (_, n) => ({t: now - (3799 - n) * R.interval - 1000, observedAt: now - (3799 - n) * R.interval,
      equity: 1000 + n / 7, hold: 1000 + n / 9, price: 85000 + n / 11, actionable: true}));
    state.exposureSum = 97.1234567;
    await db.prepare("INSERT INTO wp_paper_runs(id,wallet,nickname,input_json,rules_hash,created_at,ends_at,status,state_json) VALUES(?,?,?,'{}',?,?,?,'running',?)")
      .bind(id, wallet, 'Read fixture ' + i, rules.ruleHash, now - 3800 * R.interval, now + 86400000, JSON.stringify(state)).run();
    if (wallet) {
      await db.prepare('INSERT INTO rw_sessions(hash,address,expires) VALUES(?,?,?)').bind(createHash('sha256').update(token).digest('hex'), wallet, now + 86400000).run();
      holders.push({id, token});
    }
  }
  const snapshot = async () => (await db.prepare('SELECT id,revision,state_json FROM wp_paper_runs ORDER BY id').all()).results;
  const before = await snapshot();
  for (const path of ['/api/paper', '/api/paper/run/' + holders[0].id, '/api/paper/history', '/api/paper/recap/' + holders[0].id, '/api/paper/coverage']) {
    const headers = {cookie: 'wp_arcade_session=' + holders[0].token};
    const forwarded = await request(path, headers), direct = await request(path, {...headers, 'fixture-read-mode': 'direct'});
    assert.equal(forwarded.status, direct.status, path);
    assert.deepEqual(await forwarded.json(), await direct.json(), path);
    assert.equal(forwarded.headers.get('cache-control'), 'no-store');
  }
  for (let i = 0; i < 4; i++) for (const holder of holders) {
    const response = await request('/api/paper', {cookie: 'wp_arcade_session=' + holder.token});
    assert.equal((await response.json()).me.run.id, holder.id);
  }
  assert.equal((await request('/api/paper/history')).status, 401);
  assert.equal((await request('/api/paper', {'sec-fetch-site': 'cross-site'})).status, 403);
  assert.equal((await request('/api/paper', {}, 'https://wrong-origin.invalid')).status, 503);
  assert.equal((await request('/api/paper', {'fixture-read-mode': 'unknown'})).status, 503);
  assert.equal((await request('/api/paper', {'fixture-missing-binding': '1'})).status, 503);
  assert.equal((await request('/api/paper', {'fixture-read-mode': 'direct', 'fixture-missing-binding': '1'})).status, 200);
  assert.equal((await request('/api/paper/start', {origin}, origin, 'POST')).status, 401);
  assert.deepEqual(await snapshot(), before);
  const record = {passed: true, runtime: 'compiled candidate in workerd, real SQLite read Durable Object RPC and D1',
    checks: ['all five read routes match direct response bodies', 'two sessions never mix', 'anonymous archive, cross-site and wrong-origin guards',
      'unknown mode and missing binding fail closed; explicit direct mode works', 'mutations keep original service', 'read paths never alter stored watch states'],
    realWallet: false, remoteCpuProved: false};
  await writeFile(new URL('work/paper-read-runtime.json', app), JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify(record));
} finally { await mf.dispose(); }
