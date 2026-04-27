# ─────────────────────────────────────────────────────────────
#  Stage 1: Build the React client
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS client-build

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --silent
COPY client/ ./
RUN npm run build

# ─────────────────────────────────────────────────────────────
#  Stage 2: Production server
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS server

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Install server deps only (no devDeps)
COPY package*.json ./
RUN npm ci --only=production --silent

# Copy server source
COPY index.js config.js logger.js telegram.js tokenStore.js ./

# Copy built React app from Stage 1
COPY --from=client-build /app/client/build ./client/build

# Switch to non-root
USER appuser

# Expose port
EXPOSE 4000

# Health check for orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

ENV NODE_ENV=production

CMD ["node", "index.js"]
