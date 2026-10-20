import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true,
  chromiumSandbox: true, ignoreDefaultArgs: ['--unsafely-disable-devtools-self-xss-warnings'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
const measure = () => {
  const t = document.querySelector('#codex-avatar-quota-tooltip');
  const ratio = n => { const f = document.querySelector(`[data-quota="${n}-fill"]`), m = document.querySelector(`[data-quota="${n}-meter"]`); return f.getBoundingClientRect().width / m.getBoundingClientRect().width * 100; };
  return { remaining: ratio('remaining'), reset: ratio('reset'), opacity: Number(getComputedStyle(t).opacity), hidden: t.hidden, phase: t.dataset.motion,
    animations: [...t.getAnimations({ subtree: true })].map(a => ({ type: a.constructor.name, duration: a.effect.getTiming().duration, currentTime: a.currentTime })) };
};
try {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(new URL('../preview.html', import.meta.url).href);
  await page.waitForFunction(() => window.__codexAvatarQuota?.status().percent === '89');
  // Focus and the first observation run in the same task, so the opening is sampled at zero.
  const at0 = await page.evaluate(fn => { document.querySelector('#account').focus(); return eval(`(${fn})()`); }, measure.toString());
  await page.waitForTimeout(100); const at100 = await page.evaluate(measure);
  await page.waitForTimeout(600); const at700 = await page.evaluate(measure);
  assert.ok(at0.remaining < 1 && at0.reset < 1 && at0.opacity < .1);
  assert.ok(at100.remaining > 1 && at100.remaining < 89);
  assert.ok(at100.reset > 0 && at100.reset < 15);
  assert.ok(Math.abs(at700.remaining - 89) < .1 && at700.opacity === 1);
  const close0 = await page.evaluate(fn => { document.querySelector('#account').blur(); return eval(`(${fn})()`); }, measure.toString());
  assert.equal(close0.hidden, true); assert.equal(close0.phase, 'closed');
  await page.waitForTimeout(100); const close100 = await page.evaluate(measure);
  assert.equal(close100.hidden, true); assert.equal(close100.animations.length, 0);
  const reverse0 = await page.evaluate(fn => { document.querySelector('#account').focus(); return eval(`(${fn})()`); }, measure.toString());
  assert.ok(reverse0.remaining < 1 && !reverse0.hidden); // A new hover starts from zero after immediate dismissal.
  await page.waitForTimeout(700); const reversed = await page.evaluate(measure);
  assert.ok(Math.abs(reversed.remaining - 89) < .1);
  await page.evaluate(() => document.querySelector('#account').blur());
  await page.waitForTimeout(700); const closed = await page.evaluate(measure);
  assert.equal(closed.hidden, true); assert.equal(closed.phase, 'closed');
  assert.equal(closed.animations.filter(a => a.type === 'Animation').length, 0);
  await page.evaluate(() => document.querySelector('#account').focus()); await page.waitForTimeout(700);
  const changed = await page.evaluate(fn => {
    window.__codexAvatarQuota.update({ percent: 55, label: 'Codex 周额度', updatedAt: Date.now(), resetsAt: Date.now()/1000 + 86400, windowDurationMins: 10080 });
    return eval(`(${fn})()`);
  }, measure.toString());
  assert.ok(changed.remaining > 80); // Normal refresh interpolates from the current length, never zero.
  assert.ok(!changed.animations.some(a => a.duration === 480));
  await page.waitForTimeout(500); const afterUpdate = await page.evaluate(measure);
  assert.ok(Math.abs(afterUpdate.remaining - 55) < .1);
  for (let i=0; i<4; i++) {
    await page.evaluate(() => { document.querySelector('#account').blur(); document.querySelector('#account').focus(); });
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(700); const rapid = await page.evaluate(measure);
  assert.ok(Math.abs(rapid.remaining - 55) < .1);
  assert.equal(rapid.animations.filter(a => a.type === 'Animation').length, 0);
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#codex-avatar-quota-tooltip').evaluate(e => e.hidden), true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(fn => { const b=document.querySelector('#account'); b.blur(); b.focus(); return eval(`(${fn})()`); }, measure.toString());
  assert.ok(Math.abs(reduced.remaining - 55) < .1 && reduced.opacity === 1);
  assert.equal(reduced.animations.length, 0);
  await page.evaluate(() => document.querySelector('#account').blur());
  assert.equal(await page.locator('#codex-avatar-quota-tooltip').evaluate(e => e.hidden), true);
  await page.locator('#account').click(); assert.match(await page.locator('#account-status').innerText(), /仍然有效/);
  assert.deepEqual(errors, []);
  const result = { at0, at100, at700, close0, close100, reverse0, reversed, closed, changed, afterUpdate, rapid, reduced };
  assert.deepEqual(at0.animations.map(a=>a.duration).sort((a,b)=>a-b),[160,480,480]);
  console.log('PASS: 480ms entry, 160ms fade-in, immediate dismissal, no stale motion, interpolated updates, rapid reentry, Esc, reduced motion, original click.');
} finally { await browser.close(); }
