import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPublicClient,http,parseAbiItem} from 'viem';
import {claimChain} from '../src/claims.mjs';
const snapshot=JSON.parse(await readFile(new URL('../contracts/eligibility.json',import.meta.url)));
const client=createPublicClient({chain:claimChain,transport:http()});
assert.equal(await client.getChainId(),snapshot.chainId);
const block=await client.getBlock({blockNumber:BigInt(snapshot.block)});assert.equal(block.hash,snapshot.blockHash);
for(const collection of snapshot.collections){
 const logs=await client.getLogs({address:collection.address,event:parseAbiItem('event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)'),args:{from:'0x0000000000000000000000000000000000000000'},fromBlock:0n,toBlock:block.number});
 const ids=logs.map(l=>Number(l.args.tokenId)).sort((a,b)=>a-b);
 assert.equal(ids.length,collection.mintEvents);assert.deepEqual(ids,Array.from({length:collection.lastId},(_,i)=>i+1));
 console.log(collection.key+': verified '+ids.length+' mint events, IDs '+collection.firstId+'–'+collection.lastId+', at block '+snapshot.block);
}
