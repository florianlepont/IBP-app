FROM node:22-alpine AS builder

WORKDIR /app

# Never add --include-workspace-root: the root package.json's dependencies
# are Expo/React Native for the mobile app and would grow node_modules from
# about 133 MB to 529 MB.
COPY package.json package-lock.json ./
COPY api/package.json ./api/
RUN npm ci --workspace api --ignore-scripts

COPY api ./api
RUN npm --workspace api run build

# ---- runtime ----
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Never add --include-workspace-root: the root package.json's dependencies
# are Expo/React Native for the mobile app and would grow node_modules from
# about 133 MB to 529 MB.
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
