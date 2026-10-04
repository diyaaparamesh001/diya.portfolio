// Custom cursor: a dot that follows the pointer exactly and a ring that
// eases after it. The colour adapts to the background underneath.
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
  const ring = make('c-ring');
  const dot = make('c-dot');
  const ringBody = ring.firstChild;
  root.classList.add('has-cursor');

  // Each page sets its accent with --cursor (maroon by default).
  const accent = getComputedStyle(document.body).getPropertyValue('--cursor').trim() || '#69100a';

  let x = -100, y = -100, rx = x, ry = y;
  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    dot.style.transform = `translate(${x}px, ${y}px)`;
    root.classList.add('cursor-in');
  }, { passive: true });
  document.addEventListener('pointerleave', () => root.classList.remove('cursor-in'));

  const ease = reduce ? 1 : 0.2;
  (function follow() {
    rx += (x - rx) * ease;
    ry += (y - ry) * ease;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(follow);
  })();

  // Is the first painted background behind this element dark?
  const isDark = el => {
    for (; el && el !== document; el = el.parentElement) {
      const m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g);
      if (!m || (m[3] !== undefined && +m[3] === 0)) continue;
      const [r, g, b] = m.map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
    }
    return false;
  };

  const set = (cls, on) => { ring.classList.toggle(cls, on); dot.classList.toggle(cls, on); };

  addEventListener('pointerover', e => {
    const t = e.target;
    const view = t.closest('[data-cursor]');
    const link = t.closest('a, button, [role="button"], label');
    const text = !link && t.closest('p, h1, h2, h3, li, blockquote, figcaption, dd');
    set('is-view', !!view);
    set('is-link', !view && !!link);
    set('is-text', !!text && !view);
    ringBody.dataset.label = view ? view.dataset.cursor : '';

    const dark = isDark(t);
    const c = dark ? '#fafaf7' : accent;
    for (const el of [ring, dot]) {
      el.style.setProperty('--c', c);
      el.style.setProperty('--c-text', dark ? '#111' : '#fff');
    }
  });

  addEventListener('pointerdown', () => ring.classList.add('is-down'));
  addEventListener('pointerup', () => ring.classList.remove('is-down'));
})();
