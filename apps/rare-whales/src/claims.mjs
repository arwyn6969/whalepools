import {defineChain,parseAbi,keccak256,getAddress} from 'viem';
import {COLLECTIONS,CHAIN_ID,RPC_URL} from './config.mjs';
export const claimChain=defineChain({id:CHAIN_ID,name:'Robinhood Chain',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:[RPC_URL]}},blockExplorers:{default:{name:'Robinhood Explorer',url:'https://robinhoodchain.blockscout.com'}}});
export const CLAIM_RULES=Object.freeze({reward:100n*10n**18n,fee:10n**14n,period:30n*86400n,periods:12n,supply:4486800n*10n**18n,maxBatch:20,bounds:{rarewhales:420,whalestreet:3319}});
export const claimAbi=parseAbi([
 'function token() view returns(address)','function treasury() view returns(address)',
 'function startsAt() view returns(uint256)','function endsAt() view returns(uint256)',
 'function REWARD() view returns(uint256)','function FEE() view returns(uint256)',
 'function PERIOD() view returns(uint256)','function PERIODS() view returns(uint256)',
 'function MAX_BATCH() view returns(uint256)','function INITIAL_SUPPLY() view returns(uint256)',
 'function RARE_WHALES() view returns(address)','function WHALESTREET() view returns(address)',
 'function claimedPeriods(address,uint256) view returns(uint256)',
 'function claim(address[] collections,uint256[] ids) payable',
 'function withdrawFees()','function burnExpiredReserve()'
]);
export const nftAbi=parseAbi(['function ownerOf(uint256) view returns(address)']);
export const tokenAbi=parseAbi(['function balanceOf(address) view returns(uint256)','function totalSupply() view returns(uint256)']);
export function parseClaimIDs(rare,street){
 const nfts=[];
 for(const [key,input]of [['rarewhales',rare],['whalestreet',street]]){
  const ids=String(input).trim().split(/[\s,]+/).filter(Boolean);const seen=new Set();
  for(const id of ids){if(!/^[1-9]\d*$/.test(id)||BigInt(id)>BigInt(CLAIM_RULES.bounds[key]))throw Error(`${COLLECTIONS[key].name}: use token numbers 1–${CLAIM_RULES.bounds[key]}.`);if(seen.has(id))throw Error('Each NFT can appear only once in a claim.');seen.add(id);nfts.push({key,collection:COLLECTIONS[key].address,tokenId:BigInt(id)});}
 }
 if(!nfts.length||nfts.length>CLAIM_RULES.maxBatch)throw Error('Choose 1–20 NFTs per transaction.');return nfts;
}
export function periodAt(timestamp,startsAt,endsAt){
 if(timestamp<startsAt)throw Error('Claims have not opened yet.');
 if(timestamp>=endsAt)throw Error('The twelve claim periods have ended.');
 return (timestamp-startsAt)/CLAIM_RULES.period;
}
export async function verifyDeployment(client,manifest){
 const d=manifest.deployment;
 if(!d)throw Error('Contract deployment is pending. No claim payment is available.');
 if(manifest.chainId!==CHAIN_ID||await client.getChainId()!==CHAIN_ID)throw Error('Wrong chain. Use Robinhood Chain mainnet.');
 const receipt=await client.getTransactionReceipt({hash:d.transactionHash});
 const tx=await client.getTransaction({hash:d.transactionHash});
 if(receipt.status!=='success'||!receipt.contractAddress||receipt.contractAddress.toLowerCase()!==d.address.toLowerCase()||tx.to!==null||keccak256(tx.input)!==manifest.creationCodeHash)throw Error('Deployment does not match this reviewed build.');
 const head=await client.getBlock();if(head.number<receipt.blockNumber+2n)throw Error('Waiting for deployment confirmations.');
 if(!await client.getCode({address:d.address}))throw Error('Contract is not available.');
 const names=['token','treasury','startsAt','endsAt','REWARD','FEE','PERIOD','PERIODS','MAX_BATCH','INITIAL_SUPPLY','RARE_WHALES','WHALESTREET'];
 const values=await Promise.all(names.map(functionName=>client.readContract({address:d.address,abi:claimAbi,functionName,blockNumber:head.number})));
 const fields=Object.fromEntries(names.map((n,i)=>[n,values[i]]));
 if(getAddress(fields.treasury)!==getAddress(tx.from)||fields.REWARD!==CLAIM_RULES.reward||fields.FEE!==CLAIM_RULES.fee||fields.PERIOD!==CLAIM_RULES.period||fields.PERIODS!==CLAIM_RULES.periods||fields.MAX_BATCH!==20n||fields.INITIAL_SUPPLY!==CLAIM_RULES.supply||fields.endsAt-fields.startsAt!==CLAIM_RULES.period*CLAIM_RULES.periods||fields.RARE_WHALES.toLowerCase()!==COLLECTIONS.rarewhales.address||fields.WHALESTREET.toLowerCase()!==COLLECTIONS.whalestreet.address)throw Error('Deployed claim settings do not match the published rules.');
 return {...fields,address:getAddress(d.address),transactionHash:d.transactionHash};
}
export async function quoteClaim(client,deployment,account,nfts){
 const block=await client.getBlock(),period=periodAt(block.timestamp,deployment.startsAt,deployment.endsAt),mask=1n<<period;
 for(const nft of nfts){
  const [owner,claimed]=await Promise.all([
   client.readContract({address:nft.collection,abi:nftAbi,functionName:'ownerOf',args:[nft.tokenId],blockNumber:block.number}),
   client.readContract({address:deployment.address,abi:claimAbi,functionName:'claimedPeriods',args:[nft.collection,nft.tokenId],blockNumber:block.number})
  ]);
  if(getAddress(owner)!==getAddress(account))throw Error(`${COLLECTIONS[nft.key].name} #${nft.tokenId} is not in this wallet.`);
  if((claimed&mask)!==0n)throw Error(`${COLLECTIONS[nft.key].name} #${nft.tokenId} already claimed this period.`);
 }
 return {period,blockNumber:block.number,collections:nfts.map(n=>n.collection),ids:nfts.map(n=>n.tokenId),value:CLAIM_RULES.fee*BigInt(nfts.length),reward:CLAIM_RULES.reward*BigInt(nfts.length)};
}
