/**
 * Module documentaire — le serveur ne conserve AUCUN document ni QR code :
 * seulement les noms des QR codes (unicité). Tests unitaires (toujours exécutés)
 * et tests d'intégration (PostgreSQL + LibreOffice), activés avec TEST_INTEGRATION=1.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { validerFichier } = require('../src/documents/validationFichier');
const { pdfTest, docxTest, odtTest } = require('./fixtures/documents');

const SECRET = process.env.JWT_SECRET || 'secret_dev_a_changer';
process.env.JWT_SECRET = SECRET;

/* ====================================================================== */
describe('Documents — aucun stockage de document sur le serveur', () => {
  test.each([
    ['get', '/api/documents'],
    ['post', '/api/documents'],
    ['get', '/api/documents/config'],
    ['get', '/api/documents/00000000-0000-4000-8000-000000000001'],
    ['post', '/api/documents/00000000-0000-4000-8000-000000000001/qrcodes'],
    ['post', '/api/documents/00000000-0000-4000-8000-000000000001/generate'],
  ])('%s %s → 404 (route supprimée)', async (methode, url) => {
    const admin = jwt.sign({ id: 'x', role: 'admin' }, SECRET);
    expect((await request(app)[methode](url).set('Authorization', `Bearer ${admin}`)).status).toBe(404);
  });
});

/* ====================================================================== */
describe('Documents — contrôle des fichiers à convertir', () => {
  const MAX = 20 * 1024 * 1024;
  test('formats acceptés et refusés', async () => {
    await expect(validerFichier('a.pdf', await pdfTest(), MAX)).resolves.toMatchObject({ format: 'pdf', aConvertir: false });
    await expect(validerFichier('a.docx', await docxTest(), MAX)).resolves.toMatchObject({ format: 'docx', aConvertir: true });
    await expect(validerFichier('a.odt', await odtTest(), MAX)).resolves.toMatchObject({ format: 'odt', aConvertir: true });
    await expect(validerFichier('a.exe', Buffer.from('x'), MAX)).rejects.toMatchObject({ statut: 415 });
    await expect(validerFichier('a.pdf', Buffer.from('pas un pdf'), MAX)).rejects.toMatchObject({ statut: 415 });
    await expect(validerFichier('a.doc', Buffer.from('pas un doc'), MAX)).rejects.toMatchObject({ statut: 415 });
    await expect(validerFichier('a.pdf', await pdfTest(), 10)).rejects.toMatchObject({ statut: 413 });
  });
});

/* ====================================================================== */
const integration = process.env.TEST_INTEGRATION === '1' ? describe : describe.skip;

integration('Documents — noms des QR codes et conversion (PostgreSQL + LibreOffice)', () => {
  jest.setTimeout(10 * 60 * 1000);
  const pool = require('../src/config/db');
  const sfx = Date.now().toString(36).toUpperCase();
  const nom = base => `${base}-${sfx}`;
  const compter = async table => Number((await pool.query(`SELECT COUNT(*) FROM ${table}`)).rows[0].count);
  const reserver = n => request(app).post('/api/documents/noms-qr').send({ nom: n });
  let avant;

  beforeAll(async () => {
    avant = { documents: await compter('documents'), qr: await compter('qr_codes'), parapheurs: await compter('parapheurs') };
  });

  afterAll(async () => {
    await pool.query('DELETE FROM noms_qr WHERE numero LIKE $1', [`%-${sfx}`]);
    await pool.end();
  });

  test('suggestion d\'un nom libre DEP-xxxxxx, sans rien réserver', async () => {
    const r = await request(app).get('/api/documents/noms-qr/suggestion');
    expect(r.status).toBe(200);
    expect(r.body.nom).toMatch(/^DEP-\d{6}$/);
    expect((await pool.query('SELECT 1 FROM noms_qr WHERE numero = $1', [r.body.nom])).rows).toHaveLength(0);
  });

  test('le nom choisi est réservé (en majuscules), sans connexion', async () => {
    const r = await reserver(`  ${nom('note-service').toLowerCase()} `);
    expect(r.status).toBe(201);
    expect(r.body.nom).toBe(nom('NOTE-SERVICE'));
    expect(r.body.cle).toBeTruthy();
  });

  test('jamais deux fois le même nom (même casse différente)', async () => {
    const r = await reserver(nom('NOTE-SERVICE').toLowerCase());
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/déjà utilisé/);
  });

  test('10 demandes simultanées du même nom : une seule réussit', async () => {
    const res = await Promise.all(Array.from({ length: 10 }, () => reserver(nom('COURSE'))));
    expect(res.filter(r => r.status === 201)).toHaveLength(1);
    expect(res.filter(r => r.status === 409)).toHaveLength(9);
  });

  test('nom invalide refusé', async () => {
    for (const n of ['avec espace', 'é-accent', 'X'.repeat(51), '-TIRET', '']) {
      expect((await reserver(n)).status).toBe(400);
    }
  });

  test('nom d\'un parapheur existant refusé (un QR code porte déjà ce nom)', async () => {
    await pool.query('INSERT INTO parapheurs (numero, titre) VALUES ($1, $1)', [nom('EXISTANT')]);
    expect((await reserver(nom('EXISTANT'))).status).toBe(409);
    await pool.query('DELETE FROM parapheurs WHERE numero = $1', [nom('EXISTANT')]);
  });

  test('libération uniquement avec la bonne clé', async () => {
    const { body } = await reserver(nom('LIBERE'));
    await request(app).delete(`/api/documents/noms-qr/${nom('LIBERE')}`).set('X-Cle-Nom', 'mauvaise');
    expect((await reserver(nom('LIBERE'))).status).toBe(409);
    await request(app).delete(`/api/documents/noms-qr/${nom('LIBERE')}`).set('X-Cle-Nom', body.cle);
    expect((await reserver(nom('LIBERE'))).status).toBe(201);
  });

  test('aucun document, QR code ni parapheur enregistré par ces opérations', async () => {
    expect(await compter('documents')).toBe(avant.documents);
    expect(await compter('qr_codes')).toBe(avant.qr);
    expect(await compter('parapheurs')).toBe(avant.parapheurs);
  });

  test('le parapheur est créé au premier scan du QR code', async () => {
    const idScanner = '00000000-0000-4000-8000-000000000002';
    await pool.query(
      "INSERT INTO scanners (id, nom, identifiant, password_hash) VALUES ($1, 'Scanner test', $2, 'x') ON CONFLICT (id) DO NOTHING",
      [idScanner, `scanner-${sfx}`],
    );
    const jetonScanner = jwt.sign({ id: idScanner, role: 'scanner' }, SECRET);
    const scan = await request(app).post('/api/scans').set('Authorization', `Bearer ${jetonScanner}`).send({ parapheur_numero: nom('NOTE-SERVICE') });
    expect(scan.status).toBe(201);
    const { rows: [p] } = await pool.query('SELECT id FROM parapheurs WHERE numero = $1', [nom('NOTE-SERVICE')]);
    expect(p).toBeTruthy();
    await pool.query('DELETE FROM scans WHERE parapheur_id = $1', [p.id]);
    await pool.query('DELETE FROM parapheurs WHERE id = $1', [p.id]);
    await pool.query('DELETE FROM scanners WHERE id = $1', [idScanner]);
  });

  describe('conversion Word / ODT → PDF, sans rien conserver', () => {
    test.each([
      ['docx', 'Note de service.docx', () => docxTest()],
      ['odt', 'Compte rendu.odt', () => odtTest()],
      ['doc', 'Ancien courrier.doc', async () => require('../src/documents/libreoffice').convertir(await docxTest({ paragraphes: 10, lignesTableau: 2 }), 'docx', 'doc:MS Word 97', 'doc')],
    ])('%s → PDF', async (format, nomFichier, fabriquer) => {
      const r = await request(app).post('/api/documents/conversion-pdf').attach('fichier', await fabriquer(), nomFichier).buffer(true);
      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toContain('application/pdf');
      expect(r.headers['content-disposition']).toContain(encodeURIComponent(nomFichier.replace(/\.[^.]+$/, '.pdf')));
      expect(r.body.subarray(0, 5).toString()).toBe('%PDF-');
    });

    test('fichiers refusés : PDF (déjà converti), format inconnu, faux Word', async () => {
      expect((await request(app).post('/api/documents/conversion-pdf').attach('fichier', await pdfTest(), 'a.pdf')).status).toBe(400);
      expect((await request(app).post('/api/documents/conversion-pdf').attach('fichier', Buffer.from('x'), 'a.exe')).status).toBe(415);
      expect((await request(app).post('/api/documents/conversion-pdf').attach('fichier', Buffer.from('x'), 'a.docx')).status).toBe(415);
    });

    test('rien n\'est enregistré par les conversions', async () => {
      expect(await compter('documents')).toBe(avant.documents);
    });
  });
});
