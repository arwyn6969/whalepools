import test from 'node:test';
import assert from 'node:assert/strict';
import {keccak256} from 'viem';
import {initLaunch,validateLaunchPackage} from '../operator/launch.mjs';
import {CLAIM_RULES} from '../src/claims.mjs';
import {COLLECTIONS} from '../src/config.mjs';
const owner='0x1111111111111111111111111111111111111111',other='0x2222222222222222222222222222222222222222',address='0x3333333333333333333333333333333333333333',hash='0x'+'a'.repeat(64),nextHash='0x'+'b'.repeat(64),KEY='wwax-deployment-submitted-v1';
const recipe=()=>({version:1,chainId:4663,bytecode:'0x1234',creationCodeHash:keccak256('0x1234'),compiler:'test fixture',sourceSha256:'test fixture',eligibility:{block:'1'}});
test('launch package rejects bad chain and bytecode before any wallet request',()=>{
 assert.equal(validateLaunchPackage(recipe()).chainId,4663);
 assert.throws(()=>validateLaunchPackage({...recipe(),chainId:1}));assert.throws(()=>validateLaunchPackage({...recipe(),bytecode:'0xabcd'}));
});
test('operator handles wallet rejection, uncertain submission, replacement, stale builds and storage failures',async()=>{
 let nodes,events,account,chain,config,error,replacement,receiptStatus,sendCount,request,storageValue,storageFails,estimateHook,initialAccountEvent;
 const setup=async({prior=null,storageUnavailable=false}={})=>{
  nodes={};events={};account=owner;chain='0x1237';config=recipe();error=null;replacement=null;receiptStatus='success';sendCount=0;storageValue=prior;storageFails=storageUnavailable;estimateHook=null;initialAccountEvent=false;
  globalThis.document={getElementById(id){return nodes[id]??={textContent:'',hidden:true,disabled:true};}};
  const fields={token:other,treasury:owner,startsAt:1000n,endsAt:1000n+12n*CLAIM_RULES.period,REWARD:CLAIM_RULES.reward,FEE:CLAIM_RULES.fee,PERIOD:CLAIM_RULES.period,PERIODS:12n,MAX_BATCH:20n,INITIAL_SUPPLY:CLAIM_RULES.supply,RARE_WHALES:COLLECTIONS.rarewhales.address,WHALESTREET:COLLECTIONS.whalestreet.address};
  const storage={getItem(){if(storageFails)throw Error('Storage unavailable');return storageValue;},setItem(key,value){assert.equal(key,KEY);if(storageFails)throw Error('Storage unavailable');storageValue=value;}};
  const provider={on:(name,fn)=>events[name]=fn,request:async r=>{if(r.method==='eth_sendTransaction'){sendCount++;request=r;assert.match(storageValue,/^unknown:/);if(error)throw error;return hash;}if(r.method==='eth_chainId')return chain;if(initialAccountEvent&&r.method==='eth_requestAccounts')events.accountsChanged();return [account];}};
  const client={getChainId:async()=>4663,estimateGas:async()=>{await estimateHook?.();return 2000000n;},getGasPrice:async()=>1000000n,getTransactionReceipt:async({hash:txHash})=>({status:'success',contractAddress:address,blockNumber:40n,transactionHash:txHash}),getTransaction:async()=>({from:owner,to:null,input:'0x1234'}),getBlock:async()=>({number:41n}),getCode:async()=>'0x12',readContract:async r=>fields[r.functionName],waitForTransactionReceipt:async options=>{const r={status:receiptStatus,transactionHash:replacement?nextHash:hash,contractAddress:replacement==='cancelled'?null:address,blockNumber:40n};if(replacement)options.onReplaced({reason:replacement,transactionReceipt:r});return r;}};
  await initLaunch({client,storage,getProvider:()=>provider,loadPackage:async()=>({...config})});
 };
 const connect=()=>nodes.connect.onclick(),deploy=()=>nodes.deploy.onclick();
 try{
  await setup();initialAccountEvent=true;await connect();assert.equal(nodes.deploy.disabled,false);await deploy();assert.equal(sendCount,1);assert.equal(request.params[0].value,'0x0');assert.equal(request.params[0].chainId,'0x1237');assert.equal(storageValue,hash);assert.match(nodes.status.textContent,/confirmed and settings verified/);await deploy();assert.equal(sendCount,1);
  await setup();chain='0x1';await connect();assert.equal(nodes.deploy.disabled,true);assert.match(nodes.status.textContent,/chain changed/);
  await setup();await connect();error=Object.assign(Error('User rejected'),{code:4001});await deploy();assert.equal(nodes.connect.disabled,false);assert.equal(storageValue,'resolved:rejected');
  await setup();await connect();error=Error('Transport timed out');await deploy();assert.match(storageValue,/^unknown:/);assert.equal(nodes.connect.disabled,true);await deploy();assert.equal(sendCount,1);
  await setup({prior:'unknown:'+owner});assert.match(nodes.status.textContent,/unknown outcome/);assert.equal(nodes.connect,undefined);
  await setup();await connect();replacement='repriced';await deploy();assert.equal(storageValue,nextHash);assert.match(nodes.result.textContent,new RegExp(nextHash));assert.match(nodes.status.textContent,/confirmed and settings verified/);
  await setup();await connect();replacement='cancelled';await deploy();assert.equal(storageValue,'resolved:'+nextHash);assert.match(nodes.status.textContent,/was cancelled/);assert.equal(nodes.connect.disabled,false);
  await setup();await connect();receiptStatus='reverted';await deploy();assert.match(nodes.status.textContent,/reverted/);assert.equal(nodes.connect.disabled,false);
  await setup();await connect();config={...recipe(),bytecode:'0xabcd',creationCodeHash:keccak256('0xabcd')};await deploy();assert.equal(sendCount,0);assert.match(nodes.status.textContent,/build changed/);
  await setup();await connect();storageValue=hash;await deploy();assert.equal(sendCount,0);assert.match(nodes.status.textContent,/Another deployment/);
  await setup();await connect();storageFails=true;await deploy();assert.equal(sendCount,0);assert.match(nodes.status.textContent,/Storage unavailable/);
  await setup({storageUnavailable:true});assert.match(nodes.status.textContent,/Storage unavailable/);assert.equal(nodes.connect,undefined);
  await setup();estimateHook=async()=>{account=other;events.accountsChanged();};await connect();assert.equal(nodes.deploy.disabled,true);assert.match(nodes.status.textContent,/changed/);
 }finally{delete globalThis.document;}
});
