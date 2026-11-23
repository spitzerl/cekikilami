# Cékikilami

Jeu musical multijoueur (Vue 3 + Node.js + Socket.IO + PostgreSQL + Redis).

## Structure

- `frontend` : client Vue 3 + Vite + Pinia + Socket.IO client
- `backend` : API Express + Socket.IO + PostgreSQL + Redis
- `compose.yaml` : stack complète (frontend, backend, postgres, redis)
- `deploy/postgres/init-app-role.sh` : création du rôle PostgreSQL applicatif moins privilégié

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

Créer le `.env` racine avec des secrets forts, puis :

```bash
docker compose up --build -d
```

- Le frontend écoute désormais sur le port **8080** dans le conteneur (image Nginx non-root). Le reverse proxy externe doit cibler `cekikilami-frontend:8080`.
- L'API est disponible derrière `/api` et Socket.IO derrière `/socket.io` via `nginx.conf`.
- Les uploads sont persistés dans le volume `uploads_data`.
- TLS doit être terminé par le proxy externe. Les en-têtes HSTS/CSP/Referrer-Policy sont posés par Nginx ; le proxy doit transmettre `X-Forwarded-Proto`.
- Le backend fait confiance à un seul niveau de proxy (`TRUST_PROXY=1`) pour les rate limits.

### Migration d'un volume PostgreSQL existant

Le script `docker-entrypoint-initdb.d` ne s'exécute que sur une base **neuve**. Pour un volume existant, exécuter une fois en tant que superutilisateur PostgreSQL :

```sql
CREATE ROLE cekikilami LOGIN PASSWORD 'mot-de-passe-fort' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER DATABASE music_game OWNER TO cekikilami;
ALTER SCHEMA public OWNER TO cekikilami;
ALTER TABLE sessions OWNER TO cekikilami;
ALTER TABLE players OWNER TO cekikilami;
ALTER TABLE musics OWNER TO cekikilami;
ALTER TABLE votes OWNER TO cekikilami;
ALTER TABLE blind_test_answers OWNER TO cekikilami;
ALTER SEQUENCE sessions_id_seq OWNER TO cekikilami;
ALTER SEQUENCE players_id_seq OWNER TO cekikilami;
ALTER SEQUENCE musics_id_seq OWNER TO cekikilami;
ALTER SEQUENCE votes_id_seq OWNER TO cekikilami;
ALTER SEQUENCE blind_test_answers_id_seq OWNER TO cekikilami;
```

Puis mettre à jour `APP_DB_PASSWORD` dans le `.env` et redémarrer la stack.

### Redis

Redis est authentifié par `REDIS_PASSWORD` et reste **optionnel** : si Redis est indisponible au démarrage, le backend démarre quand même sans cache.

## Variables d'environnement

### Racine (`/.env`, utilisé par Compose)

- `POSTGRES_ADMIN_USER` (défaut `postgres`)
- `POSTGRES_PASSWORD` (obligatoire)
- `POSTGRES_DB` (défaut `music_game`)
- `APP_DB_USER` (défaut `cekikilami`)
- `APP_DB_PASSWORD` (obligatoire)
- `REDIS_PASSWORD` (obligatoire)
- `CORS_ORIGIN`
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
