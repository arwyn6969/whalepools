import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createPublicClient,createWalletClient,http,parseEther,getContractAddress} from 'viem';
import {compileContracts} from './compile-contracts.mjs';
const artifacts=await compileContracts(),C=artifacts.contracts;
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const processAnvil=spawn(process.env.ANVIL_BIN||'anvil',['--host','127.0.0.1','--port',String(port),'--chain-id','31337','--silent'],{stdio:['ignore','pipe','pipe']});
let failure;processAnvil.on('error',e=>failure=e);
const transport=http('http://127.0.0.1:'+port,{retryCount:0,timeout:1000});
const client=createPublicClient({transport,pollingInterval:20}),wallet=createWalletClient({transport});
let cases=0;
const check=async(name,fn)=>{await fn();cases++;console.log('PASS '+name);};
const read=(address,name,args=[],type='WhaleWaxClaims')=>client.readContract({address,abi:C[type].abi,functionName:name,args});
const write=async(address,name,args=[],account,value=0n,type='WhaleWaxClaims')=>{
 if(name==='claim'&&args.length===2)args=[...args,0n]; // Defaults to the first global period in these fixtures.
 const {request}=await client.simulateContract({address,abi:C[type].abi,functionName:name,args,account,value});
 const hash=await wallet.writeContract({...request,chain:null});const r=await client.waitForTransactionReceipt({hash});assert.equal(r.status,'success');return r;
};
const reject=(address,name,args,account,value=0n,type='WhaleWaxClaims')=>assert.rejects(()=>client.simulateContract({address,abi:C[type].abi,functionName:name,args:name==='claim'&&args.length===2?[...args,0n]:args,account,value}));
const at=async timestamp=>{await client.request({method:'evm_setNextBlockTimestamp',params:[Number(timestamp)]});await client.request({method:'evm_mine',params:[]});};
const deploy=async(name,account)=>{const hash=await wallet.deployContract({abi:C[name].abi,bytecode:C[name].bytecode,account,chain:null});return (await client.waitForTransactionReceipt({hash})).contractAddress;};
try{
 let ready=false;for(let i=0;i<50;i++){if(failure)throw failure;try{await client.getChainId();ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}
 assert.ok(ready,'Anvil must be installed and ready');
 const [captain,alice,bob]=await wallet.getAddresses(),d=await deploy('WhaleWaxClaims',captain);
 const rare=await read(d,'RARE_WHALES'),street=await read(d,'WHALESTREET'),token=await read(d,'token');
 for(const address of [rare,street])await client.request({method:'anvil_setCode',params:[address,C.TestNFT.deployedBytecode]});
 const own=(collection,id,owner)=>write(collection,'setOwner',[BigInt(id),owner],captain,0n,'TestNFT');
 await own(rare,1,alice);await own(rare,2,alice);await own(street,1,alice);
 const start=await read(d,'startsAt'),end=await read(d,'endsAt'),fee=parseEther('0.0001'),reward=parseEther('100'),supply=parseEther('4486800');
 await check('fixed supply fully reserved; no team premint',async()=>{assert.equal(await read(token,'totalSupply',[],'WhaleWax'),supply);assert.equal(await read(token,'balanceOf',[d],'WhaleWax'),supply);assert.equal(await read(d,'treasury'),captain);assert.equal(end-start,12n*30n*86400n);});
 await check('opening delay blocks early claims and reserve burn',async()=>{await reject(d,'claim',[[rare],[1n]],alice,fee);await reject(d,'burnExpiredReserve',[],bob);});
 await at(start);
 await check('exact start is period zero',async()=>assert.equal(await read(d,'currentPeriod'),0n));
 await check('ownership, identity bounds, unknown collections and nonexistent NFTs reject',async()=>{
  for(const [collection,id,owner]of [[rare,1,bob],[rare,0,alice],[rare,421,alice],[street,3320,alice],[token,1,alice],[rare,3,alice]])await reject(d,'claim',[[collection],[BigInt(id)]],owner,fee);
 });
 await check('empty, mismatched and oversized batches reject',async()=>{await reject(d,'claim',[[],[]],alice);await reject(d,'claim',[[rare],[]],alice);await reject(d,'claim',[Array(21).fill(rare),Array(21).fill(1n)],alice,fee*21n);});
 await check('underpayment and overpayment reject',async()=>{await reject(d,'claim',[[rare],[1n]],alice,fee-1n);await reject(d,'claim',[[rare],[1n]],alice,fee+1n);});
 await check('duplicate batch rejects atomically',async()=>{await reject(d,'claim',[[rare,rare],[1n,1n]],alice,fee*2n);assert.equal(await read(d,'claimedPeriods',[rare,1n]),0n);});
 await check('a mined invalid batch reverts all state, reward and project fee',async()=>{const before=await client.getBalance({address:d});const hash=await wallet.writeContract({address:d,abi:C.WhaleWaxClaims.abi,functionName:'claim',args:[[rare,rare],[1n,1n],0n],account:alice,value:fee*2n,gas:500000n,chain:null});const receipt=await client.waitForTransactionReceipt({hash});assert.equal(receipt.status,'reverted');assert.equal(receipt.logs.length,0);assert.equal(await read(d,'claimedPeriods',[rare,1n]),0n);assert.equal(await client.getBalance({address:d}),before);assert.equal(await read(token,'balanceOf',[alice],'WhaleWax'),0n);});
 await check('claim is bound to the period reviewed by the holder',async()=>{await reject(d,'claim',[[rare],[1n],1n],alice,fee);});
 await check('mixed collections receive the exact tokens and retain NFTs',async()=>{await write(d,'claim',[[rare,street],[1n,1n]],alice,fee*2n);assert.equal(await read(token,'balanceOf',[alice],'WhaleWax'),2n*reward);assert.equal(await client.getBalance({address:d}),fee*2n);assert.equal(await read(rare,'ownerOf',[1n],'TestNFT'),alice);});
 await check('second claim and post-transfer double claim reject',async()=>{await reject(d,'claim',[[rare],[1n]],alice,fee);await own(rare,1,bob);await reject(d,'claim',[[rare],[1n]],bob,fee);});
 await check('invalid later batch entry preserves earlier entitlement and balance',async()=>{await reject(d,'claim',[[rare,street],[2n,2n]],alice,fee*2n);assert.equal(await read(d,'claimedPeriods',[rare,2n]),0n);});
 await check('permissionless fee withdrawal pays only deployer',async()=>{const before=await client.getBalance({address:captain});await write(d,'withdrawFees',[],bob);assert.equal(await client.getBalance({address:captain}),before+2n*fee);assert.equal(await client.getBalance({address:d}),0n);});
 await at(start+30n*86400n-1n);
 await check('last second of period still rejects repeated NFT',async()=>{assert.equal(await read(d,'currentPeriod'),0n);await reject(d,'claim',[[rare],[1n]],bob,fee);});
 await at(start+30n*86400n);
 await check('new owner claims at next period; previous owner cannot',async()=>{assert.equal(await read(d,'currentPeriod'),1n);await reject(d,'claim',[[rare],[1n],0n],bob,fee);await reject(d,'claim',[[rare],[1n],1n],alice,fee);await write(d,'claim',[[rare],[1n],1n],bob,fee);assert.equal(await read(d,'claimedPeriods',[rare,1n]),3n);});
 await at(start+11n*30n*86400n);
 await check('skipped periods do not accumulate',async()=>{const before=await read(token,'balanceOf',[alice],'WhaleWax');await write(d,'claim',[[rare],[2n],11n],alice,fee);assert.equal(await read(token,'balanceOf',[alice],'WhaleWax'),before+reward);});
 await check('holders may transfer WWAX without tax or approvals',async()=>{await write(token,'transfer',[bob,reward],alice,0n,'WhaleWax');assert.equal(await read(token,'balanceOf',[bob],'WhaleWax'),2n*reward);await reject(token,'burnReserve',[1n],alice,0n,'WhaleWax');});
 await at(end);
 await check('exact end rejects claims and burns only remaining reserve',async()=>{await reject(d,'claim',[[rare],[1n]],bob,fee);await write(d,'burnExpiredReserve',[],bob);assert.equal(await read(token,'balanceOf',[d],'WhaleWax'),0n);assert.equal(await read(token,'totalSupply',[],'WhaleWax'),4n*reward);});
 await check('full 20-NFT batch works',async()=>{const fresh=await deploy('WhaleWaxClaims',captain);const ids=Array.from({length:20},(_,i)=>BigInt(i+10));for(const id of ids)await own(street,id,alice);await at(await read(fresh,'startsAt'));await write(fresh,'claim',[Array(20).fill(street),ids],alice,fee*20n);assert.equal(await read(await read(fresh,'token'),'balanceOf',[alice],'WhaleWax'),reward*20n);});
 await check('rejecting treasury cannot block claims',async()=>{const factory=await deploy('RejectingTreasury',captain);const nonce=await client.getTransactionCount({address:factory});const fresh=getContractAddress({from:factory,nonce:BigInt(nonce)});await write(factory,'deploy',[C.WhaleWaxClaims.bytecode],captain,0n,'RejectingTreasury');await own(rare,1,alice);await at(await read(fresh,'startsAt'));await write(fresh,'claim',[[rare],[1n]],alice,fee);await reject(fresh,'withdrawFees',[],bob);assert.equal(await read(await read(fresh,'token'),'balanceOf',[alice],'WhaleWax'),reward);});
 await check('treasury reentrancy cannot withdraw twice',async()=>{const factory=await deploy('ReenteringTreasury',captain);await write(factory,'deploy',[C.WhaleWaxClaims.bytecode],captain,0n,'ReenteringTreasury');const fresh=await read(factory,'claims',[],'ReenteringTreasury');await at(await read(fresh,'startsAt'));await write(fresh,'claim',[[rare],[1n]],alice,fee);await write(fresh,'withdrawFees',[],bob);assert.equal(await read(factory,'attempted',[],'ReenteringTreasury'),true);assert.equal(await read(factory,'reentered',[],'ReenteringTreasury'),false);assert.equal(await client.getBalance({address:factory}),fee);});
 await check('all twelve periods conserve supply and fees across transferred NFTs',async()=>{
  const fresh=await deploy('WhaleWaxClaims',captain),wax=await read(fresh,'token'),opening=await read(fresh,'startsAt');
  for(let period=0n;period<12n;period++){
   const holder=period%2n===0n?alice:bob;await own(rare,420,holder);await own(street,3319,holder);await at(opening+period*30n*86400n);
   await write(fresh,'claim',[[rare,street],[420n,3319n],period],holder,2n*fee);
   await reject(fresh,'claim',[[rare],[420n],period],holder,fee);
   assert.equal(await read(fresh,'claimedPeriods',[rare,420n]),(1n<<(period+1n))-1n);
   assert.equal(await read(wax,'balanceOf',[fresh],'WhaleWax'),supply-2n*reward*(period+1n));
  }
  assert.equal(await read(wax,'balanceOf',[alice],'WhaleWax'),12n*reward);assert.equal(await read(wax,'balanceOf',[bob],'WhaleWax'),12n*reward);
  assert.equal(await client.getBalance({address:fresh}),24n*fee);await at(await read(fresh,'endsAt'));await write(fresh,'burnExpiredReserve',[],bob);assert.equal(await read(wax,'totalSupply',[],'WhaleWax'),24n*reward);await write(fresh,'withdrawFees',[],bob);assert.equal(await client.getBalance({address:fresh}),0n);
 });
 console.log(`${cases} local-chain integration cases passed. No mainnet transaction was sent.`);
}finally{processAnvil.kill('SIGTERM');}
