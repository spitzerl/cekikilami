# Cékikilami

Jeu musical multijoueur (Vue 3 + Node.js + Socket.IO + PostgreSQL + Redis).

## Version

Le projet suit le versioning sémantique (SemVer). La version courante est **`1.0.0-beta.1`** : le jeu est en bêta, proche de la première release stable `1.0.0`.

- source de vérité : `package.json` à la racine, `frontend/package.json` et `backend/package.json` (version alignée) ;
- l’API expose la version sur `GET /api/version` et dans `GET /health` ;
- l’interface affiche un badge **Bêta** et le numéro de version sur l’accueil, ainsi que la version dans le menu pause ;
- les versions publiées sont taguées dans Git (`v1.0.0-beta.1`).

Voir [CHANGELOG.md](CHANGELOG.md).

## Structure

- `frontend` : client Vue 3 + Vite + Pinia + Socket.IO client
- `backend` : API Express + Socket.IO + PostgreSQL + Redis
- `compose.yaml` : stack complète (gateway, frontend, backend, postgres, redis)
- `deploy/postgres/init-app-role.sh` : création automatique du rôle PostgreSQL applicatif moins privilégié
- `scripts/deploy.sh` : génération des secrets, création du réseau proxy et démarrage

## Développement local

### 1) Dépendances de service

Copier le fichier d'environnement racine et remplacer les secrets :

```bash
cp .env.example .env
# éditer .env : POSTGRES_PASSWORD, APP_DB_PASSWORD, REDIS_PASSWORD
docker compose -f compose.dev.yaml up -d
```

PostgreSQL et Redis sont alors accessibles uniquement sur `127.0.0.1`, avec mot de passe. Le script d'initialisation crée le rôle applicatif `cekikilami` (non-superuser) propriétaire de la base.

### 2) Backend

```bash
cd backend
cp .env.example .env
# reporter APP_DB_PASSWORD et REDIS_PASSWORD depuis le .env racine
npm install
npm run dev
```

API disponible sur `http://localhost:3001`.

### 3) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Application disponible sur `http://localhost:3000`.

## Production Docker

Le déploiement initial est automatique :

```bash
./scripts/deploy.sh
```

Le script :

- génère un `.env` avec des secrets aléatoires s'il n'existe pas (et complète les clés manquantes) ;
- crée le réseau Docker `proxy` s'il n'existe pas ;
- construit et démarre PostgreSQL, Redis, le backend, le frontend et la passerelle Nginx ;
- attend que `/health` réponde.

Aucune migration n'est nécessaire : sur un volume neuf, PostgreSQL crée le rôle applicatif `cekikilami` (non-superuser) et le backend initialise son schéma au démarrage. Pour repartir de zéro, utiliser `docker compose down -v` **avant** de relancer le script (destructif : supprime la base et les uploads).

### Accès et TLS

- Par défaut, la passerelle est accessible sur `http://localhost:8080` (publiée sur `127.0.0.1`).
- Pour une exposition directe en HTTP : `GATEWAY_BIND=0.0.0.0 GATEWAY_PORT=80 APP_URL=http://votre-domaine ./scripts/deploy.sh`.
- Pour HTTPS, utiliser un reverse proxy TLS devant la stack :
  - soit sur le réseau Docker `proxy`, en ciblant `cekikilami-gateway:8080` ;
  - soit sur le port publié `127.0.0.1:8080`.
  - relancer avec `APP_URL=https://votre-domaine ./scripts/deploy.sh` pour que CORS corresponde à l'origine publique.
- La passerelle applique les en-têtes CSP/HSTS/Referrer-Policy, les limites de taille et le rate limiting Nginx. Le proxy TLS doit transmettre `X-Forwarded-Proto` et `X-Forwarded-For`.

### Redis

Redis est authentifié par `REDIS_PASSWORD` et reste **optionnel** : si Redis est indisponible au démarrage, le backend démarre quand même sans cache.

## Variables d'environnement

### Racine (`/.env`, utilisé par Compose)

- `POSTGRES_ADMIN_USER` (défaut `postgres`)
- `POSTGRES_PASSWORD` (généré automatiquement)
- `POSTGRES_DB` (défaut `music_game`)
- `APP_DB_USER` (défaut `cekikilami`)
- `APP_DB_PASSWORD` (généré automatiquement)
- `REDIS_PASSWORD` (généré automatiquement)
- `APP_URL` (origine publique, défaut `http://localhost:8080`)
- `CORS_ORIGIN` (défaut : `APP_URL`)
- `GATEWAY_BIND` (défaut `127.0.0.1`)
- `GATEWAY_PORT` (défaut `8080`)
- `TRUST_PROXY` (défaut `1`, la passerelle transmet un seul X-Forwarded-For résolu)
- `VITE_API_URL` (défaut `/api`)
- `VITE_SOCKET_URL` (vide = même origine)
- `MAX_SESSIONS`

### Backend (`backend/.env`)

- `PORT=3001`
- `DATABASE_URL=postgresql://...`
- `REDIS_URL=redis://:mot-de-passe@...`
- `NODE_ENV=development|production`
- `CORS_ORIGIN=http://localhost:3000`
- `TRUST_PROXY` (optionnel, `1` derrière un proxy)
- Bornes optionnelles : `SESSION_TTL_*_SECONDS`, `RATE_LIMIT_*`, `UPLOAD_MAX_*`, `DEEZER_*`

### Frontend (`frontend/.env`)

- `VITE_API_URL=http://localhost:3001/api` (dev local)
- `VITE_SOCKET_URL=http://localhost:3001` (dev local)

En Docker, les variables sont injectées via `compose.yaml`.

## Sécurité

Le résumé de l'audit et le statut de remédiation sont dans [SECURITY.md](SECURITY.md).

- Chaque joueur reçoit un jeton opaque au create/join, stocké haché en base ; REST utilise `Authorization: Bearer`, Socket.IO utilise `auth.token`.
- L'hôte est lié à `sessions.host_player_id` ; les actions de cycle de vie sont contrôlées côté serveur.
- Les réponses de jeu sont redactées avant la révélation, les médias sont limités aux CDN Deezer, les uploads sont validés et nettoyés.
