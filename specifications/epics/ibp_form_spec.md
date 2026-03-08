# Functional Specification - IBP Form (France)

## 1) Purpose
This document defines the complete structure of the IBP form used in the Etats-Sauvages public mobile app.
It is the source of truth for:
- entering the 10 IBP factors,
- determining classes and scores,
- UI validations (blocking/non-blocking),
- calculating subscores and total score,
- submission data contract.

## 2) Scope
Included:
- IBP surveys on metropolitan French forest stands.
- IBP Fr v3.0 biogeographic versions:
  - ACA: Atlantic / Continental / Alpine.
  - M: Mediterranean (thermo, meso, supra-mediterranean).
- Standard full/partial transect workflows.
- Mobile entry and validation rules.

Excluded:
- Advanced ecological interpretation of scores.
- Community moderation workflows (covered in epics).

## 3) Metadata
- Spec version: v1.0
- Language: English
- Owner: Etats-Sauvages
- Last update: 2026-03-04
- Target IBP version (required field): `ibp_method_version`
  - Recommended default value: `cnpf_ibp_fr_v3_0_2023-03-23`

## 4) Global Form Rules
- A survey is linked to one site/stand.
- A draft expires 7 days after creation.
- After 7 days, status becomes `expired` and submission is rejected.
- Submission requires all mandatory factors to be filled and scorable.
- Allowed factor scores are generally `{0,1,2,5}`.
- Exception: factors `I` and `J` use `{0,2,5}`.
- Subscores:
  - `ibp_peuplement_gestion = A + B + C + D + E + F + G` (max 35)
  - `ibp_contexte = H + I + J` (max 15)
- Total score:
  - `ibp_total = ibp_peuplement_gestion + ibp_contexte` (max 50)
- Privacy:
  - each survey has a visibility status: `private` or `public`.
  - default value: `private`.
  - only `public` surveys can be displayed in community surfaces.
- Post-publication management:
  - users can switch visibility (`public` <-> `private`) after submission.
  - users can delete a submitted survey (with confirmation).
  - switching to `private` or deleting removes survey from community surfaces.

## 5) Version and Region Typology
Required before scoring factors:
- `region_version` (enum): `ACA` | `M`
- `vegetation_stage` (minimal enum):
  - for `ACA`: `planitiaire`, `collineen`, `montagnard`, `subalpin`, `montagnard_mediterraneen`
  - for `M`: `thermo_mediterraneen`, `meso_mediterraneen`, `supra_mediterraneen`

Compatibility rule:
- If `region_version = ACA`, use ACA thresholds.
- If `region_version = M`, use M thresholds.
- Special case: `montagnard_mediterraneen` -> use ACA (CNPF rule).

## 6) IBP Factors (Detailed Model)

### Factor A - Native Tree Taxa
- Ecological objective: characterize diversity of native tree taxa.
- Field ID: `factor_a`
- Input type: multi-select list of observed native genera + derived counter.
- Unit/scope: number of native genera in described stand.
- Determination:
  - count native genera (from CNPF list for regional version).
  - include living trees (h > 50 cm) and dead trees.
- Classes/scores:
  - ACA (planitiaire/collineen/montagnard):
    - `0`: 0-1 genera
    - `1`: 2 genera
    - `2`: 3-4 genera
    - `5`: >= 5 genera
  - ACA (subalpin):
    - `0`: 0 genera
    - `1`: 1 genus
    - `2`: 2 genera
    - `5`: >= 3 genera
  - M:
    - `0`: 0-1 genera
    - `1`: 2 genera
    - `2`: 3-4 genera
    - `5`: >= 5 genera
- UI validation:
  - blocking: at least one count value or species list entry must be provided.
  - non-blocking: species outside CNPF list -> warning.
- Example:
  - ACA collineen, 4 native genera -> score `2`.

### Factor B - Vertical Vegetation Structure
- Ecological objective: describe vertical complexity.
- Field ID: `factor_b`
- Input type: checkbox per stratum + global native canopy cover.
- Unit/scope: number of strata covering >= 20% of described area.
- Determination:
  - count among 5 strata.
  - one woody plant can contribute to multiple strata.
- Strata definition:
  - ACA: very low <1.5 m, low 1.5-7 m, intermediate 7-20 m, high >20 m (+ herbaceous/semi-woody).
  - M: very low <1.5 m, low 1.5-5 m, intermediate 5-15 m, high >15 m (+ herbaceous/semi-woody).
- Classes/scores:
  - `0`: 1 stratum
  - `1`: 2 strata
  - `2`: 3-4 strata
  - `5`: 5 strata
- Special rule:
  - score capped at `2` if native species cover is < 50% of described stand.
- UI validation:
  - blocking: at least 1 stratum selected.
  - blocking: `covered_autochthonous_percent` required to apply capping.
- Example:
  - 5 observed strata but native cover 40% -> final score `2` (capped).

### Factor C - Standing Deadwood of Large Size
- Ecological objective: estimate vertical deadwood resource.
- Field ID: `factor_c`
- Input type: counters `bmg_count`, `bmm_count`, `surface_ha`.
- Unit/scope: density per hectare.
- Determination:
  - count standing deadwood (h >= 1 m): dead trees, snags, high stumps.
  - derive `BMg/ha`, `BMm/ha`.
- Diameter thresholds:
  - ACA:
    - BMg: D > 37.5 cm (special cases: D > 17.5 cm)
    - BMm: 17.5 < D < 37.5 cm
  - M:
    - BMg: D > 27.5 cm (special cases: D > 17.5 cm)
    - BMm: 17.5 < D < 27.5 cm
- Classes/scores:
  - `0`: BMg/ha < 1 and BMm/ha < 1
  - `1`: BMg/ha < 1 and BMm/ha >= 1
  - `2`: 1 <= BMg/ha < 3
  - `5`: BMg/ha >= 3
- UI validation:
  - blocking: `surface_ha > 0`.
  - blocking: counters >= 0.
- Example:
  - BMg/ha = 2.2 -> score `2`.

### Factor D - Downed Deadwood of Large Size
- Ecological objective: estimate horizontal deadwood resource.
- Field ID: `factor_d`
- Input type: counters `bmg_count`, `bmm_count`, `surface_ha`.
- Unit/scope: density per hectare.
- Determination:
  - count downed deadwood with length >= 1 m.
- Diameter thresholds:
  - ACA:
    - BMg: D > 37.5 cm (at 1 m from large end; special cases: >17.5)
    - BMm: 17.5 < D < 37.5 cm
  - M:
    - BMg: D > 27.5 cm (special cases: >17.5)
    - BMm: 17.5 < D < 27.5 cm
- Classes/scores (same as C):
  - `0`: BMg/ha < 1 and BMm/ha < 1
  - `1`: BMg/ha < 1 and BMm/ha >= 1
  - `2`: 1 <= BMg/ha < 3
  - `5`: BMg/ha >= 3
- UI validation:
  - blocking: `surface_ha > 0`.
- Example:
  - BMg/ha = 0.6, BMm/ha = 1.3 -> score `1`.

### Factor E - Very Large Living Trees
- Ecological objective: quantify very large living trees.
- Field ID: `factor_e`
- Input type: counters `tgb_count`, `gb_count`, `surface_ha`.
- Unit/scope: density per hectare.
- Determination:
  - count TGB and GB (GB used if TGB < 1/ha).
- Diameter thresholds:
  - ACA:
    - TGB: D > 67.5 cm (special cases: >47.5)
    - GB: 47.5 < D < 67.5 cm
  - M:
    - TGB: D > 57.5 cm (special cases: >37.5)
    - GB: 37.5 < D < 57.5 cm
- Classes/scores:
  - `0`: TGB/ha < 1 and GB/ha < 1
  - `1`: TGB/ha < 1 and GB/ha >= 1
  - `2`: 1 <= TGB/ha < 5
  - `5`: TGB/ha >= 5
- UI validation:
  - blocking: `surface_ha > 0`.
- Example:
  - TGB/ha = 0.4 and GB/ha = 1.1 -> score `1`.

### Factor F - Living Trees with Dendromicrohabitats
- Ecological objective: capture arboreal microhabitat diversity.
- Field ID: `factor_f`
- Input type: table per dmh group (15 groups) + derived total counter.
- Unit/scope: trees/ha (capped per group).
- Determination:
  - count trees carrying dmh according to IBP typology.
  - one tree can be counted in multiple groups.
  - within one group, one tree counts once.
  - capping: max 2 trees/ha per group.
- Classes/scores:
  - `0`: trees/ha < 2
  - `1`: 2 <= trees/ha < 3
  - `2`: 3 <= trees/ha < 8
  - `5`: trees/ha >= 8
- UI validation:
  - blocking: at least 1 dmh group evaluated (0 allowed).
  - non-blocking: value above group cap -> auto-cap + warning.
- Example:
  - total after capping = 8.4 trees/ha -> score `5`.

### Factor G - Flowering Open Habitats
- Ecological objective: qualify proportion of flowering open habitats linked to stand.
- Field ID: `factor_g`
- Input type: flowering open area (m2) + described area (m2/ha).
- Unit/scope: percentage of flowering open area.
- Determination:
  - include gaps/clearings, edges (standard width 2 m), open canopy stands.
  - count only fraction clearly occupied by flowering vegetation.
- Classes/scores:
  - ACA (collineen and montagnard):
    - `0`: 0%
    - `2`: <1% or >5%
    - `5`: 1 to 5%
  - ACA (subalpin):
    - `0`: 0%
    - `2`: <1%
    - `5`: >=1%
  - M:
    - `0`: 0%
    - `2`: <1% or >5%
    - `5`: 1 to 5%
- UI validation:
  - blocking: described area > 0.
- Example:
  - 3.2% flowering open habitats (M) -> score `5`.

### Factor H - Temporal Continuity of Forest Cover
- Ecological objective: estimate forest continuity/antiquity.
- Field ID: `factor_h`
- Input type: guided expert class + justifications (desk sources + field evidence).
- Unit/scope: ordinal class.
- Determination:
  - reference 19th-century forest minimum (Etat-major map) + later documents + field evidence.
- Classes/scores:
  - `0`: recent forest (cleared over whole area)
  - `2`: partial continuity OR continuity with full-soil-disturbance reforestation
  - `5`: ancient continuous forest (no clearing, no full-soil-disturbance reforestation)
- UI validation:
  - blocking: one class required.
  - blocking: `evidence_source` required (map, aerial photo, field observation).
- Example:
  - stand present on Etat-major map with no discontinuity signs -> score `5`.

### Factor I - Aquatic Habitats
- Ecological objective: account for nearby aquatic habitat diversity.
- Field ID: `factor_i`
- Input type: multi-select of observed aquatic habitat types.
- Unit/scope: number of distinct habitat types (inside or bordering stand).
- Rules:
  - natural or artificial types.
  - permanent or temporary (excluding flood events).
- Classes/scores:
  - `0`: no type
  - `2`: 1 type
  - `5`: >=2 types
- UI validation:
  - blocking: number of types determined (0 allowed).
- Example:
  - spring + small stream -> score `5`.

### Factor J - Rocky Habitats
- Ecological objective: account for rocky/mineral habitat diversity.
- Field ID: `factor_j`
- Input type: multi-select of observed rocky habitat types.
- Unit/scope: number of distinct habitat types.
- Rules:
  - located inside or bordering stand.
  - a type counts only if cumulative area > 20 m2.
- Classes/scores:
  - `0`: no type
  - `2`: 1 type
  - `5`: >=2 types
- UI validation:
  - blocking: number of types determined (0 allowed).
- Example:
  - slab + outcrops (each >20 m2 cumulative area) -> score `5`.

## 7) Edge Cases and Cross-Cutting Rules
- Special low-fertility/low-growth taxa cases:
  - apply reduced diameter thresholds for C, D, E.
- Capped survey mode (default mobile mode):
  - a factor can stop being observed as soon as final score is secured.
- Uncapped survey mode (study mode):
  - allowed, but score still computed with same IBP classes.
- Linear forests (<15 m width):
  - density/km adaptation (CNPF table):
    - C and D: BMg/km <9; 9-<15; >=15
    - E: TGB/km <9; 9-<20; >=20
    - F: trees/km <12; 12-<15; 15-<25; >=25
    - F cap: max 9 trees/km per dmh group.

## 8) Validation Matrix (UI + Submission)

### 8.1 Blocking Validations by Factor
- A: region_version + stage + native genera count available.
- B: at least 1 stratum entered; `covered_autochthonous_percent` entered.
- C/D/E: `surface_ha > 0`; non-negative counters.
- F: coherent dmh-group data; computable total.
- G: computable surfaces and `open_flowering_percent`.
- H: class selected + evidence source.
- I/J: number of types determined (0 accepted).

### 8.2 Time/Status Validations
- If `now > created_at + 7 days` and status is `draft`:
  - force status `expired`.
  - block submission.
  - message: `This survey has expired (more than 7 days). Please create a new survey.`

### 8.3 Visibility Validations
- `visibility` is required at submission (`private` or `public`).
- Default value at draft creation: `private`.
- If `visibility = public`, verify exposed data complies with anonymization/pseudonymization rules.

### 8.4 Post-Publication Action Validations
- Visibility change action is allowed only for survey owner (or authorized moderator/admin role).
- Deletion requires explicit user confirmation.
- After deletion, payload status becomes `deleted` and survey is excluded from list/map/community feeds.

### 8.5 Inter-Factor Consistency (Non-Blocking)
- `factor_b >= 3 strata` with `factor_a = 0` -> consistency warning.
- `factor_f >= 5` with `factor_e = 0` -> warning (possible but should be checked).
- `factor_g = 5` and `factor_i = 0`/`factor_j = 0` -> no error (no strict constraint).

### 8.6 Canonical Error Messages (EN)
- `Missing required field: {field_id}`
- `Invalid value for {field_id}`
- `Invalid described area (must be > 0)`
- `Unsupported IBP version: {ibp_method_version}`
- `Inconsistent region/IBP version`
- `This survey has expired (more than 7 days).`
- `Invalid visibility (expected values: private, public).`
- `Deletion cancelled or not confirmed.`

## 9) Calculation Rules
- Per-factor calculation:
  - evaluate class based on regional thresholds.
  - apply caps/adjustments (B, F, special diameter cases).
- Final calculation:
  - `ibp_peuplement_gestion = A+B+C+D+E+F+G`
  - `ibp_contexte = H+I+J`
  - `ibp_total = ibp_peuplement_gestion + ibp_contexte`
- Rounding:
  - factor scores are discrete (no intermediate score rounding).
  - densities/percentages may be computed as floating values then compared strictly to thresholds.

## 10) Data Contract (API/Storage)

### 10.1 Main Types
- `ibp_method_version: string` (required)
- `region_version: "ACA" | "M"` (required)
- `status: "draft" | "expired" | "submitted" | "synced" | "error" | "deleted"`
- `visibility: "private" | "public"` (required, default `private`)
- `published_at?: datetime`
- `deleted_at?: datetime`
- `factors: array[10]` (required)

### 10.2 Factor Structure
- `factor_id: "factor_a" | ... | "factor_j"`
- `observed_value_raw: object` (raw input data)
- `selected_class: "S0" | "S1" | "S2" | "S5"` (I/J: `S0|S2|S5`)
- `score_points: number` (0|1|2|5 or 0|2|5)
- `evidence: { notes?: string, photos?: string[], gps?: {lat:number,lng:number,accuracy_m?:number} }`

### 10.3 Logical Submission Payload
```json
{
  "survey_id": "uuid",
  "ibp_method_version": "cnpf_ibp_fr_v3_0_2023-03-23",
  "region_version": "ACA",
  "vegetation_stage": "collineen",
  "created_at": "2026-03-04T10:00:00Z",
  "status": "submitted",
  "visibility": "public",
  "published_at": "2026-03-04T10:35:00Z",
  "factors": [
    {
      "factor_id": "factor_a",
      "observed_value_raw": { "autochthonous_genus_count": 4 },
      "selected_class": "S2",
      "score_points": 2,
      "evidence": { "notes": "Taxon validated in field" }
    }
  ],
  "ibp_peuplement_gestion": 23,
  "ibp_contexte": 7,
  "ibp_total": 30,
  "validation_errors": []
}
```

### 10.4 Versioning Rules
- `ibp_method_version` is required at draft creation.
- If version is unsupported:
  - block submission,
  - return `Unsupported IBP version` error.
- Class enums and thresholds are fixed per version.

## 11) Acceptance Test Scenarios
1. Correct factor classification:
- raw input -> expected class -> expected score.

2. Threshold edge case:
- value exactly on threshold -> correct class based on inclusive/exclusive bounds.

3. Inter-factor inconsistency:
- warning raised without blocking submission (for non-blocking rule).

4. Valid submission:
- 10 scorable factors + required fields -> score computed + status `submitted`.

5. Expired draft:
- draft > 7 days -> status `expired`, submission denied.

6. Visibility:
- `private` not published in map/community surfaces, `public` eligible for publication.

7. Post-publication management:
- switching `public` -> `private` removes survey from map/community surfaces.
- deletion marks survey as `deleted` and removes it from user/community lists.

8. Versioning:
- same survey with different version -> verify version-specific thresholds / support.

## 12) Official References (Primary Source)
- CNPF - IBP page (official documents): https://www.cnpf.fr/n/ibp/n:2006
- IBP Fr v3.0 definition (updated 2023-03-23): https://www.cnpf.fr/sites/socle/files/cnpf-old/medias/documents/9a66d6016d0a99f576f35f53df4e73f3/ibp_def_fr_v3_0_230323_0.pdf
- IBP Fr v3.0 survey sheets (updated 2023-03-23): https://www.cnpf.fr/sites/socle/files/cnpf-old/medias/documents/5cf710f876f8e4ddfd4007df318f71f5/ibp_rel_fr_v3_0_230323_0.pdf
- IBP survey methods (updated 2022-10-10): https://www.cnpf.fr/sites/socle/files/cnpf-old/medias/documents/e5f7f1ea0f6f4f63a2ef41a58ecab8e0/ibp_methodes_de_releve_v221010_0.pdf

## 13) Change Log
- 2026-03-04: moved from template to full operational specification (factors, thresholds, scoring, validations, data contract, CNPF references).
