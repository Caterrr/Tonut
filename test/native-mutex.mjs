import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'tonut-native-test-')),bin=process.argv[2],children=[];
async function acquire(){const child=spawn(bin,['install-lock',join(dir,'test.lock')],{stdio:['pipe','pipe','ignore']});children.push(child);const lines=createInterface({input:child.stdout});const data=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Guard timeout')),3000);lines.once('line',l=>{clearTimeout(t);resolve(JSON.parse(l));});child.once('error',reject);});lines.close();return {child,locked:data.locked};}
const exit=c=>new Promise(r=>{if(c.exitCode!==null)return r();c.once('exit',r);});
try{const a=await acquire();assert.equal(a.locked,true);const b=await acquire();assert.equal(b.locked,false);await exit(b.child);a.child.stdin.end();await exit(a.child);const c=await acquire();assert.equal(c.locked,true);c.child.stdin.end();await exit(c.child);console.log('PASS native kernel install lock: concurrency excluded; owner EOF releases without stale PID state.');}finally{for(const c of children)c.stdin.end();rmSync(dir,{recursive:true,force:true});}
