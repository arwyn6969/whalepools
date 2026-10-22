import test from 'node:test';
import assert from 'node:assert/strict';
import {forwardPaperRead, paperReadPath, paperReadShard} from '../src/paper-read-routing.mjs';

test('read executor routing is bounded, session-stable and never routes mutations', async () => {
  const names = new Set();
  for (let i = 0; i < 100; i++) {
    const request = new Request('https://app.invalid/whalepools/api/paper', {headers: {cookie: 'wp_arcade_session=' + i}});
    const name = await paperReadShard(request); names.add(name);
    assert.equal(await paperReadShard(request), name); assert.match(name, /^paper-reads-v1:(?:[0-9]|1[0-5])$/);
  }
  assert.ok(names.size <= 16);
  for (const path of ['/api/paper', '/api/paper/history', '/api/paper/coverage', '/api/paper/run/id', '/api/paper/recap/id']) assert.equal(paperReadPath('/whalepools' + path), true);
  for (const path of ['/api/paper/start', '/api/auth/challenge', '/api/tide', '/paper', '/other/api/paper']) assert.equal(paperReadPath('/whalepools' + path), false);
  let calls = 0;
  const env = {PAPER_READ_MODE: 'durable-object', PAPER_READS: {getByName: () => ({read: request => {calls++; return new Response(request.url);}})}};
  assert.equal((await forwardPaperRead(new Request('https://app.invalid/whalepools/api/paper'), env, '/whalepools')).status, 200);
  assert.equal(await forwardPaperRead(new Request('https://app.invalid/whalepools/api/paper/start', {method: 'POST'}), env, '/whalepools'), null);
  assert.equal(calls, 1);
});
test('direct read mode is explicit and configured executor mode fails closed', async () => {
  const request = new Request('https://app.invalid/whalepools/api/paper');
  assert.equal(await forwardPaperRead(request, {}, '/whalepools'), null);
  assert.equal(await forwardPaperRead(request, {PAPER_READ_MODE: 'direct'}, '/whalepools'), null);
  for (const mode of ['durable-object', 'unknown']) {
    const response = await forwardPaperRead(request, {PAPER_READ_MODE: mode}, '/whalepools');
    assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});
