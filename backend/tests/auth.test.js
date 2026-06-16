const request = require('supertest');
const app = require('../src/app');

describe('POST /api/auth/admin/connexion', () => {
  test('champs manquants → 400', async () => {
    const res = await request(app).post('/api/auth/admin/connexion').send({ email: 'test@test.fr' });
    expect(res.status).toBe(400);
  });

  test('email invalide → 400', async () => {
    const res = await request(app).post('/api/auth/admin/connexion').send({ email: 'pasunemail', mot_de_passe: 'test' });
    expect(res.status).toBe(400);
  });

  test('identifiants incorrects → 401', async () => {
    const res = await request(app).post('/api/auth/admin/connexion').send({ email: 'faux@test.fr', mot_de_passe: 'faux' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/scanner/connexion', () => {
  test('champs manquants → 400', async () => {
    const res = await request(app).post('/api/auth/scanner/connexion').send({ identifiant: 'j.martin' });
    expect(res.status).toBe(400);
  });

  test('identifiants incorrects → 401', async () => {
    const res = await request(app).post('/api/auth/scanner/connexion').send({ identifiant: 'inconnu', mot_de_passe: 'faux' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/moi', () => {
  test('sans token → 401', async () => {
    const res = await request(app).get('/api/auth/moi');
    expect(res.status).toBe(401);
  });

  test('token invalide → 401', async () => {
    const res = await request(app).get('/api/auth/moi').set('Authorization', 'Bearer tokenbidon');
    expect(res.status).toBe(401);
  });
});