import assert from 'node:assert/strict';
import {mkdir, readdir, access, writeFile, readFile, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {startFixtureServer} from './serve-fixture.mjs';

const require = createRequire(import.meta.url);
const app = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.RW_EVIDENCE_DIR || path.join(app, 'work/watch-return-check'));
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
await context.addInitScript(t=>{Date.now=()=>Number(sessionStorage.getItem('return-test-clock')||t);},fixture.state.paperNow+2000);
page.on('pageerror',e=>errors.push(e.message));
const wait=(selector,pattern)=>page.waitForFunction(({selector,pattern})=>new RegExp(pattern).test(document.querySelector(selector)?.textContent||''),{selector,pattern});
const bookmarks=()=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('whale-pools-watch-bookmarks-v1:'))));
const drafts=()=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('whale-pools-paper-draft-v1:')||k.startsWith('whale-pools-company-draft-v1:'))));
const pilot=()=>page.evaluate(()=>localStorage.getItem('whale-pools-holder-live-pilot-v1'));
const checkIn=()=>page.locator('[data-watch-return]');
const remember=()=>page.locator('[data-watch-remember]');
let writes=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/paper/'))writes++;});
async function tick(advance=1,error=false){await fixture.paperTick({advance,error});await page.evaluate(t=>sessionStorage.setItem('return-test-clock',t),fixture.state.paperNow+2000);}
async function refresh(){await page.locator('#paper-refresh').click();await page.waitForFunction(()=>!document.querySelector('#paper-refresh').disabled);}
async function signIn(n){await page.locator('#paper-connect').click();await page.getByRole('button',{name:/Whale Pools Fixture Wallet/}).click();await wait('#owned-status',n+' whales found');}
async function start(name){await page.locator('#paper-name').fill(name);await page.locator('#paper-consent').check();await page.locator('#paper-start').click();await wait('#paper-message','paper watch is saved');await checkIn().waitFor({state:'visible'});}
async function shot(name){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await checkIn().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,name),fullPage:false});}
try{
 await page.route('https://**',r=>r.abort('blockedbyclient'));
 await page.goto(fixture.origin+'/#paper');await wait('#paper-feed','MARKET WATCH');assert.equal(await checkIn().count(),0);assert.deepEqual(await bookmarks(),{});results.push('Anonymous preset readers see no personal bookmark or holder check-in.');
 await page.evaluate(()=>location.hash='live-pilot');await page.locator('#live-pilot-start').click();await page.evaluate(()=>location.hash='paper');await wait('#paper-feed','MARKET WATCH');await signIn(3);
 await page.evaluate(()=>location.hash='seat');await page.locator('#nickname').fill('Historical choices stay private');await page.evaluate(()=>location.hash='paper');await wait('#paper-feed','MARKET WATCH');await start('The returning whales');
 assert.match(await checkIn().innerText(),/first saved observation/);assert.equal(await remember().isEnabled(),false);assert.equal(await page.locator('#paper-form').isVisible(),false);assert.equal(await page.locator('#paper-presets').isVisible(),false);assert.deepEqual(await bookmarks(),{});results.push('New running watches show waiting honestly and focus the company instead of the locked setup; nothing saves automatically.');
 await tick();await tick();await refresh();const ownId=await checkIn().getAttribute('data-watch-return');const beforeDraft=await drafts(),beforeWrites=writes;
 assert.equal(await remember().isEnabled(),true);await remember().click();await wait('[data-watch-return-status]','Snapshot remembered');assert.match(await checkIn().innerText(),/UP TO DATE/);assert.equal(await page.evaluate(()=>document.activeElement.tagName),'H3');assert.deepEqual(await drafts(),beforeDraft);assert.equal(writes,beforeWrites);const firstBookmark=await bookmarks(),beforePilot=await pilot();
 assert.equal(JSON.parse(Object.values(firstBookmark)[0]).records[ownId].timely,2);results.push('An explicit Remember stores only the displayed snapshot, restores focus, leaves drafts/server state intact and uses the existing voluntary review rule.');
 for(let i=0;i<3;i++)await tick();await refresh();await wait('[data-watch-return]','SINCE YOUR LAST LOOK');assert.deepEqual(await bookmarks(),firstBookmark);assert.equal(await pilot(),beforePilot);
 const metrics=await checkIn().locator('.board-metrics strong').allTextContents();assert.equal(metrics[1],'3');assert.equal(metrics[2],'0');assert.equal(metrics[3],'0');assert.match(await checkIn().innerText(),/not realized profit/);await checkIn().getByText('WHAT IS MY CREW WAITING FOR?',{exact:true}).click();assert.match(await checkIn().innerText(),/Current Surfer/);assert.match(await checkIn().innerText(),/queued|Holding|Waiting/);await refresh();assert.notEqual(await checkIn().locator('details').getAttribute('open'),null);assert.deepEqual(await bookmarks(),firstBookmark);await shot('desktop-return-story.png');results.push('New saved data explains exact cumulative deltas and current preset reasons; refresh never advances the bookmark or pilot return.');
 await page.reload();await wait('[data-watch-return]','SINCE YOUR LAST LOOK');assert.deepEqual(await bookmarks(),firstBookmark);assert.deepEqual(await drafts(),beforeDraft);results.push('Reload restores the same private comparison with the existing authenticated fixture provider, without a thirty-second polling delay.');
 await remember().click();await wait('[data-watch-return-status]','Snapshot remembered');const marked=await bookmarks();assert.notDeepEqual(marked,firstBookmark);assert.equal(JSON.parse(await pilot()).events.filter(e=>e.type==='live_reviewed').length,2);await refresh();assert.deepEqual(await bookmarks(),marked);assert.equal(await remember().isEnabled(),false);results.push('Only deliberate newer Remember advances the baseline; duplicate/current refresh does not record another reviewed observation.');
 await tick(2,true);await refresh();assert.match(await page.locator('#paper-feed').innerText(),/recovering/);assert.deepEqual(await bookmarks(),marked);await tick();await refresh();await wait('[data-watch-return]','SINCE YOUR LAST LOOK');assert.match(await checkIn().innerText(),/interrupted/);assert.ok(Number((await checkIn().locator('.board-metrics strong').allTextContents())[3])>0);results.push('An outage keeps the marker; recovery reports new skipped/gap bars without inventing trades or clean coverage.');
 const allBookmarks=await bookmarks(),allDrafts=await drafts(),lab=await fixture.db.prepare('SELECT id FROM wp_paper_runs WHERE wallet IS NULL LIMIT 1').first();await page.evaluate(id=>location.hash='paper/'+id,lab.id);await wait('#paper-fleet','FORWARD PAPER');assert.equal(await checkIn().count(),0);assert.deepEqual(await bookmarks(),allBookmarks);assert.deepEqual(await drafts(),allDrafts);await page.evaluate(()=>location.hash='paper');await wait('[data-watch-return]','SINCE YOUR LAST LOOK');results.push('Public watch inspection cannot expose/advance a private check-in or alter either draft.');
 await page.locator('#fixture-wallet').selectOption('second');await signIn(2);assert.equal(await checkIn().count(),0);await start('A separate returning crew');await tick();await refresh();await remember().click();await wait('[data-watch-return-status]','Snapshot remembered');const twoBookmarks=await bookmarks();assert.equal(Object.keys(twoBookmarks).length,2);assert.ok(Object.values(twoBookmarks).includes(Object.values(allBookmarks)[0]));await page.locator('#fixture-wallet').selectOption('holder');await signIn(3);await wait('[data-watch-return]','SINCE YOUR LAST LOOK');assert.deepEqual(await bookmarks(),twoBookmarks);results.push('Another wallet stores an independent watch marker; returning holder restores its own comparison.');
 await page.setViewportSize({width:390,height:844});await shot('mobile-return-story.png');assert.equal(await remember().isVisible(),true);await page.locator('[data-watch-latest-recap]').click();await wait('[data-recap-status]','Saved day loaded');assert.match(await page.locator('[data-recap-content]').first().innerText(),/DAY SO FAR|SAVED DAY/);assert.deepEqual(await bookmarks(),twoBookmarks);results.push('Mobile check-in fits and the explicit latest-recap shortcut exposes the actual day and existing sharing controls without moving the marker.');
 const oldDay=await page.locator('[data-recap-day]').inputValue();const dayEnd=Math.floor(fixture.state.paperNow/86400000)*86400000+86400000;
 while(fixture.state.paperNow<dayEnd+600000)await tick(10);
 await refresh();await page.locator('[data-watch-latest-recap]').click();await wait('[data-recap-status]','Saved day loaded');const newDay=await page.locator('[data-recap-day]').inputValue();assert.notEqual(newDay,oldDay);await page.locator('[data-recap-day]').selectOption(oldDay);await wait('[data-recap-content]','SAVED DAY');await page.locator('[data-watch-latest-recap]').click();await wait('[data-recap-status]','Saved day loaded');assert.equal(await page.locator('[data-recap-day]').inputValue(),newDay);assert.deepEqual(await bookmarks(),twoBookmarks);results.push('Across UTC midnight, Latest recap replaces an earlier selected day with the newest server window; old marker survives beyond the rolling chart.');
 await page.route('**/api/paper/recap/**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Recap service recovering.'})}));await page.locator('[data-watch-latest-recap]').click();await wait('[data-recap-status]','Recap service recovering');assert.deepEqual(await bookmarks(),twoBookmarks);await page.unroute('**/api/paper/recap/**');results.push('A failed latest recap preserves the previous day and bookmark with an actionable retry.');
 await page.evaluate(()=>{const original=Storage.prototype.setItem;window.returnTestSetItem=original;Storage.prototype.setItem=function(k,v){if(k.startsWith('whale-pools-watch-bookmarks-v1:'))throw Error('Fixture storage denied');return original.call(this,k,v);};});await remember().click();await wait('[data-watch-return-status]','could not be saved');assert.deepEqual(await bookmarks(),twoBookmarks);await page.evaluate(()=>Storage.prototype.setItem=window.returnTestSetItem);results.push('Denied local storage never reports a saved bookmark or loses existing markers/server records.');
 const beforeForgetDrafts=await drafts();await page.locator('[data-watch-forget]').click();await wait('[data-watch-return-status]','Bookmark removed');const forgotten=await bookmarks();assert.equal(JSON.parse(Object.values(forgotten).find(v=>v.includes(ownId))||'{}').records?.[ownId],undefined);assert.ok(Object.values(forgotten).some(v=>v===Object.values(twoBookmarks).find(v=>!v.includes(ownId))));assert.deepEqual(await drafts(),beforeForgetDrafts);results.push('Forget removes only the chosen watch marker and leaves the other wallet and private setup intact.');
 assert.deepEqual(errors,[]);await writeFile(path.join(output,'watch-return-browser.json'),JSON.stringify({fixture:true,realEligibleWallet:false,syntheticCandles:true,acceleratedClock:true,results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors,output},null,2));
}catch(e){await page.screenshot({path:path.join(output,'failure.png'),fullPage:false});throw e;}
finally{await context.close();await browser.close();await fixture.close();}
