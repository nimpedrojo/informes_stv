const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

describe('Aplicación de informes STV', () => {
  afterAll(async () => {
    await db.end();
  });

  test('redirección inicial a /login si no hay sesión', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('muestra página de login', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Iniciar sesión');
  });
});

