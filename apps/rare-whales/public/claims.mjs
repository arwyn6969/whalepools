import {createPublicClient,createWalletClient,http,custom,formatEther,formatUnits,getAddress} from 'viem';
import {claimChain,claimAbi,tokenAbi,parseClaimIDs,verifyDeployment,verifyClaimReceipt,quoteClaim} from '../src/claims.mjs';
const $=s=>document.querySelector(s),say=s=>$('#claim-message').textContent=s;
const displayError=e=>(e?.shortMessage||e?.message||'Request failed. Try again.').slice(0,280);
export async function initClaims(options={}){
 let manifest,deployment,provider,wallet,account,review,busy=false,revision=0;
 const client=options.client||createPublicClient({chain:claimChain,transport:http(undefined,{timeout:12000,retryCount:1})});
 const reset=()=>{revision++;review=null;$('#claim-send').disabled=true;$('#claim-review').hidden=true;};
 const setBusy=value=>{busy=value;$('#claim-connect').disabled=value;$('#claim-check').disabled=value||!account;$('#claim-send').disabled=value||!review;};
 const walletState=async()=>{const [accounts,chain]=await Promise.all([provider.request({method:'eth_accounts'}),provider.request({method:'eth_chainId'})]);if(!accounts[0]||getAddress(accounts[0])!==account)throw Error('Wallet account changed. Reconnect and review again.');if(Number(chain)!==claimChain.id)throw Error('Switch your wallet to Robinhood Chain (4663) and reconnect.');};
 try{
  manifest=await (options.loadManifest?options.loadManifest():fetch(new URL('./claims.json',import.meta.url),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Claim configuration unavailable.');return r.json();}));
  if(!manifest.deployment){say('Launch prepared · contract not deployed. Claims and payments are closed.');return;}
  deployment=await verifyDeployment(client,manifest);
  $('#claim-release').textContent='CONTRACT DEPLOYED';$('#claim-form').hidden=false;$('#claim-connect').disabled=false;
  $('#claim-links').hidden=false;
  for(const [id,address]of [['claim-contract',deployment.address],['claim-token',deployment.token],['claim-treasury',deployment.treasury]]){$('#'+id).href=claimChain.blockExplorers.default.url+'/address/'+address;$('#'+id).textContent=address;}
  const dates=[deployment.startsAt,deployment.endsAt].map(t=>new Date(Number(t)*1000).toLocaleString('en-GB',{timeZone:'UTC'})+' UTC');
  say(`Claims open ${dates[0]}. Programme ends ${dates[1]}.`);
  $('#claim-live-status').textContent='WWAX CONTRACT DEPLOYED';
 }catch(e){say('Claims unavailable: '+displayError(e));return;}
 $('#claim-connect').onclick=async()=>{
  if(busy)return;reset();setBusy(true);
  try{
   const selected=options.getProvider?options.getProvider():window.ethereum;if(!selected?.request)throw Error('Use a browser with an Ethereum wallet extension.');
   if(provider!==selected){provider=selected;for(const event of ['accountsChanged','chainChanged','disconnect'])provider.on?.(event,()=>{account=null;reset();$('#claim-check').disabled=true;say('Wallet changed. Reconnect to check your whales.');});}
   const accounts=await provider.request({method:'eth_requestAccounts'});account=getAddress(accounts[0]);
   await walletState();wallet=options.walletFactory?options.walletFactory({account,provider}):createWalletClient({account,chain:claimChain,transport:custom(provider)});
   const balance=await client.readContract({address:deployment.token,abi:tokenAbi,functionName:'balanceOf',args:[account]});
   $('#claim-account').textContent=account+' · '+formatUnits(balance,18)+' WWAX';say('Enter the NFT numbers in your wallet, then check this period’s allowance.');
  }catch(e){account=null;say(displayError(e));}finally{setBusy(false);}
 };
 for(const id of ['claim-rare','claim-street'])$('#'+id).addEventListener('input',reset);
 $('#claim-check').onclick=async()=>{
  if(busy)return;reset();setBusy(true);const version=revision;
  try{
   await walletState();const nfts=parseClaimIDs($('#claim-rare').value,$('#claim-street').value);const q=await quoteClaim(client,deployment,account,nfts);
   const args=[q.collections,q.ids,q.period];await client.simulateContract({account,address:deployment.address,abi:claimAbi,functionName:'claim',args,value:q.value});
   const gas=await client.estimateContractGas({account,address:deployment.address,abi:claimAbi,functionName:'claim',args,value:q.value});
   const gasPrice=await client.getGasPrice();await walletState();if(version!==revision)return;
   review={...q,nfts,account};$('#claim-review').hidden=false;
   $('#claim-review-text').textContent=`${nfts.length} NFT${nfts.length===1?'':'s'} · Period ${Number(q.period)+1}/12 · Receive ${formatUnits(q.reward,18)} WWAX. Project fee: ${formatEther(q.value)} ETH. Estimated network gas: ${formatEther(gas*gasPrice)} ETH (changes until confirmed).`;
   say('All selected whales qualify. Check the recipient, fee and gas in your wallet. Your NFTs stay with you.');
  }catch(e){say(displayError(e));}finally{setBusy(false);}
 };
 $('#claim-send').onclick=async()=>{
  if(busy||!review)return;setBusy(true);const saved=review,version=revision;
  try{
   await walletState();const fresh=await quoteClaim(client,deployment,account,saved.nfts);
   if(fresh.period!==saved.period)throw Error('A new period started. Check your allowance again.');
   const {request}=await client.simulateContract({account,address:deployment.address,abi:claimAbi,functionName:'claim',args:[fresh.collections,fresh.ids,fresh.period],value:fresh.value});
   await walletState();if(version!==revision)throw Error('Selection changed. Review again.');
   const hash=await wallet.writeContract(request);reset();
   const link=$('#claim-transaction');link.href=claimChain.blockExplorers.default.url+'/tx/'+hash;link.textContent='View submitted transaction ↗';link.hidden=false;
   say('Transaction submitted. Waiting for the chain…');
   const receipt=await client.waitForTransactionReceipt({hash,confirmations:2,timeout:180000,onReplaced:({transactionReceipt})=>{link.href=claimChain.blockExplorers.default.url+'/tx/'+transactionReceipt.transactionHash;link.textContent='View replacement transaction ↗';}});
   if(receipt.transactionHash)link.href=claimChain.blockExplorers.default.url+'/tx/'+receipt.transactionHash;
   verifyClaimReceipt(receipt,deployment,saved);
   say(`Confirmed: ${formatUnits(saved.reward,18)} WWAX delivered to ${saved.account}.`);
  }catch(e){reset();say(displayError(e)+' If a transaction was submitted, check its explorer link before retrying.');}finally{setBusy(false);}
 };
}
