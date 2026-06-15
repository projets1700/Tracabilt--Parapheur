require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Insertion des données de démonstration...');

    const hashAdmin = await bcrypt.hash('admin123', 10);
    const hashOp = await bcrypt.hash('operateur123', 10);

    // Utilisateurs de démo
    await client.query(`
      INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role) VALUES
        ('Dupont', 'Alice', 'admin@organisation.fr', $1, 'administrateur'),
        ('Martin', 'Jean', 'j.martin@organisation.fr', $2, 'operateur'),
        ('Petit', 'Laura', 'l.petit@organisation.fr', $2, 'operateur'),
        ('Yao', 'Samuel', 's.yao@organisation.fr', $2, 'operateur'),
        ('Koné', 'Mamadou', 'm.kone@organisation.fr', $2, 'operateur')
      ON CONFLICT (email) DO NOTHING;
    `, [hashAdmin, hashOp]);

    // Parapheurs de démo
    await client.query(`
      INSERT INTO parapheurs (reference, description, statut) VALUES
        ('PAR-2025-00142', 'Dossier RH - Recrutements T2 2025', 'en_transit'),
        ('PAR-2025-00138', 'Contrats fournisseurs - Service Achats', 'livre'),
        ('PAR-2025-00091', 'Rapports mensuels - Direction Générale', 'en_transit'),
        ('PAR-2025-00088', 'Dossiers juridiques - Contentieux', 'en_attente'),
        ('PAR-2025-00077', 'Budget prévisionnel 2026', 'en_transit'),
        ('PAR-2025-00064', 'Appels d''offres - DSI', 'livre'),
        ('PAR-2025-00007', 'Archives 2024 - Service Comptabilité', 'archive')
      ON CONFLICT (reference) DO NOTHING;
    `);

    // Événements de scan de démo
    await client.query(`
      INSERT INTO evenements (parapheur_id, utilisateur_id, type, latitude, longitude, precision_gps, localisation_nom, identifiant_appareil, cree_le)
      SELECT
        p.id,
        u.id,
        'scan',
        lat, lon, prec, lieu, appareil, date_scan
      FROM (VALUES
        ('PAR-2025-00142', 'j.martin@organisation.fr', 48.8566,  2.3522,  5.0,  'Bureau Direction RH',          'DEVICE-JM-01', NOW() - INTERVAL '2 hours'),
        ('PAR-2025-00142', 'l.petit@organisation.fr',  48.8530,  2.3499,  8.0,  'Salle de réunion A',           'DEVICE-LP-01', NOW() - INTERVAL '6 hours'),
        ('PAR-2025-00142', 'j.martin@organisation.fr', 48.8490,  2.3560,  4.0,  'Accueil principal',            'DEVICE-JM-01', NOW() - INTERVAL '1 day'),
        ('PAR-2025-00138', 'l.petit@organisation.fr',  48.8600,  2.3400,  6.0,  'Service Achats - Bureau 3',    'DEVICE-LP-01', NOW() - INTERVAL '3 hours'),
        ('PAR-2025-00138', 's.yao@organisation.fr',    48.8620,  2.3410,  7.0,  'Réserve documents',            'DEVICE-SY-01', NOW() - INTERVAL '2 days'),
        ('PAR-2025-00091', 'j.martin@organisation.fr', 48.8700,  2.3300,  5.5,  'Direction Générale - Étage 4', 'DEVICE-JM-01', NOW() - INTERVAL '5 hours'),
        ('PAR-2025-00077', 'm.kone@organisation.fr',   48.8550,  2.3450,  9.0,  'Service Financier',            'DEVICE-MK-01', NOW() - INTERVAL '1 hour'),
        ('PAR-2025-00077', 'm.kone@organisation.fr',   48.8560,  2.3460, 10.0,  'Bureau Contrôle de gestion',  'DEVICE-MK-01', NOW() - INTERVAL '4 hours')
      ) AS v(ref, email, lat, lon, prec, lieu, appareil, date_scan)
      JOIN parapheurs p ON p.reference = v.ref
      JOIN utilisateurs u ON u.email = v.email;
    `);

    console.log('Données de démonstration insérées avec succès.');
    console.log('');
    console.log('Comptes de démonstration :');
    console.log('  Administrateur : admin@organisation.fr / admin123');
    console.log('  Opérateur      : j.martin@organisation.fr / operateur123');
  } catch (err) {
    console.error('Erreur lors de l\'insertion des données :', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
