import {readFile,access} from 'node:fs/promises';
import {constants,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {isAbsolute,join} from 'node:path';
import {QuotaClient} from './app-server.mjs';
import {quotaFromResponse} from './quota.mjs';
import {PageConnection} from './cdp.mjs';
import {installAvatarRing} from './renderer.mjs';
import {DONUT_SVG} from './donut.mjs';
import {HostVerifier,HostFault,validateTarget} from '../lib/host-identity.mjs';
import {Diagnostics,heartbeat} from '../lib/diagnostics.mjs';
export const avatarSelector='nav[data-app-navigation-rail] button:is([aria-label="打开个人资料菜单"],[aria-label="Open profile menu"]) span.relative.isolate';
export function mainPages(targets){return Array.isArray(targets)?targets.filter(t=>t?.type==='page'&&t.url==='app://-/index.html'):[];}
const version='0.4.1-credit-spacing-480-160';
const root=fileURLToPath(new URL('..',import.meta.url));
export class AgentSession {
 constructor(config,{verify=new HostVerifier(config),fetcher=fetch,connect=PageConnection.connect,makeClient=bin=>new QuotaClient(bin),report=new Diagnostics(root,'agent'),now=Date.now}={}){Object.assign(this,{config,verify,fetcher,connect,makeClient,report,now});this.page=null;this.pageId=null;this.client=null;this.lastRead=0;this.quota=quotaFromResponse(null,config.duration);}
 drop(){this.page?.close();this.page=null;this.pageId=null;}
 cancelRead(){this.client?.close();}
 async tick(){
  try{
   const identity=await this.verify.check();
   const reply=await this.fetcher('http://127.0.0.1:39222/json/list',{redirect:'error',signal:AbortSignal.timeout(2000)});if(!reply.ok)throw new HostFault('cdp_unavailable');
   const targets=mainPages(await reply.json());if(targets.length!==1)throw new HostFault(targets.length?'target_ambiguous':'target_missing');
   const target=targets[0];validateTarget(target);
   if(this.pageId!==target.id||this.page?.socket.readyState!==WebSocket.OPEN){
    this.drop();const before=await this.verify.check(true);if(before.key!==identity.key)throw new HostFault('identity_mismatch');
    this.page=await this.connect(target.webSocketDebuggerUrl,39222);const after=await this.verify.check(true);if(before.key!==after.key)throw new HostFault('identity_mismatch');
    this.pageId=target.id;
   }
   if(!await this.page.evaluate(`location.href==='app://-/index.html'`))throw new HostFault('target_changed');
   const installed=await this.page.evaluate(`window.__codexAvatarQuota?.version===${JSON.stringify(version)}`);
   if(!installed)await this.page.evaluate(`(()=>{(${installAvatarRing.toString()})(${JSON.stringify(this.config.selector||avatarSelector)},${JSON.stringify(DONUT_SVG)});window.__codexAvatarQuota.version=${JSON.stringify(version)};})()`);
   if(this.now()-this.lastRead>=60000){
    this.lastRead=this.now();try{this.client=this.makeClient(this.config.cli);await this.client.initialize();this.quota=quotaFromResponse(await this.client.read(),this.config.duration,this.now());}
    catch{this.quota=quotaFromResponse(null,this.config.duration,this.now());}finally{this.client?.close();this.client=null;}
   }
   const placed=await this.page.evaluate(`(()=>{window.__codexAvatarQuota?.update(${JSON.stringify(this.quota)});return {placed:window.__codexAvatarQuota?.status().placed,hidden:document.hidden}})()`);
   this.report.set(this.quota.percent===null?'quota_unavailable':placed?.hidden?'host_hidden':placed?.placed?'ready':'avatar_unmatched');
  }catch(e){this.drop();this.report.set(e instanceof HostFault?e.code:e?.code==='cdp_timeout'?'cdp_timeout':'cdp_unavailable');}
 }
 async close(){this.cancelRead();try{if(this.page)await this.page.evaluate('window.__codexAvatarQuota?.destroy()');}catch{}this.drop();this.report.set('stopped');}
}
export async function runAgent(config,{signal,deps={},base=root}={}){
 if(config.port!==39222||!isAbsolute(config.cli)||![10080,300].includes(config.duration)||!isAbsolute(config.app))throw Error('Invalid configuration');
 await access(config.cli,constants.X_OK);const session=new AgentSession(config,deps),cancel=()=>session.cancelRead();signal?.addEventListener('abort',cancel,{once:true});
 try{session.report.set('starting');while(!signal?.aborted&&!existsSync(join(base,'stop.request'))){
   heartbeat(base,'agent',config.installId);await session.tick();
   if(!signal?.aborted)await new Promise(resolve=>{const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();};const timer=setTimeout(done,2000);signal?.addEventListener('abort',done,{once:true});});
  }}finally{signal?.removeEventListener('abort',cancel);await session.close();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const config=JSON.parse(await readFile(new URL('../config.json',import.meta.url),'utf8'));
 const abort=new AbortController();for(const s of ['SIGINT','SIGTERM','disconnect'])process.once(s,()=>abort.abort());process.on('message',m=>{if(m?.type==='stop')abort.abort();});
 await runAgent(config,{signal:abort.signal});
}
