// Magnetic cursor. A dot tracks the pointer exactly; a ring eases after
// it. Near a button or link the ring snaps around it, taking its size and
// corner radius, and the element leans toward the pointer. Projects
// (anything with data-cursor) turn the ring into a "View" bubble.
(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  const make = cls => {
    const el = document.createElement('div');
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    el.appendChild(document.createElement('i'));
    document.body.appendChild(el);
    return el;
  };
  const ring = make('c-ring'), dot = make('c-dot');
  const ringBody = ring.firstChild;
  root.classList.add('has-cursor');

  const accent = getComputedStyle(document.body).getPropertyValue('--cursor').trim() || '#69100a';

  // Pointer position, and the ring's current box (centre, size, radius).
  let x = -100, y = -100;
  const r = { x, y, w: 32, h: 32, rad: 16 };
  let magnet = null, view = false;
  const pulls = new Map(); // element -> current lean offset {x, y}

  const isDark = el => {
    for (; el && el !== document; el = el.parentElement) {
      const m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g);
      if (!m || (m[3] !== undefined && +m[3] === 0)) continue;
      const [cr, cg, cb] = m.map(Number);
      return 0.2126 * cr + 0.7152 * cg + 0.0722 * cb < 110;
    }
    return false;
  };

  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    if (!root.classList.contains('cursor-in')) { r.x = x; r.y = y; }
    root.classList.add('cursor-in');
    dot.style.transform = `translate(${x}px, ${y}px)`;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { root.classList.remove('cursor-in'); magnet = null; });
  // Embedded prototypes use their own pointer, so step aside over them.
  document.querySelectorAll('iframe').forEach(f =>
    f.addEventListener('pointerenter', () => { root.classList.remove('cursor-in'); magnet = null; }));

  addEventListener('pointerover', e => {
    const t = e.target;
    const v = t.closest('[data-cursor]');
    const m = !v && t.closest('a, button, [role="button"]');
    view = !!v;
    magnet = m || null;
    if (magnet && !pulls.has(magnet)) pulls.set(magnet, { x: 0, y: 0 });
    ringBody.dataset.label = v ? v.dataset.cursor : '';
    for (const el of [ring, dot]) {
      el.classList.toggle('is-view', view);
      el.classList.toggle('is-magnet', !!magnet);
    }
    const dark = isDark(t);
    for (const el of [ring, dot]) {
      el.style.setProperty('--c', dark ? '#fafaf7' : accent);
      el.style.setProperty('--c-text', dark ? '#111' : '#fff');
    }
  });

  let down = false;
  addEventListener('pointerdown', () => { down = true; });
  addEventListener('pointerup', () => { down = false; });

  const lerp = (a, b, k) => a + (b - a) * k;
  const k = reduce ? 1 : 0.2;

  (function frame() {
    // Where should the ring be?
    let tx = x, ty = y, tw = 32, th = 32, trad = 16;
    if (view) {
      tw = th = 92; trad = 46;
    } else if (magnet && magnet.isConnected) {
      const p = pulls.get(magnet);
      const b = magnet.getBoundingClientRect();
      const cx = b.left + b.width / 2 - p.x, cy = b.top + b.height / 2 - p.y;
      const pad = 8;
      tw = b.width + pad * 2; th = b.height + pad * 2;
      const rad = parseFloat(getComputedStyle(magnet).borderTopLeftRadius) || 0;
      trad = Math.min(rad ? rad + pad : 10, Math.min(tw, th) / 2);
      // The ring hugs the element but still drifts a little with the pointer.
      tx = cx + (x - cx) * 0.12; ty = cy + (y - cy) * 0.12;
    }
    if (down) { tw *= 0.9; th *= 0.9; }

    r.x = lerp(r.x, tx, k); r.y = lerp(r.y, ty, k);
    r.w = lerp(r.w, tw, k); r.h = lerp(r.h, th, k); r.rad = lerp(r.rad, trad, k);
    ring.style.transform = `translate(${r.x}px, ${r.y}px)`;
    ringBody.style.width = r.w + 'px';
    ringBody.style.height = r.h + 'px';
    ringBody.style.borderRadius = r.rad + 'px';

    // Lean the hovered element toward the pointer; ease others back.
    for (const [el, p] of pulls) {
      let gx = 0, gy = 0;
      if (el === magnet && !reduce) {
        const b = el.getBoundingClientRect();
        const cx = b.left + b.width / 2 - p.x, cy = b.top + b.height / 2 - p.y;
        const strength = Math.min(0.25, 40 / Math.max(b.width, b.height));
        gx = (x - cx) * strength; gy = (y - cy) * strength;
      }
      p.x = lerp(p.x, gx, 0.18); p.y = lerp(p.y, gy, 0.18);
      el.style.translate = `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`;
      if (el !== magnet && Math.abs(p.x) < 0.05 && Math.abs(p.y) < 0.05) {
        el.style.translate = '';
        pulls.delete(el);
      }
    }
    requestAnimationFrame(frame);
  })();
})();
