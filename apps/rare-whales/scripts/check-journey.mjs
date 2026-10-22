import assert from 'node:assert/strict';
import {mkdir, readdir, access, writeFile, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {startFixtureServer} from './serve-fixture.mjs';

const require = createRequire(import.meta.url);
const app = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.RW_EVIDENCE_DIR || path.join(app, 'work/journey-check'));
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

try {
  const {context, page} = await createPage({width: 1440, height: 1000});
  await record('desktop: holder sign-in, choose whales, tactics and historical result', async () => {
    await signIn(page, 3);
    await add(page, 'rarewhales:245'); await add(page, 'rarewhales:246');
    await page.locator('#nickname').fill('The Returning Whales');
    await page.locator('#captain').selectOption('rarewhales:246');
    await route(page, 'roster');
    await page.locator('[data-tactic="rarewhales:245"]').selectOption('magnet');
    await page.locator('[data-inspect="rarewhales:246"]').click();
    await textMatches(page, '#draft-status', /saved in this browser/i);
    await route(page, 'seat');
    await textMatches(page, '#seat-result', /historical return.*worst drawdown.*completed trades/i);
    assert.equal(await page.locator('#reserve').isEnabled(), true, 'Publication must become enabled after historical replay completes.');
    await screenshot(page, 'desktop-company-draft.png');
  });
  const holderDraft = await draftState(page);
  await record('desktop: unpublished name, captain, tactics and selected whale survive reload', async () => {
    await page.reload(); await owned(page, 3);
    assert.equal(await page.locator('#nickname').inputValue(), 'The Returning Whales');
    assert.equal(await page.locator('#captain').inputValue(), 'rarewhales:246');
    assert.equal(await page.locator('#publish').isChecked(), false, 'Publication consent must not be restored from the private draft.');
    await route(page, 'roster');
    assert.equal(await page.locator('[data-tactic="rarewhales:245"]').inputValue(), 'magnet');
    assert.equal(await page.locator('[data-inspect="rarewhales:246"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await draftState(page), holderDraft);
  });
  await record('desktop: rival inspection is read-only and preserves the private draft', async () => {
    await route(page, 'crew');
    const rival = page.locator('.crew-member').filter({hasText: 'The Fixture Rival'});
    await rival.locator('[data-replay-pool]').click();
    await page.locator('#spectator-banner').waitFor({state: 'visible'});
    await textMatches(page, '#spectator-title', /The Fixture Rival.*read-only/);
    assert.equal(await page.locator('[data-tactic]').first().isDisabled(), true);
    assert.equal(await page.locator('[data-remove]').first().isDisabled(), true);
    assert.equal(await page.locator('[data-assign]').first().isDisabled(), true);
    assert.deepEqual(await draftState(page), holderDraft);
    await page.locator('#spectator-banner').evaluate(element => element.scrollIntoView({block: 'start'}));
    await screenshot(page, 'desktop-rival-replay.png', false);
    await clickVisible(page, '#return-to-draft');
    await page.locator('#spectator-banner').waitFor({state: 'hidden'});
    assert.equal(await page.locator('[data-tactic="rarewhales:245"]').inputValue(), 'magnet');
    assert.deepEqual(await draftState(page), holderDraft);
  });
  await record('desktop: wallet switches keep two unpublished companies isolated', async () => {
    await switchWallet(page, 'second', 2);
    assert.equal(await page.locator('#nickname').inputValue(), '');
    assert.equal(await page.locator('[data-crew-remove]').count(), 0);
    await add(page, 'rarewhales:777');
    await page.locator('#nickname').fill('The Other Wallet');
    await switchWallet(page, 'holder', 3);
    assert.equal(await page.locator('#nickname').inputValue(), 'The Returning Whales');
    assert.equal(await page.locator('[data-crew-remove]').count(), 2);
    assert.equal(await page.locator('[data-crew-remove="rarewhales:777"]').count(), 0);
  });
  await record('desktop: inventory failure preserves the draft and refresh recovers', async () => {
    const before = await draftState(page);
    await control(page, {rpcMode: 'error'}); await page.locator('#refresh-whales').click();
    await textMatches(page, '#owned-status', /draft is kept/i);
    assert.deepEqual(await draftState(page), before);
    assert.equal(await page.locator('#reserve').isDisabled(), true);
    await control(page, {rpcMode: 'normal'}); await page.locator('#refresh-whales').click(); await owned(page, 3);
  });
  await record('desktop: inventory waiting is bounded and retry works', async () => {
    const before = await draftState(page), started = Date.now();
    await control(page, {rpcMode: 'delay', rpcDelayMs: 22000}); await page.locator('#refresh-whales').click();
    await textMatches(page, '#owned-status', /took too long.*draft is kept/i, 35000);
    assert.ok(Date.now() - started < 33000, 'Inventory must stop waiting within the configured 30 second overall bound.');
    assert.deepEqual(await draftState(page), before);
    assert.equal(await page.locator('#refresh-whales').isEnabled(), true);
    await control(page, {rpcMode: 'normal', rpcDelayMs: 0}); await page.locator('#refresh-whales').click(); await owned(page, 3);
  });
  await record('desktop: stale inventory cannot cross a wallet switch', async () => {
    await control(page, {rpcDelayMs: 1400}); await page.locator('#refresh-whales').click();
    await page.waitForFunction(() => document.querySelector('#refresh-whales').disabled);
    await page.evaluate(() => window.__whaleFixture.wallet('second'));
    await control(page, {rpcDelayMs: 0});
    await page.locator('#seat-connect').waitFor({state: 'visible'}); await signIn(page, 2);
    await page.waitForTimeout(1600);
    assert.equal(await page.locator('#nickname').inputValue(), 'The Other Wallet');
    assert.equal(await page.locator('[data-crew-remove="rarewhales:245"]').count(), 0);
    assert.equal(await page.locator('[data-crew-remove="rarewhales:777"]').count(), 1);
    await switchWallet(page, 'holder', 3);
  });
  await record('desktop: access, publish, edit, refused update and lost-response reconciliation', async () => {
    await page.locator('#check').click(); await textMatches(page, '#seat-message', /Every whale belongs/i);
    await page.locator('#publish').check(); await page.locator('#reserve').click(); await textMatches(page, '#seat-message', /Published 2 whales/i);
    const first = await page.evaluate(() => fetch('/api/club').then(response => response.json()));
    assert.equal(first.me.seat.nickname, 'The Returning Whales');
    await page.locator('#nickname').fill('The Returning Whales II');
    await page.locator('#reserve').click(); await textMatches(page, '#seat-message', /Published 2 whales/i);
    const edited = await page.evaluate(() => fetch('/api/club').then(response => response.json()));
    assert.equal(edited.me.seat.id, first.me.seat.id); assert.equal(edited.me.seat.nickname, 'The Returning Whales II');
    await control(page, {writeMode: 'reject'}); await page.locator('#nickname').fill('Private Unpublished Edit');
    await page.locator('#reserve').click(); await textMatches(page, '#seat-message', /published company has not changed.*draft is kept/i);
    const unchanged = await page.evaluate(() => fetch('/api/club').then(response => response.json()));
    assert.equal(unchanged.me.seat.nickname, 'The Returning Whales II');
    assert.equal(await page.locator('#nickname').inputValue(), 'Private Unpublished Edit');
    await control(page, {writeMode: 'unknown', reverseEntries: true}); await page.locator('#nickname').fill('Confirmed After Lost Response');
    await page.locator('#reserve').click(); await textMatches(page, '#seat-message', /Publication confirmed/i);
    const confirmed = await page.evaluate(() => fetch('/api/club').then(response => response.json()));
    assert.equal(confirmed.me.seat.nickname, 'Confirmed After Lost Response');
    await control(page, {writeMode: 'normal', reverseEntries: false});
  });
  await record('desktop: a change in another tab refreshes the revision and allows a safe retry', async () => {
    const updated = await page.evaluate(async () => {
      const club = await fetch('/api/club').then(response => response.json());
      const saved = club.me.seat;
      const response = await fetch('/api/seat', {method: 'POST', headers: {'content-type': 'application/json', 'x-whale-revision': String(club.me.revision), 'x-whale-mutation': crypto.randomUUID()}, body: JSON.stringify({nickname: 'The Other Tab Company', collection: saved.collection, tokenId: saved.tokenId, agents: saved.agents.map(({collection, tokenId, strategy}) => ({collection, tokenId, strategy})), publish: true, ruleHash: club.arcade.ruleHash})});
      return {status: response.status, data: await response.json()};
    });
    assert.equal(updated.status, 200);
    await page.locator('#nickname').fill('Cross-tab Retry Company');
    await page.locator('#reserve').click();
    await textMatches(page, '#seat-message', /newer company change is saved.*private draft is kept/i);
    assert.equal(await page.locator('#nickname').inputValue(), 'Cross-tab Retry Company');
    await page.locator('#reserve').click(); await textMatches(page, '#seat-message', /Published 2 whales/i);
    const retried = await page.evaluate(() => fetch('/api/club').then(response => response.json()));
    assert.equal(retried.me.seat.nickname, 'Cross-tab Retry Company');
    assert.equal(retried.me.revision, updated.data.revision + 1);
  });
  await record('desktop: a late timed-out publication cannot overwrite a newer saved company', async () => {
    const writesBefore = fixture.state.requests.filter(request => request.path === '/api/seat' && request.method === 'POST').length;
    await control(page, {responseDelayMs: 22000, delayPath: '/api/seat'});
    await page.locator('#nickname').fill('The Late Returning Whales');
    await page.locator('#reserve').click();
    await textMatches(page, '#seat-message', /saved entry has been checked.*change is not confirmed/i, 25000);
    await page.waitForFunction(() => !document.querySelector('#seat-fields').disabled && !document.querySelector('#reserve').disabled);
    assert.equal(fixture.state.requests.filter(request => request.path === '/api/seat' && request.method === 'POST').length - writesBefore, 1, 'The browser must not repeat a write after its timeout.');
    await control(page, {responseDelayMs: 0, delayPath: ''});
    await page.locator('#nickname').fill('The Newer Saved Company');
    await page.locator('#reserve').click(); await textMatches(page, '#seat-message', /Published 2 whales/i);
    await page.waitForTimeout(2500);
    const late = await page.evaluate(() => fetch('/api/club').then(response => response.json()));
    assert.equal(late.me.seat.nickname, 'The Newer Saved Company', 'The older request must lose the server revision compare-and-swap.');
  });
  await record('desktop: transfer refresh removes only no-longer-owned whale', async () => {
    await control(page, {holdings: {holder: [{collection: 'rarewhales', tokenId: 245}, {collection: 'whalestreet', tokenId: 1}]}});
    await page.locator('#refresh-whales').click(); await owned(page, 2);
    assert.equal(await page.locator('[data-crew-remove="rarewhales:246"]').count(), 0);
    assert.equal(await page.locator('[data-crew-remove="rarewhales:245"]').count(), 1);
    await textMatches(page, '#seat-message', /no longer in this wallet.*public entry stays unchanged/i);
    const unchanged = await page.evaluate(() => fetch('/api/club').then(response => response.json()));
    assert.equal(unchanged.me.seat.agents.length, 2);
  });
  await record('desktop: withdraw keeps the private draft; empty wallet has clear eligibility', async () => {
    const before = await draftState(page); await page.locator('#remove').click();
    await textMatches(page, '#seat-message', /public entry has been removed.*private draft is kept/i);
    assert.deepEqual(companyChoices(await draftState(page)), companyChoices(before));
    const withdrawn = await page.evaluate(() => fetch('/api/club').then(response => response.json()));
    assert.equal(withdrawn.me.seat, null);
    await switchWallet(page, 'empty', 0);
    assert.equal(await page.locator('#reserve').isDisabled(), true);
    await textMatches(page, '#owned-status', /wallet holding your NFTs/i);
  });
  await record('desktop: rejected signature and wrong chain recover without mutation', async () => {
    await page.locator('#logout').click();
    await page.locator('#seat-connect').waitFor({state: 'visible'});
    // Sign-out deliberately saves an empty wallet draft too. Rejected auth
    // must preserve the state after that successful sign-out.
    const before = await draftState(page);
    await page.evaluate(() => window.__whaleFixture.rejectSignature(true));
    await page.locator('#seat-connect').click(); await page.locator('.wallet-option').click();
    await textMatches(page, '#global-message', /Wallet request cancelled.*draft is kept/i);
    await page.evaluate(() => {window.__whaleFixture.rejectSignature(false); window.__whaleFixture.chain(1);});
    await page.locator('#seat-connect').click(); await page.locator('.wallet-option').click();
    await textMatches(page, '#global-message', /Select Robinhood Chain/i);
    assert.deepEqual(await draftState(page), before);
    await page.evaluate(() => window.__whaleFixture.chain(4663)); await signIn(page, 0);
    assert.equal(await page.locator('#reserve').isDisabled(), true);
  });
  await context.close();
  fixture.state.holdings.holder = [{collection: 'rarewhales', tokenId: 245}, {collection: 'rarewhales', tokenId: 246}, {collection: 'whalestreet', tokenId: 1}];
  const mobile = await createPage({width: 390, height: 844});
  await record('mobile: holder draft, tactics, reload, rival inspection and layouts', async () => {
    await signIn(mobile.page, 3); await add(mobile.page, 'rarewhales:245');
    await mobile.page.locator('#nickname').fill('The Mobile Whales');
    await route(mobile.page, 'roster');
    await mobile.page.locator('[data-tactic="rarewhales:245"]').selectOption('recovery');
    await route(mobile.page, 'seat');
    assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Mobile company page must not overflow horizontally.');
    await screenshot(mobile.page, 'mobile-company-draft.png');
    await mobile.page.reload(); await owned(mobile.page, 3);
    assert.equal(await mobile.page.locator('#nickname').inputValue(), 'The Mobile Whales');
    const before = await draftState(mobile.page);
    await route(mobile.page, 'crew'); await mobile.page.locator('.crew-member').filter({hasText: 'The Fixture Rival'}).locator('[data-replay-pool]').click();
    await mobile.page.locator('#spectator-banner').waitFor({state: 'visible'});
    assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Mobile spectator replay must not overflow horizontally.');
    await mobile.page.locator('#spectator-banner').evaluate(element => element.scrollIntoView({block: 'start'}));
    await screenshot(mobile.page, 'mobile-rival-replay.png', false);
    await clickVisible(mobile.page, '#return-to-draft'); assert.deepEqual(await draftState(mobile.page), before);
    await route(mobile.page, 'roster'); await screenshot(mobile.page, 'mobile-holder-replay.png', false);
  });
  await mobile.context.close();
  assert.deepEqual(pageErrors, [], 'Browser must not emit uncaught JavaScript errors.');
  const evidence = {fixtureOnly: true, realEligibleWalletSigning: false, origin: fixture.origin, browser: await browser.version(), completedAt: new Date().toISOString(), viewports: [{width: 1440, height: 1000}, {width: 390, height: 844}], passed: results.length, checks: results, screenshots, pageErrors, limitations: ['Disposable fixture keys sign SIWE messages; NFT inventory and submission ownership are simulated.', 'Real eligible holder extension signing, on-chain RPC inventory and production publish/edit/withdraw acceptance remain separate manual checks.', 'External portrait requests use explicit artwork fallbacks in this deterministic regression.']};
  await writeFile(path.join(output, 'journey-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  await Promise.all([rm(path.join(output, 'journey-failure.json'), {force: true}), rm(path.join(output, 'journey-failure.png'), {force: true})]);
  console.log(`Journey regression passed: ${results.length} checks. Evidence: ${output}`);
} catch (error) {
  if (activePage && !activePage.isClosed()) await activePage.screenshot({path: path.join(output, 'journey-failure.png'), fullPage: true});
  await writeFile(path.join(output, 'journey-failure.json'), JSON.stringify({passed: results, error: error.stack, pageErrors}, null, 2) + '\n');
  throw error;
} finally {await browser.close(); await fixture.close();}
