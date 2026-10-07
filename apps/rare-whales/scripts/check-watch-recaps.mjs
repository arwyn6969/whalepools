import assert from 'node:assert/strict';
import {mkdir, readdir, access, writeFile, readFile, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {startFixtureServer} from './serve-fixture.mjs';

const require = createRequire(import.meta.url);
const app = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.RW_EVIDENCE_DIR || path.join(app, 'work/watch-recap-check'));
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
 await page.clock.setFixedTime(fixture.state.paperNow+10000);
 await page.goto(fixture.origin+'/#live-pilot');await page.locator('#live-pilot-start').click();await wait('#live-pilot-status','P01');
 await page.goto(fixture.origin+'/#seat');await page.locator('#seat-connect').click();await page.getByRole('button',{name:/Whale Pools Fixture Wallet/}).click();await wait('#owned-status','3 whales found');await page.locator('#nickname').fill('Keep my private company');const before=await drafts();
 await page.goto(fixture.origin+'/#paper');await wait('#paper-eligibility','3 owned whales');await page.locator('#paper-name').fill('The Recap Fixtures');await page.locator('#paper-consent').check();await page.locator('#paper-start').click();await wait('#paper-message','paper watch is saved');await wait('#paper-fleet','The Recap Fixtures');const own=await fixture.db.prepare('SELECT id FROM wp_paper_runs WHERE wallet IS NOT NULL').first();
 const host=()=>page.locator('[data-watch-recap="'+own.id+'"]');
 await host().locator('button').click();await wait('[data-watch-recap="'+own.id+'"]','Saved day loaded');assert.match(await host().innerText(),/not recorded/);assert.match(await host().innerText(),/No simulated fills/);assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('whale-pools-holder-live-pilot-v1')))).events.filter(e=>e.type==='live_reviewed').length,0);results.push('A newly started watch has a waiting recap with no invented balance or return.');
 for(let i=0;i<5;i++)await fixture.paperTick({advance:1});await page.clock.setFixedTime(fixture.state.paperNow+10000);await page.locator('#paper-refresh').click();await wait('#paper-fleet','timely observations');await host().locator('button').click();await wait('[data-watch-recap="'+own.id+'"]','Saved day loaded');const firstRecap=await (await context.request.get(fixture.origin+'/api/paper/recap/'+own.id)).json();assert.ok(firstRecap.buys>0);assert.equal(firstRecap.coverage.missing,0);assert.equal(firstRecap.coverage.recorded,5);assert.equal(firstRecap.coverage.actionable,5);assert.match(await host().innerText(),/simulated buy/);await shot('desktop-fixture-daily-recap.png');const firstReport=await page.evaluate(()=>JSON.parse(localStorage.getItem('whale-pools-holder-live-pilot-v1')));assert.equal(firstReport.events.filter(e=>e.type==='live_reviewed').length,1);await host().locator('button').click();await wait('[data-watch-recap="'+own.id+'"]','Saved day loaded');assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('whale-pools-holder-live-pilot-v1')))).events.filter(e=>e.type==='live_reviewed').length,1);results.push('The day recap explains actual saved fills, costs and all five actionable closes; an opted-in owner review records one newer observation, never a duplicate.');
 const midnight=Math.floor(fixture.state.paperNow/86400000)*86400000+86400000;
 await fixture.paperTick({advance:(midnight-(fixture.state.paperNow-1000))/300000+2});await page.clock.setFixedTime(fixture.state.paperNow+10000);await host().locator('button').click();await wait('[data-watch-recap="'+own.id+'"]','Saved day loaded');
 // Refresh the default day through a newly opened canonical visitor route.
 await page.goto(fixture.origin+'/watch/'+own.id);await wait('#paper-fleet','The Recap Fixtures');assert.equal(await page.locator('.paper-company').count(),1);assert.equal(await page.locator('#paper-launch').isVisible(),false);assert.equal(await page.locator('#paper-archive').isVisible(),false);await host().locator('button').click();await wait('[data-watch-recap="'+own.id+'"]','Saved day loaded');assert.equal(await host().locator('select option').count(),2);await host().locator('select').selectOption(firstRecap.day);await wait('[data-watch-recap="'+own.id+'"]','SAVED DAY');assert.match(await host().innerText(),/Coverage is partial/);assert.ok((await (await context.request.get(fixture.origin+'/api/paper/recap/'+own.id+'?day='+firstRecap.day)).json()).coverage.missing>0);assert.deepEqual(await drafts(),before);results.push('Canonical visitor opens one dated watch; an earlier UTC day remains inspectable and missing observations stay explicit without changing the private draft.');
 const copy=page.locator('[data-paper-copy="'+own.id+'"]');await copy.click();await wait('[data-share-status]','Watch link copied');assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),fixture.origin+'/watch/'+own.id);results.push('Copy on a nested watch URL produces one canonical path with no repeated watch suffix.');
 const pngDownload=page.waitForEvent('download');await page.locator('[data-paper-png="'+own.id+'"]').click();const png=await pngDownload;await png.saveAs(path.join(output,'fixture-dated-watch.png'));const bytes=await readFile(path.join(output,'fixture-dated-watch.png'));assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(bytes.readUInt32BE(16),1200);assert.ok(bytes.readUInt32BE(20)>600);await wait('[data-share-status]','PNG downloaded');results.push('Browser exports a real 1200-pixel PNG from the displayed dated snapshot under the unchanged CSP.');
 const svgDownload=page.waitForEvent('download');await page.locator('[data-paper-card="'+own.id+'"]').click();const svg=await svgDownload;await svg.saveAs(path.join(output,'fixture-dated-watch.svg'));const card=await readFile(path.join(output,'fixture-dated-watch.svg'),'utf8');assert.match(card,/Last valuation/);assert.match(card,RegExp(own.id));assert.match(card,/Rules [0-9a-f]{64}/);results.push('SVG remains available with the same dated valuation, costs and full rules hash.');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-fixture-daily-recap.png');results.push('Direct watch, recap day selector and sharing controls fit a 390-pixel mobile layout.');
 await page.goto(fixture.origin+'/#paper/'+own.id);await wait('#paper-fleet','The Recap Fixtures');assert.equal(await page.locator('.paper-company').count(),1);results.push('Existing hash links continue opening the same dated watch.');
 // A failed read is recoverable without replacing the saved recap or watch.
 await host().locator('button').click();await wait('[data-watch-recap="'+own.id+'"]','Saved day loaded');const prior=await host().locator('[data-recap-content]').innerText();await page.route('**/api/paper/recap/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Fixture recorder read unavailable."}'}));await host().locator('button').click();await wait('[data-watch-recap="'+own.id+'"]','Could not load');assert.equal(await host().locator('[data-recap-content]').innerText(),prior);await page.unroute('**/api/paper/recap/**');await host().locator('button').click();await wait('[data-watch-recap="'+own.id+'"]','Saved day loaded');results.push('A recap service failure keeps the last saved snapshot and recovers with Update.');
 // Late responses must not rebuild panels after identity/route changes.
 fixture.state.delayPath='/api/paper/recap/'+own.id;fixture.state.responseDelayMs=1200;await host().locator('button').click();await page.locator('nav a[data-page=seat]').click();await page.locator('#fixture-wallet').selectOption('second');await page.locator('#seat-connect').waitFor({state:'visible'});await page.locator('nav a[data-page=paper]').click();await page.waitForTimeout(1500);assert.equal(await page.locator('[data-watch-recap="'+own.id+'"] [data-recap-content]').count(),0);assert.doesNotMatch(await page.locator('#paper-fleet').innerText(),/The Recap Fixtures/);assert.deepEqual(await drafts(),before);results.push('Delayed recap replies cannot restore the previous wallet’s watch or alter its historical private draft.');
 fixture.state.responseDelayMs=0;
 const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}}),reader=await noJS.newPage();await reader.goto(fixture.origin+'/watch/'+own.id);assert.match(await reader.locator('noscript').innerText(),/The Recap Fixtures/);assert.match(await reader.locator('noscript').innerText(),/live market|Live market/);assert.ok(await reader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await reader.screenshot({path:path.join(output,'mobile-no-js-watch.png'),fullPage:true});const metadata=await reader.locator('meta[property="og:description"]').getAttribute('content');assert.match(metadata,/UTC/);assert.match(metadata,/paper balance/);assert.equal(await reader.locator('link[rel=canonical]').getAttribute('href'),fixture.origin+'/watch/'+own.id);await noJS.close();results.push('JavaScript-disabled visitors receive a readable dated record; metadata carries actual valuation times and a canonical watch URL.');
 const missing=await context.request.get(fixture.origin+'/watch/11111111-1111-4111-8111-111111111111');assert.equal(missing.status(),404);results.push('Unknown dated records return a real 404 rather than a misleading empty share page.');
 assert.deepEqual(errors,[]);await writeFile(path.join(output,'watch-recap-browser.json'),JSON.stringify({fixture:true,syntheticCandles:true,acceleratedClock:true,realEligibleWallet:false,results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors,output},null,2));
}catch(e){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw e;}
finally{await context.close();await browser.close();await fixture.close();}
