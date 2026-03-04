document.addEventListener('click', (e) => {
  const btn = e.target.closest('.generate-report');
  if (!btn) return;
  e.preventDefault();
  const id = btn.getAttribute('data-player-id');
  if (!id) return;
  window.open(`/reports/player/${id}`, '_blank');
});
