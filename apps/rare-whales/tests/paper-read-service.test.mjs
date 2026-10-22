import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/database.mjs';
import {initialState} from '../src/paper-engine.mjs';
import {projectRun, createPaperService} from '../src/paper-service.mjs';
import {createPaperReadService, createPaperArchiveReadService, paperReadColumns, projectPaperRead} from '../src/paper-read-service.mjs';
import {createFleetSocialService} from '../src/fleet-social-service.mjs';
import {NEUTRAL_PROFILE} from '../src/dna.mjs';

const hash = 'a'.repeat(64), wallet = '0x' + '1'.repeat(40), base = Date.UTC(2026, 9, 20);
const agent = {collection: 'rarewhales', tokenId: 245, preset: 'trend', profile: NEUTRAL_PROFILE};
async function insert(db, length, extra = {}) {
  const id = crypto.randomUUID(), state = initialState([agent], base, base - 300000);
  state.history = Array.from({length}, (_, i) => ({t: base + i * 300000, observedAt: base + i * 300000 + 1234,
    equity: 1000 + i * .12345678, hold: 1000 - i * .00000123, price: 999.3333333, actionable: i % 7 !== 0}));
  state.exposureSum = 91.12345678; state.observedBars = length; state.gapBars = 3;
  await db.prepare("INSERT INTO wp_paper_runs(id,wallet,nickname,input_json,rules_hash,created_at,ends_at,status,state_json) VALUES(?,?,?,?,?,?,?,'completed',?)")
    .bind(id, extra.wallet ?? null, 'Saved reference', extra.input ?? '{}', hash, extra.createdAt ?? base, base + 14 * 86400000, JSON.stringify(state)).run();
  return id;
}
test('compact D1 projections preserve every public run field and exact stats at history boundaries', async () => {
  const db = database();
  try {
    for (const length of [0, 1, 30, 31, 32, 287, 288, 289, 3800, 4032]) {
      const id = await insert(db, length);
      const original = await db.prepare('SELECT * FROM wp_paper_runs WHERE id=?').bind(id).first();
      const projected = await db.prepare('SELECT ' + paperReadColumns() + ' FROM wp_paper_runs r WHERE id=?').bind(id).first();
      assert.deepEqual(projectPaperRead(projected), projectRun(original), 'history length ' + length);
      assert.ok(Buffer.byteLength(projected.state_json) < 2000);
      if (length >= 3800) assert.ok(JSON.stringify(projected).length < original.state_json.length / 5);
    }
  } finally { db.close(); }
});
test('read adapter keeps public API, events, wallet selection and disabled behavior while bounding reference cohorts', async () => {
  const db = database();
  try {
    for (let i = 0; i < 3; i++) await insert(db, 3800);
    const own = await insert(db, 4032, {wallet});
    await db.prepare('INSERT INTO wp_paper_events(run_id,bar_t,ordinal,event_json) VALUES(?,?,?,?)').bind(own, base, 0, '{"kind":"buy"}').run();
    const legacy = createPaperService({rulesHash: hash, now: () => base}), optimized = createPaperReadService({rulesHash: hash, now: () => base});
    const args = {db, me: {address: wallet}, env: {PAPER_ENABLED: '1'}};
    const actual = await optimized.read(args), expected = await legacy.read(args);
    const {referenceArchive, ...same} = actual;
    assert.deepEqual(same, expected); assert.deepEqual(referenceArchive, []);
    assert.deepEqual(await optimized.read({...args, id: own}), await legacy.read({...args, id: own}));
    assert.deepEqual(await optimized.read({...args, env: {}}), await legacy.read({...args, env: {}}));
    await assert.rejects(optimized.read({...args, id: 'invalid'}), e => e.status === 404);
    await assert.rejects(optimized.read({...args, id: crypto.randomUUID()}), e => e.status === 404);
    for (let cohort = 1; cohort <= 6; cohort++) for (let i = 0; i < 3; i++) await insert(db, 1, {
      createdAt: base + cohort * 1000,
      input: JSON.stringify({referenceVersion: 'whale-pools-neutral-reference-v1', referenceCohort: 'cohort-' + cohort, preset: ['trend', 'breakout', 'recovery'][i]})
    });
    const renewed = await optimized.read(args);
    assert.equal(renewed.labs.length, 3); assert.ok(renewed.labs.every(r => r.createdAt === base + 6000));
    assert.equal(renewed.referenceArchive.length, 12);
    assert.ok(renewed.referenceArchive.every(r => !('owner' in r) && !('history' in r)));
  } finally { db.close(); }
});
test('archive projection preserves pagination and exact stats across ten long saved watches', async () => {
  const db = database();
  try {
    for (let i = 0; i < 11; i++) await insert(db, 3800 + i, {wallet, createdAt: base + i * 1000});
    const legacy = createFleetSocialService({paperHash: hash}), optimized = createPaperArchiveReadService();
    const args = {db, me: {address: wallet}, env: {PAPER_ENABLED: '1'}, url: new URL('https://app.invalid/api/paper/history')};
    const first = await optimized.archive(args);
    assert.equal(first.runs.length, 10); assert.ok(first.next);
    assert.deepEqual(first, await legacy.archive(args));
    const secondArgs = {...args, url: new URL(args.url + '?cursor=' + encodeURIComponent(first.next))};
    assert.deepEqual(await optimized.archive(secondArgs), await legacy.archive(secondArgs));
    assert.deepEqual(await optimized.archive({...args, env: {}}), await legacy.archive({...args, env: {}}));
    await assert.rejects(optimized.archive({...args, me: null}), e => e.status === 401);
    await assert.rejects(optimized.archive({...args, url: new URL(args.url + '?cursor=bad')}), e => e.status === 400);
  } finally { db.close(); }
});
