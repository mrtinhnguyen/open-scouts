# Dockerfile for LoopAI Production Deployment
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
# Use npm ci if package-lock.json exists, otherwise use npm install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SUPABASE_URL=https://jumqbyelszxamvupjkes.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bXFieWVsc3p4YW12dXBqa2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDU2MTEsImV4cCI6MjA4MjQyMTYxMX0.lyo4Qo0H1CqP4ZO0yUSL6k9ssrfDGiMHPCaHAtRRALY
ENV SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bXFieWVsc3p4YW12dXBqa2VzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0NTYxMSwiZXhwIjoyMDgyNDIxNjExfQ.jBzdm-k0r0Gp4K3gLKdu1YZ7lDK877KdzUsBt41hiL8
ENV DATABASE_URL=postgresql://postgres.jumqbyelszxamvupjkes:FRA%24SObn3FRA%24SObn4@aws-1-ap-south-1.pooler.supabase.com:6543/postgres

# Build Next.js
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3345

ENV PORT 3345
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
