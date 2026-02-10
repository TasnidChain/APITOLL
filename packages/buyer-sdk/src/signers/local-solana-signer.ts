import type { PaymentRequirement, SupportedChain } from "@apitoll/shared";
import type { PaymentSigner } from "../agent-wallet";

/**
 * Creates a self-custody Solana signer that signs SPL token transfers locally.
 *
 * Flow:
 * 1. Agent holds its own Solana keypair (never sent to facilitator)
 * 2. On 402, agent builds + signs a USDC SPL transfer tx locally
 * 3. Sends the signed tx to the facilitator for broadcasting
 * 4. Facilitator calls broadcastSolanaTransaction() — never touches the key
 *
 * Requires `@solana/web3.js` and `@solana/spl-token` as peer dependencies.
 *
 * Usage:
 * ```ts
 * import { createLocalSolanaSigner } from "@apitoll/buyer-sdk";
 *
 * const agent = createAgentWallet({
 *   name: "SolanaSelfCustody",
 *   chain: "solana",
 *   policies: [...],
 *   signer: createLocalSolanaSigner({
 *     privateKey: process.env.SOLANA_PRIVATE_KEY!,
 *     rpcUrl: "https://api.mainnet-beta.solana.com",
 *     facilitatorUrl: "https://pay.apitoll.com",
 *   }),
 * });
 * ```
 */
export interface LocalSolanaSignerConfig {
  /** Solana private key (base58 string or JSON byte array) */
  privateKey: string;
  /** Solana RPC URL (default: mainnet-beta) */
  rpcUrl?: string;
  /** Facilitator URL for broadcasting (default: https://pay.apitoll.com) */
  facilitatorUrl?: string;
  /** Optional API key for the facilitator */
  apiKey?: string;
}

const USDC_DECIMALS = 6;

/** Parse a Solana private key from base58 string or JSON byte array */
function parseSolanaKey(raw: string): Uint8Array {
  if (raw.startsWith("[")) {
    const bytes = JSON.parse(raw) as number[];
    return new Uint8Array(bytes);
  }

  // Base58 decode
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const bytes: number[] = [];
  for (const char of raw) {
    let carry = ALPHABET.indexOf(char);
    if (carry < 0) throw new Error("Invalid base58 character");
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of raw) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

export function createLocalSolanaSigner(config: LocalSolanaSignerConfig): PaymentSigner {
  const {
    privateKey,
    rpcUrl = "https://api.mainnet-beta.solana.com",
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

    // Dynamically import Solana packages (peer dependencies)
    let solanaWeb3: typeof import("@solana/web3.js");
    let splToken: typeof import("@solana/spl-token");
    try {
      solanaWeb3 = await import("@solana/web3.js");
      splToken = await import("@solana/spl-token");
    } catch {
      throw new Error(
        "Solana self-custody signer requires '@solana/web3.js' and '@solana/spl-token'. " +
        "Install: npm install @solana/web3.js @solana/spl-token"
      );
    }

    const connection = new solanaWeb3.Connection(rpcUrl, "confirmed");
    const secretKey = parseSolanaKey(privateKey);
    const payer = solanaWeb3.Keypair.fromSecretKey(secretKey);

    const usdcMint = new solanaWeb3.PublicKey(requirement.asset);
    const recipientPubkey = new solanaWeb3.PublicKey(requirement.payTo);
    const amount = BigInt(requirement.maxAmountRequired);

    // Get associated token accounts
    const senderATA = await splToken.getAssociatedTokenAddress(usdcMint, payer.publicKey);
    const recipientATA = await splToken.getAssociatedTokenAddress(usdcMint, recipientPubkey);

    // Build transaction instructions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instructions: any[] = [];

    // Check if recipient ATA exists
    try {
      await splToken.getAccount(connection, recipientATA);
    } catch {
      // Create recipient ATA (payer pays rent)
      instructions.push(
        splToken.createAssociatedTokenAccountInstruction(
          payer.publicKey,
          recipientATA,
          recipientPubkey,
          usdcMint
        )
      );
    }

    // Add transfer instruction
    instructions.push(
      splToken.createTransferInstruction(
        senderATA,
        recipientATA,
        payer.publicKey,
        amount
      )
    );

    // Build and sign transaction locally
    const tx = new solanaWeb3.Transaction().add(...instructions);
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(payer);

    // Serialize the signed transaction
    const serializedTx = tx.serialize().toString("base64");

    // Convert amount for facilitator
    const amountUSDC = (Number(amount) / 10 ** USDC_DECIMALS).toString();

    // Send pre-signed tx to facilitator for broadcasting
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
        agent_wallet: payer.publicKey.toBase58(),
        signed_tx: serializedTx,
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

    if (payResult.tx_hash) {
      const paymentProof = {
        txHash: payResult.tx_hash,
        paymentId: payResult.payment_id,
        from: payer.publicKey.toBase58(),
        network: requirement.network,
        selfCustody: true,
      };
      return Buffer.from(JSON.stringify(paymentProof)).toString("base64");
    }

    // Poll for completion
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
          from: payer.publicKey.toBase58(),
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
 * Creates a direct Solana signer that broadcasts transactions without a facilitator.
 *
 * Usage:
 * ```ts
 * const agent = createAgentWallet({
 *   signer: createDirectSolanaSigner({
 *     privateKey: process.env.SOLANA_PRIVATE_KEY!,
 *     rpcUrl: "https://api.mainnet-beta.solana.com",
 *   }),
 * });
 * ```
 */
export interface DirectSolanaSignerConfig {
  /** Solana private key (base58 or JSON byte array) */
  privateKey: string;
  /** Solana RPC URL */
  rpcUrl?: string;
}

export function createDirectSolanaSigner(config: DirectSolanaSignerConfig): PaymentSigner {
  const {
    privateKey,
    rpcUrl = "https://api.mainnet-beta.solana.com",
  } = config;

  return async (
    requirements: PaymentRequirement[],
    _chain: SupportedChain
  ): Promise<string> => {
    const requirement = requirements[0];
    if (!requirement) {
      throw new Error("No payment requirements provided");
    }

    let solanaWeb3: typeof import("@solana/web3.js");
    let splToken: typeof import("@solana/spl-token");
    try {
      solanaWeb3 = await import("@solana/web3.js");
      splToken = await import("@solana/spl-token");
    } catch {
      throw new Error(
        "Direct Solana signer requires '@solana/web3.js' and '@solana/spl-token'. " +
        "Install: npm install @solana/web3.js @solana/spl-token"
      );
    }

    const connection = new solanaWeb3.Connection(rpcUrl, "confirmed");
    const secretKey = parseSolanaKey(privateKey);
    const payer = solanaWeb3.Keypair.fromSecretKey(secretKey);

    const usdcMint = new solanaWeb3.PublicKey(requirement.asset);
    const recipientPubkey = new solanaWeb3.PublicKey(requirement.payTo);
    const amount = BigInt(requirement.maxAmountRequired);

    const senderATA = await splToken.getAssociatedTokenAddress(usdcMint, payer.publicKey);
    const recipientATA = await splToken.getAssociatedTokenAddress(usdcMint, recipientPubkey);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instructions: any[] = [];

    try {
      await splToken.getAccount(connection, recipientATA);
    } catch {
      instructions.push(
        splToken.createAssociatedTokenAccountInstruction(
          payer.publicKey,
          recipientATA,
          recipientPubkey,
          usdcMint
        )
      );
    }

    instructions.push(
      splToken.createTransferInstruction(
        senderATA,
        recipientATA,
        payer.publicKey,
        amount
      )
    );

    const tx = new solanaWeb3.Transaction().add(...instructions);

    // Sign and broadcast directly
    const signature = await solanaWeb3.sendAndConfirmTransaction(
      connection,
      tx,
      [payer],
      { commitment: "confirmed" }
    );

    const paymentProof = {
      txHash: signature,
      from: payer.publicKey.toBase58(),
      network: requirement.network,
      selfCustody: true,
      directBroadcast: true,
    };
    return Buffer.from(JSON.stringify(paymentProof)).toString("base64");
  };
}
