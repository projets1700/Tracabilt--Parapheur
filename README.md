# TraçaParapheur — Système de traçabilité de parapheurs

Application complète de traçabilité de parapheurs physiques via QR Code et GPS.  
Composée d'un backend API REST, d'une interface web et d'une application mobile de scan.

---

## Structure du projet

```
backend/   → API REST Express + PostgreSQL (port 3001)
frontend/  → Interface web React/Vite (port 8080 Docker / 5173 dev)
mobile/    → Application mobile Expo React Native — scan QR Code
```

---

## Déploiement VPS (production)

Le projet tourne sur un VPS OVH à l'adresse **51.38.129.2** via Docker Compose.

### Redéployer après un push

```bash
cd ~/Tracabilt--Parapheur
git pull
sudo docker compose build --no-cache
sudo docker compose up -d
```

### Vérifier l'état des conteneurs

```bash
sudo docker compose ps
```

### URLs de production

| Page | URL |
|------|-----|
| Visionneur (public) | http://51.38.129.2:8080 |
| Connexion superviseur | http://51.38.129.2:8080/superviseur/connexion |
| Inscription superviseur (1ère fois) | http://51.38.129.2:8080/superviseur/inscription |
| Liste des parapheurs | http://51.38.129.2:8080/parapheurs |
| Connexion admin | http://51.38.129.2:8080/admin/connexion |
| Inscription admin (1ère fois) | http://51.38.129.2:8080/admin/inscription |
| Tableau de bord admin | http://51.38.129.2:8080/admin |
| API santé | http://51.38.129.2:3001/api/sante |

---

## Lancer avec Docker (local)

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

- Frontend : **http://localhost:8080**
- Backend  : **http://localhost:3001/api/sante** → `{ "statut": "ok" }`

**3. Arrêter :**

```bash
docker compose down          # arrêt (données conservées)
docker compose down -v       # arrêt + suppression de la base
```

---

## Lancer en développement

### Backend

```bash
cd backend
npm install
npm run migrate   # créer les tables
npm run dev       # serveur sur http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # interface sur http://localhost:5173
```

### Application mobile

```bash
cd mobile
npm install
npx expo start
```

Scanner le QR code affiché dans le terminal avec l'application **Expo Go** (Android / iOS).

> Adapter l'adresse IP du backend dans `mobile/src/services/api.js` si besoin :
> ```js
> export const BACKEND_URL = 'http://51.38.129.2:3001/api';
> ```

---

## Comptes et accès

Les comptes sont créés directement depuis l'interface, aucun seed n'est nécessaire.

| Rôle | Création | Accès |
|------|----------|-------|
| **Admin** | Formulaire `/admin/inscription` (première visite) | Gestion des scanners, upload APK |
| **Superviseur** | Formulaire `/superviseur/inscription` (première visite) | Consultation de tous les parapheurs |
| **Scanner** | Créé par l'admin depuis le tableau de bord | Application mobile uniquement |

---

## Fonctionnalités

### Application mobile

**Connexion**
- Formulaire de connexion avec identifiant et mot de passe
- Token JWT stocké localement, session conservée entre les ouvertures
- Déconnexion manuelle depuis l'écran de scan

**Scan QR Code**
- Lecture en temps réel via l'appareil photo
- Types supportés : QR Code, Code 128, Code 39, EAN-13, EAN-8
- Le numéro lu est normalisé en majuscules

**Localisation GPS**
- Coordonnées GPS capturées automatiquement à chaque scan
- Si la permission est refusée, le scan continue sans coordonnées

**Nommage des lieux**
- Lors du premier scan dans un endroit, saisie du nom du lieu (ex : « Bureau 302 »)
- Les scans suivants dans un rayon de **100 mètres** réutilisent automatiquement le nom connu
- Si le GPS est indisponible, le nom est saisi manuellement

**Protection anti-doublon**
- Un même parapheur ne peut pas être scanné deux fois en moins de **1 minute**
- Le délai restant est affiché (ex : « 42s »)

**Mode hors ligne**
- En l'absence de réseau, les scans sont sauvegardés localement
- Dès que la connexion est rétablie, synchronisation automatique
- L'écran Synchronisation indique le statut de chaque scan

---

### Interface web — Visionneur (public)

- Accessible sans connexion
- Recherche d'un parapheur par numéro
- Affichage de l'historique complet des scans : lieu, date, opérateur

---

### Interface web — Superviseur

- Connexion requise (`/superviseur/connexion`)
- Création du compte à la première visite (`/superviseur/inscription`)
- **Liste de tous les parapheurs** triée du plus récemment scanné au moins récent
- Pour chaque parapheur : numéro, titre, date du dernier scan, localisation
- Clic sur un parapheur → historique complet avec tous les scans en tableau

---

### Interface web — Administration

- Connexion requise (`/admin/connexion`)
- Création du compte à la première visite (`/admin/inscription`)

**Onglet Utilisateurs**
- Liste de tous les scanners (nom, identifiant, statut, date de création)
- Création d'un scanner (nom, identifiant, mot de passe)
- Suppression d'un scanner
- Consultation de la fiche d'un scanner (bouton "Fiche")

**Onglet Application mobile**
- Informations sur l'APK disponible (taille, date de mise en ligne)
- Upload d'un nouvel APK (fichier `.apk`)
- Lien de téléchargement direct
- QR code de téléchargement (à scanner depuis un téléphone)

---

## API REST

| Méthode | Route | Accès | Description |
|---------|-------|-------|-------------|
| GET | `/api/sante` | public | État du serveur |
| POST | `/api/auth/scanner/connexion` | public | Connexion scanner (JWT) |
| GET | `/api/parapheurs` | public | Liste paginée des parapheurs |
| GET | `/api/parapheurs/:numero` | public | Détail + historique d'un parapheur |
| POST | `/api/parapheurs` | scanner | Créer un parapheur |
| PUT | `/api/parapheurs/:id` | scanner | Modifier un parapheur |
| DELETE | `/api/parapheurs/:id` | scanner | Supprimer un parapheur |
| POST | `/api/scans` | scanner | Enregistrer un scan |
| POST | `/api/scans/sync` | scanner | Synchroniser des scans hors ligne |
| GET | `/api/admin/existe` | public | Vérifie si un admin existe |
| POST | `/api/admin/inscription` | public | Créer le compte admin (unique) |
| POST | `/api/admin/connexion` | public | Connexion admin |
| GET | `/api/admin/scanners` | admin | Liste des scanners |
| POST | `/api/admin/scanners` | admin | Créer un scanner |
| DELETE | `/api/admin/scanners/:id` | admin | Supprimer un scanner |
| POST | `/api/admin/apk` | admin | Upload de l'APK |
| GET | `/api/admin/apk/info` | admin | Infos sur l'APK disponible |
| GET | `/api/admin/apk/download` | public | Télécharger l'APK |
| GET | `/api/superviseur/existe` | public | Vérifie si un superviseur existe |
| POST | `/api/superviseur/inscription` | public | Créer le compte superviseur (unique) |
| POST | `/api/superviseur/connexion` | public | Connexion superviseur |

---

## Base de données

Tables PostgreSQL :

| Table | Description |
|-------|-------------|
| `scanners` | Opérateurs mobiles (créés par l'admin) |
| `parapheurs` | Parapheurs physiques identifiés par numéro |
| `scans` | Chaque passage d'un scanner sur un parapheur |
| `lieux` | Noms de lieux associés aux coordonnées GPS |
| `admins` | Compte(s) administrateur |
| `superviseurs` | Compte(s) superviseur |

---

## Sécurité

- Authentification JWT (expiration 7 jours)
- Mots de passe chiffrés avec bcryptjs (sel 10)
- Limitation du nombre de requêtes sur les routes sensibles
- Validation stricte des données entrantes (express-validator)
- Middleware de rôle par type d'utilisateur (scanner / admin / superviseur)

---

## Tests

```bash
cd backend
npm test
```

Suite de tests Jest couvrant l'authentification et les routes principales.

---

## Avancement du projet

| Partie | Description | Statut |
|--------|-------------|--------|
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
