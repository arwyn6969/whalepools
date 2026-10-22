import {readFile,stat} from 'node:fs/promises';
import {playtestReadout} from '../src/playtest-session.mjs';
const [candidateCommit,base,...files]=process.argv.slice(2);
if(!candidateCommit||!base||files.length>10)throw Error('Usage: node scripts/playtest-readout.mjs COMMIT APP_BASE [PRIVATE_P01.json … PRIVATE_P10.json]');
const paper=JSON.parse(await readFile(new URL('../build/public/paper-rules.json',import.meta.url))),tide=JSON.parse(await readFile(new URL('../build/public/tide-rules.json',import.meta.url)));
const reports=[];
for(const file of files){if((await stat(file)).size>32768)throw Error('A playtest report exceeds 32 KiB.');reports.push(JSON.parse(await readFile(file,'utf8')));}
console.log(JSON.stringify(playtestReadout(reports,{candidateCommit,base,paperHash:paper.ruleHash,tideHash:tide.ruleHash}),null,2));
