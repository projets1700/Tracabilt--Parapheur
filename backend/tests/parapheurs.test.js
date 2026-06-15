const request = require('supertest');
const app = require('../src/app');

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

describe('GET /api/parapheurs/:reference', () => {
  test('référence inexistante → 404', async () => {
    const res = await request(app).get('/api/parapheurs/INEXISTANT-000');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/parapheurs', () => {
  test('sans token → 401', async () => {
    const res = await request(app).post('/api/parapheurs').send({ reference: 'TEST-001' });
    expect(res.status).toBe(401);
  });

  test('token non-admin → 403', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 'uuid', role: 'operateur' }, process.env.JWT_SECRET || 'secret_dev_a_changer');
    const res = await request(app)
      .post('/api/parapheurs')
      .set('Authorization', `Bearer ${token}`)
      .send({ reference: 'TEST-001' });
    expect(res.status).toBe(403);
  });

  test('référence manquante → 400', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 'uuid', role: 'administrateur' }, process.env.JWT_SECRET || 'secret_dev_a_changer');
    const res = await request(app)
      .post('/api/parapheurs')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'sans référence' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/parapheurs/:id', () => {
  test('sans token → 401', async () => {
    const res = await request(app).delete('/api/parapheurs/uuid-bidon');
    expect(res.status).toBe(401);
  });
});