import assert from 'node:assert/strict';
import {mkdir, readdir, access, writeFile, readFile, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {startFixtureServer} from './serve-fixture.mjs';
import {seedTideOutcomes} from '../tests/fixtures/tide-rounds.mjs';

const require = createRequire(import.meta.url);
const app = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.RW_EVIDENCE_DIR || path.join(app, 'work/tide-outcome-check'));
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
const ids=await seedTideOutcomes(fixture),results=[],errors=[];
const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']}),page=await context.newPage();
await context.addInitScript(t=>{Date.now=()=>Number(sessionStorage.getItem('tide-test-clock')||t);},fixture.state.paperNow+2000);
page.on('pageerror',e=>errors.push(e.message));
const wait=(selector,pattern)=>page.waitForFunction(({selector,pattern})=>new RegExp(pattern).test(document.querySelector(selector)?.textContent||''),{selector,pattern});
const route=async id=>{await page.goto(fixture.origin+'/tide/'+id);await wait('#tide-status',id);};
const local=()=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/draft|bookmark|live-pilot/.test(k))));
const shot=async name=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(output,name),fullPage:false});};
try{
 await page.route('https://**',r=>r.abort('blockedbyclient'));
 await route(ids.partial);await wait('.tide-outcome','THIS TIDE ENDED WITH GAPS');assert.equal(await page.locator('#paper').isVisible(),false);assert.equal(await page.locator('#tide-form').isVisible(),false);assert.equal(await page.locator('.tide-strategy .panel-title').filter({hasText:'RANK'}).count(),0);assert.match(await page.locator('.tide-outcome').innerText(),/no final ranks/);assert.equal(await page.locator('[aria-label="Dated Tide link"]').inputValue(),fixture.origin+'/tide/'+ids.partial);results.push('Anonymous canonical round opens its dated partial result, never redirects to paper or claims ranks, and hides expired join controls.');
 await page.locator('[data-tide-copy]').click();await wait('[data-tide-share-status]','Round link copied');assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),fixture.origin+'/tide/'+ids.partial);
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-tide-svg]').click();const download=await downloadPromise;const file=path.join(output,'partial-round.svg');await download.saveAs(file);const card=await readFile(file,'utf8');assert.match(card,/NO FINAL RANKS/);assert.doesNotMatch(card,/Rank [123]/);assert.match(card,/14 skipped\/gap/);results.push('Copied link and SVG retain exact day/rules/partial coverage and omit final ranks.');
 const pngPromise=page.waitForEvent('download');await page.locator('[data-tide-png]').click();const png=await pngPromise;await png.saveAs(path.join(output,'partial-round.png'));assert.deepEqual([...new Uint8Array(await readFile(path.join(output,'partial-round.png'))).slice(0,8)],[137,80,78,71,13,10,26,10]);results.push('PNG download uses the displayed text-only snapshot and actual coverage.');
 await page.locator('.tide-outcome').scrollIntoViewIfNeeded();await shot('desktop-partial-tide.png');await page.setViewportSize({width:390,height:844});await page.locator('.tide-outcome').scrollIntoViewIfNeeded();await shot('mobile-partial-tide.png');assert.ok(await page.locator('[data-tide-share]').isVisible());results.push('Desktop and mobile outcome/sharing actions fit with keyboard focus and no page overflow.');
 await page.getByRole('link',{name:'CHOOSE THE NEXT TIDE →',exact:true}).click();await wait('#tide-status',ids.next);assert.equal(await page.locator('#tide-form').isVisible(),true);assert.match(await page.locator('.tide-outcome').innerText(),/No round observations/);await page.getByRole('link',{name:'READ LAST FINISHED TIDE →',exact:true}).click();await wait('#tide-status',ids.partial);results.push('Ended round leads to the future queue; latest finished outcome is discoverable from the next round.');
 await route(ids.complete);await wait('.tide-outcome','THE TIDE IS IN');assert.equal(await page.locator('.tide-strategy .panel-title').filter({hasText:'RANK'}).count(),3);assert.match(await page.locator('.tide-outcome').innerText(),/share rank 1/);results.push('Complete synthetic round preserves tied server ranks and the full 288-close qualification.');
 await route(ids.paused);await wait('.tide-outcome','PAUSED');assert.equal(await page.locator('#tide-form').isVisible(),false);assert.equal(await page.locator('.tide-strategy .panel-title').filter({hasText:'RANK'}).count(),0);results.push('Paused older record remains readable and cannot accept new picks or claim a ranking.');
 const oldRequest=page.waitForRequest(r=>r.url().includes('/api/tide?round='+ids.archived));await route(ids.archived);await oldRequest;assert.equal(await page.locator('[aria-label="Dated Tide link"]').inputValue(),fixture.origin+'/tide/'+ids.archived);results.push('Direct old dated round outside the seven recent records uses the specific-round read and canonical URL.');
 await route(ids.next);await page.locator('#tide-connect').click();await page.getByRole('button',{name:/Whale Pools Fixture Wallet/}).click();await wait('#tide-eligibility','3 owned whales');
 await page.goto(fixture.origin+'/#seat');await wait('#owned-status','3 whales found');await page.locator('#nickname').fill('Private historical draft');await page.goto(fixture.origin+'/#paper');await wait('#paper-eligibility','3 owned whales');await page.locator('#paper-name').fill('Private paper setup');const before=await local();await route(ids.partial);assert.deepEqual(await local(),before);results.push('Signed-in visitor round inspection preserves historical/live private drafts and bookmarks.');
 await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('cancelled','AbortError');}});});await page.locator('[data-tide-share]').click();await wait('[data-tide-share-status]','Sharing cancelled');assert.deepEqual(await local(),before);
 await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw Error('denied');}});});await page.locator('[data-tide-share]').click();await wait('[data-tide-share-status]','Round link copied');results.push('Native-share cancellation changes nothing; denied sharing offers explicit clipboard fallback without claiming a post.');
 await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw Error('denied');}});Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async()=>{throw Error('denied');}});});await page.locator('[data-tide-share]').click();await wait('[data-tide-share-status]','Select and copy');assert.deepEqual(await local(),before);results.push('Share and clipboard denial retain the selectable canonical link and private work.');
 await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:()=>new Promise(resolve=>window.tideShareResolve=resolve)});});await page.locator('[data-tide-share]').click();await page.getByRole('link',{name:'CHOOSE THE NEXT TIDE →',exact:true}).click();await wait('#tide-status',ids.next);await page.evaluate(()=>window.tideShareResolve());assert.equal(await page.locator('[data-tide-share-status]').innerText(),'');assert.deepEqual(await local(),before);results.push('Late share completion after navigation cannot overwrite another round status or record private progress.');
 await page.locator('[data-tide-share]').click();await page.locator('#fixture-wallet').selectOption('second');await wait('#tide-eligibility','Sign in');await page.evaluate(()=>window.tideShareResolve());assert.equal(await page.locator('[data-tide-share-status]').innerText(),'');assert.deepEqual(await local(),before);results.push('Wallet switching discards late sharing feedback while retaining each private draft.');
 await page.route('**/api/tide*',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fixture unavailable'})}));const displayed=await page.locator('#tide-round').innerHTML();await page.locator('#tide-refresh').click();await wait('#tide-status','Round could not refresh');assert.equal(await page.locator('#tide-round').innerHTML(),displayed);await page.unroute('**/api/tide*');await page.locator('#tide-refresh').click();await wait('#tide-status','Saved round');results.push('Refresh failure keeps the last displayed result/link with recoverable retry.');
 const nojs=await browser.newContext({javaScriptEnabled:false}),noPage=await nojs.newPage();await noPage.goto(fixture.origin+'/tide/'+ids.partial);assert.match(await noPage.locator('noscript').innerText(),/THIS TIDE ENDED WITH GAPS/);assert.match(await noPage.locator('noscript').innerText(),/no final ranks/);await nojs.close();results.push('No-JavaScript destination exposes actual saved partial balances and rules with an inspect link.');
 assert.deepEqual(errors,[]);await writeFile(path.join(output,'tide-outcome-browser.json'),JSON.stringify({fixture:true,syntheticPresentationCases:true,syntheticCandles:true,acceleratedClock:true,nativeShareSimulated:true,realEligibleWallet:false,results,errors},null,2)+'\n');console.log(JSON.stringify({passed:results.length,errors,output}));
}catch(e){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw e;}
finally{await context.close();await browser.close();await fixture.close();}
