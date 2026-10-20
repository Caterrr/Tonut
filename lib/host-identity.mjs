import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const run=promisify(execFile),root=resolve(fileURLToPath(new URL('..',import.meta.url)));
export class HostFault extends Error {constructor(code){super(code);this.code=code;}}
export function parseListeners(raw){let pid=null;const rows=[];for(const line of raw.trim().split('\n')){if(line[0]==='p')pid=Number(line.slice(1));if(line[0]==='n')rows.push({pid,address:line.slice(1)});}return rows;}
export function validateMacIdentity(snapshot,listeners){
 if(snapshot.apps?.length!==1)throw new HostFault(snapshot.apps?.length?'identity_mismatch':'waiting_host');
 const app=snapshot.apps[0];if(app.debugPort!=='39222'||!app.argumentsKnown)throw new HostFault('waiting_host');
 if(!listeners.length||listeners.some(x=>x.address!=='127.0.0.1:39222')||!listeners.some(x=>x.pid===app.pid))throw new HostFault('identity_mismatch');
 return {key:app.key}; // Inherited descriptors are allowed only while the verified main process owns the listener.
}
export function validateTarget(target,port=39222){
 if(target.type!=='page'||target.url!=='app://-/index.html'||typeof target.id!=='string'||!target.id)throw new HostFault('target_changed');
 let u;try{u=new URL(target.webSocketDebuggerUrl);}catch{throw new HostFault('target_changed');}
 if(u.protocol!=='ws:'||u.hostname!=='127.0.0.1'||Number(u.port)!==port||u.username||u.password||u.search||u.hash||u.pathname!=='/devtools/page/'+target.id)throw new HostFault('target_changed');
}
export class HostVerifier {
 constructor(config,{platform=process.platform,execute=run,now=Date.now}={}){Object.assign(this,{config,platform,execute,now});this.cached=null;this.checked=0;this.signedKey=null;}
 async check(force=false){if(!force&&this.cached&&this.now()-this.checked<10000)return this.cached;
  try{
   let result;
   if(this.platform==='darwin'){
    const snap=JSON.parse((await this.execute(join(root,'macos/startup/bridge'),['snapshot',this.config.app],{timeout:4000,maxBuffer:65536})).stdout);
    if(snap.apps?.length!==1)throw new HostFault(snap.apps?.length?'identity_mismatch':'waiting_host');
    if(this.signedKey!==snap.apps[0].key){
     await this.execute('/usr/bin/codesign',['--verify','--strict',this.config.app],{timeout:8000});
     const sig=(await this.execute('/usr/bin/codesign',['-dv','--verbose=2',this.config.app],{timeout:4000})).stderr;
     if(!/^Identifier=com\.openai\.codex$/m.test(sig)||!/^TeamIdentifier=2DC432GLL2$/m.test(sig))throw new HostFault('identity_mismatch');this.signedKey=snap.apps[0].key;
    }
    let list='';try{list=(await this.execute('/usr/sbin/lsof',['-nP','-a','-iTCP:39222','-sTCP:LISTEN','-Fpn'],{timeout:4000,maxBuffer:65536})).stdout;}catch{}
    result=validateMacIdentity(snap,parseListeners(list));
   }else if(this.platform==='win32'){
    const shell=join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
    const reply=JSON.parse((await this.execute(shell,['-NoProfile','-NonInteractive','-File',join(root,'windows/host.ps1'),'-HostAction','Identity','-HostRoot',root],{timeout:15000,maxBuffer:65536,windowsHide:true})).stdout);
    if(reply.code!=='ready')throw new HostFault(['waiting_host','identity_mismatch'].includes(reply.code)?reply.code:'identity_unavailable');result={key:reply.key};
   }else throw new HostFault('identity_unavailable');
   this.checked=this.now();this.cached=result;return result;
  }catch(e){this.cached=null;throw e instanceof HostFault?e:new HostFault('identity_unavailable');}
 }
}
