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

## 2. À qui s'adresse-t-elle ?

| Public | Usage |
|--------|-------|
| **Écologues et observateurs de terrain** | Saisie des relevés IBP sur smartphone, hors réseau |
| **Coordinateurs Etats Sauvages** | Suivi des relevés soumis, consultation de l'historique par parcelle |
| **Grand public (futur)** | Exploration d'une carte nationale des forêts évaluées |

---

## 3. Les grandes fonctionnalités

### 3.1 Saisie guidée des relevés IBP

L'application guide l'observateur à travers les **dix facteurs IBP (A à J)** un par un. Chaque facteur propose des choix adaptés à la réalité du terrain. Les règles de validation sont appliquées immédiatement : impossible de soumettre un relevé incomplet ou incohérent.

> **Exemple :** si le facteur B (strates de végétation) requiert une valeur minimale pour permettre un score élevé sur le facteur A, l'application le signale instantanément.

### 3.2 Sélection cadastrale sur carte

Avant de commencer un relevé, l'observateur sélectionne la **parcelle cadastrale** directement sur une carte interactive. L'historique des scores précédents sur cette parcelle est affiché pour contexte.

### 3.3 Mode hors ligne complet

C'est un point clé : **l'application fonctionne entièrement sans réseau.** Toutes les données sont stockées localement sur l'appareil. Quand la connexion est rétablie, la synchronisation vers le serveur se déclenche automatiquement, avec gestion des erreurs et des tentatives automatiques.

### 3.4 Photos et pièces jointes

L'observateur peut photographier les éléments remarquables de la parcelle directement depuis l'application. Les photos sont associées au relevé et stockées de façon sécurisée.

### 3.5 Carte publique des relevés

Une carte nationale affiche les relevés soumis et validés (données anonymisées). Elle permet d'explorer l'état de la biodiversité potentielle à l'échelle de la France.

### 3.6 Compte sécurisé

Connexion via email/mot de passe ou compte Google/Apple. Les données de chaque observateur sont isolées et protégées.

---

## 4. Où en sommes-nous ?

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

## 5. La technique en deux mots

*(Pour les curieux — pas indispensable pour valider le projet)*

L'application mobile est développée avec des technologies modernes et standards qui permettent de cibler **iOS et Android avec une seule base de code**. Le serveur est hébergé sur l'infrastructure de l'association. Le code est ouvert, versionné, et accompagné d'une suite de tests automatisés. Une chaîne d'intégration continue vérifie la qualité du code à chaque modification.

---

## 6. Ce que nous vous demandons

Nous avons besoin de votre **validation pour poursuivre** et d'un retour sur :

1. **Les priorités V1** : parmi les fonctionnalités prévues (gamification, modération, don), lesquelles sont les plus urgentes pour Etats Sauvages ?
2. **La carte publique** : souhaitez-vous qu'elle soit accessible sans compte, ou réservée aux membres ?
3. **Les tests terrain** : pouvons-nous organiser une session de test avec des observateurs réels avant la mise en production ?

---

*Document préparé en mai 2026 — Projet IBP, Etats Sauvages*
