/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const db = require('../src/db');
const { getAllPlayers } = require('../src/models/playerModel');
const {
  createPlayerStatsTable,
  clearPlayerStats,
  insertPlayerStatsRows,
} = require('../src/models/playerStatsModel');

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

function readCsvRows(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf16le');
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const [header, ...dataLines] = lines;
  if (!header || !header.toLowerCase().startsWith('nombre;')) {
    throw new Error('El CSV no parece tener el encabezado esperado (NOMBRE;...)');
  }

  return dataLines.map((line) => line.split(';'));
}

async function main() {
  const defaultPath = path.join(
    process.env.USERPROFILE || process.env.HOME || __dirname,
    'Downloads',
    'Estadísticas_04-03-2026_08-38-31.csv',
  );
  const csvPath = process.env.PLAYER_STATS_CSV_PATH || defaultPath;

  if (!fs.existsSync(csvPath)) {
    console.error(`No se encontró el CSV en: ${csvPath}`);
    process.exit(1);
  }

  console.log('Usando CSV:', csvPath);

  await createPlayerStatsTable();

  const players = await getAllPlayers();
  const playerIndex = players.reduce((acc, p) => {
    const key = normalizeText(p.last_name);
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const rows = readCsvRows(csvPath);

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
      skipped.push({ line: idx + 2, reason: 'Jugador no encontrado', name: nameRaw });
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

  console.log(`Filas en CSV: ${rows.length}`);
  console.log(`Insertadas: ${matched}`);
  console.log(`Saltadas: ${skipped.length}`);
  if (skipped.length > 0) {
    console.log('No coincidieron:');
    skipped.slice(0, 20).forEach((s) => {
      console.log(`- Línea ${s.line}: ${s.name || ''} (${s.reason})`);
    });
    if (skipped.length > 20) {
      console.log(`... y ${skipped.length - 20} más`);
    }
  }

  await db.end();
}

main().catch((err) => {
  console.error('Error al importar estadísticas:', err);
  db.end().finally(() => process.exit(1));
});
