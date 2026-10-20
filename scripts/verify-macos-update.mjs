// Explicit opt-in live QA of Tonut's own jobs. Never quits or modifies the desktop host.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,copyFileSync,rmSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {deployTransaction} from '../lib/transaction.mjs';
import {atomicJSON} from '../lib/diagnostics.mjs';
import {macFiles} from './runtime-files.mjs';
import {service,healthy,validate,dest,acquire} from './manage-macos.mjs';
if(process.platform!=='darwin'||!process.argv.includes('--live'))throw Error('Run only on macOS with --live after an installed-version backup.');
const beforeConfig=readFileSync(join(dest,'config.json'));const files=[...macFiles,'macos/startup/bridge'];const before=new Map(files.map(f=>[f,createHash('sha256').update(readFileSync(join(dest,f))).digest('hex')]));
const stage=mkdtempSync(dest+'.stage-qa-'),release=await acquire(join(dest,'macos/startup/bridge'));
try{
 for(const f of files){mkdirSync(dirname(join(stage,f)),{recursive:true});copyFileSync(join(dest,f),join(stage,f));}
 const config={...JSON.parse(beforeConfig),installId:randomUUID()};atomicJSON(join(stage,'config.json'),config);atomicJSON(join(stage,'macos/startup/settings.json'),{app:config.app,installId:config.installId});
 writeFileSync(join(stage,'src/agent.mjs'),'// Fault fixture: fails before reading any account or page.\nprocess.exit(17);\n');
 await assert.rejects(deployTransaction({dest,stage,service,validate,health:async()=>{await new Promise(r=>setTimeout(r,1800));return false;}}),/previous installation/);
 assert.deepEqual(readFileSync(join(dest,'config.json')),beforeConfig);
 for(const [f,digest]of before)assert.equal(createHash('sha256').update(readFileSync(join(dest,f))).digest('hex'),digest,f);
 assert.equal(existsSync(dest+'.transaction.json'),false);assert.equal(await healthy(),true);
 console.log('PASS live Mac update failure: old runtime bytes/config/services restored and healthy; host never restarted.');
}finally{release();rmSync(stage,{recursive:true,force:true});}
