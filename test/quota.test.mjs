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
  assert.equal(quotaFromResponse(r, 300).percent, null);
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
test('5 hour selection remains separate from weekly and strips unrelated payload', () => {
  const r = quotaFromResponse({ rateLimits: { ...bucket(), secondary: { usedPercent: 56, windowDurationMins: 300 }, credits: { balance: 'example' } } }, 300);
  assert.equal(r.percent, 44); assert.equal(r.label, 'Codex 5 小时额度');
  assert.equal(r.windowDurationMins, 300);
  assert.deepEqual(Object.keys(r).sort(), ['label', 'percent', 'resetsAt', 'updatedAt', 'windowDurationMins']);
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
