const express = require('express');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const {
  getPlayersFiltered,
  getDistinctTeams,
  getPlayerById,
  updatePlayer,
  deletePlayer,
} = require('../models/playerModel');
const {
  createPlayerStatsTable,
  clearPlayerStats,
  insertPlayerStatsRows,
  getStatsByPlayerId,
} = require('../models/playerStatsModel');
const { getLatestReportForPlayer } = require('../models/reportModel');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

function ensureAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.flash('error', 'No tienes permisos para acceder a esta sección.');
    return res.redirect('/');
  }
  return next();
}

function normalizeText(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeTeam(text) {
  return normalizeText(text).replace(/[^a-z0-9]/g, '');
}

function parseInteger(value) {
  const num = Number.parseInt((value || '').toString().trim(), 10);
  return Number.isNaN(num) ? 0 : num;
}

function parseRating(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number.parseFloat(value.toString().replace(',', '.'));
  return Number.isNaN(num) ? null : num;
}

function parseCsv(buffer) {
  const raw = buffer.toString('utf16le');
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const [header, ...data] = lines;
  if (!header || !header.toLowerCase().startsWith('nombre;')) {
    throw new Error('El CSV no tiene el encabezado esperado (NOMBRE;...)');
  }

  return data.map((line) => line.split(';'));
}

// Listado de jugadores
router.get('/', ensureAdmin, async (req, res) => {
  const {
    team = '',
    search = '',
    sort = 'last_name',
    dir = 'asc',
  } = req.query;
  try {
    const players = await getPlayersFiltered({ team, search, sort, dir });
    const teams = await getDistinctTeams();
    return res.render('players/list', {
      players,
      filters: { team, search },
      sort,
      dir,
      teams,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error al obtener jugadores:', err);
    req.flash('error', 'Ha ocurrido un error al cargar los jugadores.');
    return res.redirect('/');
  }
});

// Formulario importar estadísticas
router.get('/import-stats', ensureAdmin, (req, res) => {
  return res.render('players/import-stats');
});

// Procesar importación de estadísticas
router.post(
  '/import-stats',
  ensureAdmin,
  upload.single('stats_csv'),
  async (req, res) => {
    if (!req.file) {
      req.flash('error', 'Debes seleccionar un archivo CSV.');
      return res.redirect('/admin/players/import-stats');
    }

    try {
      await createPlayerStatsTable();

      const players = await getAllPlayers();
      const playerIndex = players.reduce((acc, p) => {
        const key = normalizeText(p.last_name);
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      }, {});

      const rows = parseCsv(req.file.buffer);

      const inserts = [];
      let matched = 0;
      const skipped = [];

      rows.forEach((cols, idx) => {
        if (cols.length < 12) {
          skipped.push({ line: idx + 2, reason: 'Fila incompleta' });
          return;
        }

        const [
          nameRaw,
          teamRaw,
          matches,
          starts,
          subs,
          notPlayed,
          minutes,
          goals,
          assists,
          yellow,
          red,
          ratingRaw,
        ] = cols;

        const csvLastName = normalizeText((nameRaw || '').split(',')[0]);
        const csvTeam = normalizeTeam(teamRaw);
        const candidates = playerIndex[csvLastName] || [];

        let player = null;
        if (candidates.length === 1) {
          [player] = candidates;
        } else if (candidates.length > 1) {
          player =
            candidates.find(
              (p) => normalizeTeam(p.team || '') === csvTeam,
            ) || candidates[0];
        }

        if (!player) {
          skipped.push({
            line: idx + 2,
            reason: 'Jugador no encontrado',
            name: nameRaw,
          });
          return;
        }

        inserts.push([
          player.id,
          teamRaw || null,
          parseInteger(matches),
          parseInteger(starts),
          parseInteger(subs),
          parseInteger(notPlayed),
          parseInteger(minutes),
          parseInteger(goals),
          parseInteger(assists),
          parseInteger(yellow),
          parseInteger(red),
          parseRating(ratingRaw),
          nameRaw,
        ]);
        matched += 1;
      });

      await clearPlayerStats();
      await insertPlayerStatsRows(inserts);

      req.flash(
        'success',
        `estadísticas importadas: ${matched}. Filas saltadas: ${skipped.length}.`,
      );
      return res.redirect('/admin/players');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error importando estadísticas:', err);
      req.flash(
        'error',
        'No se pudieron importar las estadísticas. Revisa el formato del CSV.',
      );
      return res.redirect('/admin/players/import-stats');
    }
  },
);

// Ver estadísticas de un jugador
router.get('/:id/stats', ensureAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const player = await getPlayerById(id);
    if (!player) {
      req.flash('error', 'Jugador no encontrado.');
      return res.redirect('/admin/players');
    }

    const stats = await getStatsByPlayerId(id);
    if (!stats) {
      req.flash('error', 'Este jugador no tiene estadísticas importadas.');
      return res.redirect('/admin/players');
    }

    return res.render('players/stats', { player, stats });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error al mostrar estadísticas:', err);
    req.flash('error', 'No se pudieron cargar las estadísticas.');
    return res.redirect('/admin/players');
  }
});

// Generar informe PDF de un jugador
router.get('/:id/pdf', ensureAdmin, async (req, res) => {
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

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const filename = `Informe_${player.last_name || ''}_${player.first_name || ''}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(filename)}"`,
    );

    doc.pipe(res);

    // Helpers
    const formatDate = (isoDate, yearOnly) => {
      if (isoDate) {
        const d = new Date(isoDate);
        if (!Number.isNaN(d.getTime())) {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yy = d.getFullYear();
          return `${dd}/${mm}/${yy}`;
        }
      }
      if (yearOnly) return `${yearOnly}`;
      return 'N/D';
    };

    const drawBar = (label, value, max, x, y, color = '#c1121f') => {
      const barW = 220;
      const pct = Math.min(1, max ? value / max : 0);
      doc.fillColor('#1f2933').fontSize(10).font('Helvetica-Bold').text(label, x, y - 2);
      doc.roundedRect(x, y + 12, barW, 10, 4).strokeColor('#d9d9d9').stroke();
      doc
        .roundedRect(x, y + 12, barW * pct, 10, 4)
        .fillAndStroke(color, color);
      doc.font('Helvetica').fillColor('#1f2933').text(`${value}`, x + barW + 8, y + 8);
    };

    const drawRadar = (centerX, centerY, radius, values) => {
      const keys = Object.keys(values);
      const max = 10;
      // grid
      doc.strokeColor('#e5e7eb').lineWidth(0.7);
      for (let r = radius / 4; r <= radius; r += radius / 4) {
        doc.circle(centerX, centerY, r).stroke();
      }
      // axes
      keys.forEach((k, i) => {
        const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        doc.moveTo(centerX, centerY).lineTo(x, y).stroke();
        const lx = centerX + (radius + 12) * Math.cos(angle);
        const ly = centerY + (radius + 12) * Math.sin(angle);
        doc.fontSize(9).fillColor('#1f2933').text(k, lx - 12, ly - 6, { width: 30 });
      });
      // polygon
      doc.fillColor('#c1121f', 0.55).strokeColor('#c1121f');
      doc.moveTo(centerX, centerY);
      keys.forEach((k, i) => {
        const val = Math.max(0, Math.min(values[k], max));
        const r = (val / max) * radius;
        const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        if (i === 0) doc.moveTo(x, y);
        else doc.lineTo(x, y);
      });
      doc.closePath().fillAndStroke('#c1121f', '#c1121f');
    };

    const drawSeparator = () => {
      const y = doc.y + 6;
      const lineEnd = doc.page.width - 220;
      doc
        .strokeColor('#c1121f')
        .lineWidth(1.5)
        .moveTo(40, y)
        .lineTo(lineEnd, y)
        .stroke();
      doc.moveDown(1);
    };

    // Logo
    const logoPath = path.join(__dirname, '..', 'public', 'img', 'logo-stadium.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, doc.page.width - 130, 20, { fit: [90, 90], align: 'right' });
    }

    // Encabezado
    doc
      .fillColor('#1f2933')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(`Informe jugador ${player.first_name} ${player.last_name}`, 40, 40, { align: 'left' });
    doc.moveDown(0.5);
    // línea roja más corta (no invade el logo)
    const lineEnd = doc.page.width - 160;
    doc
      .strokeColor('#c1121f')
      .lineWidth(2)
      .moveTo(40, doc.y)
      .lineTo(lineEnd, doc.y)
      .stroke();
    doc.moveDown(1);

        // Bloque 1: Datos jugador
    doc.fontSize(14).fillColor('#c1121f').text('Datos del jugador');
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor('#1f2933');
    const born = formatDate(player.birth_date, player.birth_year);
    const printField = (label, value) => {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(value || 'N/D');
    };
    printField('Nombre', `${player.first_name} ${player.last_name}`);
    printField('Equipo', player.team || 'N/D');
    printField('Fecha de nacimiento', born);
    printField('Lateralidad', player.laterality || 'N/D');
    doc.moveDown(0.6);
    drawSeparator();

    // Bloque 2: Informe técnico
    doc.fillColor('#c1121f').fontSize(14).text('Informe técnico');
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor('#1f2933');
    if (latestReport) {
      printField('Último informe', latestReport.created_at.toISOString().slice(0, 10));
      printField('Club', latestReport.club || 'N/D');
      printField('Equipo', latestReport.team || 'N/D');
      printField(
        'Valoración global',
        latestReport.overall_rating != null ? Number(latestReport.overall_rating).toFixed(2) : 'N/D',
      );

      const dims = {
        Tec: latestReport.tech_total || 0,
        Tac: latestReport.tact_total || 0,
        Fís: latestReport.phys_total || 0,
        Psy: latestReport.psych_total || 0,
        Per: latestReport.pers_total || 0,
      };

      const startY = doc.y + 4;
      const colX = 40;
      Object.entries(dims).forEach(([k, v], idx) => {
        doc.font('Helvetica-Bold').text(`${k}: `, colX, startY + idx * 14, { continued: true });
        doc.font('Helvetica').text(v ? Number(v).toFixed(2) : 'N/D');
      });

      const radarCenterX = doc.page.width - 140;
      const radarCenterY = startY + 60;
      drawRadar(radarCenterX, radarCenterY, 65, dims);
      doc.y = Math.max(doc.y, startY + 130);

      doc.moveDown(0.4);
      doc.font('Helvetica-Bold').text('Resumen técnico:');
      doc.font('Helvetica').text(latestReport.comments || 'Sin comentarios.', { align: 'left' });
    } else {
      doc.text('Sin informes técnicos disponibles.');
    }
    doc.moveDown(0.6);
    drawSeparator();

    // Bloque 3: Estadísticas
    doc.fillColor('#c1121f').fontSize(14).text('Estadísticas');
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor('#1f2933');
    if (stats) {
      const mp = stats.matches || 0;
      const mins = stats.minutes || 0;
      const ga = (stats.goals || 0) + (stats.assists || 0);
      const ga90 = mins ? ((ga * 90) / mins).toFixed(2) : 'N/D';
      const minutesPerMatch = mp ? (mins / mp).toFixed(1) : 'N/D';
      const cardsPerMatch = mp ? (((stats.yellow_cards || 0) + (stats.red_cards || 0)) / mp).toFixed(2) : 'N/D';

      const chartX = 40;
      let chartY = doc.y;
      drawBar('Minutos', mins, 2000, chartX, chartY);
      chartY += 32;
      drawBar('Goles', stats.goals || 0, 20, chartX, chartY, '#17a2b8');
      chartY += 32;
      drawBar('Asistencias', stats.assists || 0, 20, chartX, chartY, '#ffc107');

      const dataX = chartX + 260;
      doc.font('Helvetica-Bold').text('Partidos: ', dataX, doc.y, { continued: true });
      doc.font('Helvetica').text(
        `${mp} (Titular ${stats.starts || 0}, Suplente ${stats.subs || 0}, Sin jugar ${stats.not_played || 0})`,
      );
      doc.font('Helvetica-Bold').text('Minutos/partido: ', dataX, doc.y, { continued: true });
      doc.font('Helvetica').text(minutesPerMatch);
      doc.font('Helvetica-Bold').text('G+A/90: ', dataX, doc.y, { continued: true });
      doc.font('Helvetica').text(ga90);
      doc.font('Helvetica-Bold').text('Tarjetas: ', dataX, doc.y, { continued: true });
      doc.font('Helvetica').text(`TA ${stats.yellow_cards || 0} · TR ${stats.red_cards || 0} · Por partido ${cardsPerMatch}`);
      if (stats.rating != null) {
        doc.font('Helvetica-Bold').text('Calificación media: ', dataX, doc.y, { continued: true });
        doc.font('Helvetica').text(Number(stats.rating).toFixed(2));
      }
      doc.y = Math.max(chartY + 20, doc.y);
    } else {
      doc.text('Sin estadísticas importadas.');
    }

    doc.end();
    return null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error al generar PDF de jugador:', err);
    req.flash('error', 'No se pudo generar el PDF del jugador.');
    return res.redirect('/admin/players');
  }
});

// Formulario de edición de jugador
router.get('/:id/edit', ensureAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const player = await getPlayerById(id);
    if (!player) {
      req.flash('error', 'Jugador no encontrado.');
      return res.redirect('/admin/players');
    }
    return res.render('players/edit', { player });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error al cargar jugador para edición:', err);
    req.flash('error', 'Ha ocurrido un error al cargar el jugador.');
    return res.redirect('/admin/players');
  }
});

router.post('/:id/edit', ensureAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    first_name,
    last_name,
    team,
    birth_date,
    birth_year,
    laterality,
  } = req.body;

  if (!first_name || !last_name) {
    req.flash('error', 'Nombre y apellidos son obligatorios.');
    return res.redirect(`/admin/players/${id}/edit`);
  }

  try {
    const affected = await updatePlayer(id, {
      firstName: first_name,
      lastName: last_name,
      team: team || null,
      birthDate: birth_date || null,
      birthYear: birth_year || null,
      laterality: laterality || null,
    });

    if (!affected) {
      req.flash('error', 'No se ha podido actualizar el jugador.');
      return res.redirect(`/admin/players/${id}/edit`);
    }

    req.flash('success', 'Jugador actualizado correctamente.');
    return res.redirect('/admin/players');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error al actualizar jugador:', err);
    req.flash('error', 'Ha ocurrido un error al actualizar el jugador.');
    return res.redirect(`/admin/players/${id}/edit`);
  }
});

// Borrado individual de jugador
router.post('/:id/delete', ensureAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const affected = await deletePlayer(id);
    if (!affected) {
      req.flash('error', 'No se ha podido borrar el jugador.');
    } else {
      req.flash('success', 'Jugador borrado correctamente.');
    }
    return res.redirect('/admin/players');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error al borrar jugador:', err);
    req.flash('error', 'Ha ocurrido un error al borrar el jugador.');
    return res.redirect('/admin/players');
  }
});

// Borrado múltiple de jugadores
router.post('/bulk-delete', ensureAdmin, async (req, res) => {
  let { playerIds } = req.body;

  if (!playerIds) {
    req.flash('error', 'No has seleccionado ningún jugador para borrar.');
    return res.redirect('/admin/players');
  }

  if (!Array.isArray(playerIds)) {
    playerIds = [playerIds];
  }

  try {
    const idsToDelete = playerIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id));

    // eslint-disable-next-line no-restricted-syntax
    for (const id of idsToDelete) {
      // eslint-disable-next-line no-await-in-loop
      await deletePlayer(id);
    }

    if (idsToDelete.length) {
      req.flash('success', 'Jugadores seleccionados borrados correctamente.');
    } else {
      req.flash('error', 'No se ha borrado ningún jugador.');
    }

    return res.redirect('/admin/players');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error en borrado múltiple de jugadores:', err);
    req.flash(
      'error',
      'Ha ocurrido un error al borrar los jugadores seleccionados.',
    );
    return res.redirect('/admin/players');
  }
});

module.exports = router;





