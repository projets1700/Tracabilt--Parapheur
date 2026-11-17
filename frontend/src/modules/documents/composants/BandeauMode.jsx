/**
 * Informe l'utilisateur lorsque les documents sont traités dans le navigateur :
 * visiteur non connecté, ou service documentaire du serveur indisponible.
 */
export default function BandeauMode({ mode }) {
  if (!mode || mode.mode !== 'local') return null;
  return (
    <div className="bandeau bandeau-info">
      <span aria-hidden>ℹ️</span>
      {mode.visiteur ? (
        <span>
          Vos documents PDF sont traités <strong>directement dans votre navigateur</strong> : ils ne sont pas envoyés
          au serveur et restent uniquement sur ce poste.
        </span>
      ) : (
        <span>
          <strong>Mode local.</strong> Le service documentaire du serveur n'est pas disponible :
          les documents PDF sont traités directement dans votre navigateur et ne sont visibles que sur ce poste.
          L'import et l'export au format Word nécessitent le service du serveur.
        </span>
      )}
    </div>
  );
}
