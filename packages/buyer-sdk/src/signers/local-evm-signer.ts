import type { PaymentRequirement, SupportedChain } from "@apitoll/shared";
import type { PaymentSigner } from "../agent-wallet";

/**
 * Creates a self-custody EVM signer that signs USDC transfers locally.
 *
 * Flow:
 * 1. Agent holds its own private key (never sent to facilitator)
 * 2. On 402, agent builds + signs an ERC-20 transfer tx locally
 * 3. Sends the signed tx to the facilitator for broadcasting
 * 4. Facilitator calls broadcastTransaction() — never touches the key
 *
 * Requires `ethers` (v6) as a peer dependency.
 *
 * Usage:
 * ```ts
 * import { createLocalEVMSigner } from "@apitoll/buyer-sdk";
 *
 * const agent = createAgentWallet({
 *   name: "SelfCustody",
 *   chain: "base",
 *   policies: [...],
 *   signer: createLocalEVMSigner({
 *     privateKey: process.env.AGENT_PRIVATE_KEY!,
 *     rpcUrl: "https://mainnet.base.org",
 *     facilitatorUrl: "https://pay.apitoll.com", // broadcasts pre-signed tx
 *   }),
 * });
 * ```
 */
export interface LocalEVMSignerConfig {
  /** Agent's private key (hex, with or without 0x prefix) */
  privateKey: string;
  /** RPC URL for the EVM chain (default: https://mainnet.base.org) */
  rpcUrl?: string;
  /** Facilitator URL for broadcasting (default: https://pay.apitoll.com) */
  facilitatorUrl?: string;
  /** Optional API key for the facilitator */
  apiKey?: string;
}

// Minimal ERC-20 ABI — just the transfer function
const USDC_TRANSFER_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
];

export function createLocalEVMSigner(config: LocalEVMSignerConfig): PaymentSigner {
  const {
    privateKey,
    rpcUrl = "https://mainnet.base.org",
    facilitatorUrl = "https://pay.apitoll.com",
    apiKey,
  } = config;

  return async (
    requirements: PaymentRequirement[],
    chain: SupportedChain
  ): Promise<string> => {
    const requirement = requirements[0];
    if (!requirement) {
      throw new Error("No payment requirements provided");
    }

    // Dynamically import ethers (peer dependency)
    let ethers: typeof import("ethers");
    try {
      ethers = await import("ethers");
    } catch {
      throw new Error(
        "Self-custody EVM signer requires 'ethers' package. Install: npm install ethers"
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Parse amount from smallest unit
    const amountRaw = BigInt(requirement.maxAmountRequired);

    // Build the transfer transaction
    const usdc = new ethers.Contract(requirement.asset, USDC_TRANSFER_ABI, wallet);
    const tx = await usdc.transfer.populateTransaction(
      requirement.payTo,
      amountRaw
    );

    // Sign the transaction locally
    const signedTx = await wallet.signTransaction({
      ...tx,
      from: wallet.address,
    });

    // Convert from smallest unit for the facilitator payload
    const amountUSDC = (Number(amountRaw) / 1_000_000).toString();

    // Send the pre-signed transaction to the facilitator for broadcasting
    const payResponse = await fetch(`${facilitatorUrl}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        original_url: "https://self-custody.local",
        original_method: "GET",
        payment_required: {
          amount: amountUSDC,
          currency: "USDC",
          recipient: requirement.payTo,
          chain,
        },
        agent_wallet: wallet.address,
        signed_tx: signedTx, // <-- pre-signed, facilitator only broadcasts
      }),
    });

    if (!payResponse.ok) {
      const errorText = await payResponse.text();
      throw new Error(
        `Facilitator broadcast failed (${payResponse.status}): ${errorText}`
      );
    }

    const payResult = (await payResponse.json()) as {
      payment_id: string;
      tx_hash?: string;
      status: string;
    };

    // If the facilitator returns the tx hash immediately (pre-signed path)
    if (payResult.tx_hash) {
      const paymentProof = {
        txHash: payResult.tx_hash,
        paymentId: payResult.payment_id,
        from: wallet.address,
        network: requirement.network,
        selfCustody: true,
      };
      return Buffer.from(JSON.stringify(paymentProof)).toString("base64");
    }

    // Otherwise poll for completion (same as facilitator signer)
    const maxAttempts = 60;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const statusResponse = await fetch(
        `${facilitatorUrl}/pay/${payResult.payment_id}`,
        {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        }
      );

      if (!statusResponse.ok) continue;

      const status = (await statusResponse.json()) as {
        status: string;
        tx_hash?: string;
        error?: string;
      };

      if (status.status === "completed" && status.tx_hash) {
        const paymentProof = {
          txHash: status.tx_hash,
          paymentId: payResult.payment_id,
          from: wallet.address,
          network: requirement.network,
          selfCustody: true,
        };
        return Buffer.from(JSON.stringify(paymentProof)).toString("base64");
      }

      if (status.status === "failed") {
        throw new Error(`Payment failed: ${status.error || "unknown error"}`);
      }
    }

    throw new Error("Payment timeout — facilitator did not confirm within 60s");
  };
}

/**
 * Creates a direct EVM signer that broadcasts transactions without a facilitator.
 *
 * Use this for fully decentralized self-custody where the agent broadcasts
 * its own transactions directly to the chain.
 *
 * Usage:
 * ```ts
 * const agent = createAgentWallet({
 *   signer: createDirectEVMSigner({
 *     privateKey: process.env.AGENT_PRIVATE_KEY!,
 *     rpcUrl: "https://mainnet.base.org",
 *   }),
 * });
 * ```
 */
export interface DirectEVMSignerConfig {
  /** Agent's private key (hex) */
  privateKey: string;
  /** RPC URL (default: https://mainnet.base.org) */
  rpcUrl?: string;
  /** Number of block confirmations to wait (default: 2) */
  confirmations?: number;
}

export function createDirectEVMSigner(config: DirectEVMSignerConfig): PaymentSigner {
  const {
    privateKey,
    rpcUrl = "https://mainnet.base.org",
    confirmations = 2,
  } = config;

  return async (
    requirements: PaymentRequirement[],
    _chain: SupportedChain
  ): Promise<string> => {
    const requirement = requirements[0];
    if (!requirement) {
      throw new Error("No payment requirements provided");
    }

    let ethers: typeof import("ethers");
    try {
      ethers = await import("ethers");
    } catch {
      throw new Error(
        "Direct EVM signer requires 'ethers' package. Install: npm install ethers"
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    const amountRaw = BigInt(requirement.maxAmountRequired);
    const usdc = new ethers.Contract(requirement.asset, USDC_TRANSFER_ABI, wallet);

    // Sign and broadcast directly
    const tx = await usdc.transfer(requirement.payTo, amountRaw);
    const receipt = await tx.wait(confirmations);

    const paymentProof = {
      txHash: receipt.hash,
      from: wallet.address,
      network: requirement.network,
      selfCustody: true,
      directBroadcast: true,
    };
    return Buffer.from(JSON.stringify(paymentProof)).toString("base64");
  };
}
