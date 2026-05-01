# syntax=docker/dockerfile:1.6
# Deqah Dashboard — Next.js 15 production build (App Router).
# Build context MUST be the monorepo root.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY apps/dashboard/package.json ./apps/dashboard/
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
RUN pnpm --filter=dashboard run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5103
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/dashboard/package.json ./apps/dashboard/package.json
COPY --from=builder /app/apps/dashboard/next.config.mjs ./apps/dashboard/next.config.mjs
COPY --from=builder /app/apps/dashboard/.next ./apps/dashboard/.next
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public

WORKDIR /app/apps/dashboard
EXPOSE 5103

CMD ["npx", "next", "start", "-p", "5103", "-H", "0.0.0.0"]
