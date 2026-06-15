import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import client from '../api/client';

const STATUTS = {
  en_transit: { label: 'En transit', classe: 'badge-vert' },
  livre: { label: 'Livré', classe: 'badge-bleu' },
  en_attente: { label: 'En attente', classe: 'badge-orange' },
  archive: { label: 'Archivé', classe: 'badge-gris' },
};

function formaterDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PageVisionneur() {
  const [recherche, setRecherche] = useState('');
  const [resultat, setResultat] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');

  async function handleRecherche(e) {
    e.preventDefault();
    if (!recherche.trim()) return;
    setChargement(true);
    setErreur('');
    setResultat(null);
    try {
      const { data } = await client.get(`/parapheurs/${recherche.trim().toUpperCase()}`);
      setResultat(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setErreur('Aucun parapheur trouvé avec cette référence.');
      } else {
        setErreur('Erreur lors de la recherche. Veuillez réessayer.');
      }
    } finally {
      setChargement(false);
    }
  }

  const evenementsAvecGPS = resultat?.evenements?.filter(e => e.latitude && e.longitude) || [];
  const pointsCarte = evenementsAvecGPS.map(e => [parseFloat(e.latitude), parseFloat(e.longitude)]);
  const dernierPoint = pointsCarte[0];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fond-page)' }}>
      {/* En-tête */}
      <header style={{ background: 'var(--bleu)', padding: '20px 24px 16px' }}>
        <div className="conteneur">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 600, color: 'white' }}>TraçaParapheur</h1>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>Consultation de la traçabilité</p>
            </div>
            <Link to="/connexion" style={{ fontSize: 12, background: 'rgba(255,255,255,0.18)', color: 'white', padding: '6px 14px', borderRadius: 8, fontWeight: 500 }}>
              Connexion
            </Link>
          </div>
          <form onSubmit={handleRecherche} style={{ display: 'flex', gap: 8 }}>
            <input
              className="champ"
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', flex: 1 }}
              placeholder="Numéro de parapheur (ex: PAR-2025-00142)"
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
            />
            <button className="btn btn-primaire" type="submit" style={{ background: 'white', color: 'var(--bleu)', border: 'none', fontWeight: 600 }}>
              Rechercher
            </button>
          </form>
        </div>
      </header>

      <main className="conteneur" style={{ padding: '24px' }}>
        {chargement && <div className="chargement">Recherche en cours…</div>}
        {erreur && <div className="message-erreur" style={{ maxWidth: 480, margin: '0 auto' }}>{erreur}</div>}

        {!resultat && !chargement && !erreur && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--texte3)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <p style={{ fontSize: 16, fontWeight: 500 }}>Aucun parapheur sélectionné</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>Saisissez un numéro de référence pour commencer</p>
          </div>
        )}

        {resultat && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800, margin: '0 auto' }}>
            {/* Résumé */}
            <div className="carte">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>Parapheur {resultat.reference}</h2>
                  <p style={{ fontSize: 13, color: 'var(--texte2)', marginTop: 4 }}>{resultat.description || 'Aucune description'}</p>
                  <p style={{ fontSize: 12, color: 'var(--texte3)', marginTop: 2 }}>Créé le {formaterDate(resultat.cree_le)}</p>
                </div>
                <span className={`badge ${STATUTS[resultat.statut]?.classe || 'badge-gris'}`}>
                  {STATUTS[resultat.statut]?.label || resultat.statut}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'var(--fond2)', borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 12, color: 'var(--texte2)' }}>Dernière position</p>
                  <p style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                    {resultat.evenements?.[0]?.localisation_nom || '—'}
                  </p>
                </div>
                <div style={{ background: 'var(--fond2)', borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 12, color: 'var(--texte2)' }}>Dernier scan</p>
                  <p style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                    {formaterDate(resultat.evenements?.[0]?.cree_le)}
                  </p>
                </div>
              </div>
            </div>

            {/* Carte GPS */}
            {dernierPoint && (
              <div className="carte">
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Position actuelle</h3>
                <div style={{ height: 250, borderRadius: 10, overflow: 'hidden' }}>
                  <MapContainer center={dernierPoint} zoom={14} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='© OpenStreetMap'
                    />
                    {pointsCarte.length > 1 && <Polyline positions={pointsCarte} color="var(--bleu)" />}
                    {evenementsAvecGPS.map((ev, i) => (
                      <Marker key={ev.id} position={[parseFloat(ev.latitude), parseFloat(ev.longitude)]}>
                        <Popup>
                          <strong>{ev.localisation_nom || 'Position enregistrée'}</strong><br />
                          {formaterDate(ev.cree_le)}<br />
                          {ev.operateur_nom && <>Opérateur : {ev.operateur_nom}</>}
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>
            )}

            {/* Historique */}
            <div className="carte">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Historique des déplacements</h3>
              {resultat.evenements?.length === 0 ? (
                <p style={{ color: 'var(--texte3)', fontSize: 13 }}>Aucun événement enregistré.</p>
              ) : (
                <div>
                  {resultat.evenements?.map((ev, i) => (
                    <div key={ev.id} style={{ display: 'flex', gap: 12, paddingBottom: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? 'var(--bleu)' : 'var(--vert)', flexShrink: 0, marginTop: 2 }} />
                        {i < (resultat.evenements.length - 1) && (
                          <div style={{ width: 1.5, flexGrow: 1, background: 'var(--bordure)', margin: '4px auto' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 4 }}>
                        <p style={{ fontSize: 13, fontWeight: 500 }}>{ev.localisation_nom || 'Position GPS'}</p>
                        <p style={{ fontSize: 12, color: 'var(--texte2)', marginTop: 2 }}>
                          {formaterDate(ev.cree_le)}
                          {ev.operateur_nom && ` · ${ev.operateur_nom}`}
                          {ev.latitude && ` · ${parseFloat(ev.latitude).toFixed(4)}° N, ${parseFloat(ev.longitude).toFixed(4)}° E`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
