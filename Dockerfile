# Rastro: API Express + telas React, SQLite num volume persistente (ver fly.toml).
FROM node:20-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 é nativo: ferramentas para compilar caso não haja binário pronto.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 8080
CMD ["node", "--import", "tsx", "apps/api/src/main.ts"]
