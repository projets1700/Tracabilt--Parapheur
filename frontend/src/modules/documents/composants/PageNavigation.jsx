import { useEffect, useRef, useState } from 'react';
import { rendrePage } from '../services/pdfRendu';

const LARGEUR_MINIATURE = 84;

function Miniature({ pdf, page, active, qrcodes, onClick }) {
  const boutonRef = useRef(null);
  const fondRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const echelle = LARGEUR_MINIATURE / page.largeur;

  // Rendu paresseux : seules les miniatures visibles sont dessinées.
  useEffect(() => {
    const el = boutonRef.current;
    if (!el || !('IntersectionObserver' in window)) { setVisible(true); return undefined; }
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const tache = rendrePage(pdf, page.numero, echelle);
    tache.promesse.then(c => c && fondRef.current?.replaceChildren(c)).catch(() => {});
    return () => tache.annuler();
  }, [visible, pdf, page.numero, echelle]);

  useEffect(() => {
    if (active) boutonRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  return (
    <button ref={boutonRef} type="button" className={`miniature${active ? ' active' : ''}`} onClick={onClick} aria-label={`Page ${page.numero}`} aria-current={active ? 'page' : undefined}>
      {qrcodes.length > 0 && <span className="compteur" title={`${qrcodes.length} QR code(s)`}>{qrcodes.length}</span>}
      <div className="cadre" style={{ width: LARGEUR_MINIATURE, height: page.hauteur * echelle, position: 'relative' }}>
        <div ref={fondRef} style={{ position: 'absolute', inset: 0 }} />
        {qrcodes.map(q => (
          <div
            key={q.cle}
            style={{
              position: 'absolute',
              left: q.x * echelle, top: q.y * echelle,
              width: q.largeur * echelle, height: q.hauteur * echelle,
              background: 'rgba(0,157,191,0.35)', border: '1px solid var(--bleu)',
            }}
          />
        ))}
      </div>
      <span>{page.numero}</span>
    </button>
  );
}

/**
 * PageNavigation — miniatures de toutes les pages du document (§3.2).
 */
export default function PageNavigation({ pdf, pages, pageCourante, qrcodes, onChoisir }) {
  return (
    <aside className="miniatures" aria-label="Pages du document">
      {pages.map(p => (
        <Miniature
          key={p.numero}
          pdf={pdf}
          page={p}
          active={p.numero === pageCourante}
          qrcodes={qrcodes.filter(q => q.page === p.numero)}
          onClick={() => onChoisir(p.numero)}
        />
      ))}
    </aside>
  );
}
