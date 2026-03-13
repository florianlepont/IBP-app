FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig*.json ./
COPY src ./src
COPY scripts ./scripts

RUN npm run build

# ---- runtime ----
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000

CMD ["sh", "-c", "node scripts/migrate.js && node dist/main.js"]
