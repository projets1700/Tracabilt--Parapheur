# TraçaParapheur — Système de traçabilité de parapheurs

## Avancement

| Partie | Description | Statut |
|--------|-------------|--------|
| 1 | Backend + base de données | Code ✅ — BDD non créée ⚠️ |
| 2 | Authentification (JWT + bcrypt) | ✅ Intégré dans le backend |
| 3 | API publique visiteur | ✅ Intégré dans le backend |
| 4 | API mobile scanner | ✅ Intégré dans le backend |
| 5 | Interface web visiteur | En cours |
| 6 | Interface admin | ❌ À faire |
| 7 | Application mobile | ❌ À faire |
| 8 | Mode hors ligne | ❌ À faire |
| 9 | Sécurité | ✅ Intégré dans le backend |
| 10 | Tests | ❌ À faire |
| 11 | Déploiement | ❌ À faire |

## ⚠️ Base de données non configurée

La base de données PostgreSQL n'a pas encore été créée.
Pour la configurer plus tard :

1. Créer la base : `createdb tracaparapheur`
2. Adapter `backend/.env` avec le bon mot de passe PostgreSQL
3. Lancer la migration : `npm run migrate` (depuis `backend/`)
4. Insérer les données de test : `npm run seed` (depuis `backend/`)

Comptes de démo (après seed) :
- **Admin** : admin@organisation.fr / admin123
- **Opérateur** : j.martin@organisation.fr / operateur123

## Structure du projet

```
backend/   → API Express + PostgreSQL
frontend/  → Interface React (Vite)
mobile/    → Application mobile React Native (à venir)
```

## Lancer le backend

```bash
cd backend
npm install
npm run dev
```

Le serveur démarre sur http://localhost:3001