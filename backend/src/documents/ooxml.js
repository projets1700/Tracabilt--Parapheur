/**
 * Manipulation OOXML (DOCX) — moteur de génération Word (cahier des charges §3.5 B).
 *
 * Principe :
 *  1. Chaque paragraphe du corps reçoit un signet masqué (_TQP<n>). Les signets
 *     n'ont aucun effet sur la mise en page.
 *  2. La conversion LibreOffice exporte ces signets en destinations PDF : on sait
 *     ainsi sur quelle page commence chaque paragraphe (voir pdfOutils.lireDestinations).
 *  3. Pour placer un QR code sur la page N, on l'ancre dans un paragraphe qui
 *     commence sur cette page, en image flottante positionnée par rapport à la PAGE
 *     (relativeFrom="page"), verrouillée (locked="1") et sans habillage.
 */
const JSZip = require('jszip');

const PREFIXE_SIGNET = '_TQP';
const BASE_ID_SIGNET = 880000;
const BASE_ID_DESSIN = 770000;

const NS = {
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
};
const TYPE_REL_IMAGE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
const TAILLE_DECOMPRESSEE_MAX = 300 * 1024 * 1024;

class ErreurDocx extends Error {}

async function ouvrirDocx(octets) {
  let zip;
  try {
    zip = await JSZip.loadAsync(octets);
  } catch {
    throw new ErreurDocx("Le fichier n'est pas un document Word valide (archive illisible).");
  }
  // Protection contre les « bombes ZIP ».
  let total = 0;
  zip.forEach((_, f) => { total += f._data?.uncompressedSize || 0; });
  if (total > TAILLE_DECOMPRESSEE_MAX) throw new ErreurDocx('Le document Word est anormalement volumineux une fois décompressé.');
  if (!zip.file('word/document.xml')) throw new ErreurDocx("L'archive ne contient pas de document Word (word/document.xml absent).");
  return zip;
}

/**
 * Parcourt les paragraphes du corps du document, dans l'ordre, hors zones de texte.
 * Le parcours est déterministe : le même index désigne le même paragraphe dans
 * l'original et dans la copie annotée de signets.
 */
function parcourirParagraphes(xml) {
  const re = /<(\/?)(w:tbl|w:txbxContent|w:p)(?=[\s>/])[^>]*?(\/?)>/g;
  const paragraphes = [];
  let tableaux = 0;
  let zonesTexte = 0;
  let m;
  while ((m = re.exec(xml))) {
    const [balise, fermante, nom, autoFermante] = m;
    if (nom === 'w:tbl') { if (!autoFermante) tableaux += fermante ? -1 : 1; continue; }
    if (nom === 'w:txbxContent') { if (!autoFermante) zonesTexte += fermante ? -1 : 1; continue; }
    if (fermante || zonesTexte > 0) continue;

    const debut = m.index;
    const finOuverture = debut + balise.length;
    let insertion = finOuverture;
    if (!autoFermante) {
      const suite = xml.slice(finOuverture, finOuverture + 7);
      if (suite.startsWith('<w:pPr')) {
        const ouverture = xml.indexOf('>', finOuverture);
        insertion = xml[ouverture - 1] === '/'
          ? ouverture + 1
          : xml.indexOf('</w:pPr>', finOuverture) + '</w:pPr>'.length;
      }
    }
    paragraphes.push({ index: paragraphes.length, debut, finOuverture, insertion, autoFermante: Boolean(autoFermante), dansTableau: tableaux > 0, balise });
  }
  return paragraphes;
}

/** Insère des fragments XML dans des paragraphes donnés (index → fragment). */
function insererDansParagraphes(xml, paragraphes, fragments) {
  const cibles = paragraphes.filter(p => fragments.has(p.index)).sort((a, b) => b.debut - a.debut);
  let resultat = xml;
  for (const p of cibles) {
    const frag = fragments.get(p.index);
    if (p.autoFermante) {
      const ouverte = p.balise.replace(/\s*\/>$/, '>');
      resultat = resultat.slice(0, p.debut) + ouverte + frag + '</w:p>' + resultat.slice(p.finOuverture);
    } else {
      resultat = resultat.slice(0, p.insertion) + frag + resultat.slice(p.insertion);
    }
  }
  return resultat;
}

/**
 * Produit une copie du DOCX dont chaque paragraphe porte un signet masqué.
 * Utilisée uniquement pour la conversion PDF (aperçu + repérage des pages).
 */
async function annoterParagraphes(octets) {
  const zip = await ouvrirDocx(octets);
  const xml = await zip.file('word/document.xml').async('string');
  const paragraphes = parcourirParagraphes(xml);
  const fragments = new Map(paragraphes.map(p => {
    const id = BASE_ID_SIGNET + p.index;
    return [p.index, `<w:bookmarkStart w:id="${id}" w:name="${PREFIXE_SIGNET}${p.index}"/><w:bookmarkEnd w:id="${id}"/>`];
  }));
  zip.file('word/document.xml', insererDansParagraphes(xml, paragraphes, fragments));
  const sortie = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return {
    octets: sortie,
    paragraphes: paragraphes.map(p => ({ index: p.index, dansTableau: p.dansTableau })),
  };
}

/**
 * Retrouve l'index de paragraphe à partir du nom de destination PDF.
 * LibreOffice encode certains caractères du nom (« _ » devient « 5F », « %5F » ou « #5F »).
 */
function indexDepuisSignet(nom) {
  const m = /(?:^|_|5F)TQP(\d+)$/i.exec(String(nom || '').trim());
  return m ? Number(m[1]) : null;
}

function echapperAttr(t) {
  return String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function xmlAncre({ rId, idDessin, x, y, cx, cy, nom, description, ordre }) {
  return `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${251660000 + ordre}" behindDoc="0" locked="1" layoutInCell="1" allowOverlap="1">`
    + '<wp:simplePos x="0" y="0"/>'
    + `<wp:positionH relativeFrom="page"><wp:posOffset>${x}</wp:posOffset></wp:positionH>`
    + `<wp:positionV relativeFrom="page"><wp:posOffset>${y}</wp:posOffset></wp:positionV>`
    + `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>`
    + `<wp:docPr id="${idDessin}" name="${echapperAttr(nom)}" descr="${echapperAttr(description)}"/>`
    + `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="${NS.a}" noChangeAspect="1"/></wp:cNvGraphicFramePr>`
    + `<a:graphic xmlns:a="${NS.a}"><a:graphicData uri="${NS.pic}"><pic:pic xmlns:pic="${NS.pic}">`
    + `<pic:nvPicPr><pic:cNvPr id="${idDessin}" name="${echapperAttr(nom)}.png"/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr>`
    + `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
    + `<pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></pic:spPr>`
    + '</pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>';
}

function declarerEspacesDeNoms(xml) {
  return xml.replace(/<w:document\b([^>]*)>/, (balise, attrs) => {
    let a = attrs;
    if (!/\sxmlns:wp=/.test(a)) a += ` xmlns:wp="${NS.wp}"`;
    if (!/\sxmlns:r=/.test(a)) a += ` xmlns:r="${NS.r}"`;
    return `<w:document${a}>`;
  });
}

/**
 * Intègre les QR codes dans une copie du DOCX original.
 * @param {Buffer} octets  DOCX original (jamais modifié)
 * @param {Array} placements [{ paragraphe, png, emu: {x,y,cx,cy}, reference }]
 */
async function insererQrCodes(octets, placements) {
  const zip = await ouvrirDocx(octets);
  let xml = await zip.file('word/document.xml').async('string');
  const paragraphes = parcourirParagraphes(xml);

  // Relations de document.xml
  const cheminRels = 'word/_rels/document.xml.rels';
  let rels = zip.file(cheminRels)
    ? await zip.file(cheminRels).async('string')
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  const idsExistants = new Set([...rels.matchAll(/Id="([^"]+)"/g)].map(m => m[1]));
  let compteurRel = 1;
  const nouvelId = () => {
    while (idsExistants.has(`rIdTQ${compteurRel}`)) compteurRel++;
    const id = `rIdTQ${compteurRel++}`;
    idsExistants.add(id);
    return id;
  };

  // Type de contenu PNG
  let types = await zip.file('[Content_Types].xml').async('string');
  if (!/Extension="png"/i.test(types)) {
    types = types.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
    zip.file('[Content_Types].xml', types);
  }

  const fragments = new Map();
  placements.forEach((pl, i) => {
    if (!paragraphes[pl.paragraphe]) throw new ErreurDocx(`Paragraphe d'ancrage introuvable pour le QR code ${pl.reference}.`);
    const rId = nouvelId();
    const media = `media/tq_qr_${i + 1}.png`;
    zip.file(`word/${media}`, pl.png);
    rels = rels.replace('</Relationships>', `<Relationship Id="${rId}" Type="${TYPE_REL_IMAGE}" Target="${media}"/></Relationships>`);
    const ancre = xmlAncre({
      rId,
      idDessin: BASE_ID_DESSIN + i,
      ...pl.emu,
      nom: `QR ${pl.reference}`,
      description: `QR code TraçaParapheur ${pl.reference}`,
      ordre: i,
    });
    fragments.set(pl.paragraphe, (fragments.get(pl.paragraphe) || '') + ancre);
  });

  xml = declarerEspacesDeNoms(insererDansParagraphes(xml, paragraphes, fragments));
  zip.file('word/document.xml', xml);
  zip.file(cheminRels, rels);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = {
  ErreurDocx,
  ouvrirDocx,
  parcourirParagraphes,
  annoterParagraphes,
  insererQrCodes,
  indexDepuisSignet,
};
