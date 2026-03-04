const db = require('../db');

async function createPlayersTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS players (
      id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(150) NOT NULL,
      team VARCHAR(150),
      birth_date DATE,
      birth_year INT,
      laterality VARCHAR(5),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  await db.query(sql);
}

async function insertPlayer({
  firstName,
  lastName,
  team,
  birthDate,
  birthYear,
  laterality,
}) {
  await db.query(
    'INSERT INTO players (first_name, last_name, team, birth_date, birth_year, laterality) VALUES (?, ?, ?, ?, ?, ?)',
    [firstName, lastName, team, birthDate, birthYear, laterality],
  );
}

async function getPlayersByTeam(team) {
  if (team) {
    const [rows] = await db.query(
      'SELECT * FROM players WHERE team = ? ORDER BY last_name, first_name',
      [team],
    );
    return rows;
  }
  const [rows] = await db.query(
    'SELECT * FROM players ORDER BY team, last_name, first_name',
  );
  return rows;
}

async function getAllPlayers() {
  const [rows] = await db.query(
    'SELECT * FROM players ORDER BY team, last_name, first_name',
  );
  return rows;
}

function resolveSort(field) {
  const map = {
    id: 'id',
    first_name: 'first_name',
    last_name: 'last_name',
    team: 'team',
    year: 'birth_year',
    created: 'created_at',
    birth_year: 'birth_year',
    created_at: 'created_at',
  };
  return map[field] || 'last_name';
}

function resolveDir(dir) {
  return dir && dir.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
}

async function getPlayersFiltered({ team, search, sort, dir }) {
  const sortCol = resolveSort(sort);
  const sortDir = resolveDir(dir);

  const params = [];
  const where = [];

  if (team) {
    where.push('p.team = ?');
    params.push(team);
  }

  if (search) {
    where.push('(p.first_name LIKE ? OR p.last_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT p.*,
      (SELECT COUNT(*) FROM player_stats ps WHERE ps.player_id = p.id) AS stats_count
     FROM players p
     ${whereClause}
     ORDER BY ${sortCol} ${sortDir}, p.first_name ASC`,
    params,
  );
  return rows;
}

async function getDistinctTeams() {
  const [rows] = await db.query(
    'SELECT DISTINCT team FROM players WHERE team IS NOT NULL AND team <> "" ORDER BY team',
  );
  return rows.map((r) => r.team);
}

async function getPlayerById(id) {
  const [rows] = await db.query('SELECT * FROM players WHERE id = ?', [id]);
  return rows[0];
}

async function updatePlayer(id, {
  firstName,
  lastName,
  team,
  birthDate,
  birthYear,
  laterality,
}) {
  const [result] = await db.query(
    'UPDATE players SET first_name = ?, last_name = ?, team = ?, birth_date = ?, birth_year = ?, laterality = ? WHERE id = ?',
    [firstName, lastName, team, birthDate, birthYear, laterality, id],
  );
  return result.affectedRows;
}

async function deletePlayer(id) {
  const [result] = await db.query('DELETE FROM players WHERE id = ?', [id]);
  return result.affectedRows;
}

module.exports = {
  createPlayersTable,
  insertPlayer,
  getPlayersByTeam,
  getAllPlayers,
  getPlayersFiltered,
  getDistinctTeams,
  getPlayerById,
  updatePlayer,
  deletePlayer,
};
