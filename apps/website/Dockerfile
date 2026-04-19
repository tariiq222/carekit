# syntax=docker/dockerfile:1.6
# CareKit Public Website — Next.js 15 standalone build
# Build context MUST be the monorepo root.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/website/package.json ./apps/website/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/shared/package.json ./packages/shared/
# npm ci keeps the package-lock platform selection, which on Windows hosts
# omits the target linux optional binaries (lightningcss, tailwindcss).
# Force them in for the image's actual arch so Tailwind v4's native CSS
# engine can load on both x64 runners (CI) and arm64 hosts (Apple Silicon).
RUN ARCH=$(uname -m | sed 's/aarch64/arm64/;s/x86_64/x64/') \
 && npm ci --workspaces --include-workspace-root \
 && npm install --no-save --ignore-scripts=false \
      lightningcss-linux-${ARCH}-gnu \
      @tailwindcss/oxide-linux-${ARCH}-gnu

FROM node:20-bookworm-slim AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=@carekit/shared --if-present
RUN npm run build --workspace=@carekit/api-client --if-present
RUN npm run build --workspace=website

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5104
ENV HOSTNAME=0.0.0.0

# Standalone output includes a minimal node_modules + server.js.
# outputFileTracingRoot=<monorepo root> causes the standalone dir to mirror
# the monorepo layout, so we copy it to /app and run apps/website/server.js.
COPY --from=builder /app/apps/website/.next/standalone ./
COPY --from=builder /app/apps/website/.next/static ./apps/website/.next/static

EXPOSE 5104
CMD ["node", "apps/website/server.js"]
