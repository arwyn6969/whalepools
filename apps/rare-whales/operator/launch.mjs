import {createPublicClient,http,getAddress,formatEther} from 'viem';
import {claimChain,verifyDeployment} from '../src/claims.mjs';
const $=id=>document.getElementById(id),say=s=>$('status').textContent=s;
const client=createPublicClient({chain:claimChain,transport:http()});
let config,provider,account,sending=false;
const prior=localStorage.getItem('wwax-deployment-submitted-v1');
const showHash=hash=>{const a=$('transaction');a.href=claimChain.blockExplorers.default.url+'/tx/'+hash;a.textContent=hash;a.hidden=false;$('next').hidden=false;};
async function finish(hash){const r=await client.waitForTransactionReceipt({hash,confirmations:2,timeout:180000});if(r.status!=='success')throw Error('Deployment reverted. Check the explorer; gas may have been spent.');const d=await verifyDeployment(client,{...config,deployment:{address:r.contractAddress,transactionHash:hash}});$('result').textContent=JSON.stringify({deployment:{address:d.address,transactionHash:hash},token:d.token,treasury:d.treasury,startsAt:new Date(Number(d.startsAt)*1000).toISOString()},null,2);say('Deployment confirmed and settings verified. Publish this address to open the claim interface.');}
try{config=await fetch('./launch.json').then(r=>r.json());$('build').textContent=`Compiler: ${config.compiler}\nSource SHA256: ${config.sourceSha256}\nCreation code hash: ${config.creationCodeHash}\nSnapshot block: ${config.eligibility.block}`;if(prior){sending=true;showHash(prior);say('A deployment was previously submitted from this browser. Checking it; a second deployment is disabled.');await finish(prior);}else{$('connect').disabled=false;say('Ready. Connect the wallet that should permanently receive claim fees.');}}catch(e){say(e.shortMessage||e.message);}
const check=async()=>{const [accounts,chain]=await Promise.all([provider.request({method:'eth_accounts'}),provider.request({method:'eth_chainId'})]);if(getAddress(accounts[0])!==account||Number(chain)!==4663)throw Error('Account or chain changed. Reconnect and review again.');};
$('connect').onclick=async()=>{
 if(sending)return;$('connect').disabled=true;$('deploy').disabled=true;$('review').hidden=true;
 try{provider=window.ethereum;if(!provider?.request)throw Error('Open this local URL in a browser with your wallet extension.');const a=await provider.request({method:'eth_requestAccounts'});account=getAddress(a[0]);await check();
  for(const event of ['accountsChanged','chainChanged'])provider.on?.(event,()=>{$('deploy').disabled=true;$('review').hidden=true;say('Wallet changed. Reconnect and review again.');});
  const gas=await client.estimateGas({account,data:config.bytecode});const price=await client.getGasPrice();await check();
  $('wallet').textContent='Permanent fee recipient: '+account;$('gas').textContent=`Estimated deployment gas: ${gas} units, approximately ${formatEther(gas*price)} ETH. Your wallet shows the final fee.`;$('review').hidden=false;$('deploy').disabled=false;say('Review the launch recipe and fee wallet, then deploy.');
 }catch(e){say(e.shortMessage||e.message);}finally{if(!sending)$('connect').disabled=false;}
};
$('deploy').onclick=async()=>{
 if(sending)return;sending=true;$('deploy').disabled=true;$('connect').disabled=true;
 try{await check();say('Review and confirm the deployment in your wallet.');const hash=await provider.request({method:'eth_sendTransaction',params:[{from:account,data:config.bytecode,value:'0x0',chainId:'0x1237'}]});showHash(hash);try{localStorage.setItem('wwax-deployment-submitted-v1',hash);}catch{}say('Submitted. Waiting for two confirmations…');await finish(hash);
 }catch(e){say((e.shortMessage||e.message)+' Check any submitted transaction before trying again.');if(!$('transaction').hasAttribute('href')){sending=false;$('connect').disabled=false;}}
};
