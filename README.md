# TraçaParapheur — Système de traçabilité de parapheurs

## Avancement

| Partie | Description | Statut |
|--------|-------------|--------|
| 1 | Backend + base de données | Code ✅ — BDD non créée ⚠️ |
| 2 | Authentification (JWT + bcrypt) | ✅ Intégré dans le backend |
| 3 | API publique visiteur | ✅ Intégré dans le backend |
| 4 | API mobile scanner | ✅ Intégré dans le backend |
| 5 | Interface web visiteur | ✅ PageVisionneur + PageConnexion |
| 6 | Interface admin | ✅ Dashboard, Parapheurs, Utilisateurs, Événements |
| 7 | Application mobile | ✅ 6 écrans Expo (scanner QR, GPS, sync) |
| 8 | Mode hors ligne | ✅ Intégré dans l'app mobile |
| 9 | Sécurité | ✅ Validation, rate limiting, JWT, bcrypt |
| 10 | Tests | ✅ 31 tests (22 passent sans BDD, 9 nécessitent la BDD) |
| 11 | Déploiement | ❌ À faire |

## ⚠️ Base de données non configurée

La base de données PostgreSQL n'a pas encore été créée.
Pour la configurer :

1. Créer la base : `createdb tracaparapheur`
2. Adapter `backend/.env` avec le bon mot de passe PostgreSQL
3. Lancer la migration : `npm run migrate` (depuis `backend/`)
4. Insérer les données de test : `npm run seed` (depuis `backend/`)

Comptes de démo (après seed) :
- **Admin** : admin@organisation.fr / admin123
- **Opérateur** : j.martin@organisation.fr / operateur123

## Structure du projet

```
backend/   → API Express + PostgreSQL (port 3001)
frontend/  → Interface React/Vite (port 5173)
mobile/    → Application Expo React Native
```

## Lancer le projet

**Backend :**
```bash
cd backend && npm install && npm run dev
```

**Frontend :**
```bash
cd frontend && npm install && npm run dev
```

**Mobile :**
```bash
cd mobile && npm install && npx expo start
```

**Tests backend :**
```bash
cd backend && npm test
```