#!/usr/bin/env npx tsx
/**
 * Create a new EVM wallet for use with API Toll.
 *
 * Usage:
 *   npx tsx scripts/create-wallet.ts
 *   npx tsx scripts/create-wallet.ts --role facilitator
 *   npx tsx scripts/create-wallet.ts --role seller
 *   npx tsx scripts/create-wallet.ts --role agent
 *
 * WARNING: This generates a private key. Store it securely!
 * Never commit private keys to git. Use environment variables.
 */

import { ethers } from "ethers";

const role = process.argv.find((a) => a === "--role")
  ? process.argv[process.argv.indexOf("--role") + 1]
  : "general";

const wallet = ethers.Wallet.createRandom();

console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   New EVM Wallet Created                                     ║
║   Role: ${role.padEnd(51)}║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

  Address:     ${wallet.address}
  Private Key: ${wallet.privateKey}

  ⚠️  SAVE THE PRIVATE KEY SECURELY — you cannot recover it!
  ⚠️  NEVER commit it to git or share it publicly.
`);

if (role === "facilitator") {
  console.log(`
  ── Facilitator Setup ──────────────────────────────────────

  1. Fund this wallet with:
     • ETH on Base (for gas) — ~$5 worth is plenty
     • USDC on Base (for payments) — start with $10-100

  2. Add to your facilitator .env:
     FACILITATOR_PRIVATE_KEY=${wallet.privateKey.slice(2)}

  3. On Railway, set the environment variable:
     railway variables set FACILITATOR_PRIVATE_KEY=${wallet.privateKey.slice(2)}

  4. Fund the wallet:
     • Send ETH: ${wallet.address}
     • Send USDC (Base): ${wallet.address}
     • USDC contract: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

  5. Verify balance:
     https://basescan.org/address/${wallet.address}
`);
} else if (role === "seller") {
  console.log(`
  ── Seller Setup ───────────────────────────────────────────

  This is your receiving address. Agents pay USDC to this wallet.
  You don't need a private key for selling — just the address.

  1. Add to your seller .env:
     SELLER_WALLET=${wallet.address}

  2. On Railway:
     railway variables set SELLER_WALLET=${wallet.address}

  3. Monitor incoming payments:
     https://basescan.org/address/${wallet.address}
`);
} else if (role === "agent") {
  console.log(`
  ── Agent Setup ────────────────────────────────────────────

  This identifies your agent. The facilitator pays on your behalf,
  so you don't need to fund this wallet directly.

  1. Add to your agent .env:
     AGENT_WALLET=${wallet.address}

  2. Or use in code:
     const agent = createAgentWallet({
       signer: createFacilitatorSigner(facilitatorUrl, apiKey, "${wallet.address}"),
     });
`);
} else {
  console.log(`
  ── Usage ──────────────────────────────────────────────────

  Run with a specific role for detailed setup instructions:

    npx tsx scripts/create-wallet.ts --role facilitator
    npx tsx scripts/create-wallet.ts --role seller
    npx tsx scripts/create-wallet.ts --role agent
`);
}
