const express = require('express');
const path = require('path');
const { getPlayerById } = require('../models/playerModel');
const { getStatsByPlayerId } = require('../models/playerStatsModel');
const { getLatestReportForPlayer } = require('../models/reportModel');
const { generatePlayerReport } = require('../../reports/generateReport');

const router = express.Router();

function ensureAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.flash('error', 'No tienes permisos para acceder a esta sección.');
    return res.redirect('/');
  }
  return next();
}

router.get('/player/:id', ensureAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const player = await getPlayerById(id);
    if (!player) {
      req.flash('error', 'Jugador no encontrado.');
      return res.redirect('/admin/players');
    }

    const stats = await getStatsByPlayerId(id);
    const latestReport = await getLatestReportForPlayer(
      player.first_name,
      player.last_name,
    );

    const birthdate =
      player.birth_date && player.birth_date instanceof Date
        ? player.birth_date.toISOString().slice(0, 10)
        : player.birth_date || player.birth_year || '';
    const currentYear = new Date().getFullYear();

    const data = {
      name: `${player.first_name} ${player.last_name}`,
      birthdate,
      position: latestReport?.pos1 || 'N/D',
      foot: player.laterality || 'N/D',
      team: player.team || latestReport?.team || 'N/D',
      category: latestReport?.club || 'N/D',
      season: `${currentYear}/${currentYear + 1}`,
      logo: path.join(__dirname, '..', 'public', 'img', 'logo-stadium.png'),
      ratings: {
        tecnica: latestReport?.tech_total || 0,
        tactica: latestReport?.tact_total || 0,
        fisico: latestReport?.phys_total || 0,
        mental: latestReport?.psych_total || 0,
        personalidad: latestReport?.pers_total || 0,
      },
      stats: {
        minutes: stats?.minutes || 0,
        games: stats?.matches || 0,
        starts: stats?.starts || 0,
      },
      feedback: {
        strengths: latestReport?.comments || 'Sin comentarios.',
        improvements: 'Añade observaciones en el próximo informe.',
      },
    };

    const pdfBuffer = await generatePlayerReport(data);
    res.contentType('application/pdf');
    return res.send(pdfBuffer);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error generando informe PDF:', err);
    req.flash('error', 'No se pudo generar el informe.');
    return res.redirect('/admin/players');
  }
});

module.exports = router;
