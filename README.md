# TraçaParapheur

> Système de traçabilité de parapheurs physiques via QR Code et GPS.  
> Backend API REST · Interface web · Application mobile de scan.

---

## Table des matières

1. [Structure du projet](#structure-du-projet)
2. [Déploiement VPS](#déploiement-vps-production)
3. [Lancer en local](#lancer-en-local)
4. [Comptes et accès](#comptes-et-accès)
5. [Fonctionnalités](#fonctionnalités)
6. [API REST](#api-rest)
7. [Base de données](#base-de-données)
8. [Sécurité](#sécurité)
9. [Tests](#tests)
10. [Avancement](#avancement)

---

## Structure du projet

```
backend/   → API REST Express + PostgreSQL  (port 3001)
frontend/  → Interface web React/Vite       (port 8080 Docker / 5173 dev)
mobile/    → Application mobile Expo        (scan QR Code)
```

---

## Déploiement VPS (production)

Le projet tourne sur un VPS OVH via Docker Compose.

### Pages accessibles

| Page | Chemin |
|------|--------|
| Visionneur (public) | `/` |
| Connexion superviseur | `/superviseur/connexion` |
| Première connexion superviseur | `/superviseur/premiere-connexion` |
| Liste des parapheurs | `/parapheurs` |
| Connexion admin | `/admin/connexion` |
| Inscription admin *(1ère fois)* | `/admin/inscription` |
| Tableau de bord admin | `/admin` |
| Santé de l'API | `/api/sante` *(port 3001)* |

### Commandes utiles sur le serveur

```bash
# Mettre à jour et relancer
cd ~/Tracabilt--Parapheur
git pull
sudo docker compose build --no-cache
sudo docker compose up -d

# Vérifier l'état des conteneurs
sudo docker compose ps
```

---

## Lancer en local

### Avec Docker *(recommandé)*

> Nécessite [Docker Desktop](https://www.docker.com/products/docker-desktop/).

**1. Créer le fichier `.env` à la racine :**
```env
DB_PASSWORD=motdepasse
JWT_SECRET=secret_a_changer_en_production
```

**2. Lancer tous les services :**
```bash
docker compose up --build
```

- Frontend : http://localhost:8080
- Backend  : http://localhost:3001/api/sante

**3. Arrêter :**
```bash
docker compose down      # données conservées
docker compose down -v   # supprime aussi la base de données
```

---

### En développement (sans Docker)

**Backend**
```bash
cd backend
npm install
npm run migrate   # créer les tables
npm run dev       # http://localhost:3001
```

**Frontend**
```bash
cd frontend
npm install
npm run dev       # http://localhost:5173
```

**Application mobile**
```bash
cd mobile
npm install
npx expo start
```
Scanner le QR code dans le terminal avec **Expo Go** (Android / iOS).

> Si besoin, adapter l'URL du backend dans `mobile/src/services/api.js` :
> ```js
> export const BACKEND_URL = 'http://<IP_DU_SERVEUR>:3001/api';
> ```

---

## Comptes et accès

Les comptes se créent depuis l'interface — aucun seed nécessaire.

| Rôle | Création | Accès |
|------|----------|-------|
| **Admin** | `/admin/inscription` *(première visite)* | Gestion des scanners, superviseurs, upload APK |
| **Superviseur** | Créé par l'admin depuis le tableau de bord | Consultation de tous les parapheurs |
| **Scanner** | Créé par l'admin depuis le tableau de bord | Application mobile uniquement |

---

## Fonctionnalités

### Application mobile

| Fonctionnalité | Détail |
|---------------|--------|
| Connexion | JWT stocké localement, session persistante |
| Scan QR Code | QR Code, Code 128, Code 39, EAN-13, EAN-8 — numéro normalisé en majuscules |
| GPS | Coordonnées capturées à chaque scan (optionnel) |
| Nommage des lieux | Nom saisi au 1er scan, réutilisé dans un rayon de **100 m** |
| Anti-doublon | Cooldown de **1 minute** par parapheur, délai affiché |
| Mode hors ligne | Scans sauvegardés localement et synchronisés à la reconnexion |

---

### Interface web — Visionneur *(public)*

- Accessible sans connexion
- Recherche d'un parapheur par numéro
- Historique complet des scans : lieu, date, opérateur

---

### Interface web — Superviseur

- Compte créé par l'admin depuis le tableau de bord
- Connexion : `/superviseur/connexion`
- Première connexion → formulaire pour choisir son identifiant et mot de passe personnel
- Liste de tous les parapheurs, triée du plus récent au moins récent
- Colonnes : numéro, titre, date du dernier scan, localisation
- Clic sur un parapheur → historique complet en tableau

---

### Interface web — Administration

- Connexion requise : `/admin/connexion`

**Onglet Utilisateurs**
- Liste des scanners (nom, identifiant, date de création)
- Créer / supprimer un scanner
- Consulter la fiche d'un scanner

**Onglet Superviseurs**
- Liste des superviseurs avec statut (En attente / Actif)
- Créer un superviseur (identifiant et mot de passe provisoires)
- Supprimer un superviseur
- Consulter la fiche d'un superviseur

**Onglet Application mobile**
- Informations sur l'APK disponible (taille, date)
- Upload d'un nouvel APK
- Lien de téléchargement + QR code

---

## API REST

### Public

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/sante` | État du serveur |
| GET | `/api/parapheurs` | Liste paginée des parapheurs |
| GET | `/api/parapheurs/:numero` | Détail + historique d'un parapheur |
| GET | `/api/admin/apk/download` | Télécharger l'APK |

### Scanner *(JWT requis)*

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/scanner/connexion` | Connexion scanner |
| POST | `/api/parapheurs` | Créer un parapheur |
| PUT | `/api/parapheurs/:id` | Modifier un parapheur |
| DELETE | `/api/parapheurs/:id` | Supprimer un parapheur |
| POST | `/api/scans` | Enregistrer un scan |
| POST | `/api/scans/sync` | Synchroniser des scans hors ligne |

### Admin *(JWT admin requis)*

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/admin/existe` | Vérifie si un admin existe |
| POST | `/api/admin/inscription` | Créer le compte admin |
| POST | `/api/admin/connexion` | Connexion admin |
| GET | `/api/admin/scanners` | Liste des scanners |
| POST | `/api/admin/scanners` | Créer un scanner |
| DELETE | `/api/admin/scanners/:id` | Supprimer un scanner |
| GET | `/api/admin/superviseurs` | Liste des superviseurs |
| POST | `/api/admin/superviseurs` | Créer un superviseur |
| DELETE | `/api/admin/superviseurs/:id` | Supprimer un superviseur |
| POST | `/api/admin/apk` | Upload de l'APK |
| GET | `/api/admin/apk/info` | Infos sur l'APK |

### Superviseur *(JWT superviseur requis)*

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/superviseur/connexion` | Connexion superviseur |
| PUT | `/api/superviseur/moi` | Changer identifiant et mot de passe |

---

## Base de données

Tables PostgreSQL :

| Table | Description |
|-------|-------------|
| `scanners` | Opérateurs mobiles (créés par l'admin) |
| `parapheurs` | Parapheurs physiques identifiés par numéro |
| `scans` | Historique de chaque passage d'un scanner sur un parapheur |
| `lieux` | Noms de lieux associés aux coordonnées GPS |
| `admins` | Compte administrateur |
| `superviseurs` | Compte superviseur |

---

## Sécurité

- Authentification JWT (expiration 7 jours)
- Mots de passe chiffrés avec bcryptjs (sel 10)
- Rate limiting sur les routes sensibles
- Validation des données avec express-validator
- Middleware de rôle : `scanner` / `admin` / `superviseur`

---

## Tests

```bash
cd backend
npm test
```

Suite Jest couvrant l'authentification et les routes principales.

---

## Avancement

| # | Description | Statut |
|---|-------------|--------|
| 1 | Backend + base de données | ✅ |
| 2 | Authentification JWT (scanner) | ✅ |
| 3 | API publique visionneur | ✅ |
| 4 | API mobile scanner | ✅ |
| 5 | Interface web visionneur | ✅ |
| 6 | Application mobile scan QR + GPS | ✅ |
| 7 | Mode hors ligne + synchronisation automatique | ✅ |
| 8 | Sécurité (rate limiting, validation, JWT) | ✅ |
| 9 | Tests automatisés | ✅ |
| 10 | Déploiement Docker + VPS OVH | ✅ |
| 11 | Localisation par nom de lieu (rayon 100 m) | ✅ |
| 12 | Interface admin (scanners + APK + QR code) | ✅ |
| 13 | Compte superviseur + liste des parapheurs | ✅ |
| 14 | Charte graphique et design UI | ✅ |
