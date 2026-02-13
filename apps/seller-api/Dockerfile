FROM node:20-slim

WORKDIR /app

# Install tsx globally for running TypeScript directly
RUN npm install -g tsx

# Copy package files
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/seller-sdk/package.json packages/seller-sdk/
COPY apps/seller-api/package.json apps/seller-api/

# Install dependencies
RUN npm install --workspace=packages/shared --workspace=packages/seller-sdk --workspace=apps/seller-api

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/seller-sdk/ packages/seller-sdk/
COPY apps/seller-api/ apps/seller-api/

# Build shared types
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/seller-sdk

# Non-root user
RUN adduser --system --uid 1001 appuser
USER appuser

EXPOSE 4402

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4402/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["tsx", "apps/seller-api/server.ts"]
