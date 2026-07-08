const request = require('supertest');
const app = require('../src/app');

describe('POST /api/auth/scanner/connexion', () => {
  test('champs manquants → 400', async () => {
    const res = await request(app).post('/api/auth/scanner/connexion').send({ identifiant: 'test.user' });
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