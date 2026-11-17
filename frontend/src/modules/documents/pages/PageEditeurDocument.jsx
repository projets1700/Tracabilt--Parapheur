import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import EnTeteApp from '../../../composants/EnTeteApp';
import DocumentViewer from '../composants/DocumentViewer';
import PageNavigation from '../composants/PageNavigation';
import QRCodeProperties from '../composants/QRCodeProperties';
import ListeQRCodes from '../composants/ListeQRCodes';
import HistoriqueDocument from '../composants/HistoriqueDocument';
import ExportDialog from '../composants/ExportDialog';
import DialogueNomQr from '../composants/DialogueNomQr';
import LienTelechargement from '../composants/LienTelechargement';
import BandeauMode from '../composants/BandeauMode';
import useModeDocuments from '../hooks/useModeDocuments';
import { IconeFormat } from '../composants/ListeDocuments';
import useAnnulation from '../hooks/useAnnulation';
import { chargerPdf } from '../services/pdfRendu';
import {
  obtenirDocument, obtenirApercu, creerQr, renommerQr, enregistrerEdition, telechargerDocument,
  messageErreur, STATUTS_DOCUMENT,
} from '../services/documentsApi';
import { lireBrouillon, ecrireBrouillon, effacerBrouillon } from '../services/magasinLocal';
import {
  contraindreDansPage, mmVersPoints, TAILLE_QR_DEFAUT, MARGE_REPERE,
} from '../utils/coordonnees';
import { formaterTaille, FORMATS } from '../utils/validationFichier';
import '../documents.css';

const PX_PAR_POINT = 96 / 72;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

function formaterDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function champSaisi(el) {
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/**
 * DocumentEditor — éditeur unique pour les documents Word et PDF (§4, §12).
 * La couche d'édition ne manipule que des positions et dimensions ; la génération
 * est déléguée au moteur adapté au format de sortie.
 */
export default function PageEditeurDocument() {
  const { id } = useParams();
  const mode = useModeDocuments();

  const [doc, setDoc] = useState(null);
  const [apercu, setApercu] = useState(null); // { pdf, pages }
  const [chargement, setChargement] = useState('Chargement du document…');
  const [erreur, setErreur] = useState('');

  const { etat: qrcodes, definir, annuler, retablir, reinitialiser, transformerTout, peutAnnuler, peutRetablir } = useAnnulation([]);
  const [initiaux, setInitiaux] = useState([]);
  // QR codes créés depuis le dernier enregistrement (pour supprimer côté serveur / libérer leur nom s'ils sont retirés).
  const creesServeur = useRef([]);
  // Fenêtre de saisie du nom : { mode: 'ajout' | 'duplication' | 'renommage', position?, cle? }
  const [dialogueNom, setDialogueNom] = useState(null);
  // Dernier fichier téléchargé (lien de secours si le navigateur bloque le téléchargement).
  const [fichierTelecharge, setFichierTelecharge] = useState(null);

  const [pageCourante, setPageCourante] = useState(1);
  const [selection, setSelection] = useState(null);
  const [zoom, setZoom] = useState({ mode: 'ajuste', valeur: 1 });
  const [largeurZone, setLargeurZone] = useState(800);
  const [apercuFinal, setApercuFinal] = useState(false);
  const [exportOuvert, setExportOuvert] = useState(false);
  const [notification, setNotification] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [versionHisto, setVersionHisto] = useState(0);
  const [brouillon, setBrouillon] = useState(null);
  const zoneRef = useRef(null);

  const pages = useMemo(() => apercu?.pages || [], [apercu]);
  const page = pages[pageCourante - 1];

  /* ---------------- Chargement ---------------- */
  useEffect(() => {
    let actif = true;
    let pdfCharge = null;
    (async () => {
      try {
        const d = await obtenirDocument(id);
        if (!actif) return;
        setDoc(d);
        setChargement(d.format === 'docx' ? "Conversion du document Word pour l'aperçu…" : "Préparation de l'aperçu…");

        const octets = await obtenirApercu(id);
        const info = await chargerPdf(octets);
        if (!actif) { info.pdf.destroy(); return; }
        pdfCharge = info.pdf;

        const qrs = d.qrcodes.filter(q => q.page >= 1 && q.page <= info.pages.length);
        setApercu(info);
        reinitialiser(qrs);
        setInitiaux(qrs);

        const b = lireBrouillon(id);
        if (b) {
          const plusRecent = !d.modifieLe || new Date(b.enregistreLe) > new Date(d.modifieLe);
          if (plusRecent && JSON.stringify(b.qrcodes) !== JSON.stringify(qrs)) setBrouillon(b);
          else effacerBrouillon(id);
        }
      } catch (err) {
        if (actif) {
          setErreur(err.response?.status === 404 || err.introuvable
            ? (err.introuvable ? err.message : 'Ce document est introuvable.')
            : messageErreur(err, "Le document n'a pas pu être chargé."));
        }
      } finally {
        if (actif) setChargement('');
      }
    })();
    return () => { actif = false; pdfCharge?.destroy(); };
  }, [id, reinitialiser]);


  /* ---------------- Zoom / ajustement à la largeur ---------------- */
  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return undefined;
    const obs = new ResizeObserver(([e]) => setLargeurZone(e.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, [apercu]);

  const echelleAjustee = page ? Math.min(Math.max((largeurZone - 8) / page.largeur, ZOOM_MIN), 2) : 1;
  const echelle = zoom.mode === 'ajuste' ? echelleAjustee : zoom.valeur;

  const zoomer = useCallback(facteur => {
    setZoom(z => {
      const base = z.mode === 'ajuste' ? echelleAjustee : z.valeur;
      return { mode: 'fixe', valeur: Math.min(Math.max(base * facteur, ZOOM_MIN), ZOOM_MAX) };
    });
  }, [echelleAjustee]);

  /* ---------------- État modifié / brouillon ---------------- */
  const modifie = JSON.stringify(qrcodes) !== JSON.stringify(initiaux);

  useEffect(() => {
    if (modifie && doc && !brouillon) ecrireBrouillon(id, { qrcodes });
  }, [modifie, qrcodes, id, doc, brouillon]);

  useEffect(() => {
    if (!modifie) return undefined;
    const avertir = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avertir);
    return () => window.removeEventListener('beforeunload', avertir);
  }, [modifie]);

  function notifier(type, texte) {
    setNotification({ type, texte });
    if (type === 'succes') setTimeout(() => setNotification(n => (n?.texte === texte ? null : n)), 4000);
  }

  /* ---------------- Opérations sur les QR codes ---------------- */
  const modifierQr = useCallback((cle, changements) => {
    definir(prev => prev.map(q => {
      if (q.cle !== cle) return q;
      const cible = pages[(changements.page ?? q.page) - 1];
      return cible ? contraindreDansPage({ ...q, ...changements }, cible) : q;
    }));
    if (changements.page) setPageCourante(changements.page);
  }, [definir, pages]);

  /** Crée le QR code avec le nom choisi ; une erreur (nom déjà pris…) remonte à la fenêtre de saisie. */
  async function placerNouveauQr(position, nom) {
    const cible = pages[position.page - 1];
    const qr = await creerQr(id, { nom, position, page: cible });
    creesServeur.current.push(qr);
    definir(prev => [...prev, contraindreDansPage(qr, cible)]);
    setSelection(qr.cle);
    setApercuFinal(false);
    setDialogueNom(null);
    notifier('succes', `QR code ${qr.numero} ajouté.`);
  }

  /** Renommage : enregistré immédiatement (unicité vérifiée par le serveur), hors historique d'annulation. */
  async function renommer(cle, nom) {
    const q = qrcodes.find(x => x.cle === cle);
    if (!q) return;
    if (nom === q.numero) { setDialogueNom(null); return; }
    const champs = await renommerQr(id, q, nom);
    const appliquer = x => (x.cle === cle ? { ...x, ...champs } : x);
    transformerTout(etat => etat.map(appliquer));
    if (q.id) setInitiaux(prev => prev.map(appliquer)); // déjà enregistré côté serveur
    creesServeur.current = creesServeur.current.map(appliquer);
    setDialogueNom(null);
    notifier('succes', `QR code renommé en ${champs.numero}.`);
  }

  function ajouterQr() {
    if (!page) return;
    // Par défaut : coin bas-droit, en décalant si la place est déjà prise.
    const decalage = qrcodes.filter(q => q.page === pageCourante).length * mmVersPoints(8);
    setDialogueNom({
      mode: 'ajout',
      position: contraindreDansPage({
        page: pageCourante,
        x: page.largeur - MARGE_REPERE - TAILLE_QR_DEFAUT - decalage,
        y: page.hauteur - MARGE_REPERE - TAILLE_QR_DEFAUT - decalage,
        largeur: TAILLE_QR_DEFAUT,
        hauteur: TAILLE_QR_DEFAUT,
      }, page),
    });
  }

  function dupliquerQr(cle) {
    const src = qrcodes.find(q => q.cle === cle);
    if (!src) return;
    const p = pages[src.page - 1];
    setDialogueNom({
      mode: 'duplication',
      position: contraindreDansPage({
        page: src.page, x: src.x + mmVersPoints(8), y: src.y + mmVersPoints(8), largeur: src.largeur, hauteur: src.hauteur,
      }, p),
    });
  }

  const supprimerQr = useCallback(cle => {
    const q = qrcodes.find(x => x.cle === cle);
    if (!q) return;
    if (!confirm(`Supprimer le QR code ${q.numero || q.reference} de la page ${q.page} ?\n(Vous pourrez annuler avec Ctrl+Z avant l'enregistrement.)`)) return;
    definir(prev => prev.filter(x => x.cle !== cle));
    setSelection(null);
  }, [qrcodes, definir]);

  function selectionnerDepuisListe(cle, numeroPage) {
    setPageCourante(numeroPage);
    setSelection(cle);
    setApercuFinal(false);
  }

  /* ---------------- Enregistrement ---------------- */
  async function enregistrer() {
    const presents = new Set(qrcodes.map(q => q.cle));
    const vus = new Set();
    const supprimes = [...initiaux, ...creesServeur.current].filter(q => {
      if (presents.has(q.cle) || vus.has(q.cle)) return false;
      vus.add(q.cle);
      return true;
    });
    const maj = await enregistrerEdition(id, { qrcodes, supprimes, pages, initiaux });
    setDoc(d => ({ ...d, ...maj, qrcodes }));
    setInitiaux(qrcodes);
    creesServeur.current = [];
    effacerBrouillon(id);
    setVersionHisto(v => v + 1);
    return maj;
  }

  async function enregistrerAvecRetour() {
    setOccupe(true);
    try {
      await enregistrer();
      notifier('succes', 'Modifications enregistrées.');
    } catch (err) {
      notifier('erreur', `${messageErreur(err, "L'enregistrement a échoué.")} Vos modifications sont conservées sur ce poste.`);
    } finally {
      setOccupe(false);
    }
  }

  async function telechargerOriginal() {
    try {
      await telechargerDocument(doc, 'original');
    } catch (err) {
      notifier('erreur', messageErreur(err, 'Le téléchargement a échoué.'));
    }
  }

  /* ---------------- Raccourcis clavier ---------------- */
  useEffect(() => {
    function touche(e) {
      if (champSaisi(document.activeElement) || exportOuvert || dialogueNom) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); annuler(); return; }
      if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); retablir(); return; }
      if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); if (modifie) enregistrerAvecRetour(); return; }
      if (!selection || apercuFinal) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); supprimerQr(selection); return; }
      if (e.key === 'Escape') { setSelection(null); return; }
      const pas = mmVersPoints(e.shiftKey ? 5 : 1);
      const q = qrcodes.find(x => x.cle === selection);
      if (!q) return;
      const deplacements = { ArrowLeft: { x: q.x - pas }, ArrowRight: { x: q.x + pas }, ArrowUp: { y: q.y - pas }, ArrowDown: { y: q.y + pas } };
      if (deplacements[e.key]) { e.preventDefault(); modifierQr(selection, deplacements[e.key]); }
    }
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  });

  /* ---------------- Rendu ---------------- */
  if (erreur) {
    return (
      <div className="page-docs">
        <EnTeteApp />
        <div className="page-docs-contenu" style={{ maxWidth: 640 }}>
          <div className="message-erreur">{erreur}</div>
          <Link to="/documents" className="btn" style={{ alignSelf: 'flex-start' }}>← Retour aux documents</Link>
        </div>
      </div>
    );
  }

  if (chargement || !doc || !apercu) {
    return (
      <div className="page-docs">
        <EnTeteApp />
        <div className="chargement" style={{ flexDirection: 'column', gap: 12, paddingTop: 80 }}>
          <div className="barre-progression" style={{ width: 220 }}><div style={{ width: '50%' }} /></div>
          {chargement || 'Chargement…'}
        </div>
      </div>
    );
  }

  const qrPage = qrcodes.filter(q => q.page === pageCourante);
  const qrSelectionne = qrcodes.find(q => q.cle === selection) || null;
  const pourcentage = Math.round((echelle / PX_PAR_POINT) * 100);

  return (
    <div className="editeur">
      <EnTeteApp />

      {/* Barre d'outils supérieure */}
      <div className="editeur-barre">
        <Link to="/documents" className="btn-icone" title="Retour aux documents" aria-label="Retour aux documents">←</Link>
        <IconeFormat format={doc.format} />
        <span className="titre" title={doc.nom}>{doc.nom}{modifie && <span style={{ color: 'var(--orange)' }} title="Modifications non enregistrées"> •</span>}</span>

        <span className="separateur" />
        <div className="groupe">
          <button className="btn-icone" onClick={annuler} disabled={!peutAnnuler} title="Annuler (Ctrl+Z)" aria-label="Annuler">↶</button>
          <button className="btn-icone" onClick={retablir} disabled={!peutRetablir} title="Rétablir (Ctrl+Y)" aria-label="Rétablir">↷</button>
        </div>

        <span className="separateur" />
        <div className="groupe">
          <button className="btn-icone" onClick={() => zoomer(1 / 1.2)} disabled={echelle <= ZOOM_MIN} title="Zoom arrière" aria-label="Zoom arrière">−</button>
          <span className="zoom-valeur">{pourcentage} %</span>
          <button className="btn-icone" onClick={() => zoomer(1.2)} disabled={echelle >= ZOOM_MAX} title="Zoom avant" aria-label="Zoom avant">+</button>
          <button className={`btn-icone${zoom.mode === 'ajuste' ? ' actif' : ''}`} onClick={() => setZoom({ mode: 'ajuste', valeur: 1 })} title="Ajuster à la largeur">↔</button>
        </div>

        <span className="separateur" />
        <div className="groupe">
          <button className="btn-icone" onClick={() => setPageCourante(p => Math.max(1, p - 1))} disabled={pageCourante <= 1} aria-label="Page précédente">‹</button>
          <span className="zoom-valeur" style={{ minWidth: 70 }}>Page {pageCourante} / {pages.length}</span>
          <button className="btn-icone" onClick={() => setPageCourante(p => Math.min(pages.length, p + 1))} disabled={pageCourante >= pages.length} aria-label="Page suivante">›</button>
        </div>

        <span className="espace" />
        <button className={`btn-icone${apercuFinal ? ' actif' : ''}`} onClick={() => { setApercuFinal(a => !a); setSelection(null); }} title="Visualiser le résultat final">
          👁 <span style={{ fontSize: 12, marginLeft: 4 }}>Aperçu final</span>
        </button>
        <button className="btn" onClick={enregistrerAvecRetour} disabled={!modifie || occupe} title="Enregistrer (Ctrl+S)">
          {occupe ? '…' : 'Enregistrer'}
        </button>
        <button className="btn btn-primaire" onClick={() => setExportOuvert(true)} disabled={occupe || !qrcodes.length} title={!qrcodes.length ? "Ajoutez d'abord un QR code" : 'Télécharger le document avec ses QR codes'}>⬇ Télécharger avec QR code</button>
      </div>

      {(notification || brouillon || fichierTelecharge || mode?.mode === 'local') && (
        <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6, background: 'white', borderBottom: '1px solid var(--bordure)' }}>
          {brouillon && (
            <div className="bandeau bandeau-alerte" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 200 }}>
                Des modifications non enregistrées du {formaterDate(brouillon.enregistreLe)} ont été retrouvées sur ce poste.
              </span>
              <button className="btn btn-petit btn-primaire" onClick={() => {
                definir(brouillon.qrcodes.filter(q => q.page >= 1 && q.page <= pages.length));
                setBrouillon(null);
              }}>Restaurer</button>
              <button className="btn btn-petit" onClick={() => { effacerBrouillon(id); setBrouillon(null); }}>Ignorer</button>
            </div>
          )}
          <LienTelechargement fichier={fichierTelecharge} onFermer={() => setFichierTelecharge(null)} />
          {notification && (
            <div className={notification.type === 'erreur' ? 'message-erreur' : 'message-succes'} role="status" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{notification.texte}</span>
              <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', color: 'inherit' }} aria-label="Fermer">✕</button>
            </div>
          )}
          <BandeauMode mode={mode} />
        </div>
      )}

      <div className="editeur-corps">
        <PageNavigation pdf={apercu.pdf} pages={pages} pageCourante={pageCourante} qrcodes={qrcodes} onChoisir={n => { setPageCourante(n); setSelection(null); }} />

        {/* Zone centrale */}
        <div className="zone-centrale">
          {/* Bloc (et non flex centré) : quand la page dépasse en largeur, elle reste entièrement accessible au défilement. */}
          <div ref={zoneRef} style={{ width: '100%' }}>
            {page && (
              <DocumentViewer
                pdf={apercu.pdf}
                page={page}
                echelle={echelle}
                qrcodes={qrPage}
                selection={selection}
                verrouille={apercuFinal}
                onSelectionner={setSelection}
                onModifier={modifierQr}
              />
            )}
          </div>
          <div className="nav-pages">
            <button className="btn-icone" onClick={() => setPageCourante(p => Math.max(1, p - 1))} disabled={pageCourante <= 1} aria-label="Page précédente">‹</button>
            Page {pageCourante} sur {pages.length}
            <button className="btn-icone" onClick={() => setPageCourante(p => Math.min(pages.length, p + 1))} disabled={pageCourante >= pages.length} aria-label="Page suivante">›</button>
          </div>
          {!apercuFinal && (
            <p style={{ fontSize: 11, color: 'var(--texte3)', marginTop: 8, textAlign: 'center' }}>
              Glissez un QR code pour le déplacer, tirez un coin pour le redimensionner · flèches : 1 mm (Maj : 5 mm) · Suppr : supprimer
            </p>
          )}
        </div>

        {/* Panneau latéral */}
        <aside className="panneau">
          <section>
            <h3>Document</h3>
            <div className="ligne-info"><span>Format</span><span>{doc.format === 'docx' ? 'Word (.docx)' : 'PDF'}</span></div>
            {doc.sourceFormat && doc.sourceFormat !== doc.format && (
              <div className="ligne-info"><span>Converti depuis</span><span>{FORMATS[doc.sourceFormat]?.label || doc.sourceFormat} ({FORMATS[doc.sourceFormat]?.extension})</span></div>
            )}
            <div className="ligne-info"><span>Pages</span><span>{pages.length}</span></div>
            {doc.taille != null && <div className="ligne-info"><span>Taille</span><span>{formaterTaille(doc.taille)}</span></div>}
            <div className="ligne-info"><span>Importé le</span><span>{formaterDate(doc.creeLe)}</span></div>
            {doc.creePar && <div className="ligne-info"><span>Par</span><span>{doc.creePar}</span></div>}
            <div className="ligne-info">
              <span>Statut</span>
              <span><span className={`badge ${STATUTS_DOCUMENT[doc.statut]?.classe || 'badge-gris'}`}>{STATUTS_DOCUMENT[doc.statut]?.label || doc.statut}</span></span>
            </div>
            {doc.genereLe && <div className="ligne-info"><span>Généré le</span><span>{formaterDate(doc.genereLe)}</span></div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-petit" onClick={telechargerOriginal}>⬇ Original</button>
              {doc.genere && <button className="btn btn-petit" onClick={() => telechargerDocument(doc, 'genere').catch(err => notifier('erreur', messageErreur(err)))}>⬇ {doc.nomGenere || 'Document généré'}</button>}
            </div>
          </section>

          <section>
            <h3>
              QR codes <span className="badge badge-bleu">{qrcodes.length}</span>
            </h3>
            <button
              className="btn btn-primaire"
              style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
              onClick={ajouterQr}
              disabled={occupe}
            >
              + Ajouter un QR code sur la page {pageCourante}
            </button>
            <p style={{ fontSize: 11, color: 'var(--texte3)', marginBottom: 10 }}>
              Vous choisissez le nom de chaque QR code (un nom libre DEP-… est proposé). Deux QR codes ne peuvent pas porter le même nom.
            </p>
            <ListeQRCodes qrcodes={qrcodes} selection={selection} onSelectionner={selectionnerDepuisListe} />
          </section>

          <section>
            <h3>Paramètres du QR code</h3>
            <QRCodeProperties
              qr={qrSelectionne}
              pages={pages}
              verrouille={apercuFinal}
              onModifier={modifierQr}
              onDupliquer={dupliquerQr}
              onRenommer={cle => setDialogueNom({ mode: 'renommage', cle })}
              onSupprimer={supprimerQr}
            />
          </section>

          <section>
            <h3>Historique</h3>
            <HistoriqueDocument documentId={id} rafraichir={versionHisto} />
          </section>
        </aside>
      </div>

      {dialogueNom && (
        <DialogueNomQr
          titre={{ ajout: `Nouveau QR code — page ${dialogueNom.position?.page}`, duplication: 'Dupliquer le QR code', renommage: 'Renommer le QR code' }[dialogueNom.mode]}
          libelleValider={dialogueNom.mode === 'renommage' ? 'Renommer' : 'Ajouter le QR code'}
          valeurInitiale={dialogueNom.mode === 'renommage' ? (qrcodes.find(q => q.cle === dialogueNom.cle)?.numero || '') : ''}
          proposerSuggestion={dialogueNom.mode !== 'renommage'}
          onValider={nom => (dialogueNom.mode === 'renommage' ? renommer(dialogueNom.cle, nom) : placerNouveauQr(dialogueNom.position, nom))}
          onFermer={() => setDialogueNom(null)}
        />
      )}

      {exportOuvert && (
        <ExportDialog
          doc={doc}
          mode={mode}
          nbQr={qrcodes.length}
          aEnregistrer={modifie}
          onEnregistrer={enregistrer}
          onFermer={() => setExportOuvert(false)}
          onTermine={(genere, fichier) => {
            setDoc(d => ({ ...d, ...genere, qrcodes }));
            setExportOuvert(false);
            setVersionHisto(v => v + 1);
            setNotification(null);
            setFichierTelecharge(fichier);
          }}
        />
      )}
    </div>
  );
}
