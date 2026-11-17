/**
 * Confirmation de téléchargement avec lien de secours : certains navigateurs
 * (ex. le navigateur intégré de VS Code) bloquent le téléchargement automatique.
 */
export default function LienTelechargement({ fichier, onFermer }) {
  if (!fichier) return null;
  return (
    <div className="message-succes" role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span>
        ✔ <strong>{fichier.nom}</strong> téléchargé.{' '}
        Le fichier n'apparaît pas ?{' '}
        <a href={fichier.url} download={fichier.nom} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, textDecoration: 'underline' }}>
          Cliquez ici pour l'ouvrir ou l'enregistrer
        </a>
      </span>
      {onFermer && (
        <button onClick={onFermer} style={{ background: 'none', border: 'none', color: 'inherit' }} aria-label="Fermer">✕</button>
      )}
    </div>
  );
}
