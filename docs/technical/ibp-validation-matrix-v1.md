# IBP Validation Matrix (V1)

## Status
Accepted for implementation baseline (2026-03-09)

## Purpose
Define a stable set of reference cases for the IBP rule engine.  
Each case is intended to be covered by automated tests (`api/test/ibp-rules.spec.ts`).

## Scope
- Factor normalization from raw observation payloads
- Canonical factor outputs (`selected_class`, `score_points`)
- Aggregate score computation
- Blocking vs non-blocking validation outcomes

## Case Matrix

| Case ID | Context | Input | Expected |
|---|---|---|---|
| MAT-A-01 | `region=ACA`, `stage=collineen` | `A.native_genus_count=2` | `A=1` (`S1`) |
| MAT-A-02 | `region=ACA`, `stage=subalpin` | `A.native_genus_count=2` | `A=2` (`S2`) |
| MAT-B-01 | any | `B.strata_count=5`, `B.covered_autochthonous_percent=40` | `B=2` (cover cap applied) |
| MAT-C-01 | any | `C.bmg_count=0`, `C.bmm_count=2`, `C.surface_ha=1` | `C=1` (`S1`) |
| MAT-D-01 | any | `D.bmg_count=4`, `D.bmm_count=0`, `D.surface_ha=1` | `D=5` (`S5`) |
| MAT-E-01 | any | `E.tgb_count=0`, `E.gb_count=2`, `E.surface_ha=1` | `E=1` (`S1`) |
| MAT-F-01 | any | `F.trees_per_ha=8` | `F=5` (`S5`) |
| MAT-F-02 | any | `F.dmh_group_counts=[3,3,3,3]` | `F=5` + non-blocking warning `factor_f_group_capped` |
| MAT-G-01 | `region=ACA`, `stage=collineen` | `G.open_flowering_percent=2` | `G=5` (`S5`) |
| MAT-H-01 | any | `H.class=partial` | `H=2` (`S2`) |
| MAT-I-01 | any | `I.type_count=1` | `I=2` (`S2`) |
| MAT-I-02 | any | direct `I=1` | blocking error (`I` allowed scores: `0,2,5`) |
| MAT-J-01 | any | `J.type_count=2` | `J=5` (`S5`) |
| MAT-CONS-01 | any | `A=0`, `B=2` | non-blocking consistency warning `consistency_a_b` |
| MAT-CONS-02 | any | `E=0`, `F=5` | non-blocking consistency warning `consistency_e_f` |
| MAT-SUBMIT-01 | submit | expired `expires_at` + incomplete factors | blocking errors (`survey_expired`, missing factors) |
| MAT-SUBMIT-02 | submit | complete valid payload A..J | `ok=true` + valid aggregates (`ibp_total`) |

## Aggregate Score Rules
- `ibp_peuplement_gestion = A + B + C + D + E + F + G`
- `ibp_contexte = H + I + J`
- `ibp_total = ibp_peuplement_gestion + ibp_contexte`

## Notes
- Allowed scores:
  - A..H: `0 | 1 | 2 | 5`
  - I, J: `0 | 2 | 5`
- Canonical class mapping:
  - `0 -> S0`
  - `1 -> S1`
  - `2 -> S2`
  - `5 -> S5`
