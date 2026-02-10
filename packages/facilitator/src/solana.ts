/**
 * Solana USDC transfer module for the x402 facilitator.
 *
 * Handles SPL token transfers using @solana/web3.js and @solana/spl-token.
 * Supports both custodial (facilitator-signed) and self-custody (pre-signed) flows.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { SOLANA_USDC_ADDRESS } from "@apitoll/shared";
import pino from "pino";

const logger = pino();

// USDC has 6 decimals on Solana (same as on Base)
const USDC_DECIMALS = 6;
const USDC_MINT = new PublicKey(SOLANA_USDC_ADDRESS);

export interface SolanaTransferResult {
  txHash: string;
  slot: number;
}

export interface SolanaConfig {
  rpcUrl: string;
  privateKey: string; // base58 or JSON array of bytes
}

/**
 * Parse a Solana private key from either base58 string or JSON byte array.
 */
function parsePrivateKey(raw: string): Uint8Array {
  // If it looks like a JSON array [1,2,3,...], parse as bytes
  if (raw.startsWith("[")) {
    const bytes = JSON.parse(raw) as number[];
    return new Uint8Array(bytes);
  }

  // Otherwise decode from base58
  // Use a simple base58 decoder
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
  // Add leading zeros
  for (const char of raw) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

/**
 * Transfer USDC on Solana from the facilitator wallet to a recipient.
 */
export async function transferSolanaUSDC(
  config: SolanaConfig,
  recipient: string,
  amountUSDC: string
): Promise<SolanaTransferResult> {
  const connection = new Connection(config.rpcUrl, "confirmed");

  // Parse facilitator keypair
  const secretKey = parsePrivateKey(config.privateKey);
  const payer = Keypair.fromSecretKey(secretKey);

  const recipientPubkey = new PublicKey(recipient);
  const amount = BigInt(Math.round(parseFloat(amountUSDC) * 10 ** USDC_DECIMALS));

  logger.info(
    { to: recipient, amount: amount.toString(), mint: USDC_MINT.toBase58() },
    "Initiating Solana USDC transfer"
  );

  // Get associated token accounts
  const senderATA = await getAssociatedTokenAddress(USDC_MINT, payer.publicKey);
  const recipientATA = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);

  // Check if recipient ATA exists; if not, create it
  const instructions = [];
  try {
    await getAccount(connection, recipientATA);
  } catch {
    // Recipient doesn't have an ATA — create one (payer pays rent)
    logger.info({ recipient, ata: recipientATA.toBase58() }, "Creating recipient ATA");
    instructions.push(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        recipientATA,
        recipientPubkey,
        USDC_MINT
      )
    );
  }

  // Add transfer instruction
  instructions.push(
    createTransferInstruction(
      senderATA,
      recipientATA,
      payer.publicKey,
      amount
    )
  );

  const tx = new Transaction().add(...instructions);

  const signature = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });

  // Get slot for the tx
  const status = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  logger.info({ txHash: signature, slot: status?.slot }, "Solana USDC transfer confirmed");

  return {
    txHash: signature,
    slot: status?.slot ?? 0,
  };
}

/**
 * Broadcast a pre-signed Solana transaction.
 */
export async function broadcastSolanaTransaction(
  rpcUrl: string,
  serializedTx: string
): Promise<SolanaTransferResult> {
  const connection = new Connection(rpcUrl, "confirmed");

  // Decode the serialized transaction (base64)
  const txBytes = Buffer.from(serializedTx, "base64");

  let signature: string;
  try {
    // Try versioned transaction first
    const vTx = VersionedTransaction.deserialize(txBytes);
    signature = await connection.sendTransaction(vTx, { skipPreflight: false });
  } catch {
    // Fall back to legacy transaction
    const tx = Transaction.from(txBytes);
    signature = await connection.sendRawTransaction(txBytes, { skipPreflight: false });
  }

  // Wait for confirmation
  const confirmation = await connection.confirmTransaction(signature, "confirmed");
  if (confirmation.value.err) {
    throw new Error(`Solana transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  const status = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  return {
    txHash: signature,
    slot: status?.slot ?? 0,
  };
}

/**
 * Verify a Solana transaction on-chain.
 */
export async function verifySolanaTransaction(
  rpcUrl: string,
  txHash: string,
  expectedRecipient?: string
): Promise<{
  valid: boolean;
  txHash: string;
  from?: string;
  slot?: number;
  error?: string;
}> {
  const connection = new Connection(rpcUrl, "confirmed");

  const tx = await connection.getTransaction(txHash, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    return { valid: false, txHash, error: "Transaction not found or not confirmed" };
  }

  if (tx.meta?.err) {
    return { valid: false, txHash, error: `Transaction failed: ${JSON.stringify(tx.meta.err)}` };
  }

  // Extract signer (first account key)
  const signerKey = tx.transaction.message.getAccountKeys().get(0);

  return {
    valid: true,
    txHash,
    from: signerKey?.toBase58(),
    slot: tx.slot,
  };
}
