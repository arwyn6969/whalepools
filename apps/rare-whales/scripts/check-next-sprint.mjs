import assert from 'node:assert/strict';
import {mkdir, readdir, access, writeFile, readFile, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {startFixtureServer} from './serve-fixture.mjs';

const require = createRequire(import.meta.url);
const app = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.RW_EVIDENCE_DIR || path.join(app, 'work/next-sprint-check'));
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
await mkdir(output, {recursive: true});
const fixture = await startFixtureServer({port: 0});
const browser = await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
const results = [], screenshots = [], pageErrors = [];
let activePage;
const textMatches = (page, selector, pattern, timeout = 15000) => page.waitForFunction(({selector, source, flags}) => new RegExp(source, flags).test(document.querySelector(selector)?.textContent || ''), {selector, source: pattern.source, flags: pattern.flags}, {timeout});
const control = (page, data) => page.evaluate(data => window.__whaleFixture.control(data), data);
const draftState = page => page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('whale-pools-company-draft-v1:'))));
const companyChoices = entries => Object.fromEntries(Object.entries(entries).map(([key, value]) => {
  const saved = JSON.parse(value);
  // A transferred selected whale is replaced by the remaining whale during
  // replay. Withdrawal may persist that repaired inspector choice.
  delete saved.draft.selected;
  return [key, saved];
}));
async function clickVisible(page, selector) {
  const box = await page.locator(selector).boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, selector + ' must be visible before the pointer click.');
  assert.equal(await page.locator(selector).isEnabled(), true);
  // Cached Chromium may stall on Playwright's redundant DOM auto-scroll after
  // a viewport screenshot. Exercise the actual visible control with the pointer.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
const screenshot = async (page, filename, fullPage = true) => {
  await page.waitForFunction(()=>[...document.querySelectorAll('.page:not([hidden]) img[data-whale-art]')].every(img=>['ready','error'].includes(img.dataset.artState)&&img.complete&&img.naturalWidth>0));
  if (fullPage) await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({path: path.join(output, filename), fullPage}); screenshots.push(filename);
};
async function record(name, action) {
  const started = Date.now();
  await action();
  results.push({name, passed: true, durationMs: Date.now() - started});
  console.log('PASS ' + name);
}
async function route(page, hash) {await page.evaluate(hash => {location.hash = hash;}, hash);}
async function signIn(page, count) {
  await route(page, 'seat');
  await page.locator('#seat-connect').click();
  await page.locator('.wallet-option').filter({hasText: 'Fixture Wallet'}).click();
  await page.waitForFunction(() => !document.querySelector('#seat-fields').disabled);
  if (count !== undefined) await textMatches(page, '#owned-status', new RegExp(count + ' whales? found'));
}
async function add(page, value) {
  await page.locator('#owned-whale').selectOption(value);
  await page.locator('#add-owned-whale').click();
  await page.waitForFunction(value => !!document.querySelector(`[data-crew-remove="${value}"]`), value);
  await textMatches(page, '#seat-result', /completed trades/);
}
async function switchWallet(page, wallet, count) {
  await route(page, 'seat');
  await page.evaluate(wallet => window.__whaleFixture.wallet(wallet), wallet);
  await page.locator('#seat-connect').waitFor({state: 'visible'});
  await signIn(page, count);
}
async function owned(page, count) {await textMatches(page, '#owned-status', new RegExp(count + ' whales? found'));}
async function createPage(viewport) {
  const context = await browser.newContext({viewport});
  const page = await context.newPage();
  activePage = page;
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('https://**', async intercepted => {
    // The fixture provider rewrites RPC to localhost. External portraits use the
    // app's visible fallback, keeping the regression deterministic and offline.
    await intercepted.abort('blockedbyclient');
  });
  await page.goto(fixture.origin + '/#seat');
  await textMatches(page, '#season-status', /ARCADE OPEN/);
  return {context, page};
}

async function exportFile(page,selector,name){
 const pending=page.waitForEvent('download');await page.locator(selector).click();const file=await pending;await file.saveAs(path.join(output,name));return readFile(path.join(output,name),'utf8');
}
async function chooseThree(page){
 await route(page,'challenge');await textMatches(page,'#challenge-progress',/0\/3 loaners/);
 for(const id of ['rarewhales:245','rarewhales:246','rarewhales:247'])await page.locator(`[data-loaner="${id}"]`).check();
 await page.locator('[data-challenge-tactic="rarewhales:246"]').focus();await page.locator('[data-challenge-tactic="rarewhales:246"]').selectOption('recovery');
 await page.locator('[data-challenge-tactic="rarewhales:247"]').focus();await page.locator('[data-challenge-tactic="rarewhales:247"]').selectOption('breakout');
}
try{
 const {context,page}=await createPage({width:1440,height:1000});let publicLink,publicId,privateBefore;
 await record('desktop: voluntary pilot records fixture first publication without wallet data',async()=>{
  assert.equal(await page.evaluate(()=>localStorage.getItem('whale-pools-holder-pilot-v1')),null);
  await route(page,'pilot');await page.locator('#pilot-code').selectOption('P01');await page.locator('#pilot-start').click();
  await signIn(page,3);await add(page,'rarewhales:245');await add(page,'rarewhales:246');await page.locator('#nickname').fill('The Shareable Whales');await page.locator('#publish').check();await page.locator('#reserve').click();await textMatches(page,'#seat-message',/Published 2 whales/);
  publicLink=await page.locator('#published-link').getAttribute('href');publicId=publicLink.split('/')[1];assert.ok(publicId);
  await route(page,'pilot');const report=JSON.parse(await exportFile(page,'#pilot-export','P01-fixture.json'));
  assert.deepEqual(report.events.map(e=>e.type),['wallet_ready_new','published_create']);assert.ok(!JSON.stringify(report).includes('0x'));assert.ok(!JSON.stringify(report).includes('The Shareable Whales'));
 });
 await record('desktop: own public destination, comparison and card preserve the private draft',async()=>{
  await route(page,'seat');await page.locator('#nickname').fill('Unpublished Private Name');privateBefore=await draftState(page);
  await route(page,publicLink);await textMatches(page,'#public-company-content',/The Shareable Whales/);
  assert.ok(!(await page.locator('#public-company-content').textContent()).includes('Unpublished Private Name'));
  await page.locator('#company-compare').click();await textMatches(page,'#company-compare-result',/Your private crew/);
  const svg=await exportFile(page,'#company-card','public-company-card.svg');assert.match(svg,/HISTORICAL ARCADE/);assert.ok(!svg.includes('Unpublished Private Name'));assert.ok(!svg.includes('<image'));
  await page.locator('#company-copy').click();await textMatches(page,'#company-message',/link copied|Copy the selected link/);
  assert.deepEqual(await draftState(page),privateBefore);await screenshot(page,'desktop-public-company.png');
  const card=await context.newPage();await card.setViewportSize({width:1200,height:660});await card.setContent(svg);await card.screenshot({path:path.join(output,'public-company-card.png'),fullPage:true});screenshots.push('public-company-card.png');await card.close();
 });
 await record('desktop: public destination loads signed out and spectator replay preserves sandbox',async()=>{
  const guest=await createPage({width:1440,height:1000});await guest.page.goto(fixture.origin+'/'+publicLink);await textMatches(guest.page,'#public-company-content',/The Shareable Whales/);
  assert.equal(await guest.page.locator('#logout').isHidden(),true);const before=await guest.page.evaluate(()=>localStorage.getItem('whale-pools-sandbox-v1'));
  await guest.page.locator('#company-replay').click();await guest.page.locator('#spectator-banner').waitFor({state:'visible'});await guest.page.locator('#return-to-draft').click();
  assert.equal(await guest.page.evaluate(()=>localStorage.getItem('whale-pools-sandbox-v1')),before);await guest.context.close();activePage=page;
 });
 await record('desktop: independent loaner challenge, fixed size, results and versioned restoration',async()=>{
  await chooseThree(page);assert.equal(await page.locator('[data-loaner="whalestreet:1"]').isDisabled(),true);
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.challengeTactic),'rarewhales:247','Tactic changes must retain keyboard focus after rerender.');
  await page.locator('[data-challenge-tactic="rarewhales:246"]').selectOption('trend');await page.locator('[data-challenge-tactic="rarewhales:247"]').selectOption('trend');await page.locator('#challenge-run').click();await textMatches(page,'#challenge-result',/KEEP EXPLORING.*Over the drawdown limit/);
  await page.locator('[data-challenge-tactic="rarewhales:246"]').selectOption('recovery');await page.locator('[data-challenge-tactic="rarewhales:247"]').selectOption('breakout');
  await page.locator('#challenge-run').click();await textMatches(page,'#challenge-result',/Lower episode return/);await textMatches(page,'#challenge-result',/Early tide.*Later tide/);
  assert.deepEqual(await draftState(page),privateBefore);await screenshot(page,'desktop-tidal-trio.png');
  await page.reload();await textMatches(page,'#challenge-progress',/3\/3 loaners/);assert.equal(await page.locator('[data-challenge-tactic="rarewhales:246"]').inputValue(),'recovery');
  await route(page,'seat');await owned(page,3);assert.equal(await page.locator('#nickname').inputValue(),'Unpublished Private Name');assert.deepEqual(await draftState(page),privateBefore);
 });
 await record('desktop: challenge asset failure retries with a clear recovery action',async()=>{
  const guest=await createPage({width:1440,height:1000});let failed=false;await guest.page.route('**/challenge.json',async r=>{if(!failed){failed=true;await r.abort();}else await r.continue();});
  await route(guest.page,'challenge');await guest.page.locator('#challenge-retry').waitFor({state:'visible'});await textMatches(guest.page,'#challenge-message',/Challenge unavailable/);await guest.page.locator('#challenge-retry').click();await textMatches(guest.page,'#challenge-progress',/0\/3 loaners/);await guest.context.close();activePage=page;
 });
 await record('desktop: public request failure retries and stale company response cannot take over navigation',async()=>{
  let failed=false;await page.route('**/api/company/*',async r=>{if(!failed){failed=true;await r.abort();}else await r.continue();});
  await route(page,publicLink);await page.locator('#company-retry').waitFor({state:'visible'});await page.locator('#company-retry').click();await textMatches(page,'#public-company-content',/The Shareable Whales/);await page.unroute('**/api/company/*');
  await control(page,{responseDelayMs:700,delayPath:'/api/company/'+publicId});await route(page,'crew');await route(page,publicLink);await textMatches(page,'#company-message',/Loading/);await route(page,'challenge');await page.waitForTimeout(900);
  assert.equal(await page.locator('#company').isHidden(),true);assert.equal(await page.locator('#challenge').isVisible(),true);assert.equal(await page.locator('#company-actions').isHidden(),true);await control(page,{responseDelayMs:0,delayPath:''});
 });
 await record('desktop: edits retain public URL, withdrawn links fail clearly without draft changes',async()=>{
  await route(page,'seat');await page.locator('#publish').check();await page.locator('#reserve').click();await textMatches(page,'#seat-message',/Published 2 whales/);assert.equal(await page.locator('#published-link').getAttribute('href'),publicLink);
  await route(page,publicLink);await textMatches(page,'#public-company-content',/Unpublished Private Name/);await route(page,'seat');await page.locator('#remove').click();await textMatches(page,'#seat-message',/entry has been removed/);const before=await draftState(page);
  await route(page,publicLink);await textMatches(page,'#company-message',/no longer published/);assert.equal(await page.locator('#company-actions').isHidden(),true);assert.deepEqual(await draftState(page),before);
  await route(page,'company/not-an-id');await textMatches(page,'#company-message',/link is invalid/);
 });
 await record('desktop: pilot export, assistance, stop and erase are explicit and voluntary',async()=>{
  await route(page,'pilot');await page.locator('#pilot-assistance').check();const report=JSON.parse(await exportFile(page,'#pilot-export','P01-fixture-final.json'));assert.equal(report.assisted,true);assert.ok(report.events.some(e=>e.type==='challenge_completed'));assert.ok(report.events.some(e=>e.type==='published_edit'));
  await page.locator('#pilot-stop').click();await textMatches(page,'#pilot-status',/stopped/);await page.locator('#pilot-erase').click();await textMatches(page,'#pilot-status',/Recording is off/);assert.equal(await page.evaluate(()=>localStorage.getItem('whale-pools-holder-pilot-v1')),null);
 });
 await context.close();
 const mobile=await createPage({width:390,height:844});activePage=mobile.page;
 await record('mobile: public company view, comparison, card export and no horizontal overflow',async()=>{
  await route(mobile.page,'crew');const link=await mobile.page.locator('.crew-member').filter({hasText:'The Fixture Rival'}).locator('.public-company-link').getAttribute('href');await route(mobile.page,link);await textMatches(mobile.page,'#public-company-content',/The Fixture Rival/);
  await mobile.page.locator('#company-compare').click();await textMatches(mobile.page,'#company-compare-result',/Your private crew/);await exportFile(mobile.page,'#company-card','mobile-public-card.svg');
  assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await screenshot(mobile.page,'mobile-public-company.png');
 });
 await record('mobile: loaner challenge and result layout, then private holder creation',async()=>{
  await chooseThree(mobile.page);await mobile.page.locator('#challenge-run').click();await textMatches(mobile.page,'#challenge-result',/Lower episode return/);assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await screenshot(mobile.page,'mobile-tidal-trio.png');
  await signIn(mobile.page,3);await add(mobile.page,'rarewhales:245');await mobile.page.locator('#nickname').fill('Mobile Next Tide');await route(mobile.page,'challenge');await textMatches(mobile.page,'#challenge-progress',/3\/3 loaners/);await route(mobile.page,'seat');assert.equal(await mobile.page.locator('#nickname').inputValue(),'Mobile Next Tide');assert.equal(await mobile.page.locator('[data-crew-remove]').count(),1);
 });
 await record('mobile: optional pilot start and export layout',async()=>{
  await route(mobile.page,'pilot');await mobile.page.locator('#pilot-code').selectOption('P02');await mobile.page.locator('#pilot-start').click();await textMatches(mobile.page,'#pilot-status',/P02.*recording/);assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await screenshot(mobile.page,'mobile-pilot.png');
  const report=JSON.parse(await exportFile(mobile.page,'#pilot-export','P02-fixture.json'));assert.equal(report.code,'P02');assert.deepEqual(report.events.map(e=>e.type),['wallet_ready_new']);
 });
 if(process.env.RW_NORMAL_PREVIEW_URL){
  const normalContext=await browser.newContext({viewport:{width:1440,height:1000}}),normalPage=await normalContext.newPage();activePage=normalPage;normalPage.on('pageerror',e=>pageErrors.push(e.message));
  await normalPage.goto(process.env.RW_NORMAL_PREVIEW_URL+'#challenge');await textMatches(normalPage,'#challenge-progress',/0\/3 loaners/);await chooseThree(normalPage);await normalPage.locator('#challenge-run').click();await textMatches(normalPage,'#challenge-result',/RISK BRIEF CLEARED/);await screenshot(normalPage,'normal-desktop-challenge.png');
  const artwork=await normalPage.locator('#challenge-loaners img').evaluateAll(images=>images.map(img=>({collection:img.dataset.collection,tokenId:Number(img.dataset.token),state:img.dataset.artState,alt:img.alt,source:img.src})));
  await writeFile(path.join(output,'normal-preview.json'),JSON.stringify({url:process.env.RW_NORMAL_PREVIEW_URL,realEligibleWalletSigning:false,fixtureProvider:false,artwork,passed:true},null,2)+'\n');
  await normalPage.setViewportSize({width:390,height:844});assert.equal(await normalPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await screenshot(normalPage,'normal-mobile-challenge.png');await normalContext.close();activePage=mobile.page;
 }
 await mobile.context.close();assert.deepEqual(pageErrors,[]);
 await writeFile(path.join(output,'next-sprint-evidence.json'),JSON.stringify({fixtureOnly:true,realEligibleWalletSigning:false,completedAt:new Date().toISOString(),browser:await browser.version(),passed:results.length,checks:results,screenshots,pageErrors,limitations:['Fixture wallets and simulated NFT ownership; real eligible-holder acceptance remains open.','External portraits use explicit fallbacks; bundled loaner artwork is real.','Pilot reports here are test fixtures, not adoption or seven-day return evidence.']},null,2)+'\n');
 await Promise.all([rm(path.join(output,'journey-failure.json'),{force:true}),rm(path.join(output,'journey-failure.png'),{force:true})]);console.log(`Next sprint browser checks passed: ${results.length}. Evidence: ${output}`);
}catch(error){if(activePage&&!activePage.isClosed())await activePage.screenshot({path:path.join(output,'journey-failure.png'),fullPage:true});await writeFile(path.join(output,'journey-failure.json'),JSON.stringify({passed:results,error:error.stack,pageErrors},null,2));throw error;}finally{await browser.close();await fixture.close();}
