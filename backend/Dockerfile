# ── Stage 1: builder ──
FROM node:20-alpine AS builder
WORKDIR /app
# Pin pnpm 9: pnpm 10 terlalu strict utk build scripts (esbuild) & minimumReleaseAge
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY tests ./tests
COPY drizzle ./drizzle
RUN pnpm exec tsc

# ── Stage 2: runner ──
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh
EXPOSE 3000
CMD ["./entrypoint.sh"]
