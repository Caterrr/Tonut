import {mkdirSync,copyFileSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=['README.md','LICENSE','THIRD_PARTY_NOTICES.md','package.json','.gitignore','Install.command','Uninstall.command','Install.cmd','Uninstall.cmd','docs/UPSTREAM-LICENSE','docs/VALIDATION.md','src/agent.mjs','src/app-server.mjs','src/cdp.mjs','src/quota.mjs','src/renderer.mjs','startup/controller.cjs','startup/windows.cjs','startup/windows-bridge.ps1','startup/windows-native.cs','macos/startup/bridge.m','macos/startup/watch.cjs','scripts/manage-macos.mjs','scripts/package.mjs','windows/supervisor.mjs','windows/manage.ps1','demo/index.html','demo/demo.mjs','demo/server.mjs','demo/build-preview.mjs','test/quota.test.mjs','test/agent.test.mjs','test/platform.test.mjs','test/mock-app-server.mjs','test/startup-controller.cjs','test/browser.mjs'];
const stage=join(root,'dist/Tonut');rmSync(stage,{recursive:true,force:true});mkdirSync(stage,{recursive:true});
const hashes=[];
for(const f of files){const out=join(stage,f);mkdirSync(dirname(out),{recursive:true});copyFileSync(join(root,f),out);hashes.push(createHash('sha256').update(readFileSync(out)).digest('hex')+'  '+f);}
writeFileSync(join(stage,'SHA256SUMS'),hashes.join('\n')+'\n');
if(process.platform!=='win32'){
 const zip=join(root,'dist/Tonut-0.3.0-source.zip');rmSync(zip,{force:true});execFileSync('/usr/bin/ditto',['-c','-k','--norsrc','--keepParent',stage,zip]);
 console.log(zip);console.log('sha256',createHash('sha256').update(readFileSync(zip)).digest('hex'));
}else console.log('Staged allowlisted source under dist/Tonut; zip with Compress-Archive.');
