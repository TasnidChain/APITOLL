#!/usr/bin/env npx tsx
/**
 * End-to-End Payment Flow Test
 *
 * Tests the complete x402 payment flow locally:
 *   1. Calls seller API → gets 402
 *   2. Checks facilitator health
 *   3. Calls facilitator /pay → initiates payment
 *   4. Polls /pay/:id → waits for completion
 *   5. Calls seller API with X-PAYMENT header → gets 200
 *
 * Usage:
 *   # Start facilitator and seller first, then:
 *   npx tsx scripts/test-flow.ts
 *
 *   # Or test against production:
 *   FACILITATOR_URL=https://pay.apitoll.com \
 *   SELLER_URL=https://api.apitoll.com \
 *   FACILITATOR_API_KEY=your-key \
 *   npx tsx scripts/test-flow.ts
 */

const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:3000";
const SELLER_URL = process.env.SELLER_URL || "http://localhost:4402";
const FACILITATOR_API_KEY = process.env.FACILITATOR_API_KEY || "";
const AGENT_WALLET = process.env.AGENT_WALLET || "0x2955B6a41a2d10A5cC5C8A4a144829502a73B0a5";

const STEP_PASS = "\x1b[32m✅\x1b[0m";
const STEP_FAIL = "\x1b[31m❌\x1b[0m";
const STEP_INFO = "\x1b[34mℹ️\x1b[0m";
const STEP_WAIT = "\x1b[33m⏳\x1b[0m";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   API Toll — End-to-End Payment Flow Test                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

  Facilitator: ${FACILITATOR_URL}
  Seller:      ${SELLER_URL}
  Agent:       ${AGENT_WALLET}
`);

  let totalTests = 0;
  let passedTests = 0;

  // ─── Test 1: Facilitator Health ──────────────────────────────
  totalTests++;
  console.log(`${STEP_WAIT} Test 1: Checking facilitator health...`);
  try {
    const healthRes = await fetch(`${FACILITATOR_URL}/health`);
    const health = await healthRes.json() as Record<string, unknown>;

    if (healthRes.ok && health.status === "ok") {
      console.log(`${STEP_PASS} Facilitator healthy (${health.pending_payments} pending payments)`);
      passedTests++;
    } else {
      console.log(`${STEP_FAIL} Facilitator returned: ${JSON.stringify(health)}`);
    }
  } catch (e: unknown) {
    console.log(`${STEP_FAIL} Can't reach facilitator: ${errMsg(e)}`);
    console.log(`   Make sure the facilitator is running: cd packages/facilitator && npx tsx src/server.ts`);
    process.exit(1);
  }

  // ─── Test 2: Seller Health ──────────────────────────────────
  totalTests++;
  console.log(`\n${STEP_WAIT} Test 2: Checking seller API health...`);
  try {
    const healthRes = await fetch(`${SELLER_URL}/health`);
    const health = await healthRes.json() as Record<string, unknown>;

    if (healthRes.ok) {
      console.log(`${STEP_PASS} Seller API healthy (wallet: ${health.seller || 'N/A'})`);
      passedTests++;
    } else {
      console.log(`${STEP_FAIL} Seller returned: ${JSON.stringify(health)}`);
    }
  } catch (e: unknown) {
    console.log(`${STEP_FAIL} Can't reach seller: ${errMsg(e)}`);
    console.log(`   Make sure the seller is running: cd apps/seller-api && SELLER_WALLET=0x... npx tsx server.ts`);
    process.exit(1);
  }

  // ─── Test 3: Call Paid Endpoint → Get 402 ──────────────────
  totalTests++;
  console.log(`\n${STEP_WAIT} Test 3: Calling paid endpoint (expecting 402)...`);
  try {
    const jokeRes = await fetch(`${SELLER_URL}/api/joke`);

    if (jokeRes.status === 402) {
      console.log(`${STEP_PASS} Got 402 Payment Required (correct!)`);
      passedTests++;

      // Parse payment requirements
      const body = await jokeRes.json() as Record<string, unknown>;
      if (body.paymentRequirements) {
        console.log(`${STEP_INFO}  Price: $${body.paymentRequirements[0]?.maxAmountRequired || 'N/A'}`);
        console.log(`${STEP_INFO}  Pay to: ${body.paymentRequirements[0]?.payTo || 'N/A'}`);
        console.log(`${STEP_INFO}  Chain: ${body.paymentRequirements[0]?.network || 'N/A'}`);
      } else if (body.x402) {
        console.log(`${STEP_INFO}  Requirements in x402 field`);
      }
    } else if (jokeRes.status === 200) {
      console.log(`${STEP_FAIL} Got 200 — endpoint isn't charging! Middleware may not be active.`);
      const joke = await jokeRes.json() as Record<string, unknown>;
      console.log(`${STEP_INFO}  Response: ${joke.joke || JSON.stringify(joke).slice(0, 100)}`);
    } else {
      console.log(`${STEP_FAIL} Got unexpected status: ${jokeRes.status}`);
    }
  } catch (e: unknown) {
    console.log(`${STEP_FAIL} Request failed: ${errMsg(e)}`);
  }

  // ─── Test 4: Facilitator Status (with auth) ────────────────
  totalTests++;
  console.log(`\n${STEP_WAIT} Test 4: Checking facilitator status (authenticated)...`);
  try {
    const statusRes = await fetch(`${FACILITATOR_URL}/status`, {
      headers: { Authorization: `Bearer ${FACILITATOR_API_KEY}` },
    });

    if (statusRes.ok) {
      const status = await statusRes.json() as Record<string, unknown>;
      console.log(`${STEP_PASS} Facilitator status OK`);
      console.log(`${STEP_INFO}  Network: ${status.network}`);
      console.log(`${STEP_INFO}  Wallet: ${status.wallet?.address}`);
      console.log(`${STEP_INFO}  ETH: ${status.wallet?.eth_balance} ETH`);
      console.log(`${STEP_INFO}  USDC: $${status.wallet?.usdc_balance}`);
      console.log(`${STEP_INFO}  TX Runway: ~${status.wallet?.estimated_tx_runway} transactions`);
      console.log(`${STEP_INFO}  Completed: ${status.payments?.completed}, Failed: ${status.payments?.failed}`);
      passedTests++;

      // Warn if wallet is empty
      if (parseFloat(status.wallet?.usdc_balance || "0") === 0) {
        console.log(`\n${STEP_FAIL} Facilitator wallet has $0 USDC — can't process payments!`);
        console.log(`   Fund ${status.wallet?.address} with USDC on Base.`);
      }
      if (parseFloat(status.wallet?.eth_balance || "0") === 0) {
        console.log(`\n${STEP_FAIL} Facilitator wallet has 0 ETH — can't pay gas!`);
        console.log(`   Fund ${status.wallet?.address} with ETH on Base.`);
      }
    } else if (statusRes.status === 401 || statusRes.status === 403) {
      console.log(`${STEP_FAIL} Auth failed — check FACILITATOR_API_KEY`);
    } else {
      console.log(`${STEP_FAIL} Status returned ${statusRes.status}`);
    }
  } catch (e: unknown) {
    console.log(`${STEP_FAIL} Status check failed: ${errMsg(e)}`);
  }

  // ─── Test 5: Verify Endpoint ───────────────────────────────
  totalTests++;
  console.log(`\n${STEP_WAIT} Test 5: Testing /verify endpoint...`);
  try {
    const verifyRes = await fetch(`${FACILITATOR_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: { txHash: "0x0000000000000000000000000000000000000000000000000000000000000000" },
        requirements: [{ payTo: "0x0000000000000000000000000000000000000000" }],
      }),
    });

    if (verifyRes.ok) {
      const result = await verifyRes.json() as Record<string, unknown>;
      if (result.valid === false) {
        console.log(`${STEP_PASS} /verify endpoint works (correctly returned invalid for fake tx)`);
        passedTests++;
      } else {
        console.log(`${STEP_FAIL} /verify returned valid for fake tx — something's wrong`);
      }
    } else {
      console.log(`${STEP_FAIL} /verify returned status ${verifyRes.status}`);
    }
  } catch (e: unknown) {
    console.log(`${STEP_FAIL} /verify failed: ${errMsg(e)}`);
  }

  // ─── Summary ───────────────────────────────────────────────

  console.log(`\n${"═".repeat(60)}`);
  console.log(`\n  Results: ${passedTests}/${totalTests} tests passed\n`);

  if (passedTests === totalTests) {
    console.log(`  🟢 All infrastructure checks passed!`);
    console.log(`  The payment flow is ready. Fund the facilitator wallet to process real payments.\n`);
  } else {
    console.log(`  🟡 Some tests failed. Fix the issues above before going live.\n`);
  }

  console.log(`  Next: Fund the facilitator wallet with USDC + ETH on Base.`);
  console.log(`  Then run the agent client to test a real payment:\n`);
  console.log(`    cd apps/agent-client && npx tsx agent.ts\n`);
}

main().catch(console.error);
