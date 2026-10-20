import {execFileSync as run} from 'node:child_process';
import {writeFileSync,existsSync,mkdirSync,copyFileSync,chmodSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const source=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const home=homedir(),dest=join(home,'Library/Application Support/Tonut'),agents=join(home,'Library/LaunchAgents');
const labels=['com.tonut.agent','com.tonut.startup'];
const domain=`gui/${process.getuid()}`;
const call=(cmd,args)=>run(cmd,args,{stdio:'pipe'});
async function bootout(){
 for(const l of labels)try{call('/bin/launchctl',['bootout',`${domain}/${l}`]);}catch{}
 const deadline=Date.now()+12000;
 while(true){
  let present=false;
  for(const l of labels)try{call('/bin/launchctl',['print',`${domain}/${l}`]);present=true;}catch{}
  if(!present)return;
  if(Date.now()>deadline)throw Error('Background shutdown pending; no force termination. Inspect and retry after it stops.');
  await new Promise(r=>setTimeout(r,200));
 }
}
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function plist(label,args){return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args.map(a=>`<string>${xml(a)}</string>`).join('')}</array><key>WorkingDirectory</key><string>${xml(dest)}</string><key>RunAtLoad</key><true/><key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict><key>ThrottleInterval</key><integer>10</integer><key>ProcessType</key><string>Background</string><key>StandardOutPath</key><string>/dev/null</string><key>StandardErrorPath</key><string>/dev/null</string></dict></plist>\n`;}
if(process.platform!=='darwin')throw Error('macOS only');
const action=process.argv[2]||'status';
if(action==='status') {
 for(const label of labels){try{const s=call('/bin/launchctl',['print',`${domain}/${label}`]).toString();console.log(label,s.split('\n').filter(l=>/^\t(state|pid|last exit code) =/.test(l)).map(l=>l.trim()).join('; '));}catch{console.log(label,'not loaded');}}
 process.exit();
}
if(action==='uninstall') {
 await bootout();for(const label of labels)rmSync(join(agents,label+'.plist'),{force:true});
 // Remove our own DOM immediately when a debug session is still available.
 try{const {PageConnection}=await import('../src/cdp.mjs');const pages=(await(await fetch('http://127.0.0.1:39222/json/list',{signal:AbortSignal.timeout(1500)})).json()).filter(p=>p.type==='page'&&p.url==='app://-/index.html');for(const p of pages){const c=await PageConnection.connect(p.webSocketDebuggerUrl,39222);await c.evaluate('window.__codexAvatarQuota?.destroy()');c.close();}}catch{}
 rmSync(dest,{recursive:true,force:true});console.log('Removed only Tonut jobs/files. Normally quit and reopen the host to close its debug port.');process.exit();
}
if(action!=='install')throw Error('Use install, status or uninstall');
if(Number(process.versions.node.split('.')[0])<24)throw Error('Node.js 24+ required');
const app=resolve(process.argv[3]||['/Applications/Codex.app','/Applications/ChatGPT.app'].find(p=>existsSync(p))||'');
const info=join(app,'Contents/Info.plist');
if(!existsSync(info)||call('/usr/libexec/PlistBuddy',['-c','Print :CFBundleIdentifier',info]).toString().trim()!=='com.openai.codex')throw Error('Select the official Codex desktop bundle');
const candidates=['Contents/Resources/codex-cli/bin/codex','Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex','Contents/Resources/codex'];
const cli=candidates.map(p=>join(app,p)).find(existsSync);if(!cli)throw Error('Bundled official CLI not found');
// Build and validate our own helper before stopping any installed version. Never patch/sign the host.
const build=join(source,'dist');mkdirSync(build,{recursive:true});
const helper=join(build,'startup-bridge');
call('/usr/bin/xcrun',['clang','-fobjc-arc','-O2','-Wall','-Wextra','-Werror','-arch','arm64','-arch','x86_64','-mmacosx-version-min=12.0','-framework','AppKit','-framework','ApplicationServices',join(source,'macos/startup/bridge.m'),'-o',helper]);
call('/usr/bin/codesign',['--force','--sign','-','--timestamp=none',helper]);
call('/usr/bin/codesign',['--verify','--strict',helper]);
// Copy an allowlist only: no evidence, auth, logs, account data, .git or unrelated source.
await bootout();mkdirSync(dest,{recursive:true,mode:0o700});chmodSync(dest,0o700);mkdirSync(agents,{recursive:true});
const files=['package.json','LICENSE','THIRD_PARTY_NOTICES.md','docs/UPSTREAM-LICENSE','src/agent.mjs','src/app-server.mjs','src/cdp.mjs','src/quota.mjs','src/renderer.mjs','startup/controller.cjs','macos/startup/watch.cjs','scripts/manage-macos.mjs','macos/startup/bridge.m'];
for(const f of files){mkdirSync(dirname(join(dest,f)),{recursive:true});copyFileSync(join(source,f),join(dest,f));}
copyFileSync(helper,join(dest,'macos/startup/bridge'));chmodSync(join(dest,'macos/startup/bridge'),0o700);
writeFileSync(join(dest,'config.json'),JSON.stringify({port:39222,cli,app,duration:10080},null,2)+'\n',{mode:0o600});
writeFileSync(join(dest,'macos/startup/settings.json'),JSON.stringify({app})+'\n',{mode:0o600});
rmSync(join(dest,'stop.request'),{force:true});
const programs=[[process.execPath,join(dest,'src/agent.mjs')],[process.execPath,join(dest,'macos/startup/watch.cjs')]];
try{for(let i=0;i<labels.length;i++){const file=join(agents,labels[i]+'.plist');writeFileSync(file,plist(labels[i],programs[i]),{mode:0o600});call('/usr/bin/plutil',['-lint',file]);call('/bin/launchctl',['bootstrap',domain,file]);}}
catch{await bootout();throw Error('LaunchAgent activation failed; jobs stopped. Inspect and re-run install.');}
console.log('Installed two login background jobs. Existing running app is left running. The watcher only attempts a normal restart immediately after a new idle foreground launch.');
