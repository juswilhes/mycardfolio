# syntax=docker/dockerfile:1

# --- 1. Frontend bauen ----------------------------------------------------
FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- 2. Backend-Abhängigkeiten (inkl. nativer better-sqlite3) -----------
FROM node:22-bookworm-slim AS backend-deps
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm ci --omit=dev

# --- 3. Laufzeit-Image -------------------------------------------------
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/ ./
COPY --from=frontend /app/frontend/dist ./frontend/dist
ENV FRONTEND_DIST=/app/backend/frontend/dist
# SQLite-Datei auf ein persistentes Volume legen:
ENV DATABASE_PATH=/data/data.sqlite
EXPOSE 3001
CMD ["node", "src/server.js"]
