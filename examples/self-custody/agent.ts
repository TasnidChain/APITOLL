/**
 * Example: Self-Custody Wallet Agent
 *
 * Run: AGENT_PRIVATE_KEY=0x... npx tsx examples/self-custody/agent.ts
 *
 * This demonstrates self-custody mode where the agent holds its own
 * private key and signs USDC transfers locally — the facilitator
 * only broadcasts the pre-signed transaction but never touches keys.
 *
 * Three signer modes:
 *   1. Facilitator (custodial)    — createFacilitatorSigner()  — keys on facilitator
 *   2. Local + facilitator relay  — createLocalEVMSigner()     — keys local, broadcast via facilitator
 *   3. Direct broadcast           — createDirectEVMSigner()    — fully decentralized, no facilitator
 *
 * This example shows all three side-by-side for comparison.
 */

import {
  createAgentWallet,
  createFacilitatorSigner,
  createLocalEVMSigner,
  createDirectEVMSigner,
  createLocalSolanaSigner,
  createDirectSolanaSigner,
  type PaymentSigner,
} from "@apitoll/buyer-sdk";

const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://pay.apitoll.com";
const SELLER_API = process.env.SELLER_API_URL || "http://localhost:4402";


async function testPaidCall(
  label: string,
  agent: ReturnType<typeof createAgentWallet>
) {
  console.log(`\n[${label}] Making paid API call...`);
  try {
    const response = await agent.fetch(
      `${SELLER_API}/api/search?q=${encodeURIComponent("self-custody wallets")}`
    );
    if (response.ok) {
      const data = await response.json();
      console.log(`  [${label}] Success! Response:`, JSON.stringify(data).slice(0, 100));
    } else {
      console.log(`  [${label}] HTTP ${response.status}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  [${label}] Error: ${msg.slice(0, 120)}`);
  }

  const spend = agent.getSpendSummary();
  console.log(`  [${label}] Spent: $${spend.today.toFixed(6)} USDC (${spend.transactionCount} txs)`);
}


function createMockSigner(): PaymentSigner {
  return async () =>
    Buffer.from(JSON.stringify({ mock: true, selfCustody: false })).toString("base64");
}


async function main() {
  console.log("Self-Custody Wallet Examples");
  console.log("===========================\n");

  const privateKey = process.env.AGENT_PRIVATE_KEY;
  const solanaKey = process.env.SOLANA_PRIVATE_KEY;
  const apiKey = process.env.FACILITATOR_API_KEY;


  console.log("Mode 1: Custodial (facilitator holds keys)");
  console.log("---");
  console.log("  Agent calls facilitator → facilitator signs & broadcasts");
  console.log("  Pros: Simple setup, no key management");
  console.log("  Cons: Trust facilitator with funds\n");

  const custodialAgent = createAgentWallet({
    name: "Custodial-Agent",
    chain: "base",
    policies: [
      { type: "budget" as const, dailyCap: 5.0, maxPerRequest: 0.05 },
      { type: "vendor_acl" as const, allowedVendors: ["*"] },
    ],
    signer: apiKey
      ? createFacilitatorSigner(FACILITATOR_URL, apiKey, "")
      : createMockSigner(),
    evolution: true,
  });

  await testPaidCall("Custodial", custodialAgent);


  console.log("\n\nMode 2: Self-Custody + Facilitator Relay");
  console.log("---");
  console.log("  Agent signs locally → sends pre-signed tx → facilitator broadcasts");
  console.log("  Pros: Agent keeps keys, facilitator never sees private key");
  console.log("  Cons: Still depends on facilitator for broadcasting\n");

  if (privateKey) {
    const localAgent = createAgentWallet({
      name: "SelfCustody-Relay",
      chain: "base",
      policies: [
        { type: "budget" as const, dailyCap: 5.0, maxPerRequest: 0.05 },
        { type: "vendor_acl" as const, allowedVendors: ["*"] },
      ],
      signer: createLocalEVMSigner({
        privateKey,
        rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
        facilitatorUrl: FACILITATOR_URL,
        apiKey,
      }),
      evolution: true,
    });

    await testPaidCall("SelfCustody-Relay", localAgent);
  } else {
    console.log("  [Skipped] Set AGENT_PRIVATE_KEY to test self-custody EVM mode");
  }


  console.log("\n\nMode 3: Direct Broadcast (no facilitator)");
  console.log("---");
  console.log("  Agent signs locally → broadcasts directly to chain");
  console.log("  Pros: Fully decentralized, no intermediary");
  console.log("  Cons: Agent needs RPC access, pays gas directly\n");

  if (privateKey) {
    const directAgent = createAgentWallet({
      name: "SelfCustody-Direct",
      chain: "base",
      policies: [
        { type: "budget" as const, dailyCap: 5.0, maxPerRequest: 0.05 },
        { type: "vendor_acl" as const, allowedVendors: ["*"] },
      ],
      signer: createDirectEVMSigner({
        privateKey,
        rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
        confirmations: 2,
      }),
      evolution: true,
    });

    await testPaidCall("Direct-EVM", directAgent);
  } else {
    console.log("  [Skipped] Set AGENT_PRIVATE_KEY to test direct EVM broadcast");
  }


  console.log("\n\nSolana Self-Custody Modes");
  console.log("---");

  if (solanaKey) {
    const solanaRelayAgent = createAgentWallet({
      name: "Solana-SelfCustody",
      chain: "solana",
      policies: [
        { type: "budget" as const, dailyCap: 5.0, maxPerRequest: 0.05 },
        { type: "vendor_acl" as const, allowedVendors: ["*"] },
      ],
      signer: createLocalSolanaSigner({
        privateKey: solanaKey,
        rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
        facilitatorUrl: FACILITATOR_URL,
        apiKey,
      }),
      evolution: true,
    });

    await testPaidCall("Solana-Relay", solanaRelayAgent);

    const solanaDirectAgent = createAgentWallet({
      name: "Solana-Direct",
      chain: "solana",
      policies: [
        { type: "budget" as const, dailyCap: 5.0, maxPerRequest: 0.05 },
        { type: "vendor_acl" as const, allowedVendors: ["*"] },
      ],
      signer: createDirectSolanaSigner({
        privateKey: solanaKey,
        rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
      }),
      evolution: true,
    });

    await testPaidCall("Solana-Direct", solanaDirectAgent);
  } else {
    console.log("  [Skipped] Set SOLANA_PRIVATE_KEY to test Solana self-custody");
  }


  console.log(`\n${"=".repeat(50)}`);
  console.log("SIGNER COMPARISON");
  console.log(`${"=".repeat(50)}`);
  console.log(`
  | Signer                   | Key Location | Broadcast     | Trust Model    |
  |--------------------------|-------------|---------------|----------------|
  | createFacilitatorSigner  | Facilitator | Facilitator   | Custodial      |
  | createLocalEVMSigner     | Agent local | Via facilitator| Semi-custodial |
  | createDirectEVMSigner    | Agent local | Direct to chain| Fully sovereign|
  | createLocalSolanaSigner  | Agent local | Via facilitator| Semi-custodial |
  | createDirectSolanaSigner | Agent local | Direct to chain| Fully sovereign|
  `);
}

main().catch(console.error);
