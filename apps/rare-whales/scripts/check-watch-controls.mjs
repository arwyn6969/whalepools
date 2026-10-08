import assert from 'node:assert/strict';
import {mkdir, readdir, access, writeFile, readFile, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {startFixtureServer} from './serve-fixture.mjs';

const require = createRequire(import.meta.url);
const app = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.RW_EVIDENCE_DIR || path.join(app, 'work/holder-acceptance-check'));
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
const results=[],errors=[],context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
const wait=(selector,pattern)=>page.waitForFunction(({selector,pattern})=>new RegExp(pattern).test(document.querySelector(selector)?.textContent||''),{selector,pattern});
const control=data=>page.evaluate(data=>window.__whaleFixture.control(data),data);
const draft=()=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>(k.startsWith('whale-pools-paper-draft-v1:')||k.startsWith('whale-pools-company-draft-v1:'))&&k.includes(window.__whaleFixture.accounts.holder))));
const own=()=>fixture.db.prepare('SELECT * FROM wp_paper_runs WHERE wallet IS NOT NULL ORDER BY created_at DESC LIMIT 1').first();
const count=()=>fixture.db.prepare('SELECT COUNT(*) AS n FROM wp_paper_runs WHERE wallet IS NOT NULL').first();
let requests=0;page.on('request',request=>{if(request.url().endsWith('/api/paper/stop'))requests++;});
async function shot(name){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(output,name),fullPage:false});}
async function signIn(n){await page.locator('#paper-connect').click();await page.getByRole('button',{name:/Whale Pools Fixture Wallet/}).click();await wait('#owned-status',n+' whales found');}
async function start(name){await page.locator('#paper-name').fill(name);await page.locator('#paper-consent').check();await page.locator('#paper-start').click();await wait('#paper-message','paper watch is saved');await wait('#paper-fleet',name);assert.equal(await page.locator('#paper-consent').isChecked(),false);}
async function open(){await page.locator('#paper-stop').click();await page.locator('#paper-stop-review').waitFor({state:'visible'});}
try{
 await page.route('https://**',r=>r.abort('blockedbyclient'));
 await page.goto(fixture.origin+'/#paper');await wait('#paper-feed','MARKET WATCH');assert.equal(await page.locator('#paper-stop').isVisible(),false);assert.equal(await page.locator('#paper-stop-review').isVisible(),false);results.push('Signed-out visitors cannot open holder Stop controls.');
 await page.evaluate(()=>location.hash='live-pilot');await page.locator('#live-pilot-start').click();await page.evaluate(()=>location.hash='paper');await wait('#paper-feed','MARKET WATCH');await signIn(3);await page.evaluate(()=>location.hash='seat');await page.locator('#nickname').fill('Keep this historical draft');await page.evaluate(()=>location.hash='paper');await wait('#paper-feed','MARKET WATCH');await start('A watch worth keeping');await fixture.paperTick({advance:1});await fixture.paperTick({advance:1});await page.locator('#paper-refresh').click();await wait('#paper-fleet','POSITION OPEN');const first=await own(),before=await draft(),pilotBefore=await page.evaluate(()=>localStorage.getItem('whale-pools-holder-live-pilot-v1'));
 await open();assert.match(await page.locator('#paper-stop-summary').innerText(),/Last saved balance.*open paper position/);assert.equal(await page.evaluate(()=>document.activeElement.id),'paper-stop-cancel');assert.equal(requests,0);await shot('desktop-stop-review.png');results.push('Stop first shows a focused, named review with the actual saved valuation, positions and queued orders; no write occurs.');
 await page.locator('#paper-stop-cancel').press('Escape');await page.locator('#paper-stop-review').waitFor({state:'hidden'});assert.equal((await own()).status,'running');assert.equal(requests,0);assert.deepEqual(await draft(),before);results.push('Escape keeps watching, sends no Stop and preserves both private draft scopes.');
 await open();await page.locator('#paper-stop-cancel').click();assert.equal((await own()).status,'running');assert.equal(requests,0);assert.equal(await page.evaluate(()=>localStorage.getItem('whale-pools-holder-live-pilot-v1')),pilotBefore);results.push('Keep watching cancels without changing the server watch or recording a pilot action.');
 await open();await page.locator('#paper-stop-cancel').press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'paper-stop-confirm');await page.locator('#paper-stop-confirm').press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'paper-stop-cancel');await page.locator('#paper-stop-cancel').click();results.push('Keyboard focus stays inside the modal and returns to the opening Stop button after dismissal.');assert.equal(await page.evaluate(()=>document.activeElement.id),'paper-stop');
 await page.setViewportSize({width:390,height:844});await open();assert.ok(await page.locator('#paper-stop-confirm').isVisible());await shot('mobile-stop-review.png');await page.locator('#paper-stop-cancel').click();results.push('The review and both actions fit the mobile viewport without horizontal overflow.');
 await open();await page.evaluate(()=>location.hash='tide');await page.locator('#paper-stop-review').waitFor({state:'hidden'});assert.equal(requests,0);assert.equal((await own()).status,'running');await page.evaluate(()=>location.hash='paper');await wait('#paper-fleet','A watch worth keeping');results.push('Navigation closes the pending confirmation without freezing the watch.');
 await open();await page.evaluate(()=>window.__whaleFixture.wallet('second'));await page.locator('#paper-stop-review').waitFor({state:'hidden'});assert.equal(requests,0);await signIn(2);assert.equal(await page.locator('#paper-stop').isVisible(),false);await page.locator('#fixture-wallet').selectOption('holder');await page.locator('#paper-connect').waitFor({state:'visible'});await signIn(3);await wait('#paper-fleet','A watch worth keeping');results.push('A wallet switch discards the old Stop intent; the next wallet cannot confirm the previous holder watch.');
 await page.route('**/api/paper/stop',async route=>{await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Service is recovering.'})});});await open();await page.locator('#paper-stop-confirm').click();await wait('#paper-message','Service is recovering');assert.equal((await own()).status,'running');assert.equal(await page.locator('#paper-stop').isEnabled(),true);await page.unroute('**/api/paper/stop');results.push('An explicit Stop failure keeps the watch running and restores a reviewable retry.');
 await page.route('**/api/paper/stop',async route=>{await route.fetch();await route.abort('failed');});await open();await page.locator('#paper-stop-confirm').click();await wait('#paper-message','Stop confirmed from your saved record');assert.equal((await own()).status,'stopped');await wait('#paper-next-watch','separate 14-day record');assert.deepEqual(await draft(),before);await page.unroute('**/api/paper/stop');const frozen=(await own()).state_json;await fixture.paperTick({advance:1});assert.equal((await own()).state_json,frozen);results.push('A lost response is reconciled from saved status; Stop freezes decisions and explains a separate follow-up without rewriting drafts.');
 assert.equal(await page.locator('#paper-consent').isChecked(),false);await page.locator('#paper-start').click();assert.equal((await count()).n,1);await start('A watch worth keeping');assert.equal((await count()).n,2);assert.notEqual((await own()).id,first.id);assert.equal((await fixture.db.prepare('SELECT status FROM wp_paper_runs WHERE id=?').bind(first.id).first()).status,'stopped');await wait('#paper-archive-list','STOPPED');assert.equal(await page.locator('#paper-next-watch').isVisible(),false);results.push('An unchanged follow-up needs fresh consent and a fresh request ID, creates a distinct dated record and retains the old archive.');
 const second=await own();await open();await page.locator('#paper-stop-confirm').click();await wait('#paper-message','Watch stopped');await fixture.paperTick({advance:1});
 await page.route('**/api/paper/start',async route=>{await route.fetch();await route.abort('failed');});await page.locator('#paper-consent').check();await page.locator('#paper-start').click();await wait('#paper-message','response did not arrive');await page.waitForFunction(()=>document.querySelector('#paper-fields').disabled&& !document.querySelector('#paper-consent').checked);assert.equal((await count()).n,3);const third=await own();assert.notEqual(third.id,second.id);assert.equal(third.status,'running');await page.unroute('**/api/paper/start');await open();await page.locator('#paper-stop-confirm').click();await wait('#paper-message','Watch stopped');await fixture.paperTick({advance:1});await start('A watch worth keeping');assert.equal((await count()).n,4);assert.notEqual((await own()).id,third.id);results.push('A lost Start response is acknowledged from the owner read; its consent/request are cleared so the next unchanged follow-up is genuinely new.');
 const nextDraft=await draft();const lab=await fixture.db.prepare('SELECT id FROM wp_paper_runs WHERE wallet IS NULL LIMIT 1').first();await page.evaluate(id=>location.hash='paper/'+id,lab.id);await wait('#paper-fleet','FORWARD PAPER');assert.equal(await page.locator('#paper-launch').isVisible(),false);assert.equal(await page.locator('#paper-stop-review').isVisible(),false);assert.deepEqual(await draft(),nextDraft);results.push('Public inspection hides all holder control/review UI and leaves private drafts intact.');
 assert.deepEqual(errors,[]);await writeFile(path.join(output,'holder-acceptance-browser.json'),JSON.stringify({fixture:true,realEligibleWallet:false,syntheticCandles:true,results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors,output},null,2));
}catch(e){await page.screenshot({path:path.join(output,'failure.png'),fullPage:false});throw e;}
finally{await context.close();await browser.close();await fixture.close();}
