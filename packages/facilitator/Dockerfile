FROM node:20-slim

WORKDIR /app

# Copy shared package first (dependency)
COPY packages/shared/package.json packages/shared/
COPY packages/shared/dist/ packages/shared/dist/

# Copy facilitator
COPY packages/facilitator/package.json packages/facilitator/
WORKDIR /app/packages/facilitator
RUN npm install --omit=dev

COPY packages/facilitator/src/ src/

# tsx for running TypeScript directly
RUN npm install tsx

EXPOSE 3000

CMD ["npx", "tsx", "src/server.ts"]
