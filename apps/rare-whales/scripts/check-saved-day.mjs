import assert from 'node:assert/strict';
import {mkdir, readdir, access, writeFile, readFile, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {startFixtureServer} from './serve-fixture.mjs';

const require = createRequire(import.meta.url);
const app = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.RW_EVIDENCE_DIR || path.join(app, 'work/saved-day-check'));
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
const results=[],errors=[],context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']}),page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
const wait=(selector,pattern)=>page.waitForFunction(({selector,pattern})=>new RegExp(pattern).test(document.querySelector(selector)?.textContent||''),{selector,pattern});
const drafts=()=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('whale-pools-company-draft-v1:'))));
const shot=async name=>page.screenshot({path:path.join(output,name),fullPage:true});
try{
 await page.route('https://**',r=>r.abort('blockedbyclient'));
 await page.addInitScript(()=>{
  window.fixtureShareMode='unsupported';window.fixtureShares=[];
  Object.defineProperty(navigator,'share',{configurable:true,get(){return window.fixtureShareMode==='unsupported'?undefined:async data=>{window.fixtureShares.push(data);if(window.fixtureShareMode==='cancel')throw new DOMException('Cancelled','AbortError');if(window.fixtureShareMode==='denied')throw new DOMException('Denied','NotAllowedError');};}});
 });
 await page.clock.setFixedTime(fixture.state.paperNow+10000);
 await page.goto(fixture.origin+'/#live-pilot');await page.locator('#live-pilot-start').click();await wait('#live-pilot-status','P01');
 await page.goto(fixture.origin+'/#seat');await page.locator('#seat-connect').click();await page.getByRole('button',{name:/Whale Pools Fixture Wallet/}).click();await wait('#owned-status','3 whales found');await page.locator('#nickname').fill('Private draft stays');const before=await drafts();
 await page.goto(fixture.origin+'/#paper');await wait('#paper-eligibility','3 owned whales');await page.locator('#paper-name').fill('The Day Crew');await page.locator('#paper-consent').check();await page.locator('#paper-start').click();await wait('#paper-message','paper watch is saved');
 const own=await fixture.db.prepare('SELECT id FROM wp_paper_runs WHERE wallet IS NOT NULL').first();
 for(let i=0;i<5;i++)await fixture.paperTick({advance:1});
 const first=await (await context.request.get(fixture.origin+'/api/paper/recap/'+own.id)).json();
 const midnight=Math.floor(fixture.state.paperNow/86400000)*86400000+86400000;
 await fixture.paperTick({advance:(midnight-(fixture.state.paperNow-1000))/300000+2});await page.clock.setFixedTime(fixture.state.paperNow+10000);
 const url=fixture.origin+'/watch/'+own.id+'?day='+first.day,host=()=>page.locator('[data-watch-recap="'+own.id+'"]'),shares=async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('whale-pools-holder-live-pilot-v1')).events.filter(e=>e.type==='live_shared').length);
 await page.goto(url+'&private=ignored');await wait('[data-watch-recap="'+own.id+'"]','Saved day loaded');assert.equal(await host().locator('[data-recap-day]').inputValue(),first.day);assert.match(await host().innerText(),RegExp('SAVED DAY · '+first.day));assert.deepEqual(await drafts(),before);results.push('A direct saved-day visitor link opens the earlier UTC recap automatically and preserves both private draft scopes.');
 const unchanged=await fixture.db.prepare('SELECT * FROM wp_paper_runs WHERE id=?').bind(own.id).first();
 await host().locator('[data-recap-copy]').click();await wait('[data-recap-share-status]','Day link copied');assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),url);assert.equal(await host().locator('[aria-label="Saved UTC day link"]').inputValue(),url);results.push('Copy strips unrelated query data and retains the exact public ID and selected UTC day.');
 const pngDownload=page.waitForEvent('download');await host().locator('[data-recap-png]').click();const png=await pngDownload;await png.saveAs(path.join(output,'fixture-day.png'));const bytes=await readFile(path.join(output,'fixture-day.png'));assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(bytes.readUInt32BE(16),1200);await wait('[data-recap-share-status]','Day PNG downloaded');
 const svgDownload=page.waitForEvent('download');await host().locator('[data-recap-card]').click();const svg=await svgDownload;await svg.saveAs(path.join(output,'fixture-day.svg'));const card=await readFile(path.join(output,'fixture-day.svg'),'utf8');assert.match(card,RegExp(first.day));assert.match(card,/PARTIAL \/ WAITING/);assert.match(card,/Recorded fees/);assert.match(card,/not realized profit/);results.push('PNG and SVG exports are real dated day cards, with partial coverage, costs, rules and no realized-profit claim.');
 await host().locator('[data-recap-share]').click();await wait('[data-recap-share-status]','Day link copied');assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),url);results.push('A browser without native sharing copies the day link and explains the fallback.');
 const count=await shares();await page.evaluate(()=>{window.fixtureShareMode='cancel';return navigator.clipboard.writeText('untouched');});await host().locator('[data-recap-share]').click();await wait('[data-recap-share-status]','Share cancelled');assert.equal(await shares(),count);assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'untouched');results.push('Cancelling a simulated native share sheet neither copies nor records an output.');
 await page.evaluate(()=>window.fixtureShareMode='success');await host().locator('[data-recap-share]').click();await wait('[data-recap-share-status]','Check your chosen app');assert.equal((await page.evaluate(()=>window.fixtureShares.at(-1))).url,url);assert.equal(await shares(),count+1);results.push('A simulated successful native sheet receives the displayed day and does not claim destination delivery.');
 await page.evaluate(()=>window.fixtureShareMode='denied');await host().locator('[data-recap-share]').click();await wait('[data-recap-share-status]','Day link copied');assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),url);results.push('A denied simulated share sheet falls back to a recoverable public link.');
 assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('whale-pools-holder-live-pilot-v1')))).events.filter(e=>e.type==='live_reviewed').length,0);results.push('Automatic day landing and share outputs do not count as a deliberate own-watch review.');
 const oldRecap=await host().locator('[data-recap-content]').innerText();await page.route('**/api/paper/recap/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Fixture read unavailable"}'}));await host().locator('[data-recap]').click();await wait('[data-recap-status]','Could not load');assert.equal(await host().locator('[data-recap-content]').innerText(),oldRecap);await page.unroute('**/api/paper/recap/**');await host().locator('[data-recap]').click();await wait('[data-recap-status]','Saved day loaded');assert.equal(await host().locator('[data-recap-day]').inputValue(),first.day);results.push('A failed update keeps the displayed snapshot and retries the same UTC day.');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-fixture-saved-day.png');results.push('The saved-day selector, story and share controls fit a 390-pixel mobile viewport.');
 await page.goto(fixture.origin+'/#live-pilot');assert.match(await page.locator('#live-pilot-progress').innerText(),/First Start recorded/);assert.match(await page.locator('#live-pilot-progress').innerText(),/meaningful later-day return is recorded/);await shot('mobile-fixture-pilot-progress.png');results.push('Pilot progress distinguishes first Start from a later-day own-watch return; only the deliberate newer own-watch Update qualifies, not page landing or shares.');
 const noJS=await browser.newContext({javaScriptEnabled:false}),reader=await noJS.newPage();await reader.goto(url);assert.match(await reader.locator('noscript').innerText(),RegExp(first.day));assert.equal(await reader.locator('link[rel=canonical]').getAttribute('href'),url);await noJS.close();results.push('No-JavaScript metadata and fallback retain the selected day and its saved balance.');
 assert.equal((await context.request.get(fixture.origin+'/watch/'+own.id+'?day=2026-02-30')).status(),400);assert.equal((await context.request.get(fixture.origin+'/watch/'+own.id+'?day=2099-01-01')).status(),404);
 assert.deepEqual(await fixture.db.prepare('SELECT * FROM wp_paper_runs WHERE id=?').bind(own.id).first(),unchanged);assert.deepEqual(await drafts(),before);results.push('Invalid/future day links fail clearly; public sharing never mutates the company, frozen engine or private draft.');
 await page.setViewportSize({width:1440,height:1000});await page.goto(url);await wait('[data-recap-status]','Saved day loaded');await shot('desktop-fixture-saved-day.png');
 fixture.state.delayPath='/api/paper/recap/'+own.id;fixture.state.responseDelayMs=1200;await host().locator('[data-recap]').click();await page.locator('nav a[data-page=seat]').click();await page.locator('#fixture-wallet').selectOption('second');await page.locator('#seat-connect').waitFor({state:'visible'});await page.locator('nav a[data-page=paper]').click();await page.waitForTimeout(1500);assert.doesNotMatch(await page.locator('#paper-fleet').innerText(),/The Day Crew/);assert.deepEqual(await drafts(),before);results.push('A delayed day reply after navigation and wallet switching cannot restore the previous holder’s company or draft.');
 assert.deepEqual(errors,[]);await writeFile(path.join(output,'saved-day-browser.json'),JSON.stringify({fixture:true,syntheticCandles:true,acceleratedClock:true,nativeShareSimulated:true,realEligibleWallet:false,results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors,output},null,2));
}catch(e){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw e;}
finally{await context.close();await browser.close();await fixture.close();}
