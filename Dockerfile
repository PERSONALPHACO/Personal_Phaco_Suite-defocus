# syntax=docker/dockerfile:1
# DefocusApp — imagem de produção (Railway, Cloud Run, Render, Fly…)

# ── build ────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim
# Chromium para a exportação de PDF (puppeteer-core). Antes era uma dependência
# oculta do ambiente da plataforma: fora dela o PDF quebraria sem aviso.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-dejavu-core fonts-liberation tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    APP_ROOT=/app \
    PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts/catalogo-lios.json ./scripts/catalogo-lios.json
USER node
EXPOSE 8080
# tini como PID 1 (sinais e processos-zumbi do Chromium). O bootstrap aplica
# migrations e garante o catálogo antes de o servidor aceitar requisições.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "node dist/bootstrap.js && exec node dist/index.js"]
