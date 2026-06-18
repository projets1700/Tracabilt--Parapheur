const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

const SECRET = process.env.JWT_SECRET || 'secret_dev_a_changer';
const tokenScanner = () => jwt.sign({ id: 'uuid-scan', role: 'scanner' }, SECRET);

describe('POST /api/scans', () => {
  test('sans token → 401', async () => {
    const res = await request(app).post('/api/scans').send({ parapheur_numero: 'PAR-001' });
    expect(res.status).toBe(401);
  });

  test('numéro manquant → 400', async () => {
    const res = await request(app)
      .post('/api/scans')
      .set('Authorization', `Bearer ${tokenScanner()}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('latitude hors bornes → 400', async () => {
    const res = await request(app)
      .post('/api/scans')
      .set('Authorization', `Bearer ${tokenScanner()}`)
      .send({ parapheur_numero: 'PAR-001', latitude: 999, longitude: 2.35 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/scans', () => {
  test('répond 200', async () => {
    const res = await request(app).get('/api/scans');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('scans');
    expect(res.body).toHaveProperty('total');
  });
});

describe('POST /api/scans/sync', () => {
  test('sans token → 401', async () => {
    const res = await request(app).post('/api/scans/sync').send({ scans: [] });
    expect(res.status).toBe(401);
  });

  test('tableau vide → 400', async () => {
    const res = await request(app)
      .post('/api/scans/sync')
      .set('Authorization', `Bearer ${tokenScanner()}`)
      .send({ scans: [] });
    expect(res.status).toBe(400);
  });
});