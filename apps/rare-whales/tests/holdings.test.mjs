import test from 'node:test';import assert from 'node:assert/strict';
import {ownedFromTransfers,loadHoldings} from '../src/holdings.mjs';
import {inventoryItems,retainOwned,chooseCaptain} from '../public/owned-crew.mjs';
import {COLLECTIONS} from '../src/config.mjs';
const owner='0x1111111111111111111111111111111111111111',other='0x2222222222222222222222222222222222222222';
const log=(id,from,to,block,index=0)=>({args:{tokenId:BigInt(id),from,to},blockNumber:BigInt(block),logIndex:index});
test('holdings reconstruction handles transfers away, reacquisition, same-block ordering and duplicated self transfers',()=>{
 const self=log(3,owner,owner,8,1),logs=[log(1,other,owner,1),log(1,owner,other,2),log(2,other,owner,3),log(2,owner,other,4),log(2,other,owner,5),log(3,other,owner,6),self,self,log(4,other,owner,9,0),log(4,owner,other,9,1)];
 assert.deepEqual(ownedFromTransfers(owner,logs.toReversed(),2n),[2,3]);assert.throws(()=>ownedFromTransfers(owner,logs,3n),/balance/);assert.throws(()=>ownedFromTransfers(owner,[{...logs[0],removed:true}],1n),/Incomplete/);
});
test('holdings read both collections at one block and reject wrong networks or incomplete log results',async()=>{
 const reads=[],client={getChainId:async()=>4663,getBlockNumber:async()=>100n,readContract:async p=>{reads.push(p);return p.functionName==='ownerOf'?owner:1n;}},logClient={getChainId:async()=>4663,getLogs:async p=>{reads.push(p);return p.args.to?[log(p.address===COLLECTIONS.rarewhales.address?245:1,other,owner,10)]:[];}};
 const r=await loadHoldings({address:owner,client,logClient});assert.deepEqual(r.items,[{collection:'rarewhales',tokenId:245},{collection:'whalestreet',tokenId:1}]);assert.equal(r.block,'98');assert.ok(reads.every(p=>(p.blockNumber??p.toBlock)===98n));
 await assert.rejects(loadHoldings({address:owner,client,logClient:{...logClient,getChainId:async()=>1}}),/network/);
 await assert.rejects(loadHoldings({address:owner,client,logClient:{...logClient,getLogs:async()=>[]}}),/balance/);
});
test('owned crew selection retains captain, reassigns after removal, excludes transferred NFTs and rejects malformed inventory',()=>{
 const inventory=inventoryItems([{collection:'whalestreet',tokenId:1},{collection:'rarewhales',tokenId:245}]),roster=[{collection:'rarewhales',tokenId:245,strategy:'trend'},{collection:'whalestreet',tokenId:1,strategy:'magnet'}];
 assert.equal(chooseCaptain(roster,''),'rarewhales:245');assert.equal(chooseCaptain(roster,'whalestreet:1'),'whalestreet:1');assert.equal(chooseCaptain(roster.slice(0,1),'whalestreet:1'),'rarewhales:245');assert.equal(chooseCaptain([],''),'');
 assert.deepEqual(retainOwned(roster,inventory.slice(0,1)),roster.slice(0,1));assert.throws(()=>inventoryItems([...inventory,inventory[0]]));assert.throws(()=>inventoryItems([{collection:'fake',tokenId:1}]));
});
const inventoryClient=({head=22n,balance=1n}={})=>({getChainId:async()=>4663,getBlockNumber:async()=>head,readContract:async p=>p.functionName==='ownerOf'?owner:p.address===COLLECTIONS.rarewhales.address?balance:0n});
const filteredLogs=(logs,params)=>logs.filter(entry=>entry.blockNumber>=params.fromBlock&&entry.blockNumber<=params.toBlock&&(params.args.to?entry.args.to===owner:entry.args.from===owner));

test('reverse inventory windows cover older holders without gaps and reconcile transfers at the snapshot block',async()=>{
 const reads=[],progress=[],history=[log(3,other,owner,2),log(1,other,owner,3),log(1,owner,other,5),log(2,other,owner,20),log(2,owner,other,21)],client=inventoryClient({balance:2n});
 const originalRead=client.readContract;client.readContract=async p=>{reads.push(p);return originalRead(p);};
 const logReads=[],logClient={getChainId:async()=>4663,getLogs:async p=>{logReads.push(p);return filteredLogs(history,p);}};
 const result=await loadHoldings({address:owner,client,logClient,logWindow:8n,onProgress:p=>progress.push(p)});
 assert.deepEqual(result,{address:owner,block:'20',items:[{collection:'rarewhales',tokenId:2},{collection:'rarewhales',tokenId:3}]});
 assert.ok(reads.every(p=>p.blockNumber===20n));
 assert.deepEqual(logReads.filter(p=>p.args.to).map(p=>[p.fromBlock,p.toBlock]),[[13n,20n],[5n,12n],[0n,4n]]);
 assert.ok(logReads.every(p=>p.toBlock-p.fromBlock<8n));
 assert.deepEqual(progress.filter(p=>p.phase==='complete').map(p=>[p.collection,p.completedCollections,p.ownedCount]),[['rarewhales',1,2],['whalestreet',2,0]]);
 assert.deepEqual(reads.filter(p=>p.functionName==='ownerOf').map(p=>p.args[0]),[2n,3n]);
 assert.deepEqual(progress.filter(p=>p.phase==='history').map(p=>p.scannedBlocks),['0','8','16','21']);
 assert.equal(progress.find(p=>p.phase==='history').totalBlocks,'21');
});

test('provider range limits reduce the actual window and preserve complete inclusive coverage',async()=>{
 const attempts=[],successes=[],history=[log(7,other,owner,0)];
 const logClient={getChainId:async()=>4663,getLogs:async p=>{
  attempts.push(p);if(p.toBlock-p.fromBlock+1n>3n)throw Object.assign(Error('Query exceeds maximum block range'),{code:-32005});
  successes.push(p);return filteredLogs(history,p);
 }};
 const result=await loadHoldings({address:owner,client:inventoryClient({head:9n}),logClient,logWindow:1000000n});
 assert.deepEqual(result.items,[{collection:'rarewhales',tokenId:7}]);
 assert.deepEqual(successes.filter(p=>p.args.to).map(p=>[p.fromBlock,p.toBlock]),[[6n,7n],[4n,5n],[2n,3n],[0n,1n]]);
 assert.equal(attempts.length,12);
});

test('zero balances return promptly without scanning either collection',async()=>{
 let logReads=0;const progress=[];
 const result=await loadHoldings({address:owner,client:inventoryClient({balance:0n}),logClient:{getChainId:async()=>4663,getLogs:async()=>{logReads++;throw Error('Should not scan a zero balance');}},onProgress:p=>progress.push(p)});
 assert.deepEqual(result.items,[]);assert.equal(logReads,0);assert.equal(progress.at(-1).completedCollections,2);
});

test('overall timeout bounds a provider that never finishes network discovery',async()=>{
 let subsequentCalls=0;const never=()=>new Promise(()=>{});
 const client={getChainId:never,getBlockNumber:async()=>{subsequentCalls++;return 100n;},readContract:async()=>{subsequentCalls++;return 1n;}};
 await assert.rejects(loadHoldings({address:owner,client,logClient:{getChainId:async()=>4663},timeoutMs:20,requestTimeoutMs:200}),error=>error.name==='TimeoutError'&&/try again/i.test(error.message));
 assert.equal(subsequentCalls,0);
});

test('per-request timeout bounds a hanging history query without returning partial holdings',async()=>{
 const progress=[];const logClient={getChainId:async()=>4663,getLogs:()=>new Promise(()=>{})};
 await assert.rejects(loadHoldings({address:owner,client:inventoryClient(),logClient,timeoutMs:200,requestTimeoutMs:20,onProgress:p=>progress.push(p)}),error=>error.name==='TimeoutError');
 assert.equal(progress.filter(p=>p.phase==='complete').length,0);
});

test('cancellation ends pending queries and late results never complete or report inventory',async()=>{
 const controller=new AbortController(),lateResults=[],progress=[];
 let started;const pending=new Promise(resolve=>{started=resolve;});
 const logClient={getChainId:async()=>4663,getLogs:()=>{started();return new Promise(resolve=>lateResults.push(resolve));}};
 const loading=loadHoldings({address:owner,client:inventoryClient(),logClient,signal:controller.signal,onProgress:p=>progress.push(p)});
 await pending;controller.abort();
 await assert.rejects(loading,error=>error.name==='AbortError');
 for(const finish of lateResults)finish([log(7,other,owner,6)]);
 await Promise.resolve();await Promise.resolve();
 assert.equal(progress.filter(p=>p.phase==='complete').length,0);
});

test('already cancelled requests make no provider calls',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 const client={getChainId:async()=>{calls++;return 4663;}};
 await assert.rejects(loadHoldings({address:owner,client,logClient:client,signal:controller.signal}),error=>error.name==='AbortError');assert.equal(calls,0);
});

test('history outside its requested range and missing ownership reject the whole inventory',async()=>{
 const client=inventoryClient({head:5n});
 await assert.rejects(loadHoldings({address:owner,client,logClient:{getChainId:async()=>4663,getLogs:async()=>[log(7,other,owner,4)]}}),/Incomplete/);
 await assert.rejects(loadHoldings({address:owner,client:inventoryClient(),logClient:{getChainId:async()=>4663,getLogs:async p=>p.args.to?[log(1,other,owner,3),log(2,other,owner,5)]:[]}}),/balance/);
 assert.throws(()=>ownedFromTransfers(owner,[log(1,other,owner,3),log(1,owner,other,3)],1n),/Incomplete/);
 assert.throws(()=>ownedFromTransfers(owner,[{...log(1,other,owner,3),logIndex:-1}],1n),/Incomplete/);
});

test('a single-block provider limit fails rather than accepting an incomplete collection',async()=>{
 let calls=0;const logClient={getChainId:async()=>4663,getLogs:async()=>{calls++;throw Error('Too many log results');}};
 await assert.rejects(loadHoldings({address:owner,client:inventoryClient({head:0n}),logClient}),/Too many/);assert.equal(calls,2);
});

test('recent holdings stop early only after every candidate owner is verified at the balance snapshot',async()=>{
 const client=inventoryClient({head:1000020n}),reads=[],progress=[],originalRead=client.readContract;
 client.readContract=async p=>{reads.push(p);return originalRead(p);};
 const logReads=[],history=[log(9,other,owner,1000018)];
 const result=await loadHoldings({address:owner,client,logClient:{getChainId:async()=>4663,getLogs:async p=>{logReads.push(p);return filteredLogs(history,p);}},onProgress:p=>progress.push(p)});
 assert.deepEqual(result.items,[{collection:'rarewhales',tokenId:9}]);
 assert.equal(logReads.length,2);assert.equal(logReads[0].fromBlock,19n);assert.equal(logReads[0].toBlock,1000018n);
 assert.ok(reads.every(p=>p.blockNumber===1000018n));assert.equal(reads.filter(p=>p.functionName==='ownerOf').length,1);
 assert.equal(progress.filter(p=>p.phase==='history').at(-1).scannedBlocks,'1000000');
 assert.equal(progress.filter(p=>p.phase==='history').at(-1).totalBlocks,'1000019');
});

test('equal counts with an omitted outgoing transfer cannot pass the ownership proof',async()=>{
 const client=inventoryClient(),reads=[],logReads=[],progress=[],originalRead=client.readContract;
 client.readContract=async p=>{reads.push(p);return p.functionName==='ownerOf'?other:originalRead(p);};
 // Token 1 was transferred away at block 18, which this incomplete provider omits.
 // It also misses the incoming event for the wallet's actual token 2. Count equality
 // alone would therefore return the wrong whale.
 const incomplete=[log(1,other,owner,14)];
 await assert.rejects(loadHoldings({address:owner,client,logWindow:8n,logClient:{getChainId:async()=>4663,getLogs:async p=>{logReads.push(p);return filteredLogs(incomplete,p);}},onProgress:p=>progress.push(p)}),/current ownership/);
 assert.equal(logReads.length,6);assert.equal(logReads.at(-1).fromBlock,0n);
 assert.equal(reads.filter(p=>p.functionName==='ownerOf').length,1);
 assert.equal(progress.filter(p=>p.phase==='complete').length,0);
});

test('a hanging owner proof is bounded and cannot return candidate holdings',async()=>{
 const client=inventoryClient(),originalRead=client.readContract,progress=[];
 client.readContract=p=>p.functionName==='ownerOf'?new Promise(()=>{}):originalRead(p);
 await assert.rejects(loadHoldings({address:owner,client,requestTimeoutMs:20,timeoutMs:200,logClient:{getChainId:async()=>4663,getLogs:async p=>p.args.to?[log(1,other,owner,14)]:[]},onProgress:p=>progress.push(p)}),error=>error.name==='TimeoutError');
 assert.equal(progress.filter(p=>p.phase==='complete').length,0);
});

test('provider rate limits fail recoverably without creating extra range requests',async()=>{
 let calls=0;const logClient={getChainId:async()=>4663,getLogs:async()=>{calls++;throw Object.assign(Error('RPC request rate limit: too many requests'),{code:-32005});}};
 await assert.rejects(loadHoldings({address:owner,client:inventoryClient(),logClient}),/too many requests/);assert.equal(calls,2);
});
