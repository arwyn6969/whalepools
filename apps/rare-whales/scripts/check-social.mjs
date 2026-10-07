import assert from 'node:assert/strict';
import {mkdir, readdir, access, writeFile, readFile, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {startFixtureServer} from './serve-fixture.mjs';

const require = createRequire(import.meta.url);
const app = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.RW_EVIDENCE_DIR || path.join(app, 'work/social-check'));
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
const draft=()=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('whale-pools-company-draft-v1:'))));
const route=async hash=>{await page.goto(fixture.origin+'/#'+hash);await page.locator('#'+hash.split('/')[0]).waitFor({state:'visible'});};
async function shot(name){await page.screenshot({path:path.join(output,name),fullPage:true});}
try{
 await page.route('https://**',r=>r.abort('blockedbyclient'));
 await page.clock.setFixedTime(fixture.state.paperNow+10000);
 await route('tide');await wait('#tide-status','Saved round');assert.equal(await page.locator('.tide-strategy').count(),3);assert.equal(await page.locator('#tide-form button[type=submit]').isDisabled(),true);await shot('desktop-fixture-daily-tide.png');results.push('Signed-out Daily Tide shows the next prospective UTC round and three equal-budget presets; joining requires an eligible wallet.');
 await route('live-pilot');await page.locator('#live-pilot-start').click();await wait('#live-pilot-status','P01');
 await route('seat');await page.locator('#seat-connect').click();await page.getByRole('button',{name:/Whale Pools Fixture Wallet/}).click();await wait('#owned-status','3 whales found');await page.locator('#nickname').fill('Keep my private company');const before=await draft();
 await route('paper');await wait('#paper-eligibility','3 owned whales');await page.locator('#paper-name').fill('The Live Social Fixtures');await page.locator('#paper-consent').check();await page.locator('#paper-start').click();await wait('#paper-message','paper watch is saved');await wait('#paper-fleet','The Live Social Fixtures');
 const own=await fixture.db.prepare('SELECT id FROM wp_paper_runs WHERE wallet IS NOT NULL').first();
 const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('whale-pools-holder-live-pilot-v1')));assert.deepEqual(report.events.filter(e=>['live_ready_new','live_started'].includes(e.type)).map(e=>e.type),['live_ready_new','live_started']);assert.doesNotMatch(JSON.stringify(report),/0x|The Live Social|runId|tokenId/);assert.deepEqual(await draft(),before);results.push('Opt-in live report records exactly one new activation after verified inventory and confirmed Start, contains no private identities, and preserves the historical draft.');
 await page.locator('[data-paper-review="'+own.id+'"]').click();await wait('[data-share-status]','No newer');await fixture.paperTick({advance:1});await page.clock.setFixedTime(fixture.state.paperNow+10000);await page.locator('#paper-refresh').click();await wait('#paper-fleet','timely observations');await page.locator('[data-paper-review="'+own.id+'"]').click();await wait('[data-share-status]','New observation reviewed');results.push('Explicit owner review accepts a newer completed observation and rejects a record with no new observation.');
 await page.locator('[data-paper-copy="'+own.id+'"]').click();await wait('[data-share-status]','Watch link copied');const copied=await page.evaluate(()=>navigator.clipboard.readText());assert.equal(copied,fixture.origin+'/watch/'+own.id);
 const pendingDownload=page.waitForEvent('download');await page.locator('[data-paper-card="'+own.id+'"]').click();const download=await pendingDownload;const cardPath=path.join(output,'fixture-dated-watch.svg');await download.saveAs(cardPath);const card=await readFile(cardPath,'utf8');assert.match(card,/Last valuation/);assert.match(card,/0.08% fee/);assert.match(card,/Rules [0-9a-f]{64}/);results.push('Canonical dated link copies and the downloadable SVG includes the actual last valuation, rules, exposure and costs.');
 await page.locator('#paper-stop').click();await wait('#paper-message','Watch stopped');await wait('#paper-archive-list','STOPPED');await page.locator('#paper-name').fill('A fresh follow-up watch');await page.locator('#paper-consent').check();await page.locator('#paper-start').click();await wait('#paper-message','paper watch is saved');await page.locator('#paper-archive-refresh').click();await page.waitForFunction(()=>document.querySelectorAll('.archive-row').length===2);await shot('desktop-fixture-archive.png');results.push('Stop and a follow-up Start keep both dated watches accessible in the wallet-only archive.');
 const lab=await fixture.db.prepare('SELECT id FROM wp_paper_runs WHERE wallet IS NULL LIMIT 1').first();await route('paper/'+lab.id);await wait('#paper-fleet','FORWARD PAPER');assert.equal(await page.locator('#paper-launch').isVisible(),false);assert.equal(await page.locator('#paper-presets').isVisible(),false);assert.equal(await page.locator('#paper-archive').isVisible(),false);assert.equal(await page.locator('[data-paper-review]').count(),0);assert.deepEqual(await draft(),before);results.push('Inspecting another public watch hides holder mutation controls and archive while retaining the private draft.');
 await route('tide');await wait('#tide-status','Saved round');assert.equal(await page.locator('#tide-form button[type=submit]').isDisabled(),false);await page.locator('#tide-name').fill('The Next Tide Fixtures');await page.locator('#tide-preset').selectOption('breakout');await page.locator('#tide-consent').check();await page.locator('#tide-form button[type=submit]').click();await wait('#tide-message','Your preset is saved');await wait('#tide-eligibility','saved and locked');assert.equal(await page.locator('#tide-form button[type=submit]').isDisabled(),true);assert.deepEqual(await draft(),before);const pick=await fixture.db.prepare('SELECT * FROM wp_tide_picks').first();assert.equal(pick.preset,'breakout');results.push('An owned fixture whale badge confirms one locked preset pick without changing the holder company or draft.');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-fixture-daily-tide.png');await route('live-pilot');await wait('#live-pilot-status','P01');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-fixture-live-pilot.png');results.push('Daily Tide and local live pilot fit a 390-pixel mobile layout without horizontal overflow.');
 await route('seat');await page.locator('#fixture-wallet').selectOption('second');await page.locator('#seat-connect').waitFor({state:'visible'});await route('tide');await wait('#tide-eligibility','Sign in');assert.equal(await page.locator('#tide-form button[type=submit]').isDisabled(),true);assert.equal(await page.locator('#tide-name').inputValue(),'My Tide Pick');await route('live-pilot');await wait('#live-pilot-status','stopped');results.push('Wallet switching clears the pending pick and archive identity and stops the previous wallet’s live pilot recording.');
 await writeFile(path.join(output,'P01-live-fixture.json'),JSON.stringify(await page.evaluate(()=>JSON.parse(localStorage.getItem('whale-pools-holder-live-pilot-v1'))),null,2));
 // Accelerated synthetic clock only: complete the same next-day cohort in all 288 observed increments.
 const round=await fixture.db.prepare('SELECT * FROM wp_tide_rounds WHERE id=?').bind(pick.round_id).first();const skipped=(round.starts_at-(fixture.state.paperNow-1000))/300000;
 await fixture.paperTick({advance:skipped});for(let i=0;i<288;i++)await fixture.paperTick({advance:1});
 await route('tide/'+round.id);await wait('#tide-round','FINAL RESULTS');assert.equal(await page.locator('.tide-strategy .panel-title').filter({hasText:'RANK'}).count(),3);assert.equal(await page.locator('#tide-form button[type=submit]').isDisabled(),true);await shot('desktop-fixture-final-tide.png');results.push('Accelerated synthetic 24-hour cohort renders 288-observation final ranks and rejects further picks; this is fixture coverage, not a completed real live round.');
 assert.deepEqual(errors,[]);await writeFile(path.join(output,'social-browser.json'),JSON.stringify({fixture:true,syntheticCandles:true,acceleratedClock:true,realEligibleWallet:false,results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors,output},null,2));
}catch(e){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw e;}
finally{await context.close();await browser.close();await fixture.close();}
