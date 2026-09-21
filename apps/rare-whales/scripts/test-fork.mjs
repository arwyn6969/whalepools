import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {readFile} from 'node:fs/promises';
import {createPublicClient,createWalletClient,http,parseEther} from 'viem';
import {compileContracts} from './compile-contracts.mjs';
import {COLLECTIONS,RPC_URL} from '../src/config.mjs';
import {nftAbi,verifyClaimReceipt} from '../src/claims.mjs';
const snapshot=JSON.parse(await readFile(new URL('../contracts/eligibility.json',import.meta.url)));
const artifacts=await compileContracts(),C=artifacts.contracts;
const remote=createPublicClient({transport:http(RPC_URL)});
assert.equal(await remote.getChainId(),4663);
const snapshotBlock=await remote.getBlock({blockNumber:BigInt(snapshot.block)});assert.equal(snapshotBlock.hash,snapshot.blockHash);
// Public RPC prunes older account state. Fork a fresh block; eligibility remains the fixed mint snapshot.
const block=await remote.getBlock();console.log('Fork reference block '+block.number+' / '+block.hash);
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const anvil=spawn(process.env.ANVIL_BIN||'anvil',['--host','127.0.0.1','--port',String(port),'--chain-id','31337','--fork-url',RPC_URL,'--fork-block-number',String(block.number),'--silent'],{stdio:['ignore','pipe','pipe']});
let failure,diagnostic='';anvil.on('error',e=>failure=e);anvil.stderr.on('data',x=>{diagnostic=(diagnostic+x.toString()).slice(-1800);});
const transport=http('http://127.0.0.1:'+port,{retryCount:0,timeout:25000}),client=createPublicClient({transport,pollingInterval:50}),wallet=createWalletClient({transport});
try{
 let ready=false;for(let i=0;i<300;i++){if(failure)throw failure;if(anvil.exitCode!==null)throw Error('Fork failed: '+diagnostic);try{await client.getChainId();ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(ready,'Fork must start: '+diagnostic);
 assert.equal(await client.getChainId(),31337); // All writes are to the loopback fork only.
 const [deployer]=await wallet.getAddresses();
 const hash=await wallet.deployContract({account:deployer,chain:null,abi:C.WhaleWaxClaims.abi,bytecode:C.WhaleWaxClaims.bytecode});
 const deployed=await client.waitForTransactionReceipt({hash});assert.equal(deployed.status,'success');const address=deployed.contractAddress;
 const read=functionName=>client.readContract({address,abi:C.WhaleWaxClaims.abi,functionName});
 const opening=await read('startsAt'),token=await read('token');await client.request({method:'evm_setNextBlockTimestamp',params:[Number(opening)]});await client.request({method:'evm_mine',params:[]});
 for(const [key,id]of [['rarewhales',1n],['rarewhales',420n],['whalestreet',1n],['whalestreet',3319n]]){
  const collection=COLLECTIONS[key].address;const owner=await client.readContract({address:collection,abi:nftAbi,functionName:'ownerOf',args:[id]});
  await client.request({method:'anvil_impersonateAccount',params:[owner]});await client.request({method:'anvil_setBalance',params:[owner,'0xDE0B6B3A7640000']});
  const args=[[collection],[id],0n],value=parseEther('0.0001');const {request}=await client.simulateContract({account:owner,address,abi:C.WhaleWaxClaims.abi,functionName:'claim',args,value});
  const tx=await wallet.writeContract({...request,chain:null});const receipt=await client.waitForTransactionReceipt({hash:tx});assert.equal(receipt.status,'success');
  verifyClaimReceipt(receipt,{address,token},{account:owner,period:0n,nfts:[{collection,tokenId:id}],reward:parseEther('100')});
  assert.equal(await client.readContract({address:collection,abi:nftAbi,functionName:'ownerOf',args:[id]}),owner);
  await assert.rejects(()=>client.simulateContract({account:owner,address,abi:C.WhaleWaxClaims.abi,functionName:'claim',args,value}));
  await client.request({method:'anvil_stopImpersonatingAccount',params:[owner]});
  console.log(`PASS real ${key} #${id} on isolated Robinhood fork; ownership retained; payout events verified; repeat rejected; gas ${receipt.gasUsed}`);
 }
 assert.equal(await client.getBalance({address}),parseEther('0.0004'));
 console.log('4 Robinhood-fork claims passed. No live chain writes, fees or signatures.');
}finally{anvil.kill('SIGTERM');}
