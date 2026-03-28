FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY backend/prisma ./backend/prisma/
COPY backend/prisma.config.ts ./backend/
RUN npm install -w backend --ignore-scripts \
    && cd backend \
    && DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Build
FROM deps AS build
COPY backend/src ./backend/src/
COPY backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json ./backend/
RUN cd backend && npm run build

# Production
FROM base AS production
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/src/i18n ./backend/src/i18n
COPY --from=deps /app/backend/prisma ./backend/prisma
COPY --from=deps /app/backend/prisma.config.ts ./backend/
COPY --from=deps /app/backend/package.json ./backend/

WORKDIR /app/backend
EXPOSE 5100

CMD ["node", "dist/src/main.js"]
