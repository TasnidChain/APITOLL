# Security

This document describes security measures and decisions in the API Toll platform.

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

- **Email**: security@apitoll.com
- **GitHub**: Open a private security advisory at [github.com/TasnidChain/APITOLL/security](https://github.com/TasnidChain/APITOLL/security/advisories)

Do **not** open a public issue for security vulnerabilities.

## Architecture Security

### SSRF Protection

All outbound HTTP requests in `seller-api` use `safe-fetch.ts`, which blocks:

- Private/internal IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x)
- IPv6-mapped private addresses
- DNS rebinding attacks (re-resolves after redirect)
- Redirect-based SSRF (validates each hop)
- Cloud metadata endpoints (169.254.169.254)

### RCE Prevention

- The `vm` module sandbox (`/api/exec`) was **removed** because `vm` is not a security boundary. The `this.constructor.constructor` chain allows full RCE. See comments in `server.ts`.
- Regex execution is sandboxed in a **Worker thread** with a 3-second timeout to prevent ReDoS denial of service. The worker code is pre-defined (not derived from user input).

### Input Validation

- All facilitator endpoints use **Zod schemas** for strict input validation.
- Payment amounts are capped at $100 USDC per transaction (safety cap).
- Wallet addresses are validated against `ethers.isAddress()`.
- Request body size is limited (1MB facilitator, 25MB seller-api for PDF uploads).

### Authentication & Authorization

- Facilitator requires **Bearer token** authentication (API keys).
- API keys are compared using **constant-time comparison** (`secureCompare`) to prevent timing attacks.
- Seller middleware verifies payment proofs on-chain before serving paid responses.

### Rate Limiting

Both facilitator and seller-api implement rate limiting with:

- **Redis-backed** counters (when available) for distributed deployments.
- **In-memory fallback** with automatic failover via circuit breaker pattern.
- Per-IP and per-API-key limits with `Retry-After` headers.

### Security Headers

All responses include:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Error Monitoring

- **Sentry** integration in the facilitator for error tracking and performance monitoring.
- Structured **pino/JSON logging** for production log aggregation.
- Global `unhandledRejection` and `uncaughtException` handlers prevent silent failures.

## Wallet & Payment Security

### Facilitator Wallet

The facilitator holds a custodial hot wallet for executing USDC transfers. Key security measures:

- Private key loaded from environment variable only (never committed to code).
- Maximum payment cap prevents large unauthorized transfers.
- All transactions are persisted to Convex for audit trail.
- Convex mutations require a shared secret (`FACILITATOR_CONVEX_SECRET`).

### Self-Custody Options

Agents can avoid custodial risk by using self-custody signers:

1. **Local EVM Signer** — Agent signs transactions locally with their own private key.
2. **Local Solana Signer** — Same for Solana/SPL token transfers.
3. **Direct Signers** — Pre-signed transactions are broadcast by the facilitator without accessing private keys.

### Environment Variables

All secrets are externalized to environment variables. The following are required:

| Variable | Description |
|----------|-------------|
| `FACILITATOR_PRIVATE_KEY` | Hot wallet private key (EVM) |
| `SELLER_WALLET` | Seller's receiving wallet address |
| `FACILITATOR_API_KEYS` | Comma-separated API keys for auth |
| `FACILITATOR_CONVEX_SECRET` | Shared secret for Convex mutations |

Optional but recommended:

| Variable | Description |
|----------|-------------|
| `SOLANA_PRIVATE_KEY` | Enables Solana payment support |
| `SENTRY_DSN` | Error monitoring |
| `REDIS_URL` | Distributed rate limiting |
| `ALLOWED_ORIGINS` | CORS allowlist |

## Dependency Security

- Dependencies are pinned with lockfile (`package-lock.json`).
- No native/compiled dependencies in published packages.
- All peer dependencies are optional to minimize attack surface.
- CI runs on Node.js 18, 20, and 22 for compatibility testing.

## Graceful Shutdown

Both servers implement graceful shutdown:

- `SIGTERM`/`SIGINT` handlers drain active connections before exiting.
- 10-15 second timeout forces exit if connections don't drain.
- Sentry events are flushed before process exit.
