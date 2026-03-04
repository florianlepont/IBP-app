# Specification fonctionnelle - Formulaire IBP (France)

## 1) Objet
Ce document definit la structure complete du formulaire IBP de l'application mobile grand public Etats-Sauvages.
Il constitue la source de verite pour:
- la saisie des 10 facteurs IBP,
- la determination des classes et des scores,
- les validations UI (bloquantes/non bloquantes),
- le calcul des sous-scores et du score total,
- le contrat de donnees de soumission.

## 2) Perimetre
Inclus:
- Releves IBP sur peuplements forestiers metropolitains.
- Versions biogeographiques IBP Fr v3.0:
  - ACA: Atlantique / Continentale / Alpine.
  - M: Mediterraneenne (thermo, meso, supra-mediterraneen).
- Cas standard par parcours en plein/partiel.
- Regles de saisie mobile et regles de validation.

Exclu:
- Interpretation ecologique avancee des scores.
- Workflows de moderation communautaire (documentes dans les epics).

## 3) Metadonnees
- Version spec: v1.0
- Langue: Francais
- Proprietaire: Etats-Sauvages
- Derniere mise a jour: 2026-03-04
- Version IBP cible (champ obligatoire): `ibp_method_version`
  - Valeur recommandee par defaut: `cnpf_ibp_fr_v3_0_2023-03-23`

## 4) Regles globales de formulaire
- Un releve est rattache a un seul site/peuplement.
- Le brouillon expire 7 jours apres creation.
- Passe 7 jours, le statut devient `expired` et la soumission est refusee.
- La soumission exige que tous les facteurs obligatoires soient renseignes et scorables.
- Les scores autorises par facteur sont en general `{0,1,2,5}`.
- Exception: facteurs `I` et `J` utilisent `{0,2,5}`.
- Sous-scores:
  - `ibp_peuplement_gestion = A + B + C + D + E + F + G` (max 35)
  - `ibp_contexte = H + I + J` (max 15)
- Score total:
  - `ibp_total = ibp_peuplement_gestion + ibp_contexte` (max 50)

## 5) Typologie de version et region
Champ requis avant notation des facteurs:
- `region_version` (enum): `ACA` | `M`
- `etage_vegetation` (enum minimal):
  - pour `ACA`: `planitiaire`, `collineen`, `montagnard`, `subalpin`, `montagnard_mediterraneen`
  - pour `M`: `thermo_mediterraneen`, `meso_mediterraneen`, `supra_mediterraneen`

Regle de compatibilite:
- Si `region_version = ACA`, utiliser les seuils ACA.
- Si `region_version = M`, utiliser les seuils M.
- Cas particulier: `montagnard_mediterraneen` -> utiliser ACA (consigne CNPF).

## 6) Facteurs IBP (modele detaille)

### Facteur A - Essences autochtones
- Objectif ecologique: qualifier la diversite d'essences autochtones arborescentes.
- Field ID: `factor_a`
- Type saisie: liste multi-choix de genres autochtones observes + compteur derive.
- Unite/perimetre: nombre de genres autochtones dans le peuplement decrit.
- Determination:
  - compter les genres autochtones (selon liste CNPF de la version regionale).
  - prendre en compte arbres vivants (h > 50 cm) et arbres morts.
- Classes/scores:
  - ACA (planitiaire/collineen/montagnard):
    - `0`: 0-1 genre
    - `1`: 2 genres
    - `2`: 3-4 genres
    - `5`: >= 5 genres
  - ACA (subalpin):
    - `0`: 0 genre
    - `1`: 1 genre
    - `2`: 2 genres
    - `5`: >= 3 genres
  - M:
    - `0`: 0-1 genre
    - `1`: 2 genres
    - `2`: 3-4 genres
    - `5`: >= 5 genres
- Validation UI:
  - bloquant: au moins une valeur de comptage ou une liste d'essences doit etre fournie.
  - non bloquant: essence hors liste CNPF -> avertissement.
- Exemple:
  - ACA collineen, 4 genres autochtones -> score `2`.

### Facteur B - Structure verticale de la vegetation
- Objectif ecologique: decrire la complexite verticale.
- Field ID: `factor_b`
- Type saisie: cases a cocher par strate + couvert autochtone global.
- Unite/perimetre: nombre de strates couvrant >= 20% de la surface decrite.
- Determination:
  - compter parmi 5 strates.
  - un meme ligneux peut contribuer a plusieurs strates.
- Definition des strates:
  - ACA: tres bas <1.5 m, bas 1.5-7 m, intermediaire 7-20 m, haut >20 m (+ strate herbacee/semi-ligneuse).
  - M: tres bas <1.5 m, bas 1.5-5 m, intermediaire 5-15 m, haut >15 m (+ strate herbacee/semi-ligneuse).
- Classes/scores:
  - `0`: 1 strate
  - `1`: 2 strates
  - `2`: 3-4 strates
  - `5`: 5 strates
- Regle speciale:
  - score plafonne a `2` si le couvert des essences autochtones est < 50% du peuplement decrit.
- Validation UI:
  - bloquant: au moins 1 strate cochee.
  - bloquant: `covered_autochthonous_percent` requis pour appliquer le plafonnement.
- Exemple:
  - 5 strates observees mais couvert autochtone 40% -> score final `2` (plafonne).

### Facteur C - Bois morts sur pied de grosse dimension
- Objectif ecologique: estimer la ressource en bois mort vertical.
- Field ID: `factor_c`
- Type saisie: compteurs `bmg_count`, `bmm_count`, `surface_ha`.
- Unite/perimetre: densite par hectare.
- Determination:
  - compter les bois morts sur pied (h >= 1 m): arbres morts, chandelles, souches hautes.
  - derive `BMg/ha`, `BMm/ha`.
- Seuils de diametre:
  - ACA:
    - BMg: D > 37.5 cm (cas particuliers: D > 17.5 cm)
    - BMm: 17.5 < D < 37.5 cm
  - M:
    - BMg: D > 27.5 cm (cas particuliers: D > 17.5 cm)
    - BMm: 17.5 < D < 27.5 cm
- Classes/scores:
  - `0`: BMg/ha < 1 et BMm/ha < 1
  - `1`: BMg/ha < 1 et BMm/ha >= 1
  - `2`: 1 <= BMg/ha < 3
  - `5`: BMg/ha >= 3
- Validation UI:
  - bloquant: `surface_ha > 0`.
  - bloquant: compteurs >= 0.
- Exemple:
  - BMg/ha = 2.2 -> score `2`.

### Facteur D - Bois morts au sol de grosse dimension
- Objectif ecologique: estimer la ressource en bois mort horizontal.
- Field ID: `factor_d`
- Type saisie: compteurs `bmg_count`, `bmm_count`, `surface_ha`.
- Unite/perimetre: densite par hectare.
- Determination:
  - compter bois morts au sol de longueur >= 1 m.
- Seuils de diametre:
  - ACA:
    - BMg: D > 37.5 cm (a 1 m du gros bout; cas particuliers: >17.5)
    - BMm: 17.5 < D < 37.5 cm
  - M:
    - BMg: D > 27.5 cm (cas particuliers: >17.5)
    - BMm: 17.5 < D < 27.5 cm
- Classes/scores (identiques a C):
  - `0`: BMg/ha < 1 et BMm/ha < 1
  - `1`: BMg/ha < 1 et BMm/ha >= 1
  - `2`: 1 <= BMg/ha < 3
  - `5`: BMg/ha >= 3
- Validation UI:
  - bloquant: `surface_ha > 0`.
- Exemple:
  - BMg/ha = 0.6, BMm/ha = 1.3 -> score `1`.

### Facteur E - Tres gros bois vivants
- Objectif ecologique: quantifier la presence d'arbres de grande dimension.
- Field ID: `factor_e`
- Type saisie: compteurs `tgb_count`, `gb_count`, `surface_ha`.
- Unite/perimetre: densite par hectare.
- Determination:
  - compter TGB et GB (GB utile si TGB < 1/ha).
- Seuils de diametre:
  - ACA:
    - TGB: D > 67.5 cm (cas particuliers: >47.5)
    - GB: 47.5 < D < 67.5 cm
  - M:
    - TGB: D > 57.5 cm (cas particuliers: >37.5)
    - GB: 37.5 < D < 57.5 cm
- Classes/scores:
  - `0`: TGB/ha < 1 et GB/ha < 1
  - `1`: TGB/ha < 1 et GB/ha >= 1
  - `2`: 1 <= TGB/ha < 5
  - `5`: TGB/ha >= 5
- Validation UI:
  - bloquant: `surface_ha > 0`.
- Exemple:
  - TGB/ha = 0.4 et GB/ha = 1.1 -> score `1`.

### Facteur F - Arbres vivants porteurs de dendromicrohabitats
- Objectif ecologique: capter la diversite de micro-habitats arboricoles.
- Field ID: `factor_f`
- Type saisie: tableau par groupe de dmh (15 groupes) + compteur total derive.
- Unite/perimetre: arbres/ha (plafonnes par groupe).
- Determination:
  - compter les arbres porteurs de dmh selon typologie IBP.
  - un arbre peut etre compte dans plusieurs groupes.
  - au sein d'un meme groupe, un arbre ne compte qu'une fois.
  - plafonnement: max 2 arbres/ha par groupe.
- Classes/scores:
  - `0`: arbres/ha < 2
  - `1`: 2 <= arbres/ha < 3
  - `2`: 3 <= arbres/ha < 8
  - `5`: arbres/ha >= 8
- Validation UI:
  - bloquant: au moins 1 groupe dmh evalue (0 autorise).
  - non bloquant: valeur depassant le plafond par groupe -> auto-cap + avertissement.
- Exemple:
  - total calcule apres plafonnement = 8.4 arbres/ha -> score `5`.

### Facteur G - Milieux ouverts floriferes
- Objectif ecologique: qualifier la proportion d'habitats ouverts floriferes associes au peuplement.
- Field ID: `factor_g`
- Type saisie: surface ouverte florifere (m2) + surface decrite (m2/ha).
- Unite/perimetre: pourcentage de surface ouverte florifere.
- Determination:
  - inclure trouees/clairieres, lisiere (largeur standard 2 m), peuplements clairs.
  - ne compter que la fraction nettement occupee par vegetation florifere.
- Classes/scores:
  - ACA (collineen et montagnard):
    - `0`: 0%
    - `2`: <1% ou >5%
    - `5`: 1 a 5%
  - ACA (subalpin):
    - `0`: 0%
    - `2`: <1%
    - `5`: >=1%
  - M:
    - `0`: 0%
    - `2`: <1% ou >5%
    - `5`: 1 a 5%
- Validation UI:
  - bloquant: surface decrite > 0.
- Exemple:
  - 3.2% de milieux ouverts floriferes (M) -> score `5`.

### Facteur H - Continuite temporelle de l'etat boise
- Objectif ecologique: estimer l'anciennete/continuite forestiere.
- Field ID: `factor_h`
- Type saisie: classe expert guidee + justifications (sources bureau + indices terrain).
- Unite/perimetre: classe ordinale.
- Determination:
  - reference minimum forestier XIXe (carte d'etat-major) + docs ulterieurs + indices terrain.
- Classes/scores:
  - `0`: foret recente (defrichee sur toute la surface)
  - `2`: continuite partielle OU continuite avec reboisement et travail du sol en plein
  - `5`: foret ancienne continue (pas de defrichement, pas de reboisement avec travail du sol en plein)
- Validation UI:
  - bloquant: une classe obligatoire.
  - bloquant: `evidence_source` obligatoire (carte, photo aerienne, observation terrain).
- Exemple:
  - parcelle presente sur carte d'etat-major sans signe de rupture -> score `5`.

### Facteur I - Milieux aquatiques
- Objectif ecologique: prendre en compte la diversite des milieux aquatiques proches.
- Field ID: `factor_i`
- Type saisie: multi-choix de types aquatiques observes.
- Unite/perimetre: nombre de types distincts (interieur ou bordure du peuplement).
- Regles:
  - types naturels ou artificiels.
  - permanents ou temporaires (hors episodes de crue).
- Classes/scores:
  - `0`: aucun type
  - `2`: 1 type
  - `5`: >=2 types
- Validation UI:
  - bloquant: nombre de types determine (0 possible).
- Exemple:
  - source + petit cours d'eau -> score `5`.

### Facteur J - Milieux rocheux
- Objectif ecologique: prendre en compte la diversite des milieux rocheux/mineraux.
- Field ID: `factor_j`
- Type saisie: multi-choix de types rocheux observes.
- Unite/perimetre: nombre de types distincts.
- Regles:
  - situer a l'interieur ou en bordure du peuplement.
  - ne compter un type que si surface cumulee > 20 m2.
- Classes/scores:
  - `0`: aucun type
  - `2`: 1 type
  - `5`: >=2 types
- Validation UI:
  - bloquant: nombre de types determine (0 possible).
- Exemple:
  - dalle + affleurements (surface >20 m2 chacun) -> score `5`.

## 7) Cas limites et regles transverses
- Cas particuliers de fertilite/essences a faible croissance:
  - appliquer les seuils de diametre reduits prevus dans C, D, E.
- Releve plafonne (mode mobile par defaut):
  - arret possible d'un facteur des que le score final est acquis.
- Releve deplafonne (mode etude):
  - autorise, mais le score est calcule avec les memes classes IBP.
- Forets lineaires (<15 m de large):
  - adaptation densite/km (table CNPF):
    - C et D: BMg/km <9; 9-<15; >=15
    - E: TGB/km <9; 9-<20; >=20
    - F: arbres/km <12; 12-<15; 15-<25; >=25
    - plafonnement F: max 9 arbres/km par groupe dmh.

## 8) Matrice de validation (UI + soumission)

### 8.1 Validations bloquantes par facteur
- A: region_version + etage + comptage genres autochtones disponibles.
- B: au moins 1 strate renseignee; `covered_autochthonous_percent` renseigne.
- C/D/E: `surface_ha > 0`; compteurs non negatifs.
- F: donnees par groupe dmh coherentes; total calculable.
- G: surfaces calculees et `open_flowering_percent` calculable.
- H: classe choisie + source de justification.
- I/J: nombre de types determine (0 accepte).

### 8.2 Validations temporelles/statut
- Si `now > created_at + 7 jours` ET statut `draft`:
  - forcer statut `expired`.
  - interdire soumission.
  - message: `Ce releve est caduc (plus de 7 jours). Creez un nouveau releve.`

### 8.3 Coherences inter-facteurs (non bloquantes)
- `factor_b >= 3 strates` avec `factor_a = 0` -> avertissement de coherence.
- `factor_f >= 5` avec `factor_e = 0` -> avertissement (possible mais a verifier).
- `factor_g = 5` et `factor_i = 0`/`factor_j = 0` -> pas d'erreur (pas de contrainte stricte).

### 8.4 Messages d'erreur FR (canon)
- `Champ obligatoire manquant: {field_id}`
- `Valeur invalide pour {field_id}`
- `Surface decrite invalide (doit etre > 0)`
- `Version IBP non supportee: {ibp_method_version}`
- `Incoherence de region/version IBP`
- `Ce releve est caduc (plus de 7 jours).`

## 9) Regles de calcul
- Calcul par facteur:
  - evaluer la classe selon les seuils regionaux.
  - appliquer plafonnements/ajustements (B, F, cas particuliers diametre).
- Calcul final:
  - `ibp_peuplement_gestion = A+B+C+D+E+F+G`
  - `ibp_contexte = H+I+J`
  - `ibp_total = ibp_peuplement_gestion + ibp_contexte`
- Arrondis:
  - les scores facteurs sont discrets (pas d'arrondi intermediaire de score).
  - les densites/percentages peuvent etre calcules en flottant puis compares strictement aux seuils.

## 10) Contrat de donnees (API/stockage)

### 10.1 Types principaux
- `ibp_method_version: string` (obligatoire)
- `region_version: "ACA" | "M"` (obligatoire)
- `status: "draft" | "expired" | "submitted" | "synced" | "error"`
- `factors: array[10]` (obligatoire)

### 10.2 Structure d'un facteur
- `factor_id: "factor_a" | ... | "factor_j"`
- `observed_value_raw: object` (donnees brutes de saisie)
- `selected_class: "S0" | "S1" | "S2" | "S5"` (I/J: `S0|S2|S5`)
- `score_points: number` (0|1|2|5 ou 0|2|5)
- `evidence: { notes?: string, photos?: string[], gps?: {lat:number,lng:number,accuracy_m?:number} }`

### 10.3 Payload logique de soumission
```json
{
  "survey_id": "uuid",
  "ibp_method_version": "cnpf_ibp_fr_v3_0_2023-03-23",
  "region_version": "ACA",
  "etage_vegetation": "collineen",
  "created_at": "2026-03-04T10:00:00Z",
  "status": "submitted",
  "factors": [
    {
      "factor_id": "factor_a",
      "observed_value_raw": { "autochthonous_genus_count": 4 },
      "selected_class": "S2",
      "score_points": 2,
      "evidence": { "notes": "Genre verifie sur terrain" }
    }
  ],
  "ibp_peuplement_gestion": 23,
  "ibp_contexte": 7,
  "ibp_total": 30,
  "validation_errors": []
}
```

### 10.4 Regles de versionning
- `ibp_method_version` obligatoire a la creation du brouillon.
- Si version non supportee:
  - blocage de soumission,
  - erreur `Version IBP non supportee`.
- Les enums de classes et seuils sont figes par version.

## 11) Scenarios de test d'acceptation
1. Classement correct d'un facteur:
- entree brute -> classe attendue -> score attendu.

2. Cas limite de seuil:
- valeur exactement au seuil -> classe correcte selon borne incluse/exclue.

3. Incoherence inter-facteurs:
- warning leve sans bloquer la soumission (si regle non bloquante).

4. Soumission valide:
- 10 facteurs scorables + champs obligatoires -> score calcule + statut `submitted`.

5. Brouillon expire:
- draft > 7 jours -> statut `expired`, soumission refusee.

6. Versionning:
- meme releve avec version differente -> verifier seuils/version supportee.

## 12) References officielles (source primaire)
- CNPF - page IBP (documents officiels): https://www.cnpf.fr/n/ibp/n:2006
- Definition IBP Fr v3.0 (maj 23/03/2023): https://www.cnpf.fr/sites/socle/files/cnpf-old/medias/documents/9a66d6016d0a99f576f35f53df4e73f3/ibp_def_fr_v3_0_230323_0.pdf
- Fiches de releve IBP Fr v3.0 (maj 23/03/2023): https://www.cnpf.fr/sites/socle/files/cnpf-old/medias/documents/5cf710f876f8e4ddfd4007df318f71f5/ibp_rel_fr_v3_0_230323_0.pdf
- Methodes de releve IBP (maj 10/10/2022): https://www.cnpf.fr/sites/socle/files/cnpf-old/medias/documents/e5f7f1ea0f6f4f63a2ef41a58ecab8e0/ibp_methodes_de_releve_v221010_0.pdf

## 13) Change log
- 2026-03-04: passage d'un template a une specification operationnelle complete (facteurs, seuils, score, validations, contrat de donnees, references CNPF).
