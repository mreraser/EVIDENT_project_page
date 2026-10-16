/* =========================================================
   EVIDENT: decoupling -> re-coupling (rebuttal Fig. 2(c))
   Layer-wise increase in ground-truth-frame attention after fine-tuning,
   ID (Cha.) vs OOD (QVH), Qwen2.5-VL-7B. Redrawn from the rebuttal figure
   and animated: the naive baseline (dashed) draws first and the gap between
   its ID and OOD curves is shaded; then the solid curves morph from the
   baseline into EVIDENT, and the shaded gap narrows: re-coupling.
   Numbers: fig2c_rebuttal_bs_and_evid.pdf (vector paths).
   ========================================================= */
(function () {
  'use strict';
  const root = document.getElementById('rc-plot');
  if (!root) return;
  const fig = root.closest('.recouple');
  const LAYERS = [10, 11, 12, 13, 14, 15, 16, 17, 18];
  const D = {
    base: { id: [0.0007, 0.0089, 0.0203, 0.0213, 0.0302, 0.0333, 0.0353, 0.0516, 0.0370],
            ood: [0.0019, 0.0054, 0.0157, 0.0103, 0.0171, 0.0023, 0.0079, 0.0153, 0.0195] },
    ev:   { id: [0.0032, 0.0057, 0.0148, 0.0233, 0.0313, 0.0237, 0.0435, 0.0258, 0.0335],
            ood: [-0.0015, 0.0068, 0.0023, 0.0079, 0.0100, 0.0118, 0.0271, 0.0275, 0.0381] },
  };
  const YMIN = -0.004, YMAX = 0.056, TOP = 14, BOTTOM = 44, LEFT = 52, RIGHT = 14;
  const NS = 'http://www.w3.org/2000/svg';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  let W = 0, H = 0, svg, L = {}, played = false, lastW = -1;
  const x = (i) => LEFT + i * (W - LEFT - RIGHT) / (LAYERS.length - 1);
  const y = (v) => TOP + (YMAX - v) / (YMAX - YMIN) * (H - TOP - BOTTOM);
  const path = (a) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  function render() {
    W = Math.max(220, Math.round(root.getBoundingClientRect().width));
    H = Math.round(Math.min(420, Math.max(280, W * 0.5)));
    root.innerHTML = '';
    svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img',
      'aria-label': 'Increase in ground-truth-frame attention by layer 10 to 18. Naive fine-tuning: ID peaks at 0.0516, OOD at 0.0195 (37.8% transfer). EVIDENT: ID peaks at 0.0435, OOD at 0.0381 (87.6% transfer).' }, root);
    for (let v = 0; v <= 0.05 + 1e-9; v += 0.01) {
      el('line', { x1: LEFT, x2: W - RIGHT, y1: y(v), y2: y(v), class: v ? 'rc-grid' : 'rc-zero' }, svg);
      el('text', { x: LEFT - 10, y: y(v) + 4, class: 'rc-axis', 'text-anchor': 'end' }, svg).textContent = v.toFixed(2);
    }
    LAYERS.forEach((n, i) => { if (W > 420 || i % 2 === 0) el('text', { x: x(i), y: H - BOTTOM + 22, class: 'rc-axis', 'text-anchor': 'middle' }, svg).textContent = n; });
    el('text', { x: (LEFT + W - RIGHT) / 2, y: H - 4, class: 'rc-axis-t', 'text-anchor': 'middle' }, svg).textContent = 'Layer index';
    L.band = el('path', { class: 'rc-band' }, svg);
    for (const k of ['id', 'ood']) L['base' + k] = el('path', { d: path(D.base[k]), class: `rc-line rc-base rc-${k}` }, svg);
    for (const k of ['id', 'ood']) {
      L['ev' + k] = el('path', { class: `rc-line rc-ev rc-${k}` }, svg);
      L['ev' + k + 'dots'] = D.ev[k].map((v, i) => el('circle', { cx: x(i), cy: y(v), r: 4, class: `rc-dot rc-${k}` }, svg));
    }
    // final state when re-rendered after playing (resize) or with reduced motion
    const done = played || reduce;
    setDrawn(['baseid', 'baseood'], done ? 1 : 0);
    morph(done ? 1 : 0);
    L.band.style.opacity = done ? 1 : 0;
    [L.evid, L.evood].forEach((p) => (p.style.opacity = done ? 1 : 0));
    if (done) showDots();
  }

  // t: 0 = solid curves sit on the baseline, 1 = EVIDENT; the shaded ID-OOD gap follows them
  function morph(t) {
    const at = (k) => D.base[k].map((v, i) => v + (D.ev[k][i] - v) * t);
    const id = at('id'), ood = at('ood');
    L.evid.setAttribute('d', path(id)); L.evood.setAttribute('d', path(ood));
    L.band.setAttribute('d', `${path(id)} ${ood.map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).reverse().join(' ')} Z`);
  }

  // draw (0..1) of each named line via stroke-dashoffset; dashed lines are masked by a clip that grows instead
  function setDrawn(keys, f) {
    keys.forEach((k) => {
      const p = L[k];
      if (k.startsWith('base')) {
        // dashed: reveal with a growing clip so the dash pattern stays intact
        let cp = svg.querySelector(`#rc-clip-${k}`);
        if (!cp) { cp = el('clipPath', { id: `rc-clip-${k}` }, svg); el('rect', { x: 0, y: 0, height: H }, cp); p.setAttribute('clip-path', `url(#rc-clip-${k})`); }
        cp.firstChild.setAttribute('width', LEFT + f * (W - LEFT - RIGHT) + 6);
      }
    });
  }
  const showDots = () => ['evid', 'evood'].forEach((k) => L[k + 'dots'].forEach((d) => (d.style.opacity = 1)));

  function tween(ms, fn) {
    return new Promise((res) => {
      const t0 = performance.now();
      const step = (now) => { const p = Math.min(1, (now - t0) / ms); fn(1 - Math.pow(1 - p, 3)); if (p < 1) requestAnimationFrame(step); else res(); };
      requestAnimationFrame(step);
    });
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function play() {
    played = true;
    await tween(1300, (f) => setDrawn(['baseid', 'baseood'], f));    // baseline: ID climbs, OOD stays low
    await tween(500, (f) => (L.band.style.opacity = f));              // the gap between them: decoupled
    fig.classList.add('s1');
    await wait(1000);
    [L.evid, L.evood].forEach((p) => (p.style.opacity = 1));
    fig.classList.add('s2');                                          // baseline recedes ...
    await wait(250);
    await tween(1700, morph);                                         // ... and the gap narrows: re-coupled
    showDots();
  }

  render();
  lastW = root.clientWidth;
  window.addEventListener('resize', () => { if (root.clientWidth !== lastW) { lastW = root.clientWidth; render(); } });
  if (reduce) { fig.classList.add('s1', 's2'); return; }
  new IntersectionObserver((entries, io) => {
    if (entries[0].isIntersecting) { io.disconnect(); play(); }
  }, { threshold: 0.5 }).observe(root);
})();
