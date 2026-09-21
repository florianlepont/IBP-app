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
| `mobile/assets/herbier/`, `mobile/assets/herbier-transparent/` | Herbarium plates (tree species illustrations) |
| `mobile/assets/animals/` | Animal illustrations |
| `mobile/assets/auth/`, `mobile/assets/tabs/` | Fern motif, marten, navigation pictograms |
| `mobile/assets/logo-app.png` | Association logo, app variant |
| `mobile/android/app/src/main/res/drawable-*/splashscreen_logo.png` | Splash screen, derived from the logo |
| `mobile/ios/Cortege/Images.xcassets/AppIcon.appiconset/` | iOS app icon, derived from the logo |
| `docs/design/charte-graphique-etats-sauvages-spec.md` | Implementation rules derived from the association's graphic charter |

These files are present only because the application cannot be built without
them. The association's **source assets** (high-resolution originals, unused
variants) are deliberately kept out of this repository.

Every image in this list carries the copyright notice embedded in its own
metadata (PNG `tEXt` / JPEG `COM`). After adding a new asset, run:

```bash
python3 scripts/stamp-asset-copyright.py mobile/assets
python3 scripts/stamp-asset-copyright.py --check mobile/assets   # CI-friendly
```

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
