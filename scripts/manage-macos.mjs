import {execFileSync as run,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync,chmodSync,rmSync,mkdtempSync,statSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline';
import {macFiles} from './runtime-files.mjs';
import {deployTransaction,recoverTransaction,preserveConfig,copyRuntimeState} from '../lib/transaction.mjs';
import {atomicJSON,Diagnostics} from '../lib/diagnostics.mjs';
const source=resolve(dirname(fileURLToPath(import.meta.url)),'..'),home=homedir(),dest=join(home,'Library/Application Support/Tonut'),agents=join(home,'Library/LaunchAgents');
const labels=['com.tonut.agent','com.tonut.startup'],domain=`gui/${process.getuid?.()}`;
const call=(cmd,args)=>run(cmd,args,{stdio:'pipe',timeout:30000,maxBuffer:1048576});
const json=file=>JSON.parse(readFileSync(file,'utf8'));
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function job(label){try{return call('/bin/launchctl',['print',`${domain}/${label}`]).toString();}catch{return null;}}
function plist(label,args){return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args.map(a=>`<string>${xml(a)}</string>`).join('')}</array><key>WorkingDirectory</key><string>${xml(dest)}</string><key>RunAtLoad</key><true/><key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict><key>ThrottleInterval</key><integer>10</integer><key>ProcessType</key><string>Background</string><key>StandardOutPath</key><string>/dev/null</string><key>StandardErrorPath</key><string>/dev/null</string></dict></plist>\n`;}
const service={
 async snapshot(){return labels.map(l=>{const f=join(agents,l+'.plist');if(existsSync(f)){const a=JSON.parse(call('/usr/bin/plutil',['-extract','ProgramArguments','json','-o','-',f]));if(a[1]!==join(dest,l===labels[0]?'src/agent.mjs':'macos/startup/watch.cjs'))throw Error('Conflicting login task');}return {label:l,active:!!job(l),plist:existsSync(f)?readFileSync(f).toString('base64'):null};});},
 async stop(){for(const l of labels)try{call('/bin/launchctl',['bootout',`${domain}/${l}`]);}catch{}const end=Date.now()+15000;while(labels.some(l=>job(l))){if(Date.now()>end)throw Error('Background stop pending; no forced quit');await pause(200);}},
 async restore(snapshot){for(const l of labels){const entry=snapshot.find(x=>x.label===l);const f=join(agents,l+'.plist');if(entry?.plist)writeFileSync(f,Buffer.from(entry.plist,'base64'),{mode:0o600});else rmSync(f,{force:true});}},
 async start(snapshot){
  mkdirSync(agents,{recursive:true});
  for(let i=0;i<labels.length;i++){
   if(snapshot&&!snapshot.find(x=>x.label===labels[i])?.active)continue;
   const f=join(agents,labels[i]+'.plist');
   if(!snapshot)writeFileSync(f,plist(labels[i],[process.execPath,join(dest,i?'macos/startup/watch.cjs':'src/agent.mjs')]),{mode:0o600});
   call('/usr/bin/plutil',['-lint',f]);if(!job(labels[i]))call('/bin/launchctl',['bootstrap',domain,f]);
  }
 }
};
async function healthy(){const id=json(join(dest,'config.json')).installId;let stable=0;const deadline=Date.now()+30000;while(Date.now()<deadline){
 let ok=true;for(let i=0;i<labels.length;i++){const state=job(labels[i]),pid=Number(state?.match(/^\tpid = (\d+)/m)?.[1]);try{const ready=json(join(dest,'diagnostics',i?'startup.ready.json':'agent.ready.json'));ok&&=!!pid&&/^\tstate = running$/m.test(state)&&ready.pid===pid&&ready.installId===id&&Date.now()-ready.at<12000;}catch{ok=false;}}
 if(ok){if(++stable>=3)return true;}else stable=0;await pause(500);
 }return false;}
function validate(stage){for(const f of macFiles){if(!statSync(join(stage,f)).isFile())throw Error('Incomplete stage');if(/\.(mjs|cjs)$/.test(f))call(process.execPath,['--check',join(stage,f)]);}const c=json(join(stage,'config.json'));if(c.port!==39222||![300,10080].includes(c.duration)||!c.installId)throw Error('Invalid staged configuration');call('/usr/bin/codesign',['--verify','--strict',join(stage,'macos/startup/bridge')]);}
async function acquire(helper){const lock=spawn(helper,['install-lock',dest+'.install.lock'],{stdio:['pipe','pipe','ignore']});const lines=createInterface({input:lock.stdout});return new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>finish(false),4000);function finish(ok){if(done)return;done=true;clearTimeout(timer);lines.close();if(!ok){lock.stdin.end();reject(Error('Another installation is active or installer lock unavailable'));}else resolve(()=>lock.stdin.end());}lines.once('line',line=>{try{finish(JSON.parse(line).locked===true);}catch{finish(false);}});lock.once('error',()=>finish(false));lock.once('exit',()=>finish(false));});}
async function main(){
 if(process.platform!=='darwin')throw Error('macOS only');const action=process.argv[2]||'status';
 if(action==='status'){for(const l of labels){const s=job(l);console.log(l,s?s.split('\n').filter(t=>/^\t(state|pid|last exit code) =/.test(t)).map(t=>t.trim()).join('; '):'not loaded');}for(const c of ['agent','startup'])try{const s=json(join(dest,'diagnostics',c+'.status.json'));console.log(c,s.code,new Date(s.at).toISOString());}catch{}return;}
 if(!['install','uninstall','recover'].includes(action))throw Error('Use install, status, recover or uninstall');
 mkdirSync(dirname(dest),{recursive:true});
 if(action!=='install'){
  if(!existsSync(dest)&&!existsSync(dest+'.transaction.json')){console.log('Tonut is not installed');return;}
  let guard=join(dest,'macos/startup/bridge'),temporary=null;
  if(!existsSync(guard)||!existsSync(join(dest,'package.json'))||json(join(dest,'package.json')).version==='0.3.0'){
   temporary=mkdtempSync(dest+'.guard-');guard=join(temporary,'bridge');
   call('/usr/bin/xcrun',['clang','-fobjc-arc','-O2','-Wall','-Wextra','-Werror','-arch','arm64','-arch','x86_64','-mmacosx-version-min=12.0','-framework','AppKit','-framework','ApplicationServices',join(source,'macos/startup/bridge.m'),'-o',guard]);call('/usr/bin/codesign',['--force','--sign','-','--timestamp=none',guard]);
  }
  const release=await acquire(guard);
  try{await recoverTransaction(dest,service);if(action==='recover'){console.log('Recovery complete');return;}
   await service.stop();for(const l of labels)rmSync(join(agents,l+'.plist'),{force:true});rmSync(dest,{recursive:true,force:true});rmSync(dest+'.previous',{recursive:true,force:true});console.log('Removed only Tonut. Normally reopen the host when convenient to close its debug port.');
  }finally{release();if(temporary)rmSync(temporary,{recursive:true,force:true});}return;
 }
 if(Number(process.versions.node.split('.')[0])<24)throw Error('Node.js24+ required');
 const previous=existsSync(join(dest,'config.json'))?json(join(dest,'config.json')):null;
 const app=resolve(process.argv[3]||previous?.app||['/Applications/Codex.app','/Applications/ChatGPT.app'].find(existsSync)||'');
 const info=join(app,'Contents/Info.plist');if(!existsSync(info)||call('/usr/libexec/PlistBuddy',['-c','Print :CFBundleIdentifier',info]).toString().trim()!=='com.openai.codex')throw Error('Select official Codex desktop');
 call('/usr/bin/codesign',['--verify','--strict',app]);
 const detail=await new Promise((resolve,reject)=>{const c=spawn('/usr/bin/codesign',['-dv','--verbose=2',app],{stdio:['ignore','ignore','pipe']});let text='';c.stderr.on('data',b=>text+=b);c.on('error',reject);c.on('exit',code=>code?reject(Error('Signature inspection failed')):resolve(text));});
 if(!/^Identifier=com\.openai\.codex$/m.test(detail)||!/^TeamIdentifier=2DC432GLL2$/m.test(detail))throw Error('Official OpenAI signature required');
 const cli=['Contents/Resources/codex-cli/bin/codex','Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex','Contents/Resources/codex'].map(f=>join(app,f)).find(existsSync);if(!cli)throw Error('Bundled official CLI missing');
 const stage=mkdtempSync(dest+'.stage-');chmodSync(stage,0o700);let release;
 try{
  for(const f of macFiles){mkdirSync(dirname(join(stage,f)),{recursive:true});copyFileSync(join(source,f),join(stage,f));}
  const helper=join(stage,'macos/startup/bridge');call('/usr/bin/xcrun',['clang','-fobjc-arc','-O2','-Wall','-Wextra','-Werror','-arch','arm64','-arch','x86_64','-mmacosx-version-min=12.0','-framework','AppKit','-framework','ApplicationServices',join(stage,'macos/startup/bridge.m'),'-o',helper]);call('/usr/bin/codesign',['--force','--sign','-','--timestamp=none',helper]);chmodSync(helper,0o700);
  release=await acquire(helper);await recoverTransaction(dest,service);
  const current=existsSync(join(dest,'config.json'))?json(join(dest,'config.json')):null;
  const config=preserveConfig(current,{port:39222,app,cli,duration:10080,installId:randomUUID()});atomicJSON(join(stage,'config.json'),config);mkdirSync(join(stage,'macos/startup'),{recursive:true});atomicJSON(join(stage,'macos/startup/settings.json'),{app,installId:config.installId});copyRuntimeState(dest,stage);
  await deployTransaction({dest,stage,service,validate,health:healthy,report:code=>{if(existsSync(dest))new Diagnostics(dest,'update').set(code);}});console.log('Tonut installed and healthy; configuration preserved. Last good version retained at Tonut.previous.');
 }finally{release?.();rmSync(stage,{recursive:true,force:true});}
}
export {service,healthy,validate,dest,acquire};
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Tonut operation failed. Existing version is retained or rollback was attempted. Inspect the transaction receipt; run recover before retrying.');process.exitCode=1;});
