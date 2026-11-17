import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listerDocuments, telechargerDocument, telechargerAvecQr, supprimerDocument, messageErreur, estVisiteur, STATUTS_DOCUMENT,
} from '../services/documentsApi';
import { FORMATS } from '../utils/validationFichier';
import LienTelechargement from './LienTelechargement';

function formaterDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function IconeFormat({ format }) {
  return <span className={`icone-format ${format}`}>{(format || '?').toUpperCase()}</span>;
}

/**
 * Liste des documents (§3.7) — utilisable partout : page Documents,
 * fiche d'un parapheur, tableau de bord administrateur.
 */
export default function ListeDocuments({ parapheurId, masquerParapheur = false, rafraichir = 0, messageVide = 'Aucun document.' }) {
  const [docs, setDocs] = useState(null);
  const [erreur, setErreur] = useState('');
  const [action, setAction] = useState(null);
  const [version, setVersion] = useState(0);
  // Suppression : administrateur, ou visiteur pour ses propres documents (stockés dans son navigateur).
  const peutSupprimer = Boolean(localStorage.getItem('admin_token')) || estVisiteur();
  const chargement = docs === null && !erreur;

  useEffect(() => {
    let actif = true;
    listerDocuments({ parapheurId })
      .then(liste => { if (actif) { setDocs(liste); setErreur(''); } })
      .catch(err => actif && setErreur(messageErreur(err, 'Impossible de charger les documents.')));
    return () => { actif = false; };
  }, [parapheurId, rafraichir, version]);

  const charger = useCallback(() => setVersion(v => v + 1), []);

  const [fichier, setFichier] = useState(null);

  async function telecharger(doc, version) {
    setAction(`${doc.id}:${version}`);
    setErreur('');
    setFichier(null);
    try {
      if (version === 'genere') {
        // Génère le PDF avec QR si besoin (jamais généré ou modifié depuis), puis le télécharge.
        const { doc: aJour, fichier: f } = await telechargerAvecQr(doc);
        setFichier(f);
        if (aJour !== doc) charger();
      } else {
        setFichier(await telechargerDocument(doc, version));
      }
    } catch (err) {
      setErreur(messageErreur(err, 'Le téléchargement a échoué.'));
    } finally {
      setAction(null);
    }
  }

  async function supprimer(doc) {
    if (!confirm(`Supprimer définitivement le document « ${doc.nom} » et ses versions générées ?\nCette action est irréversible.`)) return;
    setAction(`${doc.id}:suppr`);
    try {
      await supprimerDocument(doc.id);
      charger();
    } catch (err) {
      setErreur(messageErreur(err, 'La suppression a échoué.'));
    } finally {
      setAction(null);
    }
  }

  if (chargement) return <div className="chargement">Chargement des documents…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {erreur && <div className="message-erreur">{erreur}</div>}
      <LienTelechargement fichier={fichier} onFermer={() => setFichier(null)} />
      {!docs ? null : docs.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--texte3)', fontSize: 13 }}>{messageVide}</div>
      ) : (
        <table className="table-docs">
          <thead>
            <tr>
              <th>Document</th>
              {!masquerParapheur && <th>Numéros des QR</th>}
              <th>QR codes</th>
              <th>Statut</th>
              <th>Mis à jour</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {docs.map(d => (
              <tr key={d.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <IconeFormat format={d.format} />
                    <div style={{ minWidth: 0 }}>
                      <Link to={`/documents/${d.id}`} style={{ fontWeight: 600, color: '#1D1D1B', overflowWrap: 'anywhere' }}>{d.nom}</Link>
                      {d.sourceFormat && d.sourceFormat !== d.format && (
                        <p style={{ fontSize: 11, color: 'var(--texte3)' }}>Converti en PDF depuis {FORMATS[d.sourceFormat]?.label || d.sourceFormat}</p>
                      )}
                      {d.nomGenere && <p style={{ fontSize: 11, color: 'var(--texte3)', overflowWrap: 'anywhere' }}>→ {d.nomGenere}</p>}
                    </div>
                  </div>
                </td>
                {!masquerParapheur && (
                  <td data-label="Numéros des QR">
                    {d.qrNumeros.length
                      ? <span style={{ color: 'var(--bleu-fonce)', fontWeight: 600, fontSize: 12 }}>{d.qrNumeros.join(', ')}</span>
                      : <span style={{ color: 'var(--texte3)' }}>—</span>}
                  </td>
                )}
                <td data-label="QR codes">{d.nbQr}</td>
                <td data-label="Statut">
                  <span className={`badge ${STATUTS_DOCUMENT[d.statut]?.classe || 'badge-gris'}`}>{STATUTS_DOCUMENT[d.statut]?.label || d.statut}</span>
                </td>
                <td data-label="Mis à jour" style={{ color: 'var(--texte2)', fontSize: 12 }}>{formaterDate(d.modifieLe || d.creeLe)}</td>
                <td>
                  <div className="actions">
                    <Link to={`/documents/${d.id}`} className="btn btn-petit">Ouvrir</Link>
                    <button className="btn btn-petit" disabled={action === `${d.id}:original`} onClick={() => telecharger(d, 'original')} title="Télécharger le document original">
                      Original
                    </button>
                    {d.nbQr > 0 && (
                      <button className="btn btn-primaire btn-petit" disabled={action === `${d.id}:genere`} onClick={() => telecharger(d, 'genere')} title="Télécharger le document avec ses QR codes (PDF)">
                        {action === `${d.id}:genere` ? 'Préparation…' : '⬇ Télécharger avec QR'}
                      </button>
                    )}
                    {peutSupprimer && (
                      <button className="btn btn-danger btn-petit" disabled={action === `${d.id}:suppr`} onClick={() => supprimer(d)}>Supprimer</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
