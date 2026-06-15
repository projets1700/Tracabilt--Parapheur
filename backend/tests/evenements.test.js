const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

const SECRET = process.env.JWT_SECRET || 'secret_dev_a_changer';

function tokenAdmin() {
  return jwt.sign({ id: 'uuid-admin', role: 'administrateur' }, SECRET);
}
function tokenOperateur() {
  return jwt.sign({ id: 'uuid-op', role: 'operateur' }, SECRET);
}

describe('POST /api/evenements/scan', () => {
  test('sans token → 401', async () => {
    const res = await request(app).post('/api/evenements/scan').send({ parapheur_reference: 'PAR-001' });
    expect(res.status).toBe(401);
  });

  test('référence manquante → 400', async () => {
    const res = await request(app)
      .post('/api/evenements/scan')
      .set('Authorization', `Bearer ${tokenOperateur()}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('latitude hors bornes → 400', async () => {
    const res = await request(app)
      .post('/api/evenements/scan')
      .set('Authorization', `Bearer ${tokenOperateur()}`)
      .send({ parapheur_reference: 'PAR-001', latitude: 999, longitude: 2.35 });
    expect(res.status).toBe(400);
  });

  test('parapheur inexistant → 404', async () => {
    const res = await request(app)
      .post('/api/evenements/scan')
      .set('Authorization', `Bearer ${tokenOperateur()}`)
      .send({ parapheur_reference: 'INEXISTANT-999' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/evenements', () => {
  test('sans token → 401', async () => {
    const res = await request(app).get('/api/evenements');
    expect(res.status).toBe(401);
  });

  test('token opérateur → 403', async () => {
    const res = await request(app)
      .get('/api/evenements')
      .set('Authorization', `Bearer ${tokenOperateur()}`);
    expect(res.status).toBe(403);
  });

  test('token admin → 200 avec pagination', async () => {
    const res = await request(app)
      .get('/api/evenements')
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('evenements');
    expect(res.body).toHaveProperty('total');
  });
});

describe('POST /api/evenements/sync', () => {
  test('sans scans → 400', async () => {
    const res = await request(app)
      .post('/api/evenements/sync')
      .set('Authorization', `Bearer ${tokenOperateur()}`)
      .send({ scans: [] });
    expect(res.status).toBe(400);
  });

  test('sans token → 401', async () => {
    const res = await request(app).post('/api/evenements/sync').send({ scans: [] });
    expect(res.status).toBe(401);
  });
});