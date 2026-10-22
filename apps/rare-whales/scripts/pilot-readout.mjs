import {readFile} from 'node:fs/promises';
import {pilotReadout} from '../public/pilot.mjs';
const files=process.argv.slice(2);
if(!files.length){console.error('Usage: node scripts/pilot-readout.mjs <P01.json> … <P10.json>. Reports contain participant codes, event times and assistance flags; no wallets or signatures.');process.exitCode=1;}
else{const reports=await Promise.all(files.map(async file=>JSON.parse(await readFile(file,'utf8'))));console.log(JSON.stringify(pilotReadout(reports),null,2));}
