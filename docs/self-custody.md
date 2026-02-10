# Self-Custody Wallet Guide

## Overview

Self-custody mode allows AI agents to hold their own private keys and sign USDC transfers locally. The facilitator never sees the agent's private key — it only broadcasts pre-signed transactions.

## Signer Comparison

| Signer | Key Location | Broadcast | Trust Model | Use Case |
|--------|-------------|-----------|-------------|----------|
| `createFacilitatorSigner` | Facilitator | Facilitator | Custodial | Simplest setup, quick start |
| `createLocalEVMSigner` | Agent local | Via facilitator | Semi-custodial | Agent keeps keys, needs facilitator for broadcast |
| `createDirectEVMSigner` | Agent local | Direct to chain | Fully sovereign | No intermediary at all |
| `createLocalSolanaSigner` | Agent local | Via facilitator | Semi-custodial | Solana with facilitator relay |
| `createDirectSolanaSigner` | Agent local | Direct to chain | Fully sovereign | Fully decentralized Solana |

## EVM (Base) Self-Custody

### Mode A: Local Sign + Facilitator Broadcast

```typescript
import { createAgentWallet, createLocalEVMSigner } from "@apitoll/buyer-sdk";

const agent = createAgentWallet({
  name: "SelfCustody-Relay",
  chain: "base",
  policies: [
    { type: "budget", dailyCap: 5.0, maxPerRequest: 0.05 },
    { type: "vendor_acl", allowedVendors: ["*"] },
  ],
  signer: createLocalEVMSigner({
    privateKey: process.env.AGENT_PRIVATE_KEY!,
    rpcUrl: "https://mainnet.base.org",
    facilitatorUrl: "https://pay.apitoll.com",
    apiKey: process.env.FACILITATOR_API_KEY,
  }),
});
```

**Flow:**
1. Agent receives 402 with payment requirements
2. Agent builds ERC-20 `transfer()` transaction locally
3. Agent signs the transaction with its own private key
4. Sends the pre-signed transaction to the facilitator
5. Facilitator broadcasts to Base (never touches the private key)

### Mode B: Direct Broadcast (No Facilitator)

```typescript
import { createAgentWallet, createDirectEVMSigner } from "@apitoll/buyer-sdk";

const agent = createAgentWallet({
  name: "FullySovereign",
  chain: "base",
  policies: [
    { type: "budget", dailyCap: 5.0, maxPerRequest: 0.05 },
  ],
  signer: createDirectEVMSigner({
    privateKey: process.env.AGENT_PRIVATE_KEY!,
    rpcUrl: "https://mainnet.base.org",
    confirmations: 2,
  }),
});
```

**Flow:**
1. Agent receives 402
2. Agent builds, signs, and broadcasts the ERC-20 transfer directly
3. Waits for block confirmations
4. Returns payment proof to seller

## Solana Self-Custody

### Mode A: Local Sign + Facilitator Broadcast

```typescript
import { createAgentWallet, createLocalSolanaSigner } from "@apitoll/buyer-sdk";

const agent = createAgentWallet({
  name: "Solana-Relay",
  chain: "solana",
  policies: [
    { type: "budget", dailyCap: 5.0, maxPerRequest: 0.05 },
  ],
  signer: createLocalSolanaSigner({
    privateKey: process.env.SOLANA_PRIVATE_KEY!,
    rpcUrl: "https://api.mainnet-beta.solana.com",
    facilitatorUrl: "https://pay.apitoll.com",
    apiKey: process.env.FACILITATOR_API_KEY,
  }),
});
```

### Mode B: Direct Broadcast

```typescript
import { createAgentWallet, createDirectSolanaSigner } from "@apitoll/buyer-sdk";

const agent = createAgentWallet({
  name: "Solana-Direct",
  chain: "solana",
  policies: [
    { type: "budget", dailyCap: 5.0, maxPerRequest: 0.05 },
  ],
  signer: createDirectSolanaSigner({
    privateKey: process.env.SOLANA_PRIVATE_KEY!,
    rpcUrl: "https://api.mainnet-beta.solana.com",
  }),
});
```

## Key Formats

### EVM
- Hex string with `0x` prefix: `0xabcdef1234...`
- Hex string without prefix: `abcdef1234...`

### Solana
- Base58 string: `5Zzg...` (standard Solana keypair format)
- JSON byte array: `[123,45,67,...]` (exported from `solana-keygen`)

## Peer Dependencies

Self-custody signers use dynamic imports so you only install what you need:

```bash
# For EVM self-custody
npm install ethers

# For Solana self-custody
npm install @solana/web3.js @solana/spl-token
```

## Security Considerations

1. **Never commit private keys** to version control
2. Use environment variables or a secret manager
3. For production agents, use hardware wallets or HSMs where possible
4. The `budget` policy caps spending even if the key is compromised
5. The `vendor_acl` policy restricts which sellers the agent can pay
