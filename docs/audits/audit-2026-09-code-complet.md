# Audit complet du code — Cortege (septembre 2026)

Périmètre : `api/`, `mobile/`, `infra/`, `.github/workflows/`, sur le commit `a499358`.
Axes : architecture, qualité du code, efficience, couverture de test, efficience de la CI.

Méthode :
- lecture du code ;
- exécution locale des outils du dépôt : `lint`, `typecheck`, `format:check`, tests unitaires avec couverture, E2E API avec couverture sur PostgreSQL 16 ;
- analyse des temps d'exécution GitHub Actions.

Chaque constat classé Critique ou Élevé a été revérifié à la main dans le code.

---

## 0. Synthèse

| Axe | Note | En une phrase |
|---|---|---|
| Architecture | **C+** | Le découpage est lisible, mais le service API est un « god service », les contrats et règles IBP sont dupliqués sans paquet partagé, et aucune écriture multi-étapes n'est transactionnelle, ni côté API ni côté mobile. |
| Qualité du code | **C** | Tout le SQL est paramétré et le typage est propre. En revanche, il y a un bug de perte de données critique sur mobile, une prise de contrôle de compte possible et un contournement des règles de soumission via la sync. |
| Efficience | **C+** | Les volumes actuels sont faibles, mais on trouve : une limite de débit globale de 10 requêtes/min partagée par tous les clients, des requêtes en boucle dans la sync, des index manquants sur les routes publiques, des listes non virtualisées et des re-rendus globaux. |
| Couverture de test | **C-** | 470 tests passent. La couverture unitaire est de 28 % (API) et 44 % (mobile). Les chemins les plus risqués (sync, session Auth0, pièces jointes, écrans) sont peu ou pas testés. |
| Efficience de la CI | **B-** | La CI est rapide (environ 70 s) et parallèle, mais le typecheck n'y tourne pas, l'image de prod est construite sans lockfile, et on peut publier `:latest` depuis n'importe quelle branche. |

### Top 10 des actions prioritaires

| # | Gravité | Action | Réf. |
|---|---|---|---|
| 1 | 🔴 Critique | Ne plus effacer les données locales quand le rafraîchissement du jeton échoue (hors ligne) | [M-C1](#m-c1) |
| 2 | 🔴 Critique | Rendre la limite de débit par client (`trust proxy`) et la relever | [A-C1](#a-c1) |
| 3 | 🟠 Élevé | Exiger `email_verified` avant de lier un compte par e-mail | [A-H1](#a-h1) |
| 4 | 🟠 Élevé | Valider les payloads de `/sync` et interdire `status: submitted` dans l'upsert | [A-H2](#a-h2) |
| 5 | 🟠 Élevé | Mutex unique sur le drain de la file de sync, et ne marquer une survey `synced` que si sa file est vide | [M-H1](#m-h1) |
| 6 | 🟠 Élevé | Envoyer la sync mobile par lots de 100 opérations au plus | [M-H4](#m-h4) |
| 7 | 🟠 Élevé | Transactions côté API (upsert, submit, pièces jointes) et côté SQLite | [ARCH-3](#arch-3) |
| 8 | 🟠 Élevé | Ajouter `npm run typecheck` à la CI | [CI-1](#ci-1) |
| 9 | 🟠 Élevé | Construire l'image Docker avec le lockfile racine (`npm ci`) et interdire le push hors `main` | [CI-2](#ci-2) |
| 10 | 🟠 Élevé | Masquer les outils de debug (URL d'API, reset de base) dans les builds de production | [M-H5](#m-h5) |

---

## 1. Mesures

Toutes les mesures ont été faites localement.

| Commande | Résultat | Durée |
|---|---|---|
| `npm run lint` | ✅ 0 erreur, 0 warning | 11 s |
| `npm run typecheck` | ✅ | 8 s |
| `npm run format:check` | ✅ | 4 s |
| Tests unitaires API | ✅ 6 suites, 66 tests | 10 s |
| Tests unitaires mobile | ✅ 26 suites, 368 tests | 19 s |
| E2E API (PostgreSQL 16) | ✅ 4 suites, 36 tests | 11 s |
| `npm audit --omit=dev` | ⚠️ 20 vulnérabilités modérées (transitives, suivies dans `dependabot.yml`) | — |

### Couverture

| Périmètre | Lignes | Branches | Fonctions |
|---|---|---|---|
| API, unitaires seuls | 27,7 % | 22,3 % | 28,8 % |
| API, E2E seuls | 65,4 % | 46,6 % | 69,6 % |
| Mobile, unitaires | 44,4 % | 26,0 % | 34,7 % |

Modules critiques à 0 % ou presque :

| Module | Unitaire | E2E | Commentaire |
|---|---|---|---|
| `api/src/surveys/surveys.service.ts` (1 570 l.) | 0 % | 68 % | Branches de conflit et IGN non couvertes |
| `api/src/surveys/surveys-sync.service.ts` | 0 % | 88 % | Couvert uniquement de bout en bout |
| `api/src/surveys/surveys-attachments.service.ts` | 0 % | 65 % | Un seul chemin E2E |
| `api/src/auth/auth.guard.ts` | 44 % | 44 % | **Le chemin JWKS/RS256 (l. 73-169) n'est jamais exécuté** : l'E2E passe par des jetons HS256 de test |
| `mobile/src/storage/sync.ts` (1 133 l.) | 33 % | — | Plafond de retry et `sync_blocked` non testés |
| `mobile/src/hooks/useAuth0Session.ts` | 0 % (toujours mocké) | — | C'est là que se trouve le bug critique M-C1 |
| Tous les écrans `.tsx` (~7 000 l.) | 0 % | — | `jest.unit.config.js` ne ramasse que `*.test.ts` |

### Taille des fichiers

| Fichier | Lignes |
|---|---|
| `mobile/src/screens/SurveyListScreen.tsx` | 1 714 |
| `api/src/surveys/surveys.service.ts` | 1 570 |
| `mobile/src/app/styles.ts` | 1 536 (158 des 267 clés de style ne sont jamais utilisées) |
| `mobile/src/screens/SurveyDetailScreen.tsx` | 1 269 |
| `mobile/src/screens/SurveyFormScreen.tsx` | 1 190 |
| `mobile/src/storage/sync.ts` | 1 133 |
| `mobile/src/app/AuthenticatedAppNavigation.tsx` | 955 |

---

## 2. Architecture

### Points forts
- **Découpage lisible.** Côté API, les modules NestJS sont par domaine. Côté mobile, les couches sont bien séparées : `api/`, `storage/`, `hooks/`, `screens/`, `ui/`.
- **Contrôle de propriété dans le SQL.** Les requêtes filtrent sur `WHERE id = $1 AND user_id = $2`, et les lectures publiques filtrent sur la visibilité.
- **Protocole de sync explicite.** Il repose sur `client_ref` et sur la distinction retryable/fatal. Il est cohérent avec `sync-conflict-resolution-v1.md` (cas A à D).
- **Infra simple et robuste.** Déploiement *pull-based*, ports exposés sur la boucle locale uniquement, dossiers natifs générés par `expo prebuild`.

### Constats

<a id="arch-1"></a>**ARCH-1 🟠 Élevé — Règles IBP et contrats dupliqués entre l'API et le mobile.**
- `api/src/surveys/ibp-rules.service.ts:220-378` et `mobile/src/app/ibp-scoring.ts:59-195` sont des copies quasi ligne à ligne.
- Elles ont **déjà divergé** : l'avertissement `factor_f_group_capped` n'existe que côté API.
- Aucun test ne vérifie que les deux implémentations donnent les mêmes résultats.
- Les types `mobile/src/app/types.ts` et `api/src/surveys/surveys.types.ts` dupliquent aussi les contrats.
- → Créer un workspace `packages/ibp-domain` : fonctions pures, clés de facteurs, types de contrat. En attendant, ajouter une *fixture* de parité partagée, exécutée des deux côtés.

<a id="arch-2"></a>**ARCH-2 🟡 Moyen — `SurveysService` fait trop de choses (1 570 lignes, 27 % de l'API).**
- Il couvre le CRUD, la soumission, les événements, la carte publique, la résolution de parcelles, un **deuxième client IGN WFS** (l. 969-1140, en parallèle de `CadastreProviderService`) et le nettoyage du stockage.
- Le client S3 est instancié trois fois, avec des buckets par défaut différents : `ibp-media` dans `surveys.service.ts:73` et `surveys-attachments.service.ts:39`, `ibp-surveys` dans `users.service.ts:58`.
- `getSurveyForUser` et `insertEvent` sont dupliqués.
- La configuration est lue via 58 accès `process.env` répartis dans 12 fichiers, sans validation au démarrage.
- → Découper en `SurveysRepository`, `ParcelsService` (fusion des deux chemins cadastre), `PublicMapService` et `SurveyEventsService`. Ajouter un `StorageService` et `@nestjs/config` avec un schéma.

<a id="arch-3"></a>**ARCH-3 🟠 Élevé — Aucune transaction sur les écritures multi-étapes.**
- **API :** l'upsert, le patch, la soumission, la suppression, les pièces jointes et les signalements s'exécutent en autocommit, requête par requête. Seuls `deleteAccount` et le module debug utilisent `BEGIN`/`COMMIT`.
  - Scénario : l'`UPDATE` du relevé est commité, puis `insertEvent` échoue. Le client rejoue avec la même `sync_version`, tombe sur le retour anticipé « déjà synchronisé » (`surveys.service.ts:304`), et l'événement n'est jamais écrit.
  - Conséquence : le changement n'apparaît jamais dans `/sync/changes`, et les autres appareils ne le reçoivent pas.
- **Mobile :** `withTransactionAsync` n'est utilisé nulle part. `applyRemoteChanges` (`sync.ts:223-370`), `updateLocalDraft` (`surveys.ts:342-372`) et `queueSurveyVisibilityChange` peuvent laisser des états incohérents après un crash.
- → API : ajouter un helper `db.transaction(fn)` et un garde optimiste `AND sync_version < $n` dans l'`UPDATE`. Mobile : envelopper les écritures composées dans `withTransactionAsync`.

<a id="arch-4"></a>**ARCH-4 🟡 Moyen — Couche d'état mobile en entonnoir de props.**
- `useSurveySync` renvoie environ 63 champs, recréés à chaque rendu.
- `AuthenticatedAppNavigation` reçoit des objets entiers typés `ReturnType<…>`, plus une vingtaine de props. `SurveyListScreen` prend 29 props.
- Résultat : couplage fort et re-rendus globaux (voir M-P1).
- → Créer 2 ou 3 contextes (session, sync, dépôt de relevés) et séparer chaque écran en conteneur et composant de présentation.

<a id="arch-5"></a>**ARCH-5 🟡 Moyen — Stockage mobile sans versionnage de schéma.**
- Les `ALTER TABLE … ADD COLUMN` ignorent toutes leurs erreurs (`db.ts:98-130`).
- Le type d'une opération de la file est déduit de la forme de son JSON : il n'y a pas de colonne dédiée.
- `syncPending` appelle `fetch` directement au lieu de passer par `api/client.ts`, donc sans timeout ni `ApiError` typée.
- → Migrations via `PRAGMA user_version`, colonne `op_type`, passage par le client HTTP.

<a id="arch-6"></a>**ARCH-6 🟡 Moyen — Ordre et conflits de sync.**
- Le flux `/sync/changes` pagine sur `(created_at, id)` d'événements insérés en autocommit. Un événement horodaté plus tôt mais commité plus tard peut être sauté.
- Le cas B (même `sync_version`) est traité comme un rejeu idempotent sans comparer le contenu. Si deux appareils du même utilisateur produisent chacun une version N+1, les modifications du second sont silencieusement perdues.
- → Paginer sur une séquence monotone (`bigserial`) et utiliser un hash de contenu, ou une version attribuée par le serveur.

<a id="arch-7"></a>**ARCH-7 🟢 Faible — Hygiène du monorepo.**
- `App.tsx` à la racine n'est utilisé nulle part.
- Le `package.json` racine déclare `expo`, `react` et `react-native` en dépendances.
- Le `tsconfig.json` racine étend `expo/tsconfig.base`.
- Plusieurs dépendances sont inutilisées ou mal placées :
  - `bcryptjs`, `@nestjs/schedule` ;
  - `EmailService`, qui n'est enregistré dans aucun module ;
  - `REFRESH_TOKEN_SECRET`, jamais lu ;
  - `@expo/ngrok`, déclaré en dépendance runtime ;
  - deux bibliothèques d'onglets.
- Les migrations sont forward-only, sans verrou consultatif (acceptable avec une seule instance). Des tables `auth_sessions` antérieures à Auth0 sont toujours présentes.

<a id="arch-8"></a>**ARCH-8 🟢 Faible — `CLAUDE.md` n'est plus à jour.**

| Sujet | `CLAUDE.md` | Code |
|---|---|---|
| React Native | 0.81.5 | 0.86.3 |
| Expo | 54 | 57.0.24 |
| react-native-maps | 1.20 | 1.27.2 |
| Endpoint de sync | `POST /surveys/sync` | `POST /v1/sync` |
| Table de métadonnées | `app_metadata` | `local_meta` |
| Convention de tests API | `*.test.ts` | `api/test/*.spec.ts` |
| Étapes de la CI | typecheck présent | **absent** (voir CI-1) |

---

## 3. Qualité du code

### 3.1 API

**Points forts :**
- 100 % du SQL est paramétré ; les fragments dynamiques viennent uniquement de constantes.
- `ValidationPipe` global avec `whitelist` et `forbidNonWhitelisted`.
- Helmet activé.
- JWKS mis en cache et limité en débit.
- `/userinfo` n'est appelé qu'à la première connexion.
- Les appels IGN ont un timeout.

<a id="a-c1"></a>**A-C1 🔴 Critique — Limite de débit globale de 10 requêtes/min, partagée par tous les utilisateurs.**
- `app.module.ts:17` fixe `limit: 10` en production (`NODE_ENV=production` dans `docker-compose.vps.yml`).
- Le compteur est indexé sur `req.ip`, mais `trust proxy` n'est jamais activé et toutes les requêtes arrivent par Caddy depuis `127.0.0.1`.
- Tous les clients partagent donc très probablement **un seul** compteur. Une seule sync avec photos (lot, création de pièce jointe, upload, confirmation, puis `/sync/changes`) suffit à l'épuiser. Les autres utilisateurs reçoivent alors des 429, que le client retente, ce qui aggrave la situation.
- → `app.set("trust proxy", 1)` (ou un suivi par utilisateur), une limite globale de 100 à 300/min, et des `@Throttle` ciblés sur `/sync`, `/public/*` et les uploads.

<a id="a-h1"></a>**A-H1 🟠 Élevé — Prise de contrôle de compte par e-mail (`auth.guard.ts:139-150`).**
- Quand le `sub` Auth0 est inconnu, le garde cherche l'utilisateur par l'e-mail renvoyé par `/userinfo` et fait `UPDATE users SET auth0_sub = $1 WHERE email = $2`.
- `email_verified` n'est vérifié nulle part dans le dépôt.
- Si le tenant permet l'inscription sans vérification de l'e-mail, s'inscrire avec l'adresse d'une victime donne accès à ses relevés.
- `users.service.ts:365-378` écrit aussi le nouvel e-mail en base **avant** sa vérification par Auth0.
- Enfin, deux premières requêtes simultanées font une course sur l'`INSERT`.
- → Exiger `email_verified === true`, ou supprimer la liaison maintenant que la migration Auth0 est terminée. Utiliser `INSERT … ON CONFLICT (auth0_sub)`.

<a id="a-h2"></a>**A-H2 🟠 Élevé — Les payloads de sync ne sont pas validés, et l'upsert contourne la soumission.**
- `SyncBatchBody` est un simple type, pas une classe, donc `ValidationPipe` n'a aucun effet sur `POST /v1/sync`, le chemin d'écriture principal de l'app. Chaque payload est ensuite casté `as SurveyUpsertBody` (`surveys-sync.service.ts:60-63`).
- `upsertForUser` écrit `body.status ?? existing.status` (`surveys.service.ts:338`) et accepte donc `submitted`. Cela contourne :
  - `validateSubmit` ;
  - le contrôle de version de parcelle ;
  - le délai de 7 jours, puisque `expires_at` est fourni par le client.
- Contrairement à `patchSurvey`, l'upsert ne refuse pas de modifier un relevé déjà soumis.
- Des valeurs invalides (`expires_at: "abc"`) remontent en erreur PostgreSQL, qui est marquée *retryable* (voir A-M5).
- → DTO de classe par type d'opération (`@ValidateNested`, `@Type`) validés avec `plainToInstance` et `validate`. L'upsert doit refuser tout `status` autre que `draft`, ignorer `expires_at`, et appliquer les champs en lecture seule quand le relevé est `submitted`.

<a id="a-h3"></a>**A-H3 🟠 Élevé — Photos de profil perdues à chaque redéploiement (`users.service.ts:141-145`).**
- Elles sont toujours écrites sur le disque local (`ATTACHMENTS_UPLOAD_DIR`, `/tmp` par défaut), même en mode `minio`.
- Le conteneur n'a pas de volume, et le timer de déploiement le recrée à chaque nouvelle image.
- → Passer par le même stockage objet que les pièces jointes.

<a id="a-h4"></a>**A-H4 🟠 Élevé — Module debug toujours chargé.**
- `DebugModule` est importé sans condition. `POST /debug/test-token` émet des jetons HS256, protégé seulement par `NODE_ENV === "test"`.
- Le garde d'authentification bascule lui aussi en HS256 selon `NODE_ENV` (`auth.guard.ts:42`).
- Une seule variable d'environnement mal réglée suffit donc à ouvrir l'authentification.
- → Importer le module conditionnellement et isoler l'authentification de test dans un garde dédié aux tests.

**Moyens :**

<a id="a-m1"></a>
- **A-M1 — `syncSurveyParcels` avale les erreurs** (`surveys.service.ts:1305-1333`).
  - Toute erreur dont le message contient `survey_parcels` est ignorée, y compris les violations de clé étrangère et les deadlocks, alors que le `DELETE` a déjà été exécuté.
  - Le relevé perd ses parcelles sans que personne le sache. Code de compatibilité antérieur à la migration 009 : à supprimer.
- **A-M2 — `parcel_ids` sans limite.**
  - Chaque ID coûte 1 à 2 requêtes séquentielles et peut insérer une parcelle `manual`.
  - Une requête avec 10 000 IDs coûte environ 20 000 allers-retours et crée 10 000 parcelles parasites.
  - → `@ArrayMaxSize(20)`, validation du format par regex, et un `INSERT … SELECT unnest(...) ON CONFLICT` en lot.
- **A-M3 — La clé de stockage des pièces jointes peut sortir du dossier d'upload** (`surveys-attachments.service.ts:192,286`).
  - En mode local, un `surveyId` de la forme `../../x` écrit en dehors du dossier.
  - → Exiger des UUID pour les IDs, ou vérifier le chemin résolu.
- **A-M4 — La taille d'upload n'est pas contrôlée en mode MinIO.**
  - L'URL présignée ne fixe pas de `ContentLength`, et le `HeadObject` de confirmation ne compare pas la taille réelle à `size_bytes`.
- **A-M5 — Les erreurs déterministes sont retentées, et leur contenu fuit** (`sync-error.utils.ts:15,70`).
  - Toute erreur `pg` est marquée *retryable* et son message brut est renvoyé au client (noms de contraintes, `surveys_pkey`).
  - → Mapper les codes 22xxx et 23xxx vers une erreur fatale avec un message générique.
- **A-M6 — L'identité du signaleur est visible par la personne signalée.**
  - L'événement `reported` (`reports.service.ts:56-60`) contient `actor_id` et `reason`, et le propriétaire du relevé peut le lire via `/surveys/:id/events`.
- **A-M7 — Soumissions concurrentes sur une même parcelle.**
  - Deux soumissions simultanées calculent le même numéro de version. La seconde provoque une erreur 23505 non mappée, donc un 500.
  - → `SELECT … FOR UPDATE`, ou mapper 23505 vers un 409.
- **A-M8 — Pool `pg` non configuré** (`database.service.ts:9-15`).
  - Pas de `max`, pas de `statement_timeout`, et **pas de listener `pool.on("error")`** : une erreur sur un client inactif fait planter le processus.
  - Des valeurs par défaut silencieuses sont utilisées : `ibp/ibp`, `minio/minio123`, `AUTH0_AUDIENCE` vide.
- **A-M9 — Ordre de suppression de compte.** L'utilisateur Auth0 est supprimé **avant** la transaction en base. Si la transaction échoue, la personne ne peut plus se connecter mais ses données restent.

**Faibles :**
- `isAllowedMimeType` utilise l'opérateur `in` (`common/file.utils.ts:16`), donc `"constructor"` est accepté.
- CORS est en `origin: true` avec `credentials: true`, car `CORS_ORIGIN` est vide dans `infra/vps/env.example`.
- Le motif d'un signalement n'a pas de `MaxLength`.
- `console.error` est appelé sur chaque échec d'authentification, et il n'y a pas de `Logger` Nest dans les services.

### 3.2 Mobile

**Points forts :**
- SQL paramétré.
- Les payloads de la file sont protégés par des *type guards*.
- `client.ts` a un vrai timeout (`AbortController`).
- Les réponses obsolètes sont ignorées et les requêtes sont *debouncées* dans les hooks carte et parcelles.
- Les jetons sont stockés dans le trousseau via le `credentialsManager` Auth0.
- Très peu de `any`, et les règles `react-hooks` sont actives.

<a id="m-c1"></a>**M-C1 🔴 Critique — Un échec de rafraîchissement du jeton efface toutes les données terrain non synchronisées.**
- La chaîne vérifiée :
  1. `useAuth0Session.ts:84-95` : `getValidAccessToken` capture **toute** erreur de `credentialsManager.getCredentials()`, y compris une erreur réseau, et renvoie `null`.
  2. `withAuthRetry` lève alors `AUTH_REQUIRED` (l. 99-100).
  3. `useSurveySyncNetwork.ts:59-60` intercepte cette erreur et appelle `clearSession()`.
  4. `clearSession()` appelle `onSessionCleared`, c'est-à-dire `clearSurveySessionState` (`useSurveySync.ts:50-55`).
  5. `clearSurveySessionState` appelle **`clearLocalIbpData()`**, qui vide `sync_queue`, `local_attachments` et `local_surveys`.
- Au démarrage, la même chaîne se déclenche : le `catch` de la restauration de session (l. 182-186) appelle aussi `clearSession()`.
- Scénario : un·e écologue ouvre l'app en forêt avec un jeton d'accès expiré, ou avec un réseau faible que le téléphone considère comme disponible. **Tous les relevés non synchronisés sont détruits, sans avertissement.**
- La déconnexion (l. 307-317) vide aussi la file sans prévenir qu'il reste des données à synchroniser.
- → Seul un rejet explicite du refresh token (`invalid_grant`, 401 ou 403 Auth0) doit signifier « authentification requise ». Une erreur réseau signifie « réessayer plus tard ». Les données locales ne doivent **jamais** être supprimées sur une erreur de session, uniquement sur une déconnexion explicite, confirmée après avoir affiché ce qui n'est pas synchronisé. Test de non-régression prioritaire.

<a id="m-h1"></a>**M-H1 🟠 Élevé — Courses dans la file de sync.**
- **Drains concurrents.** `runSync` est protégé par `syncInProgressRef`, mais `handleDeleteAttachment` (`useSurveySyncSurveyOperations.ts:390`) et `updateSurveyVisibility` (`sync.ts:1106`) appellent `syncPending` directement, et `handlePullChanges` ignore le verrou. Deux drains simultanés peuvent envoyer deux fois la même opération : pièces jointes en double, ou 409 menant à tort à `sync_blocked`.
- **Écrasement d'une édition récente.** L'autosave (900 ms) déclenche une sync. Si l'utilisateur modifie le relevé pendant l'aller-retour réseau, la réponse à l'ancienne ligne de file passe quand même le relevé en `sync_state='synced'` (`markSurveyQueueRowSynced`, `sync.ts:46-64`), alors qu'une nouvelle ligne est en attente. Comme la soumission se fie à `sync_state`, on peut soumettre la version antérieure.
- → Un *single-flight* au niveau du module dans `syncPending` et `pullRemoteChanges`. Ne marquer `synced` que s'il ne reste aucune autre ligne pour ce relevé, dans une transaction.

<a id="m-h2"></a>**M-H2 🟠 Élevé — Photos fragiles et trop lourdes.**
- L'URI renvoyée par ImagePicker pointe vers le **cache**, que l'OS peut purger pendant plusieurs jours hors ligne.
- Les échecs d'upload, y compris réseau, comptent pour le plafond de 8 essais (environ 15 min), après quoi la ligne est **supprimée**.
- Aucun redimensionnement : les photos partent en 3 à 5 Mo.
- `uploadFileDirect` charge tout le fichier en mémoire.
- `size_bytes` prend une valeur fictive de 500 000 quand il manque.
- → Copier les photos dans `documentDirectory` (expo-file-system), les redimensionner à 2 048 px en JPEG 0,7 (expo-image-manipulator), et ne pas compter les erreurs réseau dans le plafond.

<a id="m-h3"></a>**M-H3 🟠 Élevé — Bbox « parcelles proches » inversée.**
- `useNearbyParcels.ts:73` construit `minLng,maxLng,minLat,maxLat`, alors que l'API attend `minLng,minLat,maxLng,maxLat`, comme le produit `map-viewport.ts:35`.
- En France, la requête couvre un rectangle démesuré et ne renvoie rien au nord du 46° parallèle.

<a id="m-h4"></a>**M-H4 🟠 Élevé — Lots de sync sans découpage.**
- `syncPending` envoie **toutes** les lignes en attente dans un seul `POST /sync` (`sync.ts:650-656`, aucun `LIMIT`).
- L'API rejette les lots de plus de 100 opérations (`surveys-sync.service.ts:41`).
- Après une longue journée hors ligne, avec une opération par photo, le lot est rejeté en 400 à chaque tentative et finit bloqué.
- → Envoyer des lots de 100 au plus.

<a id="m-h5"></a>**M-H5 🟠 Élevé — Outils de développement présents en production.**
- `SettingsScreen.tsx:219-238` n'est pas conditionné par `__DEV__`.
- N'importe quel utilisateur peut changer l'URL de l'API, qui reçoit alors son jeton *bearer*, ou déclencher « Vider la base utilisateur ».

**Moyens :**
- **Le plafond de retry documenté ne s'applique pas aux relevés.** Le code calcule `terminalOverride ?? …` (`sync.ts:421`), et les appelants passent `terminalOverride: false` (l. 814 et 898). Comme `false ?? x` vaut `false`, les erreurs non fatales sur les relevés sont retentées indéfiniment. C'est contraire à la doc (8 essais puis `sync_blocked`).
- **Pas de timeout sur les `fetch` de `sync.ts`.** Une socket bloquée laisse `syncInProgressRef` à `true` jusqu'au redémarrage de l'app.
- **Un pull peut écraser des modifications non synchronisées.** Après un échec terminal, la ligne de file est supprimée, puis `applyRemoteChanges` écrase le payload local.
- **Le retry sur 401 réutilise le même jeton.** `getCredentials()` est rappelé sans `forceRefresh`.
- **L'autosave peut être sauté.** Si une sauvegarde est déjà en cours quand le timer se déclenche, le timer ne se reprogramme pas (`useEditingDraft.ts:58-60`).
- **IDs non uniques.** `survey-${Date.now()}` et `attachment-${Date.now()}-${rand(1000)}`, alors que la clé primaire côté serveur est globale. → Utiliser `crypto.randomUUID()`.
- **Pièces jointes distantes stockées avec `local_uri=""`** (`sync.ts:331`) : les photos récupérées du serveur ne sont jamais affichables.

**Faibles :**
- Des stubs d'authentification morts restent : `handleVerifyEmail`, `refreshToken: ""`.
- `useNavigation() as any` dans `AuthenticatedAppNavigation.tsx:601`.
- Les textes mélangent français et anglais, et les messages d'état exposent des IDs et du texte technique.
- Accessibilité : `SurveyDetailScreen` a 9 `Pressable` sans aucune prop d'accessibilité, `PublicMapScreen` 5 et `SurveyFormScreen` 6.

---

## 4. Efficience

### API
| Constat | Coût | Recommandation |
|---|---|---|
| Lot de sync traité séquentiellement, environ 8 + 2×(nb parcelles) allers-retours par upsert (`surveys-sync.service.ts:47-191`) | Un lot de 100 opérations représente plus de 1 000 requêtes | Parcelles en lot (`unnest`), une transaction par opération, suppression des `SELECT *` |
| Aucun index pour `status='submitted' AND visibility='public' AND deleted_at IS NULL` | Chaque appel public parcourt tous les relevés publics et applique une fonction de fenêtre | Index partiel `(submitted_at DESC) WHERE …` |
| Bbox sur `parcels.centroid` en JSON (l. 881-887) | Chaque déplacement de la carte parcourt toute la table `parcels` | Colonnes générées `lat`/`lng` avec index btree, ou PostGIS |
| `survey_events(actor_id)` non indexé | Suppression de compte lente | Ajouter l'index |
| Index redondants (`idx_users_auth0_sub`, `idx_surveys_parcel_id`, `idx_survey_parcels_survey_id`) | Écritures plus lentes | Supprimer |
| IGN : pas de cache, jusqu'à 1 200 entités par déplacement, `response.json()` sans timeout | Latence et dépendance externe | Cache LRU par tuile, timeout couvrant la lecture du corps |
| `listForUser`, `getEvents`, `listReports` et le fallback de `/sync/changes` sans `LIMIT` ; ce fallback renvoie à chaque poll les relevés sans événement | Réponses de taille croissante | Pagination par curseur |
| `SELECT *` pour les contrôles de propriété (`surveys.service.ts:1255`) | Charge des JSON volumineux pour rien | `SELECT id, user_id, status` |

### Mobile
| Constat | Coût | Recommandation |
|---|---|---|
| `useSurveySync` renvoie un objet d'environ 45 à 63 clés, nouveau à chaque rendu ; aucun `React.memo` ; écrans en *render props* | Chaque `setStatus` re-rend tous les onglets montés, y compris la `MapView` et la liste | Contextes et `useMemo`, `React.memo` sur les éléments de liste et les marqueurs |
| Aucune `FlatList` : `SurveyListScreen.tsx:992` fait un `map` dans un `ScrollView`, avec des `Swipeable` et des closures en ligne | Temps de rendu linéaire en nombre de relevés, mémoire | `FlatList` ou `FlashList` avec `keyExtractor` et éléments mémoïsés |
| Miniatures et carrousel décodés en pleine résolution | Mémoire, saccades | `expo-image` et vignettes redimensionnées |
| `listLocalSurveys` relit toute la table et parse chaque payload JSON à chaque autosave | Consommation CPU et batterie sur le terrain | Colonne de complétude précalculée, rafraîchissement ciblé |
| Pas de transaction SQLite : un pull de 50 relevés fait environ 200 commits | E/S disque | `withTransactionAsync`, mode WAL |
| Index SQLite manquants : `sync_queue(survey_id)`, `sync_queue(status, next_retry_at)` | Faible aujourd'hui | Ajouter |
| Carte publique : pas de bbox, pas de clustering, `onRegionChangeComplete={setMapRegion}` re-rend tous les marqueurs | Saccades au-delà de quelques centaines de points | Bbox, clustering, marqueurs mémoïsés |

---

## 5. Couverture et qualité des tests

**Points positifs :** 470 tests passent de façon déterministe. On ne trouve ni snapshot, ni `.only`, ni `.skip`, ni appel réseau réel, et les *fake timers* sont limités. Les tests unitaires sont placés à côté du code.

**Constats :**
1. **Pas de seuil de couverture.** Aucune `coverageThreshold` dans les trois configurations Jest, et la CI ne lance jamais `--coverage`. La couverture peut donc baisser sans que personne s'en aperçoive.
2. **Les modules les plus risqués sont les moins testés** (voir §1) : `useAuth0Session` (0 %, où se trouve le bug M-C1), les chemins de retry et de blocage de `sync.ts`, le chemin RS256 du garde d'authentification, les pièces jointes, et tous les écrans.
3. **Tests d'implémentation plutôt que de comportement.**
   - `mobile/test/expo-sqlite.mock.ts` remplace SQLite par des espions, et `storage.test.ts` vérifie des fragments de SQL. Aucune requête n'est réellement exécutée, donc une requête cassée passe les tests.
   - Les tests de hooks (`useSurveySync.test.ts`) espionnent `React.useState`, `useCallback` et `useEffect` au lieu d'utiliser `renderHook`. Ils cassent au moindre refactoring et ne détectent pas les bugs d'ordre d'effets.
4. **`jest.unit.config.js` (mobile) :** `testMatch: ['**/*.test.ts']` ignore les fichiers `.test.tsx`, et `moduleNameMapper` est **déclaré deux fois** (le premier bloc est écrasé silencieusement).
5. **Isolation E2E faible.**
   - La base n'est jamais nettoyée. L'unicité repose sur `Date.now()` et sur des coordonnées décalées de `Date.now() % 90000` (`surveys-idempotency.e2e-spec.ts:238,304,…`).
   - Sur une base locale persistante, les assertions sur la carte publique voient les données des exécutions précédentes.
   - `surveys-idempotency.e2e-spec.ts` est un fichier fourre-tout de 1 689 lignes.
6. **Aucun test de parité IBP** entre l'API et le mobile, alors que les deux implémentations ont déjà divergé.

**Plan de test recommandé, par ordre :**
1. Tests de non-régression M-C1 : une erreur réseau pendant le rafraîchissement ne doit rien effacer.
2. `sync.ts` contre un vrai SQLite en mémoire (`better-sqlite3` derrière le mock) : plafond de retry, `sync_blocked`, découpage en lots, concurrence.
3. `useAuth0Session` avec `renderHook` : rafraîchissement, 401, déconnexion.
4. Tests unitaires des branches de conflit de `surveys-sync.service.ts` et de l'upsert sur un relevé soumis (A-H2).
5. Fixture de parité IBP partagée, exécutée des deux côtés.
6. Nettoyage de la base E2E (`TRUNCATE … CASCADE` en `beforeAll`), `randomUUID()`, découpage de la suite par fonctionnalité.
7. Seuils de couverture par dossier fixés aux valeurs actuelles (effet cliquet), puis relevés progressivement.

---

## 6. Efficience de la CI

**Mesure :** un run type (GitHub Actions, run 35644226949) prend 60 à 80 s de bout en bout, pour environ 3,5 minutes-runner réparties sur 5 jobs.
- `npm ci` prend 16 à 25 s **dans chacun des 4 jobs**, soit 50 à 60 % du temps facturé.
- Le démarrage du service Postgres prend 24 s.
- Le coût est faible. Les problèmes relèvent surtout de la **justesse** et de la **sécurité**.

<a id="ci-1"></a>**CI-1 🟠 Élevé — Le typecheck n'est pas exécuté.** `ci.yml` lance `lint` et `format:check`, mais jamais `npm run typecheck`, contrairement à ce qu'indique `CLAUDE.md`. Côté mobile, rien d'autre ne compile les fichiers que les tests n'importent pas, comme les écrans. Une PR avec des erreurs de type peut donc être fusionnée.

<a id="ci-2"></a>**CI-2 🟠 Élevé — Image de production non reproductible et publiable depuis n'importe quelle branche.**
- `api/Dockerfile` fait `COPY package*.json`, puis `npm install`, dans `./api`, où il n'y a **pas** de lockfile. Les plages `^` sont donc résolues à nouveau à chaque build, et les `overrides` racine (par exemple `multer`) ne s'appliquent pas. On teste un arbre de dépendances et on en déploie un autre.
- Pas de `.dockerignore`, et le runtime tourne en root, sans `HEALTHCHECK`.
- `workflow_dispatch` peut être lancé depuis n'importe quelle branche, et le job `build` pousse alors `:latest`, que le timer du VPS déploie dans les 5 minutes.
- L'image n'a que le tag `:latest` : pas de tag SHA pour revenir en arrière.
- Pas de groupe `concurrency` : deux runs sur `main` à 11 s d'intervalle ont déjà été observés.
- Le filtre `api/**` ignore les modifications du lockfile racine.
- → `context: .`, `file: api/Dockerfile`, `npm ci --workspace api --omit=dev`, `USER node`, `.dockerignore`, `if: github.ref == 'refs/heads/main'`, tags `latest` et `sha-${{ github.sha }}`, concurrence de déploiement avec `cancel-in-progress: false`.

**CI-3 🟡 Moyen — Pas de filtrage par chemin sur les tests.** Une PR qui ne touche que la doc ou le mobile démarre Postgres et lance l'E2E API. Le job `changes` est ignoré sur les PR (`if: github.event_name != 'pull_request'`).

**CI-4 🟡 Moyen — Moindre privilège et robustesse.**
- Pas de bloc `permissions:` au niveau du workflow.
- Actions épinglées par tag plutôt que par SHA, alors que `dorny/paths-filter` est une action tierce.
- Aucun `timeout-minutes` : un job bloqué peut tourner jusqu'à 6 h.
- Pas de `concurrency` avec `cancel-in-progress` sur les PR.

**CI-5 🟡 Moyen — Contrôles manquants.**
- Pas de couverture en CI ni de seuils.
- Pas de `npm audit` ni de CodeQL.
- **Pas de contrôle du build mobile** (`expo-doctor`, `expo export`). Les trois derniers correctifs mobiles (#116, #119, #120) portaient tous sur des casses Metro ou prebuild que les tests ne pouvaient pas détecter.

**CI-6 🟢 Faible.**
- La sonde de santé Postgres passe toutes les 10 s ; 2 s accélérerait le démarrage.
- Fusionner lint, format et typecheck dans un seul job économise un `npm ci`.
- Mettre `node_modules` en cache (clé : hash du lockfile) ferait gagner environ 15 s par job.

### Esquisse de workflow cible

```yaml
on: { push: { branches: [main] }, pull_request: { branches: [main] }, workflow_dispatch: }
permissions: { contents: read }
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  changes:        # toujours exécuté, y compris sur les PR
    outputs: { api, mobile }   # api/**, mobile/**, + package-lock.json, workflows, configs partagées
  check:          # un seul npm ci : lint + format:check + typecheck — timeout-minutes: 10
  unit:           # matrix [api, mobile], ignoré si le workspace n'a pas changé, --coverage + seuils
  e2e:            # si api a changé ; postgres --health-interval 2s — timeout-minutes: 15
  mobile-build:   # si mobile a changé ; npx expo-doctor && npx expo export --platform android
  ci-ok:          # agrège les résultats (protection de branche compatible avec les jobs ignorés)
  build:          # main uniquement ; context: . ; tags latest + sha ; concurrency deploy (sans annulation)
```

---

## 7. Feuille de route proposée

| Horizon | Contenu |
|---|---|
| **Immédiat (sécurité / perte de données)** | M-C1, A-C1, A-H1, A-H2, M-H5, A-H4, avec un test de non-régression pour chacun |
| **Court terme (1 à 2 sprints)** | Transactions API et SQLite (ARCH-3), mutex de sync, lots ≤ 100, photos persistées et redimensionnées (M-H1 à M-H4), typecheck et image reproductible en CI (CI-1, CI-2), plafond de retry corrigé |
| **Moyen terme** | Paquet `ibp-domain` partagé (ARCH-1), découpage de `SurveysService` (ARCH-2), `@nestjs/config`, contextes React avec `FlatList` et mémoïsation (ARCH-4), index Postgres, seuils de couverture, filtrage par chemin et `expo-doctor` en CI |
| **Fond** | Séquence monotone pour `/sync/changes` (ARCH-6), migrations SQLite versionnées (ARCH-5), i18n, accessibilité, mise à jour de `CLAUDE.md` (ARCH-8) |

---

## 8. Statut

Cette section relie chaque constat à la phase de remédiation qui le traite et à la ou les PR qui l'ont fusionné. Les PR ont été retrouvées dans l'historique Git : chaque fusion de `main` a été rattachée aux plans (`01.x-NN`) de ses commits, puis chaque constat à sa phase via la matrice de traçabilité du plan de remédiation (§6) et la ligne « Source » de chaque phase dans la feuille de route. La phase 01.2 commence à #125 : ses deux premiers plans (limite de débit, identité) ont été fusionnés dans #125 et #126. Les PR de vérification et de clôture de chaque phase (#130 à #133, #141 à #144, #146 à #149, #151 à #153, #155, #157) ne contiennent que de la documentation et ne sont pas répétées ci-dessous. Les constats des phases 01.8 et 01.9 sont « en attente » : le plan de clôture 01.9-32 complétera leurs liens.

| Réf. | Constat (court) | Phase | PR |
|---|---|---|---|
| [ARCH-1](#arch-1) | Règles IBP et contrats dupliqués | 01.8 | en attente |
| [ARCH-2](#arch-2) | `SurveysService` trop gros, S3 ×3, `process.env` épars | 01.6, 01.7 | [#154](https://github.com/florianlepont/cortege/pull/154), [#156](https://github.com/florianlepont/cortege/pull/156) |
| [ARCH-3](#arch-3) | Transactions : API | 01.4 | [#145](https://github.com/florianlepont/cortege/pull/145) |
| [ARCH-3](#arch-3) | Transactions : SQLite mobile | 01.5 | [#150](https://github.com/florianlepont/cortege/pull/150) |
| [ARCH-4](#arch-4) | Couche d'état mobile en entonnoir de props | 01.9 | en attente |
| [ARCH-5](#arch-5) | Schéma SQLite non versionné, `op_type`, `fetch` direct | 01.5 | [#150](https://github.com/florianlepont/cortege/pull/150) |
| [ARCH-6](#arch-6) | Ordre du flux `/sync/changes` et cas B | 01.6 | [#154](https://github.com/florianlepont/cortege/pull/154) |
| [ARCH-7](#arch-7) | Hygiène : `REFRESH_TOKEN_SECRET`, tables `auth_sessions`, verrou de migration | 01.7 | [#156](https://github.com/florianlepont/cortege/pull/156) |
| [ARCH-7](#arch-7) | Hygiène : `App.tsx` et dépendances racine, dépendances inutiles, bibliothèques d'onglets | 01.9 | en attente |
| [ARCH-8](#arch-8) | `CLAUDE.md` obsolète | 01.9 | en attente |
| [A-C1](#a-c1) | Limite de débit globale partagée | 01.2 | [#125](https://github.com/florianlepont/cortege/pull/125), [#129](https://github.com/florianlepont/cortege/pull/129) |
| [A-H1](#a-h1) | Liaison de compte par e-mail non vérifié | 01.2 | [#126](https://github.com/florianlepont/cortege/pull/126), [#129](https://github.com/florianlepont/cortege/pull/129) |
| [A-H2](#a-h2) | `/sync` non validé, contournement de la soumission | 01.4 | [#145](https://github.com/florianlepont/cortege/pull/145) |
| [A-H3](#a-h3) | Photos de profil perdues au redéploiement | 01.6 | [#154](https://github.com/florianlepont/cortege/pull/154) |
| [A-H4](#a-h4) | Module debug toujours chargé, HS256 | 01.2 | [#128](https://github.com/florianlepont/cortege/pull/128) |
| [A-M1](#a-m1) | `syncSurveyParcels` avale les erreurs | 01.4 | [#145](https://github.com/florianlepont/cortege/pull/145) |
| A-M2 | `parcel_ids` sans limite : validation | 01.4 | [#145](https://github.com/florianlepont/cortege/pull/145) |
| A-M2 | `parcel_ids` sans limite : écriture en lot | 01.7 | [#156](https://github.com/florianlepont/cortege/pull/156) |
| A-M3 | Clé de stockage hors du dossier d'upload | 01.6 | [#154](https://github.com/florianlepont/cortege/pull/154) |
| A-M4 | Taille d'upload non contrôlée (MinIO) | 01.6 | [#154](https://github.com/florianlepont/cortege/pull/154) |
| A-M5 | Erreurs déterministes retentées, détails exposés | 01.4 | [#145](https://github.com/florianlepont/cortege/pull/145) |
| A-M6 | Identité du signaleur visible | 01.2 | [#126](https://github.com/florianlepont/cortege/pull/126) |
| A-M7 | Soumissions concurrentes sur une parcelle | 01.4 | [#145](https://github.com/florianlepont/cortege/pull/145) |
| A-M8 | Pool `pg` et configuration | 01.7 | [#156](https://github.com/florianlepont/cortege/pull/156) |
| A-M9 | Ordre de suppression de compte | 01.4 | [#145](https://github.com/florianlepont/cortege/pull/145) |
| §3.1 Faible | `in` dans `isAllowedMimeType` | 01.6 | [#154](https://github.com/florianlepont/cortege/pull/154) |
| §3.1 Faible | CORS permissif | 01.7 | [#156](https://github.com/florianlepont/cortege/pull/156) |
| §3.1 Faible | Motif de signalement sans `MaxLength` | 01.2 | [#126](https://github.com/florianlepont/cortege/pull/126) |
| §3.1 Faible | `console.error`, pas de `Logger` Nest | 01.7 | [#156](https://github.com/florianlepont/cortege/pull/156) |
| [M-C1](#m-c1) | Effacement des données sur erreur de session | 01.2 | [#127](https://github.com/florianlepont/cortege/pull/127), [#128](https://github.com/florianlepont/cortege/pull/128), [#129](https://github.com/florianlepont/cortege/pull/129) |
| [M-H1](#m-h1) | Drains concurrents, écrasement d'une édition | 01.5 | [#150](https://github.com/florianlepont/cortege/pull/150) |
| [M-H2](#m-h2) | Photos fragiles et trop lourdes | 01.5 | [#150](https://github.com/florianlepont/cortege/pull/150) |
| [M-H3](#m-h3) | Bbox « parcelles proches » inversée | 01.2 | [#127](https://github.com/florianlepont/cortege/pull/127) |
| [M-H4](#m-h4) | Lots de sync sans découpage | 01.5 | [#150](https://github.com/florianlepont/cortege/pull/150) |
| [M-H5](#m-h5) | Outils de développement en production | 01.2 | [#127](https://github.com/florianlepont/cortege/pull/127) |
| §3.2 Moyen | Plafond de retry inopérant (`terminalOverride`) | 01.5 | [#150](https://github.com/florianlepont/cortege/pull/150) |
| §3.2 Moyen | `fetch` de sync sans timeout | 01.5 | [#150](https://github.com/florianlepont/cortege/pull/150) |
| §3.2 Moyen | Pull qui écrase des modifications non synchronisées | 01.5 | [#150](https://github.com/florianlepont/cortege/pull/150) |
| §3.2 Moyen | Retry 401 sans `forceRefresh` | 01.2 | [#127](https://github.com/florianlepont/cortege/pull/127) |
| §3.2 Moyen | Autosave sauté | 01.5 | [#150](https://github.com/florianlepont/cortege/pull/150) |
| §3.2 Moyen | IDs non uniques | 01.5 | [#150](https://github.com/florianlepont/cortege/pull/150) |
| §3.2 Moyen | Pièces jointes distantes avec `local_uri=""` | 01.5 | [#150](https://github.com/florianlepont/cortege/pull/150) |
| §3.2 Faible | Stubs d'authentification morts | 01.2 | [#128](https://github.com/florianlepont/cortege/pull/128) |
| §3.2 Faible | `useNavigation() as any` | 01.9 | en attente |
| §3.2 Faible | Textes FR/EN, messages techniques | 01.9 | en attente |
| §3.2 Faible | Accessibilité des `Pressable` | 01.9 | en attente |
| §4 API | Sync séquentielle, nombre de requêtes | 01.7 | [#156](https://github.com/florianlepont/cortege/pull/156) |
| §4 API | Index partiel des relevés publics | 01.7 | [#156](https://github.com/florianlepont/cortege/pull/156) |
| §4 API | Bbox sur `centroid` JSON | 01.7 | [#156](https://github.com/florianlepont/cortege/pull/156) |
| §4 API | Index `survey_events(actor_id)` | 01.7 | [#156](https://github.com/florianlepont/cortege/pull/156) |
| §4 API | Index redondants | 01.7 | [#156](https://github.com/florianlepont/cortege/pull/156) |
| §4 API | IGN sans cache ni timeout sur le corps | 01.7 | [#156](https://github.com/florianlepont/cortege/pull/156) |
| §4 API | Fallback de `/sync/changes` non borné | 01.6 | [#154](https://github.com/florianlepont/cortege/pull/154) |
| §4 API | Listes sans `LIMIT` (`listForUser`, `getEvents`, `listReports`) | 01.7 | [#156](https://github.com/florianlepont/cortege/pull/156) |
| §4 API | `SELECT *` pour les contrôles de propriété | 01.7 | [#156](https://github.com/florianlepont/cortege/pull/156) |
| §4 Mobile | Re-rendus globaux (`useSurveySync`) | 01.9 | en attente |
| §4 Mobile | Pas de `FlatList` | 01.9 | en attente |
| §4 Mobile | Images décodées en pleine résolution | 01.5 | [#150](https://github.com/florianlepont/cortege/pull/150) |
| §4 Mobile | `listLocalSurveys` parse chaque payload | 01.9 | en attente |
| §4 Mobile | Pas de transaction SQLite ni de WAL | 01.5 | [#150](https://github.com/florianlepont/cortege/pull/150) |
| §4 Mobile | Index SQLite manquants | 01.5 | [#150](https://github.com/florianlepont/cortege/pull/150) |
| §4 Mobile | Carte : bbox, clustering, marqueurs | 01.9 | en attente |
| T1 (§5) | Pas de seuil de couverture | 01.3 | [#134](https://github.com/florianlepont/cortege/pull/134) |
| T2 (§5) | Modules à risque non testés : session, sync, pièces jointes | 01.2, 01.3, 01.5 | [#127](https://github.com/florianlepont/cortege/pull/127), [#134](https://github.com/florianlepont/cortege/pull/134), [#150](https://github.com/florianlepont/cortege/pull/150) |
| T2 (§5) | Chemin RS256 du garde non testé | 01.8 | en attente |
| T3 (§5) | Mock SQLite qui n'exécute rien | 01.3 | [#134](https://github.com/florianlepont/cortege/pull/134) |
| T3 (§5) | Tests de hooks qui espionnent React | 01.9 | en attente |
| T4 (§5) | `testMatch` sans `.tsx`, `moduleNameMapper` en double | 01.3 | [#134](https://github.com/florianlepont/cortege/pull/134) |
| T5 (§5) | Base E2E jamais nettoyée | 01.3 | [#134](https://github.com/florianlepont/cortege/pull/134) |
| T5 (§5) | Fichier E2E fourre-tout, `Date.now()` | 01.8 | en attente |
| T6 (§5) | Pas de test de parité IBP | 01.8 | en attente |
| [CI-1](#ci-1) | Typecheck absent de la CI | 01.3 | [#134](https://github.com/florianlepont/cortege/pull/134) |
| [CI-2](#ci-2) | Image non reproductible, `:latest` publiable partout | 01.3 | [#134](https://github.com/florianlepont/cortege/pull/134) |
| CI-3 | Pas de filtrage par chemin | 01.3 | [#134](https://github.com/florianlepont/cortege/pull/134) |
| CI-4 | Permissions, SHA, timeouts, concurrence | 01.3 | [#134](https://github.com/florianlepont/cortege/pull/134) |
| CI-5 | Couverture, audit, CodeQL, build mobile | 01.3 | [#134](https://github.com/florianlepont/cortege/pull/134) |
| CI-6 | Jobs fusionnés, cache, sonde Postgres | 01.3 | [#134](https://github.com/florianlepont/cortege/pull/134) |
| §6 | `npm audit` : vulnérabilités modérées | 01.3 | [#134](https://github.com/florianlepont/cortege/pull/134) |
