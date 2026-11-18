import { useNavigate } from 'react-router-dom';
import EnTeteApp from '../../../composants/EnTeteApp';
import ZoneImport from '../composants/ZoneImport';
import useModeDocuments from '../hooks/useModeDocuments';
import '../documents.css';

/**
 * Page « Documents » : importation d'un document (PDF, Word, OpenDocument),
 * puis ouverture de l'éditeur de QR codes.
 */
export default function PageDocuments() {
  const navigate = useNavigate();
  const mode = useModeDocuments();

  return (
    <div className="page-docs">
      <EnTeteApp />

      <div className="sous-entete">
        <h1>Documents</h1>
        <p>Importez un document (PDF, Word ou OpenDocument), placez des QR codes en leur donnant un nom unique (ex. DEP-000001), puis générez le PDF.</p>
      </div>

      <div className="page-docs-contenu">
        <div className="carte" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Importer un document</h2>
          {mode ? (
            <ZoneImport mode={mode} onImporte={doc => navigate(`/documents/${doc.id}`)} />
          ) : (
            <div className="chargement">Chargement…</div>
          )}
        </div>
      </div>
    </div>
  );
}
