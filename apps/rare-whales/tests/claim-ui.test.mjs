import test from 'node:test';
import assert from 'node:assert/strict';
import {keccak256} from 'viem';
import {initClaims} from '../public/claims.mjs';
import {CLAIM_RULES} from '../src/claims.mjs';
import {COLLECTIONS} from '../src/config.mjs';
import {claimLogs} from './claim-fixtures.mjs';

// DOM event boundary test doubles. Real EVM behavior is covered separately on Anvil.
test('claim controller fails closed and rechecks wallet and allowance before sending',async()=>{
 const owner='0x1111111111111111111111111111111111111111',other='0x2222222222222222222222222222222222222222',address='0x3333333333333333333333333333333333333333',hash='0x'+'1'.repeat(64);
 let fields,account,chain,nftOwner,claimed,sendCount,sent,receiptStatus,writeError,nodes,events,replacement,blockTime;
 const setup=async({pending=false}={})=>{
  nodes={};events={};account=owner;chain='0x1237';nftOwner=owner;claimed=0n;sendCount=0;receiptStatus='success';writeError=null;replacement=null;blockTime=1000n;
  globalThis.document={querySelector(id){return nodes[id]??=( {textContent:'',value:'',hidden:true,disabled:true,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}});}};
  fields={token:other,treasury:owner,startsAt:1000n,endsAt:1000n+12n*CLAIM_RULES.period,REWARD:CLAIM_RULES.reward,FEE:CLAIM_RULES.fee,PERIOD:CLAIM_RULES.period,PERIODS:12n,MAX_BATCH:20n,INITIAL_SUPPLY:CLAIM_RULES.supply,RARE_WHALES:COLLECTIONS.rarewhales.address,WHALESTREET:COLLECTIONS.whalestreet.address};
  const provider={on:(name,fn)=>events[name]=fn,request:async({method})=>method==='eth_chainId'?chain:[account]};
  const client={getChainId:async()=>4663,getTransactionReceipt:async()=>({status:'success',contractAddress:address,blockNumber:40n}),getTransaction:async()=>({from:owner,to:null,input:'0x1234'}),getBlock:async()=>({number:42n,timestamp:blockTime}),getCode:async()=>'0x12',readContract:async r=>r.functionName==='ownerOf'?nftOwner:r.functionName==='claimedPeriods'?claimed:r.functionName==='balanceOf'?0n:fields[r.functionName],simulateContract:async r=>({request:r}),estimateContractGas:async()=>100000n,getGasPrice:async()=>1000000n,waitForTransactionReceipt:async options=>{const receipt={status:receiptStatus,transactionHash:replacement?'0x'+'2'.repeat(64):hash,logs:replacement==='cancelled'?[]:claimLogs(address,other,owner,[{collection:COLLECTIONS.rarewhales.address,tokenId:1n},{collection:COLLECTIONS.whalestreet.address,tokenId:1n}],0n,2n*CLAIM_RULES.reward)};if(replacement)options.onReplaced({reason:replacement,transactionReceipt:receipt});return receipt;}};
  await initClaims({client,getProvider:()=>provider,loadManifest:async()=>({chainId:4663,creationCodeHash:keccak256('0x1234'),deployment:pending?null:{address,transactionHash:hash}}),walletFactory:()=>({writeContract:async r=>{if(writeError)throw writeError;sendCount++;sent=r;return hash;}})});
 };
 const connect=()=>nodes['#claim-connect'].onclick();
 const check=async()=>{nodes['#claim-rare'].value='1';nodes['#claim-street'].value='1';await nodes['#claim-check'].onclick();};
 try{
  await setup({pending:true});assert.match(nodes['#claim-message'].textContent,/payments are closed/);assert.equal(nodes['#claim-connect'],undefined);
  await setup();await connect();await check();assert.equal(nodes['#claim-send'].disabled,false);assert.match(nodes['#claim-review-text'].textContent,/200 WWAX.*0.0002 ETH/);
  await nodes['#claim-send'].onclick();assert.equal(sendCount,1);assert.equal(sent.value,2n*CLAIM_RULES.fee);assert.deepEqual(sent.args[1],[1n,1n]);assert.equal(sent.args[2],0n);assert.match(nodes['#claim-message'].textContent,/Confirmed: 200/);assert.equal(nodes['#claim-send'].disabled,true);
  await setup();chain='0x1';await connect();assert.match(nodes['#claim-message'].textContent,/Switch your wallet/);assert.equal(nodes['#claim-check'].disabled,true);
  await setup();await connect();await check();account=other;events.accountsChanged();assert.equal(nodes['#claim-send'].disabled,true);assert.equal(nodes['#claim-check'].disabled,true);
  await setup();await connect();await check();nodes['#claim-rare'].listeners.input();assert.equal(nodes['#claim-send'].disabled,true);
  await setup();await connect();await check();nftOwner=other;await nodes['#claim-send'].onclick();assert.equal(sendCount,0);assert.match(nodes['#claim-message'].textContent,/not in this wallet/);
  await setup();await connect();await check();claimed=1n;await nodes['#claim-send'].onclick();assert.equal(sendCount,0);assert.match(nodes['#claim-message'].textContent,/already claimed/);
  await setup();await connect();await check();writeError=Error('User rejected the request');await nodes['#claim-send'].onclick();assert.equal(sendCount,0);assert.match(nodes['#claim-message'].textContent,/User rejected/);assert.equal(nodes['#claim-send'].disabled,true);
  await setup();await connect();await check();receiptStatus='reverted';await nodes['#claim-send'].onclick();assert.equal(sendCount,1);assert.match(nodes['#claim-message'].textContent,/Transaction reverted/);assert.equal(nodes['#claim-transaction'].hidden,false);
  await setup();await connect();await check();replacement='cancelled';await nodes['#claim-send'].onclick();assert.match(nodes['#claim-message'].textContent,/No matching WWAX payout/);assert.ok(nodes['#claim-transaction'].href.endsWith('2'.repeat(64)));
  await setup();await connect();await check();replacement='repriced';await nodes['#claim-send'].onclick();assert.match(nodes['#claim-message'].textContent,/Confirmed: 200/);assert.ok(nodes['#claim-transaction'].href.endsWith('2'.repeat(64)));
  await setup();await connect();await check();blockTime+=CLAIM_RULES.period;await nodes['#claim-send'].onclick();assert.equal(sendCount,0);assert.match(nodes['#claim-message'].textContent,/new period started/);
 }finally{delete globalThis.document;}
});
