import solc from 'solc';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const app=new URL('../',import.meta.url);
export async function compileContracts(){
 const sources={};
 for(const name of ['WhaleWaxClaims.sol','TestNFT.sol'])sources[name]={content:readFileSync(new URL('contracts/'+name,app),'utf8')};
 const input={language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','metadata']}}}};
 const output=JSON.parse(solc.compile(JSON.stringify(input),{import:name=>{
  if(!name.startsWith('@openzeppelin/contracts/')||name.includes('..'))return {error:'Unsupported import'};
  try{const content=readFileSync(new URL('node_modules/'+name,app),'utf8');sources[name]={content};return {contents:content};}catch{return {error:'Missing import: '+name};}
 }}));
 const errors=(output.errors||[]).filter(x=>x.severity==='error');if(errors.length)throw Error(errors.map(x=>x.formattedMessage).join('\n'));
 const artifacts={compiler:solc.version(),settings:input.settings,sourceSha256:createHash('sha256').update(JSON.stringify(sources)).digest('hex'),contracts:{}};
 for(const [file,contracts] of Object.entries(output.contracts))if(['WhaleWaxClaims.sol','TestNFT.sol'].includes(file))for(const [name,c]of Object.entries(contracts))artifacts.contracts[name]={abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,deployedBytecode:'0x'+c.evm.deployedBytecode.object};
 await mkdir(new URL('build/contracts/',app),{recursive:true});
 await writeFile(new URL('build/contracts/artifacts.json',app),JSON.stringify(artifacts,null,2)+'\n');
 // Complete standard JSON source input for explorer verification; test sources excluded.
 delete sources['TestNFT.sol'];
 const verified=JSON.parse(solc.compile(JSON.stringify({...input,sources})));
 if(verified.contracts?.['WhaleWaxClaims.sol']?.WhaleWaxClaims.evm.bytecode.object!==output.contracts['WhaleWaxClaims.sol'].WhaleWaxClaims.evm.bytecode.object)throw Error('Explorer verification input does not reproduce deployment bytecode.');
 await writeFile(new URL('build/contracts/standard-input.json',app),JSON.stringify({...input,sources},null,2)+'\n');
 return artifacts;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const a=await compileContracts();console.log('Compiled WWAX with '+a.compiler+'; source SHA256 '+a.sourceSha256);}
