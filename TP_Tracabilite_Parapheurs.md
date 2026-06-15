# TP — Système de traçabilité de parapheurs

## Objectif

Créer une application simple permettant de tracer des parapheurs physiques grâce à un QR Code, une position GPS au moment du scan, et une interface web publique en mode visiteur.

Le projet doit rester simple : pas de compte visiteur, pas de carte GPS, pas de gestion complexe des utilisateurs.

---

# Partie 1 — Backend + base de données

## Objectif

Créer l’API qui stocke les parapheurs, scanners et événements de scan.

## À faire

1. Créer un projet backend
2. Installer Express, Prisma, PostgreSQL
3. Créer les tables :
   - admins
   - scanners
   - parapheurs
   - scans
   - localisations
4. Créer les relations
5. Ajouter des données de test

---

# Partie 2 — Authentification simple

## Objectif

Permettre aux admins et aux scanners de se connecter.

## Routes

- POST /auth/admin/login
- POST /auth/scanner/login

## Contraintes

- bcrypt
- JWT
- Middleware admin
- Middleware scanner

---

# Partie 3 — API publique visiteur

## Objectif

Permettre à n’importe qui de rechercher un parapheur.

## Routes

- GET /public/parapheurs/:numero
- GET /public/parapheurs/:numero/history

## Résultat attendu

- Numéro du parapheur
- Dernier emplacement connu
- Date du dernier scan
- Heure du dernier scan
- Scanner utilisé
- Statut

---

# Partie 4 — API mobile scanner

## Objectif

Permettre à l’application mobile d’envoyer les scans.

## Routes

- POST /mobile/scans
- POST /mobile/sync
- GET /mobile/me

## Données enregistrées

- Numéro parapheur
- Latitude
- Longitude
- Précision GPS
- Date
- Heure
- Device ID

---

# Partie 5 — Interface web visiteur

## Pages

- Recherche parapheur
- Résultat parapheur
- Historique parapheur

## Fonctionnalités

- Recherche par numéro
- Affichage du dernier scan
- Consultation de l’historique

---

# Partie 6 — Interface admin

## Pages

- Login
- Dashboard
- Gestion parapheurs
- Gestion scanners
- Historique global

## Fonctionnalités

### Parapheurs

- Lister
- Ajouter
- Modifier
- Activer/Désactiver

### Scanners

- Lister
- Ajouter
- Modifier
- Activer/Désactiver

---

# Partie 7 — Application mobile

## Écrans

- Connexion
- Accueil
- Scanner QR Code
- Scan réussi
- Synchronisation
- Historique local

## Fonctionnalités

- Scan QR Code
- Récupération GPS
- Envoi API
- Historique local

---

# Partie 8 — Mode hors ligne

## Fonctionnalités

- Stockage local des scans
- Synchronisation automatique
- Gestion des erreurs réseau

---

# Partie 9 — Sécurité

## À mettre en place

- JWT
- bcrypt
- Validation des données
- Protection des routes admin
- Protection des routes mobile

---

# Partie 10 — Tests

## Backend

- Login admin
- Login scanner
- Création scan
- Historique

## Mobile

- Scan avec réseau
- Scan sans réseau
- Synchronisation

## Web

- Recherche parapheur
- Historique
- Accès admin

---

# Partie 11 — Déploiement

## Backend

- Docker
- PostgreSQL
- Node.js

## Frontend

- React
- Nginx
- HTTPS

## Mobile

- APK Android
- Tests terrain

---

# Ordre de réalisation

1. Base de données
2. Backend API
3. Interface web visiteur
4. Interface admin
5. Application mobile
6. Mode hors ligne
7. Tests
8. Déploiement
