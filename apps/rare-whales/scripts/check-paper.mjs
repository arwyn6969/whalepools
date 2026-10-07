import assert from 'node:assert/strict';
import {mkdir, readdir, access, writeFile, readFile, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {startFixtureServer} from './serve-fixture.mjs';

const require = createRequire(import.meta.url);
const app = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.RW_EVIDENCE_DIR || path.join(app, 'work/paper-check'));
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
const wait=(selector,pattern)=>page.waitForFunction(({selector,pattern})=>new RegExp(pattern).test(document.querySelector(selector)?.textContent||''),{selector,pattern});
const draft=()=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('whale-pools-company-draft-v1:'))));
async function shot(name){await page.waitForFunction(()=>[...document.querySelectorAll('.page:not([hidden]) img[data-whale-art]')].every(i=>['ready','error'].includes(i.dataset.artState)));await page.screenshot({path:path.join(output,name),fullPage:true});}
async function route(hash){await page.goto(fixture.origin+'/#'+hash);await page.locator('#'+hash.split('/')[0]).waitFor({state:'visible'});}
async function refresh(){await page.locator('#paper-refresh').click();await wait('#paper-feed','MARKET WATCH|Recorder recovering');}
try{
 await page.route('https://**',r=>r.abort('blockedbyclient'));
 await route('paper');await wait('#paper-feed','MARKET WATCH');assert.equal(await page.locator('.paper-company').count(),3);assert.equal(await page.locator('#paper-start').isDisabled(),true);results.push('Signed-out preset fleet is readable; holder start is disabled.');
 await route('seat');await page.locator('#seat-connect').click();await page.getByRole('button',{name:/Whale Pools Fixture Wallet/}).click();await wait('#owned-status','3 whales found');
 await page.locator('#nickname').fill('Private historical draft');const before=await draft();
 await route('paper');await wait('#paper-eligibility','3 owned whales');assert.equal(await page.locator('[data-paper-whale]:checked').count(),3);
 await page.locator('#paper-name').fill('The Forward Fixtures');await page.locator('#paper-consent').check();await page.locator('#paper-start').click();await wait('#paper-message','paper watch is saved');await wait('#paper-fleet','The Forward Fixtures');
 assert.deepEqual(await draft(),before);assert.equal(await page.locator('#paper-start').isDisabled(),true);results.push('One owned whale qualifies; default mixed crew starts without historical publication and preserves the private draft.');
 const own=await fixture.db.prepare('SELECT id FROM wp_paper_runs WHERE wallet IS NOT NULL').first();
 await fixture.paperTick({advance:1});await fixture.paperTick({advance:1});await refresh();await wait('#paper-fleet','POSITION OPEN');await shot('desktop-fixture-paper.png');results.push('New synthetic observations queue and fill paper orders; chart, positions and captain log render.');
 await page.reload();await wait('#paper-fleet','The Forward Fixtures');assert.equal(await page.locator('#paper-stop').isVisible(),true);results.push('Reload restores the saved server run and locked controls.');
 await fixture.paperTick({advance:1,error:true});await refresh();await wait('#paper-feed','Recorder recovering');assert.equal(await page.locator('.paper-company').count(),4);await fixture.paperTick({advance:1});await refresh();results.push('Market outage retains the crew and recovers with explicit feedback.');
 const guest=await browser.newContext({viewport:{width:390,height:844}}),spectator=await guest.newPage();spectator.on('pageerror',e=>errors.push(e.message));await spectator.route('https://**',r=>r.abort('blockedbyclient'));
 await spectator.goto(fixture.origin+'/#paper/'+own.id);await spectator.waitForFunction(()=>document.querySelector('#paper-fleet')?.textContent.includes('The Forward Fixtures'));assert.equal(await spectator.locator('.paper-company').count(),1);
 await spectator.waitForFunction(()=>[...document.querySelectorAll('.page:not([hidden]) img[data-whale-art]')].every(i=>['ready','error'].includes(i.dataset.artState)));const layout=await spectator.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,id:e.id,class:e.className,right:e.getBoundingClientRect().right}))}));assert.ok(layout.width<=layout.viewport+1,JSON.stringify(layout));await spectator.screenshot({path:path.join(output,'mobile-public-paper.png'),fullPage:true});await guest.close();results.push('Signed-out mobile public record is readable without changing any holder draft; no horizontal overflow.');
 await page.locator('#paper-stop').click();await wait('#paper-message','Watch stopped');await wait('#paper-fleet','STOPPED');const count=(await fixture.db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events WHERE run_id=?').bind(own.id).first()).n;
 await fixture.paperTick({advance:1});assert.equal((await fixture.db.prepare('SELECT COUNT(*) AS n FROM wp_paper_events WHERE run_id=?').bind(own.id).first()).n,count);results.push('Stopping freezes the run and later recorder ticks cannot append fills.');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-fixture-paper.png');results.push('Mobile holder controls, preset cards and chart fit the viewport.');
 await page.locator('#paper-name').fill('A new dated crew');await page.locator('#paper-consent').check();await page.locator('#paper-start').click();await wait('#paper-message','paper watch is saved');assert.equal((await fixture.db.prepare('SELECT COUNT(*) AS n FROM wp_paper_runs WHERE wallet IS NOT NULL').first()).n,2);results.push('Changing style starts a new public record rather than rewriting an old result.');
 await route('seat');assert.equal(await page.locator('#nickname').inputValue(),'Private historical draft');assert.deepEqual(await draft(),before);results.push('Returning to My Company restores the original historical draft.');
 await page.locator('#fixture-wallet').selectOption('second');await page.locator('#seat-connect').waitFor({state:'visible'});await route('paper');await wait('#paper-eligibility','Sign in');assert.equal(await page.locator('#paper-start').isDisabled(),true);assert.equal(await page.locator('#paper-name').inputValue(),'My Whale Watch');results.push('Wallet switches clear live form identity and cannot operate the previous wallet run.');
 assert.deepEqual(errors,[]);await writeFile(path.join(output,'paper-browser.json'),JSON.stringify({fixture:true,syntheticCandles:true,realEligibleWallet:false,results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors,output},null,2));
}catch(e){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw e;}
finally{await context.close();await browser.close();await fixture.close();}
