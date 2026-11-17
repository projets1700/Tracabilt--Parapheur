import { pointsVersMm, mmVersPoints, TAILLE_QR_CONSEILLEE, TAILLE_QR_MIN } from '../utils/coordonnees';

function arrondi(mm) {
  return Math.round(mm * 10) / 10;
}

/** Champ numérique en millimètres, validé à la sortie du champ ou sur Entrée. */
function ChampMm({ label, valeurPt, onValider, min = 0 }) {
  const valeurMm = arrondi(pointsVersMm(valeurPt));
  function valider(e) {
    const brut = parseFloat(String(e.target.value).replace(',', '.'));
    if (Number.isFinite(brut) && brut >= min && brut !== valeurMm) onValider(mmVersPoints(brut));
    else e.target.value = String(valeurMm).replace('.', ',');
  }
  return (
    <div>
      <label className="label-champ">{label}</label>
      <div className="champ-unite">
        <input
          key={valeurMm}
          className="champ"
          inputMode="decimal"
          defaultValue={String(valeurMm).replace('.', ',')}
          onBlur={valider}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          aria-label={`${label} en millimètres`}
        />
        <em>mm</em>
      </div>
    </div>
  );
}

/**
 * QRCodeProperties — paramètres configurables du QR code sélectionné (§3.4) :
 * position X/Y, largeur/hauteur (proportions conservées) et page.
 */
export default function QRCodeProperties({ qr, pages, verrouille, onModifier, onDupliquer, onSupprimer, onRenommer }) {
  if (!qr) {
    return <p style={{ fontSize: 12, color: 'var(--texte3)' }}>Sélectionnez un QR code dans la page ou dans la liste pour modifier ses paramètres.</p>;
  }

  const trop_petit = qr.largeur < TAILLE_QR_CONSEILLEE - 0.01;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>
            <span style={{ color: 'var(--texte2)' }}>Nom : </span>
            <strong style={{ fontSize: 13 }}>{qr.numero || qr.reference}</strong>
          </span>
          <button type="button" className="btn btn-petit" onClick={() => onRenommer(qr.cle)} disabled={verrouille}>Renommer</button>
        </div>
        {qr.contenu !== qr.numero && (
          <p style={{ color: 'var(--texte3)', fontSize: 11, overflowWrap: 'anywhere' }}>Contenu encodé : {qr.contenu}</p>
        )}
      </div>

      <fieldset disabled={verrouille} style={{ border: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="grille-proprietes">
          <ChampMm label="Position X" valeurPt={qr.x} onValider={x => onModifier(qr.cle, { x })} />
          <ChampMm label="Position Y" valeurPt={qr.y} onValider={y => onModifier(qr.cle, { y })} />
          <ChampMm label="Largeur" valeurPt={qr.largeur} min={pointsVersMm(TAILLE_QR_MIN)} onValider={t => onModifier(qr.cle, { largeur: t, hauteur: t })} />
          <ChampMm label="Hauteur" valeurPt={qr.hauteur} min={pointsVersMm(TAILLE_QR_MIN)} onValider={t => onModifier(qr.cle, { largeur: t, hauteur: t })} />
        </div>
        <p style={{ fontSize: 11, color: 'var(--texte3)' }}>🔒 Proportions conservées · origine : coin haut-gauche de la page</p>

        <div>
          <label className="label-champ">Page</label>
          <select className="champ" value={qr.page} onChange={e => onModifier(qr.cle, { page: Number(e.target.value) })}>
            {pages.map(p => <option key={p.numero} value={p.numero}>Page {p.numero}</option>)}
          </select>
        </div>

        {trop_petit && (
          <div className="bandeau bandeau-alerte">
            <span aria-hidden>⚠️</span>
            <span>En dessous de 20 mm, la lecture du QR code après impression peut être difficile.</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onDupliquer(qr.cle)}>⧉ Dupliquer</button>
          <button type="button" className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onSupprimer(qr.cle)}>Supprimer</button>
        </div>
      </fieldset>
    </div>
  );
}
