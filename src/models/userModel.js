const db = require('../db');
const bcrypt = require('bcryptjs');

async function createUsersTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  await db.query(sql);

  // Añadimos la columna role si la tabla ya existía sin ella
  try {
    await db.query('ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT \'user\'');
  } catch (e) {
    if (e && e.code !== 'ER_DUP_FIELDNAME') {
      // eslint-disable-next-line no-console
      console.error('Error altering users table', e);
    }
  }
}

async function createUser({ name, email, password, role = 'user' }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await db.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, email, passwordHash, role],
  );
  return result.insertId;
}

async function findUserByEmail(email) {
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
}

async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [adminEmail]);
  if (rows.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`Creando usuario admin por defecto (${adminEmail})`);
    await createUser({
      name: 'Administrador',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
    });
  }
}

module.exports = {
  createUsersTable,
  createUser,
  findUserByEmail,
  ensureAdminUser,
};
