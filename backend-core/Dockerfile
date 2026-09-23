# Najmah Backend Core
# Build context: Najmah-AI-Platform repository root

FROM node:22-alpine AS builder

WORKDIR /app

# Install backend dependencies first for Docker layer caching
COPY backend-core/package.json backend-core/package-lock.json ./backend-core/

WORKDIR /app/backend-core
RUN npm ci

# Backend needs ../shared during TypeScript compilation
WORKDIR /app
COPY shared ./shared
COPY backend-core ./backend-core

WORKDIR /app/backend-core
RUN npm run build


# --------------------------------------------------
# Production runtime
# --------------------------------------------------

FROM node:22-alpine AS runner

WORKDIR /app/backend-core

ENV NODE_ENV=production
ENV PORT=3000

COPY backend-core/package.json backend-core/package-lock.json ./

RUN npm ci --omit=dev \
    && npm cache clean --force

COPY --from=builder /app/backend-core/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/v2/health/live || exit 1

CMD ["node", "dist/backend-core/src/main.js"]
