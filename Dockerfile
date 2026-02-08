FROM node:20-slim

WORKDIR /app

# Copy root package files + tsconfig
COPY package.json package-lock.json tsconfig.base.json ./

# Copy shared package
COPY packages/shared/ packages/shared/

# Copy facilitator package
COPY packages/facilitator/ packages/facilitator/

# Install all deps from root (monorepo)
RUN npm install --workspace=packages/shared --workspace=packages/facilitator

# Build shared package first (facilitator depends on it)
RUN cd packages/shared && npm run build

# Install tsx globally for fast startup
RUN npm install -g tsx

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser
USER appuser

EXPOSE 3000

WORKDIR /app/packages/facilitator
CMD ["tsx", "src/server.ts"]
