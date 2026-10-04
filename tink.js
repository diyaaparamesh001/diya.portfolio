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

// Interactive prototype: scale the 375 x 812 app into its phone frame and
// update the guidance as the visitor moves through the screens.
(() => {
  const frame = document.querySelector('.t-proto-screen iframe');
  if (!frame) return;
  const box = frame.parentElement;
  const text = document.querySelector('.t-guide-text');

  new ResizeObserver(() => {
    box.style.setProperty('--s', box.clientWidth / 375);
  }).observe(box);

  const tips = {
    home: 'Welcome to Tink! Tap ‘Try First’ or ‘Log In’ to start exploring.',
    login: 'Type any password and tap log in, or go back and tap ‘try first’.',
    chat: 'Tap the mic to talk, or ••• to type. Try switching between ‘think with me’ and ‘quick help’ at the top.',
    drawer: 'This is your side menu. Open a recent chat, or tap your name to find profile, settings and modes.',
    profile: 'Your profile. Try ‘change password’, or head back to the chat.',
    password: 'Change your password, then tap the back arrow.',
    settings: 'Set Tink’s privacy and AI boundaries, like a daily conversation limit.',
    modes: 'See how ‘think with me’ and ‘quick help’ differ. Keep tinking!',
  };

  let current = '';
  const say = key => {
    const msg = tips[key] || tips.home;
    if (msg === current) return;
    current = msg;
    text.classList.add('is-changing');
    setTimeout(() => { text.textContent = msg; text.classList.remove('is-changing'); }, 200);
  };

  frame.addEventListener('load', () => {
    let doc;
    try { doc = frame.contentDocument; } catch { return; }
    const page = frame.contentWindow.location.pathname.split('/').pop().replace('.html', '') || 'home';
    say(page);
    const drawer = doc && doc.getElementById('drawer');
    if (drawer) {
      const check = () => say(drawer.classList.contains('is-open') ? 'drawer' : 'chat');
      new MutationObserver(check).observe(drawer, { attributes: true, attributeFilter: ['class'] });
      check();
    }
  });

  document.querySelector('.t-restart').addEventListener('click', () => {
    frame.src = 'prototype/tink/home.html';
  });
})();
