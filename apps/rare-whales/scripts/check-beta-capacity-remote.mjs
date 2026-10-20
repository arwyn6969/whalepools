import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';

// This deliberately writes disposable synthetic data. Point it only at the
// separately configured capacity Worker/D1, never the actual staging service.
const option = name => process.argv.find(v => v.startsWith('--' + name + '='))?.slice(name.length + 3);
const origin = process.env.CAPACITY_URL || option('url');
const token = process.env.CAPACITY_TOKEN || (option('secrets-file') ? JSON.parse(await readFile(option('secrets-file'), 'utf8')).CAPACITY_TOKEN : null);
assert.ok(origin && token, 'Supply --url= and --secrets-file=, or CAPACITY_URL and CAPACITY_TOKEN.');
assert.match(new URL(origin).hostname, /^whalepools-beta-capacity-[a-z0-9-]+\.mrarwyn\.workers\.dev$/, 'Only the dedicated disposable capacity Worker is allowed.');
const cohortSizes = option('holders') ? [Number(option('holders'))] : [10, 20];
assert.ok(cohortSizes.every(n => [10, 20].includes(n)));
let clock = Date.UTC(2026, 9, 20, 12) + 1000;
const round = n => Math.round(n * 100) / 100;
const request = async (path, {method = 'GET', body, session} = {}) => {
  const started = performance.now();
  const response = await fetch(origin + path, {method, headers: {authorization: 'Bearer ' + token, 'fixture-now': String(clock),
    ...(body ? {'content-type': 'application/json'} : {}), ...(session ? {cookie: 'wp_arcade_session=' + session} : {})},
    ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(60000)});
  const text = await response.text();
  assert.equal(response.status, 200, path + ': ' + text.slice(0, 200));
  return {wallMs: round(performance.now() - started), bytes: Buffer.byteLength(text),
    d1: response.headers.has('x-local-capacity-d1') ? JSON.parse(response.headers.get('x-local-capacity-d1')) : null, data: JSON.parse(text)};
};
const brief = ({data, ...measurement}) => measurement;
const forbidden = await fetch(origin + '/__capacity/state');
assert.equal(forbidden.status, 403, 'An unauthenticated request must be forbidden.');
const bootstrap = await request('/__capacity/tick', {method: 'POST'});
assert.equal(bootstrap.data.checkpoint.status, 'ok');
const scenarios = [];
for (const holders of cohortSizes) {
  const seed = await request('/__capacity/seed', {method: 'POST', body: {holders, savedCloses: 3800}});
  assert.equal(seed.data.references, 3);
  clock += 300000;
  const tick = await request('/__capacity/tick', {method: 'POST'});
  assert.equal(tick.data.checkpoint.status, 'ok');
  assert.equal(tick.data.checkpoint.runs, holders + 3);
  const state = await request('/__capacity/state');
  assert.equal(state.data.runs.length, holders);
  assert.equal(state.data.buyEvents, holders * 12);
  assert.ok(state.data.runs.every(r => r.historyLength === 3801 && r.stateBytes < 2000000));
  const first = seed.data.fixtures[0];
  const anonymous = await request('/whalepools/api/paper');
  const signedIn = await request('/whalepools/api/paper', {session: first.token});
  assert.equal(anonymous.data.labs.length, 3);
  assert.equal(signedIn.data.me.run.id, first.id);
  assert.equal(signedIn.data.me.run.history.length, 288);
  const run = await request('/whalepools/api/paper/run/' + first.id);
  assert.deepEqual(run.data.run, signedIn.data.me.run);
  const recap = await request('/whalepools/api/paper/recap/' + first.id);
  const archive = await request('/whalepools/api/paper/history', {session: first.token});
  assert.equal(archive.data.runs.length, 10); assert.ok(archive.data.next);
  const archivePage2 = await request('/whalepools/api/paper/history?cursor=' + encodeURIComponent(archive.data.next), {session: first.token});
  assert.ok(archivePage2.data.runs.length >= 1);
  const coverage = await request('/whalepools/api/paper/coverage');
  const concurrent = await Promise.all(seed.data.fixtures.map(f => request('/whalepools/api/paper', {session: f.token})));
  const after = await request('/__capacity/state');
  assert.deepEqual(after.data, state.data, 'Read probes must not change run revisions, histories or fills.');
  const walls = concurrent.map(r => r.wallMs).sort((a, b) => a - b);
  scenarios.push({holders, whalesPerHolder: 12, savedCloses: 3800, filledOrders: state.data.buyEvents,
    seed: brief(seed), tick: {...brief(tick), ...tick.data}, storage: {maxStateBytes: Math.max(...state.data.runs.map(r => r.stateBytes)),
      allStateBytes: state.data.allStateBytes, databaseBytes: state.data.databaseBytes},
    reads: {anonymous: brief(anonymous), signedIn: brief(signedIn), run: brief(run), recap: brief(recap), archive: brief(archive), archivePage2: brief(archivePage2), coverage: brief(coverage),
      concurrent: {requests: holders, allSucceeded: true, p50WallMs: walls[Math.ceil(walls.length * .5) - 1], p95WallMs: walls[Math.ceil(walls.length * .95) - 1]}}});
  clock += 300000;
}
const report = {passed: true, checkedAt: new Date().toISOString(), url: origin,
  remoteRuntime: true, fixtures: true, realMarket: false, realWallet: false,
  cpuTimeMeasuredByClient: false, note: 'Match this probe window with Cloudflare tail invocation CPU/outcome evidence; HTTP wall time is not CPU time.',
  bootstrap: {...brief(bootstrap), ...bootstrap.data}, scenarios};
const output = option('out') || 'work/beta-capacity-remote.json';
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
