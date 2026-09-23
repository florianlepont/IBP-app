# Plan de remédiation — audit de septembre 2026

Ce plan corrige **100 % des constats** de l'[audit](./audit-2026-09-code-complet.md). La [matrice de traçabilité](#6-matrice-de-traçabilité) (§6) rattache chaque constat à un lot.

## 1. Principes

1. **Un lot = une PR** relisible, qu'on peut revenir en arrière isolément et qui est couverte par des tests. Chaque correctif de bug arrive avec un test de non-régression qui échoue avant le correctif.
2. **D'abord ce qui détruit des données ou expose des comptes**, ensuite le filet de sécurité (CI et tests), puis l'intégrité de la sync, et enfin les refactorings. Refactorer avant d'avoir le filet serait risqué.
3. **Compatibilité avec les apps déjà installées.** L'API se déploie en 5 minutes, alors que le mobile passe par les stores. Toute évolution de l'API doit donc accepter les clients actuels. Par exemple, le mobile envoie aujourd'hui `status: survey.status ?? "draft"` dans ses upserts (`mobile/src/storage/sync.ts:377`) : l'API doit **ignorer** ce champ, pas rejeter la requête.
4. **Effet cliquet.** Les seuils de couverture sont fixés aux valeurs actuelles dès la phase 1. Ils ne peuvent ensuite que monter, et chaque lot relève les seuils des dossiers qu'il touche.

Tailles : **S** ≤ 1 jour, **M** 2 à 3 jours, **L** 4 à 6 jours de développement.

---

## 2. Vue d'ensemble

| Phase | Objectif | Lots | Effort | Livrable mobile ? |
|---|---|---|---|---|
| **0 — Urgences** | Stopper la perte de données et les failles | L1 → L4 | ~7 j | Oui : version corrective dès la fin de L1 et L4 |
| **1 — Filet de sécurité** | CI fiable, image reproductible, tests qui exécutent vraiment le SQL | L5 → L7 | ~9 j | Non |
| **2 — Intégrité sync et données** | Validation, transactions, moteur de sync robuste, photos | L8 → L13 | ~23 j | Oui : version « sync v2 » |
| **3 — Architecture et performance** | Configuration, découpage, index, domaine partagé, état mobile | L14 → L18 | ~18 j | Oui |
| **4 — Finition** | i18n, accessibilité, hygiène, documentation | L19 → L20 | ~4 j | Oui |
| | | **20 lots** | **≈ 60 j/dev** | |

Pour une personne seule, compter environ 3 mois. Les lots API et mobile d'une même phase sont indépendants et peuvent avancer en parallèle.

```
Phase 0   L1 ─┐  L2 ─┐  L3 ─┐  L4 ─┐        (tous indépendants)
              ▼      ▼      ▼      ▼
Phase 1   L5 (CI) ──► L6 (Docker) ──┐
          L7 (infra de tests) ──────┤
                                    ▼
Phase 2   L8 ─► L9 ─► L10        L11a ─► L11b ─► L12       L13
          (API sync)              (moteur de sync mobile)  (stockage)
                                    ▼
Phase 3   L14 ─► L15 ─► L16      L17 (dépend de L6)       L18
                                    ▼
Phase 4   L19          L20 (en dernier : la doc reflète l'état final)
```

---

## 3. Détail des lots

### Phase 0 — Urgences

#### L1 · Mobile — Ne plus jamais perdre de données sur une erreur de session · **M** · 🔴
Couvre : **M-C1**, le retry 401 sans `forceRefresh`, les stubs d'authentification morts.
- `useAuth0Session.getValidAccessToken` : classer l'erreur au lieu de renvoyer `null`.
  - `invalid_grant`, refresh token révoqué, 401 ou 403 Auth0 → `AUTH_REQUIRED`.
  - Réseau, timeout ou erreur inconnue → nouvelle erreur `AUTH_TEMPORARILY_UNAVAILABLE`, que la sync traite comme « réessayer plus tard ».
- Retirer `clearLocalIbpData()` de `onSessionCleared`. Une session expirée garde la file intacte : les données seront synchronisées après la reconnexion.
- `handleLogout` : si `sync_queue` ou `local_attachments` contient des éléments en attente, afficher une confirmation qui les compte (« 3 relevés et 5 photos non synchronisés seront supprimés »), et ne purger qu'après confirmation.
- Restauration de session (`useAuth0Session.ts:182-186`) : même classification ; une erreur réseau laisse la session en l'état.
- `withAuthRetry` : sur un 401, relancer `getCredentials(undefined, undefined, undefined, true)` (`forceRefresh`).
- Supprimer `devVerificationToken`, `handleVerifyEmail`, `pendingEmailVerification` et `refreshToken: ""`.
- **Tests** (avec `renderHook`, introduit ici même si L7 le généralise) :
  - une erreur réseau pendant `getCredentials` ne supprime rien ;
  - `invalid_grant` déconnecte sans purger la file ;
  - la déconnexion avec des éléments en attente demande une confirmation ;
  - le 401 force le rafraîchissement du jeton.

#### L2 · API — Limite de débit et module debug · **S** · 🔴
Couvre : **A-C1**, **A-H4**.
- `main.ts` : `app.set("trust proxy", "loopback")`. Caddy est le seul proxy, et on ne fait pas confiance à un `X-Forwarded-For` arbitraire.
- `ThrottlerModule` : limite globale de 300/min.
  - `@Throttle` spécifiques : `/sync` 60/min, uploads 30/min, `/public/*` 120/min.
  - Suivi par `user.id` quand l'utilisateur est authentifié, sinon par IP : `getTracker` d'un `ThrottlerGuard` personnalisé.
- `DebugModule` importé seulement si `DEBUG_DATA_RESET_ENABLED === "true"` **et** `NODE_ENV !== "production"`.
- Sortir la branche HS256 de `AuthGuard` pour en faire un `TestAuthGuard`, enregistré uniquement par le module de test. En production, l'`AuthGuard` ne connaît que RS256.
- **Tests :**
  - E2E : deux IP distinctes derrière le proxy ont chacune leur compteur ;
  - unitaire : `/debug/*` renvoie 404 en production.
- **Vérification en production après déploiement :** les logs Caddy ne doivent plus montrer de 429 en rafale.

#### L3 · API — Identité, e-mail et confidentialité des signalements · **M** · 🟠
Couvre : **A-H1**, **A-M6**, `MaxLength` du motif de signalement.
- `AuthGuard` : la liaison par e-mail exige `userInfo.email_verified === true`. Sinon, on crée un nouvel utilisateur.
  - Une option à trancher (§5) : supprimer complètement la liaison si la migration Auth0 est terminée.
- Déplacer le provisionnement dans `UsersService.provisionFromAuth0()` avec `INSERT … ON CONFLICT (auth0_sub) DO UPDATE … RETURNING`, pour supprimer la course entre deux premières requêtes simultanées.
- `users.service.ts:365-378` : ne mettre à jour `users.email` qu'après la vérification Auth0 (webhook ou lecture de `email_verified` à la connexion suivante).
- `reports.service.ts` : l'événement `reported` ne contient plus `actor_id` ni `reason`.
  - Nouvelle migration pour nettoyer les événements existants.
  - `@MaxLength(1000)` sur `reason`, et déduplication `(reporter_id, survey_id)` par un index unique.
- **Tests :**
  - unitaire : un e-mail non vérifié ne fait pas de liaison ;
  - E2E : deux premières requêtes concurrentes produisent un seul utilisateur ;
  - E2E : le propriétaire ne voit pas l'identité du signaleur.

#### L4 · Mobile — Correctifs rapides · **S** · 🟠
Couvre : **M-H5**, **M-H3**.
- `SettingsScreen.tsx:219-238` : outils de développement affichés seulement si `__DEV__`, ou via une variable `EXPO_PUBLIC_ENABLE_DEV_TOOLS` absente des builds de production.
- Écriture de l'URL d'API dans SecureStore déclenchée au *blur* ou à la validation, plus à chaque frappe.
- `useNearbyParcels.ts:73` : bbox dans l'ordre `minLng,minLat,maxLng,maxLat`, via un helper partagé avec `map-viewport.ts`.
- **Tests :** ordre de la bbox ; masquage des outils hors `__DEV__`.
- **Publier la version corrective mobile** (L1 + L4) dès la fin de ce lot.

---

### Phase 1 — Filet de sécurité

#### L5 · CI — Restructuration du workflow · **M** · 🟠
Couvre : **CI-1**, **CI-3**, **CI-4**, **CI-5**, **CI-6**, et la surveillance de `npm audit`.
- `permissions: contents: read` au niveau du workflow, `concurrency` avec `cancel-in-progress` sur les PR, `timeout-minutes` sur chaque job.
- `changes` exécuté aussi sur les PR, avec les filtres `api`, `mobile` et `shared` (lockfile, `package.json`, workflows, configs ESLint, Prettier et TypeScript).
- Job `check` : un seul `npm ci`, puis `lint`, `format:check` et **`typecheck`**.
- Job `unit` en matrice `[api, mobile]`, ignoré quand le workspace n'a pas changé, lancé avec `--coverage`. Le lcov est publié en artefact.
- `e2e` : seulement si `api` ou `shared` a changé, avec `--health-interval 2s`.
- `mobile-build` : `npx expo-doctor` puis `npx expo export --platform android`, si `mobile` a changé.
- `audit` : `npm audit --omit=dev --audit-level=high`. Les 20 vulnérabilités modérées actuelles ne bloquent pas, une vulnérabilité élevée bloque.
- CodeQL (`github/codeql-action`, JavaScript et TypeScript) dans un workflow séparé, hebdomadaire et sur les PR.
- Actions épinglées par SHA, avec Dependabot `github-actions` activé pour les mettre à jour.
- Cache de `node_modules`, avec pour clé `hashFiles('package-lock.json')`.
- Job `ci-ok`, qui agrège les résultats et sert de seul *required check* dans la protection de branche.
- **Validation :** une PR qui ne touche que la doc ne lance que `check`. Une PR avec une erreur de type volontaire échoue.

#### L6 · Docker et déploiement — Image reproductible et sûre · **S** · 🟠
Couvre : **CI-2**.
- `build-push-action` : `context: .` et `file: api/Dockerfile`.
- Dockerfile : `COPY package.json package-lock.json` + `api/package.json`, puis `npm ci --workspace api` et `npm ci --workspace api --omit=dev` dans l'image runtime. Les `overrides` racine s'appliquent alors.
- `.dockerignore` à la racine, `USER node`, `HEALTHCHECK` sur `/v1/health`.
- Job `build` : `if: github.ref == 'refs/heads/main'`, tags `latest` et `sha-${{ github.sha }}`, `concurrency: deploy-image` avec `cancel-in-progress: false`.
- Le filtre de build inclut `package-lock.json`.
- `infra/vps/README.md` : procédure de retour en arrière par tag SHA.
- **Validation :** `docker build` en local, puis comparer `npm ls` dans l'image avec le lockfile.

#### L7 · Infrastructure de tests · **L** · 🟠
Couvre : **T3**, **T4**, **T5**, le chemin RS256 du garde d'authentification, **T1** (seuils).
- `mobile/jest.unit.config.js` :
  - `testMatch: ['**/*.test.ts?(x)']` ;
  - fusionner les deux `moduleNameMapper` ;
  - ajouter `@testing-library/react-native`.
- Mock `expo-sqlite` **exécutant vraiment le SQL**, avec `better-sqlite3` en mémoire derrière l'API asynchrone (`runAsync`, `getAllAsync`, `withTransactionAsync`). Adapter `storage.test.ts` pour vérifier l'état des tables plutôt que des fragments de SQL.
- Réécrire `useSurveySync.test.ts` et les tests de hooks avec `renderHook`, sans espionner `React.useState`.
- E2E API :
  - `TRUNCATE … RESTART IDENTITY CASCADE` dans un `globalSetup` ;
  - `randomUUID()` au lieu de `Date.now()` ;
  - découper `surveys-idempotency.e2e-spec.ts` en `surveys-submit`, `surveys-visibility`, `public-map`, `attachments` et `parcel-history`.
- Test du chemin RS256 de `AuthGuard` : générer une paire de clés, servir un JWKS local et signer des jetons (valide, expiré, mauvaise audience, mauvais `kid`).
- **Fixture de parité IBP** `docs/technical/fixtures/ibp-parity.json` (entrées et scores attendus), exécutée par `api/test/ibp-rules.spec.ts` **et** `mobile/src/app/ibp-scoring.test.ts`. Elle fera d'abord apparaître la divergence `factor_f_group_capped`, à corriger dans ce lot côté mobile.
- `coverageThreshold` par dossier, fixé aux valeurs mesurées : l'effet cliquet démarre.

---

### Phase 2 — Intégrité de la sync et des données

#### L8 · API — Validation de `/sync` et règles de soumission · **M** · 🟠
Couvre : **A-H2**, **A-M5**, la partie validation de **A-M2**.
- DTO de classe `SyncOperationDto`, avec discriminant `type` et `@ValidateNested`, `@Type`. Chaque payload est validé par `plainToInstance` et `validate`. Un payload invalide donne un résultat `fatal_error` pour cette opération, le reste du lot n'est pas rejeté.
- `upsertForUser` :
  - **ignore** `status` (compatibilité avec les clients actuels) et `expires_at` ;
  - refuse avec `409 survey_submitted_read_only` les modifications de champs en lecture seule quand le relevé stocké est `submitted`.
  - La soumission passe uniquement par `submitSurvey`.
- `getPublicParcelStatuses` exige `submitted_at IS NOT NULL`.
- `parcel_ids` : `@ArrayMaxSize(20)` et `@Matches` sur le format des identifiants cadastraux.
- `sync-error.utils.ts` : les codes `pg` 22xxx et 23xxx deviennent des erreurs **fatales** avec un message générique, sans nom de contrainte. Le détail est journalisé côté serveur.
- **Tests :**
  - E2E : un upsert avec `status: "submitted"` ne soumet pas ;
  - E2E : un upsert sur un relevé soumis renvoie 409 ;
  - E2E : `expires_at: "abc"` renvoie `fatal_error` et pas une erreur 500 retentée ;
  - E2E : 21 parcelles sont refusées.

#### L9 · API — Transactions et concurrence · **M** · 🟠
Couvre : **ARCH-3 (API)**, **A-M1**, **A-M7**, **A-M9**.
- `DatabaseService.transaction(fn)` : `BEGIN`, `COMMIT` ou `ROLLBACK`, et `release` dans un `finally`. Les services reçoivent un `Queryable`, c'est-à-dire le pool ou le client de la transaction.
- Une transaction chacun pour : upsert, patch, submit, delete, création, upload et suppression de pièces jointes, création de signalement.
  - `insertEvent` fait partie de la même transaction.
- `UPDATE … WHERE id = $1 AND user_id = $2 AND sync_version < $17` : si aucune ligne n'est modifiée, on renvoie un conflit.
- Supprimer les `catch` qui avalent les erreurs dans `syncSurveyParcels` et `ensureParcelIds` (A-M1).
- Soumission : `SELECT … FROM parcels WHERE id = ANY($1) FOR UPDATE`, puis calcul de la version. Une erreur 23505 résiduelle donne un 409.
- `deleteAccount` : transaction en base d'abord, puis suppression Auth0. Si Auth0 échoue, un job de relance, ou au minimum un log d'erreur et un statut `pending_auth0_deletion`.
- **Tests :**
  - E2E avec injection d'une panne sur `insertEvent` : rien n'est commité ;
  - E2E : deux soumissions concurrentes donnent 201 puis 409 ;
  - E2E : un upsert concurrent de même version donne un seul gagnant.

#### L10 · API — Flux `/sync/changes` fiable · **M** · 🟡
Couvre : **ARCH-6**, les listes non bornées (fallback de `/sync/changes`).
- Migration : colonne `survey_events.seq BIGSERIAL` avec un index. Le curseur devient `seq`, **encodé dans le même format opaque**. L'API accepte encore l'ancien curseur `(created_at, id)` et le convertit : pas de rupture pour les clients installés.
- Cas B : on compare un hash du contenu (`sha256` du payload normalisé) en plus de la `sync_version`. Même version avec un contenu différent donne un conflit `sync_version_conflict`, plus un rejeu silencieux.
- Supprimer le fallback qui renvoie à chaque poll les relevés sans événement, et générer les événements manquants par migration.
- `docs/technical/sync-conflict-resolution-v1.md` et `api-contract-v1.md` : mettre à jour les cas B et le curseur.
- **Tests E2E :**
  - un événement commité en retard n'est pas sauté ;
  - deux appareils avec la même version et des contenus différents donnent un conflit.

#### L11a · Mobile — Moteur de sync : concurrence, lots, retries · **L** · 🟠
Couvre : **M-H1**, **M-H4**, le plafond de retry, le timeout de `fetch`, le pull qui écrase des données non synchronisées, l'autosave sauté, les IDs non uniques, la partie « client HTTP » d'**ARCH-5**.
- `syncPending` et `pullRemoteChanges` passent par un **single-flight** au niveau du module : une promesse partagée. Supprimer les appels directs depuis `handleDeleteAttachment`, `updateSurveyVisibility` et `handlePullChanges`.
- Lots de **100 opérations au plus**, avec une boucle tant qu'il reste des éléments et un budget de temps.
- `markSurveyQueueRowSynced` : ne passer à `synced` que s'il ne reste **aucune autre ligne** pour ce relevé, dans la même transaction.
- Plafond de retry : `terminal = terminalByMessage || reachedRetryCap || options?.forceTerminal === true`. Renommer `terminalOverride`. Les erreurs réseau et les 5xx ne comptent pas dans le plafond, mais reçoivent un backoff plafonné.
- `applyRemoteChanges` : ne jamais écraser un relevé qui a une ligne dans la file ou `sync_blocked = 1`. Dans ce cas, stocker la version distante à part et signaler le conflit.
- Tous les appels passent par `api/client.ts` : timeout, `ApiError` typée, `withAuthRetry`.
- `useEditingDraft` : si une sauvegarde est en cours, reprogrammer le timer au lieu d'abandonner. Vider la sauvegarde en attente au passage en arrière-plan (`AppState`).
- IDs générés avec `Crypto.randomUUID()` (`expo-crypto`). Les anciens IDs restent valides.
- **Tests** sur le vrai SQLite de L7 :
  - 250 opérations partent en 3 lots ;
  - deux drains concurrents font un seul POST ;
  - une édition pendant la sync laisse le relevé `pending` ;
  - les 5xx ne bloquent jamais, les 422 bloquent après une tentative ;
  - un pull n'écrase pas une modification locale.

#### L11b · Mobile — Stockage SQLite : transactions, schéma, index · **M** · 🟡
Couvre : **ARCH-3 (mobile)**, **ARCH-5**, les index SQLite, le mode WAL.
- Migrations versionnées par `PRAGMA user_version`. Chaque migration est une fonction exécutée dans une transaction. Les erreurs ne sont plus avalées.
- Une migration ajoute `sync_queue.op_type` et le remplit à partir du JSON existant.
- Index sur `sync_queue(survey_id)`, `sync_queue(status, next_retry_at)` et `local_attachments(remote_attachment_id)`. `PRAGMA journal_mode = WAL`.
- `withTransactionAsync` autour de `queueDeleteSurvey`, `updateLocalDraft`, `applyRemoteChanges` et `queueSurveyVisibilityChange`.
- **Tests :**
  - migration d'une base v0 réelle vers la dernière version ;
  - une panne au milieu de `updateLocalDraft` laisse la base cohérente.

#### L12 · Mobile — Photos robustes et légères · **M** · 🟠
Couvre : **M-H2**, les pièces jointes distantes avec `local_uri=""`, les images en pleine résolution.
- À la capture : `expo-image-manipulator` (2 048 px sur le grand côté, JPEG 0,7), puis copie dans `FileSystem.documentDirectory/attachments/`. `size_bytes` est pris dans les infos du fichier réel.
- Upload en streaming (`FileSystem.uploadAsync`) au lieu d'un blob en mémoire.
- Les erreurs réseau pendant l'upload ne comptent pas dans le plafond de retry. Un fichier local manquant donne une erreur terminale **visible** dans l'UI, sans suppression silencieuse.
- Pièces jointes distantes : affichage par URL présignée, téléchargée à la demande et mise en cache.
- Migration : copier dans `documentDirectory` les photos encore référencées dans le cache.
- `expo-image` pour les miniatures et le carrousel.
- **Tests :** redimensionnement appelé ; chemin persistant ; les erreurs réseau ne font pas avancer `retry_count`.

#### L13 · API — Stockage objet unifié · **M** · 🟠
Couvre : **A-H3**, **A-M3**, **A-M4**, la partie S3 d'**ARCH-2**, le `in` de `isAllowedMimeType`.
- `StorageService` unique (client S3, bucket, `putObject`, `presignPut`, `head`, `delete`, mode `local`), injecté dans les services surveys, attachments et users.
- Les photos de profil passent par le `StorageService`, donc par MinIO en production. Script de migration des fichiers encore présents.
- Clés de stockage construites à partir d'identifiants validés (UUID, ou regex `^[A-Za-z0-9_-]+$`). En mode local, on vérifie que `path.resolve(...)` reste sous le dossier d'upload.
- URL présignée avec `ContentLength` imposé. La confirmation compare `HeadObject.ContentLength` à `size_bytes`, et supprime l'objet puis renvoie 422 en cas d'écart.
- `isAllowedMimeType` : `Object.hasOwn(MIME_EXT, mime)`.
- **Tests :**
  - unitaire : chemin de traversée refusé ;
  - unitaire : `"constructor"` refusé ;
  - E2E : une taille déclarée différente de la taille réelle donne 422 ;
  - E2E : la photo de profil survit à un redémarrage du conteneur.

---

### Phase 3 — Architecture et performance

#### L14 · API — Configuration, pool, observabilité · **S** · 🟡
Couvre : **A-M8**, les accès `process.env` dispersés, CORS, logs, la partie « variables mortes » d'**ARCH-7**.
- `@nestjs/config` avec un schéma validé au démarrage (`zod` ou `class-validator`). Plus de valeurs par défaut silencieuses en production : `ibp/ibp`, `minio123`, `AUTH0_AUDIENCE` vide.
- Pool `pg` : `max`, `idleTimeoutMillis`, `statement_timeout`, et `pool.on("error", …)`.
- `CORS_ORIGIN` obligatoire en production, sinon `origin: false`, puisque l'app mobile n'a pas besoin de CORS.
- `Logger` Nest dans tous les services. `auth.guard.ts:52` ne journalise plus que le message et le code.
- Supprimer `REFRESH_TOKEN_SECRET` et `ACCESS_TOKEN_*` des `.env.example` et de la CI.

#### L15 · API — Découpage de `SurveysService` et efficience des requêtes · **L** · 🟡
Couvre : **ARCH-2**, les efficiences API (sync séquentielle, IGN, listes non bornées, `SELECT *`), la partie performance d'**A-M2**.
- Découper en plusieurs classes :
  - `SurveysRepository` : SQL pur ;
  - `SurveysService` : CRUD et soumission ;
  - `SurveyEventsService` ;
  - `ParcelsService`, qui fusionne le client IGN WFS interne avec `CadastreProviderService` ;
  - `PublicMapService`.
- Supprimer les doublons `getSurveyForUser` et `insertEvent`.
- `ensureParcelIds` : un seul `INSERT … SELECT unnest($1::text[]) ON CONFLICT DO NOTHING`, puis un seul `SELECT`.
- Contrôles de propriété : `SELECT id, user_id, status` au lieu de `SELECT *`.
- Pagination par curseur (`limit` ≤ 100) sur `listForUser`, `getEvents` et `listReports`. Le mobile consomme `next_cursor`, avec une compatibilité : sans `limit`, l'API renvoie tout, comme aujourd'hui.
- IGN : le timeout couvre aussi `response.json()`, cache LRU par tuile et zoom (TTL de 24 h), et la requête « parcelles étudiées » est limitée à la bbox.
- **Validation :** E2E inchangés au vert. Mesurer le nombre de requêtes d'un lot de 100 upserts avant et après : objectif ÷ 3.

#### L16 · API — Index et migrations · **S** · 🟡
Couvre : les index manquants et redondants, la partie migrations et tables mortes d'**ARCH-7**.
- Index partiel `surveys (submitted_at DESC) WHERE status = 'submitted' AND visibility = 'public' AND deleted_at IS NULL`.
- Colonnes générées `parcels.centroid_lat` et `centroid_lng` (`STORED`) avec un index btree composite. Réécrire le filtre bbox. Option PostGIS à trancher (§5).
- Index `survey_events(actor_id)`.
- Supprimer `idx_users_auth0_sub`, `idx_surveys_parcel_id` et `idx_survey_parcels_survey_id`.
- `scripts/migrate.js` : `pg_advisory_lock` pendant les migrations.
- Migration de suppression des tables `auth_sessions`, après avoir vérifié qu'aucun code ne les lit.
- **Validation :** `EXPLAIN ANALYZE` avant et après sur les routes publiques, avec un jeu de données de 10 000 relevés, joint à la PR.

#### L17 · Monorepo — Paquet de domaine partagé `ibp-domain` · **L** · 🟠
Couvre : **ARCH-1**. Dépend de L6 (build Docker depuis la racine) et de L7 (fixture de parité).
- `packages/ibp-domain` (workspace npm, TypeScript compilé en CommonJS et ESM) contient :
  - les clés de facteurs et les ensembles autorisés ;
  - `computeScores` et `validateDraft` / `validateSubmit` (fonctions pures) ;
  - les types de contrat (`SurveyUpsertPayload`, `SyncOperation`, `SyncResult`, `SyncChangesResponse`).
- L'API (`IbpRulesService` devient une fine façade) et le mobile (`ibp-scoring.ts`, `app/types.ts`) importent ce paquet. Expo 57 gère les workspaces nativement ; vérifier `expo export` en CI (L5).
- La fixture de parité de L7 s'exécute une seule fois, dans le paquet.
- **Validation :** tests API et mobile au vert, `expo export` OK, image Docker construite.

#### L18 · Mobile — Architecture d'état et performance de rendu · **L** · 🟡
Couvre : **ARCH-4**, les efficiences mobile (re-rendus, `FlatList`, `listLocalSurveys`, carte), les écrans géants, `styles.ts` mort, `useNavigation() as any`.
- Contextes `SessionContext`, `SyncContext` et `SurveysContext`, chacun avec une valeur mémoïsée (`useMemo`). `useSurveySync` devient un simple assembleur, et `AuthenticatedAppNavigation` ne fait plus passer 29 props.
- Découper `SurveyListScreen`, `SurveyDetailScreen` et `SurveyFormScreen` en un conteneur (logique) et des composants de présentation sous `screens/<écran>/`. Objectif : aucun fichier de plus de 400 lignes.
- `FlatList` (ou `FlashList`) pour la liste des relevés, avec `keyExtractor`, éléments `React.memo` et callbacks stables.
- Colonne `completion` précalculée dans `local_surveys`, mise à jour à l'écriture. `listLocalSurveys` ne parse plus les payloads.
- Carte publique :
  - requête par bbox (via `map-viewport`) ;
  - clustering (`react-native-map-clustering` ou regroupement maison par grille) ;
  - marqueurs mémoïsés ;
  - `onRegionChangeComplete` *debouncé*.
- Supprimer les 158 clés de style inutilisées (script d'analyse joint à la PR) et répartir `styles.ts` par écran.
- Typer la navigation (`NativeStackNavigationProp<RootStackParamList>`).
- **Validation :** profil React DevTools avant et après (nombre de rendus sur un `setStatus`), 500 relevés fluides dans la liste.

---

### Phase 4 — Finition

#### L19 · Mobile — i18n, messages et accessibilité · **M** · 🟢
Couvre : les textes mélangés FR/EN, les messages d'état techniques, l'accessibilité.
- `i18n-js` et `expo-localization`, avec le catalogue `fr` comme langue de référence et `en` en option. Extraire tous les textes.
- Les messages d'état passent par un mapping `code → message utilisateur`, sans ID ni texte technique. Le détail reste dans les logs de debug.
- `accessibilityRole`, `accessibilityLabel` et `accessibilityState` sur tous les `Pressable` de `SurveyDetailScreen`, `PublicMapScreen` et `SurveyFormScreen`. Règle ESLint `react-native-a11y` en *warning*.
- **Tests :** aucun texte en dur (règle ESLint `i18next/no-literal-string` limitée aux écrans).

#### L20 · Hygiène du monorepo et documentation · **S** · 🟢
Couvre : **ARCH-7** (reste), **ARCH-8**.
- Supprimer `App.tsx` à la racine. Le `package.json` racine ne garde que `workspaces`, les `scripts` et les `overrides`. Le `tsconfig.json` racine devient une configuration de base neutre, ou disparaît.
- Supprimer `bcryptjs`, `@nestjs/schedule` et `EmailService` (ou l'enregistrer s'il est prévu à court terme). Passer `@expo/ngrok` en `devDependencies`.
- Deux bibliothèques d'onglets : vérifier si `@react-navigation/bottom-tabs` est encore importé depuis #119. Sinon, le retirer, puis tester le build natif iOS et Android.
- Mettre `CLAUDE.md` à jour :
  - versions RN, Expo et maps ;
  - `POST /v1/sync` ;
  - `local_meta` ;
  - convention `*.spec.ts` ;
  - étapes réelles de la CI ;
  - nouveaux modules (`StorageService`, `ibp-domain`, contextes).
- Relire `technical-architecture-v1.md`, `api-contract-v1.md` et `data-contract-v1.md` pour qu'ils reflètent l'état final.
- Ajouter à l'audit une section « Statut » qui renvoie vers chaque PR.

---

## 4. Jalons et critères de fin

| Jalon | Fin de | Critères vérifiables |
|---|---|---|
| **J0 — Plus de perte ni de fuite** | Phase 0 | Tests de non-régression M-C1 au vert. Version mobile corrective publiée. Aucun 429 en rafale dans les logs de production. `/debug` renvoie 404 en production. |
| **J1 — CI de confiance** | Phase 1 | Typecheck en CI. Image construite avec le lockfile et taguée par SHA. SQLite réellement exécuté dans les tests. Seuils de couverture actifs. |
| **J2 — Sync fiable** | Phase 2 | Toutes les écritures multi-étapes sont transactionnelles. Lots ≤ 100. Une seule sync à la fois. Photos persistées et redimensionnées. Couverture de `sync.ts` ≥ 80 %, de `surveys-sync.service.ts` (unitaire) ≥ 70 %. |
| **J3 — Architecture saine** | Phase 3 | Aucun fichier source de plus de 600 lignes. Règles IBP définies une seule fois. `EXPLAIN` sans scan séquentiel sur les routes publiques. Liste fluide avec 500 relevés. |
| **J4 — Audit soldé** | Phase 4 | Chaque ligne de la matrice §6 cochée avec un lien vers sa PR. `CLAUDE.md` exact. Couverture globale ≥ 70 % (API unitaire et E2E combinés) et ≥ 65 % (mobile). |

## 5. Décisions à prendre

1. **Liaison de comptes par e-mail (L3).** Faut-il la supprimer complètement (recommandé si tous les comptes ont déjà un `auth0_sub`, à vérifier par une requête SQL en production), ou la garder avec `email_verified` ? Et l'inscription Auth0 exige-t-elle la vérification de l'e-mail ?
2. **Déconnexion avec des données en attente (L1).** Faut-il la bloquer tant que la sync n'a pas eu lieu, ou autoriser la purge après confirmation (recommandé) ?
3. **Filtre géographique (L16).** Colonnes générées et btree (recommandé, sans nouvelle dépendance), ou PostGIS (plus puissant, mais nouvelle extension et nouvelle image Postgres) ?
4. **Langues (L19).** Français seulement pour l'instant, ou français et anglais ?
5. **Rythme de publication mobile.** Une version à chaque jalon J0, J2, J3 et J4 (recommandé), ou une seule grosse version ?

## 6. Matrice de traçabilité

| Constat | Lot | | Constat | Lot |
|---|---|---|---|---|
| M-C1 perte de données sur erreur de session | L1 | | A-C1 limite de débit globale | L2 |
| Retry 401 sans `forceRefresh` | L1 | | A-H1 liaison par e-mail, e-mail non vérifié, course à la création | L3 |
| Stubs d'authentification morts | L1 | | A-H2 validation de `/sync` et contournement de soumission | L8 |
| Déconnexion qui vide la file sans avertir | L1 | | A-H3 photos de profil perdues | L13 |
| M-H1 drains concurrents et écrasement d'édition | L11a | | A-H4 module debug et HS256 | L2 |
| M-H2 photos (cache, taille, mémoire, retry) | L12 | | A-M1 erreurs avalées dans `syncSurveyParcels` | L9 |
| M-H3 bbox inversée | L4 | | A-M2 `parcel_ids` sans limite | L8 (validation), L15 (lot SQL) |
| M-H4 lots > 100 | L11a | | A-M3 traversée de chemin | L13 |
| M-H5 outils de debug en production | L4 | | A-M4 taille d'upload non contrôlée | L13 |
| Plafond de retry inopérant (`terminalOverride`) | L11a | | A-M5 erreurs déterministes retentées, fuite de détails | L8 |
| `fetch` de sync sans timeout | L11a | | A-M6 identité du signaleur | L3 |
| Pull qui écrase des données non synchronisées | L11a | | A-M7 soumissions concurrentes | L9 |
| Autosave sauté | L11a | | A-M8 pool et configuration | L14 |
| IDs non uniques | L11a | | A-M9 ordre de suppression de compte | L9 |
| Pièces jointes distantes `local_uri=""` | L12 | | `in` dans `isAllowedMimeType` | L13 |
| `useNavigation() as any` | L18 | | CORS permissif | L14 |
| Textes FR/EN, messages techniques | L19 | | `MaxLength` du motif, déduplication des signalements | L3 |
| Accessibilité | L19 | | `console.error` et `Logger` | L14 |
| ARCH-1 IBP et contrats dupliqués | L7 (parité), L17 | | Sync séquentielle et nombre de requêtes | L15 |
| ARCH-2 god service, S3 ×3, `process.env` | L13, L14, L15 | | Index partiel public | L16 |
| ARCH-3 transactions API | L9 | | Bbox `centroid` JSON | L16 |
| ARCH-3 transactions SQLite | L11b | | Index `survey_events(actor_id)` | L16 |
| ARCH-4 entonnoir de props | L18 | | Index redondants | L16 |
| ARCH-5 schéma SQLite, `op_type`, `fetch` direct | L11b, L11a | | IGN sans cache ni timeout sur le corps | L15 |
| ARCH-6 ordre du flux et cas B | L10 | | Listes non bornées, fallback de `/sync/changes` | L15, L10 |
| ARCH-7 hygiène du monorepo et dépendances | L20, L14, L16 | | `SELECT *` pour les contrôles de propriété | L15 |
| ARCH-8 `CLAUDE.md` obsolète | L20 | | Re-rendus globaux | L18 |
| T1 pas de seuils de couverture | L7, L5 | | Pas de `FlatList` | L18 |
| T2 modules à risque non testés | L1, L7, L11a, L11b, L12 | | Images en pleine résolution | L12 |
| T3 tests d'implémentation (mock SQLite, espions React) | L7 | | `listLocalSurveys` parse tout | L18 |
| T4 `testMatch` `.tsx`, `moduleNameMapper` en double | L7 | | Pas de transaction SQLite ni de WAL | L11b |
| T5 isolation E2E, fichier fourre-tout | L7 | | Index SQLite | L11b |
| T6 parité IBP | L7 | | Carte : bbox, clustering, marqueurs | L18 |
| Chemin RS256 non testé | L7 | | CI-1 typecheck absent | L5 |
| CI-2 image, lockfile, `:latest`, tag SHA, concurrence | L6 | | CI-3 filtrage par chemin | L5 |
| CI-4 permissions, SHA, timeouts | L5 | | CI-5 couverture, audit, CodeQL, `expo-doctor` | L5 |
| CI-6 jobs fusionnés, cache, sonde Postgres | L5 | | `npm audit` : 20 vulnérabilités modérées | L5 (surveillance, seuil `high`) |
