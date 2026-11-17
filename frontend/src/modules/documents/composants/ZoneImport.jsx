import { useRef, useState } from 'react';
import { importerDocument, messageErreur } from '../services/documentsApi';
import { ACCEPT_INPUT, formaterTaille, validerFichier, TAILLE_MAX_DEFAUT } from '../utils/validationFichier';

/**
 * Importation documentaire (§3.1) : sélection ou glisser-déposer,
 * contrôles du fichier, retour visuel de progression.
 */
export default function ZoneImport({ mode, onImporte }) {
  const [survol, setSurvol] = useState(false);
  const [progression, setProgression] = useState(null);
  const [erreur, setErreur] = useState('');
  const [fichierEnCours, setFichierEnCours] = useState(null);
  const [conversion, setConversion] = useState(false);
  const inputRef = useRef(null);

  const tailleMax = mode?.config?.taille_max_octets || TAILLE_MAX_DEFAUT;
  const enCours = progression !== null;

  async function traiter(fichier) {
    if (!fichier || enCours) return;
    setErreur('');
    setFichierEnCours(fichier);
    setProgression(0);
    try {
      const { format, aConvertir } = await validerFichier(fichier, tailleMax);
      setConversion(aConvertir);
      const doc = await importerDocument(fichier, { format, aConvertir }, setProgression);
      onImporte?.(doc);
    } catch (err) {
      setErreur(messageErreur(err, "L'importation a échoué."));
    } finally {
      setProgression(null);
      setFichierEnCours(null);
      setConversion(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        className={`zone-depot${survol ? ' survol' : ''}`}
        role="button"
        tabIndex={0}
        aria-disabled={enCours}
        onClick={() => !enCours && inputRef.current?.click()}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !enCours) { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={e => { e.preventDefault(); setSurvol(true); }}
        onDragLeave={() => setSurvol(false)}
        onDrop={e => {
          e.preventDefault();
          setSurvol(false);
          if (e.dataTransfer.files.length > 1) {
            setErreur('Déposez un seul fichier à la fois.');
            return;
          }
          traiter(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_INPUT}
          style={{ display: 'none' }}
          onChange={e => traiter(e.target.files[0])}
        />
        {enCours ? (
          <div style={{ maxWidth: 360, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>Importation de « {fichierEnCours?.name} »…</p>
            <div className="barre-progression"><div style={{ width: `${progression}%` }} /></div>
            <p style={{ fontSize: 12, color: 'var(--texte3)' }}>
              {conversion
                ? 'Conversion du document en PDF… (quelques secondes)'
                : progression < 100 ? `${progression} %` : 'Analyse et préparation de l\'aperçu…'}
            </p>
          </div>
        ) : (
          <>
            <div className="icone" aria-hidden>📄</div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Glissez-déposez un document ici</p>
            <p style={{ fontSize: 12, color: 'var(--texte2)', marginTop: 4 }}>ou <span style={{ color: 'var(--bleu)', fontWeight: 600 }}>parcourez votre ordinateur</span></p>
            <p style={{ fontSize: 11, color: 'var(--texte3)', marginTop: 10 }}>
              PDF, Word (.docx, .doc) ou OpenDocument (.odt) — {formaterTaille(tailleMax)} maximum
            </p>
            <p style={{ fontSize: 11, color: 'var(--texte3)', marginTop: 2 }}>
              Les documents Word et OpenDocument sont automatiquement convertis en PDF.
            </p>
          </>
        )}
      </div>

      {erreur && <div className="message-erreur" role="alert">{erreur}</div>}
    </div>
  );
}
