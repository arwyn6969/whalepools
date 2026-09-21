import {parseAbiItem} from 'viem';
import {COLLECTIONS,CHAIN_ID,RPC_URL} from './config.mjs';
import {canonicalAddress,chainClient} from './access.mjs';
const transfer=parseAbiItem('event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)');
const balanceAbi=[{type:'function',name:'balanceOf',stateMutability:'view',inputs:[{type:'address'}],outputs:[{type:'uint256'}]}];
export function ownedFromTransfers(address,logs,balance){
 const wallet=canonicalAddress(address),latest=new Map();
 if(logs.length>20000)throw Error('Wallet history exceeds the inventory limit.');
 for(const log of logs){
  const {from,to,tokenId}=log.args||{};
  if(log.removed||log.blockNumber==null||!Number.isSafeInteger(log.logIndex)||typeof from!=='string'||typeof to!=='string'||typeof tokenId!=='bigint')throw Error('Incomplete NFT transfer history.');
  if(from.toLowerCase()!==wallet&&to.toLowerCase()!==wallet)throw Error('Unexpected NFT transfer history.');
  const id=Number(tokenId);if(!Number.isSafeInteger(id)||id<1||id>1000000)throw Error('Unsupported NFT number.');
  const old=latest.get(id);if(!old||log.blockNumber>old.blockNumber||log.blockNumber===old.blockNumber&&log.logIndex>old.logIndex)latest.set(id,log);
 }
 const ids=[...latest].filter(([,log])=>log.args.to.toLowerCase()===wallet).map(([id])=>id).sort((a,b)=>a-b);
 if(BigInt(ids.length)!==balance)throw Error('NFT history does not match the on-chain balance. Please refresh.');
 return ids;
}
export async function loadHoldings({address,env={},client=chainClient(env),logClient=chainClient({RPC_URL})}){
 const wallet=canonicalAddress(address);
 if(await client.getChainId()!==CHAIN_ID||await logClient.getChainId()!==CHAIN_ID)throw Error('Inventory service returned the wrong network.');
 const head=await client.getBlockNumber(),blockNumber=head>2n?head-2n:head,items=[];
 // These contracts do not enumerate owners. Reconstruct incoming/outgoing transfers,
 // then require an exact current balance at the same block; publication still checks ownerOf.
 for(const [collection,{address:contract}]of Object.entries(COLLECTIONS)){
  const balance=await client.readContract({address:contract,abi:balanceAbi,functionName:'balanceOf',args:[wallet],blockNumber});
  const common={address:contract,event:transfer,fromBlock:0n,toBlock:blockNumber,strict:true};
  const incoming=await logClient.getLogs({...common,args:{to:wallet}});
  const outgoing=await logClient.getLogs({...common,args:{from:wallet}});
  for(const tokenId of ownedFromTransfers(wallet,[...incoming,...outgoing],balance))items.push({collection,tokenId});
 }
 return {address:wallet,block:blockNumber.toString(),items};
}
