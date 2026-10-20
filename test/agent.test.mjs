import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mainPages} from '../src/agent.mjs';
test('only exact main page is eligible; overlays, webviews and other origins excluded',()=>{
 const main={type:'page',url:'app://-/index.html'};
 const targets=[main,{type:'page',url:'app://-/index.html?initialRoute=%2Favatar-overlay'},{type:'page',url:'app://-/detached-window.html'},{type:'webview',url:'app://-/index.html'},{type:'page',url:'https://example.com/'},{type:'page',url:'app://evil/index.html'}];
 assert.deepEqual(mainPages(targets),[main]);
 assert.equal(mainPages([main,main]).length,2); // Caller refuses ambiguous matches.
});
