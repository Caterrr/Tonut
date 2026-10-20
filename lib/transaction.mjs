import {existsSync,mkdirSync,readFileSync,renameSync,rmSync,cpSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {atomicJSON} from './diagnostics.mjs';
export function preserveConfig(previous,next){
 if(previous?.duration!==undefined&&![300,10080].includes(previous.duration))throw Error('Invalid existing quota window');
 return {...next,duration:previous?.duration??next.duration??10080,...(typeof previous?.selector==='string'&&previous.selector.length<=2048?{selector:previous.selector}:{})};
}
const read=file=>JSON.parse(readFileSync(file,'utf8'));
function finishCommitted(j,journal){
 if(j.hadCurrent&&existsSync(j.backup)){rmSync(j.dest+'.previous',{recursive:true,force:true});renameSync(j.backup,j.dest+'.previous');}
 rmSync(j.stage,{recursive:true,force:true});rmSync(journal,{force:true});
}
export async function recoverTransaction(dest,service){
 const journal=dest+'.transaction.json';if(!existsSync(journal))return false;
 const j=read(journal);if(!['prepared','old_moved','swapped','committed'].includes(j.phase)||dirname(j.stage)!==dirname(dest)||!j.stage.startsWith(dest+'.stage-')||j.dest!==dest||dirname(j.backup)!==dirname(dest)||!j.backup.startsWith(dest+'.rollback-'))throw Error('Invalid transaction receipt');
 if(j.phase==='committed'){finishCommitted(j,journal);return false;}
 await service.stop();
 if(existsSync(j.backup)){rmSync(dest,{recursive:true,force:true});renameSync(j.backup,dest);}
 else if(!j.hadCurrent&&existsSync(dest)){const config=read(join(dest,'config.json'));if(config.installId!==j.installId)throw Error('Unexpected installation identity');rmSync(dest,{recursive:true,force:true});}
 await service.restore(j.services);
 if(j.hadCurrent)await service.start(j.services);
 rmSync(j.stage,{recursive:true,force:true});rmSync(journal,{force:true});return true;
}
export async function deployTransaction({dest,stage,service,validate,health,checkpoint=async()=>{},report=()=>{}}){
 await recoverTransaction(dest,service);
 await validate(stage);await checkpoint('validated'); // No service/file mutation before complete validation.
 const hadCurrent=existsSync(dest),services=await service.snapshot();const backup=dest+'.rollback-'+randomUUID();
 const installId=read(join(stage,'config.json')).installId;
 const journal=dest+'.transaction.json';const j={dest,stage,backup,hadCurrent,services,installId,phase:'prepared'};atomicJSON(journal,j,{durable:true});
 try{
  report('update_prepared');await checkpoint('prepared');await service.stop();await checkpoint('stopped');
  if(hadCurrent)renameSync(dest,backup);j.phase='old_moved';atomicJSON(journal,j,{durable:true});await checkpoint('old_moved');
  renameSync(stage,dest);j.phase='swapped';atomicJSON(journal,j,{durable:true});await checkpoint('swapped');
  await service.start();await checkpoint('started');if(!await health(dest))throw Error('Health check failed');await checkpoint('healthy');
  j.phase='committed';atomicJSON(journal,j,{durable:true});report('update_committed');
 }catch(error){
  try{await recoverTransaction(dest,service);report('update_rollback');}catch{throw Error('Update failed; rollback pending. Keep the transaction receipt and retry recovery.');}
  throw Error('Update failed; previous installation and service configuration restored.');
 }
 // Cleanup cannot invalidate an already healthy committed installation.
 try{finishCommitted(j,journal);}catch{}
}
export function copyRuntimeState(from,to){
 for(const file of ['macos/startup/state.json','startup/state.json']){const old=join(from,file);if(existsSync(old)){mkdirSync(dirname(join(to,file)),{recursive:true});cpSync(old,join(to,file));}}
}
