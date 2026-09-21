import {encodeEventTopics,encodeAbiParameters} from 'viem';
import {claimAbi,tokenAbi} from '../src/claims.mjs';
export function claimLogs(address,token,owner,nfts,period,reward){
 return [
  ...nfts.map(n=>({address,topics:encodeEventTopics({abi:claimAbi,eventName:'Claimed',args:{owner,collection:n.collection,tokenId:n.tokenId}}),data:encodeAbiParameters([{type:'uint256'}],[period])})),
  {address:token,topics:encodeEventTopics({abi:tokenAbi,eventName:'Transfer',args:{from:address,to:owner}}),data:encodeAbiParameters([{type:'uint256'}],[reward])}
 ];
}
