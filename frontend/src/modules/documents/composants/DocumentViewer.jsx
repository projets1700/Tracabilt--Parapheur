import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KImage, Rect, Transformer, Line } from 'react-konva';
import { rendrePage } from '../services/pdfRendu';
import { qrImage } from '../utils/qr';
import { TAILLE_QR_MIN, MARGE_REPERE } from '../utils/coordonnees';

const SEUIL_MAGNETISME = 6; // pixels écran
const BLEU = '#009DBF';
const ROSE = '#E0409A';
const estTactile = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

function useImageQr(contenu) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    let actif = true;
    qrImage(contenu).then(i => actif && setImg(i)).catch(() => actif && setImg(null));
    return () => { actif = false; };
  }, [contenu]);
  return img;
}

const borner = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));

/**
 * QRCodeOverlay — un QR code positionnable sur la page.
 */
function NoeudQr({ qr, echelle, L, H, selectionne, verrouille, onSelectionner, onGuides, onModifier }) {
  const img = useImageQr(qr.contenu);
  const taille = qr.largeur * echelle;
  const commun = {
    id: `qr-${qr.cle}`,
    x: qr.x * echelle,
    y: qr.y * echelle,
    width: taille,
    height: qr.hauteur * echelle,
    draggable: !verrouille,
    onMouseDown: () => onSelectionner(qr.cle),
    onTouchStart: () => onSelectionner(qr.cle),
    onMouseEnter: e => { if (!verrouille) e.target.getStage().container().style.cursor = 'move'; },
    onMouseLeave: e => { e.target.getStage().container().style.cursor = 'default'; },
    dragBoundFunc: pos => ({
      x: borner(pos.x, 0, L - taille),
      y: borner(pos.y, 0, H - taille),
    }),
    onDragMove: e => {
      // Repères visuels et magnétisme : marges de 15 mm et axes centraux de la page.
      const n = e.target;
      const w = n.width() * n.scaleX();
      const marge = MARGE_REPERE * echelle;
      const lignesV = [marge, L / 2, L - marge];
      const lignesH = [marge, H / 2, H - marge];
      let guideV = null;
      let guideH = null;
      let x = n.x();
      let y = n.y();
      for (const l of lignesV) {
        for (const off of [0, w / 2, w]) {
          if (guideV === null && Math.abs(x + off - l) < SEUIL_MAGNETISME) { x = l - off; guideV = l; }
        }
      }
      for (const l of lignesH) {
        for (const off of [0, w / 2, w]) {
          if (guideH === null && Math.abs(y + off - l) < SEUIL_MAGNETISME) { y = l - off; guideH = l; }
        }
      }
      n.position({ x: borner(x, 0, L - w), y: borner(y, 0, H - w) });
      onGuides({ v: guideV, h: guideH, actif: true });
    },
    onDragEnd: e => {
      onGuides({ v: null, h: null, actif: false });
      onModifier(qr.cle, { x: e.target.x() / echelle, y: e.target.y() / echelle });
    },
    onTransformEnd: e => {
      const n = e.target;
      const w = n.width() * n.scaleX();
      n.scaleX(1);
      n.scaleY(1);
      n.width(w);
      n.height(w);
      onModifier(qr.cle, { x: n.x() / echelle, y: n.y() / echelle, largeur: w / echelle, hauteur: w / echelle });
    },
  };

  const contour = !selectionne && !verrouille
    ? { stroke: 'rgba(0,157,191,0.7)', strokeWidth: 1, dash: [4, 3], strokeScaleEnabled: false }
    : {};

  return img
    ? <KImage {...commun} {...contour} image={img} />
    : <Rect {...commun} fill="#E6F4F1" stroke={BLEU} dash={[4, 3]} strokeWidth={1} />;
}

/**
 * DocumentViewer — affichage d'une page + couche interactive de positionnement.
 */
export default function DocumentViewer({ pdf, page, echelle, qrcodes, selection, verrouille, onSelectionner, onModifier }) {
  const fondRef = useRef(null);
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState('');
  const [guides, setGuides] = useState({ v: null, h: null, actif: false });

  const L = page.largeur * echelle;
  const H = page.hauteur * echelle;

  // Rendu pdf.js de la page en arrière-plan.
  useEffect(() => {
    const tache = rendrePage(pdf, page.numero, echelle);
    tache.promesse
      .then(canvas => {
        if (canvas && fondRef.current) {
          fondRef.current.replaceChildren(canvas);
          setPret(true);
          setErreur('');
        }
      })
      .catch(() => setErreur("Impossible d'afficher cette page."));
    return () => tache.annuler();
  }, [pdf, page.numero, echelle]);

  // Rattache le cadre de sélection / redimensionnement au QR code sélectionné.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const noeud = selection && !verrouille ? stageRef.current?.findOne(`#qr-${selection}`) : null;
    tr.nodes(noeud ? [noeud] : []);
    tr.getLayer()?.batchDraw();
  }, [selection, verrouille, qrcodes, echelle]);

  // Fait défiler la vue jusqu'au QR code sélectionné (ex. juste après son ajout,
  // il est placé en bas de page, souvent hors de l'écran).
  const marqueurRef = useRef(null);
  const qrSelectionne = qrcodes.find(q => q.cle === selection);
  useEffect(() => {
    if (selection) marqueurRef.current?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  }, [selection]);

  function deselectionner(e) {
    if (e.target === e.target.getStage()) onSelectionner(null);
  }

  const marge = MARGE_REPERE * echelle;

  return (
    <div className="doc-page" style={{ width: L, height: H }}>
      <div className="fond" ref={fondRef} />
      {!pret && !erreur && <div className="chargement-page">Chargement de la page…</div>}
      {erreur && <div className="chargement-page" style={{ color: 'var(--rouge)' }}>{erreur}</div>}
      {qrSelectionne && (
        <div
          ref={marqueurRef}
          data-qr-selectionne={qrSelectionne.cle}
          aria-hidden
          style={{
            position: 'absolute', pointerEvents: 'none',
            left: qrSelectionne.x * echelle, top: qrSelectionne.y * echelle,
            width: qrSelectionne.largeur * echelle, height: qrSelectionne.hauteur * echelle,
          }}
        />
      )}
      <Stage
        ref={stageRef}
        className="scene"
        width={L}
        height={H}
        onMouseDown={deselectionner}
        onTouchStart={deselectionner}
      >
        <Layer>
          {guides.actif && (
            <Rect x={marge} y={marge} width={L - 2 * marge} height={H - 2 * marge} stroke={BLEU} strokeWidth={1} dash={[2, 4]} opacity={0.45} listening={false} />
          )}
          {guides.v !== null && <Line points={[guides.v, 0, guides.v, H]} stroke={ROSE} strokeWidth={1} listening={false} />}
          {guides.h !== null && <Line points={[0, guides.h, L, guides.h]} stroke={ROSE} strokeWidth={1} listening={false} />}

          {qrcodes.map(qr => (
            <NoeudQr
              key={qr.cle}
              qr={qr}
              echelle={echelle}
              L={L}
              H={H}
              selectionne={qr.cle === selection}
              verrouille={verrouille}
              onSelectionner={onSelectionner}
              onGuides={setGuides}
              onModifier={onModifier}
            />
          ))}

          <Transformer
            ref={trRef}
            keepRatio
            rotateEnabled={false}
            flipEnabled={false}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            anchorSize={estTactile ? 16 : 9}
            anchorCornerRadius={2}
            anchorStroke={BLEU}
            borderStroke={BLEU}
            borderStrokeWidth={1.5}
            boundBoxFunc={(ancien, nouveau) => {
              const tropPetit = nouveau.width < TAILLE_QR_MIN * echelle - 0.5;
              const dehors = nouveau.x < -0.5 || nouveau.y < -0.5
                || nouveau.x + nouveau.width > L + 0.5 || nouveau.y + nouveau.height > H + 0.5;
              return tropPetit || dehors ? ancien : nouveau;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
}
