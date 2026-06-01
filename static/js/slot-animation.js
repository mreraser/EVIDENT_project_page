/* =========================================================
   SlotVTG — Hero Pipeline Animation  (responsive)
   ---------------------------------------------------------
   Two layouts:
     · DESKTOP (≥768px): horizontal 1200×600 canvas
     · MOBILE  (<768px): vertical   600×1100 canvas

   Both layouts run the same 9-phase pipeline:
     video → zoom → tokenize → compete → assign
     → recon → broadcast → decode → hold

   Slot↔entity mapping is NOT labeled — the four slots
   emerge from training (DINOv2 objectness priors).
   ========================================================= */

(function () {
  'use strict';

  const canvas = document.getElementById('slot-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // ---------------------------------------------------
  // Palette
  // ---------------------------------------------------
  const SLOT = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#a78bfa'];

  // ---------------------------------------------------
  // Layout configs
  // ---------------------------------------------------
  const DESKTOP_LAYOUT = {
    isMobile: false,
    W: 1200, H: 640,
    T_FRAMES: 8,
    PAD: 28,
    FONT_SMALL: 11,   // small captions
    FONT_LABEL: 12,   // section labels
    FONT_BODY:  14,   // query text
    FONT_OUT:   22,   // output text
    FONT_TAG:   10,   // S1/S2/.. tags
    FILM: { y: 32, frameW: 96, frameH: 56, gap: 10 },
    QUERY_Y: 128,
    QUERY_TEXT_Y: 150,
    ZOOM:   { x: 30,  y: 204, w: 250, h: 250 },
    ORBS:   { x: 320, y: 204, w: 220, h: 250 },
    RECN:   { x: 580, y: 204, w: 240, h: 250 },
    // LLM is positioned centrally during the residual/decode phases —
    // it grows from the right-side mini block into a paper-Fig.3 style
    // Decoder stack with a Slot Adapter callout to its right.
    LLM:    { x: 250, y: 194, w: 520, h: 380 },
    LLM_CALLOUT: { w: 160, h: 50, gap: 28 },
    OUT:    { x: 80,  y: 590, w: 1040, h: 0 }, // unused — output rendered inside flow
    PROG_Y: 622,
    orbRadius: 26,
    middleFrame: 3,
    feedFrom: 'top',
  };

  const MOBILE_LAYOUT = {
    isMobile: true,
    W: 600, H: 1320,
    T_FRAMES: 6,
    PAD: 18,
    FONT_SMALL: 16,
    FONT_LABEL: 18,
    FONT_BODY:  20,
    FONT_OUT:   28,
    FONT_TAG:   14,
    FILM: { y: 40, frameW: 80, frameH: 46, gap: 8 },
    QUERY_Y: 138,
    QUERY_TEXT_Y: 168,
    ZOOM:   { x: 150, y: 224, w: 300, h: 250 },
    ORBS:   { x: 70,  y: 530, w: 460, h: 200 },
    RECN:   { x: 70,  y: 800, w: 460, h: 220 },
    LLM:    { x: 30,  y: 720, w: 400, h: 520 }, // taller box for stacked layers; takes over after recon fades
    LLM_CALLOUT: { w: 140, h: 46, gap: 14 },
    OUT:    { x: 30,  y: 1260, w: 540, h: 0 },
    PROG_Y: 1290,
    orbRadius: 34,
    middleFrame: 2,
    feedFrom: 'top',
  };

  // Mobile is too tight to have a separate output box below the LLM;
  // we'll instead render the output text *inside* the LLM block on mobile.
  // (Handled in drawOutput / drawLLMBlock branches below.)

  let L = window.innerWidth < 768 ? MOBILE_LAYOUT : DESKTOP_LAYOUT;

  // ---------------------------------------------------
  // Scenes
  // ---------------------------------------------------
  const SCENES = [
    {
      bgTop: '#fde2d4', bgBot: '#f9c19c',
      query: 'When does the person play a phone?',
      answer: { start: 26.0, end: 29.0, duration: 30.0 },
      drawScene(ctx, x, y, w, h) {
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, this.bgTop); g.addColorStop(1, this.bgBot);
        ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#e3a781'; ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
        ctx.fillStyle = '#a06b4f';
        rrect(ctx, x + w * 0.05, y + h * 0.55, w * 0.55, h * 0.32, 8); ctx.fill();
        ctx.fillStyle = '#ff6b6b';
        rrect(ctx, x + w * 0.18, y + h * 0.35, w * 0.18, h * 0.4, 10); ctx.fill();
        ctx.beginPath();
        ctx.arc(x + w * 0.27, y + h * 0.28, w * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4ecdc4';
        rrect(ctx, x + w * 0.30, y + h * 0.5, w * 0.08, h * 0.06, 3); ctx.fill();
        ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 3;
        strokeRRect(ctx, x + w * 0.66, y + h * 0.18, w * 0.28, h * 0.32, 4);
      },
      tokenSlot(c, r) {
        if ((c === 2 || c === 3) && r === 5) return 2;
        if (c >= 1 && c <= 3 && r >= 2 && r <= 6) return 1;
        if (c >= 5 && c <= 7 && r >= 1 && r <= 4) return 3;
        if (r >= 5) return 3;
        return 4;
      },
    },
    {
      bgTop: '#a0d8ef', bgBot: '#dfecf5',
      query: 'When does the person throw a javelin?',
      answer: { start: 9.0, end: 14.0, duration: 25.0 },
      drawScene(ctx, x, y, w, h) {
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, this.bgTop); g.addColorStop(1, this.bgBot);
        ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255, 217, 61, 0.65)';
        ctx.beginPath(); ctx.arc(x + w * 0.82, y + h * 0.18, w * 0.06, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8aa97a';
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.6); ctx.lineTo(x + w * 0.3, y + h * 0.4);
        ctx.lineTo(x + w * 0.55, y + h * 0.55); ctx.lineTo(x + w * 0.8, y + h * 0.38);
        ctx.lineTo(x + w, y + h * 0.55); ctx.lineTo(x + w, y + h * 0.7);
        ctx.lineTo(x, y + h * 0.7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c9a76d'; ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
        ctx.fillStyle = '#ff6b6b';
        rrect(ctx, x + w * 0.22, y + h * 0.42, w * 0.12, h * 0.3, 8); ctx.fill();
        ctx.beginPath(); ctx.arc(x + w * 0.28, y + h * 0.36, w * 0.05, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#4ecdc4'; ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.36, y + h * 0.4); ctx.lineTo(x + w * 0.6, y + h * 0.3); ctx.stroke();
      },
      tokenSlot(c, r) {
        if (c >= 2 && c <= 3 && r >= 3 && r <= 6) return 1;
        if ((c >= 3 && c <= 4 && r === 3) || (c >= 4 && c <= 5 && r === 2)) return 2;
        if (r >= 5) return 3;
        return 4;
      },
    },
  ];
  let sceneIdx = 0;

  // ---------------------------------------------------
  // Geometry helpers (depend on L)
  // ---------------------------------------------------
  const G = 8; // token grid 8×8

  function filmstripX() {
    const totalW = L.T_FRAMES * L.FILM.frameW + (L.T_FRAMES - 1) * L.FILM.gap;
    return (L.W - totalW) / 2;
  }
  function filmFrameRect(i) {
    return {
      x: filmstripX() + i * (L.FILM.frameW + L.FILM.gap),
      y: L.FILM.y,
      w: L.FILM.frameW,
      h: L.FILM.frameH,
    };
  }
  function tokenRect(idx) {
    const c = idx % G, r = Math.floor(idx / G);
    const cw = L.ZOOM.w / G, ch = L.ZOOM.h / G;
    return { x: L.ZOOM.x + c * cw, y: L.ZOOM.y + r * ch, w: cw, h: ch, c, r };
  }
  function slotCenter(i) {
    const col = i % 2, row = Math.floor(i / 2);
    const cw = L.ORBS.w / 2, ch = L.ORBS.h / 2;
    return { x: L.ORBS.x + cw * col + cw / 2, y: L.ORBS.y + ch * row + ch / 2, r: L.orbRadius };
  }
  function reconSlotRect(k) {
    const col = k % 2, row = Math.floor(k / 2);
    const cw = L.RECN.w / 2 - 6, ch = L.RECN.h / 2 - 6;
    return { x: L.RECN.x + col * (cw + 12), y: L.RECN.y + row * (ch + 12), w: cw, h: ch };
  }

  // ---------------------------------------------------
  // Phases
  // ---------------------------------------------------
  const PHASES = [
    { name: 'video',     dur: 2200 },
    { name: 'zoom',      dur: 1400 },
    { name: 'tokenize',  dur: 1700 },
    { name: 'compete',   dur: 3400 },
    { name: 'assign',    dur: 1600 },
    { name: 'recon',     dur: 2400 },
    { name: 'residual',  dur: 4500 },  // up from 2100 — adapter output is added BACK to tokens (this is the key moment)
    { name: 'decode',    dur: 3200 },
    { name: 'hold',      dur: 2200 },
  ];
  const TOTAL = PHASES.reduce((s, p) => s + p.dur, 0);
  function phaseAt(t) {
    let acc = 0;
    for (let i = 0; i < PHASES.length; i++) {
      if (t < acc + PHASES[i].dur) return { idx: i, name: PHASES[i].name, local: (t - acc) / PHASES[i].dur, t };
      acc += PHASES[i].dur;
    }
    return { idx: PHASES.length - 1, name: 'hold', local: 1, t };
  }

  // Easing
  const easeOutCubic   = t => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutBack    = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  // Drawing helpers
  function rrect(ctx, x, y, w, h, r = 6) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function strokeRRect(ctx, x, y, w, h, r = 6) { rrect(ctx, x, y, w, h, r); ctx.stroke(); }
  function fillRRect(ctx, x, y, w, h, r = 6)   { rrect(ctx, x, y, w, h, r); ctx.fill();   }
  function alpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  // Soft slot assignment
  function softAt(idx, iter01) {
    const c = idx % G, r = Math.floor(idx / G);
    const gt = (SCENES[sceneIdx].tokenSlot(c, r) || 4) - 1;
    const T = 1.4 - 1.2 * iter01;
    const logits = [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const base = k === gt ? 1.8 : 0;
      const noise = 0.35 * Math.sin(0.7 * (c + 1) * (k + 1) + 1.3 * (r + 1));
      logits[k] = (base + noise) / T;
    }
    const m = Math.max(...logits);
    const exps = logits.map(v => Math.exp(v - m));
    const s = exps.reduce((a, b) => a + b, 0);
    return exps.map(v => v / s);
  }
  function dominantSlot(idx) {
    const c = idx % G, r = Math.floor(idx / G);
    return (SCENES[sceneIdx].tokenSlot(c, r) || 4) - 1;
  }
  function tokenColor(probs) {
    let r = 0, g = 0, b = 0;
    for (let k = 0; k < 4; k++) {
      const hex = SLOT[k];
      const n = parseInt(hex.slice(1), 16);
      r += probs[k] * ((n >> 16) & 255);
      g += probs[k] * ((n >> 8) & 255);
      b += probs[k] * (n & 255);
    }
    return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
  }

  // ---------------------------------------------------
  // Step pills (5)
  //   1 = Video & query             (phases 0, 1)
  //   2 = Slot attention            (phases 2, 3, 4)
  //   3 = Reconstruction            (phase 5)
  //   4 = Residual addition         (phase 6)
  //   5 = LLM → [t_s, t_e]          (phases 7, 8)
  // Splitting Reconstruction and Residual makes it obvious that the adapter's
  // output is ADDED to the token stream rather than replacing it.
  // ---------------------------------------------------
  const STEP_PHASE = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 2, 5: 3, 6: 4, 7: 5, 8: 5 };
  const stepEls = document.querySelectorAll('.slot-steps .step');
  function setActiveStep(phaseIdx) {
    const n = STEP_PHASE[phaseIdx];
    stepEls.forEach(el => el.classList.toggle('active', parseInt(el.dataset.step, 10) === n));
  }

  // ---------------------------------------------------
  // Hi-DPI canvas setup
  // ---------------------------------------------------
  function setupHiDPI() {
    // Re-pick layout based on current viewport width
    L = window.innerWidth < 768 ? MOBILE_LAYOUT : DESKTOP_LAYOUT;

    const cssW = canvas.clientWidth;
    const cssH = cssW * (L.H / L.W);
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = L.W * dpr;
    canvas.height = L.H * dpr;
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // also keep our drawing in 0..L.W / 0..L.H regardless of display size
    // (no second scale needed — the DPR transform plus internal coords are enough,
    //  because CSS width 100% scales the bitmap automatically)
  }

  // ---------------------------------------------------
  // Drawing routines (all read from L)
  // ---------------------------------------------------
  function drawFilmstrip(reveal, broadcastProg, zoomDeparture) {
    const scene = SCENES[sceneIdx];
    const midIdx = L.middleFrame;
    for (let i = 0; i < L.T_FRAMES; i++) {
      const f = filmFrameRect(i);
      const localReveal = Math.max(0, Math.min(1, (reveal - i * 0.06) * 2.5));
      if (localReveal <= 0) continue;
      let frameOpacity = localReveal;
      if (i === midIdx) frameOpacity *= 1 - zoomDeparture * 0.85;

      ctx.save();
      ctx.globalAlpha = frameOpacity;
      ctx.shadowColor = 'rgba(10, 14, 39, 0.16)';
      ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
      ctx.fillStyle = '#fff';
      fillRRect(ctx, f.x - 2, f.y - 2, f.w + 4, f.h + 4, 6);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.save();
      rrect(ctx, f.x, f.y, f.w, f.h, 4); ctx.clip();
      scene.drawScene(ctx, f.x, f.y, f.w, f.h);
      ctx.restore();

      if (i === midIdx && zoomDeparture < 0.6) {
        ctx.strokeStyle = alpha('#a78bfa', 0.9);
        ctx.lineWidth = 2.5;
        strokeRRect(ctx, f.x - 3, f.y - 3, f.w + 6, f.h + 6, 7);
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 320);
        ctx.strokeStyle = alpha('#a78bfa', 0.35 * pulse);
        ctx.lineWidth = 6;
        strokeRRect(ctx, f.x - 6, f.y - 6, f.w + 12, f.h + 12, 9);
      }
      if (broadcastProg > 0) {
        ctx.save();
        rrect(ctx, f.x, f.y, f.w, f.h, 4); ctx.clip();
        ctx.globalAlpha = frameOpacity * 0.55 * broadcastProg;
        const cellW = f.w / G, cellH = f.h / G;
        for (let idx = 0; idx < G * G; idx++) {
          const cc = idx % G, rr = Math.floor(idx / G);
          const variance = (i + cc + rr) % 4;
          const slot = Math.min(3, (dominantSlot(idx) + variance * 0.3) | 0);
          ctx.fillStyle = SLOT[slot];
          ctx.fillRect(f.x + cc * cellW, f.y + rr * cellH, cellW, cellH);
        }
        ctx.restore();
      }
      ctx.restore();

      // frame index label
      ctx.fillStyle = 'rgba(10, 14, 39, 0.4)';
      ctx.font = `600 ${L.FONT_SMALL - 2}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`f${i + 1}`, f.x + f.w / 2, f.y + f.h + (L.isMobile ? 18 : 12));
    }

    // top caption
    ctx.fillStyle = 'rgba(10, 14, 39, 0.55)';
    ctx.font = `600 ${L.FONT_LABEL}px Inter, sans-serif`;
    ctx.textAlign = L.isMobile ? 'center' : 'left';
    const txt = L.isMobile ? `VIDEO · T=${L.T_FRAMES} FRAMES` : `VIDEO INPUT · T=${L.T_FRAMES} SAMPLED FRAMES`;
    ctx.fillText(txt, L.isMobile ? L.W / 2 : filmstripX(), L.FILM.y - 14);
  }

  function drawQuery(reveal) {
    if (reveal <= 0) return;
    const scene = SCENES[sceneIdx];
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, reveal));
    ctx.fillStyle = 'rgba(10, 14, 39, 0.55)';
    ctx.font = `600 ${L.FONT_LABEL}px Inter, sans-serif`;
    ctx.textAlign = L.isMobile ? 'center' : 'left';
    ctx.fillText('QUERY', L.isMobile ? L.W / 2 : filmstripX(), L.QUERY_Y);
    ctx.fillStyle = 'rgba(10, 14, 39, 0.85)';
    ctx.font = `italic ${L.FONT_BODY}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`"${scene.query}"`, L.W / 2, L.QUERY_TEXT_Y);
    ctx.restore();
  }

  function drawZoomedFrame(opacity, scale) {
    if (opacity <= 0) return;
    const scene = SCENES[sceneIdx];
    const src = filmFrameRect(L.middleFrame);
    const cx = src.x + src.w / 2, cy = src.y + src.h / 2;
    const zx = L.ZOOM.x + L.ZOOM.w / 2, zy = L.ZOOM.y + L.ZOOM.h / 2;
    const lerp = (a, b, t) => a + (b - a) * t;
    const cur = {
      cx: lerp(cx, zx, scale),
      cy: lerp(cy, zy, scale),
      w: lerp(src.w, L.ZOOM.w, scale),
      h: lerp(src.h, L.ZOOM.h, scale),
    };
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(10, 14, 39, 0.18)';
    ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
    fillRRect(ctx, cur.cx - cur.w / 2 - 4, cur.cy - cur.h / 2 - 4, cur.w + 8, cur.h + 8, 10);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.save();
    rrect(ctx, cur.cx - cur.w / 2, cur.cy - cur.h / 2, cur.w, cur.h, 8);
    ctx.clip();
    scene.drawScene(ctx, cur.cx - cur.w / 2, cur.cy - cur.h / 2, cur.w, cur.h);
    ctx.restore();
    ctx.restore();
    if (scale > 0.6) {
      ctx.fillStyle = 'rgba(10, 14, 39, 0.55)';
      ctx.font = `600 ${L.FONT_LABEL}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(L.isMobile ? `FRAME · ZOOM` : `FRAME f${L.middleFrame + 1} · ZOOM-IN`, L.ZOOM.x, L.ZOOM.y - 14);
    }
  }

  function drawTokens(appear, iter01, separate) {
    if (appear <= 0) return;
    const cellW = L.ZOOM.w / G, cellH = L.ZOOM.h / G;
    for (let i = 0; i < G * G; i++) {
      const t = tokenRect(i);
      const order = (t.c + t.r) / 14;
      const a = Math.max(0, Math.min(1, (appear - order) * 2));
      if (a <= 0) continue;
      const dx = separate * (t.c - 3.5) * 5;
      const dy = separate * (t.r - 3.5) * 5;
      const probs = softAt(i, iter01);
      ctx.save();
      ctx.globalAlpha = a * 0.94;
      ctx.fillStyle = tokenColor(probs);
      fillRRect(ctx, t.x + dx + 2, t.y + dy + 2, cellW - 4, cellH - 4, 3);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      strokeRRect(ctx, t.x + dx + 2, t.y + dy + 2, cellW - 4, cellH - 4, 3);
      ctx.restore();
    }
  }

  function drawAttentionLines(iter01, phIdx) {
    const lineAlpha = phIdx === 3 ? 0.16 * (1 - iter01 * 0.4) : 0.06;
    ctx.save();
    ctx.lineWidth = 1;
    for (let i = 0; i < G * G; i++) {
      const phase = ((performance.now() / 1100) + i * 0.07) % 1;
      if (phase > 0.16) continue;
      const t = tokenRect(i);
      const probs = softAt(i, iter01);
      let dom = 0;
      for (let k = 1; k < 4; k++) if (probs[k] > probs[dom]) dom = k;
      const c = slotCenter(dom);
      const tx = t.x + t.w / 2, ty = t.y + t.h / 2;
      const grad = ctx.createLinearGradient(tx, ty, c.x, c.y);
      grad.addColorStop(0, alpha(SLOT[dom], 0));
      grad.addColorStop(1, alpha(SLOT[dom], lineAlpha));
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSlotOrbs(appear) {
    if (appear <= 0) return;
    for (let k = 0; k < 4; k++) {
      const c = slotCenter(k);
      const pulse = 1 + 0.06 * Math.sin(performance.now() / 360 + k);
      const r = c.r * pulse * Math.min(1, appear);
      const g1 = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, r * 3.4);
      g1.addColorStop(0, alpha(SLOT[k], 0.7));
      g1.addColorStop(1, alpha(SLOT[k], 0));
      ctx.fillStyle = g1;
      ctx.beginPath(); ctx.arc(c.x, c.y, r * 3.4, 0, Math.PI * 2); ctx.fill();
      const g2 = ctx.createRadialGradient(c.x - r * 0.4, c.y - r * 0.4, 2, c.x, c.y, r);
      g2.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      g2.addColorStop(0.5, SLOT[k]);
      g2.addColorStop(1, alpha(SLOT[k], 0.85));
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = 'rgba(10, 14, 39, 0.55)';
      ctx.font = `600 ${L.FONT_LABEL}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`Slot ${k + 1}`, c.x, c.y + r + (L.isMobile ? 24 : 18));
    }
    ctx.fillStyle = 'rgba(10, 14, 39, 0.55)';
    ctx.font = `600 ${L.FONT_LABEL}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('SLOT ATTENTION · K=4', L.ORBS.x, L.ORBS.y - 14);
  }

  function drawReconstruction(appear) {
    if (appear <= 0) return;
    for (let k = 0; k < 4; k++) {
      const p = reconSlotRect(k);
      ctx.save();
      ctx.globalAlpha = appear;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(10, 14, 39, 0.10)';
      ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      fillRRect(ctx, p.x - 4, p.y - 4, p.w + 8, p.h + 8, 8);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.fillStyle = '#f5f7ff';
      fillRRect(ctx, p.x, p.y, p.w, p.h, 6);

      // 1) Token grid — drawn FIRST so the slot tag stays on top of it.
      const cw = p.w / G, ch = p.h / G;
      for (let i = 0; i < G * G; i++) {
        const c = i % G, r = Math.floor(i / G);
        const belongs = dominantSlot(i) === k;
        const reveal = Math.max(0, Math.min(1, (appear - (c + r) / 18) * 2));
        if (reveal <= 0) continue;
        ctx.globalAlpha = appear * reveal;
        ctx.fillStyle = belongs ? SLOT[k] : 'rgba(10, 14, 39, 0.05)';
        fillRRect(ctx, p.x + c * cw + 1.5, p.y + r * ch + 1.5, cw - 3, ch - 3, 2);
      }

      // 2) Slot tag — colored chip with centered white "S1".."S4".
      //    Draw AFTER tokens so it's never occluded. Reset globalAlpha so
      //    the chip stays opaque even while tokens are still revealing.
      ctx.globalAlpha = appear;
      const tagW = L.isMobile ? 32 : 22, tagH = L.isMobile ? 22 : 16;
      const tagX = p.x + p.w - tagW - 6;
      const tagY = p.y + 6;
      // tiny white outline behind the chip so it pops against same-color tokens
      ctx.fillStyle = '#ffffff';
      fillRRect(ctx, tagX - 1.5, tagY - 1.5, tagW + 3, tagH + 3, 5);
      ctx.fillStyle = SLOT[k];
      fillRRect(ctx, tagX, tagY, tagW, tagH, 4);
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${L.FONT_TAG}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`S${k + 1}`, tagX + tagW / 2, tagY + tagH / 2 + 0.5);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(10, 14, 39, 0.55)';
    ctx.font = `600 ${L.FONT_LABEL}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('RECONSTRUCTION · ENTITY-AWARE TOKENS', L.RECN.x, L.RECN.y - 14);
  }

  // -----------------------------------------------------------------
  //  NEW: paper-Fig.3 style LLM Decoder architecture
  //  -----------------------------------------------------------------
  //  Draws:
  //    · a light-blue "LLM Decoder" outer card
  //    · 4 stacked rounded "Decoder Layer" boxes with snowflake (frozen)
  //    · a ⊕ between two adjacent layers (lower portion = "early layers")
  //    · a red "Slot Adapter 🔥" callout to the right with an arrow into ⊕
  //    · token-flow arrows: tokens IN at bottom, OUT at top
  //  -----------------------------------------------------------------
  function drawLLMBlock(appear, pulse, inputGlow, outputProg) {
    if (appear <= 0) return;
    outputProg = outputProg || 0;
    const LX = L.LLM.x, LY = L.LLM.y, LW = L.LLM.w, LH = L.LLM.h;

    // ===== outer "LLM Decoder" card (light blue) =====
    ctx.save();
    ctx.globalAlpha = appear;
    const cardGrad = ctx.createLinearGradient(LX, LY, LX, LY + LH);
    cardGrad.addColorStop(0, 'rgba(199, 210, 254, 0.28)');
    cardGrad.addColorStop(1, 'rgba(199, 210, 254, 0.18)');
    ctx.fillStyle = cardGrad;
    fillRRect(ctx, LX, LY, LW, LH, 14);
    ctx.strokeStyle = 'rgba(124, 142, 245, 0.55)';
    ctx.lineWidth = 1.6;
    rrect(ctx, LX, LY, LW, LH, 14);
    ctx.stroke();

    // "LLM Decoder" label (top-left)
    ctx.fillStyle = 'rgba(10, 14, 39, 0.78)';
    ctx.font = `700 ${L.FONT_LABEL + 2}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('LLM Decoder', LX + 14, LY + 10);
    ctx.restore();

    // ===== inner Decoder Layer stack =====
    const numLayers = L.isMobile ? 4 : 4;
    const titleH = 36;
    const innerTop = LY + titleH;
    const innerBottom = LY + LH - 12;
    const gap = L.isMobile ? 14 : 16;
    const layerH = (innerBottom - innerTop - (numLayers - 1) * gap) / numLayers;
    const layerW = LW - 28;
    const layerX = LX + 14;

    const layerYs = [];
    for (let i = 0; i < numLayers; i++) layerYs.push(innerTop + i * (layerH + gap));

    // ⊕ positions (top-down flow):
    //   – Slot Adapter ⊕ in the TOP gap (between layer 0 and 1) = EARLY layers (L1–L7)
    //   – LoRA ⊕ in the BOTTOM gap (between layer N-2 and N-1) = LATER layers
    const slotPlugIdx = 0;                 // gap BELOW layer 0 (top)
    const loraPlugIdx = numLayers - 2;     // gap BELOW second-to-last layer
    const slotPlugY = layerYs[slotPlugIdx] + layerH + gap / 2;
    const loraPlugY = layerYs[loraPlugIdx] + layerH + gap / 2;
    const plugCx = layerX + (L.isMobile ? 28 : 32);

    // draw each Decoder Layer
    ctx.save();
    ctx.globalAlpha = appear;
    for (let i = 0; i < numLayers; i++) {
      const ly = layerYs[i];
      ctx.fillStyle = 'rgba(167, 178, 250, 0.40)';
      fillRRect(ctx, layerX, ly, layerW, layerH, 10);
      ctx.strokeStyle = 'rgba(124, 142, 245, 0.6)';
      ctx.lineWidth = 1.4;
      rrect(ctx, layerX, ly, layerW, layerH, 10);
      ctx.stroke();
      // snowflake (frozen base model)
      ctx.fillStyle = 'rgba(80, 150, 200, 0.95)';
      ctx.font = `600 ${Math.min(layerH * 0.6, 22)}px "Apple Color Emoji", "Segoe UI Emoji", Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('❄', layerX + 10, ly + layerH / 2);
      // "Decoder Layer" text
      ctx.fillStyle = 'rgba(10, 14, 39, 0.80)';
      ctx.font = `600 ${L.FONT_BODY - 1}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Decoder Layer', layerX + layerW / 2, ly + layerH / 2);
    }
    ctx.restore();

    // ===== Helper: draw a single ⊕ symbol with optional pulse halo =====
    const drawPlug = (cx, cy, accentHex) => {
      const plugPulse = 1 + 0.15 * Math.sin(performance.now() / 260) * pulse;
      const plugR = 13 * plugPulse;
      ctx.save();
      ctx.globalAlpha = appear;
      if (pulse > 0) {
        const halo = ctx.createRadialGradient(cx, cy, plugR * 0.4, cx, cy, plugR * 3);
        halo.addColorStop(0, alpha(accentHex, 0.55 * pulse));
        halo.addColorStop(1, alpha(accentHex, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, plugR * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#0a0e27';
      ctx.beginPath();
      ctx.arc(cx, cy, plugR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = accentHex;
      ctx.font = `700 ${plugR * 1.3}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⊕', cx, cy);
      ctx.restore();
      return plugR;
    };

    const slotPlugR = drawPlug(plugCx, slotPlugY, '#4ecdc4');
    const loraPlugR = drawPlug(plugCx, loraPlugY, '#fbbf24');

    // ===== Helper: draw a callout box on the RIGHT + L-shaped arrow → ⊕ =====
    const cw = L.LLM_CALLOUT.w, ch = L.LLM_CALLOUT.h, cgap = L.LLM_CALLOUT.gap;
    const drawCallout = (label, accentBorder, accentFillLight, accentFillDark, plugY, plugR) => {
      const callX = LX + LW + cgap;
      const callY = plugY - ch / 2;

      ctx.save();
      ctx.globalAlpha = appear;
      const callGrad = ctx.createLinearGradient(callX, callY, callX, callY + ch);
      callGrad.addColorStop(0, accentFillLight);
      callGrad.addColorStop(1, accentFillDark);
      ctx.fillStyle = callGrad;
      fillRRect(ctx, callX, callY, cw, ch, 10);
      ctx.strokeStyle = accentBorder;
      ctx.lineWidth = 1.8;
      rrect(ctx, callX, callY, cw, ch, 10);
      ctx.stroke();

      // label + fire emoji
      ctx.fillStyle = 'rgba(10, 14, 39, 0.90)';
      ctx.font = `700 ${L.FONT_LABEL + 1}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, callX + 12, callY + ch / 2);
      ctx.font = `${L.FONT_LABEL + 4}px "Apple Color Emoji", "Segoe UI Emoji", Inter, sans-serif`;
      ctx.fillText('🔥', callX + cw - 30, callY + ch / 2 + 1);

      // L-shaped arrow: callout left edge → into LLM at inner right channel → down/up → ⊕
      const arrowFromX = callX;
      const arrowFromY = callY + ch / 2;
      const arrowToX = plugCx + plugR + 4;
      const arrowToY = plugY;
      ctx.strokeStyle = accentBorder;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(arrowFromX, arrowFromY);
      ctx.lineTo(LX + LW - 14, arrowFromY);
      ctx.lineTo(LX + LW - 14, arrowToY);
      ctx.lineTo(arrowToX, arrowToY);
      ctx.stroke();
      // arrowhead at ⊕
      ctx.fillStyle = accentBorder;
      ctx.beginPath();
      ctx.moveTo(arrowToX, arrowToY);
      ctx.lineTo(arrowToX + 7, arrowToY - 5);
      ctx.lineTo(arrowToX + 7, arrowToY + 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    // Slot Adapter callout (RED, paper Fig.3 style) at TOP plug
    drawCallout(
      'Slot Adapter',
      'rgba(220, 38, 38, 0.90)',
      'rgba(252, 165, 165, 0.55)',
      'rgba(252, 165, 165, 0.36)',
      slotPlugY, slotPlugR
    );
    // LoRA callout (AMBER/YELLOW, paper Fig.3 style) at BOTTOM plug
    drawCallout(
      'LoRA',
      'rgba(217, 119, 6, 0.90)',
      'rgba(253, 224, 71, 0.55)',
      'rgba(253, 224, 71, 0.40)',
      loraPlugY, loraPlugR
    );

    // ===== Token-flow arrows: IN (TOP, ↓ pointing down) and OUT (BOTTOM, ↓ pointing down) =====
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.strokeStyle = 'rgba(124, 142, 245, 0.85)';
    ctx.lineWidth = 2.4;
    const flowX = layerX + layerW / 2;

    // INPUT arrow at the TOP — points DOWN into the first Decoder Layer
    ctx.beginPath();
    ctx.moveTo(flowX, LY - 18);
    ctx.lineTo(flowX, innerTop - 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(124, 142, 245, 0.95)';
    ctx.beginPath();
    ctx.moveTo(flowX, innerTop - 2);
    ctx.lineTo(flowX - 6, innerTop - 10);
    ctx.lineTo(flowX + 6, innerTop - 10);
    ctx.closePath();
    ctx.fill();

    // OUTPUT arrow at the BOTTOM — points DOWN out of the last Decoder Layer
    ctx.beginPath();
    ctx.moveTo(flowX, innerBottom + 2);
    ctx.lineTo(flowX, LY + LH + 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(flowX, LY + LH + 18);
    ctx.lineTo(flowX - 6, LY + LH + 10);
    ctx.lineTo(flowX + 6, LY + LH + 10);
    ctx.closePath();
    ctx.fill();

    // "tokens" label at TOP next to input arrow
    ctx.fillStyle = 'rgba(10, 14, 39, 0.55)';
    ctx.font = `600 ${L.FONT_SMALL}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('tokens', flowX + 12, LY - 18);

    // "[t_s, t_e]" / typewriter timestamp label at BOTTOM next to output arrow
    let outLabel = '[t_s, t_e]';
    if (outputProg > 0) {
      const a = SCENES[sceneIdx].answer;
      const full = `[${a.start.toFixed(1)}s, ${a.end.toFixed(1)}s]`;
      const cutoff = Math.floor(full.length * Math.min(1, outputProg * 1.5));
      outLabel = full.slice(0, cutoff);
      if (cutoff < full.length && Math.floor(performance.now() / 280) % 2 === 0) {
        outLabel += '▌';
      }
    }
    ctx.fillStyle = outputProg > 0 ? '#4ecdc4' : 'rgba(52, 211, 153, 0.95)';
    ctx.font = `700 ${L.FONT_SMALL + 2}px JetBrains Mono, monospace`;
    ctx.fillText(outLabel, flowX + 12, LY + LH + 22);
    ctx.restore();

    // ===== animated token dot flowing DOWN through the layer stack during decode =====
    if (inputGlow > 0) {
      ctx.save();
      ctx.globalAlpha = appear * Math.min(1, inputGlow);
      const cycle = (performance.now() / 2400) % 1;
      // Travel from above the LLM down to below the LLM (top-down flow)
      const startY = LY - 14;
      const endY = LY + LH + 16;
      const ty = startY + (endY - startY) * cycle;
      ctx.fillStyle = alpha('#a78bfa', 0.95);
      ctx.beginPath();
      ctx.arc(flowX + 12, ty, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ----------------------------------------------------------------
  //  R E S I D U A L   V I S U A L I Z A T I O N
  //  ----------------------------------------------------------------
  //  The Slot Adapter is inserted INSIDE the LLM decoder layers and adds
  //  RESIDUALLY to the per-layer token activations:
  //      x  ←  x  +  Adapter(x)
  //  Without an explicit indicator the recon tokens look like they REPLACE
  //  the input — which is wrong. So this function paints:
  //    1. A large pulsing ⊕ symbol at the visual "addition point"
  //    2. A rotating dashed ring + halo to signal "this is where + happens"
  //    3. The literal equation "x ← x + Adapter(x)" beneath
  //    4. Cubic bezier curves routed THROUGH the ⊕ centre — animated dots
  //       travel from recon panels UP through ⊕ to the filmstrip frames,
  //       i.e. "adapter output is added back into the token stream".
  //  ----------------------------------------------------------------

  function residualBadgeCenter() {
    // Place the badge in the area that becomes empty during the residual
    // phase (where zoom/orbs faded out). On desktop that's the left-center
    // of the main row; on mobile it's the vertical mid-point of the canvas.
    if (L.isMobile) {
      return { x: L.W / 2, y: 520 };
    }
    return { x: 250, y: 320 };
  }

  function cubicBezierPt(x0, y0, x1, y1, x2, y2, x3, y3, t) {
    const u = 1 - t;
    return {
      x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    };
  }

  function drawBigResidualBadge(progress) {
    // Disabled — residual ⊕ is now drawn INSIDE the LLM Decoder architecture
    // by drawLLMBlock() (paper-Fig.3 style). Keeping the function definition
    // as a no-op so phase wiring elsewhere can still call it harmlessly.
    return;
    /* old badge body kept commented for reference --
    if (progress <= 0) return;
    const c = residualBadgeCenter();
    const base = L.isMobile ? 78 : 64;
    const pulse = 1 + 0.08 * Math.sin(performance.now() / 380);
    const size = base * pulse;

    ctx.save();
    ctx.globalAlpha = progress;

    // Glow halo
    const haloR = size * 1.9;
    const halo = ctx.createRadialGradient(c.x, c.y, size * 0.3, c.x, c.y, haloR);
    halo.addColorStop(0, 'rgba(78, 205, 196, 0.30)');
    halo.addColorStop(0.55, 'rgba(78, 205, 196, 0.10)');
    halo.addColorStop(1, 'rgba(78, 205, 196, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(c.x, c.y, haloR, 0, Math.PI * 2);
    ctx.fill();

    // Outer rotating dashed ring (signals "this is an active operator")
    ctx.strokeStyle = alpha('#4ecdc4', 0.45);
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 7]);
    ctx.lineDashOffset = -performance.now() / 55;
    ctx.beginPath();
    ctx.arc(c.x, c.y, size * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Solid inner ring
    ctx.strokeStyle = alpha('#4ecdc4', 0.65);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, size * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    // The big ⊕ glyph
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#4ecdc4';
    ctx.font = `700 ${Math.round(base * 1.05)}px Inter, sans-serif`;
    ctx.fillText('⊕', c.x, c.y + 1);

    // "RESIDUAL ADDITION" headline above
    ctx.font = `800 ${L.FONT_LABEL + 4}px Inter, sans-serif`;
    ctx.fillStyle = '#0a0e27';
    ctx.fillText('RESIDUAL ADDITION', c.x, c.y - base * 1.05);

    // subtitle — explicit explanation
    ctx.font = `600 ${L.FONT_SMALL}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(10, 14, 39, 0.55)';
    ctx.fillText('inside each LLM decoder layer (L1–L7)', c.x, c.y - base * 0.78);

    // Equation below — explicit architectural form (skip + adapter = output)
    ctx.font = `700 ${L.FONT_BODY + 1}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(10, 14, 39, 0.88)';
    ctx.fillText('Layer input  +  Slot Adapter output  =  Layer output', c.x, c.y + base * 1.0);

    // (Side annotations removed — the SKIP/ADAPTER path arrows below now
    //  carry explicit labels so the two converging streams are unambiguous.)

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
    */
  }

  function drawResidualFlow(progress) {
    // Disabled — replaced by the architectural diagram inside drawLLMBlock.
    return;
    /* old flow body kept commented for reference --
    if (progress <= 0) return;

    const badge = residualBadgeCenter();

    // Filmstrip centroid (the layer input)
    const filmTotalW = L.T_FRAMES * L.FILM.frameW + (L.T_FRAMES - 1) * L.FILM.gap;
    const filmCenterX = filmstripX() + filmTotalW / 2;
    const filmBottomY = L.FILM.y + L.FILM.frameH;

    // ============================================================
    // (1) SKIP CONNECTION — dashed purple curve from filmstrip → ⊕
    //     Visualizes the IDENTITY / BASE path: the layer's input
    //     tokens bypass the slot adapter and arrive at ⊕ unchanged.
    //     This is the "+" path in the residual block (Fig. 3 in paper).
    // ============================================================
    ctx.save();
    ctx.globalAlpha = progress;
    ctx.strokeStyle = alpha('#a78bfa', 0.72);
    ctx.lineWidth = 2.2;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -performance.now() / 80; // slow march to convey "flowing"

    const skipStartX = filmCenterX - (L.isMobile ? 70 : 110);
    const skipStartY = filmBottomY + 4;
    const skipEndX   = badge.x - 38;
    const skipEndY   = badge.y - 8;

    ctx.beginPath();
    ctx.moveTo(skipStartX, skipStartY);
    if (L.isMobile) {
      ctx.bezierCurveTo(
        skipStartX - 50, skipStartY + 140,
        badge.x - 130, badge.y - 90,
        skipEndX, skipEndY
      );
    } else {
      ctx.bezierCurveTo(
        skipStartX - 130, skipStartY + 60,
        badge.x - 95, badge.y - 80,
        skipEndX, skipEndY
      );
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // arrowhead at ⊕ entrance (pointing toward badge)
    ctx.fillStyle = alpha('#a78bfa', 0.95);
    ctx.beginPath();
    ctx.moveTo(skipEndX + 5, skipEndY + 1);
    ctx.lineTo(skipEndX - 7, skipEndY - 6);
    ctx.lineTo(skipEndX - 5, skipEndY + 6);
    ctx.closePath();
    ctx.fill();

    // SKIP label, placed beside the curve where it's not obscured
    ctx.font = `800 ${L.FONT_SMALL + 1}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(167, 139, 250, 0.98)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const skipLabelX = L.isMobile ? skipStartX - 40 : skipStartX - 90;
    const skipLabelY = L.isMobile ? skipStartY + 130 : skipStartY + 80;
    ctx.fillText('SKIP', skipLabelX, skipLabelY);
    ctx.fillStyle = 'rgba(167, 139, 250, 0.72)';
    ctx.font = `500 ${L.FONT_SMALL - 1}px Inter, sans-serif`;
    ctx.fillText('(layer input, identity)', skipLabelX, skipLabelY + 16);

    ctx.textBaseline = 'alphabetic';
    ctx.restore();

    // ============================================================
    // (2) ADAPTER PATH — existing cubic-bezier curves from recon
    //     panels UP through ⊕ to filmstrip frames. Animated dots
    //     convey the flow direction (adapter output → addition point).
    // ============================================================
    ctx.save();
    ctx.globalAlpha = progress;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < L.T_FRAMES; i++) {
      const f = filmFrameRect(i);
      const k = i % 4;
      const panel = reconSlotRect(k);
      const sx = panel.x + panel.w / 2;
      const sy = panel.y;
      const ex = f.x + f.w / 2;
      const ey = f.y + f.h + 3;
      const cp1x = (sx + badge.x) / 2;
      const cp1y = badge.y + 30;
      const cp2x = (ex + badge.x) / 2;
      const cp2y = badge.y - 30;

      const grad = ctx.createLinearGradient(sx, sy, ex, ey);
      grad.addColorStop(0.00, alpha(SLOT[k], 0));
      grad.addColorStop(0.40, alpha(SLOT[k], 0.35 * progress));
      grad.addColorStop(0.55, alpha('#4ecdc4', 0.55 * progress));
      grad.addColorStop(0.70, alpha(SLOT[k], 0.35 * progress));
      grad.addColorStop(1.00, alpha(SLOT[k], 0.20 * progress));
      ctx.strokeStyle = grad;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey);
      ctx.stroke();

      const dotT = ((performance.now() / 2200) + i * 0.10) % 1;
      const t = 1 - dotT;
      const pt = cubicBezierPt(sx, sy, cp1x, cp1y, cp2x, cp2y, ex, ey, t);
      ctx.fillStyle = alpha(SLOT[k], 0.9 * progress);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Adapter path label — placed between badge and recon panels
    ctx.save();
    ctx.globalAlpha = progress;
    ctx.font = `800 ${L.FONT_SMALL + 1}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(78, 205, 196, 0.98)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const reconCx = L.RECN.x + L.RECN.w / 2;
    const adapterLabelX = L.isMobile ? badge.x + 110 : (badge.x + reconCx) / 2 + 10;
    const adapterLabelY = L.isMobile ? badge.y + 130 : badge.y + 75;
    ctx.fillText('via SLOT ADAPTER', adapterLabelX, adapterLabelY);
    ctx.fillStyle = 'rgba(78, 205, 196, 0.72)';
    ctx.font = `500 ${L.FONT_SMALL - 1}px Inter, sans-serif`;
    ctx.fillText('(entity-aware delta)', adapterLabelX, adapterLabelY + 16);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();

    // ============================================================
    // (3) Big ⊕ badge — visual anchor on top of the two paths
    // ============================================================
    drawBigResidualBadge(progress);
    */
  }

  function drawFeedLines(prog) {
    const targetX = L.LLM.x + L.LLM.w / 2;
    const targetY = L.LLM.y;
    ctx.save();
    ctx.lineWidth = 1.5;
    for (let i = 0; i < L.T_FRAMES; i++) {
      const f = filmFrameRect(i);
      const sx = f.x + f.w / 2;
      const sy = f.y + f.h;
      // On mobile the LLM is much farther below, so we use a single big curve
      const cpx = sx;
      const cpy = (sy + targetY) / 2 + (L.isMobile ? 100 : 40);
      ctx.strokeStyle = alpha('#a78bfa', 0.22 * prog);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cpx, cpy, targetX, targetY);
      ctx.stroke();
      const dotT = ((performance.now() / 1300) + i * 0.07) % 1;
      const pt = quadBezier(sx, sy, cpx, cpy, targetX, targetY, dotT);
      ctx.fillStyle = alpha('#a78bfa', 0.85 * prog);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Query feed line
    const qx = L.W / 2, qy = L.QUERY_TEXT_Y + 8;
    ctx.strokeStyle = alpha('#ffd93d', 0.35 * prog);
    ctx.beginPath();
    ctx.moveTo(qx, qy);
    ctx.quadraticCurveTo(qx, (qy + targetY) / 2 + 20, targetX, targetY);
    ctx.stroke();
    ctx.restore();
  }
  function quadBezier(x0, y0, x1, y1, x2, y2, t) {
    const u = 1 - t;
    return { x: u * u * x0 + 2 * u * t * x1 + t * t * x2, y: u * u * y0 + 2 * u * t * y1 + t * t * y2 };
  }

  function drawOutput(progress) {
    if (progress <= 0) return;
    const scene = SCENES[sceneIdx];
    const a = scene.answer;

    if (L.isMobile) {
      // On mobile we render the output text INSIDE the bottom of the LLM block
      const box = { x: L.LLM.x + 16, y: L.LLM.y + L.LLM.h - 54, w: L.LLM.w - 32, h: 42 };
      ctx.save();
      ctx.globalAlpha = Math.min(1, progress);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      fillRRect(ctx, box.x, box.y, box.w, box.h, 8);

      const prefix = '▶ ';
      const num = `[${a.start.toFixed(1)}s, ${a.end.toFixed(1)}s]`;
      const full = prefix + num;
      const cutoff = Math.floor(full.length * Math.min(1, progress * 1.4));
      const shown = full.slice(0, cutoff);

      ctx.font = `600 ${L.FONT_OUT - 2}px JetBrains Mono, monospace`;
      ctx.textAlign = 'left';
      let cur = box.x + 12;
      const baseY = box.y + box.h / 2 + 9;
      for (let i = 0; i < shown.length; i++) {
        const ch = shown[i];
        const isNum = i >= prefix.length;
        ctx.fillStyle = isNum ? '#4ecdc4' : 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(ch, cur, baseY);
        cur += ctx.measureText(ch).width;
      }
      if (cutoff < full.length) {
        const blink = Math.floor(performance.now() / 250) % 2 === 0;
        if (blink) {
          ctx.fillStyle = '#4ecdc4';
          ctx.fillRect(cur + 2, baseY - 18, 2, 22);
        }
      }
      ctx.restore();
      return;
    }

    // Desktop: dedicated bottom box
    ctx.save();
    ctx.globalAlpha = Math.min(1, progress);
    ctx.fillStyle = '#0a0e27';
    ctx.shadowColor = 'rgba(52, 211, 153, 0.35)';
    ctx.shadowBlur = 22;
    fillRRect(ctx, L.OUT.x, L.OUT.y, L.OUT.w, L.OUT.h, 14);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(52, 211, 153, 0.95)';
    ctx.font = `700 ${L.FONT_SMALL}px JetBrains Mono, monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('▶ AUTOREGRESSIVE OUTPUT', L.OUT.x + 22, L.OUT.y + 22);

    const prefix = 'The relevant window is ';
    const num = `[${a.start.toFixed(1)}s, ${a.end.toFixed(1)}s]`;
    const full = prefix + num + '.';
    const cutoff = Math.floor(full.length * Math.min(1, progress * 1.4));
    const shown = full.slice(0, cutoff);

    ctx.font = `500 ${L.FONT_OUT}px JetBrains Mono, monospace`;
    ctx.textAlign = 'left';
    let cur = L.OUT.x + 22;
    const baseY = L.OUT.y + 56;
    for (let i = 0; i < shown.length; i++) {
      const ch = shown[i];
      const isNum = i >= prefix.length && i < prefix.length + num.length;
      ctx.fillStyle = isNum ? '#4ecdc4' : 'rgba(255, 255, 255, 0.92)';
      ctx.fillText(ch, cur, baseY);
      cur += ctx.measureText(ch).width;
    }
    if (cutoff < full.length) {
      const blink = Math.floor(performance.now() / 250) % 2 === 0;
      if (blink) {
        ctx.fillStyle = '#4ecdc4';
        ctx.fillRect(cur + 2, baseY - 18, 2, 22);
      }
    }
    ctx.restore();
  }

  function drawProgressBar(t) {
    const x = L.PAD;
    const w = L.W - L.PAD * 2;
    ctx.fillStyle = 'rgba(10, 14, 39, 0.06)';
    fillRRect(ctx, x, L.PROG_Y, w, 4, 2);
    ctx.fillStyle = '#a78bfa';
    fillRRect(ctx, x, L.PROG_Y, (w * t) / TOTAL, 4, 2);
  }

  // ---------------------------------------------------
  // Main loop
  // ---------------------------------------------------
  let start = performance.now();
  let lastT = 0;
  let lastStep = -1;

  function draw(now) {
    const t = (now - start) % TOTAL;
    if (t < lastT) sceneIdx = (sceneIdx + 1) % SCENES.length;
    lastT = t;
    const ph = phaseAt(t);
    if (ph.idx !== lastStep) { setActiveStep(ph.idx); lastStep = ph.idx; }

    const filmReveal     = ph.idx === 0 ? easeOutCubic(ph.local) : 1;
    const queryReveal    = ph.idx === 0 ? Math.max(0, easeOutCubic(Math.max(0, ph.local - 0.4) / 0.6)) : 1;
    // Zoom / tokens / orbs fade out QUICKLY at the start of phase 6 so the
    // ⊕ residual badge dominates the visual field — it's the centerpiece.
    const fadeFast = ph.idx === 6 ? Math.min(1, ph.local * 3) : 0; // hits 1 at ph.local≈0.33
    const zoomDeparture  = ph.idx <= 0 ? 0 : ph.idx === 1 ? easeInOutCubic(ph.local) : ph.idx <= 5 ? 1 : Math.max(0, 1 - easeInOutCubic(Math.min(1, ph.idx === 6 ? ph.local : 1)));
    const zoomOpacity    = ph.idx <= 0 ? 0 : ph.idx === 1 ? easeOutCubic(ph.local) : ph.idx <= 5 ? 1 : ph.idx === 6 ? Math.max(0, 1 - easeOutCubic(fadeFast)) : 0;
    const zoomScale      = ph.idx <= 0 ? 0 : ph.idx === 1 ? easeInOutCubic(ph.local) : ph.idx <= 5 ? 1 : ph.idx === 6 ? Math.max(0, 1 - easeOutCubic(fadeFast)) : 0;
    const tokensAppear   = ph.idx <= 1 ? 0 : ph.idx === 2 ? easeOutCubic(ph.local) : ph.idx <= 5 ? 1 : ph.idx === 6 ? Math.max(0, 1 - easeOutCubic(fadeFast)) : 0;
    const iter01         = ph.idx <= 2 ? 0 : ph.idx === 3 ? easeInOutCubic(ph.local) : 1;
    const tokenSeparate  = ph.idx <= 2 ? 0 : ph.idx === 3 ? 0.18 * easeOutCubic(ph.local) : ph.idx >= 4 ? 0.18 : 0;
    const orbsAppear     = ph.idx <= 2 ? 0 : ph.idx === 3 ? easeOutBack(Math.min(1, ph.local * 2)) : ph.idx <= 5 ? 1 : ph.idx === 6 ? Math.max(0, 1 - easeOutCubic(fadeFast)) : 0;
    // Reconstruction panels fade OUT very FAST at the start of phase 6
    // (done by ~33% of the phase) so the LLM Decoder diagram has the stage.
    const reconAppear    = ph.idx <= 4 ? 0
                        : ph.idx === 5 ? easeOutCubic(ph.local)
                        : ph.idx === 6 ? Math.max(0, 1 - easeOutCubic(Math.min(1, ph.local * 3)))
                        : 0;
    const broadcastProg  = ph.idx <= 5 ? 0 : ph.idx === 6 ? easeOutCubic(ph.local) : 1;
    // residualFlow / drawBigResidualBadge are now no-ops; keep var for safety.
    const residualFlow   = 0;
    // LLM Decoder architecture appears during phase 6 — slightly delayed
    // so it grows in AFTER the recon panels have started fading, avoiding
    // visual overlap (especially noticeable on mobile).
    const llmAppear      = ph.idx <= 5 ? 0
                        : ph.idx === 6 ? easeOutCubic(Math.max(0, Math.min(1, (ph.local - 0.2) * 1.55)))
                        : 1;
    const llmPulse       = ph.idx === 6 ? easeOutCubic(ph.local)
                        : ph.idx === 7 ? Math.max(0.45, 1 - 0.5 * ph.local)
                        : ph.idx === 8 ? Math.max(0, 0.45 - 0.45 * ph.local)
                        : 0;
    const inputGlow      = ph.idx <= 6 ? 0
                        : ph.idx === 7 ? easeOutCubic(Math.min(1, ph.local * 1.5))
                        : 1;
    const outputProg     = ph.idx <= 6 ? 0 : ph.idx === 7 ? Math.max(0, (ph.local - 0.3) / 0.7) : 1;

    ctx.clearRect(0, 0, L.W, L.H);

    drawFilmstrip(filmReveal, broadcastProg, zoomDeparture);
    drawQuery(queryReveal);
    if (zoomOpacity > 0) drawZoomedFrame(zoomOpacity, zoomScale);
    if (tokensAppear > 0) drawTokens(tokensAppear, iter01, tokenSeparate);
    if ((ph.idx === 3 || ph.idx === 4) && orbsAppear > 0.3) drawAttentionLines(iter01, ph.idx);
    if (orbsAppear > 0) drawSlotOrbs(orbsAppear);
    if (reconAppear > 0) drawReconstruction(reconAppear);
    // (residual flow is no-op now — the architectural ⊕ lives inside LLM)
    drawLLMBlock(llmAppear, llmPulse, inputGlow, outputProg);
    // (drawOutput disabled — output text rendered inline at top of LLM diagram)
    drawProgressBar(t);

    requestAnimationFrame(draw);
  }

  // ---------------------------------------------------
  // Bootstrap + resize handling
  // ---------------------------------------------------
  function boot() {
    // Set initial canvas dimension attributes based on layout
    L = window.innerWidth < 768 ? MOBILE_LAYOUT : DESKTOP_LAYOUT;
    canvas.setAttribute('width',  L.W);
    canvas.setAttribute('height', L.H);
    setupHiDPI();
    start = performance.now();
    requestAnimationFrame(draw);
  }
  boot();

  // Debounced resize handler: switch layouts when crossing breakpoint
  let rzTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(() => {
      const newLayout = window.innerWidth < 768 ? MOBILE_LAYOUT : DESKTOP_LAYOUT;
      const swapped = newLayout !== L;
      L = newLayout;
      // Always re-do HiDPI to fit new CSS width / DPR
      canvas.setAttribute('width',  L.W);
      canvas.setAttribute('height', L.H);
      setupHiDPI();
      // No need to restart animation; loop reads L on next frame
    }, 150);
  });

})();
