/**
 * Example: AI agent that autonomously pays for API access with budget controls.
 *
 * Run: npx ts-node examples/buyer-agent/research-bot.ts
 *
 * This agent:
 * 1. Discovers paid tools via x402
 * 2. Checks budget policies before every payment
 * 3. Auto-handles 402 → sign → retry flow
 * 4. Tracks all spending for analytics
 */

import { createAgentWallet } from "@apitoll/buyer-sdk";

// ─── Configure the agent wallet ─────────────────────────────────

const agent = createAgentWallet({
  name: "ResearchBot",
  chain: "base",

  // Budget policies — enforced before every payment
  policies: [
    {
      type: "budget",
      dailyCap: 50,          // Max $50 USDC per day
      weeklyCap: 200,        // Max $200 USDC per week
      maxPerRequest: 0.10,   // Max $0.10 per single request
    },
    {
      type: "vendor_acl",
      allowedVendors: ["*"], // Allow all vendors (or specify a whitelist)
      blockedVendors: [],    // Block specific bad actors
    },
    {
      type: "rate_limit",
      maxPerMinute: 60,      // Max 60 requests per minute
      maxPerHour: 1000,      // Max 1000 requests per hour
    },
  ],

  // Wallet signer (in production, use a proper key management solution)
  signer: async (requirements, chain) => {
    // This is where you'd sign the payment with the agent's private key.
    // The x402 SDK handles the actual signing for EVM (EIP-3009) and Solana (SPL).
    //
    // Example with @x402/evm:
    //   import { signPayment } from "@x402/evm";
    //   return signPayment(requirements[0], privateKey);
    //
    // For this example, we return a placeholder.
    console.log(`  💳 Signing payment: $${requirements[0]?.maxAmountRequired} on ${chain}`);
    return Buffer.from(JSON.stringify({ signed: true })).toString("base64");
  },

  // Enable evolution — agent self-optimizes after each successful tx
  evolution: {
    onMutation: (m) => {
      console.log(`  🧬 Evolved: ${m.type} ${m.from} → ${m.to}`);
    },
  },

  // Event callbacks
  onPayment: (receipt, url) => {
    console.log(`  ✅ Paid $${receipt.amount} → ${url}`);
  },
  onPolicyRejection: (result, url) => {
    console.log(`  🚫 Policy rejected: ${result.reason} → ${url}`);
  },
  onError: (error, url) => {
    console.log(`  ❌ Error: ${error.message} → ${url}`);
  },
});

// ─── Use the agent to call paid APIs ────────────────────────────

async function runResearchTask() {
  console.log("\n🤖 ResearchBot starting task: Weather data collection\n");

  try {
    // This call will:
    // 1. Hit the API → get 402 response
    // 2. Parse payment requirements
    // 3. Check budget policy ($0.002 < $0.10 max per request ✓)
    // 4. Sign USDC payment
    // 5. Retry with X-PAYMENT header
    // 6. Return the data
    console.log("📡 Fetching weather forecast...");
    const forecast = await agent.fetch("http://localhost:3001/api/forecast?city=Tokyo");

    if (forecast.ok) {
      const data = await forecast.json();
      console.log(`  📊 Got forecast for ${data.city}: ${data.forecast.length} days\n`);
    }

    // Second call — budget still within limits
    console.log("📡 Fetching historical data...");
    const historical = await agent.fetch("http://localhost:3001/api/historical?city=Tokyo&days=14");

    if (historical.ok) {
      const data = await historical.json();
      console.log(`  📊 Got ${data.data.length} days of historical data\n`);
    }

    // Free endpoint — no payment needed, passes through normally
    console.log("📡 Checking API health (free)...");
    const health = await agent.fetch("http://localhost:3001/api/health");
    if (health.ok) {
      console.log(`  ✅ API is healthy\n`);
    }

  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Task failed: ${error.message}`);
    }
  }

  // Print spend summary
  const summary = agent.getSpendSummary();
  console.log("─".repeat(50));
  console.log("📊 Spend Summary:");
  console.log(`   Today:        $${summary.today.toFixed(4)}`);
  console.log(`   This week:    $${summary.thisWeek.toFixed(4)}`);
  console.log(`   Transactions: ${summary.transactionCount}`);
  console.log("─".repeat(50));

  // Print transaction log
  const txns = agent.getTransactions();
  if (txns.length > 0) {
    console.log("\n📜 Transaction Log:");
    txns.forEach((tx) => {
      console.log(
        `   ${tx.id} | ${tx.endpoint} | $${tx.amount} | ${tx.chain} | ${tx.status}`
      );
    });
  }
}

runResearchTask();
