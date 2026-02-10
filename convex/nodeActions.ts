"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";

// Node.js Actions — Stripe & Ethers (requires "use node")

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Set it in your Convex dashboard or .env file.`
    );
  }
  return value;
}


export const createStripePaymentIntent = internalAction({
  args: {
    fiatAmount: v.number(),
    orgId: v.string(),
    agentId: v.string(),
    chain: v.string(),
    walletAddress: v.string(),
  },
  handler: async (_ctx, args) => {
    const stripeKey = requireEnv("STRIPE_SECRET_KEY");
    const stripe = require("stripe")(stripeKey);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(args.fiatAmount * 100), // Convert to cents
      currency: "usd",
      payment_method_types: ["card"],
      metadata: {
        orgId: args.orgId,
        agentId: args.agentId,
        chain: args.chain,
        walletAddress: args.walletAddress,
      },
    });

    return {
      id: paymentIntent.id as string,
      clientSecret: paymentIntent.client_secret as string,
    };
  },
});


// Base USDC contract address — canonical source: @apitoll/shared DEFAULT_CHAIN_CONFIGS.base.usdcAddress
const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
];

export const transferUSDC = internalAction({
  args: {
    walletAddress: v.string(),
    amountUSDC: v.number(),
    chain: v.optional(v.union(v.literal("base"), v.literal("solana"))),
  },
  handler: async (_ctx, args) => {
    const chain = args.chain || "base";

    if (chain === "solana") {
      return await transferSolanaUSDCInternal(args.walletAddress, args.amountUSDC);
    }

    // EVM (Base) transfer
    const { ethers } = require("ethers");

    // Validate wallet address
    if (!ethers.isAddress(args.walletAddress)) {
      throw new Error("Invalid wallet address format");
    }
    if (args.walletAddress === ethers.ZeroAddress) {
      throw new Error("Cannot transfer to zero address");
    }

    const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";
    const executorKey = requireEnv("EXECUTOR_PRIVATE_KEY");

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(executorKey, provider);
    const usdc = new ethers.Contract(USDC_ADDRESS_BASE, USDC_ABI, wallet);

    try {
      // Convert to USDC decimals (6)
      const amountWei = ethers.parseUnits(args.amountUSDC.toString(), 6);

      // Send transaction
      const tx = await usdc.transfer(args.walletAddress, amountWei);
      const receipt = await tx.wait(2); // Wait 2 block confirmations

      if (!receipt?.hash) {
        throw new Error("USDC transfer failed: no transaction hash");
      }

      console.log(
        `USDC transfer successful: ${receipt.hash} to ${args.walletAddress}`
      );

      return {
        txHash: receipt.hash as string,
        confirmed: true,
        blockNumber: (receipt.blockNumber as number) || 0,
      };
    } catch (e: unknown) {
      console.error("USDC transfer error:", e);
      throw new Error(`USDC transfer failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
});


// Solana USDC mint address
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;

async function transferSolanaUSDCInternal(
  recipient: string,
  amountUSDC: number
): Promise<{ txHash: string; confirmed: boolean; blockNumber: number }> {
  const {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction,
  } = require("@solana/web3.js");
  const {
    getAssociatedTokenAddress,
    createTransferInstruction,
    getAccount,
    createAssociatedTokenAccountInstruction,
  } = require("@solana/spl-token");

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const solanaKey = requireEnv("SOLANA_EXECUTOR_PRIVATE_KEY");

  const connection = new Connection(rpcUrl, "confirmed");

  // Parse private key (JSON byte array or base58)
  let secretKey: Uint8Array;
  if (solanaKey.startsWith("[")) {
    secretKey = new Uint8Array(JSON.parse(solanaKey));
  } else {
    // Base58 decode
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const bytes: number[] = [];
    for (const char of solanaKey) {
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
    for (const char of solanaKey) {
      if (char !== "1") break;
      bytes.push(0);
    }
    secretKey = new Uint8Array(bytes.reverse());
  }

  const payer = Keypair.fromSecretKey(secretKey);
  const recipientPubkey = new PublicKey(recipient);
  const usdcMint = new PublicKey(SOLANA_USDC_MINT);
  const amount = BigInt(Math.round(amountUSDC * 10 ** USDC_DECIMALS));

  // Get associated token accounts
  const senderATA = await getAssociatedTokenAddress(usdcMint, payer.publicKey);
  const recipientATA = await getAssociatedTokenAddress(usdcMint, recipientPubkey);

  const instructions: any[] = [];

  // Check if recipient ATA exists; create if not
  try {
    await getAccount(connection, recipientATA);
  } catch {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        recipientATA,
        recipientPubkey,
        usdcMint
      )
    );
  }

  instructions.push(
    createTransferInstruction(senderATA, recipientATA, payer.publicKey, amount)
  );

  const tx = new Transaction().add(...instructions);
  const signature = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });

  console.log(`Solana USDC transfer successful: ${signature} to ${recipient}`);

  const txInfo = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  return {
    txHash: signature,
    confirmed: true,
    blockNumber: txInfo?.slot ?? 0,
  };
}
