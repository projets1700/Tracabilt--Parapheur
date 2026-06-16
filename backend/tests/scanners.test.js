const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

const SECRET = process.env.JWT_SECRET || 'secret_dev_a_changer';
const tokenAdmin   = () => jwt.sign({ id: 'uuid-admin', role: 'admin' },   SECRET);
const tokenScanner = () => jwt.sign({ id: 'uuid-scan',  role: 'scanner' }, SECRET);

describe('GET /api/scanners', () => {
  test('sans token → 401', async () => {
    const res = await request(app).get('/api/scanners');
    expect(res.status).toBe(401);
  });

  test('token scanner → 403', async () => {
    const res = await request(app)
      .get('/api/scanners')
      .set('Authorization', `Bearer ${tokenScanner()}`);
    expect(res.status).toBe(403);
  });

  test('token admin → 200 avec tableau', async () => {
    const res = await request(app)
      .get('/api/scanners')
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/scanners/statistiques', () => {
  test('token admin → 200 avec stats', async () => {
    const res = await request(app)
      .get('/api/scanners/statistiques')
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('parapheurs_actifs');
    expect(res.body).toHaveProperty('scans_aujourdhui');
    expect(res.body).toHaveProperty('total_scans');
  });
});

describe('POST /api/scanners', () => {
  test('champs manquants → 400', async () => {
    const res = await request(app)
      .post('/api/scanners')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send({ nom: 'Test' });
    expect(res.status).toBe(400);
  });

  test('mot de passe trop court → 400', async () => {
    const res = await request(app)
      .post('/api/scanners')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send({ nom: 'Test', identifiant: 't.test', mot_de_passe: '123' });
    expect(res.status).toBe(400);
  });

  test('sans token → 401', async () => {
    const res = await request(app)
      .post('/api/scanners')
      .send({ nom: 'Test', identifiant: 't.test', mot_de_passe: '123456' });
    expect(res.status).toBe(401);
  });
});