# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

FROM base AS dev
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile=false
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
RUN pnpm --filter @marketplace/shared build
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM base AS builder
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile=false
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
RUN pnpm --filter @marketplace/shared build
WORKDIR /app/apps/web
RUN pnpm build

FROM node:20-alpine AS prod
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web ./apps/web
COPY --from=builder /app/packages/shared ./packages/shared
WORKDIR /app/apps/web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start"]
