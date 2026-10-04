// Embedded prototypes are designed at 375 x 812. Scale each one to fill
// its box, and let "Start over" reload it.
document.querySelectorAll('.proto-box').forEach(box => {
  new ResizeObserver(() => box.style.setProperty('--s', box.clientWidth / 375)).observe(box);
});
document.querySelectorAll('[data-restart]').forEach(btn => {
  btn.addEventListener('click', () => {
    const frame = document.getElementById(btn.dataset.restart);
    frame.src = frame.dataset.src || frame.src;
  });
});
