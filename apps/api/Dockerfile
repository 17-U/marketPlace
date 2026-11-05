# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

FROM base AS dev
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile=false
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
RUN pnpm --filter @marketplace/shared build
WORKDIR /app/apps/api
RUN pnpm prisma:generate
EXPOSE 4000
CMD ["pnpm", "dev"]

FROM base AS builder
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile=false
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
RUN pnpm --filter @marketplace/shared build
WORKDIR /app/apps/api
RUN pnpm prisma:generate && pnpm build

FROM node:20-alpine AS prod
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages/shared ./packages/shared
WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/main.js"]
