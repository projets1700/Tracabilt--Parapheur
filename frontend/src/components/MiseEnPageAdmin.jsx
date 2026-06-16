import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

const LIENS = [
  { to: '/admin',              label: 'Tableau de bord', icone: '📊', fin: true },
  { to: '/admin/utilisateurs', label: 'Scanners',        icone: '👥' },
  { to: '/admin/evenements',   label: 'Scans',           icone: '📍' },
];

export default function MiseEnPageAdmin() {
  const { utilisateur, deconnexion } = useAuth();
  const navigate = useNavigate();

  function handleDeconnexion() {
    deconnexion();
    navigate('/connexion');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 220, background: 'var(--bleu-fonce)', display: 'flex',
        flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              📋
            </div>
            <div>
              <p style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>TraçaParapheur</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>Administration</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {LIENS.map(({ to, label, icone, fin }) => (
            <NavLink
              key={to}
              to={to}
              end={fin}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8, marginBottom: 2,
                color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                textDecoration: 'none', transition: 'all 0.15s',
              })}
            >
              <span style={{ fontSize: 16 }}>{icone}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Utilisateur connecté */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ padding: '8px 12px', marginBottom: 6 }}>
            <p style={{ color: 'white', fontSize: 12, fontWeight: 500 }}>{utilisateur?.prenom} {utilisateur?.nom}</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{utilisateur?.email}</p>
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '0 4px' }}>
            <a href="/" style={{ flex: 1, textAlign: 'center', padding: '6px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
              Vue publique
            </a>
            <button onClick={handleDeconnexion} style={{ flex: 1, textAlign: 'center', padding: '6px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: 11, border: 'none', cursor: 'pointer' }}>
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', background: 'var(--fond-page)' }}>
        <Outlet />
      </main>
    </div>
  );
}