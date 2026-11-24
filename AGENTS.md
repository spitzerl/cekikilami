# AGENTS.md

Guidelines for anyone (human or AI) working on **Cékikilami**.
These rules are mandatory and take precedence over personal habits.

## 1. Git: always, no exceptions

- **Always use Git.** No code change may stay outside version control.
- **Never work directly on `main` or `develop`.** Every task starts on a dedicated branch.
- Before starting: `git status` and `git pull` on the base branch (`develop` by default) to start from a clean, up-to-date state.
- **Commit regularly and keep commits well structured**: split work into logical units (one feature, one fix, one refactor, one doc change), never a single catch-all commit at the end.
- Never commit secrets (`.env`, tokens, passwords), generated files (`dist`, `node_modules`, `uploads`) or build artefacts.
- Do not rewrite the history of a shared branch (`main`, `develop`); no `push --force` on them.
- Before considering a task done: check `git status` (clean tree) and make sure the branch is pushed when a remote is configured.

### Conventional Commits

The format is **mandatory**:

```
<type>(<scope>): <short imperative description>
```

Allowed types:

| Type       | Use                                               |
| ---------- | ------------------------------------------------- |
| `feat`     | new feature                                       |
| `fix`      | bug fix                                           |
| `refactor` | rewrite without behaviour change                  |
| `perf`     | performance improvement                           |
| `test`     | adding or fixing tests                            |
| `docs`     | documentation                                     |
| `style`    | formatting, no logic impact                       |
| `build`    | build tooling, dependencies                       |
| `ci`       | continuous integration configuration              |
| `chore`    | maintenance tasks (config, scripts)               |
| `revert`   | reverting a commit                                |

Rules:

- `scope` in lowercase, optional but recommended: `backend`, `frontend`, `ui`, `game`, `socket`, `deploy`, `security`, `docs`, `deps`…
- short description, lowercase, imperative mood, no trailing period (e.g. `feat(game): add blind-test timing`).
- one commit = one coherent change; prefer several small commits over one large one.
- breaking change: add `!` after the type/scope and a `BREAKING CHANGE:` section in the body (e.g. `feat(api)!: ...`).

Valid examples:

```
feat(ui): add player avatars to exported score image
fix(deezer): restore search with new CDN hosts and cache previews
docs(deploy): note URL-safe secrets for compose
test(security): add regression suite
```

### Conventional Branching

Branches follow the same vocabulary:

```
<type>/<short-kebab-case-topic>
```

Examples: `feat/blind-test-timer`, `fix/deezer-preview-cache`, `refactor/game-service`, `docs/agents-guide`, `chore/deps-update`.

- topic in kebab-case, short and descriptive.
- one branch = one topic; do not mix several features.
- delete the branch once merged.

## 2. Code naming conventions

**Pick one style and keep it consistent across the whole project.** Do not mix camelCase and snake_case for the same kind of identifier.

Convention for this repository:

- **camelCase** for all JavaScript / Vue application code:
  variables, functions, methods, object properties, Pinia store keys, parameters.
  E.g. `currentMusicIndex`, `isConnected`, `generatePlayerToken`, `votingStatus`.
- **PascalCase** for classes, models and Vue components.
  E.g. `GameService`, `Player`, `Session`, `WaitingRoom.vue`.
- **snake_case** only where the ecosystem imposes it:
  SQL / PostgreSQL columns (`host_player_id`, `created_at`), environment variables (`POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `APP_DB_PASSWORD`) and payload fields coming from the database.
- non-component JS files in camelCase (`gameSocket.js`, `uploadService.js`); Vue components in PascalCase (`GameHeader.vue`).
- global constants in `SCREAMING_SNAKE_CASE` (`MAX_SESSIONS`, `SESSION_TTLS`, `CONFIG_BOUNDS`).
- English for all code identifiers, comments, commit messages and documentation, as the project is meant to be open source and readable by contributors. User-facing product copy stays in French.

Golden rule: **consistency > personal preference**. If an existing file already follows a convention, match it.

## 3. Style and quality

- Follow the style, architecture and patterns of the surrounding code (`backend/src`, `frontend/src`).
- Do not reformat or refactor code unrelated to the task: keep diffs focused.
- Treat existing files and changes as the user's work: never delete or overwrite them without a reason.
- No leftover debug `console.log` in production code.
- Write comments in English, explaining the intent, not restating the code.
- Keep `CHANGELOG.md` (Keep a Changelog format) up to date for any notable user-facing change.

## 4. Versioning

The project follows **Semantic Versioning** (SemVer). The current version lives in the root `package.json` and must stay aligned with `backend/package.json` and `frontend/package.json` (checked by `npm run version:check`).

- **Every user-facing modification must update the version number** in all three `package.json` files, plus the matching `CHANGELOG.md` entry.
- **The bump must match what was actually done**, never an arbitrary increment:
  - **patch** (`1.0.0` → `1.0.1`): bug fixes, small internal changes with no user-facing feature;
  - **minor** (`1.0.0` → `1.1.0`): new backward-compatible features;
  - **major** (`1.0.0` → `2.0.0`): breaking changes or a release that is not backward compatible.
- While the project is in beta (`1.0.0-beta.N`), keep the base version and increment the pre-release suffix (`-beta.N+1`) for notable changes. Do not switch to a stable version on your own.
- **Ask the user before deciding on a large bump or a large release**: if the change is significant, ambiguous, or could justify a major/minor release, or if the user may want to ship a bigger release than the raw change implies, ask them whether they want a major bump, a bigger release, or a version adjusted to the change. Do not make that decision alone.
- Never tag or publish a release without explicit user confirmation.

## 5. Checks before finishing

- Run backend tests: `cd backend && npm test` (requires PostgreSQL / `TEST_DATABASE_URL`).
- Verify the frontend build: `cd frontend && npm run build`.
- Check version alignment: `npm run version:check`.
- Review `git diff` and `git status`: no unwanted files, diff limited to the task scope, clean and readable commit history.
