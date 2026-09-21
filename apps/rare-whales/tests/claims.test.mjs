import test from 'node:test';
import assert from 'node:assert/strict';
import {keccak256} from 'viem';
import {parseClaimIDs,periodAt,verifyDeployment,quoteClaim,CLAIM_RULES} from '../src/claims.mjs';
import {COLLECTIONS} from '../src/config.mjs';
const owner='0x1111111111111111111111111111111111111111',other='0x2222222222222222222222222222222222222222',address='0x3333333333333333333333333333333333333333';
test('claim input strictly accepts mixed NFT IDs within the frozen mint bounds',()=>{
 assert.equal(parseClaimIDs('1, 420','1 3319').length,4);
 for(const [r,s] of [['',''],['0',''],['421',''],['','3320'],['01',''],['1e2',''],['1,1',''],['-1',''],[Array.from({length:21},(_,i)=>i+1).join(','),'']])assert.throws(()=>parseClaimIDs(r,s));
 assert.equal(parseClaimIDs('1','1').length,2);
});
test('global periods have exact inclusive start and exclusive end',()=>{
 const start=1000n,end=start+CLAIM_RULES.period*12n;
 assert.throws(()=>periodAt(start-1n,start,end));assert.equal(periodAt(start,start,end),0n);assert.equal(periodAt(start+CLAIM_RULES.period,start,end),1n);assert.equal(periodAt(end-1n,start,end),11n);assert.throws(()=>periodAt(end,start,end));
});
test('claim quotes use one block, verify each owner, and use NFT-wide period bits',async()=>{
 const deployment={address,startsAt:1000n,endsAt:1000n+12n*CLAIM_RULES.period};const nfts=parseClaimIDs('1','1'),seen=[];
 const client={getBlock:async()=>({timestamp:1000n,number:42n}),readContract:async r=>{seen.push(r.blockNumber);return r.functionName==='ownerOf'?owner:0n;}};
 const q=await quoteClaim(client,deployment,owner,nfts);assert.equal(q.value,2n*CLAIM_RULES.fee);assert.equal(q.reward,2n*CLAIM_RULES.reward);assert.deepEqual(seen,[42n,42n,42n,42n]);
 client.readContract=async r=>r.functionName==='ownerOf'?other:0n;await assert.rejects(()=>quoteClaim(client,deployment,owner,nfts),/not in this wallet/);
 client.readContract=async r=>r.functionName==='ownerOf'?owner:1n;await assert.rejects(()=>quoteClaim(client,deployment,owner,nfts),/already claimed/);
});
test('deployment gate rejects absence, wrong code, chain, pending confirmations and altered rules',async()=>{
 const fields={token:other,treasury:owner,startsAt:1000n,endsAt:1000n+12n*CLAIM_RULES.period,REWARD:CLAIM_RULES.reward,FEE:CLAIM_RULES.fee,PERIOD:CLAIM_RULES.period,PERIODS:12n,MAX_BATCH:20n,INITIAL_SUPPLY:CLAIM_RULES.supply,RARE_WHALES:COLLECTIONS.rarewhales.address,WHALESTREET:COLLECTIONS.whalestreet.address};
 const manifest={chainId:4663,creationCodeHash:keccak256('0x1234'),deployment:{address,transactionHash:'0x'+'1'.repeat(64)}};
 const client={getChainId:async()=>4663,getTransactionReceipt:async()=>({status:'success',contractAddress:address,blockNumber:40n}),getTransaction:async()=>({from:owner,to:null,input:'0x1234'}),getBlock:async()=>({number:42n}),getCode:async()=>'0x12',readContract:async r=>fields[r.functionName]};
 assert.equal((await verifyDeployment(client,manifest)).address,address);
 await assert.rejects(()=>verifyDeployment(client,{...manifest,deployment:null}),/pending/);
 await assert.rejects(()=>verifyDeployment(client,{...manifest,chainId:1}),/Wrong chain/);
 await assert.rejects(()=>verifyDeployment({...client,getChainId:async()=>1},manifest),/Wrong chain/);
 await assert.rejects(()=>verifyDeployment(client,{...manifest,creationCodeHash:keccak256('0xab')}),/reviewed build/);
 await assert.rejects(()=>verifyDeployment({...client,getBlock:async()=>({number:41n})},manifest),/confirmations/);
 await assert.rejects(()=>verifyDeployment({...client,getTransaction:async()=>({from:owner,to:other,input:'0x1234'})},manifest),/reviewed build/);
 fields.FEE=0n;await assert.rejects(()=>verifyDeployment(client,manifest),/settings/);
});
