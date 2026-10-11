/* =========================================================
   EVIDENT: OOD gains, animated grouped bar chart (Results)
   Bars grow from the baseline when the chart scrolls into view;
   the metric toggle morphs them between R1@0.5 and R1@0.7.
   Numbers: paper Table 1 (Qwen2.5-VL-7B + LoRA vs. EVIDENT).
   ========================================================= */
(function () {
  'use strict';
  const root = document.getElementById('gains-plot');
  if (!root) return;

  const GROUPS = [['Cha.', 'QVH'], ['Cha.', 'DiDeMo'], ['QVH', 'Cha.'], ['QVH', 'DiDeMo']];
  const METRICS = [
    { name: 'R1@0.5', ymax: 70, base: [54.3, 53.8, 48.1, 34.1], ours: [59.8, 55.4, 50.2, 36.0] },
    { name: 'R1@0.7', ymax: 40, base: [29.7, 30.3, 26.2, 16.9], ours: [36.9, 32.3, 28.0, 17.4] },
  ];
  const H = 300, TOP = 34, BOTTOM = 52;
  const NS = 'http://www.w3.org/2000/svg';
  const tip = document.getElementById('gains-tip');
  const avgEl = document.getElementById('gains-avg');
  const toggles = document.querySelectorAll('.gains-toggle button');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let metric = 1, ymax = 40, grown = false, axisG = null, LEFT = 34, RIGHT = 8, bars = [], svg = null, W = 0, lastW = -1;
  const el = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const y = (v) => TOP + (1 - v / ymax) * (H - TOP - BOTTOM);
  const base = H - BOTTOM;
  // bar with 4px rounded top, square bottom on the baseline
  const barPath = (x, w, v) => {
    const top = y(v), r = Math.min(4, (base - top) / 2, w / 2);
    return `M${x},${base} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + w - r},${top} Q${x + w},${top} ${x + w},${top + r} L${x + w},${base} Z`;
  };

  function render() {
    W = Math.max(300, Math.round(root.getBoundingClientRect().width));
    root.innerHTML = '';
    svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': ariaText() }, root);
    const gw = (W - LEFT - RIGHT) / GROUPS.length;
    const bw = Math.min(56, gw * 0.3), gap = 2;

    axisG = el('g', {}, svg);
    drawAxis();
    bars = GROUPS.map(([src, tgt], i) => {
      const cx = LEFT + gw * i + gw / 2;
      const g = el('g', { class: 'g-row', tabindex: 0 }, svg);
      el('rect', { x: cx - gw / 2, y: TOP - 20, width: gw, height: H - TOP - BOTTOM + 20, class: 'g-hit' }, g);
      const xb = cx - bw - gap / 2, xo = cx + gap / 2;
      const pb = el('path', { class: 'g-bar g-base' }, g);
      const po = el('path', { class: 'g-bar g-ours' }, g);
      const tb = el('text', { class: 'g-val', 'text-anchor': 'middle' }, g);
      const to = el('text', { class: 'g-val g-val-ours', 'text-anchor': 'middle' }, g);
      const badge = el('g', { class: 'g-badge' }, g);
      el('rect', { rx: 10, height: 22, class: 'g-badge-bg' }, badge);
      const bt = el('text', { class: 'g-badge-t', 'text-anchor': 'middle' }, badge);
      const l1 = el('text', { x: cx, y: base + 20, class: 'g-label', 'text-anchor': 'middle' }, g); l1.textContent = `${src} →`;
      const l2 = el('text', { x: cx, y: base + 38, class: 'g-label', 'text-anchor': 'middle' }, g); l2.textContent = tgt;
      const bar = { i, cx, xb, xo, bw, pb, po, tb, to, badge, bt, vb: 0, vo: 0, g, narrow: gw < 110 };
      bindTip(bar, `${src} → ${tgt}`);
      return bar;
    });
    draw(grown ? 1 : 0, grown ? 1 : 0, 1);
  }

  // gridlines + labels for the current (possibly morphing) y range
  function drawAxis() {
    axisG.innerHTML = '';
    for (let v = 0; v <= ymax + 0.01; v += 10) {
      el('line', { x1: LEFT, x2: W - RIGHT, y1: y(v), y2: y(v), class: v ? 'g-grid' : 'g-base-line' }, axisG);
      const t = el('text', { x: LEFT - 8, y: y(v) + 4, class: 'g-axis', 'text-anchor': 'end' }, axisG); t.textContent = v;
    }
  }

  // place every mark for the current values; k scales bar height (grow-in), badgeOpacity fades the gains
  function draw(kBase, kOurs, badgeOpacity) {
    const m = METRICS[metric];
    bars.forEach((b) => {
      const vb = b.vb = m.base[b.i] * kBase, vo = b.vo = m.ours[b.i] * kOurs;
      b.pb.setAttribute('d', barPath(b.xb, b.bw, Math.max(vb, 0.01)));
      b.po.setAttribute('d', barPath(b.xo, b.bw, Math.max(vo, 0.01)));
      b.tb.setAttribute('x', b.xb + b.bw / 2); b.tb.setAttribute('y', y(vb) - 7);
      b.tb.textContent = kBase > 0.02 && !b.narrow ? vb.toFixed(1) : '';   // phones: keep only EVIDENT's value
      b.to.setAttribute('x', b.xo + b.bw / 2); b.to.setAttribute('y', y(vo) - 7); b.to.textContent = kOurs > 0.02 ? vo.toFixed(1) : '';
      placeBadge(b, vb, vo, m, badgeOpacity);
    });
  }

  // gain badge rides above the taller bar; text comes from metric m
  function placeBadge(b, vb, vo, m, opacity) {
    const d = (m.ours[b.i] - m.base[b.i]).toFixed(1);
    b.bt.textContent = b.narrow ? `+${d}` : `\u25B2 +${d}`;
    const bwid = (b.narrow ? 8 : 22) + d.length * 8 + 14;
    const by = Math.min(y(vo), y(vb)) - 46;
    b.badge.firstChild.setAttribute('x', b.cx - bwid / 2); b.badge.firstChild.setAttribute('y', by); b.badge.firstChild.setAttribute('width', bwid);
    b.bt.setAttribute('x', b.cx); b.bt.setAttribute('y', by + 15.5);
    b.badge.style.opacity = opacity;
  }

  function tween(dur, fn, done) {
    if (reduce) { fn(1); if (done) done(); return; }
    const t0 = performance.now();
    const step = (now) => { const t = Math.min(1, (now - t0) / dur); fn(ease(t)); if (t < 1) requestAnimationFrame(step); else if (done) done(); };
    requestAnimationFrame(step);
  }

  function growIn() {
    grown = true;
    tween(900, (t) => draw(t, 0, 0), () =>
      tween(900, (t) => draw(1, t, 0), () =>
        tween(400, (t) => draw(1, 1, t))));
  }

  function setMetric(k) {
    if (k === metric) return;
    const from = METRICS[metric], to = METRICS[k];
    metric = k;
    toggles.forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.metric === k)));
    setAvg();
    svg.setAttribute('aria-label', ariaText());
    if (!grown) { ymax = to.ymax; drawAxis(); return; }
    // morph: interpolate values and the y range between the two metrics
    const y0 = from.ymax;
    tween(700, (t) => {
      ymax = y0 + (to.ymax - y0) * t;
      drawAxis();
      bars.forEach((b) => {
        const vb = from.base[b.i] + (to.base[b.i] - from.base[b.i]) * t;
        const vo = from.ours[b.i] + (to.ours[b.i] - from.ours[b.i]) * t;
        b.pb.setAttribute('d', barPath(b.xb, b.bw, vb));
        b.po.setAttribute('d', barPath(b.xo, b.bw, vo));
        b.tb.setAttribute('y', y(vb) - 7); b.tb.textContent = b.narrow ? '' : vb.toFixed(1);
        b.to.setAttribute('y', y(vo) - 7); b.to.textContent = vo.toFixed(1);
        // badge follows the bars, fades out, and comes back with the new metric's gain
        placeBadge(b, vb, vo, t < 0.5 ? from : to, Math.abs(t - 0.5) * 2);
      });
    }, () => draw(1, 1, 1));
  }

  const relGain = (k) => METRICS[k].ours.reduce((s, v, i) => s + (v - METRICS[k].base[i]) / METRICS[k].base[i], 0) / GROUPS.length * 100;
  const setAvg = () => {
    avgEl.textContent = `+${avgGain(metric).toFixed(1)}`;
    const rel = document.getElementById('gains-rel');
    if (rel) rel.textContent = `avg. OOD gain (+${Math.round(relGain(metric))}% rel.)`;
  };
  const avgGain = (k) => METRICS[k].ours.reduce((s, v, i) => s + v - METRICS[k].base[i], 0) / GROUPS.length;
  const ariaText = () => `${METRICS[metric].name}: ` + GROUPS.map(([a, b], i) =>
    `${a} to ${b}, LoRA ${METRICS[metric].base[i]}, EVIDENT ${METRICS[metric].ours[i]}`).join('; ');

  function bindTip(b, name) {
    const show = (evt) => {
      const m = METRICS[metric], d = (m.ours[b.i] - m.base[b.i]).toFixed(1);
      tip.innerHTML = `<strong>${name}</strong> &middot; ${m.name}<br>LoRA ${m.base[b.i].toFixed(1)} &rarr; EVIDENT ${m.ours[b.i].toFixed(1)} <span class="tip-d">(+${d})</span>`;
      const box = root.parentElement.getBoundingClientRect();
      const r = evt && evt.clientX !== undefined ? { x: evt.clientX, y: evt.clientY }
        : (() => { const rr = b.g.getBoundingClientRect(); return { x: rr.left + rr.width / 2, y: rr.top + 40 }; })();
      tip.style.left = `${Math.max(8, Math.min(r.x - box.left + 14, box.width - 240))}px`;
      tip.style.top = `${r.y - box.top - 64}px`;
      tip.classList.add('on');
    };
    const hide = () => tip.classList.remove('on');
    b.g.addEventListener('mousemove', show); b.g.addEventListener('mouseleave', hide);
    b.g.addEventListener('focus', () => show()); b.g.addEventListener('blur', hide);
  }

  toggles.forEach((b) => b.addEventListener('click', () => setMetric(+b.dataset.metric)));
  setAvg();
  render();
  lastW = root.clientWidth;
  window.addEventListener('resize', () => { if (root.clientWidth !== lastW) { lastW = root.clientWidth; render(); } });
  new IntersectionObserver((entries, io) => {
    if (entries[0].isIntersecting) { growIn(); io.disconnect(); }
  }, { threshold: 0.35 }).observe(root);
})();
