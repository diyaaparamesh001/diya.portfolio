// Embedded prototypes are designed for a phone screen (375 x 812 unless the
// box sets --w). Scale each one to fill its box, and let "Start over"
// reload it.
document.querySelectorAll('.proto-box').forEach(box => {
  const w = parseFloat(getComputedStyle(box).getPropertyValue('--w')) || 375;
  new ResizeObserver(() => box.style.setProperty('--s', box.clientWidth / w)).observe(box);
});
document.querySelectorAll('[data-restart]').forEach(btn => {
  btn.addEventListener('click', () => {
    const frame = document.getElementById(btn.dataset.restart);
    frame.src = frame.dataset.src || frame.src;
  });
});
