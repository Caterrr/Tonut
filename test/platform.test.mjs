import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Windows helper retains normal quit guards and loopback flags without policy override',()=>{
 const native=read('startup/windows-native.cs'),watch=read('startup/windows.cjs'),install=read('windows/manage.ps1');
 assert.match(native,/RmShutdown\(handle,0,IntPtr.Zero\)/);
 assert.match(native,/s\.apps\.Length!=1/);assert.match(native,/s\.inputStamp!=stamp/);
 assert.match(native,/--remote-debugging-address=127\.0\.0\.1 --remote-debugging-port=39222/);
 assert.doesNotMatch(watch,/'-ExecutionPolicy','Bypass'/);
 assert.doesNotMatch(install,/Stop-Process|ExecutionPolicy|taskkill|RunLevel Highest/);
 assert.match(install,/-LogonType Interactive -RunLevel Limited/);
});
test('macOS helper omits Dock mutation and checks native single-instance/plain-launch guards',()=>{
 const s=read('macos/startup/bridge.m');
 assert.doesNotMatch(s,/CFPreferencesSet|forceTerminate\s*\]|SIGKILL/);
 assert.match(s,/\[snapshot\(path\)\[@"apps"\] count\]==1/);
 assert.match(s,/\[args\[@"plain"\] boolValue\]/);
});
