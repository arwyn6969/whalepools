import test from 'node:test';import assert from 'node:assert/strict';
import {discoverWallets} from '../public/wallet-picker.mjs';
const announce=(target,provider,name,rdns,uuid=rdns)=>target.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{provider,info:{name,rdns,uuid}}}));
test('MetaMask is separately discoverable when Temple occupies ethereum; requests use selected provider only',async()=>{
 const target=new EventTarget(),calls=[],temple={request:async()=>calls.push('Temple')},metamask={request:async()=>calls.push('MetaMask')};target.ethereum=temple;
 target.addEventListener('eip6963:requestProvider',()=>{announce(target,temple,'Temple','com.temple');announce(target,metamask,'MetaMask','io.metamask');});
 const wallets=discoverWallets(target);assert.deepEqual(wallets.list().map(w=>w.name),['MetaMask','Temple']);assert.deepEqual(calls,[]);
 await wallets.list()[0].provider.request({method:'eth_requestAccounts'});assert.deepEqual(calls,['MetaMask']);wallets.request();assert.equal(wallets.list().length,2);
});
test('late announcements update discovery without opening any wallet; duplicates and malformed announcements ignored',()=>{
 const target=new EventTarget(),wallets=discoverWallets(target);let updates=0;wallets.subscribe(()=>updates++);const provider={request(){throw Error('must not open');}};
 announce(target,provider,'Late wallet','org.wallet');announce(target,provider,'Duplicate','org.other');announce(target,{},'Invalid','org.invalid');target.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:null}));
 assert.equal(updates,1);assert.equal(wallets.list()[0].provider,provider);
});
test('legacy MetaMask flags are not trusted as wallet identity; named discovery supersedes legacy fallback',()=>{
 const target=new EventTarget(),legacy={isMetaMask:true,request(){}};target.ethereum={providers:[legacy,legacy]};const wallets=discoverWallets(target);
 assert.equal(wallets.list().length,1);assert.match(wallets.list()[0].name,/legacy/);assert.ok(!wallets.list()[0].name.includes('MetaMask'));
 const actual={request(){}};announce(target,actual,'MetaMask','io.metamask');assert.equal(wallets.list().length,1);assert.equal(wallets.list()[0].provider,actual);
});
