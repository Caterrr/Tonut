// Full snapshots only. Never infer quota from token counts, plan names or credits.
export function quotaFromResponse(response, duration = 10080, now = Date.now()) {
  const hasMap = response?.rateLimitsByLimitId != null;
  const bucket = hasMap ? response.rateLimitsByLimitId.codex : response?.rateLimits;
  const label = duration === 10080 ? 'Codex 周额度' : duration === 300 ? 'Codex 5 小时额度' : `Codex ${duration} 分钟额度`;
  const empty = { percent: null, label, updatedAt: now, resetsAt: null, windowDurationMins: null };
  if (!bucket || (bucket.limitId != null && bucket.limitId !== 'codex')) return empty;
  const window = [bucket.primary, bucket.secondary].find(w => w?.windowDurationMins === duration);
  if (!window) return empty;
  // A snapshot reporting a reset in the past must be refreshed, not carried forward.
  if (Number.isFinite(window.resetsAt) && window.resetsAt * 1000 <= now) return empty;
  return { ...empty, percent: typeof window.usedPercent === 'number' && Number.isFinite(window.usedPercent)
      ? Math.max(0, Math.min(100, 100 - window.usedPercent)) : null,
    resetsAt: Number.isFinite(window.resetsAt) ? window.resetsAt : null, windowDurationMins: window.windowDurationMins };
}
