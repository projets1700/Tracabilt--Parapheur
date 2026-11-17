import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import EnTeteApp from '../../../composants/EnTeteApp';
import ZoneImport from '../composants/ZoneImport';
import ListeDocuments from '../composants/ListeDocuments';
import SelecteurParapheur from '../composants/SelecteurParapheur';
import BandeauMode from '../composants/BandeauMode';
import useParapheurs from '../hooks/useParapheurs';
import useModeDocuments from '../hooks/useModeDocuments';
import '../documents.css';

/**
 * Module de gestion documentaire : importation et liste des documents,
 * éventuellement filtrée sur un parapheur (?parapheur=NUMERO).
 */
export default function PageDocuments() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const mode = useModeDocuments();
  const { liste: parapheurs, chargement: chargementParapheurs } = useParapheurs();
  const [importOuvert, setImportOuvert] = useState(params.get('importer') === '1');

  const numeroFiltre = params.get('parapheur')?.toUpperCase() || null;
  const parapheurFiltre = useMemo(
    () => (numeroFiltre ? parapheurs.find(p => p.numero.toUpperCase() === numeroFiltre) || null : null),
    [numeroFiltre, parapheurs],
  );
  const filtreInconnu = numeroFiltre && !chargementParapheurs && !parapheurFiltre;

  function changerFiltre(p) {
    const suivant = new URLSearchParams(params);
    if (p) suivant.set('parapheur', p.numero); else suivant.delete('parapheur');
    suivant.delete('importer');
    setParams(suivant, { replace: true });
  }

  return (
    <div className="page-docs">
      <EnTeteApp />

      <div className="sous-entete">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1>Documents{parapheurFiltre ? ` — ${parapheurFiltre.numero}` : ''}</h1>
            <p>Importez un document (PDF, Word ou OpenDocument), placez des QR codes en leur donnant un nom unique (ex. DEP-000001), puis générez le PDF.</p>
          </div>
          <button className="btn btn-primaire" onClick={() => setImportOuvert(o => !o)}>
            {importOuvert ? '✕ Fermer' : '+ Importer un document'}
          </button>
        </div>
      </div>

      <div className="page-docs-contenu">
        <BandeauMode mode={mode} />

        {importOuvert && (
          <div className="carte" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Importer un document</h2>
            {mode ? (
              <ZoneImport
                mode={mode}
                onImporte={doc => navigate(`/documents/${doc.id}`)}
              />
            ) : (
              <div className="chargement">Chargement…</div>
            )}
          </div>
        )}

        <div className="carte" style={{ padding: 0, overflow: 'visible' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--bordure)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700 }}>
              {parapheurFiltre ? `Documents du parapheur ${parapheurFiltre.numero}` : 'Tous les documents'}
            </h2>
            <div style={{ width: 320, maxWidth: '100%' }}>
              <SelecteurParapheur valeur={parapheurFiltre} onChange={changerFiltre} />
            </div>
          </div>
          {filtreInconnu ? (
            <div style={{ padding: 24 }} className="message-erreur">Le parapheur {numeroFiltre} est introuvable.</div>
          ) : mode && !(numeroFiltre && !parapheurFiltre) ? (
            <ListeDocuments
              key={parapheurFiltre?.id || 'tous'}
              parapheurId={parapheurFiltre?.id}
              masquerParapheur={Boolean(parapheurFiltre)}
              messageVide={parapheurFiltre ? 'Aucun document associé à ce parapheur.' : 'Aucun document importé pour le moment.'}
            />
          ) : (
            <div className="chargement">Chargement…</div>
          )}
        </div>
      </div>
    </div>
  );
}
