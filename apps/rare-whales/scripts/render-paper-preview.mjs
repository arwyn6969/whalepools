import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
const require = createRequire(import.meta.url);
const app = fileURLToPath(new URL('..', import.meta.url));
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
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});const html=(await readFile(path.join(app,'design/paper-preview.html'),'utf8')).replace('WHALE_ART','data:image/avif;base64,'+(await readFile(path.join(app,'public/art/whale-247.avif'))).toString('base64'));await page.setContent(html);await page.locator('img').evaluate(el=>el.decode());await page.screenshot({path:path.join(app,'public/art/paper-preview.png')});console.log('Rendered 1200 × 630 local social cover.');}finally{await browser.close();}
