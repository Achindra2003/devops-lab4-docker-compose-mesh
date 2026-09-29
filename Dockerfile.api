# =========================================================================
# PRODUCTION-GRADE MULTI-STAGE OCI DOCKERFILE FOR MESHPULSE API
# MCA Trimester 5 - DevOps Lab 4
# Author: Achindra Sharma (2547105)
# =========================================================================

# Stage 1: Build & Prune
FROM node:22-alpine AS builder
WORKDIR /build
COPY package*.json ./
# Zero external runtime dependencies, but initialize package lock cleanly
RUN npm cache clean --force

# Stage 2: Minimal Hardened Runtime (~138 MB)
FROM node:22-alpine AS runner

LABEL org.opencontainers.image.title="MeshPulse API" \
      org.opencontainers.image.description="Cloud-Native Multi-Container Microservice with Network & Storage Validation" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.authors="Achindra Sharma <2547105>" \
      org.opencontainers.image.vendor="Achindra Sharma" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    PORT=3000 \
    REDIS_HOST=cache \
    REDIS_PORT=6379

WORKDIR /app

# Ensure proper directory ownership before dropping privileges
RUN chown -R node:node /app

# Copy application assets
COPY --chown=node:node package*.json ./
COPY --chown=node:node server.js ./
COPY --chown=node:node public ./public

# Switch to least-privilege non-root user (UID 1000)
USER node

EXPOSE 3000

# Native Container Healthcheck for Orchestration Ordering
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]
