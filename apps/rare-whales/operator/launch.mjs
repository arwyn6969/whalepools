import {createPublicClient,http,getAddress,formatEther,keccak256} from 'viem';
import {claimChain,verifyDeployment} from '../src/claims.mjs';
const KEY='wwax-deployment-submitted-v1';
export function validateLaunchPackage(config){
 if(config?.version!==1||config.chainId!==claimChain.id||!/^0x[0-9a-fA-F]+$/.test(config.bytecode||'')||keccak256(config.bytecode)!==config.creationCodeHash)throw Error('Invalid or mismatched launch package. Rebuild before deploying.');
 return config;
}
export async function initLaunch(options={}){
 const $=id=>document.getElementById(id),say=s=>$('status').textContent=s;
 const client=options.client||createPublicClient({chain:claimChain,transport:http()});
 const load=options.loadPackage||(()=>fetch('./launch.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Launch package unavailable.');return r.json();}));
 let storage;
 try{storage=options.storage||window.localStorage;}catch{say('Browser storage is unavailable. Use a browser that can retain the deployment receipt before deploying.');return;}
 let config,provider,account,sending=false,busy=false,reviewed=false,revision=0;
 const invalidate=()=>{revision++;reviewed=false;$('deploy').disabled=true;$('review').hidden=true;};
 const showHash=hash=>{const a=$('transaction');a.href=claimChain.blockExplorers.default.url+'/tx/'+hash;a.textContent=hash;a.hidden=false;};
 const save=value=>{storage.setItem(KEY,value);if(storage.getItem(KEY)!==value)throw Error('Browser cannot save deployment recovery state.');};
 const recordHash=hash=>{if(!/^0x[0-9a-fA-F]{64}$/.test(hash||''))throw Error('Wallet returned no valid transaction hash. Check wallet activity.');showHash(hash);save(hash);};
 const check=async()=>{const [accounts,chain]=await Promise.all([provider.request({method:'eth_accounts'}),provider.request({method:'eth_chainId'})]);if(!accounts[0]||getAddress(accounts[0])!==account||Number(chain)!==claimChain.id)throw Error('Account or chain changed. Reconnect and review again.');};
 const freshPackage=async()=>{const latest=validateLaunchPackage(await load());if(latest.bytecode!==config.bytecode)throw Error('The launch build changed. Reload and review the new package before deploying.');};
 const finish=async hash=>{
  let replacementReason;
  const r=await client.waitForTransactionReceipt({hash,confirmations:2,timeout:180000,onReplaced:({reason,transactionReceipt})=>{replacementReason=reason;recordHash(transactionReceipt.transactionHash);}});
  recordHash(r.transactionHash);
  if(replacementReason==='cancelled'||r.status!=='success'){
   // A confirmed revert/cancellation cannot have created a contract. Explicit receipt makes a retry safe.
   save('resolved:'+r.transactionHash);sending=false;$('connect').disabled=false;invalidate();say('Deployment '+(r.status!=='success'?'reverted':'was cancelled')+'. No contract was created by this transaction. Check its receipt; you may reconnect to try again.');return;
  }
  const d=await verifyDeployment(client,{...config,deployment:{address:r.contractAddress,transactionHash:r.transactionHash}});
  $('result').textContent=JSON.stringify({deployment:{address:d.address,transactionHash:r.transactionHash},token:d.token,treasury:d.treasury,startsAt:new Date(Number(d.startsAt)*1000).toISOString()},null,2);$('next').hidden=false;
  say('Deployment confirmed and settings verified. Publish this address to open the claim interface.');
 };
 try{
  config=validateLaunchPackage(await load());$('build').textContent=`Compiler: ${config.compiler}\nSource SHA256: ${config.sourceSha256}\nCreation code hash: ${config.creationCodeHash}\nSnapshot block: ${config.eligibility.block}`;
  const prior=storage.getItem(KEY);
  if(prior&&!prior.startsWith('resolved:')){
   sending=true;
   if(!/^0x[0-9a-fA-F]{64}$/.test(prior))throw Error('A previous deployment request has an unknown outcome. Check wallet activity before attempting another deployment.');
   showHash(prior);say('Resuming the submitted deployment. A second deployment is disabled.');await finish(prior);
  }else{$('connect').disabled=false;say('Ready. Connect the wallet that should permanently receive claim fees.');}
 }catch(e){say(e.shortMessage||e.message);return;}
 $('connect').onclick=async()=>{
  if(sending||busy)return;busy=true;invalidate();let version;$('connect').disabled=true;
  try{
   const selected=options.getProvider?options.getProvider():window.ethereum;if(!selected?.request)throw Error('Open this local URL in a browser with your wallet extension.');
   if(selected!==provider){provider=selected;for(const event of ['accountsChanged','chainChanged','disconnect'])provider.on?.(event,()=>{invalidate();say('Wallet changed. Reconnect and review again.');});}
   const a=await provider.request({method:'eth_requestAccounts'});account=getAddress(a[0]);await check();version=revision;await freshPackage();
   if(await client.getChainId()!==claimChain.id)throw Error('The RPC is on the wrong network.');
   const gas=await client.estimateGas({account,data:config.bytecode});const price=await client.getGasPrice();await check();if(revision!==version)throw Error('Wallet changed during review. Reconnect.');
   $('wallet').textContent='Permanent fee recipient: '+account;$('gas').textContent=`Estimated deployment gas: ${gas} units, approximately ${formatEther(gas*price)} ETH. Your wallet shows the final fee.`;$('review').hidden=false;$('deploy').disabled=false;reviewed=true;say('Review the launch recipe and fee wallet, then deploy.');
  }catch(e){say(e.shortMessage||e.message);}finally{busy=false;if(!sending)$('connect').disabled=false;}
 };
 $('deploy').onclick=async()=>{
  if(sending||busy||!reviewed)return;sending=true;$('deploy').disabled=true;$('connect').disabled=true;const version=revision;
  let requested=false,recorded=false,submitted=false;
  try{
   await check();await freshPackage();if(revision!==version)throw Error('Wallet changed. Reconnect and review again.');
   const prior=storage.getItem(KEY);if(prior&&!prior.startsWith('resolved:'))throw Error('Another deployment is recorded in this browser. Reload to resume it before sending anything else.');
   // Persist intent BEFORE the wallet call. A disconnected/timeout response may still have broadcast.
   save('unknown:'+account);recorded=true;say('Review and confirm the deployment in your wallet.');requested=true;
   const hash=await provider.request({method:'eth_sendTransaction',params:[{from:account,data:config.bytecode,value:'0x0',chainId:'0x'+claimChain.id.toString(16)}]});submitted=true;recordHash(hash);say('Submitted. Waiting for two confirmations…');await finish(hash);
  }catch(e){
   if(!requested||(e.code===4001&&!submitted)){
    if(recorded){try{save('resolved:rejected');}catch{say('The wallet request failed and its recovery record could not be updated. Check wallet activity before retrying.');return;}}
    sending=false;invalidate();$('connect').disabled=false;say(e.shortMessage||e.message);
   }
   else{say((e.shortMessage||e.message)+' Check wallet activity. A second deployment is disabled until the previous transaction is resolved.');}
  }
 };
}
