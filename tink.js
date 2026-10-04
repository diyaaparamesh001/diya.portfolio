// Fade sections and screens in as they scroll into view.
(() => {
  if (!('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const targets = document.querySelectorAll(
    'main > section > *, .t-ui-group, .t-screen, .t-wires figure, .t-step, .t-card, .t-back-card'
  );
  document.documentElement.classList.add('reveal-on');
  targets.forEach(el => {
    el.classList.add('rv');
    const siblings = [...el.parentElement.children];
    el.style.transitionDelay = Math.min(siblings.indexOf(el), 4) * 80 + 'ms';
  });
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add('in');
      io.unobserve(el);
      // Hand control back to the normal hover styles once it has settled.
      setTimeout(() => {
        el.classList.remove('rv', 'in');
        el.style.transitionDelay = '';
      }, 1300);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  targets.forEach(el => io.observe(el));
})();
