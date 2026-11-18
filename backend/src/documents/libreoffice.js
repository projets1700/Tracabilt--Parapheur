/**
 * Conversion documentaire via LibreOffice (cahier des charges §5.1).
 * Chaque conversion s'exécute dans un dossier temporaire et un profil utilisateur
 * dédiés, de façon asynchrone, avec une concurrence limitée et un délai maximal.
 */
const { spawn } = require('child_process');
const fs = require('fs/promises');
const fsSync = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const crypto = require('crypto');

const DELAI_MS = Number(process.env.LIBREOFFICE_TIMEOUT_MS) || 120000;
const CONCURRENCE = Math.max(1, Number(process.env.LIBREOFFICE_CONCURRENCE) || 2);

function binaire() {
  if (process.env.LIBREOFFICE_BIN) return process.env.LIBREOFFICE_BIN;
  if (process.platform === 'win32') {
    const candidats = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    ];
    return candidats.find(c => fsSync.existsSync(c)) || 'soffice.exe';
  }
  if (process.platform === 'darwin') return '/Applications/LibreOffice.app/Contents/MacOS/soffice';
  return 'soffice';
}

class ErreurConversion extends Error {}

/*
 * File d'attente : CONCURRENCE emplacements, chacun avec son propre profil
 * LibreOffice persistant (créer un profil à chaque conversion coûte ~20 s).
 */
const emplacementsLibres = Array.from({ length: CONCURRENCE }, (_, i) => i);
const attente = [];
function acquerir() {
  if (emplacementsLibres.length) return Promise.resolve(emplacementsLibres.shift());
  return new Promise(resolve => attente.push(resolve));
}
function liberer(emplacement) {
  const suivant = attente.shift();
  if (suivant) suivant(emplacement); else emplacementsLibres.push(emplacement);
}
function dossierProfil(emplacement) {
  const base = process.env.LIBREOFFICE_PROFILS_DIR || path.join(os.tmpdir(), 'tracaparapheur-libreoffice');
  return path.join(base, `profil-${emplacement}`);
}

/**
 * Termine LibreOffice ET ses processus enfants : soffice lance soffice.bin,
 * qui resterait sinon orphelin en verrouillant le profil.
 */
function tuerArborescence(proc) {
  if (!proc.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true }).on('error', () => {});
  } else {
    try { process.kill(-proc.pid, 'SIGKILL'); } catch { proc.kill('SIGKILL'); }
  }
}

function executer(args, cwd) {
  return new Promise((resolve, reject) => {
    // Sous Unix, groupe de processus dédié pour pouvoir tout terminer en cas de blocage.
    const proc = spawn(binaire(), args, { cwd, windowsHide: true, detached: process.platform !== 'win32' });
    let sortie = '';
    proc.stdout.on('data', d => { sortie += d; });
    proc.stderr.on('data', d => { sortie += d; });
    const minuterie = setTimeout(() => {
      tuerArborescence(proc);
      reject(new ErreurConversion('La conversion du document a dépassé le délai autorisé.'));
    }, DELAI_MS);
    proc.on('error', err => {
      clearTimeout(minuterie);
      reject(new ErreurConversion(err.code === 'ENOENT'
        ? "Le service de conversion (LibreOffice) n'est pas installé sur le serveur."
        : `Échec du lancement de la conversion : ${err.message}`));
    });
    proc.on('close', code => {
      clearTimeout(minuterie);
      if (code === 0) resolve(sortie);
      else reject(new ErreurConversion(`La conversion a échoué (code ${code}).`));
    });
  });
}

/**
 * Convertit des octets d'un format vers un autre.
 * @param {Buffer} octets
 * @param {string} extEntree  'docx' | 'pdf'
 * @param {string} cible      ex. 'pdf', 'docx:"MS Word 2007 XML"' ou filtre avec options JSON
 * @param {string} extSortie  extension du fichier produit
 * @param {object} [options]  { filtreEntree }
 */
async function convertir(octets, extEntree, cible, extSortie, options = {}) {
  const emplacement = await acquerir();
  const dossier = await fs.mkdtemp(path.join(os.tmpdir(), 'tq-conv-'));
  try {
    const entree = path.join(dossier, `entree-${crypto.randomBytes(4).toString('hex')}.${extEntree}`);
    await fs.writeFile(entree, octets);
    const profil = pathToFileURL(dossierProfil(emplacement)).href;
    const args = [
      `-env:UserInstallation=${profil}`,
      '--headless', '--norestore', '--nolockcheck', '--nodefault', '--nofirststartwizard',
    ];
    if (options.filtreEntree) args.push(`--infilter=${options.filtreEntree}`);
    args.push('--convert-to', cible, '--outdir', path.join(dossier, 'sortie'), entree);
    await executer(args, dossier);

    const fichiers = await fs.readdir(path.join(dossier, 'sortie')).catch(() => []);
    const produit = fichiers.find(f => f.toLowerCase().endsWith(`.${extSortie}`));
    if (!produit) throw new ErreurConversion("La conversion n'a produit aucun fichier : le document est peut-être corrompu.");
    const resultat = await fs.readFile(path.join(dossier, 'sortie', produit));
    if (!resultat.length) throw new ErreurConversion('La conversion a produit un fichier vide.');
    return resultat;
  } finally {
    // Suppression systématique des fichiers temporaires (§7.2).
    await fs.rm(dossier, { recursive: true, force: true }).catch(() => {});
    liberer(emplacement);
  }
}

/** Document texte (docx, doc, odt) → PDF. */
function documentVersPdf(octets, extension) {
  return convertir(octets, extension, 'pdf:writer_pdf_Export', 'pdf');
}

async function disponible() {
  try {
    await executer(['--version'], os.tmpdir());
    return true;
  } catch {
    return false;
  }
}

module.exports = { convertir, documentVersPdf, disponible, ErreurConversion };
