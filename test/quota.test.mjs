import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { quotaFromResponse } from '../src/quota.mjs';
import { QuotaClient } from '../src/app-server.mjs';
import { localWebSocket } from '../src/cdp.mjs';
const weekly = { usedPercent: 11, windowDurationMins: 10080 };
const bucket = (w = weekly) => ({ limitId: 'codex', primary: w });
test('Codex weekly 11% used means 89% remaining, regardless of plan label', () => {
  const r = { rateLimitsByLimitId: { codex: { ...bucket(), planType: 'prolite' } } };
  assert.equal(quotaFromResponse(r).percent, 89);
  assert.equal(quotaFromResponse(r, 300).windowDurationMins,10080); // Legacy preference cannot invent an absent 5h window.
});
test('authoritative map cannot fall back to a different or missing bucket', () => {
  assert.equal(quotaFromResponse({ rateLimitsByLimitId: {}, rateLimits: bucket() }).percent, null);
  assert.equal(quotaFromResponse({ rateLimitsByLimitId: { other: bucket() } }).percent, null);
  assert.equal(quotaFromResponse({ rateLimits: { ...bucket(), limitId: 'other' } }).percent, null);
  assert.equal(quotaFromResponse({ rateLimits: bucket() }).percent, 89);
});
test('missing values and expired windows cannot look healthy', () => {
  for (const usedPercent of [null, undefined, '11', NaN, Infinity])
    assert.equal(quotaFromResponse({ rateLimits: bucket({ ...weekly, usedPercent }) }).percent, null);
  assert.equal(quotaFromResponse({ rateLimits: bucket({ ...weekly, resetsAt: 1 }) }).percent, null);
  assert.equal(quotaFromResponse({ rateLimits: bucket({ ...weekly, usedPercent: 100 }) }).percent, 0);
  assert.equal(quotaFromResponse({ rateLimits: bucket({ ...weekly, usedPercent: -2 }) }).percent, 100);
});
test('automatic 5h selection remains separate from weekly and strips unrelated payload', () => {
  const r = quotaFromResponse({ rateLimits: { ...bucket(), secondary: { usedPercent: 56, windowDurationMins: 300 }, credits: { balance: 'example' } } }, 300);
  assert.equal(r.percent, 44); assert.equal(r.label, 'Codex 5 小时额度');
  assert.equal(r.windowDurationMins, 300);
  assert.deepEqual(Object.keys(r).sort(), ['label', 'percent', 'resetCredits', 'resetsAt', 'updatedAt', 'windowDurationMins','windows']);
});
const snapshot=(primary,secondary=null)=>({rateLimitsByLimitId:{codex:{limitId:'codex',primary,secondary}}});
const fiveHour={usedPercent:38,windowDurationMins:300,resetsAt:7200};
test('weekly-only and five-hour-only snapshots expose only real durations',()=>{
 const w=quotaFromResponse(snapshot(weekly),10080,0);assert.deepEqual(w.windows.map(x=>x.windowDurationMins),[10080]);
 const h=quotaFromResponse(snapshot(fiveHour),10080,0);assert.deepEqual(h.windows.map(x=>x.windowDurationMins),[300]);assert.equal(h.percent,62);assert.equal(h.label,'Codex 5 小时额度');assert.equal(h.resetsAt,7200);
});
test('5h wins either slot order and every legacy duration preference',()=>{
 for(const slots of [[weekly,fiveHour],[fiveHour,weekly]]){
  const w=quotaFromResponse(snapshot(...slots),10080,0),h=quotaFromResponse(snapshot(...slots),300,0);
  assert.deepEqual(w.windows.map(x=>[x.windowDurationMins,x.percent]),[[10080,89],[300,62]]);assert.equal(w.percent,62);assert.equal(w.windowDurationMins,300);assert.equal(h.percent,62);assert.equal(h.windowDurationMins,300);assert.equal(h.resetsAt,7200);
 }
});
test('missing percentage stays unknown while recognized 5h presence and its reset survive',()=>{
 const q=quotaFromResponse(snapshot(weekly,{windowDurationMins:300,resetsAt:7200}),10080,0);const h=q.windows[1];assert.equal(h.percent,null);assert.equal(h.resetsAt,7200);assert.equal(q.percent,null);assert.equal(q.windowDurationMins,300);
 assert.equal(quotaFromResponse(snapshot(weekly,{windowDurationMins:300,usedPercent:100}),10080,0).windows[1].percent,0);
});
test('missing reset is unknown without discarding a known quota; untyped windows are not invented',()=>{
 const h=quotaFromResponse(snapshot({usedPercent:38,windowDurationMins:300}),10080,0);assert.equal(h.percent,62);assert.equal(h.resetsAt,null);
 for(const raw of [{usedPercent:38},{usedPercent:38,windowDurationMins:'300'},{usedPercent:38,windowDurationMins:15}])assert.deepEqual(quotaFromResponse(snapshot(raw),10080,0).windows,[]);
});
test('expired 5h data and duplicate duration ambiguity never become a healthy zero',()=>{
 const q=quotaFromResponse(snapshot(weekly,{...fiveHour,resetsAt:1}),10080,2000);assert.equal(q.percent,null);assert.equal(q.windowDurationMins,300);assert.equal(q.windows[1].percent,null);assert.equal(q.windows[1].windowDurationMins,300);
 const ambiguous=quotaFromResponse(snapshot(fiveHour,{...fiveHour,usedPercent:100}),300,0);assert.equal(ambiguous.percent,null);assert.equal(ambiguous.resetsAt,null);
});
test('read failure and missing bucket are unknown rather than an absent 5h or zero',()=>{
 for(const raw of [null,{}, {rateLimitsByLimitId:{}}])for(const oldDuration of [300,10080]){const q=quotaFromResponse(raw,oldDuration,0);assert.equal(q.percent,null);assert.equal(q.windowDurationMins,null);assert.equal(q.label,'Codex 额度');}
});
test('unidentifiable returned duration blocks an unproven weekly fallback',()=>{
 for(const raw of [{usedPercent:38},{usedPercent:38,windowDurationMins:'300'},{windowDurationMins:null}]){const q=quotaFromResponse(snapshot(weekly,raw),10080,0);assert.equal(q.percent,null);assert.equal(q.windowDurationMins,null);}
});
test('known non-5h durations allow weekly fallback; known 5h still wins alongside an untyped slot',()=>{
 assert.equal(quotaFromResponse(snapshot(weekly,{usedPercent:20,windowDurationMins:15}),300,0).windowDurationMins,10080);
 assert.equal(quotaFromResponse(snapshot(fiveHour,{}),10080,0).percent,62);
});
test('only selected loopback websocket is accepted', () => {
  assert.equal(localWebSocket('ws://127.0.0.1:39222/devtools/page/example', 39222).hostname, '127.0.0.1');
  for (const u of ['ws://example.com:39222/x', 'ws://127.0.0.1:39223/x', 'wss://127.0.0.1:39222/x', 'ws://u:p@127.0.0.1:39222/x'])
    assert.throws(() => localWebSocket(u, 39222));
});
test('mock App Server handshake and only read-only method allowlist', async () => {
  const client = new QuotaClient(process.execPath, [fileURLToPath(new URL('./mock-app-server.mjs', import.meta.url))]);
  try {
    await client.initialize(); assert.equal(quotaFromResponse(await client.read()).percent, 89);
    assert.throws(() => client.request('account/logout'), /只允许/);
    assert.throws(() => client.request('account/rateLimitResetCredit/consume'), /只允许/);
  } finally { client.close(); }
});
