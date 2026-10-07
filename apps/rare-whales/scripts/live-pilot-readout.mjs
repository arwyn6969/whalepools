import {readFile} from 'node:fs/promises';
import {livePilotReadout} from '../public/live-pilot.mjs';
const files=process.argv.slice(2);
if(!files.length){console.error('Usage: node scripts/live-pilot-readout.mjs <P01.json> … <P10.json>. Use voluntarily supplied holder-live-pilot-v1 reports; fixtures are not pilot outcomes.');process.exitCode=1;}
else console.log(JSON.stringify(livePilotReadout(await Promise.all(files.map(async file=>JSON.parse(await readFile(file,'utf8'))))),null,2));
