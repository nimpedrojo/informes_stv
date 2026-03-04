const db = require('../db');

async function createPlayerStatsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS player_stats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      player_id INT NOT NULL,
      team VARCHAR(150),
      matches INT DEFAULT 0,
      starts INT DEFAULT 0,
      subs INT DEFAULT 0,
      not_played INT DEFAULT 0,
      minutes INT DEFAULT 0,
      goals INT DEFAULT 0,
      assists INT DEFAULT 0,
      yellow_cards INT DEFAULT 0,
      red_cards INT DEFAULT 0,
      rating DECIMAL(5,2) NULL,
      source_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_player (player_id),
      CONSTRAINT fk_player_stats_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  await db.query(sql);
}

async function clearPlayerStats() {
  await db.query('TRUNCATE TABLE player_stats');
}

async function insertPlayerStatsRows(rows) {
  if (!rows || rows.length === 0) return;

  const placeholders = rows.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
  const flattened = rows.flat();

  await db.query(
    `INSERT INTO player_stats (
      player_id,
      team,
      matches,
      starts,
      subs,
      not_played,
      minutes,
      goals,
      assists,
      yellow_cards,
      red_cards,
      rating,
      source_name
    ) VALUES ${placeholders}`,
    flattened,
  );
}

async function getStatsByPlayerId(playerId) {
  const [rows] = await db.query(
    'SELECT * FROM player_stats WHERE player_id = ? LIMIT 1',
    [playerId],
  );
  return rows[0];
}

module.exports = {
  createPlayerStatsTable,
  clearPlayerStats,
  insertPlayerStatsRows,
  getStatsByPlayerId,
};
