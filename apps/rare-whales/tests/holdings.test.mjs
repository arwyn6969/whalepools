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
 const reads=[],client={getChainId:async()=>4663,getBlockNumber:async()=>100n,readContract:async p=>{reads.push(p);return 1n;}},logClient={getChainId:async()=>4663,getLogs:async p=>{reads.push(p);return p.args.to?[log(p.address===COLLECTIONS.rarewhales.address?245:1,other,owner,10)]:[];}};
 const r=await loadHoldings({address:owner,client,logClient});assert.deepEqual(r.items,[{collection:'rarewhales',tokenId:245},{collection:'whalestreet',tokenId:1}]);assert.equal(r.block,'98');assert.ok(reads.every(p=>(p.blockNumber??p.toBlock)===98n));
 await assert.rejects(loadHoldings({address:owner,client,logClient:{...logClient,getChainId:async()=>1}}),/network/);
 await assert.rejects(loadHoldings({address:owner,client,logClient:{...logClient,getLogs:async()=>[]}}),/balance/);
});
test('owned crew selection retains captain, reassigns after removal, excludes transferred NFTs and rejects malformed inventory',()=>{
 const inventory=inventoryItems([{collection:'whalestreet',tokenId:1},{collection:'rarewhales',tokenId:245}]),roster=[{collection:'rarewhales',tokenId:245,strategy:'trend'},{collection:'whalestreet',tokenId:1,strategy:'magnet'}];
 assert.equal(chooseCaptain(roster,''),'rarewhales:245');assert.equal(chooseCaptain(roster,'whalestreet:1'),'whalestreet:1');assert.equal(chooseCaptain(roster.slice(0,1),'whalestreet:1'),'rarewhales:245');assert.equal(chooseCaptain([],''),'');
 assert.deepEqual(retainOwned(roster,inventory.slice(0,1)),roster.slice(0,1));assert.throws(()=>inventoryItems([...inventory,inventory[0]]));assert.throws(()=>inventoryItems([{collection:'fake',tokenId:1}]));
});
