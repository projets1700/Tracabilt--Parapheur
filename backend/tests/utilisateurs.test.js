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

describe('GET /api/utilisateurs', () => {
  test('sans token → 401', async () => {
    const res = await request(app).get('/api/utilisateurs');
    expect(res.status).toBe(401);
  });

  test('token opérateur → 403', async () => {
    const res = await request(app)
      .get('/api/utilisateurs')
      .set('Authorization', `Bearer ${tokenOperateur()}`);
    expect(res.status).toBe(403);
  });

  test('token admin → 200 avec tableau', async () => {
    const res = await request(app)
      .get('/api/utilisateurs')
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/utilisateurs/statistiques', () => {
  test('token admin → 200 avec stats', async () => {
    const res = await request(app)
      .get('/api/utilisateurs/statistiques')
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('parapheurs_actifs');
    expect(res.body).toHaveProperty('scans_aujourdhui');
    expect(res.body).toHaveProperty('total_evenements');
  });
});

describe('POST /api/utilisateurs', () => {
  test('champs manquants → 400', async () => {
    const res = await request(app)
      .post('/api/utilisateurs')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send({ email: 'test@test.fr' });
    expect(res.status).toBe(400);
  });

  test('email invalide → 400', async () => {
    const res = await request(app)
      .post('/api/utilisateurs')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send({ nom: 'Test', prenom: 'A', email: 'pasunemail', mot_de_passe: '123456', role: 'operateur' });
    expect(res.status).toBe(400);
  });

  test('mot de passe trop court → 400', async () => {
    const res = await request(app)
      .post('/api/utilisateurs')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send({ nom: 'Test', prenom: 'A', email: 'ok@test.fr', mot_de_passe: '123', role: 'operateur' });
    expect(res.status).toBe(400);
  });

  test('rôle invalide → 400', async () => {
    const res = await request(app)
      .post('/api/utilisateurs')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send({ nom: 'Test', prenom: 'A', email: 'ok@test.fr', mot_de_passe: '123456', role: 'superadmin' });
    expect(res.status).toBe(400);
  });
});