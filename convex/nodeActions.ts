"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";

// ═══════════════════════════════════════════════════
// Node.js Actions — Stripe & Ethers (requires "use node")
// ═══════════════════════════════════════════════════

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

// ─── Create Stripe PaymentIntent ─────────────────────────────────────

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

// ─── Transfer USDC via Ethers ────────────────────────────────────────

// Base USDC contract address — canonical source: @apitoll/shared DEFAULT_CHAIN_CONFIGS.base.usdcAddress
const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
];

export const transferUSDC = internalAction({
  args: {
    walletAddress: v.string(),
    amountUSDC: v.number(),
  },
  handler: async (_ctx, args) => {
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
