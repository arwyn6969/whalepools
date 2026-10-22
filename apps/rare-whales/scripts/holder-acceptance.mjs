import {readFile,writeFile,stat} from 'node:fs/promises';
import {acceptanceTemplate,acceptanceReadout} from '../src/holder-acceptance.mjs';
const [mode,...args]=process.argv.slice(2);
if(!['template','readout'].includes(mode)||args.length<(mode==='template'?2:3)||args.length>(mode==='template'?3:4))throw Error('Usage: node scripts/holder-acceptance.mjs template COMMIT APP_BASE [OUTPUT] | readout PRIVATE_REPORT COMMIT APP_BASE [OUTPUT]');
const [file,candidateCommit,base,output]=mode==='template'?[null,...args]:args;
const paper=JSON.parse(await readFile(new URL('../build/public/paper-rules.json',import.meta.url))),tide=JSON.parse(await readFile(new URL('../build/public/tide-rules.json',import.meta.url)));
const context={candidateCommit,base,paperHash:paper.ruleHash,tideHash:tide.ruleHash};
let report;
if(mode==='template')report=acceptanceTemplate(context);
else{if((await stat(file)).size>32768)throw Error('Acceptance report exceeds the bounded 32 KiB size.');report=acceptanceReadout(JSON.parse(await readFile(file,'utf8')),context);}
const text=JSON.stringify(report,null,2)+'\n';if(output)await writeFile(output,text);console.log(text);
