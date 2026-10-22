import assert from 'node:assert/strict';
import {mkdir, readdir, access, writeFile, readFile, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {startFixtureServer} from './serve-fixture.mjs';

const require = createRequire(import.meta.url);
const app = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.RW_EVIDENCE_DIR || path.join(app, 'work/live-onboarding-check'));
let playwrightPath = process.env.RW_PLAYWRIGHT_MODULE;
if (!playwrightPath) {
  try {playwrightPath = require.resolve('playwright');}
  catch {playwrightPath = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}
}
const {chromium} = await import(pathToFileURL(playwrightPath));
let executablePath = process.env.RW_BROWSER_EXECUTABLE;
if (!executablePath) {
  try {await access(chromium.executablePath());}
  catch {
    const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
    const versions = (await readdir(cache)).filter(name => /^chromium_headless_shell-\d+$/.test(name)).sort((a, b) => Number(b.split('-').at(-1)) - Number(a.split('-').at(-1)));
    for (const version of versions) {
      const candidate = path.join(cache, version, 'chrome-headless-shell-mac-arm64/chrome-headless-shell');
      try {await access(candidate); executablePath = candidate; break;} catch {/* Try the next installed browser. */}
    }
  }
}
await mkdir(output,{recursive:true});
const fixture=await startFixtureServer({port:0,paperEnabled:true});
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const results=[],errors=[];
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
const wait=(selector,pattern,timeout=30000)=>page.waitForFunction(({selector,pattern})=>new RegExp(pattern).test(document.querySelector(selector)?.textContent||''),{selector,pattern},{timeout});
const saved=()=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('whale-pools-paper-draft-v1:'))));
const historical=()=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('whale-pools-company-draft-v1:'))));
const control=data=>page.evaluate(data=>window.__whaleFixture.control(data),data);
async function signIn(n=3){await page.locator('#paper-connect').click();await page.getByRole('button',{name:/Whale Pools Fixture Wallet/}).click();await wait('#paper-eligibility',`${n} owned whales`);assert.equal(new URL(page.url()).hash,'#paper');}
async function switchWallet(name,n){await page.locator('#fixture-wallet').selectOption(name);await page.locator('#paper-connect').waitFor({state:'visible'});await signIn(n);}
const selected=()=>page.locator('[data-paper-whale]:checked').evaluateAll(nodes=>nodes.map(n=>n.dataset.paperWhale));
async function shot(name){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(output,name),fullPage:true});}
try{
 await page.route('https://**',r=>r.abort('blockedbyclient'));
 await page.goto(fixture.origin+'/#paper');await wait('#paper-feed','MARKET WATCH');await signIn();
 results.push('Direct live sign-in remains in the live fleet and completes verified inventory without a historical publication.');
 await page.locator('#paper-name').fill('Return to the currents');await page.locator('#paper-style').selectOption('recovery');await page.locator('[data-paper-whale="rarewhales:246"]').uncheck();await page.locator('#paper-consent').check();const before=await saved();
 await page.reload();await wait('#paper-eligibility','3 owned whales');assert.equal(await page.locator('#paper-name').inputValue(),'Return to the currents');assert.equal(await page.locator('#paper-style').inputValue(),'recovery');assert.deepEqual(await selected(),['rarewhales:245','whalestreet:1']);assert.equal(await page.locator('#paper-consent').isChecked(),false);assert.deepEqual(await saved(),before);
 results.push('Reload restores the private live name, style and crew; publication consent is never restored.');
 await switchWallet('second',2);assert.equal(await page.locator('#paper-name').inputValue(),'My Whale Watch');await page.locator('#paper-name').fill('Other holder');await page.locator('#paper-style').selectOption('breakout');await switchWallet('holder',3);assert.equal(await page.locator('#paper-name').inputValue(),'Return to the currents');assert.equal(await page.locator('#paper-style').inputValue(),'recovery');
 results.push('Two live drafts stay isolated across wallet switches and the original holder restores their choices.');
 const stable=await saved();await control({rpcMode:'error'});await page.locator('#paper-inventory-refresh').click();await wait('#paper-eligibility','Use Refresh my whales');assert.deepEqual(await saved(),stable);assert.equal(await page.locator('#paper-start').isDisabled(),true);await control({rpcMode:'normal'});await page.locator('#paper-inventory-refresh').click();await wait('#paper-eligibility','3 owned whales');
 results.push('Inventory failure keeps live choices, disables publication and offers an inline recovery.');
 await control({rpcMode:'delay',rpcDelayMs:22000});const started=Date.now();await page.locator('#paper-inventory-refresh').click();await wait('#paper-eligibility','took too long',35000);assert.ok(Date.now()-started<33000);assert.deepEqual(await saved(),stable);await control({rpcMode:'normal',rpcDelayMs:0});await page.locator('#paper-inventory-refresh').click();await wait('#paper-eligibility','3 owned whales');
 results.push('Inventory waiting is bounded; late responses cannot erase choices and refresh recovers.');
 await control({rpcDelayMs:1400});await page.locator('#paper-inventory-refresh').click();await page.locator('#fixture-wallet').selectOption('second');await control({rpcDelayMs:0});await page.locator('#paper-connect').waitFor({state:'visible'});await signIn(2);await page.waitForTimeout(1600);assert.equal(await page.locator('#paper-name').inputValue(),'Other holder');assert.equal(await page.locator('[data-paper-whale="rarewhales:245"]').count(),0);await switchWallet('holder',3);
 results.push('A delayed inventory from the previous wallet cannot mix live crews or names.');
 const labs=await fixture.db.prepare('SELECT id FROM wp_paper_runs WHERE wallet IS NULL ORDER BY id').all(),id=labs.results[0].id;
 const ownBefore=await saved();await page.evaluate(id=>location.hash='paper/'+id,id);await page.locator('#paper-launch').waitFor({state:'hidden'});await wait('#paper-fleet','FORWARD PAPER RECORD');assert.deepEqual(await saved(),ownBefore);
 await control({holdings:{holder:[{collection:'rarewhales',tokenId:246},{collection:'whalestreet',tokenId:1}]}});await page.evaluate(()=>document.querySelector('#refresh-whales').click());await wait('#owned-status','2 whales found');assert.deepEqual(await saved(),ownBefore);
 await page.evaluate(()=>location.hash='paper');await wait('#paper-draft-status','no longer in this wallet');assert.deepEqual(await selected(),['whalestreet:1']);assert.equal(await page.locator('#paper-name').inputValue(),'Return to the currents');
 results.push('Inspecting a public rival cannot rewrite the private draft; completed transfer reconciliation happens on returning to own setup.');
 await page.locator('[data-paper-whale="whalestreet:1"]').uncheck();await page.reload();await wait('#paper-eligibility','2 owned whales');assert.deepEqual(await selected(),[]);
 results.push('An intentional empty live crew survives reload without automatic replacement.');
 await page.evaluate(()=>location.hash='seat');await page.locator('#nickname').fill('Separate historical choices');const old=await historical();await page.evaluate(()=>location.hash='paper');await wait('#paper-feed','MARKET WATCH');await page.locator('#paper-name').fill('Live choices only');assert.deepEqual(await historical(),old);
 results.push('Live and historical choices use independent namespaces and forms.');
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('Storage denied');};});await page.locator('#paper-name').fill('Memory survives');await wait('#paper-draft-status','storage is unavailable');assert.equal(await page.locator('#paper-name').inputValue(),'Memory survives');await page.reload();await wait('#paper-eligibility','2 owned whales');assert.equal(await page.locator('#paper-name').inputValue(),'Live choices only');
 results.push('Storage denial gives honest feedback, keeps choices in memory and preserves the last saved draft.');
 await shot('desktop-live-setup.png');await page.setViewportSize({width:390,height:844});await shot('mobile-live-setup.png');results.push('Desktop and mobile live onboarding have no horizontal overflow.');
 await page.locator('#fixture-wallet').selectOption('empty');await page.locator('#paper-connect').waitFor({state:'visible'});await page.locator('#paper-connect').click();await page.getByRole('button',{name:/Whale Pools Fixture Wallet/}).click();await wait('#paper-eligibility','No eligible whales');assert.equal(await page.locator('#paper-start').isDisabled(),true);
 results.push('Empty wallets receive a clear one-NFT eligibility explanation and cannot publish.');
 await page.locator('#fixture-wallet').selectOption('holder');await page.locator('#paper-connect').waitFor({state:'visible'});await page.locator('#fixture-reject').check();await page.locator('#paper-connect').click();await page.getByRole('button',{name:/Whale Pools Fixture Wallet/}).click();await wait('#global-message','cancelled');assert.equal(await page.locator('#paper-connect').isEnabled(),true);await page.locator('#fixture-reject').uncheck();await signIn(2);
 results.push('Rejected signing remains recoverable within the live route.');
 await page.locator('#fixture-wallet').selectOption('second');await page.locator('#paper-connect').waitFor({state:'visible'});await control({responseDelayMs:1200,delayPath:'/api/auth/challenge'});await page.locator('#paper-connect').click();await page.getByRole('button',{name:/Whale Pools Fixture Wallet/}).click();await page.evaluate(()=>location.hash='tide');await wait('#owned-status','2 whales found');assert.equal(new URL(page.url()).hash,'#tide');await control({responseDelayMs:0,delayPath:''});
 results.push('Navigation during asynchronous signing is respected; a Tide visitor stays in Tide.');
 await page.locator('#fixture-wallet').selectOption('holder');await page.locator('#tide-connect').waitFor({state:'visible'});await page.locator('#tide-connect').click();await page.getByRole('button',{name:/Whale Pools Fixture Wallet/}).click();await wait('#tide-eligibility','2 owned whales');assert.equal(new URL(page.url()).hash,'#tide');
 await control({rpcMode:'error'});await page.locator('#tide-inventory-refresh').click();await wait('#tide-inventory-status','Use Refresh my whales');assert.equal(await page.locator('#tide-fields').evaluate(el=>el.disabled),true);assert.equal(await page.locator('#tide-form button[type="submit"]').isDisabled(),true);await control({rpcMode:'normal'});await page.locator('#tide-inventory-refresh').click();await wait('#tide-eligibility','2 owned whales');
 results.push('Daily Tide supports direct sign-in and inline inventory recovery without a historical detour.');
 assert.deepEqual(errors,[]);await writeFile(path.join(output,'live-onboarding-browser.json'),JSON.stringify({fixture:true,realEligibleWallet:false,syntheticCandles:true,results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors,output},null,2));
}catch(e){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw e;}
finally{await context.close();await browser.close();await fixture.close();}
