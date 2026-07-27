# Dockerfile — la imagen cumple su propia spec (Módulo Plataforma, vídeo 1):
# multi-stage, < 100 MB, usuario no-root UID>10000, healthcheck, labels OCI.

# syntax=docker/dockerfile:1.6
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build            # tsc → dist/

FROM node:22-alpine
WORKDIR /app
RUN addgroup -g 10001 app && adduser -u 10001 -G app -s /bin/false -D app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER app
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
# revision/created los inyecta el pipeline vía build-args; defaults para build local.
ARG GIT_SHA=dev
ARG BUILD_DATE=1970-01-01T00:00:00Z
LABEL org.opencontainers.image.source="https://github.com/master-ia/telco-api" \
      org.opencontainers.image.version="0.1.0" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}"
CMD ["node", "dist/server.js"]
