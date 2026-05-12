# Application IBP — Présentation du projet
### Etats Sauvages · Mai 2026

---

## 1. Pourquoi cette application ?

La méthode **IBP (Indice de Biodiversité Potentielle)** est un protocole de terrain reconnu qui permet d'évaluer le potentiel de biodiversité d'une parcelle forestière en notant dix facteurs écologiques (arbres natifs, bois mort, vieux arbres, connectivité, zones humides, etc.).

Aujourd'hui, ces relevés se font **sur papier ou dans des tableurs**, ce qui pose trois problèmes majeurs :

- Les données sont difficiles à centraliser et à exploiter
- Les erreurs de saisie sont fréquentes et détectées tard
- Impossible de travailler sans réseau sur le terrain

**Notre application mobile IBP** résout ces trois problèmes : elle guide l'observateur facteur par facteur, valide les données en temps réel, et fonctionne entièrement hors ligne. Les relevés se synchronisent automatiquement dès le retour en zone couverte.

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
| **Grand public (futur)** | Exploration d'une carte nationale des forêts évaluées |

---

## 4. Les grandes fonctionnalités

### 4.1 Saisie guidée des relevés IBP

L'application guide l'observateur à travers les **dix facteurs IBP (A à J)** un par un. Chaque facteur propose des choix adaptés à la réalité du terrain. Les règles de validation sont appliquées immédiatement : impossible de soumettre un relevé incomplet ou incohérent.

> **Exemple :** si le facteur B (strates de végétation) requiert une valeur minimale pour permettre un score élevé sur le facteur A, l'application le signale instantanément.

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

---

## 5. Où en sommes-nous ?

### Ce qui est fait — MVP complet

| Fonctionnalité | Statut |
|----------------|--------|
| Authentification (email, Google, Apple) | ✅ Terminé |
| Saisie des 10 facteurs IBP avec validation | ✅ Terminé |
| Sélection cadastrale sur carte | ✅ Terminé |
| Mode hors ligne + synchronisation automatique | ✅ Terminé |
| Photos et pièces jointes | ✅ Terminé |
| Carte publique des relevés | ✅ Terminé |
| Historique des scores par parcelle | ✅ Terminé |
| Gestion du profil utilisateur | ✅ Terminé |
| API backend sécurisée (serveur) | ✅ Terminé |
| Base de données (12 migrations validées) | ✅ Terminé |

Le cœur du produit est **fonctionnel et testé**. Un observateur peut aujourd'hui créer un compte, réaliser un relevé IBP complet sur le terrain sans réseau, et le retrouver synchronisé à son retour au bureau.

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
| ✅ MVP terminé | Mai 2026 |
| 🔵 Tests terrain avec observateurs pilotes | Juin – Juillet 2026 |
| 🔵 Publication App Store et Google Play | Septembre 2026 |
| 🔵 Version V1 (gamification, modération, section asso, don) | Décembre 2026 |

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
| **Total annuel** | **~82 € TTC/an** | |

> En cas de forte croissance (plusieurs centaines d'utilisateurs actifs simultanément), le plan d'hébergement pourrait passer à l'échelon supérieur (~230 €/an), soit un total d'environ **240 €/an**.

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

## 8. La technique en deux mots

*(Pour les curieux — pas indispensable pour valider le projet)*

L'application mobile est développée avec des technologies modernes et standards qui permettent de cibler **iOS et Android avec une seule base de code**. Le serveur est hébergé chez un hébergeur européen (alwaysdata, Paris). Le code est ouvert, versionné, et accompagné d'une suite de tests automatisés. Une chaîne d'intégration continue vérifie la qualité du code à chaque modification.

---

## 9. Ce que nous vous demandons

Nous avons besoin de votre **validation pour poursuivre** et d'un retour sur :

1. **Les priorités V1** : parmi les fonctionnalités prévues (gamification, modération, don), lesquelles sont les plus urgentes pour Etats Sauvages ?
2. **La carte publique** : souhaitez-vous qu'elle soit accessible sans compte, ou réservée aux membres ?
3. **Les tests terrain** : pouvons-nous organiser une session de test avec des observateurs réels avant la mise en production ?

---

*Document préparé en mai 2026 — Projet IBP, Etats Sauvages*
