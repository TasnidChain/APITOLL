# Contributing to API Toll

Thanks for your interest in contributing to API Toll! This project is building open-source payment infrastructure for AI agents, and contributions of all kinds are welcome.

## Getting Started

```bash
git clone https://github.com/TasnidChain/APITOLL.git
cd APITOLL
npm install
npm run build
npm test
```

### Project Structure

This is a monorepo with the following packages:

| Package | Path | Description |
|---------|------|-------------|
| `@apitoll/shared` | `packages/shared` | Core types, USDC utilities, chain configs |
| `@apitoll/seller-sdk` | `packages/seller-sdk` | Express & Hono middleware for API monetization |
| `@apitoll/buyer-sdk` | `packages/buyer-sdk` | Agent wallet with auto-402 handling and policy engine |
| `@apitoll/facilitator` | `packages/facilitator` | x402 payment relay with on-chain verification |
| `@apitoll/mcp-server` | `packages/mcp-server` | MCP server with paid tools support |
| `@apitoll/langchain` | `packages/langchain` | LangChain and CrewAI adapters |

Apps live in `apps/` (dashboard, seller-api, agent-client, indexer, discovery).

## How to Contribute

### Bug Reports

Open an issue at [github.com/TasnidChain/APITOLL/issues](https://github.com/TasnidChain/APITOLL/issues) with:

- Steps to reproduce
- Expected vs actual behavior
- Package name and version
- Node.js version

### Feature Requests

Open an issue with the `enhancement` label. Describe the use case and why it matters for the agent payment ecosystem.

### Pull Requests

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add or update tests if applicable
4. Run `npm run build && npm test` to verify
5. Submit a PR with a clear description of what changed and why

### Areas We'd Love Help With

- **New signer modes** for additional chains
- **Agent framework integrations** (AutoGPT, BabyAGI, etc.)
- **Seller SDK middleware** for Fastify, Koa, or other frameworks
- **Documentation improvements** and tutorials
- **Testing** — more unit and integration tests
- **Security audits** and vulnerability reports (see [SECURITY.md](./SECURITY.md))

## Development Workflow

```bash
# Build all packages (shared must build first)
npm run build

# Run tests
npm test

# Run the facilitator locally
cd packages/facilitator
npm start

# Run the dashboard locally
cd apps/dashboard
npm run dev
```

### Environment Setup

Copy `.env.example` to `.env.local` and fill in the required values. See the [Quick Start Guide](./docs/quickstart.md) for details.

## Code Style

- TypeScript throughout
- No unnecessary comments or docstrings — code should be self-explanatory
- Keep changes focused — one concern per PR
- Follow existing patterns in the codebase

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
