import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import client from '../api/client';

function formaterDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ModalFicheSuperviseur({ superviseur, onFermer }) {
  if (!superviseur) return null;
  return (
    <div
      onClick={onFermer}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="carte"
        style={{ width: '100%', maxWidth: 420, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{superviseur.nom}</h2>
            <p style={{ fontSize: 13, color: 'var(--texte2)', marginTop: 2 }}>{superviseur.identifiant}</p>
          </div>
          <button onClick={onFermer} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--texte3)', lineHeight: 1 }}>✕</button>
        </div>
        <div className="sep" style={{ margin: 0 }} />
        {[
          { label: 'Identifiant', valeur: superviseur.identifiant },
          { label: 'Créé le',     valeur: formaterDate(superviseur.created_at) },
        ].map(({ label, valeur }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
            <span style={{ color: 'var(--texte2)', fontWeight: 500 }}>{label}</span>
            <span style={{ fontWeight: 600 }}>{valeur}</span>
          </div>
        ))}
        <div className="sep" style={{ margin: 0 }} />
        <button className="btn" onClick={onFermer} style={{ justifyContent: 'center' }}>Fermer</button>
      </div>
    </div>
  );
}

function ModalFiche({ scanner, onFermer, onEnregistrer }) {
  const [actif, setActif] = useState(true);
  const [pin, setPin] = useState('');
  const [erreur, setErreur] = useState('');
  const [soumission, setSoumission] = useState(false);

  useEffect(() => {
    if (scanner) {
      setActif(scanner.is_active);
      setPin('');
      setErreur('');
    }
  }, [scanner]);

  if (!scanner) return null;

  async function handleEnregistrer() {
    if (pin && !/^\d{4}$/.test(pin)) {
      setErreur('Le code PIN doit contenir exactement 4 chiffres.');
      return;
    }
    setErreur('');
    setSoumission(true);
    try {
      await onEnregistrer(scanner.id, { is_active: actif, ...(pin ? { mot_de_passe: pin } : {}) });
      onFermer();
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de la modification.');
    } finally {
      setSoumission(false);
    }
  }

  return (
    <div
      onClick={onFermer}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="carte"
        style={{ width: '100%', maxWidth: 420, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{scanner.nom}</h2>
            <p style={{ fontSize: 13, color: 'var(--texte2)', marginTop: 2 }}>{scanner.identifiant}</p>
          </div>
          <button onClick={onFermer} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--texte3)', lineHeight: 1 }}>✕</button>
        </div>

        <div className="sep" style={{ margin: 0 }} />

        {erreur && <div className="message-erreur">{erreur}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span style={{ color: 'var(--texte2)', fontWeight: 500 }}>Statut</span>
          <button
            type="button"
            className={`badge ${actif ? 'badge-vert' : 'badge-rouge'}`}
            style={{ border: 'none', cursor: 'pointer' }}
            onClick={() => setActif(a => !a)}
          >
            {actif ? 'Actif' : 'Inactif'} — cliquer pour changer
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span style={{ color: 'var(--texte2)', fontWeight: 500 }}>Créé le</span>
          <span style={{ fontWeight: 600 }}>{formaterDate(scanner.created_at)}</span>
        </div>

        <div>
          <label className="label-champ">Réinitialiser le code PIN (optionnel)</label>
          <input
            className="champ"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Laisser vide pour ne pas changer"
          />
        </div>

        <div className="sep" style={{ margin: 0 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onFermer}>Fermer</button>
          <button className="btn btn-primaire" onClick={handleEnregistrer} disabled={soumission}>
            {soumission ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function clientAdmin() {
  const token = localStorage.getItem('admin_token');
  return {
    get:    (url)       => client.get(url, { headers: { Authorization: `Bearer ${token}` } }),
    post:   (url, data) => client.post(url, data, { headers: { Authorization: `Bearer ${token}` } }),
    put:    (url, data) => client.put(url, data, { headers: { Authorization: `Bearer ${token}` } }),
    delete: (url)       => client.delete(url, { headers: { Authorization: `Bearer ${token}` } }),
  };
}

export default function PageAdmin() {
  const navigate = useNavigate();
  const admin = JSON.parse(localStorage.getItem('admin_user') || 'null');

  const [onglet, setOnglet]           = useState('scanners');
  const [admins, setAdmins]           = useState([]);
  const [scanners, setScanners]       = useState([]);
  const [chargement, setChargement]   = useState(true);
  const [erreur, setErreur]           = useState('');
  const [succes, setSucces]           = useState('');
  const [scannerFiche, setScannerFiche]         = useState(null);
  const [superviseurs, setSuperviseurs]               = useState([]);
  const [superviseurFiche, setSuperviseurFiche]       = useState(null);
  const [ajoutSupOuvert, setAjoutSupOuvert]           = useState(false);
  const [formSuperviseur, setFormSuperviseur]         = useState({ nom: '', mot_de_passe: '' });
  const [soumissionSup, setSoumissionSup]             = useState(false);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [soumission, setSoumission]   = useState(false);
  const [formScanner, setFormScanner] = useState({ mot_de_passe: '' });
  const [ajoutAdminOuvert, setAjoutAdminOuvert]       = useState(false);
  const [formAdmin, setFormAdmin]                     = useState({ nom: '', identifiant: '', mot_de_passe: '' });
  const [soumissionAdmin, setSoumissionAdmin]         = useState(false);
  const [scans, setScans]             = useState([]);
  const [scansTotal, setScansTotal]   = useState(0);
  const [scansPage, setScansPage]     = useState(1);
  const [chargementScans, setChargementScans] = useState(true);
  const SCANS_PAR_PAGE = 50;

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

  const chargerSuperviseurs = useCallback(async () => {
    try {
      const { data } = await clientAdmin().get('/admin/superviseurs');
      setSuperviseurs(data.superviseurs);
    } catch {}
  }, []);

  const chargerAdmins = useCallback(async () => {
    try {
      const { data } = await clientAdmin().get('/admin/admins');
      setAdmins(data.admins);
    } catch {}
  }, []);

  useEffect(() => {
    chargerScanners();
    chargerSuperviseurs();
    chargerAdmins();
  }, [chargerScanners, chargerSuperviseurs, chargerAdmins]);

  const chargerScans = useCallback(async (page) => {
    setChargementScans(true);
    try {
      const { data } = await clientAdmin().get(`/scans?page=${page}&limite=${SCANS_PAR_PAGE}`);
      setScans(data.scans);
      setScansTotal(data.total);
      setScansPage(data.page);
    } catch {} finally {
      setChargementScans(false);
    }
  }, []);

  useEffect(() => {
    if (onglet === 'scans') chargerScans(1);
  }, [onglet, chargerScans]);

  async function supprimerScan(id, numero) {
    if (!confirm(`Supprimer le scan de "${numero}" ?`)) return;
    setErreur('');
    try {
      await clientAdmin().delete(`/admin/scans/${id}`);
      afficherSucces('Scan supprimé.');
      chargerScans(scansPage);
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de la suppression.');
    }
  }

  function deconnecter() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/admin/connexion', { replace: true });
  }

  function afficherSucces(msg) {
    setSucces(msg);
    setTimeout(() => setSucces(''), 3000);
  }

  async function handleCreerSuperviseur(e) {
    e.preventDefault();
    setErreur('');
    setSoumissionSup(true);
    try {
      const { data } = await clientAdmin().post('/admin/superviseurs', formSuperviseur);
      afficherSucces(`Superviseur "${formSuperviseur.nom}" créé — identifiant : ${data.superviseur.identifiant}`);
      setFormSuperviseur({ nom: '', mot_de_passe: '' });
      setAjoutSupOuvert(false);
      chargerSuperviseurs();
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de la création.');
    } finally {
      setSoumissionSup(false);
    }
  }

  async function handleCreerAdmin(e) {
    e.preventDefault();
    setErreur('');
    setSoumissionAdmin(true);
    try {
      await clientAdmin().post('/admin/admins', formAdmin);
      afficherSucces(`Administrateur "${formAdmin.nom}" créé avec succès.`);
      setFormAdmin({ nom: '', identifiant: '', mot_de_passe: '' });
      setAjoutAdminOuvert(false);
      chargerAdmins();
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de la création.');
    } finally {
      setSoumissionAdmin(false);
    }
  }

  async function supprimerAdmin(id, nom) {
    if (!confirm(`Supprimer l'administrateur "${nom}" ?`)) return;
    setErreur('');
    try {
      await clientAdmin().delete(`/admin/admins/${id}`);
      afficherSucces('Administrateur supprimé.');
      chargerAdmins();
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de la suppression.');
    }
  }

  async function supprimerSuperviseur(id, nom) {
    if (!confirm(`Supprimer le superviseur "${nom}" ?`)) return;
    setErreur('');
    try {
      await clientAdmin().delete(`/admin/superviseurs/${id}`);
      afficherSucces('Superviseur supprimé.');
      chargerSuperviseurs();
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de la suppression.');
    }
  }

  async function handleModifierScanner(id, changes) {
    await clientAdmin().put(`/admin/scanners/${id}`, changes);
    afficherSucces('Scanner modifié.');
    chargerScanners();
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

  function prochainIdentifiantScanner() {
    let max = 0;
    for (const s of scanners) {
      const m = /^Scan(\d+)$/.exec(s.identifiant);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `Scan${max + 1}`;
  }

  function prochainIdentifiantSuperviseur() {
    let max = 0;
    for (const s of superviseurs) {
      const m = /^Sup(\d+)$/.exec(s.identifiant);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `Sup${max + 1}`;
  }

  async function handleCreerScanner(e) {
    e.preventDefault();
    setErreur('');
    setSoumission(true);
    try {
      const { data } = await clientAdmin().post('/admin/scanners', formScanner);
      afficherSucces(`Scanner créé — identifiant : ${data.scanner.identifiant}`);
      setFormScanner({ mot_de_passe: '' });
      setAjoutOuvert(false);
      chargerScanners();
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de la création.');
    } finally {
      setSoumission(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fond-page)' }}>
      <ModalFiche scanner={scannerFiche} onFermer={() => setScannerFiche(null)} onEnregistrer={handleModifierScanner} />
      <ModalFicheSuperviseur superviseur={superviseurFiche} onFermer={() => setSuperviseurFiche(null)} />

      {/* Header */}
      <header style={{
        background: 'var(--vert-bandeau)', borderBottom: '1px solid var(--bordure)', padding: '2px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap',
      }}>
        <img src="/Logo_Parapheur.png" alt="CoeurTrace" style={{ width: 150, height: 'auto', objectFit: 'contain' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="/" style={{ fontSize: 12, color: 'var(--vert-fonce)', textDecoration: 'none', fontWeight: 600 }}>
            ← Visionneur
          </a>
          <div style={{ width: 1, height: 20, background: 'var(--bordure)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bleu)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white' }}>
              {admin?.nom?.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 13, color: 'var(--texte2)', fontWeight: 500 }}>{admin?.nom}</span>
          </div>
          <button
            onClick={deconnecter}
            style={{ background: 'none', border: '1px solid var(--bordure)', borderRadius: 8, padding: '6px 14px', color: 'var(--texte2)', fontSize: 12, cursor: 'pointer' }}
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Sous-header avec titre de page et onglets */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--bordure)', padding: '0 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, paddingBottom: 0 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--bleu)' }}>Tableau de bord</h1>
            <p style={{ fontSize: 12, color: 'var(--texte3)', marginTop: 2 }}>Gestion des scanners et de l'application mobile</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, marginTop: 16 }}>
          {[{ id: 'scanners', label: 'Scannaire' }, { id: 'superviseurs', label: 'Superviseurs' }, { id: 'admins', label: 'Administrateurs' }, { id: 'scans', label: 'Scans' }, { id: 'apk', label: 'Application mobile' }].map(o => (
            <button
              key={o.id}
              onClick={() => setOnglet(o.id)}
              style={{
                padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: onglet === o.id ? 600 : 400,
                color: onglet === o.id ? 'var(--bleu)' : 'var(--texte2)',
                borderBottom: onglet === o.id ? '2px solid var(--bleu)' : '2px solid transparent',
                fontSize: 13, marginBottom: -1,
              }}
            >{o.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '28px 32px' }}>
        {erreur && <div className="message-erreur" style={{ marginBottom: 16 }}>{erreur}</div>}
        {succes && <div className="message-succes" style={{ marginBottom: 16 }}>{succes}</div>}

        {onglet === 'scanners' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ color: 'var(--texte2)', fontSize: 13 }}>{scanners.length} scanner(s) enregistré(s)</p>
              {!ajoutOuvert && (
                <button className="btn btn-primaire" onClick={() => setAjoutOuvert(true)}>+ Nouveau scanner</button>
              )}
            </div>

            {ajoutOuvert && (
              <div className="carte">
                <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Nouveau scanner</h3>
                <form onSubmit={handleCreerScanner} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label-champ">Identifiant</label>
                    <input className="champ" value={prochainIdentifiantScanner()} disabled style={{ color: 'var(--texte2)', fontWeight: 600, cursor: 'not-allowed' }} />
                  </div>
                  <div>
                    <label className="label-champ">Code PIN (4 chiffres) *</label>
                    <input
                      className="champ"
                      type="password"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      value={formScanner.mot_de_passe}
                      onChange={e => setFormScanner(f => ({ ...f, mot_de_passe: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="1234"
                      required
                    />
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
                      {['Nom', 'Identifiant', 'Statut', 'Créé le', ''].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--texte2)', fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scanners.map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: i < scanners.length - 1 ? '1px solid var(--bordure)' : 'none' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{s.nom}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--texte2)' }}>{s.identifiant}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`badge ${s.is_active ? 'badge-vert' : 'badge-rouge'}`}>
                            {s.is_active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--texte3)' }}>{formaterDate(s.created_at)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setScannerFiche(s)}>
                              Fiche
                            </button>
                            <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => supprimerScanner(s.id, s.nom)}>
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {onglet === 'superviseurs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ color: 'var(--texte2)', fontSize: 13 }}>{superviseurs.length} superviseur(s) enregistré(s)</p>
              {!ajoutSupOuvert && (
                <button className="btn btn-primaire" onClick={() => setAjoutSupOuvert(true)}>+ Nouveau superviseur</button>
              )}
            </div>

            {ajoutSupOuvert && (
              <div className="carte">
                <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Nouveau superviseur</h3>
                <form onSubmit={handleCreerSuperviseur} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label-champ">Nom complet *</label>
                    <input className="champ" value={formSuperviseur.nom} onChange={e => setFormSuperviseur(f => ({ ...f, nom: e.target.value }))} placeholder="Nom complet" required />
                  </div>
                  <div>
                    <label className="label-champ">Identifiant</label>
                    <input className="champ" value={prochainIdentifiantSuperviseur()} disabled style={{ color: 'var(--texte2)', fontWeight: 600, cursor: 'not-allowed' }} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="label-champ">Code PIN (4 chiffres) *</label>
                    <input
                      className="champ"
                      type="password"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      value={formSuperviseur.mot_de_passe}
                      onChange={e => setFormSuperviseur(f => ({ ...f, mot_de_passe: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="1234"
                      required
                    />
                  </div>
                  <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <button type="button" className="btn" onClick={() => setAjoutSupOuvert(false)}>Annuler</button>
                    <button type="submit" className="btn btn-primaire" disabled={soumissionSup}>
                      {soumissionSup ? 'Création…' : 'Créer le superviseur'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {superviseurs.length === 0 ? (
              <div className="carte" style={{ textAlign: 'center', padding: 40, color: 'var(--texte3)' }}>
                Aucun superviseur enregistré
              </div>
            ) : (
              <div className="carte" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--fond2)', borderBottom: '1px solid var(--bordure)' }}>
                      {['Nom', 'Identifiant', 'Créé le', ''].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--texte2)', fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {superviseurs.map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: i < superviseurs.length - 1 ? '1px solid var(--bordure)' : 'none' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{s.nom}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--texte2)' }}>{s.identifiant}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--texte3)' }}>{formaterDate(s.created_at)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setSuperviseurFiche(s)}>
                              Fiche
                            </button>
                            <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => supprimerSuperviseur(s.id, s.nom)}>
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {onglet === 'admins' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ color: 'var(--texte2)', fontSize: 13 }}>{admins.length} administrateur(s) sur 2 maximum</p>
              {admins.length < 2 && !ajoutAdminOuvert && (
                <button className="btn btn-primaire" onClick={() => setAjoutAdminOuvert(true)}>+ Nouvel administrateur</button>
              )}
            </div>

            {ajoutAdminOuvert && admins.length < 2 && (
              <div className="carte">
                <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Nouvel administrateur</h3>
                <form onSubmit={handleCreerAdmin} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label-champ">Nom complet *</label>
                    <input className="champ" value={formAdmin.nom} onChange={e => setFormAdmin(f => ({ ...f, nom: e.target.value }))} placeholder="Nom complet" required />
                  </div>
                  <div>
                    <label className="label-champ">Identifiant *</label>
                    <input className="champ" value={formAdmin.identifiant} onChange={e => setFormAdmin(f => ({ ...f, identifiant: e.target.value }))} placeholder="identifiant" autoCapitalize="none" required />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="label-champ">Mot de passe *</label>
                    <input className="champ" type="password" value={formAdmin.mot_de_passe} onChange={e => setFormAdmin(f => ({ ...f, mot_de_passe: e.target.value }))} placeholder="6 caractères minimum" required />
                  </div>
                  <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <button type="button" className="btn" onClick={() => setAjoutAdminOuvert(false)}>Annuler</button>
                    <button type="submit" className="btn btn-primaire" disabled={soumissionAdmin}>
                      {soumissionAdmin ? 'Création…' : "Créer l'administrateur"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="carte" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--fond2)', borderBottom: '1px solid var(--bordure)' }}>
                    {['Nom', 'Identifiant', 'Créé le', ''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--texte2)', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a, i) => {
                    const estMoi = a.identifiant === admin?.identifiant;
                    return (
                      <tr key={a.id} style={{ borderBottom: i < admins.length - 1 ? '1px solid var(--bordure)' : 'none' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          {a.nom}
                          {estMoi && (
                            <span style={{ marginLeft: 8, fontSize: 10, background: 'var(--bleu-clair)', color: 'var(--bleu)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Vous</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--texte2)' }}>{a.identifiant}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--texte3)' }}>{formaterDate(a.created_at)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {!estMoi && admins.length > 1 && (
                            <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => supprimerAdmin(a.id, a.nom)}>
                              Supprimer
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {onglet === 'scans' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ color: 'var(--texte2)', fontSize: 13 }}>{scansTotal} scan(s) enregistré(s)</p>

            {chargementScans ? (
              <div className="chargement">Chargement…</div>
            ) : scans.length === 0 ? (
              <div className="carte" style={{ textAlign: 'center', padding: 40, color: 'var(--texte3)' }}>
                Aucun scan enregistré
              </div>
            ) : (
              <>
                <div className="carte" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--fond2)', borderBottom: '1px solid var(--bordure)' }}>
                        {['Parapheur', 'Opérateur', 'Lieu', 'Date', ''].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--texte2)', fontSize: 12 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scans.map((s, i) => (
                        <tr key={s.id} style={{ borderBottom: i < scans.length - 1 ? '1px solid var(--bordure)' : 'none' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{s.parapheur_numero}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--texte2)' }}>{s.operateur_nom || '—'}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--texte2)' }}>{s.nom_lieu || '—'}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--texte3)' }}>{formaterDate(s.scanned_at)}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <button
                              className="btn btn-danger"
                              title="Supprimer"
                              aria-label="Supprimer"
                              style={{ padding: '5px 10px', fontSize: 16, lineHeight: 1 }}
                              onClick={() => supprimerScan(s.id, s.parapheur_numero)}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {scansTotal > SCANS_PAR_PAGE && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
                    <button className="btn" disabled={scansPage <= 1} onClick={() => chargerScans(scansPage - 1)}>← Précédent</button>
                    <span style={{ fontSize: 13, color: 'var(--texte2)' }}>
                      Page {scansPage} / {Math.ceil(scansTotal / SCANS_PAR_PAGE)}
                    </span>
                    <button className="btn" disabled={scansPage >= Math.ceil(scansTotal / SCANS_PAR_PAGE)} onClick={() => chargerScans(scansPage + 1)}>Suivant →</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {onglet === 'apk' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
            <div className="carte">
              <h3 style={{ fontWeight: 600, marginBottom: 16 }}>APK CoeurTrace</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: 'var(--fond2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--texte2)', wordBreak: 'break-all' }}>
                  Lien direct : <strong>{window.location.origin}/api/admin/apk/download</strong>
                </div>
                <div className="sep" />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--texte2)' }}>QR code de téléchargement</p>
                  <div style={{ background: 'white', padding: 12, borderRadius: 8, border: '1px solid var(--bordure)' }}>
                    <QRCodeSVG
                      value={`${window.location.origin}/api/admin/apk/download`}
                      size={180}
                      fgColor="var(--bleu)"
                      bgColor="white"
                      level="M"
                    />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--texte3)', textAlign: 'center' }}>Scannez pour télécharger l'APK sur mobile</p>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
