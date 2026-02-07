import type { PaymentRequirement, SupportedChain } from "@apitoll/shared";
import type { PaymentSigner } from "../agent-wallet";

/**
 * Creates a signer that uses the Apitoll facilitator's custodial wallet.
 *
 * Flow:
 * 1. Agent calls facilitator POST /pay with payment requirements
 * 2. Facilitator executes USDC transfer from its hot wallet
 * 3. Signer polls GET /pay/:id until completed
 * 4. Returns base64-encoded receipt as X-PAYMENT header
 *
 * The facilitator wallet must be pre-funded with USDC on Base.
 */
export function createFacilitatorSigner(
  facilitatorUrl: string,
  apiKey: string,
  agentWallet: string
): PaymentSigner {
  return async (
    requirements: PaymentRequirement[],
    chain: SupportedChain
  ): Promise<string> => {
    const requirement = requirements[0];
    if (!requirement) {
      throw new Error("No payment requirements provided");
    }

    // Convert from smallest unit (6 decimals) back to human-readable
    const amountRaw = parseInt(requirement.maxAmountRequired, 10);
    const amount = (amountRaw / 1_000_000).toString();

    // Call facilitator /pay to initiate the transfer
    const payResponse = await fetch(`${facilitatorUrl}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        original_url: "https://placeholder.local", // not used for verification
        original_method: "GET",
        payment_required: {
          amount,
          currency: "USDC",
          recipient: requirement.payTo,
          chain,
        },
        agent_wallet: agentWallet,
      }),
    });

    if (!payResponse.ok) {
      const errorText = await payResponse.text();
      throw new Error(
        `Facilitator /pay failed (${payResponse.status}): ${errorText}`
      );
    }

    const payResult = (await payResponse.json()) as {
      payment_id: string;
      status: string;
    };

    // Poll for completion (max 60 seconds)
    const maxAttempts = 60;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const statusResponse = await fetch(
        `${facilitatorUrl}/pay/${payResult.payment_id}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );

      if (!statusResponse.ok) continue;

      const status = (await statusResponse.json()) as {
        status: string;
        tx_hash?: string;
        error?: string;
      };

      if (status.status === "completed" && status.tx_hash) {
        // Return base64-encoded payment proof for X-PAYMENT header
        const paymentProof = {
          txHash: status.tx_hash,
          paymentId: payResult.payment_id,
          from: agentWallet,
          network: requirement.network,
        };
        return Buffer.from(JSON.stringify(paymentProof)).toString("base64");
      }

      if (status.status === "failed") {
        throw new Error(
          `Payment failed: ${status.error || "unknown error"}`
        );
      }
    }

    throw new Error("Payment timeout — facilitator did not confirm within 60s");
  };
}
