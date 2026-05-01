# syntax=docker/dockerfile:1.6
# Deqah Super-Admin — Next.js 15 production build (App Router).
# Build context MUST be the monorepo root.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY apps/admin/package.json ./apps/admin/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/

ARG TARGETARCH
RUN pnpm install --frozen-lockfile \
 && if [ "$TARGETARCH" = "arm64" ]; then \
      pnpm add --no-save --ignore-scripts=false \
        lightningcss-linux-arm64-gnu \
        @tailwindcss/oxide-linux-arm64-gnu; \
    else \
      pnpm add --no-save --ignore-scripts=false \
        lightningcss-linux-x64-gnu \
        @tailwindcss/oxide-linux-x64-gnu; \
    fi

FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter=@deqah/shared run build --if-present
RUN pnpm --filter=@deqah/api-client run build --if-present
RUN pnpm --filter=@deqah/ui run build --if-present
RUN pnpm --filter=admin run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5104
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/admin/package.json ./apps/admin/package.json
COPY --from=builder /app/apps/admin/next.config.mjs ./apps/admin/next.config.mjs
COPY --from=builder /app/apps/admin/.next ./apps/admin/.next

WORKDIR /app/apps/admin
EXPOSE 5104

CMD ["npx", "next", "start", "-p", "5104", "-H", "0.0.0.0"]
