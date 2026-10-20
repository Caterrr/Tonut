import {readFile,access} from 'node:fs/promises';
import {constants,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {isAbsolute} from 'node:path';
import {QuotaClient} from './app-server.mjs';
import {quotaFromResponse} from './quota.mjs';
import {PageConnection} from './cdp.mjs';
import {installAvatarRing} from './renderer.mjs';
export const avatarSelector='nav[data-app-navigation-rail] button:is([aria-label="打开个人资料菜单"],[aria-label="Open profile menu"]) span.relative.isolate';
export function mainPages(targets) {return targets.filter(t=>t.type==='page'&&t.url==='app://-/index.html');}
const version='0.3.0-480-160';
export async function runAgent(config,{signal}={}) {
  if(config.port!==39222||!isAbsolute(config.cli)||![10080,300].includes(config.duration))throw Error('Invalid configuration');
  await access(config.cli,constants.X_OK);
  let page=null,pageId=null,client=null,quota=quotaFromResponse(null,config.duration),lastRead=0;
  const drop=()=>{page?.close();page=null;pageId=null;};
  const stop=()=>{client?.close();client=null;drop();};
  const cancelRead=()=>{client?.close();client=null;};
  signal?.addEventListener('abort',cancelRead,{once:true});
  try {
    while(!signal?.aborted && !existsSync(new URL('../stop.request',import.meta.url))) {
      try {
        const reply=await fetch('http://127.0.0.1:39222/json/list',{redirect:'error',signal:AbortSignal.timeout(2000)});
        if(!reply.ok)throw Error('Discovery unavailable');
        const targets=mainPages(await reply.json());
        if(targets.length!==1){drop();throw Error('Main page ambiguous or absent');}
        const target=targets[0];
        if(pageId!==target.id||page?.socket.readyState!==WebSocket.OPEN){drop();page=await PageConnection.connect(target.webSocketDebuggerUrl,39222);pageId=target.id;}
        // A page reload removes the global; a closed socket is re-discovered on the next tick.
        const installed=await page.evaluate(`window.__codexAvatarQuota?.version===${JSON.stringify(version)}`);
        if(!installed)await page.evaluate(`(()=>{(${installAvatarRing.toString()})(${JSON.stringify(config.selector||avatarSelector)});window.__codexAvatarQuota.version=${JSON.stringify(version)};})()`);
        if(Date.now()-lastRead>=60000) {
          lastRead=Date.now();
          try {client=new QuotaClient(config.cli);await client.initialize();quota=quotaFromResponse(await client.read(),config.duration);}
          catch {quota=quotaFromResponse(null,config.duration);}
          finally {client?.close();client=null;}
        }
        if(!signal?.aborted)await page.evaluate(`window.__codexAvatarQuota?.update(${JSON.stringify(quota)})`);
      } catch {drop();} // No page content, account payload, URLs or command lines in logs.
      if(!signal?.aborted)await new Promise(resolve=>{
        const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();};
        const timer=setTimeout(done,2000);signal?.addEventListener('abort',done,{once:true});
      });
    }
  } finally {
    try {if(page)await page.evaluate('window.__codexAvatarQuota?.destroy()');}catch{}
    stop();signal?.removeEventListener('abort',cancelRead);
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const config=JSON.parse(await readFile(new URL('../config.json',import.meta.url),'utf8'));
  const abort=new AbortController();process.once('SIGINT',()=>abort.abort());process.once('SIGTERM',()=>abort.abort());
  await runAgent(config,{signal:abort.signal});
}
