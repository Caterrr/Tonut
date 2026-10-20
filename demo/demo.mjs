import { installAvatarRing } from '/renderer.mjs';
import { DONUT_SVG } from '/donut.mjs';
import { quotaFromResponse } from '/quota.mjs';
installAvatarRing('#account',DONUT_SVG);
const reading = document.querySelector('#reading'), slider = document.querySelector('#remaining');
function set(remaining = 89, state = 'ready') {
  const now = Date.now();
  const data = { rateLimitResetCredits:{availableCount:2}, rateLimitsByLimitId: { codex: { limitId: 'codex', primary: {
    usedPercent: 100 - remaining, windowDurationMins: 10080, resetsAt: Math.floor(now / 1000) + 86400
  } } } };
  const quota = quotaFromResponse(state === 'missing' ? null : data, 10080, now);
  if (state === 'stale') quota.updatedAt = now - 151000;
  window.__codexAvatarQuota.update(quota);
  reading.textContent = state === 'ready' ? `${remaining}%` : '—';
  slider.value = remaining;
}
slider.addEventListener('input', () => set(Number(slider.value)));
document.querySelector('#reset').addEventListener('click', () => set());
document.querySelector('#missing').addEventListener('click', () => set(89, 'missing'));
document.querySelector('#stale').addEventListener('click', () => set(89, 'stale'));
document.querySelector('#theme').addEventListener('click', () => {
  document.documentElement.dataset.theme = document.body.classList.toggle('dark') ? 'dark' : 'light';
});
document.querySelector('#account').addEventListener('click', () => { document.querySelector('#account-status').textContent = '原头像点击事件仍然有效。'; });
set();
