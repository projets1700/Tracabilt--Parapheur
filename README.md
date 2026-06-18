# TraçaParapheur — Système de traçabilité de parapheurs

Application complète de traçabilité de parapheurs physiques via QR Code et GPS.  
Composée d'un backend API REST, d'une interface web de consultation et d'une application mobile de scan.

---

## Structure du projet

```
backend/   → API REST Express + PostgreSQL (port 3001)
frontend/  → Interface web React/Vite — consultation des scans (port 8080 Docker / 5173 dev)
mobile/    → Application mobile Expo React Native — scan QR Code
```

---

## Lancer avec Docker (recommandé)

> Nécessite [Docker Desktop](https://www.docker.com/products/docker-desktop/).  
> PostgreSQL, la migration et le backend sont lancés automatiquement.

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

**3. Insérer les données de test (première fois) :**

```bash
docker compose exec backend node src/db/seed.js
```

**4. Arrêter :**

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
npm run seed      # insérer les données de test
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

Scanner le QR code Expo Go affiché dans le terminal avec l'application **Expo Go** (Android / iOS).

> Adapter l'adresse IP du backend dans `mobile/src/services/api.js` :
> ```js
> const BASE_URL = 'http://192.168.1.XX:3001/api'; // ton IP locale
> ```

---

## Comptes disponibles après le seed

| Rôle | Identifiant | Mot de passe |
|------|-------------|--------------|
| Scanner (Jean Martin) | j.martin | scanner123 |
| Scanner (Sophie Bernard) | s.bernard | scanner456 |

Ces comptes sont utilisés depuis l'application mobile.  
L'interface web frontend est accessible sans authentification (consultation publique).

---

## Fonctionnalités détaillées

### Application mobile

**Authentification**
- Connexion par identifiant / mot de passe
- Token JWT stocké localement (AsyncStorage), session persistée entre les ouvertures de l'app
- Déconnexion manuelle depuis l'écran de scan

**Scan QR Code et code-barres**
- Lecture en temps réel via l'appareil photo (expo-camera)
- Types supportés : QR Code, Code 128, Code 39, EAN-13, EAN-8
- Le numéro lu est normalisé en majuscules

**Localisation GPS**
- Les coordonnées GPS sont capturées automatiquement à chaque scan (haute précision)
- Si la permission GPS est refusée ou indisponible, le scan continue sans coordonnées

**Nommage des lieux**
- Lors du premier scan dans un endroit, un modal demande le nom du lieu (ex : « Bureau 302 », « Salle de réunion »)
- Les scans suivants dans un rayon de **100 mètres** réutilisent automatiquement le nom connu, sans afficher le modal (calcul par formule de Haversine)
- Si aucun GPS n'est disponible, le nom est saisi manuellement à chaque scan
- Il est possible de passer sans saisir de lieu

**Cooldown anti-doublon**
- Un même parapheur ne peut pas être scanné deux fois en moins de **5 minutes**
- Le délai restant est affiché à l'utilisateur (ex : « 3m 42s »)
- Contrôle côté client (AsyncStorage) et côté serveur (base de données)

**Mode hors ligne**
- En l'absence de réseau, les scans sont sauvegardés localement dans AsyncStorage
- Dès que la connexion WiFi est rétablie, les scans en attente sont synchronisés automatiquement avec le serveur
- L'écran Historique indique le statut de chaque scan : synchronisé ou en attente

**Historique local**
- Liste de tous les scans effectués sur l'appareil
- Affiche : numéro du parapheur, date/heure, lieu (nom ou coordonnées GPS), statut de synchronisation
- Rechargeable par glisser vers le bas (pull-to-refresh)

---

### Interface web (frontend)

- Consultation publique, sans connexion requise
- Liste des parapheurs avec leur historique de scans
- Pour chaque scan : nom du lieu en gras, date et heure
- Mise à jour en temps réel via polling

---

### Backend (API REST)

**Sécurité**
- Authentification JWT (expiration 7 jours)
- Rate limiting sur les routes sensibles
- Validation stricte des données entrantes (express-validator)
- Mots de passe hashés avec bcryptjs

**Base de données**
- Tables : `scanners`, `parapheurs`, `scans`, `lieux`
- Les lieux sont dédupliqués : par coordonnées GPS (rayon ±0.0001°) si GPS disponible, par nom sinon
- Latitude et longitude optionnelles (scans sans GPS acceptés)

---

## API REST

| Méthode | Route | Accès | Description |
|---------|-------|-------|-------------|
| POST | `/api/auth/connexion` | public | Connexion scanner, retourne un JWT |
| GET | `/api/parapheurs` | public | Liste paginée des parapheurs |
| POST | `/api/parapheurs` | scanner | Créer un parapheur |
| PUT | `/api/parapheurs/:id` | scanner | Modifier un parapheur |
| DELETE | `/api/parapheurs/:id` | scanner | Supprimer un parapheur |
| POST | `/api/scans` | scanner | Enregistrer un scan (avec lieu optionnel) |
| POST | `/api/scans/sync` | scanner | Synchroniser un lot de scans hors ligne |
| GET | `/api/scans` | public | Liste paginée des scans |
| GET | `/api/sante` | public | Vérification santé du serveur |

---

## Tests

```bash
cd backend
npm test
```

Suite de tests Jest couvrant l'authentification, les parapheurs et les scans (validation, middleware, accès base de données).

---

## Avancement du projet

| Partie | Description | Statut |
|--------|-------------|--------|
| 1 | Backend + base de données | ✅ |
| 2 | Authentification (JWT + bcrypt) | ✅ |
| 3 | API publique visiteur | ✅ |
| 4 | API mobile scanner | ✅ |
| 5 | Interface web visiteur | ✅ |
| 6 | Interface web consultation parapheurs | ✅ |
| 7 | Application mobile (scan QR + GPS) | ✅ |
| 8 | Mode hors ligne + synchronisation auto | ✅ |
| 9 | Sécurité (rate limiting, validation, JWT) | ✅ |
| 10 | Tests automatisés | ✅ |
| 11 | Déploiement Docker | ✅ |
| 12 | Localisation par nom de lieu (rayon 100 m) | ✅ |
| 13 | Corrections et nettoyage du code | ✅ |