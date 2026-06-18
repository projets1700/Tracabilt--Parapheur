const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

const SECRET = process.env.JWT_SECRET || 'secret_dev_a_changer';
const tokenScanner = () => jwt.sign({ id: 'uuid-scan', role: 'scanner' }, SECRET);

describe('GET /api/parapheurs', () => {
  test('accessible sans token → 200', async () => {
    const res = await request(app).get('/api/parapheurs');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('parapheurs');
    expect(Array.isArray(res.body.parapheurs)).toBe(true);
  });

  test('réponse paginée avec total', async () => {
    const res = await request(app).get('/api/parapheurs');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
  });
});

describe('GET /api/parapheurs/:numero', () => {
  test('numéro inexistant → 404', async () => {
    const res = await request(app).get('/api/parapheurs/INEXISTANT-000');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/parapheurs', () => {
  test('sans token → 401', async () => {
    const res = await request(app).post('/api/parapheurs').send({ numero: 'TEST-001', titre: 'Test' });
    expect(res.status).toBe(401);
  });

  test('numéro manquant → 400', async () => {
    const res = await request(app)
      .post('/api/parapheurs')
      .set('Authorization', `Bearer ${tokenScanner()}`)
      .send({ titre: 'Sans numéro' });
    expect(res.status).toBe(400);
  });

  test('titre manquant → 400', async () => {
    const res = await request(app)
      .post('/api/parapheurs')
      .set('Authorization', `Bearer ${tokenScanner()}`)
      .send({ numero: 'TEST-001' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/parapheurs/:id', () => {
  test('sans token → 401', async () => {
    const res = await request(app).delete('/api/parapheurs/uuid-bidon');
    expect(res.status).toBe(401);
  });
});