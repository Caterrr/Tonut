// Reset credits are independent of quota windows. Count is authoritative; IDs/titles are never forwarded.
export function resetCreditsFromResponse(response) {
  const value=response?.rateLimitResetCredits;
  if(!Number.isSafeInteger(value?.availableCount)||value.availableCount<0)return null;
  return {availableCount:value.availableCount};
}
const labelFor=duration=>duration===10080?'Codex 周额度':duration===300?'Codex 5 小时额度':`Codex ${duration} 分钟额度`;
function normalizeWindow(raw,duration,now){
 const resetsAt=Number.isFinite(raw?.resetsAt)?raw.resetsAt:null;
 const expired=resetsAt!==null&&resetsAt*1000<=now;
 return {percent:!expired&&typeof raw?.usedPercent==='number'&&Number.isFinite(raw.usedPercent)?Math.max(0,Math.min(100,100-raw.usedPercent)):null,
  label:labelFor(duration),resetsAt,windowDurationMins:duration};
}
// Full snapshots only. Duration identifies a window; primary/secondary order is not meaningful here.
export function quotaFromResponse(response, _legacyDuration = 10080, now = Date.now()) {
  const hasMap = response?.rateLimitsByLimitId != null;
  const bucket = hasMap ? response.rateLimitsByLimitId.codex : response?.rateLimits;
  const empty = { percent: null, label:'Codex 额度', updatedAt: now, resetsAt: null, windowDurationMins: null, resetCredits: resetCreditsFromResponse(response),windows:[] };
  if (!bucket || (bucket.limitId != null && bucket.limitId !== 'codex')) return empty;
  const candidates=[bucket.primary,bucket.secondary];
  const windows=[10080,300].flatMap(mins=>{
   const matching=candidates.filter(w=>w?.windowDurationMins===mins);
   // Ambiguous duplicate durations remain unknown instead of choosing an arbitrary quota.
   return matching.length?[normalizeWindow(matching.length===1?matching[0]:null,mins,now)]:[];
  });
  // Presence of a 5h window wins even when its usage/reset is unknown or expired.
  // A returned window with an unidentifiable duration cannot establish absence of 5h.
  const untyped=candidates.some(w=>w!=null&&(!Number.isFinite(w.windowDurationMins)||w.windowDurationMins<=0));
  const selected=windows.find(w=>w.windowDurationMins===300)||(untyped?null:windows.find(w=>w.windowDurationMins===10080));
  return {...empty,...selected,windows};
}
