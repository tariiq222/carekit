FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/backend/prisma ./apps/backend/prisma/
COPY apps/backend/prisma.config.ts ./apps/backend/
RUN npm install -w backend --ignore-scripts \
    && cd apps/backend \
    && DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Build
FROM deps AS build
COPY apps/backend/src ./apps/backend/src/
COPY apps/backend/tsconfig.json apps/backend/tsconfig.build.json apps/backend/nest-cli.json ./apps/backend/
RUN cd apps/backend && npm run build

# Production
FROM base AS production
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/src/i18n ./apps/backend/src/i18n
COPY --from=deps /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=deps /app/apps/backend/prisma.config.ts ./apps/backend/
COPY --from=deps /app/apps/backend/package.json ./apps/backend/

WORKDIR /app/apps/backend
EXPOSE 5100

CMD ["node", "dist/src/main.js"]
