/* =========================================================
   SlotVTG — Hero Pipeline Animation
   ---------------------------------------------------------
   A looping canvas animation that visualizes the FULL
   SlotVTG video temporal grounding pipeline:

      video filmstrip + natural-language query
         │
         ▼  (per-frame)
      Slot Adapter:  tokens → slot attention → reconstruction
         │
         ▼
      LLM decoder  (LoRA-tuned layers)
         │
         ▼
      [ t_start, t_end ]   generated as text

   Slot↔entity mapping is intentionally NOT labeled here —
   the four slots emerge from data + DINOv2 objectness priors.

   Author: SlotVTG team (CVPR 2026)
   ========================================================= */

(function () {
  'use strict';

  const canvas = document.getElementById('slot-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Logical (CSS) dimensions used by all drawing math
  const W = 1200;
  const H = 600;

  // Make canvas crisp on hi-dpi screens
  function setupHiDPI() {
    const cssW = canvas.clientWidth;
    const cssH = cssW * (H / W);
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // also fit logical drawing to css size
    ctx.scale(cssW / W, cssW / W);
  }

  // =====================================================
  // Palette
  // =====================================================
  const SLOT = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#a78bfa'];

  // =====================================================
  // Scenes — each defines:
  //   - background colors
  //   - drawScene(ctx,x,y,w,h)
  //   - tokenSlot(c,r): the GT slot for cell (c,r) — used to color tokens
  //   - query string + GT answer (the output timestamp the LLM will produce)
  //   - videoDuration
  // The PAGE never claims slot 1 = person; the GT here is only used to make
  // the visualization look semantically coherent.
  // =====================================================
  const SCENES = [
    {
      bgTop: '#fde2d4', bgBot: '#f9c19c',
      query: 'During which time does the person play a phone?',
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
        if ((c === 2 || c === 3) && r === 5) return 2; // phone
        if (c >= 1 && c <= 3 && r >= 2 && r <= 6) return 1; // person
        if (c >= 5 && c <= 7 && r >= 1 && r <= 4) return 3; // window context
        if (r >= 5) return 3; // floor / sofa
        return 4; // background
      },
    },
    {
      bgTop: '#a0d8ef', bgBot: '#dfecf5',
      query: 'During which time does the person throw a javelin?',
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

  // =====================================================
  // Layout zones
  // =====================================================
  const T_FRAMES = 8;
  const FILMSTRIP = { y: 28, frameW: 96, frameH: 56, gap: 10 };
  FILMSTRIP.width = T_FRAMES * FILMSTRIP.frameW + (T_FRAMES - 1) * FILMSTRIP.gap;
  FILMSTRIP.x = (W - FILMSTRIP.width) / 2;

  function filmFrameRect(i) {
    return {
      x: FILMSTRIP.x + i * (FILMSTRIP.frameW + FILMSTRIP.gap),
      y: FILMSTRIP.y,
      w: FILMSTRIP.frameW,
      h: FILMSTRIP.frameH,
    };
  }

  // Main row
  const MAIN_Y = 160;
  const MAIN_H = 250;
  const ZOOM = { x: 30,  y: MAIN_Y, w: 250, h: MAIN_H };
  const ORBS = { x: 320, y: MAIN_Y, w: 220, h: MAIN_H };
  const RECN = { x: 580, y: MAIN_Y, w: 240, h: MAIN_H };
  const LLM  = { x: 870, y: MAIN_Y, w: 290, h: MAIN_H };

  // Output strip
  const OUT_Y = 450, OUT_H = 80;

  // Token grid in zoom area
  const G = 8;
  function tokenRect(idx) {
    const c = idx % G;
    const r = Math.floor(idx / G);
    const cw = ZOOM.w / G;
    const ch = ZOOM.h / G;
    return { x: ZOOM.x + c * cw, y: ZOOM.y + r * ch, w: cw, h: ch, c, r };
  }

  // Slot orb positions
  function slotCenter(i) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cw = ORBS.w / 2;
    const ch = ORBS.h / 2;
    return { x: ORBS.x + cw * col + cw / 2, y: ORBS.y + ch * row + ch / 2, r: 26 };
  }

  function reconSlotRect(k) {
    const col = k % 2;
    const row = Math.floor(k / 2);
    const cw = RECN.w / 2 - 6;
    const ch = RECN.h / 2 - 6;
    return { x: RECN.x + col * (cw + 12), y: RECN.y + row * (ch + 12), w: cw, h: ch };
  }

  // =====================================================
  // Phases
  // =====================================================
  const PHASES = [
    { name: 'video',     dur: 2200 }, // 0: filmstrip + query appear
    { name: 'zoom',      dur: 1400 }, // 1: middle frame zooms into main area
    { name: 'tokenize',  dur: 1700 }, // 2: 8x8 tokens appear
    { name: 'compete',   dur: 3400 }, // 3: slot attention iterations  (key step — slower)
    { name: 'assign',    dur: 1600 }, // 4: tokens settle to dominant slot
    { name: 'recon',     dur: 2400 }, // 5: 4-panel reconstruction lights up
    { name: 'broadcast', dur: 2100 }, // 6: the per-frame adapter applies to ALL frames in the strip
    { name: 'decode',    dur: 3600 }, // 7: filmstrip + query feed LLM box, output typewriter (key step — slower)
    { name: 'hold',      dur: 2400 }, // 8: hold final state
  ];
  const TOTAL = PHASES.reduce((s, p) => s + p.dur, 0);

  function phaseAt(t) {
    let acc = 0;
    for (let i = 0; i < PHASES.length; i++) {
      if (t < acc + PHASES[i].dur) {
        return { idx: i, name: PHASES[i].name, local: (t - acc) / PHASES[i].dur, t };
      }
      acc += PHASES[i].dur;
    }
    return { idx: PHASES.length - 1, name: 'hold', local: 1, t };
  }

  // Easing
  const easeOutCubic   = t => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutBack    = t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

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
  function strokeRRect(ctx, x, y, w, h, r = 6) {
    rrect(ctx, x, y, w, h, r);
    ctx.stroke();
  }
  function fillRRect(ctx, x, y, w, h, r = 6) {
    rrect(ctx, x, y, w, h, r);
    ctx.fill();
  }
  function alpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  // Token's slot-assignment softmax. At iter=0 ~uniform, iter=1 concentrated.
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

  // =====================================================
  // Step pills (the 4 labels below the canvas)
  // =====================================================
  // Pills (4): 1=Video+Query, 2=Per-frame slot attn, 3=Reconstruction, 4=LLM→[t_s,t_e]
  const STEP_PHASE = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4 };
  const stepEls = document.querySelectorAll('.slot-steps .step');
  function setActiveStep(phaseIdx) {
    const n = STEP_PHASE[phaseIdx];
    stepEls.forEach(el => el.classList.toggle('active', parseInt(el.dataset.step, 10) === n));
  }

  // =====================================================
  // Drawing routines
  // =====================================================
  const MIDDLE_FRAME = 3; // which filmstrip frame is the "zoomed" one (0-indexed)

  function drawFilmstrip(reveal, broadcastProg, zoomDeparture) {
    const scene = SCENES[sceneIdx];
    for (let i = 0; i < T_FRAMES; i++) {
      const f = filmFrameRect(i);
      // staggered appear
      const localReveal = Math.max(0, Math.min(1, (reveal - i * 0.06) * 2.5));
      if (localReveal <= 0) continue;

      // The middle frame fades while it is being zoomed into the stage
      let frameOpacity = localReveal;
      if (i === MIDDLE_FRAME) frameOpacity *= 1 - zoomDeparture * 0.85;

      ctx.save();
      ctx.globalAlpha = frameOpacity;

      // shadow card
      ctx.shadowColor = 'rgba(10, 14, 39, 0.16)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = '#fff';
      fillRRect(ctx, f.x - 2, f.y - 2, f.w + 4, f.h + 4, 6);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // clipped scene
      ctx.save();
      rrect(ctx, f.x, f.y, f.w, f.h, 4);
      ctx.clip();
      scene.drawScene(ctx, f.x, f.y, f.w, f.h);
      ctx.restore();

      // Highlight ring for the middle frame in phases 0-1
      if (i === MIDDLE_FRAME && zoomDeparture < 0.6) {
        ctx.strokeStyle = alpha('#a78bfa', 0.9);
        ctx.lineWidth = 2.5;
        strokeRRect(ctx, f.x - 3, f.y - 3, f.w + 6, f.h + 6, 7);
        // ring pulse
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
        ctx.strokeStyle = alpha('#a78bfa', 0.35 * pulse);
        ctx.lineWidth = 6;
        strokeRRect(ctx, f.x - 6, f.y - 6, f.w + 12, f.h + 12, 9);
      }

      // Broadcast: per-frame adapter overlay — color the tokens of each frame
      if (broadcastProg > 0) {
        ctx.save();
        rrect(ctx, f.x, f.y, f.w, f.h, 4);
        ctx.clip();
        ctx.globalAlpha = frameOpacity * 0.55 * broadcastProg;
        const cellW = f.w / G;
        const cellH = f.h / G;
        for (let idx = 0; idx < G * G; idx++) {
          const cc = idx % G, rr = Math.floor(idx / G);
          // small per-frame variation
          const variance = (i + cc + rr) % 4;
          const slot = (dominantSlot(idx) + variance * 0.3) | 0;
          ctx.fillStyle = SLOT[Math.min(3, slot)];
          ctx.fillRect(f.x + cc * cellW, f.y + rr * cellH, cellW, cellH);
        }
        ctx.restore();
      }
      ctx.restore();

      // Frame index small label
      ctx.fillStyle = 'rgba(10, 14, 39, 0.35)';
      ctx.font = '600 9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`f${i + 1}`, f.x + f.w / 2, f.y + f.h + 12);
    }

    // "Video → " label on the left
    ctx.fillStyle = 'rgba(10, 14, 39, 0.55)';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('VIDEO INPUT · T=8 SAMPLED FRAMES', FILMSTRIP.x, FILMSTRIP.y - 12);
  }

  function drawQuery(reveal) {
    const scene = SCENES[sceneIdx];
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, reveal));
    ctx.fillStyle = 'rgba(10, 14, 39, 0.55)';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('QUERY', FILMSTRIP.x, 116);
    ctx.fillStyle = 'rgba(10, 14, 39, 0.85)';
    ctx.font = 'italic 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`"${scene.query}"`, W / 2, 132);
    ctx.restore();
  }

  function drawZoomedFrame(opacity, scale) {
    if (opacity <= 0) return;
    const scene = SCENES[sceneIdx];

    // Compute current rect — interpolating from filmstrip frame to ZOOM
    const src = filmFrameRect(MIDDLE_FRAME);
    const cx = src.x + src.w / 2;
    const cy = src.y + src.h / 2;
    const zx = ZOOM.x + ZOOM.w / 2;
    const zy = ZOOM.y + ZOOM.h / 2;

    const lerp = (a, b, t) => a + (b - a) * t;
    const cur = {
      cx: lerp(cx, zx, scale),
      cy: lerp(cy, zy, scale),
      w: lerp(src.w, ZOOM.w, scale),
      h: lerp(src.h, ZOOM.h, scale),
    };

    ctx.save();
    ctx.globalAlpha = opacity;
    // shadow card
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(10, 14, 39, 0.18)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    fillRRect(ctx, cur.cx - cur.w / 2 - 4, cur.cy - cur.h / 2 - 4, cur.w + 8, cur.h + 8, 10);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // clipped scene
    ctx.save();
    rrect(ctx, cur.cx - cur.w / 2, cur.cy - cur.h / 2, cur.w, cur.h, 8);
    ctx.clip();
    scene.drawScene(ctx, cur.cx - cur.w / 2, cur.cy - cur.h / 2, cur.w, cur.h);
    ctx.restore();
    ctx.restore();

    // tiny caption — only when fully zoomed
    if (scale > 0.6) {
      ctx.fillStyle = 'rgba(10, 14, 39, 0.55)';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('FRAME f4 · ZOOM-IN', ZOOM.x, ZOOM.y - 12);
    }
  }

  function drawTokens(appear, iter01, separate) {
    if (appear <= 0) return;
    const cellW = ZOOM.w / G;
    const cellH = ZOOM.h / G;
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
      const tx = t.x + t.w / 2;
      const ty = t.y + t.h / 2;
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

      // outer glow
      const g1 = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, r * 3.4);
      g1.addColorStop(0, alpha(SLOT[k], 0.7));
      g1.addColorStop(1, alpha(SLOT[k], 0));
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r * 3.4, 0, Math.PI * 2);
      ctx.fill();
      // core
      const g2 = ctx.createRadialGradient(c.x - r * 0.4, c.y - r * 0.4, 2, c.x, c.y, r);
      g2.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      g2.addColorStop(0.5, SLOT[k]);
      g2.addColorStop(1, alpha(SLOT[k], 0.85));
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      // label
      ctx.fillStyle = 'rgba(10, 14, 39, 0.55)';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Slot ${k + 1}`, c.x, c.y + r + 18);
    }
    // Caption above area
    ctx.fillStyle = 'rgba(10, 14, 39, 0.55)';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SLOT ATTENTION · K=4', ORBS.x, ORBS.y - 12);
  }

  function drawReconstruction(appear, isFinal) {
    if (appear <= 0) return;
    for (let k = 0; k < 4; k++) {
      const p = reconSlotRect(k);
      ctx.save();
      ctx.globalAlpha = appear;
      // panel bg
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(10, 14, 39, 0.10)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      fillRRect(ctx, p.x - 4, p.y - 4, p.w + 8, p.h + 8, 8);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.fillStyle = '#f5f7ff';
      fillRRect(ctx, p.x, p.y, p.w, p.h, 6);

      // slot tag (top-right)
      ctx.fillStyle = SLOT[k];
      fillRRect(ctx, p.x + p.w - 26, p.y + 5, 20, 16, 4);
      ctx.fillStyle = '#fff';
      ctx.font = '700 10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`S${k + 1}`, p.x + p.w - 16, p.y + 17);

      // mini token grid
      const cw = p.w / G;
      const ch = p.h / G;
      for (let i = 0; i < G * G; i++) {
        const c = i % G, r = Math.floor(i / G);
        const belongs = dominantSlot(i) === k;
        const reveal = Math.max(0, Math.min(1, (appear - (c + r) / 18) * 2));
        if (reveal <= 0) continue;
        ctx.globalAlpha = appear * reveal;
        ctx.fillStyle = belongs ? SLOT[k] : 'rgba(10, 14, 39, 0.05)';
        fillRRect(ctx, p.x + c * cw + 1.5, p.y + r * ch + 1.5, cw - 3, ch - 3, 2);
      }
      ctx.restore();
    }
    // caption
    ctx.fillStyle = 'rgba(10, 14, 39, 0.55)';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('RECONSTRUCTION · ENTITY-AWARE TOKENS', RECN.x, RECN.y - 12);
  }

  function drawLLMBlock(appear, pulse, inputGlow) {
    if (appear <= 0) return;

    // Outer LLM card
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.fillStyle = '#0a0e27';
    ctx.shadowColor = 'rgba(167, 139, 250, ' + (0.25 + 0.45 * pulse) + ')';
    ctx.shadowBlur = 22 + 18 * pulse;
    ctx.shadowOffsetY = 0;
    fillRRect(ctx, LLM.x, LLM.y, LLM.w, LLM.h, 14);
    ctx.shadowBlur = 0;
    // glow tint
    if (pulse > 0) {
      ctx.fillStyle = alpha('#a78bfa', 0.08 * pulse);
      fillRRect(ctx, LLM.x, LLM.y, LLM.w, LLM.h, 14);
    }
    ctx.restore();

    // Transformer-style layer stack
    const padX = 18, padY = 24;
    const layerCount = 8;
    const lh = (LLM.h - padY * 2 - 12) / layerCount;
    for (let i = 0; i < layerCount; i++) {
      const ly = LLM.y + padY + i * lh + 2;
      const isAdapter = i >= 1 && i <= 4; // early layers — Slot Adapter sits here
      ctx.save();
      ctx.globalAlpha = appear;
      // base
      ctx.fillStyle = isAdapter
        ? alpha('#4ecdc4', 0.18 + 0.20 * pulse)
        : alpha('#ffffff', 0.06);
      fillRRect(ctx, LLM.x + padX, ly, LLM.w - padX * 2, lh - 4, 4);
      // animated activation sweep
      const sw = (performance.now() / 18 + i * 35) % (LLM.w - padX * 2);
      const grad = ctx.createLinearGradient(LLM.x + padX, 0, LLM.x + padX + LLM.w - padX * 2, 0);
      grad.addColorStop(Math.max(0, (sw - 40) / (LLM.w - padX * 2)), 'rgba(255,255,255,0)');
      grad.addColorStop(Math.min(1, sw / (LLM.w - padX * 2)), 'rgba(255,255,255,' + (0.18 + 0.25 * pulse) + ')');
      grad.addColorStop(Math.min(1, (sw + 40) / (LLM.w - padX * 2)), 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      fillRRect(ctx, LLM.x + padX, ly, LLM.w - padX * 2, lh - 4, 4);
      ctx.restore();
    }

    // labels
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.font = '700 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LLM DECODER', LLM.x + 14, LLM.y + 18);
    ctx.fillStyle = 'rgba(78, 205, 196, 0.95)';
    ctx.font = '600 10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Slot Adapter · L1–L7', LLM.x + LLM.w - 14, LLM.y + 18);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = '500 10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('+ LoRA (rank 16)', LLM.x + 14, LLM.y + LLM.h - 12);
    ctx.restore();

    // Caption above
    ctx.fillStyle = 'rgba(10, 14, 39, 0.55)';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LLM DECODER (Qwen2.5-VL)', LLM.x, LLM.y - 12);

    // Input feed lines — from filmstrip + query into LLM, with animated dots
    if (inputGlow > 0) {
      drawFeedLines(inputGlow);
    }
  }

  function drawFeedLines(prog) {
    // Lines from the right edge of the filmstrip + query area into the top of LLM
    const targetX = LLM.x + LLM.w / 2;
    const targetY = LLM.y;
    ctx.save();
    ctx.lineWidth = 1.5;
    // From each frame top center to LLM top
    for (let i = 0; i < T_FRAMES; i++) {
      const f = filmFrameRect(i);
      const sx = f.x + f.w / 2;
      const sy = f.y + f.h;
      const cpx = sx;
      const cpy = (sy + targetY) / 2 + 40;
      ctx.strokeStyle = alpha('#a78bfa', 0.25 * prog);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cpx, cpy, targetX, targetY);
      ctx.stroke();
      // animated dot traveling along the curve
      const dotT = ((performance.now() / 1300) + i * 0.07) % 1;
      const pt = quadBezier(sx, sy, cpx, cpy, targetX, targetY, dotT);
      ctx.fillStyle = alpha('#a78bfa', 0.85 * prog);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Query feed line (from center)
    const qx = W / 2, qy = 138;
    ctx.strokeStyle = alpha('#ffd93d', 0.35 * prog);
    ctx.beginPath();
    ctx.moveTo(qx, qy);
    ctx.quadraticCurveTo(qx, (qy + targetY) / 2 + 20, targetX, targetY);
    ctx.stroke();
    ctx.restore();
  }

  function quadBezier(x0, y0, x1, y1, x2, y2, t) {
    const u = 1 - t;
    return {
      x: u * u * x0 + 2 * u * t * x1 + t * t * x2,
      y: u * u * y0 + 2 * u * t * y1 + t * t * y2,
    };
  }

  function drawOutput(progress) {
    if (progress <= 0) return;
    const scene = SCENES[sceneIdx];
    const a = scene.answer;
    // Output box
    ctx.save();
    ctx.globalAlpha = Math.min(1, progress);
    ctx.fillStyle = '#0a0e27';
    ctx.shadowColor = 'rgba(52, 211, 153, 0.35)';
    ctx.shadowBlur = 22;
    fillRRect(ctx, 80, OUT_Y, W - 160, OUT_H, 14);
    ctx.shadowBlur = 0;

    // Header
    ctx.fillStyle = 'rgba(52, 211, 153, 0.95)';
    ctx.font = '700 11px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('▶ AUTOREGRESSIVE OUTPUT', 102, OUT_Y + 22);

    // Build full text and apply typewriter reveal
    // "The relevant window is [9.0s, 14.0s]."
    const prefix = 'The relevant window is ';
    const num = `[${a.start.toFixed(1)}s, ${a.end.toFixed(1)}s]`;
    const full = prefix + num + '.';
    const cutoff = Math.floor(full.length * Math.min(1, progress * 1.4));
    const shown = full.slice(0, cutoff);

    // Render with monospace, highlight the timestamp
    ctx.font = '500 22px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    const startX = 102;
    const baseY = OUT_Y + 56;

    // Draw the prefix (white) and the bracket (cyan)
    let curX = startX;
    for (let i = 0; i < shown.length; i++) {
      const ch = shown[i];
      const isNum = i >= prefix.length && i < prefix.length + num.length;
      ctx.fillStyle = isNum ? '#4ecdc4' : 'rgba(255, 255, 255, 0.92)';
      ctx.fillText(ch, curX, baseY);
      curX += ctx.measureText(ch).width;
    }
    // Blinking caret while still typing
    if (cutoff < full.length) {
      const blink = Math.floor(performance.now() / 250) % 2 === 0;
      if (blink) {
        ctx.fillStyle = '#4ecdc4';
        ctx.fillRect(curX + 2, baseY - 18, 2, 22);
      }
    }
    ctx.restore();
  }

  function drawProgressBar(t) {
    ctx.fillStyle = 'rgba(10, 14, 39, 0.06)';
    fillRRect(ctx, 28, H - 18, W - 56, 4, 2);
    ctx.fillStyle = '#a78bfa';
    fillRRect(ctx, 28, H - 18, ((W - 56) * t) / TOTAL, 4, 2);
  }

  // =====================================================
  // Main loop
  // =====================================================
  let start = performance.now();
  let lastT = 0;
  let lastStep = -1;

  function draw(now) {
    const t = (now - start) % TOTAL;
    if (t < lastT) sceneIdx = (sceneIdx + 1) % SCENES.length;
    lastT = t;

    const ph = phaseAt(t);
    if (ph.idx !== lastStep) {
      setActiveStep(ph.idx);
      lastStep = ph.idx;
    }

    // Phase progress helpers
    const filmReveal =
      ph.idx === 0 ? easeOutCubic(ph.local) :
      1;

    const queryReveal =
      ph.idx === 0 ? Math.max(0, easeOutCubic(Math.max(0, ph.local - 0.4) / 0.6)) :
      1;

    const zoomDeparture =
      ph.idx <= 0 ? 0 :
      ph.idx === 1 ? easeInOutCubic(ph.local) :
      ph.idx <= 5 ? 1 :
      Math.max(0, 1 - easeInOutCubic(Math.min(1, (ph.idx === 6 ? ph.local : 1))));

    const zoomFrameOpacity =
      ph.idx <= 0 ? 0 :
      ph.idx === 1 ? easeOutCubic(ph.local) :
      ph.idx <= 5 ? 1 :
      ph.idx === 6 ? 1 - easeInOutCubic(ph.local) :
      0;

    const zoomFrameScale =
      ph.idx <= 0 ? 0 :
      ph.idx === 1 ? easeInOutCubic(ph.local) :
      ph.idx <= 5 ? 1 :
      ph.idx === 6 ? 1 - easeInOutCubic(ph.local) :
      0;

    const tokensAppear =
      ph.idx <= 1 ? 0 :
      ph.idx === 2 ? easeOutCubic(ph.local) :
      ph.idx <= 5 ? 1 :
      ph.idx === 6 ? 1 - easeOutCubic(ph.local) :
      0;

    const iter01 =
      ph.idx <= 2 ? 0 :
      ph.idx === 3 ? easeInOutCubic(ph.local) :
      1;

    const tokenSeparate =
      ph.idx <= 2 ? 0 :
      ph.idx === 3 ? 0.18 * easeOutCubic(ph.local) :
      ph.idx >= 4 ? 0.18 :
      0;

    const orbsAppear =
      ph.idx <= 2 ? 0 :
      ph.idx === 3 ? easeOutBack(Math.min(1, ph.local * 2)) :
      ph.idx <= 5 ? 1 :
      ph.idx === 6 ? 1 - easeOutCubic(ph.local) :
      0;

    const reconAppear =
      ph.idx <= 4 ? 0 :
      ph.idx === 5 ? easeOutCubic(ph.local) :
      ph.idx === 6 ? 1 - 0.6 * easeOutCubic(ph.local) :
      0.4 * (1 - Math.min(1, (ph.idx - 6) / 2));

    const broadcastProg =
      ph.idx <= 5 ? 0 :
      ph.idx === 6 ? easeOutCubic(ph.local) :
      1;

    const llmAppear =
      ph.idx <= 5 ? 0 :
      ph.idx === 6 ? 0.25 * easeOutCubic(ph.local) :
      ph.idx === 7 ? Math.max(0.25, easeOutCubic(ph.local)) :
      1;

    const llmPulse =
      ph.idx === 7 ? easeInOutCubic(ph.local) :
      ph.idx === 8 ? 1 - 0.4 * ph.local :
      0;

    const inputGlow =
      ph.idx <= 6 ? 0 :
      ph.idx === 7 ? easeOutCubic(Math.min(1, ph.local * 2)) :
      1;

    const outputProg =
      ph.idx <= 6 ? 0 :
      ph.idx === 7 ? Math.max(0, (ph.local - 0.3) / 0.7) :
      1;

    // ---- clear ----
    ctx.clearRect(0, 0, W, H);

    // ---- draw layers in order ----
    drawFilmstrip(filmReveal, broadcastProg, zoomDeparture);
    drawQuery(queryReveal);

    // Zoomed frame (drawn first under tokens)
    if (zoomFrameOpacity > 0) {
      drawZoomedFrame(zoomFrameOpacity, zoomFrameScale);
    }

    // Tokens
    if (tokensAppear > 0) {
      drawTokens(tokensAppear, iter01, tokenSeparate);
    }

    // Attention lines between tokens and orbs (during compete/assign)
    if ((ph.idx === 3 || ph.idx === 4) && orbsAppear > 0.3) {
      drawAttentionLines(iter01, ph.idx);
    }

    // Slot orbs
    if (orbsAppear > 0) drawSlotOrbs(orbsAppear);

    // Reconstruction panels
    if (reconAppear > 0) drawReconstruction(reconAppear, ph.idx >= 5);

    // LLM block + feed lines
    drawLLMBlock(llmAppear, llmPulse, inputGlow);

    // Output text
    if (outputProg > 0) drawOutput(outputProg);

    // Progress
    drawProgressBar(t);

    requestAnimationFrame(draw);
  }

  // =====================================================
  // Bootstrap
  // =====================================================
  function boot() {
    setupHiDPI();
    start = performance.now();
    requestAnimationFrame(draw);
  }
  boot();
  window.addEventListener('resize', () => {
    setupHiDPI();
  });
})();
