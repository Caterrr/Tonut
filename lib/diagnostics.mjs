import {mkdirSync,writeFileSync,renameSync,existsSync,statSync,appendFileSync,rmSync,openSync,closeSync,fsyncSync} from 'node:fs';
import {join,dirname} from 'node:path';
export const codes=new Set(['starting','waiting_host','identity_unavailable','identity_mismatch','target_missing','target_ambiguous','target_changed','cdp_unavailable','cdp_timeout','avatar_unmatched','host_hidden','quota_unavailable','ready','stopped','worker_restart','worker_fault','resolving_host','resolved_host','update_prepared','update_committed','update_rollback','internal_error']);
const failures=new Set(['identity_unavailable','identity_mismatch','target_ambiguous','target_changed','cdp_unavailable','cdp_timeout','avatar_unmatched','quota_unavailable','worker_fault','internal_error']);
export function atomicJSON(file,data,{durable=false}={}){const tmp=file+'.tmp';const fd=openSync(tmp,'w',0o600);try{writeFileSync(fd,JSON.stringify(data)+'\n');if(durable)fsyncSync(fd);}finally{closeSync(fd);}renameSync(tmp,file);if(durable)try{const d=openSync(dirname(file),'r');try{fsyncSync(d);}finally{closeSync(d);}}catch{}}

export class Diagnostics {
 constructor(root,component,{maxBytes=16384,now=Date.now}={}) {if(!['agent','startup','supervisor','update'].includes(component))throw Error('Invalid component');this.dir=join(root,'diagnostics');this.component=component;this.maxBytes=maxBytes;this.now=now;this.last=null;this.failure=null;}
 set(code){if(!codes.has(code))throw Error('Unknown diagnostic code');if(code===this.last)return;const at=this.now(),recovered=code==='ready'&&this.failure!==null;const entry={at,code,...(recovered?{recoveredFrom:this.failure}:{})};this.last=code;if(failures.has(code))this.failure=code;if(recovered)this.failure=null;
  try{mkdirSync(this.dir,{recursive:true,mode:0o700});const file=join(this.dir,this.component+'.jsonl');if(existsSync(file)&&statSync(file).size+256>this.maxBytes){rmSync(file+'.2',{force:true});if(existsSync(file+'.1'))renameSync(file+'.1',file+'.2');renameSync(file,file+'.1');}appendFileSync(file,JSON.stringify(entry)+'\n',{mode:0o600});atomicJSON(join(this.dir,this.component+'.status.json'),entry);}catch{/* Disk failures never expose raw exceptions. */}
 }
}
export function heartbeat(root,component,installId){if(typeof installId!=='string'||installId.length>80)return;const dir=join(root,'diagnostics');mkdirSync(dir,{recursive:true,mode:0o700});atomicJSON(join(dir,component+'.ready.json'),{pid:process.pid,installId,at:Date.now()});}
