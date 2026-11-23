# Sécurité — Cékikilami

> Audit de sécurité du **23 novembre 2026**, commit `250da1e` (branche `develop`), synthèse destinée à la branche `security-fix`.
>
> **Statut de remédiation : appliqué sur `security-fix`.** Les 10 constats confirmés, les 4 pistes à valider et les 6 unités différées sont couverts par les commits `b85fb5f` (dépendances), `8c8139d` (Socket.IO), `70baa02` (backend), `6bba54c` (frontend), `6f3a80e` (déploiement) et `1e3e54f` (tests/CI). La suite compte **42 tests de régression** (`cd backend && npm test`) et le build frontend passe. Les actions qui dépendent de l'infrastructure de production restent listées en fin de document. L'audit initial était provisoire et n'est pas présenté comme une certification indépendante.

## Périmètre et méthode

- **Périmètre :** code first-party `backend/`, `frontend/`, configuration de déploiement (`compose.yaml`, `compose.dev.yaml`, Nginx, Dockerfiles). `node_modules`, `frontend/dist`, les fichiers `.env` locaux et les uploads ne sont pas audités comme source.
- **Exécution :** source + laboratoire local uniquement. Aucun service déployé, fournisseur, registre, broker ou identité réelle n'a été contacté.
- **Laboratoire :** copie jetable du backend, PostgreSQL 16 réel via socket Unix, réponses Deezer mockées, Redis non utilisé mocké, `bwrap` avec réseau isolé et disque plafonné, Chrome headless pour tester le vrai frontend buildé.
- **Rapport détaillé :** le rapport complet, les traces, les reproductions et les artefacts sont conservés hors du dépôt dans le run d'audit (`run-1`). Ce fichier en est le résumé.
- **Validation :** `findings.json` (14 enregistrements : 10 confirmés, 4 à valider) et `coverage-ledger.json` (28 unités : 20 candidates, 2 couvertes, 6 différées) passent les validateurs du workflow.

## Synthèse

| Sévérité | Constat |
|---|---|
| **High** | Un événement Socket.IO `join` sans payload tue le processus backend. |
| **Medium** | L'identité joueur est fournie par le client : takeover host, votes/réponses usurpés, sélection privée lisible, avatar modifiable, socket non lié. |
| **Medium** | Les contrôles host (reset, finish, config, bots, start/advance) ne sont pas autorisés côté serveur. |
| **Medium** | `deleteMusic` supprime une musique d'une autre session (pas de `session_id`). |
| **Medium** | Les uploads non authentifiés sont écrits avant validation et ne sont jamais supprimés. |
| **Medium** | N'importe quelle URL `http(s)` de média est chargée par les navigateurs de tous les participants. |
| **Low** | La réponse du blind test, les scores et les compteurs de votes fuient avant la révélation. |
| **Low** | `startVoting` n'a pas de garde de phase : une room en attente peut passer directement aux résultats. |
| **Low** | Redis indisponible bloque le démarrage du backend malgré le cache déclaré optionnel. |
| **Low** | La création anonyme de sessions n'a ni rate limit, ni quota, ni TTL. |
| **À valider** | Code de session `Math.random` + fuite de sorties PRNG via `avatar_seed`, sans rate limit. |
| **À valider** | Proxy Deezer et génération de bots sans timeout, cache, concurrence ni quota. |
| **À valider** | `maxMusicsPerPlayer` non borné pilote une boucle de génération de bots quasi infinie. |
| **À valider** | Déploiement : PostgreSQL `trust` + superuser, Redis sans auth, ports dev exposés, conteneurs root, pas de TLS/headers. |

## Constats confirmés

### 1. High — Un `join` Socket.IO sans payload crashe le backend

- **Source :** `backend/src/sockets/gameSocket.js:9`.
- **Cause :** la destructuration `async ({ code, playerId })` a lieu à la liaison des paramètres, **avant** le `try` du corps. `socket.emit('join')` ou `socket.emit('join', null)` lève une `TypeError` non rattrapée ; Node termine le processus.
- **Reproduction :** un client Socket.IO non authentifié connecté à `/game`, un seul `emit('join')` → `TypeError: Cannot destructure property 'code' of 'undefined'`, code de sortie 1, `/health` indisponible.
- **Impact :** arrêt du backend, perte de toutes les rooms et de tous les timers en mémoire ; répétable, donc DoS non authentifié.
- **Correctif minimal :** valider le payload dans le `try` (`payload || {}`), ajouter un middleware de namespace, un garde `unhandledRejection`/`uncaughtException`, et un test de régression.

### 2. Medium — Identité joueur fournie par le client

- **Source :** `backend/src/services/GameService.js:1005` (`promotePlayer`), `:1029` (`kickPlayer`), `:677` (`submitVote`), `:739` (`submitBlindTestAnswer`), `:821` (`getState`), `:1080` (`regenerateAvatar`) ; `backend/src/sockets/gameSocket.js:18`.
- **Cause :** `requesterId`, `voterId`, `playerId` et le `playerId` Socket.IO sont publics et jamais liés à l'appelant. Les ids et `host_name` sont renvoyés à tous les détenteurs du code. `promotePlayer`/`kickPlayer` comparent seulement le nom de la ligne désignée à `sessions.host_name`.
- **Reproductions :** un invité se promeut host avec l'id public de l'host et kick l'host ; un troisième joueur soumet une réponse blind test et un vote sous l'id d'un autre ; un invité lit la sélection privée d'un autre ; l'avatar d'un joueur d'une autre session est modifié ; un socket non membre reçoit la sélection privée et modifie `is_connected`.
- **Impact :** prise de contrôle du host, expulsion de joueurs, bourrage de votes/réponses, fuite de sélections et de réponses, altération d'avatars, présence falsifiée.
- **Correctif minimal :** secret par joueur (token émis au create/join, hash en base), `playerId` dérivé côté serveur, host lié à un `player_id`/token vérifié, validation d'appartenance à la session pour avatar/musique, handshake Socket.IO authentifié, secret de reconnexion.

### 3. Medium — Contrôles host non authentifiés

- **Source :** `backend/src/routes/index.js:133` (config), `:144` (bots), `:156` (start-selection), `:233` (start-round), `:244` (advance-round), `:295` (finish), `:305` (reset) ; `backend/src/services/GameService.js:120`, `:774`, `:802`.
- **Cause :** ces routes n'acceptent que `:code` et n'effectuent aucun contrôle host. Le frontend cache les boutons derrière `isHost`, mais le serveur ne reproduit pas cette politique. `resetSession` supprime toutes les musiques ; les cascades suppriment votes et réponses.
- **Reproduction :** un invité envoie config, reset, start-selection et finish → 200 ; la configuration est persistée, le reset vide la room, finish force les résultats.
- **Impact :** sabotage d'une room, suppression des morceaux/votes/scores, changement de configuration, remplissage de bots, saut de phases.
- **Correctif minimal :** middleware `requireHost` sur chaque route host, contrôle de phase dans les méthodes, tests « invité → 403 ».

### 4. Medium — Suppression de musique cross-session

- **Source :** `backend/src/routes/index.js:209` ; `backend/src/services/GameService.js:229` ; `backend/src/models/Music.js:26`.
- **Cause :** `GameService.deleteMusic` vérifie seulement que la session du `:code` est en sélection, puis `Music.deleteMusic` exécute `DELETE ... WHERE id=$1 AND player_id=$2` **sans `session_id`**. Un détenteur d'une session en sélection peut supprimer une musique d'une autre session en fournissant son id global et l'id de son propriétaire.
- **Reproduction :** session victime avec 3 musiques, session attaquante en sélection, `DELETE /sessions/ATTAQUANT/musics/<idVictime>?playerId=<owner>` → 200 ; la victime passe de 3 à 2.
- **Impact :** perte de données inter-session, suppression du morceau en cours.
- **Correctif minimal :** `DELETE ... WHERE id=$1 AND session_id=$2 AND player_id=$3`, avec `session.id` et un propriétaire authentifié ; test cross-session → 404.

### 5. Medium — Uploads non authentifiés, écrits avant validation, jamais nettoyés

- **Source :** `backend/src/routes/index.js:166` (route), `:10` (Multer disk storage), `:21` (limite 10 Mo) ; `backend/src/services/GameService.js:229`, `:811` ; `backend/src/app.js:25`.
- **Cause :** `upload.single('audio')` écrit le fichier **avant** la validation de session/joueur/quota/fields. Les erreurs renvoient 404/409/400 sans `unlink` ; `deleteMusic` et `resetSession` ne suppriment que les lignes ; il n'y a ni quota global, ni TTL, ni validation MIME.
- **Reproduction :** upload vers un code inexistant → 404 mais fichier créé ; upload valide puis DELETE → fichier conservé ; upload au-delà du quota → 409 mais fichier conservé. Compteur : 0 → 1 → 2 → 2 → 3.
- **Impact :** épuisement du disque non authentifié, fichiers orphelins servis publiquement, rétention de données.
- **Correctif minimal :** authentifier, écrire en temporaire, `unlink` sur toute erreur, quotas globaux/TTL, suppression sur delete/reset/kick, validation MIME/magic bytes, stockage non public.

### 6. Medium — URLs média arbitraires chargées par tous les navigateurs

- **Source :** `backend/src/routes/index.js:43` (`requireHttpUrl`), `:182` (`deezerPreviewUrl`), `:192` (`coverUrl`) ; `backend/src/services/GameService.js:920` ; `frontend/src/components/VotingPhase.vue:614` ; `frontend/nginx.conf`.
- **Cause :** `requireHttpUrl` ne valide que le schéma. L'URL est stockée, renvoyée dans l'état, puis chargée par `new Audio()` / `<img>` chez tous les participants. Aucune allowlist d'hôtes, aucun rejet des adresses privées/loopback, aucune CSP `media-src`/`img-src`, aucun `Referrer-Policy`.
- **Reproduction :** le vrai frontend buildé, piloté par Chrome headless, émet deux GET vers `https://127.0.0.1:9999/track-...mp3` avec l'origine de l'app en Referer.
- **Impact :** divulgation d'IP/User-Agent/origine des participants, requêtes GET arbitraires vers des hôtes accessibles depuis leur navigateur (LAN, services locaux), tracking.
- **Correctif minimal :** allowlist Deezer CDN ou proxy serveur, rejet loopback/private/link-local après résolution DNS, CSP `media-src`/`img-src`, `Referrer-Policy`.

### 7. Low — Réponse du blind test, scores et votes exposés avant la révélation

- **Source :** `backend/src/services/GameService.js:920`, `:924`, `:938`, `:950`, `:997` ; `backend/src/routes/index.js:123`, `:315`.
- **Cause :** `currentMusic` est copié depuis la ligne complète et seul `player_id` est supprimé ; `title`, `artist` et `blind_test_options` restent pendant `listening`. `getState` calcule et renvoie `score`/`correctGuesses`/`votesReceived` pour tous, et les compteurs de votes même si `show_vote_count=false`. `GET /results` fonctionne pendant le vote.
- **Reproduction :** en listening, l'état renvoie `currentMusic.title` = le vrai titre ; en voting avec `showVoteCount=false`, les compteurs sont présents ; `/results` renvoie un classement avec scores.
- **Impact :** triche au blind test, classement et répartition des votes visibles avant la révélation.
- **Correctif minimal :** masquer titre/artiste/options en listening, ne renvoyer que sa propre réponse, supprimer les scores/compteurs avant results, appliquer `show_vote_count` côté serveur, garde de phase sur `/results`.

### 8. Low — `startVoting` sans garde de phase

- **Source :** `backend/src/routes/index.js:222` ; `backend/src/services/GameService.js:410`, `:507`, `:512`.
- **Cause :** `startVoting` vérifie seulement que la session existe. Depuis `waiting` sans musique, elle appelle `finishSession` et passe en results ; depuis un vote actif, elle supprime votes et réponses et repart à l'index 0.
- **Reproduction :** room en waiting, `POST /start-voting` non authentifié → phase results.
- **Impact :** fin forcée d'une room, effacement d'un round et de ses votes.
- **Correctif minimal :** garde de phase explicite + contrôle host ; test waiting→409 et voting→409.

### 9. Low — Redis indisponible bloque le démarrage

- **Source :** `backend/src/server.js:112`, `:135` ; `backend/src/config/redis.js:4`.
- **Cause :** `bootstrap` attend `redisClient.connect()` avant `listen()`. Le client node-redis réessaie indéfiniment et ne rejette pas, donc le `catch` « continuation sans cache » n'est jamais atteint.
- **Reproduction :** Redis fermé au démarrage, attente 10 s → `/health` indisponible, 25 lignes `ECONNREFUSED`.
- **Impact :** backend indisponible tant que Redis ne revient pas, malgré un cache déclaré optionnel.
- **Correctif minimal :** timeout/`reconnectStrategy:false` ou démarrage HTTP indépendant, healthcheck, test de démarrage sans Redis.

### 10. Low — Création de sessions non bornée et persistante

- **Source :** `backend/src/routes/index.js:100` ; `backend/src/services/GameService.js:112` ; `backend/src/models/Session.js:4` ; `backend/src/models/Player.js:4` ; `backend/src/sockets/gameSocket.js:95`.
- **Cause :** `POST /sessions` est non authentifié, sans rate limit, quota global ou TTL. Le seul chemin de suppression est le timer de déconnexion host, qui exige un socket host : une session créée et utilisée uniquement en HTTP n'est jamais supprimée.
- **Reproduction :** 20 POST non authentifiés → 20 sessions persistantes, aucun socket ouvert.
- **Impact :** croissance DB et travail de récupération au boot ; peut saturer le volume à débit soutenu.
- **Correctif minimal :** rate limit/quota, `expires_at` + reaper, cap global, index sur `phase`/`timer_ends_at`.

## À valider (pas de sévérité attribuée)

### Code de session prédictible / énumérable

- `backend/src/models/Session.js:73`, `backend/src/models/Player.js:5`.
- Code de 6 caractères sur un alphabet de 32 (~30 bits) généré par `Math.random()`, sans rate limit, lockout, rotation ni expiration. Le même PRNG produit les `avatar_seed` publics (create/join/state), qui exposent des sorties plus précises et rendent une récupération d'état V8 plus réaliste.
- **À vérifier :** rate limiting réel du proxy, nombre/longévité des rooms actives, faisabilité de la récupération PRNG sur la version Node déployée. **Ne pas** tester en force brute sur un déploiement.

### Fan-out Deezer / bots

- `backend/src/routes/index.js:65` ; `backend/src/services/GameService.js:296`, `:448`.
- `/deezer/search` est un proxy non authentifié, `startSelection` fait ~19 recherches par bot, `startVoting` une par piste avec blind test. Pas de timeout, cache, concurrence, quota ni annulation.
- **À vérifier :** quotas Deezer, politique 429, limites d'egress/ingress, nombre de rooms simultanées.

### `maxMusicsPerPlayer` non borné

- `backend/src/models/Session.js:27` ; `backend/src/services/GameService.js:300`, `:336`.
- La config accepte une valeur proche du maximum `int4` (2 147 483 647). La boucle de fallback des bots exécute un fetch et un `Music.create` par itération ; une requête `start-selection` peut donc générer un travail et des lignes quasi illimités.
- **À vérifier :** capacité PostgreSQL, éventuelle contrainte `CHECK`, timeout ingress. Ajouter un cap serveur avant tout test plus large.

### Déploiement

- `compose.yaml:8`, `:27` ; `compose.dev.yaml:4`, `:21` ; Dockerfiles ; Nginx.
- PostgreSQL en `trust` avec le superuser `postgres` sans mot de passe, Redis sans auth, ports dev 5432/6379 publiés, conteneurs root par défaut, images non épinglées, pas de `.dockerignore`, Nginx sans TLS/HSTS/headers.
- **À vérifier :** appartenance réelle du réseau `proxy`, rôle PostgreSQL et `pg_hba.conf`, exposition host, TLS/headers réels, contexte runtime des conteneurs.

## Couverture différée

Le critic de couverture a identifié six unités supplémentaires, enregistrées comme **deferred** (à traiter dans une wave 3) ; ce ne sont pas des constats confirmés :

1. `finishSession` sans garde de phase et divulgation via la vue results.
2. Bornes numériques de `Session.updateConfig` (`max_players`, durées, etc.).
3. Handler `disconnect` et timer de suppression host (identité non liée, timer non restauré).
4. `broadcastState` par socket : `getState` fait cinq requêtes par socket à chaque broadcast, sans limite de sockets/room.
5. `recoverSessions` : réarmement des timers sans lock/marquage, timers bots/host perdus.
6. Fetch DiceBear des avatars : requête tierce avec `avatar_seed`, sans `Referrer-Policy`/CSP `img-src`.

## Durcissement recommandé

- Messages d'erreur 5xx génériques ; journalisation structurée sans codes de session.
- Rate limiting sur create/join/lookup/upload/Deezer/Socket.IO.
- TTL + reaper des sessions ; index sur `phase`/`timer_ends_at`.
- Bornes strictes pour `maxPlayers`, `maxMusicsPerPlayer` et toutes les durées.
- Auth par token joueur, host lié à un `player_id` vérifié, secret de reconnexion, contrainte unique `(session_id, name)`.
- Nettoyage des uploads sur erreur/delete/reset/kick ; quotas globaux ; validation MIME/magic bytes.
- Allowlist média, rejet loopback/private, CSP `media-src`/`img-src`, `Referrer-Policy`, `frame-ancestors`.
- Redis optionnel avec timeout/`reconnectStrategy:false`, healthcheck, démarrage HTTP indépendant.
- DB/Redis : rôles least-privilege, SCRAM, auth Redis, pas de ports dev exposés ; conteneurs non-root, read-only, cap-drop, digests, `.dockerignore`.
- Tests de régression : invité → 403 sur les routes host, payload Socket.IO malformé → pas de crash, upload invalide → fichier supprimé, suppression cross-session → 404, prédiction de code, démarrage sans Redis.

## Points positifs et probes non confirmées

- SQL entièrement paramétré ; aucune injection SQL trouvée (probe `' OR 1=1--` → 404, tables intactes).
- Interpolation Vue pour les noms/titres/erreurs ; le seul `v-html` est la map statique d'icônes. Aucun XSS stocké/réfléchi trouvé.
- Nom de fichier upload régénéré et extension allowlistée ; aucune traversée de chemin trouvée.
- Hôte Deezer fixe côté serveur ; le problème d'URL média est côté navigateur, pas un SSRF serveur.
- Contrôles de phase, d'appartenance, d'observateur, de piste courante, de timer, d'auto-vote et les contraintes uniques de votes/réponses sont réels sur les chemins qui les utilisent.
- Pas de cookies ni de credentials ambiants : CSRF classique et CSWSH ne s'appliquent pas ; le problème principal est l'absence totale d'authentification par joueur.
- Aucun secret tiers ou clé privée en dur trouvé dans la source suivie ; `.env` est gitignoré ; les lockfiles sont présents.

## Priorités suggérées pour la branche `security-fix`

1. Crash Socket.IO (high).
2. Auth par joueur + contrôle host (les deux medium d'accès).
3. Suppression cross-session.
4. Cycle de vie des uploads.
5. Allowlist média + CSP/referrer.
6. Redaction de l'état de jeu.
7. Garde de phase `startVoting`.
8. Redis optionnel et TTL/quota des sessions.
9. Traiter les quatre pistes « à valider » et les six unités différées.
10. Ajouter les tests de régression et le durcissement de déploiement.

> Ce document est un résumé. Les preuves détaillées, scénarios de laboratoire et artefacts sont conservés hors du dépôt dans le run d'audit ; le workflow de vérification indépendante reste à terminer.

## Statut de remédiation

| # | Constat | Statut | Mise en œuvre | Preuve |
|---|---|---|---|---|
| 1 | `join` Socket.IO sans payload crashe le backend | **Corrigé** | payload validé dans le handler (`payload || {}`), middleware d'authentification Socket.IO, gardes `unhandledRejection`/`uncaughtException` | `8c8139d`, `70baa02`, `test/integration/socket.test.js` |
| 2 | Identité joueur fournie par le client | **Corrigé** | jeton opaque par joueur (SHA-256 en base), `Authorization: Bearer`, `socket.handshake.auth.token`, `sessions.host_player_id`, ids dérivés côté serveur, appartenance session, avatar self-only, endpoint public `/summary` | `70baa02`, `6bba54c`, `test/integration/auth.test.js` |
| 3 | Contrôles host non autorisés | **Corrigé** | middleware `requireHost`, `GameService.assertHost`, matrice de phases, tests invité → 403 | `70baa02`, `test/integration/auth.test.js`, `test/integration/lifecycle.test.js` |
| 4 | Suppression de musique cross-session | **Corrigé** | `DELETE ... WHERE id AND session_id AND player_id`, vérification du propriétaire authentifié, test cross-session → 404 | `70baa02`, `test/integration/auth.test.js` |
| 5 | Uploads non authentifiés, écrits avant validation, jamais nettoyés | **Corrigé** | auth obligatoire, stockage mémoire, magic bytes `file-type`, quotas global/session/joueur, `unlink` sur erreur, suppression sur delete/reset/kick/session/reaper, volume dédié | `70baa02`, `6f3a80e`, `test/integration/uploads.test.js` |
| 6 | URLs média arbitraires chargées par les navigateurs | **Corrigé** | allowlist HTTPS des CDN Deezer, chemins locaux `/uploads/<32 hex>`, CSP `media-src`/`img-src`, `Referrer-Policy: no-referrer`, avatars proxifiés | `70baa02`, `6f3a80e`, `test/unit/security.test.js` |
| 7 | Blind test, scores et votes exposés avant révélation | **Corrigé** | titre/artiste/cover masqués en écoute et vote, `is_correct` masqué, scores et `votesReceived` supprimés jusqu'aux résultats, `show_vote_count` appliqué côté serveur, `/results` uniquement en phase results | `70baa02`, `test/integration/redaction.test.js` |
| 8 | `startVoting` sans garde de phase | **Corrigé** | transition uniquement depuis `selection`, route host-only, timer interne explicite | `70baa02`, `test/integration/redaction.test.js` |
| 9 | Redis indisponible bloque le démarrage | **Corrigé** | `connectTimeout` 2 s, `reconnectStrategy: false`, connexion non bloquante, arrêt propre ; démarrage vérifié sans Redis dans le conteneur | `70baa02`, `test/unit/redis.test.js` |
| 10 | Création de sessions non bornée et persistante | **Corrigé** | rate limit create/join/lookup, cap global, `expires_at` + reaper toutes les 5 min, index de récupération, tests cap/TTL | `70baa02`, `test/integration/lifecycle.test.js` |
| 11 | Code de session `Math.random` / fuite PRNG | **Corrigé** | code et seeds générés par `crypto.randomInt`/`randomBytes`, rate limits join/lookup | `70baa02`, `test/unit/security.test.js` |
| 12 | Fan-out Deezer / bots sans timeout, cache ni quota | **Corrigé** | fetch avec `AbortSignal.timeout(5 s)`, cache 5 min, concurrence bornée, `/deezer/search` authentifié et rate-limité, une à deux recherches par bot, options de blind test générées localement | `70baa02`, `test/unit/security.test.js`, `test/integration/lifecycle.test.js` |
| 13 | `maxMusicsPerPlayer` non borné | **Corrigé** | bornes serveur 1–5, bornes `maxPlayers` 4–16 et durées, clamp des valeurs existantes au démarrage, boucles de bots bornées | `70baa02`, `test/integration/lifecycle.test.js` |
| 14 | Déploiement PostgreSQL `trust`/superuser, Redis sans auth, ports dev, root, TLS/headers | **Corrigé dans le dépôt** | rôle applicatif non-superuser, mots de passe requis, Redis `requirepass`, ports dev sur `127.0.0.1`, images épinglées, conteneurs non-root/read-only, cap-drop, `.dockerignore`, CSP/HSTS/headers, limites Nginx | `6f3a80e`, `deploy/postgres/init-app-role.sh` |
| D1 | `finishSession` sans garde et vue results | **Corrigé** | fin uniquement pendant le vote, host-only, résultats en phase results | `70baa02`, `test/integration/redaction.test.js` |
| D2 | Bornes numériques de `Session.updateConfig` | **Corrigé** | validation stricte des entiers/booléens et valeurs inconnues ignorées | `70baa02`, `test/integration/lifecycle.test.js` |
| D3 | `disconnect`, timer host, identité non liée | **Corrigé** | socket authentifié, host lié par `host_player_id`, timer host uniquement en `waiting`, timers restaurés au boot | `70baa02`, `test/integration/socket.test.js` |
| D4 | `broadcastState` par socket et absence de limite | **Corrigé** | état chargé une fois par room, projection par joueur, limites de connexions/join Socket.IO | `70baa02` |
| D5 | `recoverSessions` sans lock/marquage | **Corrigé** | skip des timers déjà actifs, vérification fraîche de la phase/status, reprise des votes bots, timers host des salons en attente | `70baa02` |
| D6 | Fetch DiceBear tiers | **Corrigé** | proxy backend avec cache, timeout, validation PNG, CSP `img-src 'self'`, pas de Referer navigateur | `70baa02`, `test/unit/avatar.test.js` |

### Vérifications exécutées

- `cd backend && npm test` : **42 tests**, 0 échec (unitaires + intégration PostgreSQL).
- `cd frontend && npm run build` : build production OK.
- `npm audit --omit=dev` (backend) et `npm audit` (frontend) : **0 vulnérabilité**.
- Build Podman des images backend/frontend, test `nginx -t`, démarrage backend read-only sans Redis, script d'init PostgreSQL (rôle non-superuser, création de table).
- Smoke tests HTTP/Socket.IO : auth, 403 host, redaction listening/voting/revelation, suppression cross-session, upload invalide supprimé.

### Actions de production restantes

Le déploiement initial est entièrement automatisé par `scripts/deploy.sh` : génération du `.env` et des secrets, création du réseau `proxy`, initialisation du rôle PostgreSQL et du schéma. **Aucune migration de volume n'est nécessaire pour l'instant.**

1. **TLS / domaine** : la passerelle intégrée écoute sur `127.0.0.1:8080`. Pour HTTPS, placer un reverse proxy TLS devant elle (réseau `proxy`, cible `cekikilami-gateway:8080`) et relancer avec `APP_URL=https://votre-domaine`. Pour une exposition HTTP directe : `GATEWAY_BIND=0.0.0.0 GATEWAY_PORT=80`.
2. **Secrets** : le script génère `POSTGRES_PASSWORD`, `APP_DB_PASSWORD` et `REDIS_PASSWORD`. Sauvegarder le `.env` (600) ; le perdre oblige à recréer les volumes ou à réinitialiser les mots de passe.
3. **Sessions existantes** : les joueurs sans jeton devront rejoindre à nouveau ; les identités `localStorage` antérieures sont invalidées par design.
4. **Rate limiting multi-instance** : les compteurs sont en mémoire. En cas de scale horizontal, utiliser un store partagé (Redis) pour `express-rate-limit` et les limites Socket.IO.
5. **Réinitialisation** : `docker compose down -v` supprime la base et les uploads ; à utiliser uniquement pour repartir de zéro.

### Risques résiduels acceptés

- Jeton joueur stocké en `localStorage` : un XSS pourrait le lire. Aucun XSS n'a été trouvé, la CSP interdit le script inline et les entrées sont échappées par Vue ; un cookie HttpOnly serait une évolution possible mais introduirait du CSRF.
- `style-src 'unsafe-inline'` reste nécessaire pour les styles dynamiques Vue ; `script-src` est limité à `'self'`.
- Le code de session reste à 6 caractères (~30 bits) : la génération est cryptographique et les tentatives sont rate-limitées, mais un code partagé reste un secret de salon.
- `Math.random` reste utilisé pour mélanger des listes non sensibles (ordre des morceaux, choix de bots) ; les codes et jetons utilisent `crypto`.
- Le store de rate limiting est local au processus (voir action 5).
- `npm audit` signale encore `nodemon/minimatch` en dépendance **de développement** ; l'image de production utilise `npm ci --omit=dev` et l'audit de production est propre.
