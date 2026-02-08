import "dotenv/config";
import {
  createAgentWallet,
  createFacilitatorSigner,
} from "@apitoll/buyer-sdk";

const JOKE_API_URL = process.env.JOKE_API_URL || "http://localhost:4402";
const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:3000";
const FACILITATOR_API_KEY = process.env.FACILITATOR_API_KEY || "";
const AGENT_WALLET = process.env.AGENT_WALLET || "";

async function main() {
  console.log("\nJoke Agent starting...\n");

  if (!AGENT_WALLET) {
    console.error("ERROR: AGENT_WALLET environment variable required (your EVM address)");
    process.exit(1);
  }

  const agent = createAgentWallet({
    name: "JokeBot",
    chain: "base",
    policies: [
      {
        type: "budget" as const,
        dailyCap: 1.0, // $1 USDC max per day
        maxPerRequest: 0.01, // $0.01 max per request
      },
      {
        type: "vendor_acl" as const,
        allowedVendors: ["*"], // allow all vendors
      },
    ],
    signer: createFacilitatorSigner(
      FACILITATOR_URL,
      FACILITATOR_API_KEY,
      AGENT_WALLET
    ),
    // Enable evolution — agent self-optimizes after each transaction
    evolution: {
      onMutation: (m) => {
        console.log(`  [evolution] ${m.type}: ${m.from} → ${m.to} (${Math.round(m.successRate * 100)}% success rate)`);
      },
    },
    onPayment: (receipt, url) => {
      console.log(`Payment confirmed: ${receipt.txHash}`);
      console.log(`  Amount: $${receipt.amount} USDC`);
      console.log(`  Chain:  ${receipt.chain}`);
      console.log(`  To:     ${receipt.to}\n`);
    },
    onPolicyRejection: (result, url) => {
      console.error(`Policy rejected: ${result.reason}`);
    },
    onError: (error, url) => {
      console.error(`Error: ${error.message}`);
    },
  });

  try {
    console.log(`Requesting joke from ${JOKE_API_URL}/api/joke ...`);
    console.log("(If the API requires payment, the agent will auto-pay)\n");

    const response = await agent.fetch(`${JOKE_API_URL}/api/joke`);

    if (!response.ok) {
      console.error(`Request failed with status ${response.status}`);
      const text = await response.text();
      console.error(text);
      return;
    }

    const data = (await response.json()) as {
      joke: string;
      payment?: { txHash: string; amount: string; from: string; chain: string };
    };

    console.log(`Joke: ${data.joke}`);

    if (data.payment) {
      console.log(`\nPayment receipt from seller:`);
      console.log(`  TX Hash: ${data.payment.txHash}`);
      console.log(`  Amount:  $${data.payment.amount} USDC`);
      console.log(`  From:    ${data.payment.from}`);
    }

    const summary = agent.getSpendSummary();
    console.log(`\nSpend summary:`);
    console.log(`  Today: $${summary.today.toFixed(6)} USDC`);
    console.log(`  Transactions: ${summary.transactionCount}`);

    const evo = agent.getEvolutionState();
    if (evo) {
      console.log(`\nEvolution state:`);
      console.log(`  API Toll preference: ${(evo.apitollPreference * 100).toFixed(0)}%`);
      console.log(`  Escrow enabled: ${evo.useEscrow}`);
      console.log(`  Mutations applied: ${evo.mutationCount}`);
      console.log(`  Success rate: ${(evo.recentSuccessRate * 100).toFixed(0)}%`);
    }
  } catch (error) {
    console.error("\nAgent failed:", error);
  }
}

main();
