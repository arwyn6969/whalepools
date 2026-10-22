import {privateKeyToAccount} from 'viem/accounts';
import {FIXTURE_KEYS} from './wallets.mjs';

const accounts = Object.fromEntries(Object.entries(FIXTURE_KEYS).map(([name, key]) => [name, privateKeyToAccount(key)]));
const originalFetch = window.fetch.bind(window);
let wallet = localStorage.getItem('whale-pools-fixture-wallet') || 'holder', chainId = 4663, rejectSignature = false;
if (!accounts[wallet]) wallet = 'holder';
const listeners = new Map();
const emit = (name, value) => {for (const fn of listeners.get(name) || []) fn(value);};
const control = async data => {
  const response = await originalFetch('/__fixture/control', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(data)});
  if (!response.ok) throw Error('Fixture control failed.');
  return response.json();
};
const provider = {
  on(name, listener) {if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(listener);},
  removeListener(name, listener) {listeners.get(name)?.delete(listener);},
  async request({method, params = []}) {
    if (method === 'eth_chainId') return '0x' + chainId.toString(16);
    if (method === 'eth_requestAccounts') {
      // Extensions may announce the newly authorised account before resolving
      // this first request. It must not cancel the sign-in it belongs to.
      emit('accountsChanged', [accounts[wallet].address]);
      return [accounts[wallet].address];
    }
    if (method === 'eth_accounts') return [accounts[wallet].address];
    if (method === 'personal_sign') {
      if (rejectSignature) throw Object.assign(Error('Fixture signature rejected.'), {code: 4001});
      return accounts[wallet].signMessage({message: {raw: params[0]}});
    }
    if (method === 'wallet_switchEthereumChain') {chainId = Number(params[0].chainId); emit('chainChanged', params[0].chainId); return null;}
    const response = await originalFetch('/__fixture/rpc', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params})});
    const result = await response.json();
    if (result.error) throw Object.assign(Error(result.error.message), {code: result.error.code});
    return result.result;
  }
};
// Route only the production RPC URL to disposable local fixtures in this preview.
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('https://rpc.mainnet.chain.robinhood.com')) return originalFetch('/__fixture/rpc', init);
  return originalFetch(input, init);
};
const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {detail: {info: {uuid: 'f69a9c1d-c3af-435a-afc5-987654321012', name: 'Whale Pools Fixture Wallet', rdns: 'test.whale-pools.fixture', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>'}, provider}}));
window.addEventListener('eip6963:requestProvider', announce);
window.ethereum = provider;
window.__whaleFixture = {
  accounts: Object.fromEntries(Object.entries(accounts).map(([name, account]) => [name, account.address.toLowerCase()])),
  async wallet(name) {if (!accounts[name]) throw Error('Unknown fixture wallet.'); wallet = name; localStorage.setItem('whale-pools-fixture-wallet', name); document.querySelector('#fixture-wallet').value = name; emit('accountsChanged', [accounts[name].address]);},
  chain(id) {chainId = id; emit('chainChanged', '0x' + id.toString(16));},
  rejectSignature(value) {rejectSignature = value;},
  control,
  state: () => ({wallet, chainId, rejectSignature})
};
document.querySelector('#fixture-wallet').addEventListener('change', event => window.__whaleFixture.wallet(event.target.value));
document.querySelector('#fixture-wallet').value = wallet;
document.querySelector('#fixture-inventory').addEventListener('change', event => control({rpcMode: event.target.value, rpcDelayMs: event.target.value === 'delay' ? 22000 : 0}));
document.querySelector('#fixture-reject').addEventListener('change', event => {rejectSignature = event.target.checked;});
document.querySelector('#fixture-chain').addEventListener('change', event => window.__whaleFixture.chain(event.target.checked ? 1 : 4663));
announce();
