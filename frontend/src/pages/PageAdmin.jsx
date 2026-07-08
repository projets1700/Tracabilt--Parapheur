import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

function formaterDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formaterTaille(octets) {
  if (octets >= 1024 * 1024) return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(octets / 1024).toFixed(0)} Ko`;
}

function clientAdmin() {
  const token = localStorage.getItem('admin_token');
  return {
    get:    (url)       => client.get(url, { headers: { Authorization: `Bearer ${token}` } }),
    post:   (url, data) => client.post(url, data, { headers: { Authorization: `Bearer ${token}` } }),
    delete: (url)       => client.delete(url, { headers: { Authorization: `Bearer ${token}` } }),
  };
}

export default function PageAdmin() {
  const navigate = useNavigate();
  const admin = JSON.parse(localStorage.getItem('admin_user') || 'null');

  const [onglet, setOnglet]           = useState('scanners');
  const [scanners, setScanners]       = useState([]);
  const [chargement, setChargement]   = useState(true);
  const [erreur, setErreur]           = useState('');
  const [succes, setSucces]           = useState('');
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [soumission, setSoumission]   = useState(false);
  const [formScanner, setFormScanner] = useState({ nom: '', identifiant: '', mot_de_passe: '', device_id: '' });
  const [infoApk, setInfoApk]         = useState(null);
  const [uploadApk, setUploadApk]     = useState(null);
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/connexion', { replace: true });
  }, [navigate]);

  const chargerScanners = useCallback(async () => {
    setChargement(true);
    try {
      const { data } = await clientAdmin().get('/admin/scanners');
      setScanners(data.scanners);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('admin_token');
        navigate('/admin/connexion', { replace: true });
      }
    } finally {
      setChargement(false);
    }
  }, [navigate]);

  const chargerApk = useCallback(async () => {
    try {
      const { data } = await clientAdmin().get('/admin/apk/info');
      setInfoApk(data);
    } catch {}
  }, []);

  useEffect(() => {
    chargerScanners();
    chargerApk();
  }, [chargerScanners, chargerApk]);

  function deconnecter() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/admin/connexion', { replace: true });
  }

  function afficherSucces(msg) {
    setSucces(msg);
    setTimeout(() => setSucces(''), 3000);
  }

  async function supprimerScanner(id, nom) {
    if (!confirm(`Supprimer le scanner "${nom}" ?`)) return;
    setErreur('');
    try {
      await clientAdmin().delete(`/admin/scanners/${id}`);
      afficherSucces('Scanner supprimé.');
      chargerScanners();
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de la suppression.');
    }
  }

  async function handleCreerScanner(e) {
    e.preventDefault();
    setErreur('');
    setSoumission(true);
    try {
      await clientAdmin().post('/admin/scanners', formScanner);
      afficherSucces(`Scanner "${formScanner.nom}" créé avec succès.`);
      setFormScanner({ nom: '', identifiant: '', mot_de_passe: '', device_id: '' });
      setAjoutOuvert(false);
      chargerScanners();
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de la création.');
    } finally {
      setSoumission(false);
    }
  }

  async function handleUploadApk(e) {
    e.preventDefault();
    if (!uploadApk) return;
    setUploadEnCours(true);
    setErreur('');
    try {
      const token = localStorage.getItem('admin_token');
      const fd = new FormData();
      fd.append('apk', uploadApk);
      const r = await fetch('/api/admin/apk', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.message || 'Erreur upload.');
      }
      afficherSucces('APK mis en ligne avec succès.');
      setUploadApk(null);
      fileRef.current.value = '';
      chargerApk();
    } catch (err) {
      setErreur(err.message || "Erreur lors de l'upload.");
    } finally {
      setUploadEnCours(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fond-page)' }}>
      <header style={{ background: 'var(--bleu)', padding: '16px 24px' }}>
        <div className="conteneur" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>Administration</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Connecté : {admin?.nom}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href="/" style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', textDecoration: 'underline' }}>Visionneur</a>
            <button className="btn" onClick={deconnecter} style={{ fontSize: 12 }}>Déconnexion</button>
          </div>
        </div>
      </header>

      <div className="conteneur" style={{ padding: '24px 24px' }}>
        {erreur && <div className="message-erreur" style={{ marginBottom: 16 }}>{erreur}</div>}
        {succes && <div className="message-succes" style={{ marginBottom: 16 }}>{succes}</div>}

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--bordure)' }}>
          {[{ id: 'scanners', label: 'Scanners' }, { id: 'apk', label: 'APK' }].map(o => (
            <button
              key={o.id}
              onClick={() => setOnglet(o.id)}
              style={{
                padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: onglet === o.id ? 700 : 400,
                color: onglet === o.id ? 'var(--bleu)' : 'var(--texte2)',
                borderBottom: onglet === o.id ? '2px solid var(--bleu)' : '2px solid transparent',
                marginBottom: -2, fontSize: 14,
              }}
            >{o.label}</button>
          ))}
        </div>

        {onglet === 'scanners' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ color: 'var(--texte2)', fontSize: 13 }}>{scanners.length} scanner(s) enregistré(s)</p>
              <button className="btn btn-primaire" onClick={() => setAjoutOuvert(o => !o)}>
                {ajoutOuvert ? '✕ Annuler' : '+ Nouveau scanner'}
              </button>
            </div>

            {ajoutOuvert && (
              <div className="carte">
                <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Nouveau scanner</h3>
                <form onSubmit={handleCreerScanner} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label-champ">Nom complet *</label>
                    <input className="champ" value={formScanner.nom} onChange={e => setFormScanner(f => ({ ...f, nom: e.target.value }))} placeholder="Jean Martin" required />
                  </div>
                  <div>
                    <label className="label-champ">Identifiant *</label>
                    <input className="champ" value={formScanner.identifiant} onChange={e => setFormScanner(f => ({ ...f, identifiant: e.target.value }))} placeholder="j.martin" required />
                  </div>
                  <div>
                    <label className="label-champ">Mot de passe *</label>
                    <input className="champ" type="password" value={formScanner.mot_de_passe} onChange={e => setFormScanner(f => ({ ...f, mot_de_passe: e.target.value }))} placeholder="••••••••" required />
                  </div>
                  <div>
                    <label className="label-champ">ID appareil (optionnel)</label>
                    <input className="champ" value={formScanner.device_id} onChange={e => setFormScanner(f => ({ ...f, device_id: e.target.value }))} placeholder="ANDROID-001" />
                  </div>
                  <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <button type="button" className="btn" onClick={() => setAjoutOuvert(false)}>Annuler</button>
                    <button type="submit" className="btn btn-primaire" disabled={soumission}>
                      {soumission ? 'Création…' : 'Créer le scanner'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {chargement ? (
              <div className="chargement">Chargement…</div>
            ) : scanners.length === 0 ? (
              <div className="carte" style={{ textAlign: 'center', padding: 40, color: 'var(--texte3)' }}>
                Aucun scanner enregistré
              </div>
            ) : (
              <div className="carte" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--fond2)', borderBottom: '1px solid var(--bordure)' }}>
                      {['Nom', 'Identifiant', 'Appareil', 'Statut', 'Créé le', ''].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--texte2)', fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scanners.map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: i < scanners.length - 1 ? '1px solid var(--bordure)' : 'none' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{s.nom}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--texte2)' }}>{s.identifiant}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--texte2)' }}>{s.device_id || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`badge ${s.is_active ? 'badge-vert' : 'badge-rouge'}`}>
                            {s.is_active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--texte3)' }}>{formaterDate(s.created_at)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => supprimerScanner(s.id, s.nom)}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {onglet === 'apk' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
            <div className="carte">
              <h3 style={{ fontWeight: 600, marginBottom: 16 }}>APK actuel</h3>
              {infoApk?.disponible ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--texte2)' }}>Taille</span>
                    <span style={{ fontWeight: 600 }}>{formaterTaille(infoApk.taille)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--texte2)' }}>Mis en ligne le</span>
                    <span style={{ fontWeight: 600 }}>{formaterDate(infoApk.modifie)}</span>
                  </div>
                  <div className="sep" />
                  <a
                    href="/api/admin/apk/download"
                    className="btn btn-primaire"
                    style={{ justifyContent: 'center', padding: '10px 0', textDecoration: 'none' }}
                  >
                    Télécharger l'APK
                  </a>
                  <div style={{ background: 'var(--fond2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--texte2)', wordBreak: 'break-all' }}>
                    Lien direct : <strong>{window.location.origin}/api/admin/apk/download</strong>
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--texte3)', fontSize: 13 }}>Aucun APK disponible. Uploadez-en un ci-dessous.</p>
              )}
            </div>

            <div className="carte">
              <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Mettre en ligne un nouvel APK</h3>
              <form onSubmit={handleUploadApk} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="label-champ">Fichier APK</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".apk"
                    onChange={e => setUploadApk(e.target.files[0])}
                    style={{ fontSize: 13, width: '100%' }}
                  />
                </div>
                {uploadApk && (
                  <p style={{ fontSize: 12, color: 'var(--texte2)' }}>
                    {uploadApk.name} — {formaterTaille(uploadApk.size)}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn btn-primaire"
                  disabled={!uploadApk || uploadEnCours}
                  style={{ justifyContent: 'center' }}
                >
                  {uploadEnCours ? 'Upload en cours…' : 'Mettre en ligne'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
