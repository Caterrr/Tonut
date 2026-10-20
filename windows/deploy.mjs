import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {existsSync,readFileSync,mkdirSync,mkdtempSync,copyFileSync,rmSync,statSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {windowsFiles} from '../scripts/runtime-files.mjs';
import {deployTransaction,recoverTransaction,preserveConfig,copyRuntimeState} from '../lib/transaction.mjs';
import {atomicJSON,Diagnostics} from '../lib/diagnostics.mjs';
const run=promisify(execFile),source=resolve(fileURLToPath(new URL('..',import.meta.url))),dest=join(process.env.LOCALAPPDATA||'','Tonut');
const shell=join(process.env.SystemRoot||'','System32/WindowsPowerShell/v1.0/powershell.exe');
const json=f=>JSON.parse(readFileSync(f,'utf8'));
async function ps(action,payload){const result=await run(shell,['-NoProfile','-NonInteractive','-File',join(source,'windows/manage.ps1'),'-Action',action,'-Internal'],{windowsHide:true,timeout:65000,maxBuffer:262144,input:undefined,env:{...process.env,...(payload?{TONUT_SERVICE_SNAPSHOT:JSON.stringify(payload)}:{})}});return result.stdout.trim()?JSON.parse(result.stdout):null;}
const service={snapshot:()=>ps('Snapshot'),stop:()=>ps('Stop'),restore:s=>ps('Restore',s),start:s=>ps('Start',s)};
async function validate(stage){for(const f of windowsFiles){if(!statSync(join(stage,f)).isFile())throw Error('Incomplete stage');if(/\.(mjs|cjs)$/.test(f))await run(process.execPath,['--check',join(stage,f)],{windowsHide:true});}
 await run(shell,['-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference='Stop';foreach($f in @('windows/manage.ps1','windows/watchdog.ps1','windows/host.ps1','startup/windows-bridge.ps1')){$t=$null;$e=$null;[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $env:TONUT_STAGE $f),[ref]$t,[ref]$e)|Out-Null;if($e.Count){throw 'Invalid staged PowerShell'}};Add-Type -Path (Join-Path $env:TONUT_STAGE 'startup/windows-native.cs') -ReferencedAssemblies System.Management,System.Core,System.Windows.Forms`],{windowsHide:true,timeout:30000,maxBuffer:65536,env:{...process.env,TONUT_STAGE:stage}});
}
async function health(){const id=json(join(dest,'config.json')).installId;let stable=0;const end=Date.now()+35000;while(Date.now()<end){let ok=true;for(const n of ['agent','startup','supervisor']){try{const r=json(join(dest,'diagnostics',n+'.ready.json'));process.kill(r.pid,0);ok&&=r.installId===id&&Date.now()-r.at<15000;}catch{ok=false;}}
 if(ok){if(++stable>=3)return true;}else stable=0;await new Promise(r=>setTimeout(r,500));}return false;}
async function main(){if(process.platform!=='win32')throw Error('Windows only');const action=process.argv[2];await recoverTransaction(dest,service);
 if(action==='uninstall'){await service.stop();await ps('Remove');rmSync(dest,{recursive:true,force:true});rmSync(dest+'.previous',{recursive:true,force:true});return;}
 if(action==='recover')return;
 if(action!=='install')throw Error('Invalid operation');
 const next=JSON.parse(process.env.TONUT_VALIDATED_CONFIG||'null');if(!next?.cli||!next?.AppExe||next.port!==39222)throw Error('Validated host required');
 mkdirSync(dirname(dest),{recursive:true});const stage=mkdtempSync(dest+'.stage-');
 try{
  for(const f of windowsFiles){mkdirSync(dirname(join(stage,f)),{recursive:true});copyFileSync(join(source,f),join(stage,f));}
  const previous=existsSync(join(dest,'config.json'))?json(join(dest,'config.json')):null;
  const config=preserveConfig(previous,{...next,installId:randomUUID()});atomicJSON(join(stage,'config.json'),config);copyRuntimeState(dest,stage);
  await deployTransaction({dest,stage,service,validate,health,report:code=>{if(existsSync(dest))new Diagnostics(dest,'update').set(code);}});
 }finally{rmSync(stage,{recursive:true,force:true});}
}
main().catch(()=>{console.error('Tonut update failed; previous installation restoration was attempted. Keep the transaction receipt and use Recover before retrying.');process.exitCode=1;});
