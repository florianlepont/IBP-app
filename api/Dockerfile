FROM node:22-alpine AS builder

WORKDIR /app

# The root package.json only declares the workspaces and the shared
# overrides (no runtime dependencies since 01.9-19). --workspace api installs
# the API tree alone; the mobile workspace (Expo/React Native) never enters it.
COPY package.json package-lock.json ./
COPY api/package.json ./api/
RUN npm ci --workspace api --ignore-scripts

COPY api ./api
RUN npm --workspace api run build

# ---- runtime ----
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# The root package.json only declares the workspaces and the shared
# overrides (no runtime dependencies since 01.9-19). --workspace api installs
# the API tree alone; the mobile workspace (Expo/React Native) never enters it.
COPY package.json package-lock.json ./
COPY api/package.json ./api/
RUN npm ci --workspace api --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/api/dist ./api/dist
COPY api/scripts ./api/scripts
COPY api/migrations ./api/migrations

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "require('http').get('http://127.0.0.1:3000/v1/health',(res)=>{process.exit(res.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["sh", "-c", "node api/scripts/migrate.js && node api/dist/main.js"]
