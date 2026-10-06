import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedRequest, requestJSON} from '../public/request.mjs';

test('bounded waits release callers even if a provider ignores cancellation', async () => {
  let aborted = false;
  await assert.rejects(boundedRequest(signal => {signal.addEventListener('abort', () => aborted = true); return new Promise(() => {});}, {timeoutMs: 10}), {name: 'TimeoutError'});
  assert.equal(aborted, true);
});
test('wallet changes cancel pending work and pre-cancelled work never starts', async () => {
  const controller = new AbortController();
  const pending = boundedRequest(() => new Promise(() => {}), {signal: controller.signal});
  controller.abort();
  await assert.rejects(pending, {name: 'AbortError'});
  let started = false;
  await assert.rejects(boundedRequest(() => {started = true;}, {signal: controller.signal}), {name: 'AbortError'});
  assert.equal(started, false);
});
test('JSON body reads are bounded too; HTTP errors remain definite failures', async t => {
  const original = globalThis.fetch; t.after(() => globalThis.fetch = original);
  globalThis.fetch = async () => ({ok: true, json: () => new Promise(() => {})});
  await assert.rejects(requestJSON('https://fixture.invalid', {}, {timeoutMs: 10}), {name: 'TimeoutError'});
  globalThis.fetch = async () => ({ok: false, status: 403, json: async () => ({error: 'Ownership changed. Refresh your whales.'})});
  await assert.rejects(requestJSON('https://fixture.invalid'), error => error.message.includes('Ownership changed') && error.status === 403 && !error.uncertain);
});
