// Custom cursor: a circle that inverts the page beneath it and eases
// after the pointer. It grows over text and links, and turns into a
// "View" bubble over anything marked with data-cursor.
(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  const blob = document.createElement('div');
  blob.className = 'c-blob';
  blob.setAttribute('aria-hidden', 'true');
  const body = blob.appendChild(document.createElement('i'));
  document.body.appendChild(blob);
  root.classList.add('has-cursor');

  // Each page sets its accent with --cursor; used for the View bubble.
  const accent = getComputedStyle(document.body).getPropertyValue('--cursor').trim();
  if (accent) blob.style.setProperty('--c', accent);

  let x = -200, y = -200, bx = x, by = y;
  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    if (!root.classList.contains('cursor-in')) { bx = x; by = y; }
    root.classList.add('cursor-in');
  }, { passive: true });
  document.addEventListener('pointerleave', () => root.classList.remove('cursor-in'));

  const ease = reduce ? 1 : 0.22;
  (function follow() {
    bx += (x - bx) * ease;
    by += (y - by) * ease;
    blob.style.transform = `translate(${bx}px, ${by}px)`;
    requestAnimationFrame(follow);
  })();

  addEventListener('pointerover', e => {
    const t = e.target;
    const view = t.closest('[data-cursor]');
    const link = !view && t.closest('a, button, [role="button"], label');
    const text = !view && !link && t.closest('p, h1, h2, h3, li, blockquote, figcaption, dd, dt');
    blob.classList.toggle('is-view', !!view);
    blob.classList.toggle('is-link', !!link);
    blob.classList.toggle('is-text', !!text);
    body.dataset.label = view ? view.dataset.cursor : '';
  });

  addEventListener('pointerdown', () => blob.classList.add('is-down'));
  addEventListener('pointerup', () => blob.classList.remove('is-down'));
})();
