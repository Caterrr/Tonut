import {spawn} from 'node:child_process';
import {existsSync,openSync,writeFileSync,closeSync,readFileSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=dirname(dirname(fileURLToPath(import.meta.url))),lock=join(root,'supervisor.lock'),stopFile=join(root,'stop.request');
try {const fd=openSync(lock,'wx',0o600);writeFileSync(fd,String(process.pid));closeSync(fd);}
catch {
  const pid=Number(readFileSync(lock,'utf8'));if(!Number.isInteger(pid)||pid<=0)throw Error('Invalid existing lock; inspect before removal');
  try{process.kill(pid,0);process.exit(0);}catch(e){if(e.code!=='ESRCH')throw e;}
  unlinkSync(lock);const fd=openSync(lock,'wx',0o600);writeFileSync(fd,String(process.pid));closeSync(fd);
}
let stopped=false;const children=new Set(),timers=new Set();
function start(file){
 if(stopped)return;
 const child=spawn(process.execPath,[join(root,file)],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,TONUT_STOP_FILE:stopFile}});children.add(child);
 let ended=false;const restart=()=>{if(ended)return;ended=true;children.delete(child);if(!stopped){const t=setTimeout(()=>{timers.delete(t);start(file);},10000);timers.add(t);}else finish();};
 child.once('error',restart);child.once('exit',restart);
}
function finish(){if(stopped&&!children.size){try{unlinkSync(lock);}catch{}process.exit(0);}}
function stop(){if(stopped)return;stopped=true;for(const t of timers)clearTimeout(t);clearInterval(poll);writeFileSync(stopFile,'stop\n');finish();}
const poll=setInterval(()=>{if(existsSync(stopFile))stop();},200);
process.once('SIGINT',stop);process.once('SIGTERM',stop);
start('src/agent.mjs');start('startup/windows.cjs');
