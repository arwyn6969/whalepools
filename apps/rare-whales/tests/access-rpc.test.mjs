import test from 'node:test';
import assert from 'node:assert/strict';
import {chainClient} from '../src/access.mjs';

test('ownership RPC retries a transient JSON-RPC 429, never batches, and stops after two retries',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let attempts=0,alwaysBusy=false;
 globalThis.fetch=async(request,options)=>{
  assert.equal(new URL(request).origin,'https://rpc-fixture.test');const body=JSON.parse(options.body);assert.equal(Array.isArray(body),false);attempts++;
  return Response.json({jsonrpc:'2.0',id:body.id,...(alwaysBusy||attempts===1?{error:{code:429,message:'Too Many Requests'}}:{result:'0x1237'})});
 };
 assert.equal(await chainClient({RPC_URL:'https://rpc-fixture.test'}).getChainId(),4663);assert.equal(attempts,2);
 attempts=0;alwaysBusy=true;await assert.rejects(chainClient({RPC_URL:'https://rpc-fixture.test'}).getChainId());assert.equal(attempts,3);
});
