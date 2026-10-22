import assert from 'node:assert/strict';
import {mkdir, readdir, access, writeFile, readFile, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {startFixtureServer} from './serve-fixture.mjs';

const require = createRequire(import.meta.url);
const app = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.RW_EVIDENCE_DIR || path.join(app, 'work/recorder-check'));
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
const snapshot=()=>page.locator('[data-coverage-content]').innerText();
const saved=()=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('whale-pools-paper-draft-v1:'))));
const open=async()=>{await page.locator('#paper-coverage summary').click();await page.locator('[data-coverage-load]').click();await wait('[data-coverage-status]','snapshot loaded');};
try{
 await page.route('https://**',r=>r.abort('blockedbyclient'));
 await page.goto(fixture.origin+'/#paper');await wait('#paper-feed','MARKET WATCH');await open();assert.match(await snapshot(),/Waiting for the first/);results.push('The bootstrap window excludes warmup and promises no trades or uptime.');
 await page.locator('#paper-connect').click();await page.getByRole('button',{name:/Whale Pools Fixture Wallet/}).click();await wait('#paper-eligibility','3 owned whales');await page.locator('#paper-name').fill('Coverage keeps my crew');await page.locator('#paper-style').selectOption('recovery');const draft=await saved();
 for(let i=0;i<5;i++)await fixture.paperTick({advance:1});await page.locator('[data-coverage-load]').click();await wait('[data-coverage-status]','snapshot loaded');assert.match(await snapshot(),/5 closes usable/);assert.deepEqual(await saved(),draft);results.push('Timely receipt and all-three-watch usability are counted without touching a private live draft.');
 // A disposable saved-watch flag models a hard interruption after candle receipt.
 const row=await fixture.db.prepare('SELECT id,state_json FROM wp_paper_runs WHERE wallet IS NULL LIMIT 1').first();const state=JSON.parse(row.state_json);state.history[1].actionable=false;await fixture.db.prepare('UPDATE wp_paper_runs SET state_json=? WHERE id=?').bind(JSON.stringify(state),row.id).run();
 await page.locator('[data-coverage-load]').click();await wait('[data-coverage-status]','snapshot loaded');const c=await (await context.request.get(fixture.origin+'/api/paper/coverage')).json();assert.equal(c.receipt.onTime,5);assert.equal(c.reference.actionable,4);assert.equal(c.reference.valuationOnly,1);assert.match(await snapshot(),/connected feed alone/);results.push('An on-time candle with a saved interrupted decision is visibly valuation only, never silently clean.');
 await fixture.paperTick({advance:3});await page.locator('[data-coverage-load]').click();await wait('[data-coverage-status]','snapshot loaded');const late=await (await context.request.get(fixture.origin+'/api/paper/coverage')).json();assert.equal(late.receipt.late,2);assert.ok(late.reference.valuationOnly>=3);results.push('Recovery keeps late arrivals and unusable closes explicit; it invents no catch-up fills.');
 await fixture.paperTick({advance:1,error:true});await page.locator('[data-coverage-load]').click();await wait('[data-coverage-status]','snapshot loaded');assert.match(await snapshot(),/1 awaiting delivery/);fixture.state.paperNow+=90001;await page.locator('[data-coverage-load]').click();await wait('[data-coverage-status]','snapshot loaded');const gap=await (await context.request.get(fixture.origin+'/api/paper/coverage')).json();assert.equal(gap.receipt.missing,1);assert.equal(gap.reference.missing,1);results.push('An unreceived close gets a ninety-second grace, then becomes missing without changing saved state.');
 await page.screenshot({path:path.join(output,'desktop-recorder-fixture.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(output,'mobile-recorder-fixture.png'),fullPage:true});results.push('Coverage metrics, explanations, disclosure and recovery controls fit desktop and 390-pixel mobile layouts.');
 const prior=await snapshot();await page.route('**/api/paper/coverage*',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Fixture coverage temporarily unavailable."}'}));await page.locator('[data-coverage-load]').click();await wait('[data-coverage-status]','Could not read coverage');assert.equal(await snapshot(),prior);await page.unroute('**/api/paper/coverage*');await page.locator('[data-coverage-load]').click();await wait('[data-coverage-status]','snapshot loaded');results.push('A failed read keeps the last snapshot and recovers with Update.');
 const firstDay=c.day,midnight=Math.floor(fixture.state.paperNow/86400000)*86400000+86400000;fixture.state.paperNow=midnight+2*300000+1000;await fixture.paperTick();await page.locator('nav a[data-page=seat]').click();await page.locator('nav a[data-page=paper]').click();await wait('#paper-feed','MARKET WATCH');if(!await page.locator('#paper-coverage').evaluate(e=>e.open))await page.locator('#paper-coverage summary').click();await page.locator('[data-coverage-load]').click();await wait('[data-coverage-status]','snapshot loaded');assert.equal(await page.locator('[data-coverage-day] option').count(),2);await page.locator('[data-coverage-day]').selectOption(firstDay);await wait('[data-coverage-content]','SAVED DAY');assert.match(await snapshot(),/NOT RECEIVED/);results.push('An earlier UTC day remains inspectable with missing closes; rollover never erases the partial record.');
 const previousDaySnapshot=await snapshot();
 await page.route('**/api/paper/coverage*',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Fixture selected-day failure."}'}));await page.locator('[data-coverage-day]').selectOption({index:0});await wait('[data-coverage-status]','Could not read coverage');assert.equal(await snapshot(),previousDaySnapshot);assert.match(await page.locator('[data-coverage-status]').innerText(),new RegExp('Showing the snapshot for '+firstDay));await page.unroute('**/api/paper/coverage*');await page.locator('[data-coverage-load]').click();await wait('[data-coverage-status]','snapshot loaded');assert.notEqual(await page.locator('[data-coverage-day]').inputValue(),firstDay);results.push('A failed day change restores the labelled prior snapshot; retry loads the requested day.');
 fixture.state.delayPath='/api/paper/coverage';fixture.state.responseDelayMs=1200;await page.locator('[data-coverage-load]').click();await page.locator('nav a[data-page=seat]').click();await page.locator('nav a[data-page=paper]').click();await page.waitForTimeout(1500);assert.equal(await snapshot(),'');results.push('Delayed reads cannot rebuild coverage after route changes.');
 fixture.state.responseDelayMs=0;await page.locator('[data-coverage-load]').click();await wait('[data-coverage-status]','snapshot loaded');fixture.state.responseDelayMs=1200;await page.locator('[data-coverage-load]').click();await page.locator('#fixture-wallet').selectOption('second');await page.locator('#paper-connect').waitFor({state:'visible'});await page.waitForTimeout(1500);assert.equal(await snapshot(),'');assert.deepEqual(await saved(),draft);results.push('A wallet switch clears an in-flight read and keeps the previous holder’s private draft.');
 fixture.state.responseDelayMs=0;await page.goto(fixture.origin+'/#live-pilot');await page.locator('#live-pilot-start').click();await page.goto(fixture.origin+'/#paper');await wait('#paper-feed','MARKET WATCH');if(!await page.locator('#paper-coverage').evaluate(e=>e.open))await page.locator('#paper-coverage summary').click();await page.locator('[data-coverage-load]').click();await wait('[data-coverage-status]','snapshot loaded');assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('whale-pools-holder-live-pilot-v1')))).events.filter(e=>e.type==='live_reviewed').length,0);results.push('Public recorder inspection cannot count as a meaningful private-company pilot return.');
 fixture.state.delayPath='/api/paper/coverage';fixture.state.responseDelayMs=22000;const started=Date.now();await page.locator('[data-coverage-load]').click();await wait('[data-coverage-status]','took too long',35000);assert.ok(Date.now()-started<33000);assert.equal(await page.locator('[data-coverage-load]').isEnabled(),true);fixture.state.responseDelayMs=0;await page.locator('[data-coverage-load]').click();await wait('[data-coverage-status]','snapshot loaded');results.push('Coverage waiting is bounded and a timed-out read recovers without locking the journey.');
 await page.locator('nav a[data-page=tide]').click();await wait('#tide-round','already has interrupted closes');assert.match(await page.locator('#tide-round').innerText(),/partial results without final ranks/);results.push('A running Daily Tide with gaps explains immediately that its final results will remain partial.');
 assert.deepEqual(errors,[]);await writeFile(path.join(output,'recorder-browser.json'),JSON.stringify({fixture:true,syntheticCandles:true,acceleratedClock:true,simulatedInterruption:true,realEligibleWallet:false,results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors,output},null,2));
}catch(e){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw e;}
finally{await context.close();await browser.close();await fixture.close();}
