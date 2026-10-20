// This function is self-contained so the identical renderer works in the demo and CDP.
// Own DOM only: no reparenting, no React state, no reading account text or chat content.
export function installAvatarRing(selector,donutSVG='') {
  const accent = 'var(--codex-base-accent, var(--color-text-info, #bdcc65))';
  const KEY = '__codexAvatarQuota';
  if (window[KEY]) window[KEY].destroy();
  let target = null, interaction = null, value = { percent: null, label: 'Codex 周额度', updatedAt: 0 };
  let previousDescription = null;
  const ns = 'http://www.w3.org/2000/svg';
  const ring = document.createElementNS(ns, 'svg');
  ring.id = 'codex-avatar-quota-ring'; ring.setAttribute('viewBox', '0 0 44 44');
  ring.setAttribute('aria-hidden', 'true');
  ring.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483000;overflow:visible;display:none';
  const track = document.createElementNS(ns, 'circle');
  const arc = document.createElementNS(ns, 'circle');
  for (const c of [track, arc]) {
    c.setAttribute('cx', '22'); c.setAttribute('cy', '22'); c.setAttribute('r', '20');
    c.setAttribute('fill', 'none'); c.setAttribute('stroke-width', '2');
  }
  track.setAttribute('stroke', '#9aa45640');
  arc.setAttribute('pathLength', '100'); arc.setAttribute('stroke-linecap', 'round');
  arc.setAttribute('transform', 'rotate(-90 22 22)');
  arc.setAttribute('stroke-dasharray', '0 100'); ring.append(track, arc);
  const tooltip = document.createElement('div');
  tooltip.id = 'codex-avatar-quota-tooltip'; tooltip.setAttribute('role', 'tooltip'); tooltip.hidden = true;
  tooltip.style.cssText = 'position:fixed;z-index:2147483001;pointer-events:none;padding:12px 14px;border-radius:12px;box-shadow:0 5px 20px #0002;font:11px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;width:196px;max-width:calc(100vw - 16px);font-variant-numeric:tabular-nums';
  function row(label, name) {
    const container = document.createElement('div');
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px';
    const caption = document.createElement('span'); caption.textContent = label;
    caption.style.cssText = 'color:var(--color-text-secondary,inherit);opacity:.8';
    const number = document.createElement('span'); number.dataset.quota = `${name}-value`;
    number.style.cssText = 'font-weight:550;letter-spacing:.01em';
    const meter = document.createElement('div'); meter.dataset.quota = `${name}-meter`;
    meter.setAttribute('role', name === 'remaining' ? 'meter' : 'progressbar');
    meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', '100');
    meter.style.cssText = 'height:4px;border-radius:9px;overflow:hidden;background:color-mix(in srgb,currentColor 10%,transparent)';
    const fill = document.createElement('div'); fill.dataset.quota = `${name}-fill`;
    fill.style.cssText = 'height:100%;width:0%;border-radius:inherit';
    header.append(caption, number); meter.append(fill); container.append(header, meter); tooltip.append(container);
    return { container, number, meter, fill };
  }
  const remaining = row('剩余', 'remaining');
  const reset = row('距重置', 'reset'); reset.container.style.marginTop = '12px';
  const creditsFooter=document.createElement('div');
  creditsFooter.dataset.quota='reset-credits';creditsFooter.style.cssText='margin-top:10px;font-size:10px;line-height:1.4;color:var(--color-text-secondary,inherit)';
  creditsFooter.hidden=true;tooltip.append(creditsFooter);let creditKey=null;
  function renderCredits(stale) {
    const data=stale?null:value.resetCredits;
    const key=JSON.stringify(data);if(key===creditKey)return;creditKey=key;creditsFooter.replaceChildren();creditsFooter.removeAttribute('aria-label');
    if(!donutSVG){creditsFooter.hidden=true;return;}creditsFooter.hidden=false;
    if(!data||!Number.isSafeInteger(data.availableCount)||data.availableCount<0){creditsFooter.textContent='重置券暂不可用';return;}
    if(data.availableCount===0){creditsFooter.textContent='暂无重置券';return;}
    const icons=document.createElement('div');icons.style.cssText='display:flex;align-items:center;gap:4px';
    const label=document.createElement('span');label.textContent='重置券';label.style.marginRight='3px';icons.append(label);
    const shown=Math.min(data.availableCount,8);
    for(let i=0;i<shown;i++){
      const icon=document.createElement('span');icon.style.cssText='display:inline-flex;width:18px;height:18px;flex:none';
      icon.innerHTML=donutSVG.replaceAll('id="ring"',`id="tonut-credit-${i}"`).replaceAll('url(#ring)',`url(#tonut-credit-${i})`);
      const svg=icon.querySelector('svg');if(svg){svg.setAttribute('width','18');svg.setAttribute('height','18');svg.setAttribute('aria-label',`第${i+1}张重置券`);}icons.append(icon);
    }
    if(data.availableCount>shown){const more=document.createElement('span');more.textContent=`+${data.availableCount-shown}`;icons.append(more);}
    creditsFooter.append(icons);creditsFooter.setAttribute('aria-label',`可用${data.availableCount}张使用限额重置券`);

  }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const rows = [remaining, reset];
  let motion = [], revision = 0, phase = 'closed';
  for (const row of rows) { row.fill.style.transformOrigin = 'left center'; row.fill.style.transform = 'scaleX(0)'; }
  tooltip.style.opacity = '0'; tooltip.style.transform = 'translateY(3px)';
  function cancelMotion(freeze = false) {
    if (freeze) {
      const bars = rows.map(row => getComputedStyle(row.fill).transform);
      const panel = getComputedStyle(tooltip), opacity = panel.opacity, transform = panel.transform;
      rows.forEach((row, i) => { row.fill.style.transform = `scaleX(${new DOMMatrixReadOnly(bars[i]).a})`; });
      tooltip.style.opacity = opacity; tooltip.style.transform = `translateY(${new DOMMatrixReadOnly(transform).m42}px)`;
    }
    revision++;
    for (const animation of motion) animation.cancel();
    motion = [];
  }
  function settle(open) {
    cancelMotion();
    for (const row of rows) row.fill.style.transform = `scaleX(${open ? 1 : 0})`;
    tooltip.style.opacity = open ? '1' : '0'; tooltip.style.transform = `translateY(${open ? 0 : 3}px)`;
    phase = open ? 'open' : 'closed'; tooltip.dataset.motion = phase; tooltip.hidden = !open;
  }
  function animateTo(open) {
    cancelMotion(true);
    if (reducedMotion.matches) { settle(open); return; }
    const scales = rows.map(row => new DOMMatrixReadOnly(getComputedStyle(row.fill).transform).a);
    const distance = Math.min(1, Math.max(...scales.map(scale => Math.abs((open ? 1 : 0) - scale))));
    const duration = 480 * distance; // Reversals cover only the distance still to travel.
    if (duration < 1) { settle(open); return; }
    phase = open ? 'opening' : 'closing'; tooltip.dataset.motion = phase;
    const generation = revision;
    motion = rows.map((row, i) => row.fill.animate([
      { transform: `scaleX(${scales[i]})` }, { transform: `scaleX(${open ? 1 : 0})` }
    ], { duration, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }));
    motion.push(tooltip.animate([
      { opacity: tooltip.style.opacity, transform: tooltip.style.transform },
      { opacity: open ? 1 : 0, transform: `translateY(${open ? 0 : 3}px)` }
    ], { duration: Math.min(160, duration), delay: open ? 0 : Math.max(0, duration - 160), easing: 'ease-out', fill: 'both' }));
    Promise.all(motion.map(animation => animation.finished)).then(() => {
      if (revision === generation) settle(open);
    }).catch(() => {}); // Interrupted motion is cancelled, never queued or replayed.
  }
  const motionChanged = () => { settle(phase === 'opening' || phase === 'open'); render(); };
  reducedMotion.addEventListener('change', motionChanged);
  const escape = event => { if (event.key === 'Escape') hide(); };
  document.addEventListener('keydown', escape);
  document.body.append(ring, tooltip);
  const show = () => {
    if (ring.style.display === 'none') return;
    tooltip.hidden = false; render();
    if (phase === 'opening' || phase === 'open') return;
    animateTo(true);
  };
  const hide = () => { settle(false); }; // Escape, clicking and teardown dismiss immediately.
  const close = hide; // Hover/focus leave has no ending animation (latest user preference).
  const leave = () => { if (!interaction?.contains(document.activeElement)) close(); };
  const blur = () => { if (!interaction?.matches(':hover')) close(); };
  function unbind() {
    if (!target) return;
    interaction.removeEventListener('mouseenter', show); interaction.removeEventListener('mouseleave', leave);
    interaction.removeEventListener('focusin', show); interaction.removeEventListener('focusout', blur);
    interaction.removeEventListener('pointerdown', hide);
    if (interaction.getAttribute('aria-describedby') === [previousDescription, tooltip.id].filter(Boolean).join(' ')) {
      previousDescription === null ? interaction.removeAttribute('aria-describedby') : interaction.setAttribute('aria-describedby', previousDescription);
    }
    target = null; interaction = null; hide();
  }
  function position() {
    let found; try { found = [...document.querySelectorAll(selector)].filter(el => {
      const r = el.getBoundingClientRect();
      return el.isConnected && r.width >= 16 && r.width <= 80 && r.height >= 16 && r.height <= 80 &&
        getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
    }); } catch { found = []; }
    // A precise unique selector is required. Ambiguous or changed markup hides the ring.
    if (found.length !== 1 || document.hidden) { unbind(); ring.style.display = 'none'; return; }
    if (target !== found[0]) {
      unbind(); target = found[0]; interaction = target.closest('button,[role="button"]') ?? target;
      previousDescription = interaction.getAttribute('aria-describedby');
      interaction.setAttribute('aria-describedby', [previousDescription, tooltip.id].filter(Boolean).join(' '));
      interaction.addEventListener('mouseenter', show); interaction.addEventListener('mouseleave', leave);
      interaction.addEventListener('focusin', show); interaction.addEventListener('focusout', blur);
      interaction.addEventListener('pointerdown', hide);
    }
    const r = target.getBoundingClientRect();
    // The anchor is the avatar itself, not the larger account menu button.
    const diameter = Math.max(r.width, r.height) + 8;
    const left = r.left + r.width / 2 - diameter / 2;
    const top = r.top + r.height / 2 - diameter / 2;
    Object.assign(ring.style, { display: 'block', width: `${diameter}px`, height: `${diameter}px`, left: `${left}px`, top: `${top}px` });
    if (!tooltip.hidden) {
      tooltip.style.left = `${Math.max(8, Math.min(left + diameter + 12, innerWidth - tooltip.offsetWidth - 8))}px`;
      tooltip.style.top = `${Math.max(8, Math.min(top, innerHeight - tooltip.offsetHeight - 8))}px`;
    }
  }
  function render() {
    const stale = !Number.isFinite(value.updatedAt) || Date.now() - value.updatedAt > 150000;
    const expired = Number.isFinite(value.resetsAt) && value.resetsAt * 1000 <= Date.now();
    const percent = !stale && !expired && Number.isFinite(value.percent) ? Math.max(0, Math.min(100, value.percent)) : null;
    track.setAttribute('stroke', percent === null ? '#9ba19a55' : `color-mix(in srgb, ${accent} 24%, transparent)`);
    arc.setAttribute('stroke', percent === null ? '#9ba19a' : accent);
    arc.setAttribute('stroke-dasharray', `${percent ?? 0} 100`);
    const dark = document.documentElement.getAttribute('data-theme') === 'dark' || document.documentElement.classList.contains('dark') ||
      getComputedStyle(document.documentElement).colorScheme === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') && !document.documentElement.classList.contains('light') && matchMedia('(prefers-color-scheme:dark)').matches);
    tooltip.style.background = `var(--color-surface-elevated-secondary,${dark ? '#292929' : '#fff'})`;
    tooltip.style.color = `var(--color-text-primary,${dark ? '#f4f5ef' : '#272a24'})`;
    tooltip.style.border = `1px solid ${dark ? '#ffffff18' : '#00000012'}`;
    remaining.number.textContent = percent === null ? '暂不可用' : `${Math.round(percent)}%`;
    for (const row of rows) row.fill.style.transition = reducedMotion.matches ? 'none' : 'width 400ms cubic-bezier(.22,1,.36,1)';
    remaining.fill.style.width = `${percent ?? 0}%`;
    remaining.fill.style.background = arc.getAttribute('stroke');
    remaining.meter.setAttribute('aria-label', value.label);
    remaining.meter.setAttribute('aria-valuetext', percent === null ? '额度暂不可用' : `剩余 ${Math.round(percent)}%`);
    percent === null ? remaining.meter.removeAttribute('aria-valuenow') : remaining.meter.setAttribute('aria-valuenow', String(percent));
    const seconds = Number.isFinite(value.resetsAt) ? Math.max(0, Math.ceil(value.resetsAt - Date.now() / 1000)) : null;
    const duration = value.windowDurationMins;
    const timeKnown = !stale && !expired && seconds !== null && Number.isFinite(duration) && duration > 0;
    const timePercent = timeKnown ? Math.max(0, Math.min(100, seconds / (duration * 60) * 100)) : null;
    const days = Math.floor((seconds ?? 0) / 86400), hours = Math.floor(((seconds ?? 0) % 86400) / 3600), minutes = Math.floor(((seconds ?? 0) % 3600) / 60);
    const countdown = timeKnown ? (days ? `${days}天 ${hours}小时` : hours ? `${hours}小时 ${minutes}分` : `${minutes}分 ${(seconds ?? 0) % 60}秒`) : (stale || expired ? '等待刷新' : '暂不可用');
    reset.number.textContent = countdown;
    reset.fill.style.width = `${timePercent ?? 0}%`;
    reset.fill.style.background = 'color-mix(in srgb,currentColor 35%,transparent)';
    reset.meter.setAttribute('aria-label', '距额度重置的剩余时间，按当前额度窗口长度比例');
    reset.meter.setAttribute('aria-valuetext', countdown);
    timePercent === null ? reset.meter.removeAttribute('aria-valuenow') : reset.meter.setAttribute('aria-valuenow', String(timePercent));
    tooltip.setAttribute('aria-label', `${value.label}；剩余 ${remaining.number.textContent}；距重置 ${countdown}。下条表示剩余时间占额度窗口长度的比例，不是额度。`);
    ring.dataset.percent = percent === null ? '' : String(percent);
    ring.dataset.state = percent === null ? 'unavailable' : 'ready';
    renderCredits(stale);
    position();
  }
  const timer = setInterval(render, 250);
  window[KEY] = {
    update(next) { value = { percent: next.percent, label: next.label, updatedAt: next.updatedAt, resetsAt: next.resetsAt, windowDurationMins: next.windowDurationMins, resetCredits: next.resetCredits }; render(); },
    status() { return { placed: ring.style.display !== 'none', percent: ring.dataset.percent, state: ring.dataset.state, updatedAt: value.updatedAt, label: value.label }; },
    destroy() { clearInterval(timer); cancelMotion(); reducedMotion.removeEventListener('change', motionChanged); document.removeEventListener('keydown', escape); unbind(); ring.remove(); tooltip.remove(); delete window[KEY]; }
  };
  render();
}
