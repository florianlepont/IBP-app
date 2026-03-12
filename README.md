# IBP App Monorepo

IBP field survey app workspace with:
- `mobile/`: Expo + React Native + TypeScript
- `api/`: NestJS + PostgreSQL
- `infra/`: local Docker services (PostgreSQL, MinIO)
- `specifications/`: product and technical documents

## Prerequisites
- Node.js 20+
- npm 10+
- Docker Desktop

## Repository layout
```text
.
├── api
├── infra
├── mobile
└── specifications
```

## Setup
```bash
npm install
cp api/.env.example api/.env
cp mobile/.env.example mobile/.env
docker compose -f infra/docker-compose.yml up -d
```

## Run locally
Terminal 1:
```bash
npm run dev:api:migrated
```

Terminal 2:
```bash
npm run dev:mobile
```

Quick health check:
- API: `http://localhost:3000/v1/health`
- Mobile: login and trigger a sync flow from the app

## Quality checks
API:
```bash
npm --workspace api run build
npm --workspace api run test:unit
npm --workspace api run test:e2e
```

Mobile:
```bash
npm --workspace mobile run typecheck
npm --workspace mobile run test:unit
```

Coverage:
```bash
npm run test:coverage:api
npm run test:coverage:mobile
```

## Useful scripts
Root:
```bash
npm run migrate:api
npm run dev:api
npm run dev:mobile
```

Workspaces:
```bash
npm --workspace api run migrate
npm --workspace api run start:dev
npm --workspace mobile run start
```

## Main environment variables
API (`api/.env`):
- `PORT`
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`
- `OBJECT_STORAGE_MODE` (`local` or `minio`)
- `ATTACHMENTS_UPLOAD_DIR`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `WEB_CONFIRM_EMAIL_BASE_URL`

Mobile (`mobile/.env`):
- `EXPO_PUBLIC_API_URL`

## Specifications
Recommended starting points:
- [API Contract V1](specifications/technical/api-contract-v1.md)
- [Data Contract V1](specifications/technical/data-contract-v1.md)
- [Technical Architecture V1](specifications/technical/technical-architecture-v1.md)
- [IBP Form Spec](specifications/epics/ibp_form_spec.md)

## Notes
- This README intentionally focuses on onboarding and operations.
- Detailed feature history and implementation notes should stay in `specifications/`.

---

## Roadmap déploiement

### Étape 1 — Sécuriser l'API avant mise en prod
- [ ] Désactiver `DEBUG_DATA_RESET_ENABLED` en prod (actuellement `true`)
- [ ] Désactiver `AUTH_DEV_EXPOSE_EMAIL_TOKEN` en prod (actuellement `true`)
- [ ] Remplacer `ACCESS_TOKEN_SECRET` et `REFRESH_TOKEN_SECRET` par des secrets forts
- [ ] Configurer SMTP (confirmation email)
- [ ] Ajouter rate limiting sur les endpoints auth (anti brute-force)
- [ ] Restreindre CORS au domaine de production

### Étape 2 — Infrastructure (OVH VPS)
- [ ] Créer un VPS OVH (Value, 2GB RAM, ~3.5€/mois)
- [ ] Installer Node.js 20 + PM2 sur le serveur
- [ ] Installer et configurer PostgreSQL
- [ ] Configurer OVH Object Storage (S3-compatible) pour les pièces jointes
- [ ] Obtenir un nom de domaine et configurer le DNS
- [ ] Mettre en place HTTPS avec Certbot (Let's Encrypt)
- [ ] Déployer l'API via git + `npm run build` + `pm2 start`

### Étape 3 — RGPD et légal
- [ ] Rédiger la politique de confidentialité (modèles CNIL pour assos)
- [ ] Rédiger les mentions légales
- [ ] Vérifier la présence d'un endpoint de suppression de compte (droit à l'effacement)
- [ ] Constituer le registre des traitements (doc interne)

### Étape 4 — App mobile (stores)
- [ ] Créer un compte Expo EAS (`eas login`)
- [ ] Configurer `eas.json` pour les builds iOS et Android
- [ ] Apple Developer Program (99$/an — obligatoire pour iOS)
- [ ] Google Play Console (25$ one-time — obligatoire pour Android)
- [ ] Intégrer la politique de confidentialité dans l'app (lien dans les paramètres)
- [ ] Build de production : `eas build --platform all`
- [ ] Soumission stores : `eas submit`

### Étape 5 — Mises à jour continues
- [ ] Configurer EAS Update pour les mises à jour JS sans repasser par les stores
- [ ] Documenter le process de déploiement (`git push` → rebuild → `pm2 reload`)

---

## Estimation des coûts de production

### Coûts uniques
| Poste | Coût |
|-------|------|
| Google Play Console | ~25 € |
| **Total** | **~25 €** |

### Coûts récurrents
| Poste | Coût |
|-------|------|
| OVH VPS (2 GB RAM) | ~3,50 €/mois |
| Nom de domaine | ~1 €/mois (~12 €/an) |
| Apple Developer Program | 99 €/an |
| OVH Object Storage (photos) | <1 €/mois (pay-as-you-go) |
| **Total mensuel moyen** | **~13 €/mois** |
| **Total annuel** | **~155 €/an** |

### Ce qui est gratuit
- PostgreSQL — inclus sur le VPS
- HTTPS — Let's Encrypt (gratuit)
- SMTP — Brevo (ex-Sendinblue) : gratuit jusqu'à 300 emails/jour
- EAS Build / EAS Update — tier gratuit suffisant pour un solo dev

### Première année complète
~25 € (Google) + 42 € (VPS) + 12 € (domaine) + 99 € (Apple) = **~178 €**

> **Note** : Si l'app est portée par une association loi 1901, Apple propose un programme non-profit qui exonère les 99 €/an. Cela ramènerait les coûts à ~55 €/an après la première année.
