import {createPublicClient,http,parseAbiItem} from 'viem';
import {COLLECTIONS,CHAIN_ID,RPC_URL} from './config.mjs';
import {canonicalAddress} from './access.mjs';
const transfer=parseAbiItem('event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)');
const inventoryAbi=[
 {type:'function',name:'balanceOf',stateMutability:'view',inputs:[{type:'address'}],outputs:[{type:'uint256'}]},
 {type:'function',name:'ownerOf',stateMutability:'view',inputs:[{type:'uint256'}],outputs:[{type:'address'}]}
];
const historyLimit=20000;
export const INVENTORY_TIMEOUT_MS=30000;
const namedError=(name,message)=>Object.assign(new Error(message),{name});
const abortedError=()=>namedError('AbortError','Whale loading was cancelled.');
const timeoutError=()=>namedError('TimeoutError','Whale loading took too long. Please try again.');

function rangeLimited(error){
 const messages=[];let explicitLimit=false;
 for(let current=error,depth=0;current&&depth<6;current=current.cause,depth++){
  if(current.code===429||current.status===429)return false;
  if(current.code===-32005||current.name==='ResponseBodyTooLargeError')explicitLimit=true;
  messages.push(current.message||'',current.details||'',current.shortMessage||'');
 }
 const message=messages.join(' ');
 if(/rate[\s-]*limit|too many requests|requests per/i.test(message))return false;
 return explicitLimit||/(?:block|query|log|response|result).*(?:range|limit|too large|exceed)|(?:range|limit|exceed|too many|too large|maximum).*(?:block|query|log|response|result)/i.test(message);
}

function candidatesFromTransfers(address,logs){
 const wallet=canonicalAddress(address),latest=new Map();
 if(!Array.isArray(logs))throw Error('Incomplete NFT transfer history.');
 if(logs.length>historyLimit)throw Error('Wallet history exceeds the inventory limit.');
 for(const log of logs){
  const {from,to,tokenId}=log?.args||{};
  if(!log||log.removed||typeof log.blockNumber!=='bigint'||log.blockNumber<0n||!Number.isSafeInteger(log.logIndex)||log.logIndex<0||!/^0x[0-9a-f]{40}$/i.test(from)||!/^0x[0-9a-f]{40}$/i.test(to)||typeof tokenId!=='bigint')throw Error('Incomplete NFT transfer history.');
  if(from.toLowerCase()!==wallet&&to.toLowerCase()!==wallet)throw Error('Unexpected NFT transfer history.');
  const id=Number(tokenId);if(!Number.isSafeInteger(id)||id<1||id>1000000)throw Error('Unsupported NFT number.');
  const old=latest.get(id);
  if(old&&log.blockNumber===old.blockNumber&&log.logIndex===old.logIndex&&(from.toLowerCase()!==old.args.from.toLowerCase()||to.toLowerCase()!==old.args.to.toLowerCase()))throw Error('Incomplete NFT transfer history.');
  if(!old||log.blockNumber>old.blockNumber||log.blockNumber===old.blockNumber&&log.logIndex>old.logIndex)latest.set(id,log);
 }
 return [...latest].filter(([,log])=>log.args.to.toLowerCase()===wallet).map(([id])=>id).sort((a,b)=>a-b);
}
export function ownedFromTransfers(address,logs,balance){
 if(typeof balance!=='bigint'||balance<0n)throw Error('Incomplete NFT transfer history.');
 const ids=candidatesFromTransfers(address,logs);
 if(BigInt(ids.length)!==balance)throw Error('NFT history does not match the on-chain balance. Please refresh.');
 return ids;
}
export async function loadHoldings({address,env={},client,logClient,signal,onProgress,timeoutMs=INVENTORY_TIMEOUT_MS,requestTimeoutMs=10000,logWindow=1000000n}){
 const wallet=canonicalAddress(address);
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||typeof logWindow!=='bigint'||logWindow<1n)throw Error('Invalid inventory loading limits.');
 const controller=new AbortController(),cancel=()=>controller.abort(abortedError());
 if(signal?.aborted)throw abortedError();
 signal?.addEventListener('abort',cancel,{once:true});
 const deadline=setTimeout(()=>controller.abort(timeoutError()),timeoutMs);
 // Race even injected/provider clients that ignore cancellation. Default transports
 // also receive the signal so a wallet switch ends their network requests.
 const request=operation=>new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);controller.signal.removeEventListener('abort',stop);};
  const stop=()=>{cleanup();reject(controller.signal.reason);};
  const timer=setTimeout(()=>controller.abort(timeoutError()),requestTimeoutMs);
  if(controller.signal.aborted){stop();return;}
  controller.signal.addEventListener('abort',stop,{once:true});
  Promise.resolve().then(()=>{if(controller.signal.aborted)throw controller.signal.reason;return operation();}).then(value=>{cleanup();if(controller.signal.aborted)reject(controller.signal.reason);else resolve(value);},error=>{cleanup();reject(controller.signal.aborted?controller.signal.reason:error);});
 });
 // The outer deadline owns the user-facing timeout. Give the transport a small
 // margin so its wrapped error cannot win the same-millisecond race.
 const makeClient=url=>createPublicClient({transport:http(url,{timeout:requestTimeoutMs+1000,retryCount:0,fetchOptions:{signal:controller.signal}})});
 const collections=Object.entries(COLLECTIONS),items=[];
 let completedCollections=0;
 const progress=(phase,collection,extra={})=>{
  if(controller.signal.aborted)throw controller.signal.reason;
  onProgress?.({phase,collection,completedCollections,totalCollections:collections.length,...extra});
 };
 try{
  client??=makeClient(env.RPC_URL||RPC_URL);logClient??=makeClient(RPC_URL);
  progress('network',null);
  const chains=await Promise.all([request(()=>client.getChainId()),request(()=>logClient.getChainId())]);
  if(chains.some(chain=>chain!==CHAIN_ID))throw Error('Inventory service returned the wrong network.');
  const head=await request(()=>client.getBlockNumber());
  if(typeof head!=='bigint'||head<0n)throw Error('Inventory service returned an invalid block.');
  const blockNumber=head>2n?head-2n:head,totalBlocks=blockNumber+1n;
  // Scan the newest history first. A complete inventory is proved only when its
  // distinct candidates equal balanceOf and each ownerOf confirms this wallet at
  // the same block. This lets recent holders avoid scanning the whole chain.
  for(const [collection,{address:contract}]of collections){
   progress('balance',collection);
   const balance=await request(()=>client.readContract({address:contract,abi:inventoryAbi,functionName:'balanceOf',args:[wallet],blockNumber}));
   if(typeof balance!=='bigint'||balance<0n)throw Error('Inventory service returned an invalid balance.');
   const logs=[],owners=new Map();
   let toBlock=blockNumber,window=logWindow,owned=[];
   const verify=async ids=>{
    progress('verify',collection,{candidateCount:ids.length});
    // Bound concurrency so a large collection does not flood the ownership RPC.
    const missing=ids.filter(id=>!owners.has(id));
    for(let start=0;start<missing.length;start+=6){
     const batch=missing.slice(start,start+6);
     const values=await Promise.all(batch.map(tokenId=>request(()=>client.readContract({address:contract,abi:inventoryAbi,functionName:'ownerOf',args:[BigInt(tokenId)],blockNumber}))));
     for(let index=0;index<batch.length;index++){
      if(!/^0x[0-9a-f]{40}$/i.test(values[index]))throw Error('Inventory service returned an invalid owner.');
      owners.set(batch[index],values[index].toLowerCase());
     }
    }
    return ids.every(id=>owners.get(id)===wallet);
   };
   if(balance>0n){
    progress('history',collection,{scannedBlocks:'0',totalBlocks:totalBlocks.toString()});
    while(toBlock>=0n){
     const fromBlock=toBlock-window+1n>0n?toBlock-window+1n:0n;
     const common={address:contract,event:transfer,fromBlock,toBlock,strict:true};
     let pages;
     try{
      const responses=await Promise.allSettled([request(()=>logClient.getLogs({...common,args:{to:wallet}})),request(()=>logClient.getLogs({...common,args:{from:wallet}}))]);
      const failed=responses.find(response=>response.status==='rejected');
      if(failed)throw failed.reason;
      pages=responses.map(response=>response.value);
     }
     catch(error){
      if(controller.signal.aborted)throw controller.signal.reason;
      const range=toBlock-fromBlock+1n;
      if(!rangeLimited(error)||range===1n)throw error;
      window=range/2n||1n;
      continue;
     }
     for(const page of pages){
      if(!Array.isArray(page)||page.some(log=>!log||typeof log.blockNumber!=='bigint'||log.blockNumber<fromBlock||log.blockNumber>toBlock))throw Error('Incomplete NFT transfer history.');
      if(logs.length+page.length>historyLimit)throw Error('Wallet history exceeds the inventory limit.');
      logs.push(...page);
     }
     progress('history',collection,{scannedBlocks:(blockNumber-fromBlock+1n).toString(),totalBlocks:totalBlocks.toString()});
     const candidates=candidatesFromTransfers(wallet,logs);
     if(BigInt(candidates.length)===balance&&await verify(candidates)){owned=candidates;break;}
     toBlock=fromBlock-1n;
    }
    if(BigInt(owned.length)!==balance){
     const candidates=ownedFromTransfers(wallet,logs,balance);
     if(!await verify(candidates))throw Error('NFT history does not match current ownership. Please refresh.');
     owned=candidates;
    }
   }
   for(const tokenId of owned)items.push({collection,tokenId});
   completedCollections++;
   progress('complete',collection,{ownedCount:owned.length});
  }
  if(controller.signal.aborted)throw controller.signal.reason;
  return {address:wallet,block:blockNumber.toString(),items};
 }finally{clearTimeout(deadline);signal?.removeEventListener('abort',cancel);if(!controller.signal.aborted)controller.abort(abortedError());}
}
