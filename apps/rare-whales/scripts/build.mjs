import {readFile,mkdir,copyFile,writeFile,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
import {buildArcadeScores} from '../src/arcade-score.mjs';
import {buildPractice} from '../src/practice.mjs';
import {validateSeason} from '../src/config.mjs';
import {compileContracts} from './compile-contracts.mjs';
import {keccak256} from 'viem';
const app=fileURLToPath(new URL('..',import.meta.url)),repo=path.resolve(app,'../..');
const load=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const season=validateSeason(await load(path.join(app,'season.json'))),protocol=await load(path.join(repo,'dist/protocol.json'));
const manifest=await load(path.join(repo,'research/data/manifest.json')),hashes={};
for(const name of ['engine.mjs','research.mjs','experiments.mjs']){
  hashes[name]=await hash(path.join(repo,'dist',name));
  if(hashes[name]!==protocol.implementationSha256[name])throw Error('Frozen engine checksum mismatch: '+name);
}
for(const name of ['UBTC-1h.json','UBTC-4h.json']){
  hashes[name]=await hash(path.join(repo,'research/data',name));
  if(hashes[name]!==manifest.files.find(x=>x.path.endsWith('/'+name)).sha256)throw Error('Frozen data checksum mismatch: '+name);
}
if(JSON.stringify(season.settings)!==JSON.stringify({...protocol.settings}))throw Error('Founding practice settings must match the declared frozen settings.');
await mkdir(path.join(app,'build/public'),{recursive:true});
const contracts=await compileContracts();
const deployment=await load(path.join(app,'public/deployment.json'));
await writeFile(path.join(app,'build/public/claims.json'),JSON.stringify({version:1,chainId:4663,creationCodeHash:keccak256(contracts.contracts.WhaleWaxClaims.bytecode),...deployment}));
for(const file of ['index.html','style.css','whale.avif'])await copyFile(path.join(app,'public',file),path.join(app,'build/public',file));
await cp(path.join(app,'public/art'),path.join(app,'build/public/art'),{recursive:true});
const practice=buildPractice({bars:await load(path.join(repo,'research/data/UBTC-1h.json')),context:await load(path.join(repo,'research/data/UBTC-4h.json')),protocol,sourceHashes:hashes});
await writeFile(path.join(app,'build/public/practice.json'),JSON.stringify(practice));
const scores=buildArcadeScores(practice);
const ruleFiles=['src/dna.mjs','src/pool.mjs','src/tactics.mjs','src/arcade-score.mjs','src/config.mjs','arcade.json'];
const ruleSources={};for(const name of ruleFiles)ruleSources[name]=await hash(path.join(app,name));
scores.ruleHash=createHash('sha256').update(JSON.stringify({scores,ruleSources})).digest('hex');
await writeFile(path.join(app,'build/arcade-scores.json'),JSON.stringify(scores));
await build({entryPoints:[path.join(app,'src/launch-worker.mjs')],outfile:path.join(app,'build/launch-worker.mjs'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
await build({entryPoints:[path.join(app,'public/app.mjs')],outfile:path.join(app,'build/public/app.js'),bundle:true,format:'esm',target:'es2022',minify:true});
await build({entryPoints:[path.join(app,'src/worker.mjs')],outfile:path.join(app,'build/worker.mjs'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
await build({entryPoints:[path.join(app,'src/demo-worker.mjs')],outfile:path.join(app,'build/demo-worker.mjs'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
console.log('Rare Whales built. Frozen source and data checksums verified. Season: '+season.status+'.');
