import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
import {privateKeyToAccount} from 'viem/accounts';
import {decodeFunctionData, encodeAbiParameters, keccak256, stringToHex, verifyMessage} from 'viem';
import {createApi} from '../src/api.mjs';
import {createArcadeBoard} from '../src/arcade-board.mjs';
import {createPaperService,tickPaper} from '../src/paper-service.mjs';
import {createFleetSocialService} from '../src/fleet-social-service.mjs';
import {tickTide} from '../src/daily-tide.mjs';
import {PAPER_RULES} from '../src/paper-engine.mjs';
import {COLLECTIONS, CHAIN_ID} from '../src/config.mjs';
import {database} from './database.mjs';
import {FIXTURE_KEYS, FIXTURE_HOLDINGS} from '../tests/fixtures/wallets.mjs';

const app = fileURLToPath(new URL('..', import.meta.url));
const abi = [
  {type: 'function', name: 'balanceOf', inputs: [{type: 'address'}], outputs: [{type: 'uint256'}]},
  {type: 'function', name: 'ownerOf', inputs: [{type: 'uint256'}], outputs: [{type: 'address'}]}
];
const transferTopic = keccak256(stringToHex('Transfer(address,address,uint256)'));
const zero = '0x' + '0'.repeat(40);
const word = value => '0x' + String(value).replace(/^0x/, '').padStart(64, '0');
const hex = value => '0x' + BigInt(value).toString(16);
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.ttf': 'font/ttf'};

// This preview deliberately lives outside the Worker, its asset allowlist and export.
// Every database is in memory and every wallet key/ownership fact is a fixture.
export async function startFixtureServer({port = Number(process.env.RW_FIXTURE_PORT || 48373), paperEnabled = process.env.RW_PAPER_FIXTURE==='1'} = {}) {
  const scores = JSON.parse(await readFile(path.join(app, 'build/arcade-scores.json'), 'utf8'));
  const season = JSON.parse(await readFile(path.join(app, 'arcade.json'), 'utf8'));
  const accountByName = Object.fromEntries(Object.entries(FIXTURE_KEYS).map(([name, key]) => [name, privateKeyToAccount(key)]));
  const walletByName = Object.fromEntries(Object.entries(accountByName).map(([name, account]) => [name, account.address.toLowerCase()]));
  const state = {rpcMode: 'normal', rpcDelayMs: 0, responseDelayMs: 0, delayPath: '', writeMode: 'normal', reverseEntries: false, holdings: structuredClone(FIXTURE_HOLDINGS), requests: []};
  const db = database();
  const items = address => state.holdings[Object.keys(walletByName).find(name => walletByName[name] === address.toLowerCase())] || [];
  const collection = contract => Object.keys(COLLECTIONS).find(name => COLLECTIONS[name].address === contract.toLowerCase());
  const ownerOf = (contract, id) => Object.keys(walletByName).map(name => [name, state.holdings[name]]).find(([, holdings]) => holdings.some(a => a.collection === collection(contract) && a.tokenId === Number(id)))?.[0];
  const client = {
    async getChainId() {return CHAIN_ID;},
    async getBlockNumber() {return 100n;},
    async verifyMessage(args) {return verifyMessage(args);},
    async readContract({address, functionName, args}) {
      if (functionName === 'balanceOf') return BigInt(items(args[0]).filter(a => a.collection === collection(address)).length);
      if (functionName === 'ownerOf') return walletByName[ownerOf(address, args[0])] || zero;
      throw Error('Unexpected fixture contract read.');
    }
  };
  const board = createArcadeBoard({season, scores, ruleHash: scores.ruleHash, client});
  const paperRules=JSON.parse(await readFile(path.join(app,'build/public/paper-rules.json'),'utf8'));
  state.paperNow=Math.floor(Date.now()/PAPER_RULES.interval)*PAPER_RULES.interval+1000;
  const anchor=state.paperNow-PAPER_RULES.interval;
  const paper=createPaperService({season,client,rulesHash:paperRules.ruleHash,now:()=>state.paperNow});
  const tideRules=JSON.parse(await readFile(path.join(app,'build/public/tide-rules.json'),'utf8'));
  const social=createFleetSocialService({season,client,tideHash:tideRules.ruleHash,paperHash:paperRules.ruleHash,now:()=>state.paperNow});
  const api = createApi({season, client, board, paper,social});
  async function paperTick({advance=0,error=false}={}){
    state.paperNow+=advance*PAPER_RULES.interval;
    const result=await tickPaper({DB:db,PAPER_ENABLED:'1'},{rulesHash:paperRules.ruleHash,now:state.paperNow,market:async()=>{
      if(error)throw Error('Fixture market outage.');
      const latest=Math.floor(state.paperNow/PAPER_RULES.interval)*PAPER_RULES.interval-PAPER_RULES.interval;
      return {coin:'@fixture',bars:Array.from({length:100},(_,i)=>{const t=latest-(99-i)*PAPER_RULES.interval,p=200+(t-anchor)/PAPER_RULES.interval*.2;return {t,o:p,h:p+.05,l:p-.05,c:p};})};
    }});
    const tide=await tickTide({DB:db,PAPER_ENABLED:'1',TIDE_ENABLED:'1'},{rulesHash:tideRules.ruleHash,paperHash:paperRules.ruleHash,now:state.paperNow});
    return {...result,tide};
  }
  if(paperEnabled)await paperTick();
  await board.handle({request: new Request('http://fixture.invalid/api/seat', {method: 'POST', headers: {'x-whale-revision': '0', 'x-whale-mutation': crypto.randomUUID()}}), db, me: {address: walletByName.rival}, data: {agents: FIXTURE_HOLDINGS.rival.map((a, i) => ({...a, strategy: i ? 'magnet' : 'breakout'})), collection: 'rarewhales', tokenId: 901, nickname: 'The Fixture Rival', publish: true, ruleHash: scores.ruleHash}});
  const fixtureBundle = await build({entryPoints: [path.join(app, 'tests/fixtures/provider.mjs')], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022'});
  const toolbar = `<aside id="fixture-banner" aria-label="Fixture preview controls" style="position:relative;z-index:999;background:#fff0b1;color:#16233f;border-bottom:3px solid #16233f;padding:12px;font:14px system-ui;display:flex;gap:14px;flex-wrap:wrap;align-items:center"><strong>LOCAL FIXTURE PREVIEW — disposable wallets, simulated NFT ownership; no real holder wallet or production writes. ${paperEnabled?'Paper candles are synthetic test data.':''}</strong><label>Wallet <select id="fixture-wallet"><option value="holder">Holder A · 3 whales</option><option value="second">Holder B · 2 whales</option><option value="empty">No holdings</option></select></label><label>Inventory <select id="fixture-inventory"><option value="normal">Normal</option><option value="error">RPC failure</option><option value="delay">22 second delay</option></select></label><label><input id="fixture-reject" type="checkbox">Reject signature</label><label><input id="fixture-chain" type="checkbox">Wrong chain</label></aside>`;
  async function rpc(request) {
    const mode = state.rpcMode, delay = state.rpcDelayMs;
    const ownership = structuredClone(state.holdings);
    if (delay) await sleep(delay);
    const {id, method, params = []} = request;
    if (mode === 'error') return {jsonrpc: '2.0', id, error: {code: -32000, message: 'Fixture inventory service unavailable.'}};
    let result;
    if (method === 'eth_chainId') result = hex(CHAIN_ID);
    else if (method === 'eth_blockNumber') result = '0x64';
    else if (method === 'eth_call') {
      const read = decodeFunctionData({abi, data: params[0].data});
      const name = collection(params[0].to);
      if (read.functionName === 'balanceOf') {
        const walletName = Object.keys(walletByName).find(key => walletByName[key] === read.args[0].toLowerCase());
        result = encodeAbiParameters([{type: 'uint256'}], [BigInt((ownership[walletName] || []).filter(a => a.collection === name).length)]);
      } else result = encodeAbiParameters([{type: 'address'}], [await client.readContract({address: params[0].to, functionName: 'ownerOf', args: read.args})]);
    } else if (method === 'eth_getLogs') {
      const filter = params[0], name = collection(filter.address), requestedTo = filter.topics?.[2]?.slice(-40).toLowerCase(), requestedFrom = filter.topics?.[1]?.slice(-40).toLowerCase();
      const logs = Object.keys(walletByName).flatMap(walletName => (ownership[walletName] || []).filter(a => a.collection === name).map(a => ({address: COLLECTIONS[name].address, topics: [transferTopic, word(zero), word(walletByName[walletName]), word(hex(a.tokenId))], data: '0x', blockNumber: '0x32', transactionHash: word(hex(a.tokenId + 2000)), transactionIndex: '0x0', blockHash: word('0x1234'), logIndex: hex(a.tokenId), removed: false})));
      result = logs.filter(log => (!requestedTo || log.topics[2].slice(-40) === requestedTo) && (!requestedFrom || log.topics[1].slice(-40) === requestedFrom));
    } else return {jsonrpc: '2.0', id, error: {code: -32601, message: 'Unsupported fixture RPC method: ' + method}};
    return {jsonrpc: '2.0', id, result};
  }
  let origin;
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      const chunks = []; let length = 0;
      for await (const chunk of req) {length += chunk.length; if (length > 16384) throw Error('Request too large.'); chunks.push(chunk);}
      const body = Buffer.concat(chunks), jsonBody = body.length ? JSON.parse(body.toString()) : {};
      const send = (status, value, headers = {}) => {res.writeHead(status, {'cache-control': 'no-store', ...headers}); res.end(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value));};
      if(pathname==='/__fixture/paper'&&req.method==='POST'){if(req.headers.origin!==origin)return send(403,'Use the fixture preview.');const advance=Math.max(0,Math.min(10,Number(jsonBody.advance)||0));return send(200,await paperTick({advance,error:jsonBody.error===true}),{'content-type':'application/json'});}
      if (pathname === '/__fixture/rpc' && req.method === 'POST') return send(200, Array.isArray(jsonBody) ? await Promise.all(jsonBody.map(rpc)) : await rpc(jsonBody), {'content-type': 'application/json'});
      if (pathname === '/__fixture/control') {
        if (req.method === 'POST') {
          if (req.headers.origin !== origin) return send(403, 'Use the local fixture preview.');
          for (const key of ['rpcMode', 'rpcDelayMs', 'responseDelayMs', 'delayPath', 'writeMode', 'reverseEntries']) if (Object.hasOwn(jsonBody, key)) state[key] = jsonBody[key];
          if (jsonBody.holdings) for (const [name, holdings] of Object.entries(jsonBody.holdings)) if (Object.hasOwn(walletByName, name)) state.holdings[name] = holdings;
        }
        return send(200, {fixture: true, ...state, wallets: walletByName}, {'content-type': 'application/json'});
      }
      if (pathname === '/__fixture/provider.js') return send(200, Buffer.from(fixtureBundle.outputFiles[0].contents), {'content-type': 'text/javascript'});
      if (pathname.startsWith('/api/')) {
        state.requests.push({path: pathname, method: req.method, at: Date.now()});
        if (state.responseDelayMs && pathname === state.delayPath) await sleep(state.responseDelayMs);
        const request = new Request(origin + req.url, {method: req.method, headers: req.headers, ...(!['GET', 'HEAD'].includes(req.method) ? {body} : {})});
        if (pathname === '/api/seat' && req.method !== 'GET' && state.writeMode === 'reject') return send(503, {error: 'Fixture ownership check unavailable. Your published company has not changed.'}, {'content-type': 'application/json'});
        const response = await api(request, {DB: db, APP_ORIGIN: origin,PAPER_ENABLED:paperEnabled?'1':'0',TIDE_ENABLED:paperEnabled?'1':'0'});
        if (pathname === '/api/seat' && req.method === 'POST' && state.writeMode === 'unknown') {res.destroy(); return;}
        let responseBody = Buffer.from(await response.arrayBuffer());
        if (pathname === '/api/club' && state.reverseEntries && response.status === 200) {
          const result = JSON.parse(responseBody.toString());
          if (result.me?.seat?.agents) result.me.seat.agents.reverse();
          responseBody = Buffer.from(JSON.stringify(result));
        }
        return send(response.status, responseBody, Object.fromEntries(response.headers));
      }
      const name = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (!/^[a-zA-Z0-9/_.-]+$/.test(name) || name.includes('..')) return send(404, 'Not found');
      let contents = await readFile(path.join(app, 'build/public', name));
      if (name === 'index.html') contents = contents.toString().replace('<body>', '<body>' + toolbar + '<script src="/__fixture/provider.js"></script>');
      return send(200, req.method === 'HEAD' ? '' : contents, {'content-type': mime[path.extname(name)] || 'application/octet-stream'});
    } catch (error) {
      if (!res.headersSent) {res.writeHead(error.code === 'ENOENT' ? 404 : 500); res.end('Fixture preview unavailable.');}
      else res.destroy();
    }
  });
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(port, '127.0.0.1', resolve);});
  origin = `http://127.0.0.1:${server.address().port}`;
  return {origin, state, db, paperTick, close: async () => {server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); db.close();}};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const fixture = await startFixtureServer();
  console.log(`Whale Pools fixture preview: ${fixture.origin}/ (disposable in-memory state; no production writes)`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {await fixture.close(); process.exit(0);});
}
