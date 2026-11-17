/**
 * Fabrique de documents de test (PDF et DOCX multipages).
 */
const JSZip = require('jszip');
const { PDFDocument, degrees, StandardFonts } = require('pdf-lib');

async function pdfTest({ pages = 2, rotations = [] } = {}) {
  const doc = await PDFDocument.create();
  const police = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const p = doc.addPage([595.28, 841.89]);
    if (rotations[i]) p.setRotation(degrees(rotations[i]));
    p.drawText(`Page ${i + 1}`, { x: 72, y: 760, size: 20, font: police });
  }
  return Buffer.from(await doc.save());
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const para = t => `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;

/** DOCX d'environ 3 pages : paragraphes, tableau, saut de page. */
async function docxTest({ paragraphes = 40, lignesTableau = 20 } = {}) {
  let corps = '';
  for (let i = 1; i <= paragraphes; i++) corps += para(`Paragraphe ${i} — texte de test pour la pagination du document administratif.`);
  corps += '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr><w:tblGrid><w:gridCol/><w:gridCol/></w:tblGrid>';
  for (let r = 1; r <= lignesTableau; r++) corps += `<w:tr><w:tc>${para(`Cellule ${r}A`)}</w:tc><w:tc>${para(`Cellule ${r}B`)}</w:tc></w:tr>`;
  corps += '</w:tbl>' + para('Après le tableau') + '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' + para('Dernière page') + '<w:p/>';
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${corps}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

/** ODT minimal (texte OpenDocument) de quelques paragraphes. */
async function odtTest({ paragraphes = 30 } = {}) {
  const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"';
  let corps = '';
  for (let i = 1; i <= paragraphes; i++) corps += `<text:p>Paragraphe ODT ${i} — texte de test.</text:p>`;
  const zip = new JSZip();
  // Le fichier « mimetype » doit être le premier de l'archive, non compressé.
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('META-INF/manifest.xml', '<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>');
  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS} office:version="1.2"><office:body><office:text>${corps}</office:text></office:body></office:document-content>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

module.exports = { pdfTest, docxTest, odtTest };
