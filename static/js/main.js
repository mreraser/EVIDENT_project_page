/* =========================================================
   EVIDENT — main interactions
   - Nav scroll state
   - BibTeX copy button
   - Method-stage token grid generators (32 random tokens each side)
   - Procedural slot visualization grid (under "What do slots learn")
   ========================================================= */

(function () {
  'use strict';

  // ---- Nav scroll state ----
  const nav = document.getElementById('topnav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 30);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ---- BibTeX copy ----
  window.copyBibtex = function (btn) {
    const el = document.getElementById('bibtex-block');
    if (!el) return;
    const text = el.innerText;
    navigator.clipboard.writeText(text).then(() => {
      const original = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('copied');
      }, 1600);
    }).catch(() => {
      btn.innerHTML = '<i class="fas fa-exclamation"></i> Failed';
    });
  };

  // ---- Method-stage token grids: 64 small cells with random fade ----
  const SLOT_COLORS = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#a78bfa'];

  function populateGrid(id, mode) {
    const grid = document.getElementById(id);
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < 64; i++) {
      const cell = document.createElement('div');
      if (mode === 'random') {
        // Plain monochrome tokens (the "raw" visual tokens going in)
        cell.style.background = `rgba(255, 255, 255, ${0.12 + 0.18 * Math.random()})`;
      } else if (mode === 'entity') {
        // Entity-aware tokens — colored by deterministic slot map
        const c = i % 8, r = Math.floor(i / 8);
        let slot = 3; // default background
        if (c >= 1 && c <= 3 && r >= 2 && r <= 5) slot = 0; // person
        else if (c === 4 && r === 4) slot = 1; // object
        else if (r >= 5) slot = 2; // context/floor
        cell.style.background = SLOT_COLORS[slot];
        cell.style.opacity = 0.85;
      }
      // small staggered fade-in
      cell.style.animation = `fade-in 0.6s ease-out ${(i % 8) * 0.04 + Math.floor(i / 8) * 0.02}s both`;
      grid.appendChild(cell);
    }
  }
  populateGrid('method-token-grid', 'random');
  populateGrid('method-recon-grid', 'entity');

  // ---- Procedural slot visualization grid (Fig. 4-style) ----
  // For each "scene" row, render:
  //   - the frame
  //   - 4 masks where pixels of slot k are shown, others dimmed
  const VIS_SCENES = {
    indoor: {
      bgTop: '#fde2d4', bgBot: '#f9c19c',
      draw(ctx, x, y, w, h, opts = {}) {
        const mask = opts.mask; // 0..3 or undefined
        const dim = (slot) => (mask === undefined || mask === slot ? 1 : 0.15);
        // bg
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, this.bgTop); g.addColorStop(1, this.bgBot);
        ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
        // sofa (context)
        ctx.globalAlpha = dim(2);
        ctx.fillStyle = '#a06b4f';
        ctx.fillRect(x + w * 0.05, y + h * 0.55, w * 0.55, h * 0.35);
        // floor
        ctx.fillStyle = '#e3a781';
        ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
        // person
        ctx.globalAlpha = dim(0);
        ctx.fillStyle = '#ff6b6b';
        rrect(ctx, x + w * 0.18, y + h * 0.35, w * 0.18, h * 0.4, 8);
        ctx.beginPath(); ctx.arc(x + w * 0.27, y + h * 0.27, w * 0.07, 0, Math.PI * 2); ctx.fill();
        // phone
        ctx.globalAlpha = dim(1);
        ctx.fillStyle = '#4ecdc4';
        rrect(ctx, x + w * 0.30, y + h * 0.5, w * 0.08, h * 0.06, 3);
        // window (bg slot 3 -> use slot 3 idx 3? actually background)
        ctx.globalAlpha = dim(3);
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 2;
        strokeRRect(ctx, x + w * 0.66, y + h * 0.18, w * 0.28, h * 0.32, 4);
        ctx.globalAlpha = 1;
        // grid overlay (subtle)
        if (mask !== undefined) {
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = 0.5;
          for (let i = 1; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(x + (w / 8) * i, y);
            ctx.lineTo(x + (w / 8) * i, y + h);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y + (h / 8) * i);
            ctx.lineTo(x + w, y + (h / 8) * i);
            ctx.stroke();
          }
        }
      },
    },
    outdoor: {
      bgTop: '#a0d8ef', bgBot: '#dfecf5',
      draw(ctx, x, y, w, h, opts = {}) {
        const mask = opts.mask;
        const dim = (slot) => (mask === undefined || mask === slot ? 1 : 0.15);
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, this.bgTop); g.addColorStop(1, this.bgBot);
        ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
        // sun (bg)
        ctx.globalAlpha = dim(3);
        ctx.fillStyle = 'rgba(255, 217, 61, 0.75)';
        ctx.beginPath(); ctx.arc(x + w * 0.85, y + h * 0.18, w * 0.06, 0, Math.PI * 2); ctx.fill();
        // mountains (context)
        ctx.globalAlpha = dim(2);
        ctx.fillStyle = '#8aa97a';
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.6);
        ctx.lineTo(x + w * 0.3, y + h * 0.42);
        ctx.lineTo(x + w * 0.55, y + h * 0.55);
        ctx.lineTo(x + w * 0.8, y + h * 0.4);
        ctx.lineTo(x + w, y + h * 0.55);
        ctx.lineTo(x + w, y + h * 0.7);
        ctx.lineTo(x, y + h * 0.7);
        ctx.closePath(); ctx.fill();
        // ground
        ctx.fillStyle = '#c9a76d';
        ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
        // person
        ctx.globalAlpha = dim(0);
        ctx.fillStyle = '#ff6b6b';
        rrect(ctx, x + w * 0.22, y + h * 0.42, w * 0.12, h * 0.3, 8);
        ctx.beginPath(); ctx.arc(x + w * 0.28, y + h * 0.36, w * 0.05, 0, Math.PI * 2); ctx.fill();
        // javelin (object)
        ctx.globalAlpha = dim(1);
        ctx.strokeStyle = '#4ecdc4';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x + w * 0.36, y + h * 0.4); ctx.lineTo(x + w * 0.6, y + h * 0.3); ctx.stroke();
        ctx.globalAlpha = 1;
      },
    },
    sport: {
      bgTop: '#1f2937', bgBot: '#374151',
      draw(ctx, x, y, w, h, opts = {}) {
        const mask = opts.mask;
        const dim = (slot) => (mask === undefined || mask === slot ? 1 : 0.15);
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, this.bgTop); g.addColorStop(1, this.bgBot);
        ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
        // court lines (bg)
        ctx.globalAlpha = dim(3);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.78);
        ctx.lineTo(x + w, y + h * 0.78);
        ctx.stroke();
        // court floor (context)
        ctx.globalAlpha = dim(2);
        ctx.fillStyle = '#7c4f2a';
        ctx.fillRect(x, y + h * 0.78, w, h * 0.22);
        // person
        ctx.globalAlpha = dim(0);
        ctx.fillStyle = '#ff6b6b';
        rrect(ctx, x + w * 0.3, y + h * 0.4, w * 0.14, h * 0.4, 8);
        ctx.beginPath(); ctx.arc(x + w * 0.37, y + h * 0.34, w * 0.06, 0, Math.PI * 2); ctx.fill();
        // ball (object)
        ctx.globalAlpha = dim(1);
        ctx.fillStyle = '#4ecdc4';
        ctx.beginPath(); ctx.arc(x + w * 0.6, y + h * 0.55, w * 0.05, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      },
    },
  };

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }
  function strokeRRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.stroke();
  }

  function renderVisCell(el) {
    const scene = el.dataset.scene;
    const slotAttr = el.dataset.slot;
    const def = VIS_SCENES[scene];
    if (!def) return;
    const c = document.createElement('canvas');
    const rect = el.getBoundingClientRect();
    const w = rect.width || 200;
    const h = rect.height || 110;
    c.width = w * 2; c.height = h * 2; // hidpi
    c.style.width = '100%'; c.style.height = '100%';
    el.innerHTML = '';
    el.appendChild(c);
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    const opts = slotAttr ? { mask: parseInt(slotAttr, 10) - 1 } : {};
    def.draw(ctx, 0, 0, w, h, opts);
  }

  function findScene(el) {
    // both vis-frame and vis-slot need a scene — vis-slot inherits from parent row's vis-frame
    if (el.classList.contains('vis-frame')) return el;
    // find sibling vis-frame in the same row (vis-row uses display:contents so query manually)
    const row = el.closest('.vis-row');
    if (!row) return el;
    const frame = row.querySelector('.vis-frame');
    return frame || el;
  }

  function renderAllVisCells() {
    document.querySelectorAll('.vis-frame').forEach(renderVisCell);
    document.querySelectorAll('.vis-slot').forEach((el) => {
      const frameEl = findScene(el);
      const scene = frameEl ? frameEl.dataset.scene : null;
      if (scene) el.dataset.scene = scene;
      renderVisCell(el);
    });
  }

  // Wait for layout, then render
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAllVisCells);
  } else {
    renderAllVisCells();
  }
  // Re-render on resize so canvases stay crisp
  let rzTimer;
  window.addEventListener('resize', () => {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(renderAllVisCells, 250);
  });

})();

// ---- Lightbox: click any .zoomable image to open it fullscreen. ----
// Works on desktop (click + ESC/×/backdrop to close) and mobile
// (tap + tap-outside/X to close; pinch-zoom via touch-action: pinch-zoom).
(function () {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  const lbImg   = lightbox.querySelector('.lightbox-img');
  const lbClose = lightbox.querySelector('.lightbox-close');

  function open(src, alt) {
    lbImg.src = src;
    lbImg.alt = alt || '';
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // small delay so the fade-out doesn't flash the next src
    setTimeout(() => { if (!lightbox.classList.contains('open')) lbImg.src = ''; }, 250);
  }

  // Bind click handler on every zoomable image (incl. those added later)
  function bind(el) {
    el.addEventListener('click', () => open(el.currentSrc || el.src, el.alt));
  }
  document.querySelectorAll('img.zoomable').forEach(bind);

  // Close on click outside the image OR on the close button
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target === lbClose) close();
  });
  // ESC key closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('open')) close();
  });
})();

// ---- IntersectionObserver: add .in-view to .reveal-on-scroll elements ----
// Used by the observation figure (left-to-right wipe + staggered captions),
// the mainfigure (fade-up), and any future reveal-on-scroll elements.
(function () {
  const targets = document.querySelectorAll('.reveal-on-scroll');
  if (!targets.length) return;
  if (!('IntersectionObserver' in window)) {
    // Fallback: just reveal everything
    targets.forEach(el => el.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25, rootMargin: '0px 0px -60px 0px' });
  targets.forEach(el => io.observe(el));
})();

// ---- tiny CSS keyframe injection for method-stage cell fade-in ----
(function injectKF() {
  const css = `@keyframes fade-in { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
