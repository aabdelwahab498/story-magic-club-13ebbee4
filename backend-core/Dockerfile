FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

COPY backend-core/package*.json ./backend-core/
COPY shared/package*.json ./shared/

RUN npm ci

COPY backend-core ./backend-core
COPY shared ./shared

WORKDIR /app/shared
RUN npm install
RUN npm run build

WORKDIR /app/backend-core
RUN npm install ../shared

RUN npm run build


FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY backend-core/package*.json ./

RUN npm ci --only=production

COPY --from=builder /app/backend-core/dist ./backend-core/dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
CMD wget --quiet --tries=1 --spider http://localhost:3000/api/v2/health/live || exit 1

CMD ["node","backend-core/dist/backend-core/src/main.js"]
