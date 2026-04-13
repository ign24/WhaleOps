FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# --- deps ---
FROM base AS deps
COPY package.json ./
# Copy lockfile if exists (bun.lock from dev, or package-lock.json)
COPY bun.loc[k] package-lock.jso[n] ./
RUN npm install --legacy-peer-deps

# --- build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- production ---
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# standalone output (includes only necessary node_modules)
COPY --from=build /app/.next/standalone ./
# static assets (not included by standalone by default)
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# local data (users.json)
COPY --from=build /app/data ./data

RUN chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
