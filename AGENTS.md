# AGENTS.md

Guide pour tout agent (humain ou IA) qui travaille sur **Cékikilami**.
Ces règles sont obligatoires et priment sur les habitudes personnelles.

## 1. Git : toujours, sans exception

- **Toujours utiliser Git.** Aucune modification de code ne doit rester hors du versionnement.
- **Ne jamais travailler directement sur `main` ou `develop`.** Toute tâche démarre sur une branche dédiée.
- Avant de commencer : `git status` et `git pull` sur la branche de base (`develop` par défaut) pour partir d'un état propre et à jour.
- **Commits réguliers et bien structurés** : découper le travail en unités logiques (une fonctionnalité, un correctif, un refactor, une doc), pas un unique commit fourre-tout en fin de tâche.
- Ne jamais commiter de secrets (`.env`, tokens, mots de passe), de fichiers générés (`dist`, `node_modules`, `uploads`) ou de artefacts de build.
- Ne pas réécrire l'historique d'une branche partagée (`main`, `develop`) ; pas de `push --force` dessus.
- Avant de considérer une tâche terminée : vérifier `git status` (arbre propre) et que la branche est poussée si un remote est configuré.

### Conventional Commits

Le format est **obligatoire** :

```
<type>(<scope>): <description courte à l'impératif>
```

Types autorisés :

| Type       | Usage                                             |
| ---------- | ------------------------------------------------- |
| `feat`     | nouvelle fonctionnalité                           |
| `fix`      | correction de bug                                 |
| `refactor` | réécriture sans changement de comportement        |
| `perf`     | amélioration de performance                       |
| `test`     | ajout ou correction de tests                      |
| `docs`     | documentation                                     |
| `style`    | formatage, sans impact logique                    |
| `build`    | outillage de build, dépendances                   |
| `ci`       | configuration d'intégration continue              |
| `chore`    | tâches annexes (config, scripts)                  |
| `revert`   | annulation d'un commit                            |

Règles :

- `scope` en minuscules, optionnel mais recommandé : `backend`, `frontend`, `ui`, `game`, `socket`, `deploy`, `security`, `docs`, `deps`…
- description courte, en minuscules, à l'impératif, sans point final (ex. `feat(game): add blind-test timing`).
- un commit = un changement cohérent ; préférer plusieurs petits commits à un gros.
- rupture de compatibilité : ajouter `!` après le scope/type et une section `BREAKING CHANGE:` dans le corps (ex. `feat(api)!: ...`).

Exemples valides :

```
feat(ui): add player avatars to exported score image
fix(deezer): restore search with new CDN hosts and cache previews
docs(deploy): note URL-safe secrets for compose
test(security): add regression suite
```

### Conventional Branching

Les branches suivent le même vocabulaire :

```
<type>/<sujet-court-en-kebab-case>
```

Exemples : `feat/blind-test-timer`, `fix/deezer-preview-cache`, `refactor/game-service`, `docs/agents-guide`, `chore/deps-update`.

- sujet en kebab-case, court et descriptif.
- une branche = un sujet ; ne pas mélanger plusieurs fonctionnalités.
- supprimer la branche une fois fusionnée.

## 2. Conventions de nommage du code

**Choisir un style et le garder constant sur tout le projet.** Pas de mélange entre camelCase et snake_case pour un même type d'identifiant.

Convention retenue sur ce dépôt :

- **camelCase** pour tout le code applicatif JavaScript / Vue :
  variables, fonctions, méthodes, propriétés d'objets, clés de stores Pinia, paramètres.
  Ex. `currentMusicIndex`, `isConnected`, `generatePlayerToken`, `votingStatus`.
- **PascalCase** pour les classes, modèles et composants Vue.
  Ex. `GameService`, `Player`, `Session`, `WaitingRoom.vue`.
- **snake_case** uniquement là où le format est imposé par l'écosystème :
  colonnes SQL / PostgreSQL (`host_player_id`, `created_at`), variables d'environnement (`POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `APP_DB_PASSWORD`) et champs de payload issus de la base.
- fichiers JS hors composants en camelCase (`gameSocket.js`, `uploadService.js`) ; composants Vue en PascalCase (`GameHeader.vue`).
- constantes globales en `SCREAMING_SNAKE_CASE` (`MAX_SESSIONS`, `SESSION_TTLS`, `CONFIG_BOUNDS`).
- noms en anglais dans le code et les identifiants ; les textes affichés à l'utilisateur, la documentation et les messages produit restent en français.

Règle d'or : **cohérence > préférence personnelle**. Si un fichier existant respecte une convention, s'y conformer.

## 3. Style et qualité

- Respecter le style, l'architecture et les motifs du code environnant (`backend/src`, `frontend/src`).
- Ne pas reformater ou refactoriser du code non concerné par la tâche : les diffs restent ciblés.
- Traiter les fichiers et modifications existants comme du travail utilisateur : ne rien supprimer ou écraser sans raison.
- Pas de `console.log` de debug laissé dans le code de production.
- Mettre à jour `CHANGELOG.md` (format Keep a Changelog) pour tout changement notable destiné aux utilisateurs.

## 4. Vérifications avant de terminer

- Lancer les tests backend : `cd backend && npm test` (nécessite PostgreSQL / `TEST_DATABASE_URL`).
- Vérifier le build frontend : `cd frontend && npm run build`.
- Vérifier l'alignement des versions : `npm run version:check`.
- Relire `git diff` et `git status` : aucun fichier indésirable, diff limité au périmètre de la tâche, historique de commits propre et lisible.
