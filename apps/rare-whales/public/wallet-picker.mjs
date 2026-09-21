// EIP-6963 discovery keeps each extension's actual provider, never the shared slot.
export function discoverWallets(target){
 const entries=[],listeners=new Set();
 target.addEventListener('eip6963:announceProvider',event=>{
  const {info,provider}=event.detail||{};
  if(!info||typeof info.uuid!=='string'||typeof info.name!=='string'||typeof info.rdns!=='string'||typeof provider?.request!=='function')return;
  if(entries.length>=32||entries.some(e=>e.id===info.uuid||e.provider===provider))return;
  entries.push({id:info.uuid,name:info.name.slice(0,64),rdns:info.rdns.slice(0,128),provider});
  for(const listener of listeners)listener();
 });
 const request=()=>target.dispatchEvent(new Event('eip6963:requestProvider'));
 request();
 return {request,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},list(){
  if(entries.length)return [...entries].sort((a,b)=>Number(b.rdns==='io.metamask')-Number(a.rdns==='io.metamask')||a.name.localeCompare(b.name));
  const injected=target.ethereum,providers=Array.isArray(injected?.providers)?injected.providers:[injected];
  return [...new Set(providers)].filter(p=>typeof p?.request==='function').map((provider,i)=>({id:'legacy-'+i,name:providers.length>1?`Browser wallet ${i+1} (legacy)`:'Browser wallet (legacy)',rdns:'Name unavailable — check which extension opens',provider}));
 }};
}
export function createWalletPicker(target,doc){
 const wallets=discoverWallets(target);let pending;
 const dialog=doc.createElement('dialog');dialog.className='wallet-picker';dialog.setAttribute('aria-labelledby','wallet-picker-title');
 dialog.innerHTML='<h2 id="wallet-picker-title">CHOOSE YOUR WALLET</h2><p>Select the extension you want to sign in with. No transaction or payment.</p><div class="wallet-options"></div><p class="wallet-help" role="status"></p><button type="button" class="link-button wallet-rescan">REFRESH WALLETS ↻</button><button type="button" class="pixel-button yellow wallet-cancel">CANCEL</button>';
 doc.body.append(dialog);
 const list=dialog.querySelector('.wallet-options'),help=dialog.querySelector('.wallet-help');
 const finish=wallet=>{const resolve=pending;pending=null;dialog.close();resolve?.(wallet);};
 const render=()=>{
  const entries=wallets.list();list.replaceChildren();
  help.textContent=entries.length?'MetaMask missing? Enable or unlock its extension, then refresh wallets or reload this page.':'No wallet detected. Open this site in a browser with MetaMask enabled, or inside your wallet’s browser. The sandbox works without a wallet.';
  for(const entry of entries){const button=doc.createElement('button');button.type='button';button.className='wallet-option';const title=doc.createElement('strong'),detail=doc.createElement('small');title.textContent=entry.name;detail.textContent=entry.rdns;button.append(title,detail);button.addEventListener('click',()=>finish(entry));list.append(button);}
 };
 wallets.subscribe(()=>{if(dialog.open)render();});
 dialog.querySelector('.wallet-rescan').addEventListener('click',()=>{wallets.request();render();});
 dialog.querySelector('.wallet-cancel').addEventListener('click',()=>finish(null));
 dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
 dialog.addEventListener('close',()=>{if(pending)finish(null);});
 return ()=>new Promise(resolve=>{pending=resolve;wallets.request();render();dialog.showModal();});
}
