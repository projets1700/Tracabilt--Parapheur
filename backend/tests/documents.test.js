/**
 * Module documentaire — tests unitaires (toujours exécutés) et tests
 * d'intégration complets (base PostgreSQL + LibreOffice), activés avec
 * TEST_INTEGRATION=1.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const JSZip = require('jszip');
const app = require('../src/app');
const ooxml = require('../src/documents/ooxml');
const pdfOutils = require('../src/documents/pdfOutils');
const { genererJeton, MOTIF_JETON } = require('../src/documents/qr');
const { pdfTest, docxTest, odtTest } = require('./fixtures/documents');

const SECRET = process.env.JWT_SECRET || 'secret_dev_a_changer';
process.env.JWT_SECRET = SECRET;
const jeton = role => jwt.sign({ id: '00000000-0000-4000-8000-000000000001', nom: `Test ${role}`, role }, SECRET);
const mm = v => (v * 72) / 25.4;

/* ====================================================================== */
describe('Documents — contrôle d\'accès', () => {
  test('sans token → 401', async () => {
    expect((await request(app).get('/api/documents/config')).status).toBe(401);
  });

  test('token scanner → 403', async () => {
    const res = await request(app).get('/api/documents').set('Authorization', `Bearer ${jeton('scanner')}`);
    expect(res.status).toBe(403);
  });

  test('token invalide → 401', async () => {
    const res = await request(app).get('/api/documents').set('Authorization', 'Bearer abc');
    expect(res.status).toBe(401);
  });
});

/* ====================================================================== */
describe('Documents — conversions de coordonnées', () => {
  const boite = { x: 20, y: 30, largeur: 500, hauteur: 760 };
  test.each([0, 90, 180, 270])('rotation %i : le coin haut-gauche affiché correspond au bon coin PDF', rot => {
    const attendu = { 0: { x: 20, y: 790 }, 90: { x: 20, y: 30 }, 180: { x: 520, y: 30 }, 270: { x: 520, y: 790 } }[rot];
    expect(pdfOutils.pointAfficheVersPdf(0, 0, boite, rot)).toEqual(attendu);
  });

  test('points → EMU', () => {
    expect(pdfOutils.pointsVersEmu(72)).toBe(914400); // 1 pouce
  });

  test('position hors page refusée, position valide acceptée', () => {
    const pages = [{ largeur: 595, hauteur: 842 }];
    const ok = { page_number: 1, position_x: 10, position_y: 10, width: mm(25), height: mm(25) };
    expect(pdfOutils.verifierPosition(ok, pages)).toBeNull();
    expect(pdfOutils.verifierPosition({ ...ok, position_x: 580 }, pages)).toMatch(/dépasse/);
    expect(pdfOutils.verifierPosition({ ...ok, page_number: 2 }, pages)).toMatch(/n'existe pas/);
    expect(pdfOutils.verifierPosition({ ...ok, width: mm(10), height: mm(10) }, pages)).toMatch(/15 mm/);
  });
});

/* ====================================================================== */
describe('Documents — OOXML', () => {
  test('parcours des paragraphes : tableaux repérés, zones de texte ignorées', () => {
    const xml = '<w:body><w:p/><w:tbl><w:tr><w:tc><w:p><w:r/></w:p></w:tc></w:tr></w:tbl>'
      + '<w:p><w:r><w:drawing><w:txbxContent><w:p/></w:txbxContent></w:drawing></w:r></w:p><w:p><w:pPr/></w:p></w:body>';
    const p = ooxml.parcourirParagraphes(xml);
    expect(p).toHaveLength(4);
    expect(p.map(x => x.dansTableau)).toEqual([false, true, false, false]);
  });

  test('noms de signets encodés par LibreOffice', () => {
    expect(ooxml.indexDepuisSignet('_TQP12')).toBe(12);
    expect(ooxml.indexDepuisSignet('5FTQP3')).toBe(3);
    expect(ooxml.indexDepuisSignet('Autre')).toBeNull();
  });

  test('insertion d\'un QR ancré à la page, original intact', async () => {
    const original = await docxTest({ paragraphes: 5, lignesTableau: 2 });
    const copie = Buffer.from(original);
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const sortie = await ooxml.insererQrCodes(original, [{ paragraphe: 2, reference: 'TQ-TEST', png, emu: { x: 100, y: 200, cx: 300, cy: 300 } }]);
    expect(original.equals(copie)).toBe(true);
    const zip = await JSZip.loadAsync(sortie);
    const xml = await zip.file('word/document.xml').async('string');
    expect(xml).toContain('<wp:positionH relativeFrom="page"><wp:posOffset>100</wp:posOffset>');
    expect(xml).toContain('locked="1"');
    expect(xml).toMatch(/xmlns:wp="/);
    expect(zip.file('word/media/tq_qr_1.png')).toBeTruthy();
    expect(await zip.file('word/_rels/document.xml.rels').async('string')).toContain('media/tq_qr_1.png');
    expect(await zip.file('[Content_Types].xml').async('string')).toContain('Extension="png"');
  });

  test('jeton de QR code non prédictible', () => {
    const a = genererJeton();
    expect(a).toMatch(MOTIF_JETON);
    expect(genererJeton()).not.toBe(a);
  });
});

/* ====================================================================== */
const integration = process.env.TEST_INTEGRATION === '1' ? describe : describe.skip;

integration('Documents — parcours complet (PostgreSQL + LibreOffice)', () => {
  jest.setTimeout(10 * 60 * 1000);
  const pool = require('../src/config/db');
  const admin = () => `Bearer ${jeton('admin')}`;
  const sup = () => `Bearer ${jeton('superviseur')}`;
  let parapheur;
  const numero = `TEST-DOC-${Date.now()}`;

  beforeAll(async () => {
    const { rows } = await pool.query('INSERT INTO parapheurs (numero, titre) VALUES ($1, $2) RETURNING *', [numero, 'Parapheur de test']);
    parapheur = rows[0];
    await pool.query("DELETE FROM parametres WHERE cle LIKE 'documents.%'");
  });

  afterAll(async () => {
    await pool.query("DELETE FROM parametres WHERE cle LIKE 'documents.%'");
    await pool.query('DELETE FROM parapheurs WHERE id = $1', [parapheur.id]);
    await pool.end();
  });

  async function importer(octets, nom, avecParapheur = true) {
    const req = request(app).post('/api/documents').set('Authorization', sup());
    if (avecParapheur) req.field('parapheur_id', parapheur.id);
    return req.attach('fichier', octets, nom);
  }

  test('configuration par défaut', async () => {
    const res = await request(app).get('/api/documents/config').set('Authorization', sup());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ taille_max_octets: 20 * 1024 * 1024, qr_contenu: 'numero' });
  });

  test('seul l\'administrateur modifie la configuration', async () => {
    expect((await request(app).put('/api/documents/config').set('Authorization', sup()).send({ taille_max_octets: 1e6 })).status).toBe(403);
    const res = await request(app).put('/api/documents/config').set('Authorization', admin()).send({ taille_max_octets: 1 });
    expect(res.status).toBe(400);
  });

  test('fichiers refusés : faux PDF, faux .doc, format inconnu', async () => {
    expect((await importer(Buffer.from('pas un pdf'), 'faux.pdf')).status).toBe(415);
    expect((await importer(Buffer.from('x'), 'ancien.doc')).status).toBe(415);
    expect((await importer(Buffer.from('x'), 'image.png')).status).toBe(415);
  });

  test('taille maximale configurable', async () => {
    await request(app).put('/api/documents/config').set('Authorization', admin()).send({ taille_max_octets: 200 * 1024 });
    const gros = Buffer.concat([await pdfTest(), Buffer.alloc(300 * 1024)]);
    expect((await importer(gros, 'gros.pdf')).status).toBe(413);
    await request(app).put('/api/documents/config').set('Authorization', admin()).send({ taille_max_octets: 20 * 1024 * 1024 });
  });

  describe('document PDF', () => {
    let doc;
    let qr;
    const original = [];

    test('REC-02 import PDF', async () => {
      const octets = await pdfTest({ pages: 3, rotations: [0, 90, 0] });
      original.push(octets);
      const res = await importer(octets, 'Courrier été.pdf');
      expect(res.status).toBe(201);
      doc = res.body.document;
      expect(doc).toMatchObject({ name: 'Courrier été.pdf', original_format: 'pdf', status: 'importe', parapheur_id: parapheur.id, page_count: 3 });
      expect(doc).not.toHaveProperty('original_path');
    });

    test('aperçu = PDF original', async () => {
      const res = await request(app).get(`/api/documents/${doc.id}/preview`).set('Authorization', sup()).buffer(true);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(Buffer.compare(res.body, original[0])).toBe(0);
    });

    test('REC-04 ajout de QR code (hors page refusé)', async () => {
      const base = { parapheur_id: parapheur.id, page_number: 2, position_x: mm(15), position_y: mm(15), width: mm(25), height: mm(25) };
      expect((await request(app).post(`/api/documents/${doc.id}/qrcodes`).set('Authorization', sup()).send({ ...base, position_x: 2000 })).status).toBe(422);
      expect((await request(app).post(`/api/documents/${doc.id}/qrcodes`).set('Authorization', sup()).send({ ...base, page_number: 9 })).status).toBe(422);
      const res = await request(app).post(`/api/documents/${doc.id}/qrcodes`).set('Authorization', sup()).send(base);
      expect(res.status).toBe(201);
      qr = res.body.qrcode;
      // Numéro de parapheur unique attribué automatiquement, encodé dans le QR code
      expect(qr.numero).toMatch(/^DEP-\d{6}$/);
      expect(qr.content).toBe(qr.numero);
      const p = await pool.query('SELECT titre FROM parapheurs WHERE numero = $1', [qr.numero]);
      expect(p.rows[0].titre).toBe('Courrier été.pdf');
      expect(qr.reference).toMatch(MOTIF_JETON);
      expect(qr.position).toMatchObject({ page_number: 2 });
    });

    test('REC-05/06 déplacement et redimensionnement', async () => {
      const res = await request(app).put(`/api/documents/${doc.id}/qrcodes/${qr.id}`).set('Authorization', sup())
        .send({ page_number: 1, position_x: mm(150), position_y: mm(250), width: mm(30), height: mm(30) });
      expect(res.status).toBe(200);
      const lu = await request(app).get(`/api/documents/${doc.id}`).set('Authorization', sup());
      expect(lu.body.qrcodes).toHaveLength(1);
      expect(lu.body.qrcodes[0].position.page_number).toBe(1);
      expect(lu.body.qrcodes[0].position.width).toBeCloseTo(mm(30), 1);
      expect(lu.body.document.status).toBe('en_edition');
    });

    test('REC-07 plusieurs QR codes, dont un sur une page tournée', async () => {
      const res = await request(app).post(`/api/documents/${doc.id}/qrcodes`).set('Authorization', sup())
        .send({ page_number: 2, position_x: mm(15), position_y: mm(15), width: mm(25), height: mm(25) });
      expect(res.status).toBe(201);
    });

    test('REC-08 génération PDF + REC-11 original inchangé', async () => {
      const res = await request(app).post(`/api/documents/${doc.id}/generate`).set('Authorization', sup()).send({ format: 'pdf' });
      expect(res.status).toBe(200);
      expect(res.body.document).toMatchObject({ status: 'genere', generated_format: 'pdf', generated_name: 'Courrier été_QR.pdf' });

      const exp = await request(app).get(`/api/documents/${doc.id}/export`).set('Authorization', sup()).buffer(true);
      expect(exp.status).toBe(200);
      expect(exp.headers['content-disposition']).toContain("filename*=UTF-8''Courrier%20%C3%A9t%C3%A9_QR.pdf");
      expect(exp.body.subarray(0, 5).toString()).toBe('%PDF-');
      expect(exp.body.length).toBeGreaterThan(original[0].length);

      const orig = await request(app).get(`/api/documents/${doc.id}/export?version=original`).set('Authorization', sup()).buffer(true);
      expect(Buffer.compare(orig.body, original[0])).toBe(0);
    });

    test('export DOCX d\'un PDF (reconstruction LibreOffice)', async () => {
      const res = await request(app).post(`/api/documents/${doc.id}/generate`).set('Authorization', sup()).send({ format: 'docx' });
      expect(res.status).toBe(200);
      expect(res.body.document.generated_format).toBe('docx');
      const exp = await request(app).get(`/api/documents/${doc.id}/export`).set('Authorization', sup()).buffer(true)
        .parse((r, cb) => { const d = []; r.on('data', c => d.push(c)); r.on('end', () => cb(null, Buffer.concat(d))); });
      expect(exp.body.subarray(0, 2).toString()).toBe('PK');
    });

    test('REC-12 numéros uniques / REC-13 historique', async () => {
      const lu = await request(app).get(`/api/documents/${doc.id}`).set('Authorization', sup());
      const numeros = lu.body.qrcodes.map(q => q.numero);
      expect(new Set(numeros).size).toBe(numeros.length);
      // Le document est retrouvé depuis la fiche du parapheur DEP de chacun de ses QR codes
      const { rows: [p] } = await pool.query('SELECT id FROM parapheurs WHERE numero = $1', [numeros[0]]);
      const liste = await request(app).get(`/api/documents?parapheur_id=${p.id}`).set('Authorization', sup());
      expect(liste.body.documents.some(d => d.id === doc.id && Number(d.qr_count) === 2)).toBe(true);
      expect(liste.body.documents.find(d => d.id === doc.id).qr_numeros.split(', ').sort()).toEqual([...numeros].sort());
      const h = await request(app).get(`/api/documents/${doc.id}/history`).set('Authorization', sup());
      const actions = h.body.historique.map(e => e.action);
      for (const a of ['import', 'association_parapheur', 'ajout_qr', 'modification_position', 'generation', 'export']) {
        expect(actions).toContain(a);
      }
      expect(h.body.historique[0]).toHaveProperty('user_name', 'Test superviseur');
    });

    test('suppression d\'un QR code', async () => {
      expect((await request(app).delete(`/api/documents/${doc.id}/qrcodes/${qr.id}`).set('Authorization', sup())).status).toBe(204);
      const lu = await request(app).get(`/api/documents/${doc.id}`).set('Authorization', sup());
      expect(lu.body.qrcodes).toHaveLength(1);
    });

    test('suppression du document réservée à l\'administrateur', async () => {
      expect((await request(app).delete(`/api/documents/${doc.id}`).set('Authorization', sup())).status).toBe(403);
      expect((await request(app).delete(`/api/documents/${doc.id}`).set('Authorization', admin())).status).toBe(204);
      expect((await request(app).get(`/api/documents/${doc.id}`).set('Authorization', sup())).status).toBe(404);
    });
  });

  describe('documents Word et OpenDocument : conversion en PDF', () => {
    const docs = [];
    const lireBinaire = (r, cb) => { const d = []; r.on('data', c => d.push(c)); r.on('end', () => cb(null, Buffer.concat(d))); };
    const cas = [
      ['docx', 'Note de service.docx', () => docxTest()],
      ['odt', 'Compte rendu.odt', () => odtTest()],
      ['doc', 'Ancien courrier.doc', async () => require('../src/documents/libreoffice').convertir(await docxTest({ paragraphes: 10, lignesTableau: 2 }), 'docx', 'doc:MS Word 97', 'doc')],
    ];

    test.each(cas)('REC-01 import %s → converti en PDF, original conservé', async (format, nom, fabriquer) => {
      const source = await fabriquer();
      const res = await importer(source, nom);
      expect(res.status).toBe(201);
      const doc = res.body.document;
      docs.push(doc);
      expect(doc).toMatchObject({ name: nom, original_format: 'pdf', source_format: format, status: 'importe' });
      expect(doc.page_count).toBeGreaterThanOrEqual(1);

      // Aperçu = PDF converti
      const ap = await request(app).get(`/api/documents/${doc.id}/preview`).set('Authorization', sup()).buffer(true);
      expect(ap.body.subarray(0, 5).toString()).toBe('%PDF-');

      // L'original est rendu tel quel, dans son format d'origine
      const orig = await request(app).get(`/api/documents/${doc.id}/export?version=original`).set('Authorization', sup()).buffer(true).parse(lireBinaire);
      expect(Buffer.compare(orig.body, source)).toBe(0);

      // Historique : import + conversion
      const h = await request(app).get(`/api/documents/${doc.id}/history`).set('Authorization', sup());
      expect(h.body.historique.map(e => e.action)).toEqual(expect.arrayContaining(['import', 'conversion']));
    });

    test('REC-08 génération PDF avec QR à partir d\'un document converti', async () => {
      const doc = docs[0];
      const res = await request(app).post(`/api/documents/${doc.id}/qrcodes`).set('Authorization', sup())
        .send({ page_number: 1, position_x: mm(20), position_y: mm(30), width: mm(25), height: mm(25) });
      expect(res.status).toBe(201);
      const gen = await request(app).post(`/api/documents/${doc.id}/generate`).set('Authorization', sup()).send({ format: 'pdf' });
      expect(gen.status).toBe(200);
      expect(gen.body.document.generated_name).toBe('Note de service_QR.pdf');
      const exp = await request(app).get(`/api/documents/${doc.id}/export`).set('Authorization', sup()).buffer(true);
      expect(exp.headers['content-type']).toContain('application/pdf');
      const pages = await pdfOutils.infosPages(exp.body);
      expect(pages).toHaveLength(doc.page_count);
    });

    test('faux .odt et faux .doc refusés', async () => {
      // Archive ZIP illisible → fichier corrompu (422) ; signature absente → type refusé (415).
      expect((await importer(Buffer.from('PK\x03\x04rien'), 'faux.odt')).status).toBe(422);
      expect((await importer(Buffer.from('texte brut'), 'faux2.odt')).status).toBe(415);
      expect((await importer(Buffer.from('pas un doc'), 'faux.doc')).status).toBe(415);
    });

    afterAll(async () => {
      for (const d of docs) await request(app).delete(`/api/documents/${d.id}`).set('Authorization', admin());
    });
  });

  describe('noms des QR codes : choisis par l\'utilisateur, uniques', () => {
    const docs = [];
    const posQr = (x = 20) => ({ page_number: 1, position_x: x, position_y: 20, width: mm(25), height: mm(25) });
    const creer = (doc, nom, x) => request(app).post(`/api/documents/${doc.id}/qrcodes`).set('Authorization', sup()).send({ nom, ...posQr(x) });
    let d1;
    let d2;

    beforeAll(async () => {
      // Repart d'un état propre si une exécution précédente a été interrompue.
      const nomsDeTest = ['NOTE-SERVICE-1', 'COURSE-1', 'A-RENOMMER', 'RENOMME-1', 'LIBERE-1', 'PAR-EXISTANT-1', 'VISITEUR-1'];
      await pool.query('DELETE FROM qr_codes WHERE numero = ANY($1)', [nomsDeTest]);
      await pool.query('DELETE FROM noms_qr WHERE numero = ANY($1)', [nomsDeTest]);
      await pool.query('DELETE FROM parapheurs WHERE numero = ANY($1) AND NOT EXISTS (SELECT 1 FROM scans s WHERE s.parapheur_id = parapheurs.id)', [nomsDeTest]);
      d1 = (await importer(await pdfTest(), 'noms-1.pdf')).body.document;
      d2 = (await importer(await pdfTest(), 'noms-2.pdf')).body.document;
      docs.push(d1, d2);
    });

    test('le nom saisi est utilisé (en majuscules) et encodé dans le QR code', async () => {
      const r = await creer(d1, '  note-service-1 ');
      expect(r.status).toBe(201);
      expect(r.body.qrcode.numero).toBe('NOTE-SERVICE-1');
      expect(r.body.qrcode.content).toBe('NOTE-SERVICE-1');
      const p = await pool.query('SELECT titre, cree_par_qr FROM parapheurs WHERE numero = $1', ['NOTE-SERVICE-1']);
      expect(p.rows[0]).toMatchObject({ titre: 'noms-1.pdf', cree_par_qr: true });
    });

    test('même nom refusé : même document, autre document, autre casse', async () => {
      expect((await creer(d1, 'NOTE-SERVICE-1', 80)).status).toBe(409);
      const r = await creer(d2, 'note-service-1');
      expect(r.status).toBe(409);
      expect(r.body.message).toMatch(/déjà utilisé/);
    });

    test('nom invalide refusé', async () => {
      expect((await creer(d1, 'avec espace')).status).toBe(400);
      expect((await creer(d1, 'é-accent')).status).toBe(400);
      expect((await creer(d1, 'X'.repeat(51))).status).toBe(400);
      expect((await creer(d1, '-TIRET')).status).toBe(400);
    });

    test('10 créations simultanées du même nom : une seule réussit', async () => {
      const res = await Promise.all(Array.from({ length: 10 }, (_, i) => creer(d2, 'COURSE-1', 20 + i)));
      expect(res.filter(r => r.status === 201)).toHaveLength(1);
      expect(res.filter(r => r.status === 409)).toHaveLength(9);
    });

    test('sans nom : un nom libre DEP est attribué', async () => {
      const r = await request(app).post(`/api/documents/${d1.id}/qrcodes`).set('Authorization', sup()).send(posQr(120));
      expect(r.body.qrcode.numero).toMatch(/^DEP-\d{6}$/);
    });

    test('renommage : nom libre accepté, nom pris refusé, ancien nom libéré', async () => {
      const qr = (await creer(d1, 'A-RENOMMER', 160)).body.qrcode;
      expect((await request(app).put(`/api/documents/${d1.id}/qrcodes/${qr.id}`).set('Authorization', sup()).send({ nom: 'COURSE-1' })).status).toBe(409);
      const ok = await request(app).put(`/api/documents/${d1.id}/qrcodes/${qr.id}`).set('Authorization', sup()).send({ nom: 'renomme-1' });
      expect(ok.status).toBe(200);
      expect(ok.body.qrcode).toMatchObject({ numero: 'RENOMME-1', content: 'RENOMME-1' });
      // L'ancien nom est de nouveau disponible, son parapheur (jamais scanné) a été retiré
      expect((await pool.query('SELECT 1 FROM parapheurs WHERE numero = $1', ['A-RENOMMER'])).rows).toHaveLength(0);
      expect((await creer(d2, 'A-RENOMMER', 200)).status).toBe(201);
      const h = await request(app).get(`/api/documents/${d1.id}/history`).set('Authorization', sup());
      expect(h.body.historique.map(e => e.action)).toContain('renommage_qr');
    });

    test('supprimer un QR code libère son nom', async () => {
      const qr = (await creer(d1, 'LIBERE-1', 240)).body.qrcode;
      await request(app).delete(`/api/documents/${d1.id}/qrcodes/${qr.id}`).set('Authorization', sup());
      expect((await creer(d2, 'LIBERE-1', 240)).status).toBe(201);
    });

    test('nom d\'un parapheur existant : QR rattaché, parapheur jamais supprimé', async () => {
      await pool.query("INSERT INTO parapheurs (numero, titre) VALUES ('PAR-EXISTANT-1', 'Parapheur existant') ON CONFLICT DO NOTHING");
      const qr = (await creer(d1, 'PAR-EXISTANT-1', 280)).body.qrcode;
      const { rows: [p] } = await pool.query("SELECT id, cree_par_qr FROM parapheurs WHERE numero = 'PAR-EXISTANT-1'");
      expect(qr.parapheur_id).toBe(p.id);
      expect(p.cree_par_qr).toBe(false);
      await request(app).delete(`/api/documents/${d1.id}/qrcodes/${qr.id}`).set('Authorization', sup());
      expect((await pool.query("SELECT 1 FROM parapheurs WHERE numero = 'PAR-EXISTANT-1'")).rows).toHaveLength(1);
      await pool.query("DELETE FROM parapheurs WHERE numero = 'PAR-EXISTANT-1'");
    });

    test('visiteur : suggestion, réservation unique, libération avec sa clé uniquement', async () => {
      const sug = await request(app).get('/api/documents/noms-qr/suggestion');
      expect(sug.status).toBe(200);
      expect(sug.body.nom).toMatch(/^DEP-\d{6}$/);

      const res = await request(app).post('/api/documents/noms-qr').send({ nom: 'visiteur-1' });
      expect(res.status).toBe(201);
      expect(res.body.nom).toBe('VISITEUR-1');
      // Nom pris : refusé pour un autre visiteur ET pour un utilisateur connecté
      expect((await request(app).post('/api/documents/noms-qr').send({ nom: 'VISITEUR-1' })).status).toBe(409);
      expect((await creer(d1, 'VISITEUR-1', 320)).status).toBe(409);
      // … et un nom pris par un utilisateur connecté est refusé au visiteur
      expect((await request(app).post('/api/documents/noms-qr').send({ nom: 'NOTE-SERVICE-1' })).status).toBe(409);

      // Mauvaise clé : rien n'est libéré ; bonne clé : nom libéré
      await request(app).delete('/api/documents/noms-qr/VISITEUR-1').set('X-Cle-Nom', 'mauvaise');
      expect((await request(app).post('/api/documents/noms-qr').send({ nom: 'VISITEUR-1' })).status).toBe(409);
      await request(app).delete('/api/documents/noms-qr/VISITEUR-1').set('X-Cle-Nom', res.body.cle);
      expect((await request(app).post('/api/documents/noms-qr').send({ nom: 'VISITEUR-1' })).status).toBe(201);
      // Un visiteur ne peut pas libérer le nom d'un QR code enregistré
      await request(app).delete('/api/documents/noms-qr/NOTE-SERVICE-1').set('X-Cle-Nom', res.body.cle);
      expect((await creer(d2, 'NOTE-SERVICE-1', 330)).status).toBe(409);
    });

    afterAll(async () => {
      for (const d of docs) await request(app).delete(`/api/documents/${d.id}`).set('Authorization', admin());
      await pool.query("DELETE FROM noms_qr WHERE numero LIKE 'VISITEUR-%'");
    });
  });

  describe('conversion publique (visiteurs non connectés)', () => {
    test('Word → PDF sans connexion, rien n\'est enregistré', async () => {
      const avant = (await pool.query('SELECT COUNT(*) FROM documents')).rows[0].count;
      const res = await request(app).post('/api/documents/conversion-pdf').attach('fichier', await docxTest(), 'Lettre.docx').buffer(true);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('Lettre.pdf');
      expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
      expect((await pool.query('SELECT COUNT(*) FROM documents')).rows[0].count).toBe(avant);
    });

    test('ODT → PDF sans connexion', async () => {
      const res = await request(app).post('/api/documents/conversion-pdf').attach('fichier', await odtTest(), 'note.odt').buffer(true);
      expect(res.status).toBe(200);
      expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    });

    test('fichiers refusés : PDF (déjà converti), format inconnu, faux Word', async () => {
      expect((await request(app).post('/api/documents/conversion-pdf').attach('fichier', await pdfTest(), 'a.pdf')).status).toBe(400);
      expect((await request(app).post('/api/documents/conversion-pdf').attach('fichier', Buffer.from('x'), 'a.exe')).status).toBe(415);
      expect((await request(app).post('/api/documents/conversion-pdf').attach('fichier', Buffer.from('x'), 'a.docx')).status).toBe(415);
    });

    test('les autres routes restent protégées', async () => {
      expect((await request(app).get('/api/documents')).status).toBe(401);
      expect((await request(app).post('/api/documents').attach('fichier', await pdfTest(), 'a.pdf')).status).toBe(401);
    });
  });

  describe('mode jeton + scan mobile', () => {
    let doc;
    let qr;

    beforeAll(async () => {
      await pool.query(
        `INSERT INTO scanners (id, nom, identifiant, password_hash) VALUES ('00000000-0000-4000-8000-000000000001', 'Scanner test', $1, 'x')
         ON CONFLICT (id) DO NOTHING`,
        [`scanner-test-${Date.now()}`],
      );
    });

    test('QR « jeton » résolu lors du scan', async () => {
      await request(app).put('/api/documents/config').set('Authorization', admin()).send({ qr_contenu: 'jeton' });
      doc = (await importer(await pdfTest(), 'jeton.pdf')).body.document;
      qr = (await request(app).post(`/api/documents/${doc.id}/qrcodes`).set('Authorization', sup())
        .send({ page_number: 1, position_x: 20, position_y: 20, width: mm(25), height: mm(25) })).body.qrcode;
      expect(qr.content).toBe(qr.reference);

      const scan = await request(app).post('/api/scans').set('Authorization', `Bearer ${jeton('scanner')}`)
        .send({ parapheur_numero: qr.content });
      expect(scan.status).toBe(201);
      expect(scan.body.parapheur_numero).toBe(qr.numero);

      const inconnu = await request(app).post('/api/scans').set('Authorization', `Bearer ${jeton('scanner')}`)
        .send({ parapheur_numero: genererJeton() });
      expect(inconnu.status).toBe(404);
    });

    afterAll(async () => {
      // Le scan a été enregistré sur le parapheur DEP du QR code.
      await pool.query('DELETE FROM scans WHERE parapheur_id IN (SELECT id FROM parapheurs WHERE numero = $1) OR parapheur_id = $2', [qr?.numero, parapheur.id]);
      await pool.query("DELETE FROM scanners WHERE id = '00000000-0000-4000-8000-000000000001'");
      if (doc) await request(app).delete(`/api/documents/${doc.id}`).set('Authorization', admin());
    });
  });
});
