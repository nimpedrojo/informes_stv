(() => {
  const d = window.reportData || {};

  // Header
  const nameEl = document.getElementById('player-name');
  if (nameEl) nameEl.textContent = d.name || 'Jugador';
  const logo = document.getElementById('club-logo');
  if (logo && d.logo) logo.src = d.logo;

  // Player info
  const info = [
    { label: 'Nombre', value: d.name },
    { label: 'Fecha de nacimiento', value: d.birthdate },
    { label: 'Posición', value: d.position },
    { label: 'Pierna dominante', value: d.foot },
    { label: 'Equipo', value: d.team },
    { label: 'Categoría', value: d.category },
    { label: 'Temporada', value: d.season },
  ];
  const container = document.getElementById('player-info');
  if (container) {
    info.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'info-item';
      div.innerHTML = `<p class="info-label">${item.label}</p><p class="info-value">${item.value || 'N/D'}</p>`;
      container.appendChild(div);
    });
  }

  // Ratings table
  const ratingsTable = document.getElementById('ratings-table');
  const rows = [
    ['Técnica', d.ratings?.tecnica],
    ['Táctica', d.ratings?.tactica],
    ['Físico', d.ratings?.fisico],
    ['Mentalidad', d.ratings?.mental],
    ['Personalidad', d.ratings?.personalidad],
  ];
  if (ratingsTable) {
    rows.forEach(([label, value]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${label}</td><td>${value != null ? value : 'N/D'}</td>`;
      ratingsTable.appendChild(tr);
    });
  }

  // Radar chart
  const radarCtx = document.getElementById('radarChart');
  if (radarCtx && window.Chart) {
    new Chart(radarCtx, {
      type: 'radar',
      data: {
        labels: ['Técnica', 'Táctica', 'Físico', 'Mental', 'Personalidad'],
        datasets: [
          {
            data: [
              d.ratings?.tecnica || 0,
              d.ratings?.tactica || 0,
              d.ratings?.fisico || 0,
              d.ratings?.mental || 0,
              d.ratings?.personalidad || 0,
            ],
            backgroundColor: 'rgba(193,18,31,0.15)',
            borderColor: '#c1121f',
            pointBackgroundColor: '#c1121f',
            pointBorderColor: '#c1121f',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: false,
        scales: { r: { suggestedMin: 0, suggestedMax: 10, ticks: { stepSize: 2 } } },
        plugins: { legend: { display: false } },
      },
    });
  }

  // Stats pie
  const pieCtx = document.getElementById('statsPie');
  if (pieCtx && window.Chart) {
    new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: ['Minutos', 'Partidos', 'Titularidades'],
        datasets: [
          {
            data: [d.stats?.minutes || 0, d.stats?.games || 0, d.stats?.starts || 0],
            backgroundColor: ['#c1121f', '#ffc107', '#17a2b8'],
          },
        ],
      },
      options: { responsive: false, plugins: { legend: { position: 'bottom' } } },
    });
  }

  // Feedback
  const strengths = document.getElementById('strengths');
  const improvements = document.getElementById('improvements');
  if (strengths) strengths.textContent = d.feedback?.strengths || 'Sin datos';
  if (improvements) improvements.textContent = d.feedback?.improvements || 'Sin datos';
})();
