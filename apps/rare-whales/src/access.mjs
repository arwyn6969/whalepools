import { createPublicClient, http, getAddress } from 'viem';
import { CHAIN_ID, COLLECTIONS, RPC_URL } from './config.mjs';

const abi = [
  { type:'function', name:'balanceOf', stateMutability:'view', inputs:[{name:'owner',type:'address'}], outputs:[{type:'uint256'}] },
  { type:'function', name:'ownerOf', stateMutability:'view', inputs:[{name:'tokenId',type:'uint256'}], outputs:[{type:'address'}] }
];
export const canonicalAddress = value => getAddress(value).toLowerCase();
export function chainClient(env) {
  return createPublicClient({ transport:http(env.RPC_URL || RPC_URL, {timeout:10000,retryCount:2,retryDelay:1000}) });
}
export async function ownsAgents({address,agents,block,client}){
 const blockNumber=BigInt(block),wallet=canonicalAddress(address);
 // Verify every roster member at the same block used to grant pool eligibility.
 const owners=await Promise.all(agents.map(a=>client.readContract({address:COLLECTIONS[a.collection].address,abi,functionName:'ownerOf',args:[BigInt(a.tokenId)],blockNumber})));
 return owners.every(owner=>owner.toLowerCase()===wallet);
}
export async function checkSeat({address, collection, tokenId, season, client}) {
  const wallet = canonicalAddress(address), access = season.access;
  if (!access.confirmed) return {eligible:false,reason:'Seat rules are awaiting confirmation.',pending:true};
  if (await client.getChainId() !== CHAIN_ID) throw Error('Ownership service returned the wrong network.');
  const head = await client.getBlockNumber(), blockNumber = head > 2n ? head - 2n : head;
  const founder = access.founderWallets.some(a => a.toLowerCase() === wallet);
  let ownsSelected = false;
  if (collection !== null) {
    if (!COLLECTIONS[collection] || !Number.isSafeInteger(tokenId) || tokenId < 0 || tokenId > 1000000) throw Error('Choose a valid collection and token number.');
    const owner = await client.readContract({address:COLLECTIONS[collection].address,abi,functionName:'ownerOf',args:[BigInt(tokenId)],blockNumber});
    ownsSelected = owner.toLowerCase() === wallet;
    if (!ownsSelected) return {eligible:false,reason:'This wallet does not own the selected whale.',block:blockNumber.toString()};
  } else if (!founder) return {eligible:false,reason:'Choose a whale you own to check your seat.'};
  if (founder) return {eligible:true,basis:'founder',label:'Founder seat',block:blockNumber.toString()};
  if (collection === 'rarewhales' && ownsSelected && access.promoTokenIds.includes(tokenId)) return {eligible:true,basis:'promo',label:'1/1 promotional seat',block:blockNumber.toString()};
  const counts = await Promise.all(access.balanceCollections.map(async key => {
    const balance = await client.readContract({address:COLLECTIONS[key].address,abi,functionName:'balanceOf',args:[wallet],blockNumber});
    return [key,Number(balance)];
  }));
  const total = counts.reduce((n,[,b]) => n+b,0);
  return {eligible:total >= access.minimumBalance,basis:'holder',label:'Holder seat',total,balances:Object.fromEntries(counts),block:blockNumber.toString(),reason:total >= access.minimumBalance ? null : `This wallet holds ${total} qualifying whales; ${access.minimumBalance} are needed.`};
}
