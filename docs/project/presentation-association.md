# Application IBP — Présentation du projet
### Etats Sauvages · Mai 2026

> **Note de statut — 22 septembre 2026.** Ce document reflète l'état et les hypothèses de mai 2026.
> Le périmètre du MVP a depuis été recentré sur un usage interne : la dimension communautaire
> (gamification, modération, carte publique, dons) passe au milestone suivant. La cible
> d'hébergement annoncée ici (alwaysdata + Cloudflare R2, ~346 €/an) n'est pas celle du plan en
> cours — voir `.planning/ROADMAP.md`. Les engagements RGPD et la position sur la propriété des
> données restent valides sur le fond ; les mentions d'hébergement qu'ils contiennent suivent la
> même réserve.

---

## 1. Pourquoi cette application ?

Aujourd'hui, les relevés IBP se font **sur papier ou dans des tableurs**, ce qui pose deux problèmes majeurs :

- Les données sont difficiles à centraliser et à exploiter — chaque observateur gère ses propres fichiers, sans vue commune ni historique par parcelle
- Les erreurs de saisie ne sont détectées qu'après le passage sur le terrain, trop tard pour corriger

**Notre application mobile IBP** résout ces problèmes : elle guide l'observateur facteur par facteur, valide les données en temps réel sur le terrain, et synchronise automatiquement les relevés vers une base commune dès le retour en zone couverte.

---

## 2. Comparaison avant / après

| Critère | Aujourd'hui (papier / tableur) | Avec l'appli IBP |
|---------|-------------------------------|-----------------|
| Saisie sur le terrain | Papier libre, risque d'oubli | Guidée facteur par facteur |
| Validation des données | Après coup, de retour au bureau | Immédiate, sur le terrain |
| Travail sans réseau | ✅ (papier) | ✅ (mode hors ligne natif) |
| Centralisation des relevés | Ressaisie manuelle dans un tableur | Automatique à la synchronisation |
| Photos liées au relevé | Fichiers séparés, difficiles à relier | Intégrées directement au relevé |
| Historique d'une parcelle | Recherche manuelle dans les archives | Affiché automatiquement avant chaque relevé |
| Risque de perte de données | Élevé (papier mouillé, fichier écrasé) | Nul — sauvegarde locale + cloud |
| Temps total (terrain + saisie) | ~2h (terrain) + ~30 min (ressaisie) | ~1h30 (terrain uniquement) |
| Exploitation / analyse future | Ressaisie dans tableur nécessaire | API disponible pour export et analyse |

---

## 3. À qui s'adresse-t-elle ?

| Public | Usage |
|--------|-------|
| **Écologues et observateurs de terrain** | Saisie des relevés IBP sur smartphone, hors réseau |
| **Coordinateurs Etats Sauvages** | Suivi des relevés soumis, consultation de l'historique par parcelle |
| **Membres et observateurs bénévoles** | Exploration de la carte des relevés, engagement via la gamification (points, badges, classement) — prévu en V1 |

---

## 4. Les grandes fonctionnalités

### 4.1 Saisie guidée des relevés IBP

L'application guide l'observateur à travers les **dix facteurs IBP (A à J)** un par un. Chaque facteur propose des choix adaptés à la réalité du terrain. Les règles de validation sont appliquées immédiatement au sein de chaque facteur : seules les options cohérentes avec les réponses déjà saisies sont proposées, et il est impossible de soumettre un relevé incomplet ou incohérent.

> **Exemple :** dans le facteur C (bois mort sur pied), si aucun bois mort n'est présent, les questions de volume et d'état ne sont pas posées — le score est fixé automatiquement.

### 4.2 Sélection cadastrale sur carte

Avant de commencer un relevé, l'observateur sélectionne la **parcelle cadastrale** directement sur une carte interactive. L'historique des scores précédents sur cette parcelle est affiché pour contexte.

### 4.3 Mode hors ligne complet

C'est un point clé : **l'application fonctionne entièrement sans réseau.** Toutes les données sont stockées localement sur l'appareil. Quand la connexion est rétablie, la synchronisation vers le serveur se déclenche automatiquement, avec gestion des erreurs et des tentatives automatiques.

### 4.4 Photos et pièces jointes

L'observateur peut photographier les éléments remarquables de la parcelle directement depuis l'application. Les photos sont associées au relevé et stockées de façon sécurisée.

### 4.5 Carte publique des relevés

Une carte nationale affiche les relevés soumis et validés (données anonymisées). Elle permet d'explorer l'état de la biodiversité potentielle à l'échelle de la France.

### 4.6 Compte sécurisé

Connexion via email/mot de passe ou compte Google/Apple. Les données de chaque observateur sont isolées et protégées.

### 4.7 Base de données nationale de la forêt française *(à venir)*

Chaque relevé soumis alimente une base de données centralisée. À terme, l'ensemble de ces données permettra de produire des **indicateurs agrégés à l'échelle nationale** : score IBP moyen par région, évolution dans le temps d'une parcelle, distribution des facteurs sur le territoire. Ces analyses constitueront un outil de plaidoyer et de suivi de l'état de la biodiversité forestière en France — unique en son genre pour une association citoyenne.

---

## 5. Où en sommes-nous ?

### État actuel — MVP en cours de finalisation

| Fonctionnalité | Logique métier | UX & Tests terrain |
|----------------|---------------|-------------------|
| Authentification (email, Google, Apple) | ✅ Fonctionnel | 🔵 À tester |
| Saisie des 10 facteurs IBP avec validation | ✅ Fonctionnel | 🔵 UX à finaliser, à tester |
| Sélection cadastrale sur carte | ✅ Fonctionnel | 🔵 UX à finaliser, à tester |
| Mode hors ligne + synchronisation automatique | ✅ Fonctionnel | 🔵 À tester |
| Photos et pièces jointes | ✅ Fonctionnel | 🔵 À tester |
| Carte publique des relevés | ✅ Fonctionnel | 🔵 À tester |
| Historique des scores par parcelle | ✅ Fonctionnel | 🔵 À tester |
| Gestion du profil utilisateur | ✅ Fonctionnel | 🔵 UX à finaliser, à tester |
| API backend sécurisée (serveur) | ✅ Fonctionnel | 🔵 À tester |
| Base de données | ⚠️ PoC fonctionnel | 🔵 Déploiement sur solution pérenne à faire |

Toute la logique métier est en place et fonctionne. La prochaine étape est la **finalisation de l'UX, les tests terrain avec de vrais observateurs, et le déploiement de la base de données sur une infrastructure de production**.

---

### Ce qui vient ensuite — V1

| Fonctionnalité | Description |
|----------------|-------------|
| Gamification (points, badges, classement) | Récompenser les observateurs actifs et encourager la participation |
| Signalement de relevés douteux | Permettre à la communauté de signaler des données suspectes |
| Section Etats Sauvages in-app | Présenter la mission de l'association et son impact |
| Bouton de don | Intégrer un flux de donation aux moments-clés de l'expérience |
| Interface de modération | Tableau de bord pour les coordinateurs |

---

### Horizon futur — V2

| Fonctionnalité | Description |
|----------------|-------------|
| Analyses régionales | Scores moyens IBP par région, filtres par année |
| Tendances par parcelle | Évolution du score dans le temps, graphiques |
| Distribution des facteurs | Visualisation agrégée des facteurs A–J par zone |

---

### Calendrier

| Étape | Période |
|-------|---------|
| 🔵 MVP finalisé (UX + déploiement base de données) | Septembre 2026 |
| 🔵 Tests terrain avec observateurs pilotes | Octobre – Décembre 2026 |
| 🔵 Publication App Store et Google Play | Janvier 2027 |
| 🔵 Version V1 (gamification, modération, section asso, don) | Courant 2027 |

---

## 6. Coûts de lancement et de fonctionnement

L'un des atouts du projet est son coût très contenu, notamment grâce aux programmes tarifaires réservés aux associations à but non lucratif.

### Lancement (frais uniques)

| Poste | Montant | Note |
|-------|---------|------|
| Apple App Store (iOS) | **0 €** | Programme gratuit pour les associations — Apple dispense les organisations à but non lucratif des frais d'inscription (99 $/an) |
| Google Play Store (Android) | ~23 € | Frais unique, non renouvelable |
| **Total lancement** | **~23 €** | |

### Fonctionnement annuel

| Poste | Montant/an | Détail |
|-------|-----------|--------|
| Hébergement serveur (alwaysdata) | ~72 € TTC | Plan Small : 1 Go RAM, 50 Go disque, Node.js + PostgreSQL inclus |
| Stockage photos (Cloudflare R2) | 0 € | 10 Go gratuits/mois — suffisant pour les premiers milliers de relevés |
| Authentification (Auth0) | 0 € | Gratuit jusqu'à 7 500 utilisateurs actifs/mois ; 50 % de réduction pour les associations si dépassement |
| Cadastre IGN | 0 € | API publique du gouvernement français |
| Nom de domaine | ~10 € | Déjà existant |
| Apple App Store (renouvellement) | **0 €** | Dispense reconduite chaque année |
| Assistant IA (Claude Pro) | ~264 € TTC | Outil de développement utilisé pour accélérer la conception et l'écriture du code — $20/mois, pas de réduction association connue |
| **Total annuel** | **~346 € TTC/an** | |

> En cas de forte croissance (plusieurs centaines d'utilisateurs actifs simultanément), le plan d'hébergement pourrait passer à l'échelon supérieur (~230 €/an), soit un total d'environ **500 €/an**.

---

## 7. Données personnelles et RGPD

L'application est conçue dans le respect du Règlement Général sur la Protection des Données (RGPD).

### Quelles données sont collectées ?

| Donnée | Finalité | Durée de conservation |
|--------|----------|----------------------|
| Email et nom | Identification du compte | Jusqu'à suppression du compte |
| Photo de profil | Affichage dans l'appli | Jusqu'à suppression du compte |
| Localisation GPS | Aide à la sélection de parcelle (non stockée en continu) | Durée du relevé uniquement |
| Données des relevés (facteurs IBP, photos terrain) | Constitution de la base de données biodiversité | Indéfiniment, anonymisées après suppression du compte |

### Où sont hébergées les données ?

Toutes les données sont hébergées **en Europe** :
- Serveur et base de données : **alwaysdata, Paris (France)**
- Authentification : **Auth0, région UE**
- Photos des relevés : stockage objet avec option hébergement **Union Européenne**

Aucune donnée n'est transmise à des tiers à des fins commerciales.

### Droits des utilisateurs

L'application intègre nativement :

- **Droit d'accès** — chaque observateur consulte ses propres relevés
- **Droit de rectification** — modification du profil et des relevés en cours
- **Droit à l'effacement** — suppression du compte depuis l'appli ; les données personnelles sont effacées, les relevés scientifiques sont anonymisés et conservés pour la base de données
- **Droit à la portabilité** — les données sont exportables via l'API

### Propriété des données

Les relevés IBP soumis appartiennent à **Etats Sauvages**. Les observateurs cèdent leurs données à l'association au moment de la soumission, ce qui est précisé dans les conditions d'utilisation.

---

## 8. La technique en quelques mots

*(Pour les curieux — pas indispensable pour valider le projet)*

### Une seule application pour iOS et Android

L'application mobile est développée en **React Native**, une technologie créée par Meta et utilisée par des acteurs comme Shopify ou Microsoft. Elle permet d'écrire le code une seule fois et de le faire tourner à la fois sur iPhone et Android, sans doubler le travail de développement.

### Le téléphone fonctionne comme un mini-serveur

Toutes les données de relevé sont d'abord stockées **directement sur l'appareil** dans une base de données locale (SQLite). L'application peut donc fonctionner sans aucune connexion. Quand le réseau revient, les données sont envoyées automatiquement vers le serveur central — sans que l'observateur n'ait à faire quoi que ce soit.

### Le serveur

Le serveur (appelé "API") tourne sur **Node.js** avec le framework **NestJS**, un standard robuste utilisé dans de nombreuses applications professionnelles. Il est hébergé chez **alwaysdata**, un hébergeur français basé à Paris. La base de données est **PostgreSQL**, une des solutions les plus fiables et les plus répandues au monde.

### La sécurité des connexions

L'authentification (login, création de compte, connexion Google/Apple) est déléguée à **Auth0**, un service spécialisé utilisé par des milliers d'entreprises. Cela évite de gérer soi-même les mots de passe et réduit considérablement les risques de sécurité.

### La qualité du code

Le projet suit les standards professionnels : le code est **typé** (TypeScript), ce qui réduit les bugs ; il est **testé automatiquement** à chaque modification ; et une **chaîne d'intégration continue** (GitHub Actions) vérifie que rien ne régresse avant chaque mise à jour. Le code est hébergé sur GitHub, versionné, et peut être audité ou repris par un autre développeur.

### L'assistant IA

Le développement est accéléré par l'utilisation de **Claude** (Anthropic), un assistant IA utilisé pour la conception, l'écriture de code et la documentation. C'est un outil de productivité, pas un remplaçant du développeur : toutes les décisions techniques restent humaines.

---

## 9. Ce dont j'ai besoin 

### 1. Validation du projet

Votre feu vert pour poursuivre le développement jusqu'à la mise en production.

### 2. Validation des priorités V1

Parmi les fonctionnalités prévues pour la V1, nous avons besoin de savoir lesquelles sont prioritaires pour l'association :

- Gamification (points, badges, classement des observateurs)
- Signalement de relevés douteux et interface de modération
- Section Etats Sauvages in-app (mission, impact)
- Bouton de don intégré

### 3. Validation du budget

Confirmer l'enveloppe annuelle de fonctionnement (~346 €/an) et les frais de lancement (~23 €), afin de prévoir leur prise en charge par l'association.

### 4. Mise à disposition des accès outils

Une fois le MVP finalisé (septembre 2026), nous aurons besoin que l'association fournisse ou ouvre les accès aux services d'hébergement et de distribution :

- **alwaysdata** — compte d'hébergement pour déployer le serveur en production
- **Apple Developer** — compte développeur pour publier sur l'App Store (la demande de dispense de frais sera faite au nom de l'association)
- **Google Play Console** — compte pour publier sur Android
- **Nom de domaine** — accès DNS pour pointer vers le serveur de production

---

*Document préparé en mai 2026 — Projet IBP, Etats Sauvages*
