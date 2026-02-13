FROM node:20-slim

WORKDIR /app

# Install tsx globally for running TypeScript directly
RUN npm install -g tsx

# Copy package files (monorepo structure)
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY apps/hireable-agents/package.json apps/hireable-agents/

# Install dependencies
RUN npm install --workspace=packages/shared --workspace=packages/mcp-server --workspace=apps/hireable-agents

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/mcp-server/ packages/mcp-server/
COPY apps/hireable-agents/ apps/hireable-agents/

# Build workspace packages
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/mcp-server

# Non-root user
RUN adduser --system --uid 1001 appuser
USER appuser

EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3005/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["tsx", "apps/hireable-agents/server.ts"]
