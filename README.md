# TraçaParapheur — Système de traçabilité de parapheurs

Application de traçabilité de parapheurs physiques via QR Code et GPS.  
Composée d'un backend API, d'une interface web et d'une application mobile.

---

## Structure du projet

```
backend/   → API REST Express + PostgreSQL (port 3001)
frontend/  → Interface web React/Vite (port 5173)
mobile/    → Application mobile Expo React Native
```

---

## ⚠️ Prérequis — Base de données non configurée

> **La base de données PostgreSQL n'a pas encore été créée.**  
> Le backend et les tests ne fonctionneront pas sans cette étape.

**1. Corriger le mot de passe dans `backend/.env` :**

```env
DB_PASSWORD=ton_mot_de_passe_postgres
```

**2. Créer la base de données :**

```bash
# Windows — chemin par défaut PostgreSQL 15
"C:\Program Files\PostgreSQL\15\bin\createdb.exe" -U postgres tracaparapheur
```

**3. Lancer la migration (création des tables) :**

```bash
cd backend
npm run migrate
```

**4. Insérer les données de test :**

```bash
npm run seed
```

Comptes disponibles après le seed :

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Administrateur | admin@organisation.fr | admin123 |
| Opérateur | j.martin@organisation.fr | operateur123 |

---

## Lancer le projet

### Backend

```bash
cd backend
npm install
npm run dev
```

Serveur disponible sur **http://localhost:3001**  
Vérification : http://localhost:3001/api/sante → `{ "statut": "ok" }`

### Frontend

Dans un second terminal :

```bash
cd frontend
npm install
npm run dev
```

Interface disponible sur **http://localhost:5173**

> Le frontend nécessite le backend en cours d'exécution pour fonctionner.

### Application mobile

```bash
cd mobile
npm install
npx expo start
```

Scanner le QR code avec l'application **Expo Go** (Android / iOS).

> Avant de lancer, adapter l'adresse IP dans `mobile/src/services/api.js` :
> ```js
> const BASE_URL = 'http://192.168.1.XX:3001/api'; // ton IP locale
> ```

---

## Tests

```bash
cd backend
npm test
```

31 tests au total :
- **22 passent sans base de données** (validation, JWT, middleware)
- **9 nécessitent la base de données configurée** (requêtes SQL)

---

## Lancer avec Docker

> **Recommandé pour tester sans installer PostgreSQL localement.**  
> Nécessite [Docker Desktop](https://www.docker.com/products/docker-desktop/).

**1. Créer le fichier `.env` à la racine du projet :**

```bash
# Copier le modèle
cp .env.docker .env
```

Puis adapter le mot de passe si besoin dans `.env` :
```env
DB_PASSWORD=motdepasse
JWT_SECRET=secret_a_changer_en_production
```

**2. Lancer tous les services :**

```bash
docker compose up --build
```

- Frontend : **http://localhost**
- Backend : **http://localhost/api/sante**

PostgreSQL et la migration sont lancés automatiquement.

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

## Avancement du TP

| Partie | Description | Statut |
|--------|-------------|--------|
| 1 | Backend + base de données | Code ✅ — BDD non créée ⚠️ |
| 2 | Authentification (JWT + bcrypt) | ✅ |
| 3 | API publique visiteur | ✅ |
| 4 | API mobile scanner | ✅ |
| 5 | Interface web visiteur | ✅ |
| 6 | Interface admin | ✅ |
| 7 | Application mobile | ✅ |
| 8 | Mode hors ligne | ✅ |
| 9 | Sécurité | ✅ |
| 10 | Tests | ✅ |
| 11 | Déploiement | ✅ Docker (docker-compose.yml) |