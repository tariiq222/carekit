# syntax=docker/dockerfile:1.6
# Deqah Public Website — Next.js 15 standalone build
# Build context MUST be the monorepo root.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY apps/website/package.json ./apps/website/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/shared/package.json ./packages/shared/
# Force linux native binaries for the image's actual arch so Tailwind v4's
# native CSS engine can load on both x64 runners (CI) and arm64 hosts.
RUN ARCH=$(uname -m | sed 's/aarch64/arm64/;s/x86_64/x64/') \
 && pnpm install --frozen-lockfile \
 && pnpm add --no-save --ignore-scripts=false \
      lightningcss-linux-${ARCH}-gnu \
      @tailwindcss/oxide-linux-${ARCH}-gnu

FROM node:20-bookworm-slim AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter=@deqah/shared run build --if-present
RUN pnpm --filter=@deqah/api-client run build --if-present
RUN pnpm --filter=website run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5105
ENV HOSTNAME=0.0.0.0

# Standalone output includes a minimal node_modules + server.js.
# outputFileTracingRoot=<monorepo root> causes the standalone dir to mirror
# the monorepo layout, so we copy it to /app and run apps/website/server.js.
COPY --from=builder /app/apps/website/.next/standalone ./
COPY --from=builder /app/apps/website/.next/static ./apps/website/.next/static

EXPOSE 5105
CMD ["node", "apps/website/server.js"]
