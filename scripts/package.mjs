import {mkdirSync,copyFileSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {macFiles,windowsFiles} from './runtime-files.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),version=JSON.parse(readFileSync(join(root,'package.json'))).version;
const extra=['README.md','CHANGELOG.md','package-lock.json','.gitignore','Install.command','Uninstall.command','Install.cmd','Uninstall.cmd','docs/VALIDATION.md','docs/RELEASE_CHECKLIST.md','scripts/package.mjs','scripts/sync-icon.mjs','scripts/verify-macos-update.mjs','demo/index.html','demo/demo.mjs','demo/server.mjs','demo/build-preview.mjs','test/quota.test.mjs','test/agent.test.mjs','test/platform.test.mjs','test/credits.test.mjs','test/reliability.test.mjs','test/mock-app-server.mjs','test/startup-controller.cjs','test/browser.mjs','test/native-mutex.mjs','test/windows-platform.ps1','test/fixtures/transaction-crash.mjs','.github/workflows/tonut.yml'];
const files=[...new Set([...macFiles,...windowsFiles,...extra])].sort();
const stage=join(root,'dist/Tonut');rmSync(stage,{recursive:true,force:true});mkdirSync(stage,{recursive:true});const hashes=[];
const forbidden=/\/Users\/[^/\s]+|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----|libfile_[a-f0-9]{16,}/;
for(const f of files){const bytes=readFileSync(join(root,f));if(forbidden.test(bytes.toString()))throw Error('Private data pattern in release source');const out=join(stage,f);mkdirSync(dirname(out),{recursive:true});copyFileSync(join(root,f),out);hashes.push(createHash('sha256').update(bytes).digest('hex')+'  '+f);}
writeFileSync(join(stage,'MANIFEST.sha256'),hashes.join('\n')+'\n');
const zip=join(root,`dist/Tonut-${version}-source.zip`);rmSync(zip,{force:true});
const python=process.platform==='win32'?'python':'python3';
execFileSync(python,['-c',`import zipfile,pathlib,sys\nr=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:\n for p in sorted(r.rglob('*')):\n  if p.is_file():\n   i=zipfile.ZipInfo('Tonut/'+p.relative_to(r).as_posix(),(2026,1,1,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.external_attr=0o100644<<16;z.writestr(i,p.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)`,stage,zip]);
const digest=createHash('sha256').update(readFileSync(zip)).digest('hex');writeFileSync(join(root,'dist/SHA256SUMS'),digest+'  '+`Tonut-${version}-source.zip`+'\n');
console.log(`Packaged ${files.length} allowlisted files: Tonut-${version}-source.zip`);console.log('sha256',digest);
