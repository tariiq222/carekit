# syntax=docker/dockerfile:1.6
# CareKit Dashboard — Next.js 15 production build (App Router).
# Build context MUST be the monorepo root.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/shared/package.json ./packages/shared/

ARG TARGETARCH
RUN npm ci --workspaces --include-workspace-root \
 && if [ "$TARGETARCH" = "arm64" ]; then \
      npm install --no-save --ignore-scripts=false \
        lightningcss-linux-arm64-gnu \
        @tailwindcss/oxide-linux-arm64-gnu; \
    else \
      npm install --no-save --ignore-scripts=false \
        lightningcss-linux-x64-gnu \
        @tailwindcss/oxide-linux-x64-gnu; \
    fi

FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=dashboard

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
