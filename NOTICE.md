# Notice — ownership and third-party material

This repository is source-available, not open source. See [LICENSE](LICENSE).

## Code

Copyright (c) 2026 Florian Lepont. All rights reserved.

Everything not listed below — the `mobile/`, `api/` and `infra/` sources, the
technical documentation and the CI configuration — falls under LICENSE.

## Brand assets — Association Etats Sauvages

The following are the property of the association **Etats Sauvages** (or of the
designers it commissioned). They are included in this repository only so that
this application can be built, and are **excluded from any grant**. They may not
be copied, reused, adapted or redistributed, in whole or in part, for any
purpose.

| Path | Content |
|------|---------|
| `media/logo/` | Association logos and favicons |
| `media/picto/` | Brand pictograms, fern and bump motifs, arrows |
| `media/herbier/` | Herbarium plates (tree species illustrations) |
| `media/animaux/` | Animal illustrations |
| `media/frame/` | Decorative frames |
| `mobile/assets/`, `mobile/android/.../splashscreen_logo.png`, `mobile/ios/.../AppIcon.appiconset/` | Derived app icons and splash screens |
| `docs/design/charte-graphique-etats-sauvages-spec.md` | Implementation rules derived from the association's graphic charter |

The graphic charter PDF itself is an internal document of the association and is
not published in this repository.

## IBP methodology — CNPF / INRAE Dynafor

The Indice de Biodiversité Potentielle (IBP) is the work of the **Centre
National de la Propriété Forestière (CNPF)** and **INRAE Dynafor**:

> Gonin P., Larrieu L., 2022 — *Indice de Biodiversité Potentielle
> (IBP Fr v3.0)*. CNPF, INRAE Dynafor.

The scoring rules implemented in `api/src/surveys/ibp-rules.service.ts` and
`mobile/src/app/` are derived from that published methodology. The official
documents are not redistributed here — see
[docs/references/README.md](docs/references/README.md) for the download links.

"IBP" and "Indice de Biodiversité Potentielle" designate the CNPF method; this
project claims no rights over them.

## Dependencies

npm dependencies are not vendored in this repository and remain under their own
licenses. Run `npm ls --all` or inspect `package-lock.json` for the full tree.
