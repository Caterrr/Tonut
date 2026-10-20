import {fork,execFile} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {Diagnostics,heartbeat,atomicJSON} from '../lib/diagnostics.mjs';
const run=promisify(execFile);
export class Supervisor {
 constructor({spawnWorker,resolveHost,now=Date.now,report,heartbeat:beat=()=>{}}){Object.assign(this,{spawnWorker,resolveHost,now,report,beat});this.children=new Map();this.stopped=false;this.nextResolve=0;this.configKey=null;this.restartAt=new Map();}
 start(name){if(this.stopped)return;const child=this.spawnWorker(name);this.children.set(name,child);let ended=false;const exit=()=>{if(ended)return;ended=true;this.children.delete(name);if(!this.stopped&&!this.recycling){this.restartAt.set(name,this.now()+10000);this.report.set('worker_fault');}};child.once('error',exit);child.once('exit',exit);}
 async tick(){this.beat();if(this.stopped)return;
  if(this.now()>=this.nextResolve){this.nextResolve=this.now()+30000;try{const key=await this.resolveHost();if(this.configKey&&key!==this.configKey){this.report.set('resolving_host');await this.recycle();this.report.set('resolved_host');}this.configKey=key;}catch{this.report.set('identity_unavailable');return;}}
  if(!this.configKey)return;
  for(const n of ['agent','startup'])if(!this.children.has(n)&&this.now()>=(this.restartAt.get(n)||0)){this.start(n);this.report.set('worker_restart');}
  if(this.children.size===2)this.report.set('ready');
 }
 async recycle(){this.recycling=true;const list=[...this.children.values()];for(const c of list)try{c.send({type:'stop'});}catch{}await Promise.all(list.map(c=>new Promise((resolve,reject)=>{if(c.exitCode!==null&&c.exitCode!==undefined)return resolve();const timer=setTimeout(()=>reject(Error('Worker stop pending')),40000);c.once('exit',()=>{clearTimeout(timer);resolve();});})));this.recycling=false;this.restartAt.clear();}
 async stop(){this.stopped=true;await this.recycle();this.report.set('stopped');}
}
async function main(){
 const root=dirname(dirname(fileURLToPath(import.meta.url))),stopFile=join(root,'stop.request'),report=new Diagnostics(root,'supervisor');let config=JSON.parse(readFileSync(join(root,'config.json'),'utf8'));
 const supervisor=new Supervisor({report,heartbeat:()=>heartbeat(root,'supervisor',config.installId),
  spawnWorker:name=>fork(join(root,name==='agent'?'src/agent.mjs':'startup/windows.cjs'),[],{cwd:root,windowsHide:true,stdio:['ignore','ignore','ignore','ipc'],env:{...process.env,TONUT_STOP_FILE:stopFile}}),
  resolveHost:async()=>{const shell=join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');const r=await run(shell,['-NoProfile','-NonInteractive','-File',join(root,'windows/host.ps1'),'-HostAction','Resolve','-HostRoot',root],{windowsHide:true,timeout:20000,maxBuffer:65536});const next=JSON.parse(r.stdout);if(!next.cli||!next.AppExe||next.port!==39222)throw Error('Host resolution unavailable');config=next;atomicJSON(join(root,'config.json'),config);return next.AppExe+'\n'+next.cli;}
 });
 let stopping=false;const stop=()=>{stopping=true;};process.once('SIGINT',stop);process.once('SIGTERM',stop);process.once('disconnect',stop);process.stdin.resume();process.stdin.once('end',stop);
 report.set('starting');try{while(!stopping&&!existsSync(stopFile)){await supervisor.tick();await new Promise(r=>setTimeout(r,1000));}}finally{await supervisor.stop();}
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(()=>{process.exitCode=1;});
