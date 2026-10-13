/* =========================================================
   EVIDENT: pipeline animation (paper-figure style)
   ---------------------------------------------------------
   Visual language follows the paper's figures: Helvetica, white
   background, peach module boxes, red key modules, grey frozen parts,
   green / peach / blue tokens, real frames from the teaser figure.

   Steps
     1 input      frames + timestamps + query
     2 tokens     interleaved sequence enters the decoder from the bottom
     3 slots      EB Adapter (early layers): slot attention compresses patches into 4 slots
     4 distill    DINOv2 objectness (training) makes each slot bind to one entity
     5 gate       E2V gating keeps frames where person AND book appear
     6 output     later layers (LoRA) decode the window -> [84s, 96s]

   Elements carry data-in="k" (visible from step k), data-hl="k,..."
   (highlighted during those steps); the controller only toggles classes.
   ========================================================= */
(function () {
  'use strict';

  const host = document.getElementById('ev-anim');
  if (!host) return;
  const stepList = document.getElementById('ev-steps');

  const NS = 'http://www.w3.org/2000/svg';
  const C = {
    ink: '#111111', sub: '#555555', mute: '#8a8a8a',
    vis: ['#d9ead3', '#6aa84f'], time: ['#fce5cd', '#e69138'], qry: ['#dae3f3', '#4472c4'],
    mod: ['#fbe5d6', '#ed7d31'], key: ['#f8cecc', '#d9262c'], frz: ['#ededed', '#9a9a9a'],
    adapterBg: '#fff7f7', green: '#38a33a', red: '#d9262c',
    slots: ['#93c47d', '#e06666', '#6d9eeb', '#ffd966'],     // person, book, others, others
  };
  const TIMES = ['72s', '78s', '84s', '90s', '96s', '102s'];
  const GATE = [0.12, 0.22, 0.95, 1.0, 0.9, 0.08];
  const EVID = [2, 3, 4];                                     // 84s–96s
  // spotlight: the zones that stay sharp in each step; everything else recedes
  const FOCUS = {
    1: ['query', 'frames', 'timeline'],
    2: ['frames', 'tokens', 'route', 'decoder', 'connector', 'adapter'],
    3: ['adapter', 'frames'],
    4: ['dino', 'adapter', 'entities', 'frames', 'legend'],
    5: ['query', 'adapter', 'gate', 'frames'],
    6: ['decoder', 'connector', 'output', 'timeline', 'result'],
  };
  const DUR = [5500, 7500, 7500, 10500, 7500, 10000];        // ms per step: long enough to read
  const CAPTIONS = [
    'Frames, timestamps and the query are interleaved into one token sequence.',
    'The sequence enters the LLM decoder from the bottom, the early layers.',
    'In the early layers, the EB Adapter’s slot attention compresses each frame’s patches into 4 slots.',
    'Trained with EB Distillation on DINOv2 objectness, each slot binds to one entity.',
    'E2V gating keeps the frames where the person and the book both appear.',
    'The late layers decode the moment: [84s, 96s], matching the ground truth.',
  ];

  // ---------------------------------------------------------------- layouts
  const LAYOUTS = {
    wide: {
      vb: [1200, 730], fs: 17,
      query: { x: 40, y: 18, w: 616, h: 50, lines: 1, fs: 19 },
      legend: { x: 40, y: 556 },
      frames: { x: 40, y: 92, w: 96, h: 84, gap: 8, cols: 6, rowGap: 0 },
      tokens: { x0: 40, x1: 676, y: 240, s: 16 },
      gate: { dy: 46, h: 14 },
      timeline: { x0: 88, x1: 608, y: 392 },
      adapter: { x: 700, y: 100, w: 260, h: 552 },
      panel: { x: 40, y: 298, w: 616, h: 222, cw: 104, fw: 112 },
      decoder: { x: 995, y: 140, w: 175, h: 512 },
      route: 704,
    },
    narrow: {
      vb: [600, 1740], fs: 22,
      query: { x: 16, y: 14, w: 568, h: 92, lines: 2, fs: 24 },
      legend: { x: 16, y: 1010 },
      frames: { x: 16, y: 126, w: 182, h: 150, gap: 11, cols: 3, rowGap: 92 },
      tokens: { x0: 16, x1: 572, y: 650, s: 20 },
      gate: { dy: 56, h: 16 },
      timeline: { x0: 60, x1: 540, y: 806 },
      adapter: { x: 16, y: 1098, w: 300, h: 580 },
      panel: { x: 16, y: 742, w: 568, h: 236, cw: 96, fw: 100 },
      decoder: { x: 350, y: 1170, w: 234, h: 500 },
      route: null,
    },
  };

  // ---------------------------------------------------------------- helpers
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const txt = (s, attrs, parent) => { const t = el('text', attrs, parent); t.textContent = s; return t; };
  const box = (p, x, y, w, h, [fill, stroke], label, fs, extra = {}) => {
    const g = el('g', extra, p);
    el('rect', { x, y, width: w, height: h, rx: 6, fill, stroke, 'stroke-width': 2, class: 'ev-box' }, g);
    if (label) txt(label, { x: x + w / 2, y: y + h / 2 + fs * 0.36, 'text-anchor': 'middle', 'font-size': fs, fill: C.ink }, g);
    return g;
  };
  const trap = (p, x, y, w, h, inset, flip, [fill, stroke], label, fs, extra = {}) => {
    const g = el('g', extra, p);
    const pts = flip
      ? `${x},${y} ${x + w},${y} ${x + w - inset},${y + h} ${x + inset},${y + h}`
      : `${x + inset},${y} ${x + w - inset},${y} ${x + w},${y + h} ${x},${y + h}`;
    el('polygon', { points: pts, fill, stroke, 'stroke-width': 2, class: 'ev-box' }, g);
    txt(label, { x: x + w / 2, y: y + h / 2 + fs * 0.36, 'text-anchor': 'middle', 'font-size': fs, fill: C.ink }, g);
    return g;
  };
  const arrow = (p, d, extra = {}) => el('path', Object.assign({ d, fill: 'none', stroke: C.ink, 'stroke-width': 1.8, 'marker-end': 'url(#ev-arr)' }, extra), p);
  const token = (p, x, y, s, [fill, stroke], extra = {}) =>
    el('rect', Object.assign({ x, y, width: s, height: s, rx: 3, fill, stroke, 'stroke-width': 1.6 }, extra), p);

  // ---------------------------------------------------------------- build
  let svg, steps = 0;

  function build(L) {
    host.innerHTML = '';
    const [VW, VH] = L.vb;
    svg = el('svg', { viewBox: `0 0 ${VW} ${VH}`, role: 'img', class: 'ev-svg',
      'aria-label': 'EVIDENT pipeline: frames and query become tokens; the EB Adapter in the early decoder layers groups patches into entity slots; E2V gating keeps frames where the person and the book appear; the decoder predicts 84 to 96 seconds.' }, host);
    const defs = el('defs', {}, svg);
    const mk = el('marker', { id: 'ev-arr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', fill: C.ink }, mk);
    ['g', 'r'].forEach((k) => {
      const m = el('marker', { id: `ev-arr-${k}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', fill: k === 'g' ? C.green : C.red }, m);
    });

    const fs = L.fs;

    // ---- query bubble (step 1)
    const q = L.query;
    const qg = el('g', { 'data-in': 1, 'data-delay': 0, 'data-zone': 'query' }, svg);
    el('rect', { x: q.x, y: q.y, width: q.w, height: q.h, rx: 12, fill: '#ededed' }, qg);
    const qt = el('text', { x: q.x + q.w / 2, 'text-anchor': 'middle', 'font-size': q.fs, fill: C.ink }, qg);
    const parts = [['During which time does the ', 0], ['person', 1], [' look at a ', 0], ['book', 1], ['?', 0]];
    const addParts = (parent, list) => list.forEach(([str, bold]) => {
      const t = el('tspan', bold ? { 'font-weight': 700 } : {}, parent); t.textContent = str;
    });
    if (q.lines === 1) {
      qt.setAttribute('y', q.y + q.h / 2 + q.fs * 0.36);
      addParts(qt, parts);
    } else {
      qt.setAttribute('y', q.y + q.h / 2 - q.fs * 0.28);
      addParts(qt, [parts[0]]);
      const l2 = el('tspan', { x: q.x + q.w / 2, dy: q.fs * 1.3 }, qt);
      addParts(l2, parts.slice(1));
    }

    // ---- frames (raw -> entity-centric crossfade at step 4)
    const F = L.frames;
    const pos = TIMES.map((_, i) => {
      const c = i % F.cols, r = Math.floor(i / F.cols);
      return { x: F.x + c * (F.w + F.gap), y: F.y + r * (F.h + F.rowGap) };
    });
    const frameGroups = [], gateCells = [];
    TIMES.forEach((tLabel, i) => {
      const { x, y } = pos[i];
      const g = el('g', { class: 'ev-frame', 'data-in': 1, 'data-i': i, 'data-delay': 400 + i * 180, 'data-zone': 'frames' }, svg);
      el('clipPath', { id: `ev-clip-${i}` }, defs).appendChild(el('rect', { x, y, width: F.w, height: F.h, rx: 4 }));
      el('image', { href: `static/figures/anim/raw_${i}.jpg`, x, y, width: F.w, height: F.h, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#ev-clip-${i})` }, g);
      el('image', { href: `static/figures/anim/ent_${i}.jpg`, x, y, width: F.w, height: F.h, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#ev-clip-${i})`, class: 'ev-ent', 'data-in': 4, 'data-delay': 5600 + i * 160 }, g);
      el('rect', { x, y, width: F.w, height: F.h, rx: 4, fill: 'none', stroke: '#cfcfcf', 'stroke-width': 1.2 }, g);
      txt(tLabel, { x: x + F.w / 2, y: y + F.h + fs * 1.25, 'text-anchor': 'middle', 'font-size': fs, fill: C.sub }, g);
      // E2V gating cell under each frame (step 5)
      const gv = GATE[i];
      const gc = el('rect', { x: x + 6, y: y + F.h + L.gate.dy - L.gate.h, width: F.w - 12, height: L.gate.h, rx: 2,
        fill: C.key[1], 'fill-opacity': (0.08 + 0.85 * gv).toFixed(2), stroke: '#c9a3a3', 'stroke-width': 1, 'data-in': 5, 'data-delay': 2500 + i * 130, class: 'ev-gate', 'data-zone': 'gate' }, svg);
      gateCells.push(gc);
      frameGroups.push(g);
    });
    // ---- interleaved token sequence (step 2)
    const T = L.tokens, s = T.s;
    const tg = el('g', { 'data-in': 2, 'data-delay': 1100, 'data-zone': 'tokens' }, svg);
    const seq = [];
    TIMES.forEach(() => { seq.push(C.vis, C.vis, C.time); });
    seq.push(C.qry, C.qry, C.qry);
    const step = (T.x1 - T.x0 - s) / (seq.length - 1);
    seq.forEach((col, k) => token(tg, T.x0 + k * step, T.y, s, col));
    const legendTok = [['visual', C.vis], ['time', C.time], ['query', C.qry]];
    let lx = T.x0;
    const ly = T.y + s + fs * 1.35;
    legendTok.forEach(([name, col]) => {
      token(tg, lx, ly - s * 0.8, s * 0.8, col);
      const t = txt(name, { x: lx + s * 0.8 + 6, y: ly - 1, 'font-size': fs - 3, fill: C.sub }, tg);
      lx += s * 0.8 + 12 + name.length * (fs - 3) * 0.55 + 14;
    });

    // ---- slot legend (step 4)
    const lg = el('g', { 'data-in': 4, 'data-delay': 6200, 'data-zone': 'legend' }, svg);
    let gx = L.legend.x;
    [['Person', [C.slots[0]]], ['Book', [C.slots[1]]], ['Others', [C.slots[2], C.slots[3]]]].forEach(([name, cols]) => {
      cols.forEach((c) => { el('rect', { x: gx, y: L.legend.y - fs * 0.8, width: fs * 0.85, height: fs * 0.85, fill: c, stroke: '#00000022' }, lg); gx += fs * 0.85 + 3; });
      txt(`: ${name}`, { x: gx + 2, y: L.legend.y, 'font-size': fs, fill: C.ink }, lg);
      gx += 12 + (name.length + 2) * fs * 0.55;
    });

    // ---- timeline: ground truth / naive / ours (steps 1, 6)
    const TL = L.timeline;
    const tx = (i) => TL.x0 + i * (TL.x1 - TL.x0) / 5;
    el('line', { x1: TL.x0 - 30, x2: TL.x1 + 30, y1: TL.y, y2: TL.y, stroke: C.ink, 'stroke-width': 1.6, 'marker-end': 'url(#ev-arr)', 'data-in': 1, 'data-delay': 1500, 'data-zone': 'timeline' }, svg);
    TIMES.forEach((tl, i) => {
      el('line', { x1: tx(i), x2: tx(i), y1: TL.y - 5, y2: TL.y + 5, stroke: C.ink, 'stroke-width': 1.4, 'data-in': 1, 'data-delay': 1500, 'data-zone': 'timeline' }, svg);
      if (F.cols !== 6) txt(tl, { x: tx(i), y: TL.y + fs * 1.3, 'text-anchor': 'middle', 'font-size': fs - 2, fill: C.sub, 'data-in': 1, 'data-zone': 'timeline' }, svg);
    });
    const span = (y, i0, i1, col, mk, label, step, labelAbove, delay, zone) => {
      const g = el('g', { 'data-in': step, 'data-delay': delay, class: 'ev-span', 'data-zone': zone }, svg);
      el('line', { x1: tx(i0), x2: tx(i1), y1: y, y2: y, stroke: col, 'stroke-width': 2.4, 'marker-start': `url(#${mk})`, 'marker-end': `url(#${mk})` }, g);
      txt(label, { x: (tx(i0) + tx(i1)) / 2, y: labelAbove ? y - 9 : y + fs * 1.25, 'text-anchor': 'middle', 'font-size': fs, fill: col }, g);
      return g;
    };
    const ny = F.cols === 6 ? 0 : 6;
    span(TL.y - 34 + ny, 2, 4, C.green, 'ev-arr-g', 'Ground-Truth: 84–96s', 1, true, 2000, 'timeline');
    span(TL.y + 40 + ny * 4, 0, 5, C.red, 'ev-arr-r', 'Naïvely fine-tuned: 72–102s', 6, false, 900, 'result').classList.add('ev-faint');
    const oursY = TL.y + 92 + ny * 6;
    span(oursY, 2, 4, C.green, 'ev-arr-g', 'EVIDENT: 84–96s', 6, false, 4900, 'result').classList.add('ev-ours');

    // ---- EB Adapter (paper Fig. 4a, bottom -> top)
    const A = L.adapter;
    const ag = el('g', { 'data-in': 2, 'data-delay': 3300, 'data-zone': 'adapter' }, svg);
    el('rect', { x: A.x, y: A.y, width: A.w, height: A.h, rx: 26, fill: C.adapterBg, stroke: C.red, 'stroke-width': 2.2 }, ag);
    txt('EB Adapter', { x: A.x + A.w / 2, y: A.y + A.h + fs * 1.5, 'text-anchor': 'middle', 'font-size': fs + 1, 'font-weight': 700, fill: C.ink }, ag);
    const bx = A.x + 22, bw = A.w - 44, bh = fs * 2.05;
    const rows = 9, gapY = (A.h - 40 - rows * bh) / (rows - 1);
    const rowY = (k) => A.y + A.h - 20 - bh - k * (bh + gapY);       // k = 0 bottom
    // rows: 0 tokens · 1 Down · 2 LayerNorm · 3 learnable slots · 4 Slot Attention · 5 entity slots · 6 Recon · 7 E2V · 8 Up
    const inG = el('g', {}, ag);
    [C.time, C.qry, C.vis, C.vis, C.vis].forEach((col, k) => token(inG, bx + 8 + k * (fs * 1.4), rowY(0) + bh * 0.25, fs * 1.05, col));
    txt('tokens', { x: bx + bw - 4, y: rowY(0) + bh * 0.62, 'text-anchor': 'end', 'font-size': fs - 2, fill: C.sub }, inG);
    trap(ag, bx, rowY(1), bw, bh, 12, false, C.mod, 'Down Projection', fs, { 'data-hl': '3' });
    box(ag, bx, rowY(2), bw, bh, C.mod, 'LayerNorm', fs, { 'data-hl': '3' });
    const ss = fs * 1.15, sx0 = bx + 10;
    const slotRow = (k, fills, label, extra) => {
      const g = el('g', extra, ag);
      fills.forEach((f, j) => el('rect', { x: sx0 + j * (ss + 4), y: rowY(k) + (bh - ss) / 2, width: ss, height: ss, rx: 3,
        fill: f, stroke: f === '#ffffff' ? '#8a8a8a' : '#00000033', 'stroke-width': 1.4, class: 'ev-slot' }, g));
      txt(label, { x: bx + bw - 4, y: rowY(k) + bh * 0.62, 'text-anchor': 'end', 'font-size': fs - 2, fill: C.sub }, g);
      return g;
    };
    // identical, learnable initial slots: they only become entities through slot attention
    const initSlots = slotRow(3, ['#ffffff', '#ffffff', '#ffffff', '#ffffff'], 'learnable slots', { 'data-hl': '3' });
    // slot attention is trimmed on both sides so its iteration loop fits inside the adapter, on the right
    const saIn = 24, saR = bx + bw - saIn;
    box(ag, bx + saIn, rowY(4), bw - 2 * saIn, bh, C.key, 'Slot Attention', fs, { 'data-hl': '3,4', class: 'ev-sa' });
    // the paper's iteration loop (×I), on the right of slot attention
    const ly0 = rowY(4) + bh * 0.25, ly1 = rowY(4) + bh * 0.75;
    el('path', { d: `M${saR},${ly0} C${saR + 20},${ly0 - 6} ${saR + 20},${ly1 + 6} ${saR + 1},${ly1}`, fill: 'none', stroke: C.ink, 'stroke-width': 1.6, 'marker-end': 'url(#ev-arr)', class: 'ev-loop' }, ag);
    txt('×I', { x: saR + 23, y: rowY(4) + bh * 0.62, 'font-size': fs - 3, fill: C.ink }, ag);
    // entity slots: coloured only after slot attention
    const entSlots = slotRow(5, C.slots, 'entity slots', { 'data-hl': '3,4' });
    // coloured only after the 3 iterations end (~4.0s into the step)
    entSlots.querySelectorAll('.ev-slot').forEach((r, j) => { r.setAttribute('data-in', 3); r.setAttribute('data-delay', 4100 + j * 260); });
    box(ag, bx, rowY(6), bw, bh, C.mod, 'Token Reconstruction', fs - 1, { 'data-hl': '3' });
    box(ag, bx, rowY(7), bw, bh, C.key, 'E2V Gating', fs, { 'data-hl': '5' });
    trap(ag, bx, rowY(8), bw, bh, 12, true, C.mod, 'Up Projection', fs, { 'data-hl': '6' });
    for (let k = 0; k < 8; k++) arrow(ag, `M${bx + bw / 2},${rowY(k)} L${bx + bw / 2},${rowY(k + 1) + bh + 1}`);

    // ---- "one frame, four entity slots" panel (step 4): shown once distillation has bound slots to entities
    const P = L.panel;
    const pg = el('g', { 'data-in': 4, 'data-out': 5, 'data-delay': 2500, 'data-zone': 'entities' }, svg);
    el('rect', { x: P.x, y: P.y, width: P.w, height: P.h, rx: 10, fill: '#ffffff', stroke: '#d6d6d6', 'stroke-width': 1.2 }, pg);
    txt('One frame (90s), split into 4 entity slots', { x: P.x + 16, y: P.y + fs * 1.5, 'font-size': fs, 'font-weight': 700, fill: C.ink }, pg);
    const ch = P.cw * 0.87, py = P.y + fs * 2.4, cards = [];
    el('image', { href: 'static/figures/anim/raw_3.jpg', x: P.x + 16, y: py, width: P.fw, height: P.fw * 0.87, preserveAspectRatio: 'xMidYMid slice' }, pg);
    txt('frame', { x: P.x + 16 + P.fw / 2, y: py + P.fw * 0.87 + fs * 1.2, 'text-anchor': 'middle', 'font-size': fs - 2, fill: C.sub }, pg);
    const cx0 = P.x + 16 + P.fw + 26, cgap = (P.w - 32 - P.fw - 26 - 4 * P.cw) / 3;
    txt('=', { x: P.x + 16 + P.fw + 13, y: py + ch / 2 + fs * 0.4, 'text-anchor': 'middle', 'font-size': fs + 6, fill: C.mute }, pg);
    ['person', 'book', 'other', 'other'].forEach((name, k) => {
      const x = cx0 + k * (P.cw + cgap);
      // empty placeholder until the slot arrives; the slot colour frames the card only once it is filled
      el('rect', { x, y: py, width: P.cw, height: ch, rx: 4, fill: '#f4f4f4', stroke: '#c8c8c8', 'stroke-dasharray': '4 4' }, pg);
      el('rect', { x: x - 2.5, y: py - 2.5, width: P.cw + 5, height: ch + 5, rx: 5, fill: C.slots[k], 'data-in': 4, 'data-delay': 3900 + k * 380 }, pg);
      const im = el('image', { href: `static/figures/anim/slot${k}_3.jpg`, x, y: py, width: P.cw, height: ch, preserveAspectRatio: 'xMidYMid slice', class: 'ev-card', 'data-in': 4, 'data-delay': 3900 + k * 380 }, pg);   // lands with its slot square
      const lab = el('text', { x: x + P.cw / 2, y: py + ch + fs * 1.2, 'text-anchor': 'middle', 'font-size': fs - 2, fill: C.ink }, pg);
      const t1 = el('tspan', { 'font-weight': 700 }, lab); t1.textContent = `slot ${k + 1}`;
      const twoLines = P.cw < 100;                    // phones: "slot 1" over "person"
      const t2 = el('tspan', twoLines ? { fill: C.sub, x: x + P.cw / 2, dy: fs * 1.15 } : { fill: C.sub }, lab);
      t2.textContent = twoLines ? name : ` · ${name}`;
      cards.push({ x: x + P.cw / 2, y: py + ch / 2, im });
    });

    // DINOv2 distillation (training only, step 4): frozen grey box above the adapter
    const dg = el('g', { 'data-in': 4, 'data-delay': 0, class: 'ev-train', 'data-zone': 'dino' }, svg);
    const dh = fs * 1.9, dyTop = A.y - dh - 14;
    box(dg, A.x + 22, dyTop, A.w - 44, dh, C.frz, 'DINOv2 \u2192 EB Distillation', fs - 3);
    const side = A.x + A.w + 14;
    const yJ = rowY(4) - gapY / 2, xJ = saR - 16;
    const dinoPath = el('path', { d: `M${A.x + A.w - 22},${dyTop + dh / 2} L${side},${dyTop + dh / 2} L${side},${yJ} L${xJ},${yJ} L${xJ},${rowY(4) - 2}`,
      fill: 'none', stroke: C.frz[1], 'stroke-width': 1.8, 'stroke-dasharray': '5 5', 'marker-end': 'url(#ev-arr)' }, dg);

    // ---- LLM decoder: early layers at the BOTTOM
    const D = L.decoder;
    const dgp = el('g', { 'data-in': 2, 'data-delay': 1500, 'data-zone': 'decoder' }, svg);
    el('rect', { x: D.x, y: D.y, width: D.w, height: D.h, rx: 14, fill: '#fafafa', stroke: '#bdbdbd', 'stroke-width': 1.6 }, dgp);
    txt('LLM Decoder', { x: D.x + D.w / 2, y: D.y + fs * 1.55, 'text-anchor': 'middle', 'font-size': fs + 1, 'font-weight': 700, fill: C.ink }, dgp);
    const HEAD = fs * 2.3;                      // room for the title inside the box
    const layers = [
      ['Early layers', '+ EB Adapter', C.frz, '3,4,5'],
      ['Late layers', '+ LoRA', C.frz, '6'],
    ];
    const lh = (D.h - HEAD - 3 * 18) / 2;
    layers.forEach(([name, note, col, hl], k) => {
      const y = D.y + D.h - 18 - lh - k * (lh + 18);
      const g = el('g', { 'data-hl': hl }, dgp);
      el('rect', { x: D.x + 14, y, width: D.w - 28, height: lh, rx: 8, fill: col[0], stroke: col[1], 'stroke-width': 2, class: 'ev-box ev-dec' }, g);
      txt(name, { x: D.x + D.w / 2, y: y + lh / 2 - 2, 'text-anchor': 'middle', 'font-size': fs + 1, 'font-weight': 700, fill: C.ink }, g);
      txt(note, { x: D.x + D.w / 2, y: y + lh / 2 + fs * 1.15, 'text-anchor': 'middle', 'font-size': fs - 2, fill: C.sub }, g);
    });
    const yTop = D.y + HEAD + 18, yBot = D.y + D.h - 18;
    arrow(dgp, `M${D.x + D.w / 2},${yTop + lh} L${D.x + D.w / 2},${yTop + lh + 17}`, { 'marker-end': '', 'stroke-width': 1.4 });
    // adapter is attached to the early block
    const connector = el('path', { d: `M${A.x + A.w},${A.y + A.h * 0.62} L${D.x + 14},${yBot - lh / 2}`, fill: 'none', stroke: C.red, 'stroke-width': 1.8, 'stroke-dasharray': '6 5', 'data-in': 2, 'data-delay': 3300, 'data-zone': 'connector' }, svg);
    // output above the decoder
    const og = el('g', { 'data-in': 6, 'data-delay': 2900, class: 'ev-ours', 'data-zone': 'output' }, svg);
    arrow(og, `M${D.x + D.w / 2},${D.y + 4} L${D.x + D.w / 2},${D.y - fs * 2.2}`);
    txt('[84s, 96s]', { x: D.x + D.w / 2, y: D.y - fs * 2.6, 'text-anchor': 'middle', 'font-size': fs + 6, 'font-weight': 700, fill: C.green }, og);

    // ---- token route into the decoder bottom (wide layout only)
    if (L.route) {
      const rx = T.x1 + 4, ry = T.y + s / 2;
      el('path', { d: `M${rx},${ry} L${rx + 6},${ry} L${rx + 6},${L.route} L${D.x + D.w / 2},${L.route} L${D.x + D.w / 2},${D.y + D.h + 2}`,
        fill: 'none', stroke: C.ink, 'stroke-width': 1.8, 'marker-end': 'url(#ev-arr)', class: 'ev-flow', 'data-in': 2, 'data-delay': 1500, id: 'ev-route', 'data-zone': 'route' }, svg);
    } else {
      // narrow: run down the right margin, under the decoder, then up into its bottom
      const ex = L.vb[0] - 6, by = D.y + D.h + 26;
      el('path', { d: `M${T.x1 + 2},${T.y + s / 2} L${ex},${T.y + s / 2} L${ex},${by} L${D.x + D.w / 2},${by} L${D.x + D.w / 2},${D.y + D.h + 2}`,
        fill: 'none', stroke: C.ink, 'stroke-width': 1.8, 'marker-end': 'url(#ev-arr)', class: 'ev-flow', 'data-in': 2, 'data-delay': 1500, id: 'ev-route', 'data-zone': 'route' }, svg);
    }

    svg._frames = frameGroups;
    svg._layout = L;
    // geometry the choreography needs (travellers fly between these)
    svg._R = {
      F, pos, s, T, seqX: (k) => T.x0 + k * step,
      ad: { cx: bx + bw / 2, rowY, bh, inY: rowY(0) + bh * 0.25, sx0, ss }, cards,
      dec: { cx: D.x + D.w / 2, early: yBot - lh / 2, late: yTop + lh / 2, top: D.y, outY: D.y - fs * 2.6 },
      gateCells, dinoPath, connector, route: svg.querySelector('#ev-route'),
      ours: { x: (tx(2) + tx(4)) / 2, y: oursY + fs * 1.25 }, fs,
    };
    svg._ov = el('g', { class: 'ev-overlay' }, svg);          // travellers live on top
  }

  // the step caption sits above the animation (HTML), so it is read before the motion starts
  const capEl = document.getElementById('ev-caption');
  function setCaption(n) {
    if (!capEl) return;
    capEl.classList.remove('show');
    void capEl.offsetWidth;                      // restart the fade
    capEl.querySelector('.ev-cap-num').textContent = n ? n : '';
    capEl.querySelector('.ev-cap-text').textContent = n ? CAPTIONS[n - 1] : '\u00A0';
    capEl.classList.toggle('show', !!n);
  }

  // ---------------------------------------------------------------- controller
  // show(n, animate): put every element into its state for step n. When animating
  // forward, elements that appear in this step wait for their data-delay so they
  // arrive together with the traveller that "delivers" them.
  function show(n, animate) {
    steps = n;
    svg.querySelectorAll('[data-in]').forEach((e) => {
      const on = n >= +e.dataset.in && !(e.dataset.out && n >= +e.dataset.out);
      e.style.transitionDelay = animate && on && +e.dataset.in === n ? `${e.dataset.delay || 0}ms` : '0ms';
      e.classList.toggle('on', on);
    });
    svg.querySelectorAll('[data-hl]').forEach((e) => e.classList.toggle('hl', e.dataset.hl.split(',').includes(String(n))));
    const focus = FOCUS[n] || [];
    svg.classList.toggle('spot', focus.length > 0);
    svg.querySelectorAll('[data-zone]').forEach((e) => e.classList.toggle('focus', focus.includes(e.dataset.zone)));
    svg._frames.forEach((g) => g.classList.toggle('dim', (animate ? n > 5 : n >= 5) && !EVID.includes(+g.dataset.i)));
    setCaption(n);
    if (stepList) stepList.querySelectorAll('button[data-step]').forEach((b) => b.setAttribute('aria-current', +b.dataset.step === n ? 'step' : 'false'));
  }

  // ---- travellers -----------------------------------------------------------
  let gen = 0;                                   // bumps on every jump/reset to cancel running moves
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const wait = (ms, g) => new Promise((res, rej) => setTimeout(() => (g === gen ? res() : rej()), ms));
  function tween(ms, fn, g) {
    return new Promise((res, rej) => {
      const t0 = performance.now();
      const tick = (now) => {
        if (g !== gen) return rej();
        const t = Math.min(1, (now - t0) / ms);
        fn(ease(t), t);
        if (t < 1) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const ov = () => svg._ov;
  // Travellers are always created AT their start point (no frame at the SVG origin) ...
  const dot = (fill, r, x, y) => el('circle', { r, cx: x, cy: y, fill, stroke: '#ffffff', 'stroke-width': 1.5 }, ov());
  const tokSq = (col, size, x, y) => el('rect', { x: x - size / 2, y: y - size / 2, width: size, height: size, rx: 3, fill: col[0], stroke: col[1], 'stroke-width': 1.6 }, ov());
  // a small row of tokens that travels as one unit (cols: [fill, stroke] pairs)
  const packet = (cols, size, x, y) => {
    const g = el('g', {}, ov()), gap = 3, w = cols.length * size + (cols.length - 1) * gap;
    cols.forEach(([fill, stroke], k) => el('rect', { x: -w / 2 + k * (size + gap), y: -size / 2, width: size, height: size, rx: 2.5, fill, stroke, 'stroke-width': 1.4 }, g));
    place(g, x, y);
    return g;
  };
  const place = (e, x, y) => {
    if (e.tagName === 'g') { e.dataset.x = x; e.dataset.y = y; e.setAttribute('transform', `translate(${x} ${y})`); }
    else if (e.tagName === 'circle') { e.setAttribute('cx', x); e.setAttribute('cy', y); }
    else { const w = +e.getAttribute('width'); e.setAttribute('x', x - w / 2); e.setAttribute('y', y - w / 2); }
  };
  // ... only spawned while their step is still current, and removed when a move is cancelled.
  const later = (ms, g, fn) => setTimeout(() => { if (g === gen) fn(); }, ms);
  const drop = (e) => () => e.remove();
  const fadeOut = (e, g, ms = 300) => tween(ms, (t) => e.setAttribute('opacity', 1 - t), g).then(drop(e), drop(e));
  const startOf = (path, reverse) => path.getPointAtLength(reverse ? path.getTotalLength() : 0);
  function along(path, e, ms, g, reverse) {
    const len = path.getTotalLength();
    return tween(ms, (t) => { const p = path.getPointAtLength(len * (reverse ? 1 - t : t)); place(e, p.x, p.y); }, g);
  }
  function fly(e, x0, y0, x1, y1, ms, g, arc = 0) {
    return tween(ms, (t) => place(e, lerp(x0, x1, t), lerp(y0, y1, t) - Math.sin(Math.PI * t) * arc), g);
  }
  const spineX = () => svg._R.ad.cx;                       // packets ride the adapter's arrows
  const rowMid = (k) => svg._R.ad.rowY(k) + svg._R.ad.bh / 2;
  // the tokens in flight: input tokens below slot attention, entity slots above it, tokens again after up projection
  const SLOT_COLS = C.slots.map((f) => [f, '#00000033']);
  const cargo = (k) => (k >= 4 && k < 7 ? SLOT_COLS : [C.vis, C.time, C.qry]);
  // a token packet climbing the adapter's spine from row k0 to row k1 (resolves with it, rejects after removing it)
  function climb(k0, k1, ms, g, d) {
    const R = svg._R;
    d = d || packet(cargo(k0), R.fs * 0.8, spineX(), rowMid(k0));
    return tween(ms, (t) => place(d, spineX(), lerp(rowMid(k0), rowMid(k1), t)), g)
      .then(() => d, (e) => { d.remove(); throw e; });
  }

  // ---- per-step choreography ------------------------------------------------
  const PLAY = {
    // 2: every frame shrinks into its own tokens; tokens ride the arrow into the decoder, then the adapter
    2: async (g) => {
      const R = svg._R;
      R.pos.forEach((p, i) => later(i * 110, g, () => {
        const im = el('image', { href: `static/figures/anim/raw_${i}.jpg`, x: p.x, y: p.y, width: R.F.w, height: R.F.h, preserveAspectRatio: 'xMidYMid slice', opacity: 0.95 }, ov());
        const tx0 = R.seqX(i * 3), tx1 = R.seqX(i * 3 + 2) + R.s;
        tween(1100, (t) => {
          im.setAttribute('x', lerp(p.x, tx0, t)); im.setAttribute('y', lerp(p.y, R.T.y, t));
          im.setAttribute('width', lerp(R.F.w, tx1 - tx0, t)); im.setAttribute('height', lerp(R.F.h, R.s, t));
          im.setAttribute('opacity', 0.95 - 0.75 * t);
        }, g).then(drop(im), drop(im));
      }));
      await wait(1700, g);
      if (!R.route) return;
      const s0 = startOf(R.route);
      const ride = [C.vis, C.vis, C.time, C.qry, C.vis].map((col, k) => new Promise((res) => later(k * 170, g, () => {
        const q = tokSq(col, R.s, s0.x, s0.y);
        along(R.route, q, 1700, g).then(() => fadeOut(q, g), drop(q)).then(res, res);
      })));
      await Promise.all(ride);
      if (g !== gen) return;
      // the decoder hands tokens to the adapter attached to its early layers
      const c0 = startOf(R.connector, true);
      const hand = [C.time, C.qry, C.vis].map((col, k) => new Promise((res) => later(k * 140, g, () => {
        const q = tokSq(col, R.s, c0.x, c0.y);
        along(R.connector, q, 900, g, true)
          .then(() => { const [x, y] = pt(q); return fly(q, x, y, R.ad.cx, R.ad.inY + R.s / 2, 500, g); })
          .then(() => fadeOut(q, g), drop(q)).then(res, res);
      })));
      await Promise.all(hand);
    },
    // 3: tokens climb to slot attention; the identical learnable slots enter it, iterate (×I),
    //    and come out as 4 distinct slots
    3: async (g) => {
      const R = svg._R, ss = R.ad.ss, sx = (j) => R.ad.sx0 + j * (ss + 4) + ss / 2;
      const d = await climb(0, 4, 1600, g);
      fadeOut(d, g);
      // white learnable slots move up into slot attention
      const whites = [0, 1, 2, 3].map((j) => el('rect', { x: sx(j) - ss / 2, y: rowMid(3) - ss / 2, width: ss, height: ss, rx: 3, fill: '#ffffff', stroke: '#8a8a8a', 'stroke-width': 1.4 }, ov()));
      await Promise.all(whites.map((w, j) => fly(w, sx(j), rowMid(3), R.ad.cx - 1.5 * (ss + 4) + j * (ss + 4), rowMid(4), 700, g).catch(drop(w))));
      whites.forEach((w) => w.remove());
      // iterations: the slot-attention box pulses three times
      const sa = svg.querySelector('.ev-sa .ev-box'), saLabel = svg.querySelector('.ev-sa text'), loop = svg.querySelector('.ev-loop');
      for (let it = 1; it <= 3; it++) {
        saLabel.textContent = `Slot Attention · ${it}/3`;
        sa.classList.add('pulse'); loop.classList.add('spin');
        await wait(420, g);
        sa.classList.remove('pulse'); loop.classList.remove('spin');
        await wait(160, g);
      }
      saLabel.textContent = 'Slot Attention';
    },
    // 4: DINOv2 objectness flows into slot attention (training signal); only then does each
    //    slot claim one entity of the frame
    4: async (g) => {
      const R = svg._R, ss = R.ad.ss, sx = (j) => R.ad.sx0 + j * (ss + 4) + ss / 2, s0 = startOf(R.dinoPath);
      for (let r = 0; r < 3; r++) {
        await wait(r ? 250 : 500, g);
        const d = dot(C.frz[1], R.fs * 0.38, s0.x, s0.y);
        along(R.dinoPath, d, 1300, g).then(() => fadeOut(d, g), drop(d));
      }
      // the panel fades in (data-delay 2500ms) as the last DINOv2 signal lands
      await wait(2000, g);
      // each entity slot flies to its card and reveals what it binds to (cards land via data-delay 3900ms)
      R.cards.forEach((c, k) => later(k * 380, g, () => {
        const sq = el('rect', { x: sx(k) - ss / 2, y: rowMid(5) - ss / 2, width: ss, height: ss, rx: 3, fill: C.slots[k], stroke: '#00000033' }, ov());
        fly(sq, sx(k), rowMid(5), c.x, c.y, 900, g, 50)
          .then(() => tween(300, (t) => { const w = ss * (1 + 2.5 * t); sq.setAttribute('width', w); sq.setAttribute('height', w); place(sq, c.x, c.y); sq.setAttribute('opacity', 1 - t); }, g))
          .then(drop(sq), drop(sq));
      }));
    },
    // 5: climb to E2V gating; gate scores fly down to each frame
    5: async (g) => {
      const R = svg._R;
      const d = await climb(4, 7, 1600, g);
      fadeOut(d, g);
      const from = { x: R.ad.cx, y: rowMid(7) };
      R.gateCells.forEach((cell, i) => later(100 + i * 120, g, () => {
        const tx = +cell.getAttribute('x') + +cell.getAttribute('width') / 2, ty = +cell.getAttribute('y') + +cell.getAttribute('height') / 2;
        const p = tokSq([C.red, '#ffffff'], R.fs * 0.72, from.x, from.y);
        p.setAttribute('fill-opacity', (0.25 + 0.75 * GATE[i]).toFixed(2));
        fly(p, from.x, from.y, tx, ty, 900, g, 70).then(() => fadeOut(p, g, 200), drop(p));
      }));
      await wait(3300, g);
      svg._frames.forEach((fg) => fg.classList.toggle('dim', !EVID.includes(+fg.dataset.i)));
    },
    // 6: up projection -> decoder early layers -> late layers -> answer; the answer drops onto the timeline
    6: async (g) => {
      const R = svg._R;
      const d = await climb(7, 8, 700, g);
      try {
        const c0 = startOf(R.connector);
        await fly(d, spineX(), rowMid(8), c0.x, c0.y, 350, g);      // glide to the connector instead of jumping
        await along(R.connector, d, 900, g);
        const [x, y] = pt(d);
        await fly(d, x, y, R.dec.cx, R.dec.late, 800, g);
        await fly(d, R.dec.cx, R.dec.late, R.dec.cx, R.dec.top - 4, 450, g);
      } catch (e) { d.remove(); throw e; }
      fadeOut(d, g);
      await wait(800, g);
      const t = txt('[84s, 96s]', { x: R.dec.cx, y: R.dec.outY, 'text-anchor': 'middle', 'font-size': R.fs + 6, 'font-weight': 700, fill: C.green }, ov());
      await tween(1300, (k) => {
        t.setAttribute('x', lerp(R.dec.cx, R.ours.x, k));
        t.setAttribute('y', lerp(R.dec.outY, R.ours.y, k) - Math.sin(Math.PI * k) * 80);
      }, g).catch((e) => { t.remove(); throw e; });
      fadeOut(t, g, 400);
    },
  };
  const pt = (e) => e.tagName === 'g' ? [+e.dataset.x, +e.dataset.y]
    : e.tagName === 'circle'
    ? [+e.getAttribute('cx'), +e.getAttribute('cy')]
    : [+e.getAttribute('x') + +e.getAttribute('width') / 2, +e.getAttribute('y') + +e.getAttribute('height') / 2];

  function play(n) {
    gen++;
    svg._ov.innerHTML = '';
    // undo transient step-3 state in case an iteration was interrupted
    const saLab = svg.querySelector('.ev-sa text');
    if (saLab) saLab.textContent = 'Slot Attention';
    svg.querySelectorAll('.pulse, .spin').forEach((e) => e.classList.remove('pulse', 'spin'));
    show(n, true);
    if (PLAY[n]) PLAY[n](gen).catch(() => {});
  }

  // ---- timeline ----------------------------------------------------------------
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer = null, visible = true, paused = reduce;
  function schedule() {
    clearTimeout(timer);
    if (paused || !visible) return;
    const wait = steps === 0 ? 900 : DUR[steps - 1];
    timer = setTimeout(() => {
      if (steps >= 6) { gen++; svg._ov.innerHTML = ''; show(0, false); }
      else play(steps + 1);
      schedule();
    }, wait);
  }

  let mode = null;
  function layout() {
    const m = host.clientWidth < 720 ? 'narrow' : 'wide';
    if (m === mode) return;
    mode = m;
    build(LAYOUTS[m]);
    gen++;
    if (reduce) show(6, false); else play(Math.max(1, steps));
  }

  let pauseBtn = null;
  if (stepList) {
    CAPTIONS.forEach((_, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.step = i + 1;
      b.textContent = ['Input', 'Tokens', 'Slot attention', 'Distillation', 'E2V gating', 'Output'][i];
      b.addEventListener('click', () => { play(i + 1); schedule(); });
      li.appendChild(b); stepList.appendChild(li);
    });
    const li = document.createElement('li');
    li.className = 'ev-ctl';
    pauseBtn = document.createElement('button');
    pauseBtn.type = 'button';
    pauseBtn.className = 'ev-pause';
    const sync = () => { pauseBtn.textContent = paused ? '▶ Play' : '❚❚ Pause'; pauseBtn.setAttribute('aria-pressed', String(paused)); };
    pauseBtn.addEventListener('click', () => { paused = !paused; sync(); schedule(); });
    sync();
    li.appendChild(pauseBtn); stepList.appendChild(li);
  }

  layout();
  window.addEventListener('resize', layout);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; schedule(); }, { threshold: 0.2 }).observe(host);
  schedule();
})();
