#!/usr/bin/env npx tsx
/**
 * Check facilitator wallet balance on Base.
 *
 * Usage:
 *   npx tsx scripts/check-balance.ts
 *   npx tsx scripts/check-balance.ts 0xYourAddress
 *   NETWORK=testnet npx tsx scripts/check-balance.ts
 */

import { ethers } from "ethers";
import * as dotenv from "dotenv";

// Load facilitator .env if available
dotenv.config({ path: "packages/facilitator/.env" });

const NETWORK = process.env.NETWORK || "mainnet";
const isTestnet = NETWORK === "testnet";

const RPC_URL = isTestnet
  ? "https://sepolia.base.org"
  : process.env.BASE_RPC_URL || "https://mainnet.base.org";

const USDC_ADDRESS = isTestnet
  ? "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const EXPLORER = isTestnet
  ? "https://sepolia.basescan.org"
  : "https://basescan.org";

const USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

async function main() {
  // Get address from args or derive from private key
  let address = process.argv[2];

  if (!address && process.env.FACILITATOR_PRIVATE_KEY) {
    const wallet = new ethers.Wallet(
      process.env.FACILITATOR_PRIVATE_KEY.startsWith("0x")
        ? process.env.FACILITATOR_PRIVATE_KEY
        : `0x${process.env.FACILITATOR_PRIVATE_KEY}`
    );
    address = wallet.address;
    console.log(`\nUsing facilitator wallet from .env`);
  }

  if (!address) {
    console.error("Usage: npx tsx scripts/check-balance.ts <address>");
    console.error("   Or set FACILITATOR_PRIVATE_KEY in packages/facilitator/.env");
    process.exit(1);
  }

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Wallet Balance Check — ${isTestnet ? "Base Sepolia (Testnet)" : "Base Mainnet           "}         ║
╚══════════════════════════════════════════════════════════════╝

  Address: ${address}
  Network: ${isTestnet ? "Base Sepolia" : "Base Mainnet"}
  RPC:     ${RPC_URL}
`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

  try {
    // Get ETH balance
    const ethBalance = await provider.getBalance(address);
    const ethFormatted = ethers.formatEther(ethBalance);

    // Get USDC balance
    const usdcBalance = await usdc.balanceOf(address);
    const usdcFormatted = ethers.formatUnits(usdcBalance, 6);

    // Get current block
    const blockNumber = await provider.getBlockNumber();

    console.log(`  ETH Balance:  ${parseFloat(ethFormatted).toFixed(6)} ETH`);
    console.log(`  USDC Balance: $${parseFloat(usdcFormatted).toFixed(2)} USDC`);
    console.log(`  Block:        #${blockNumber}`);
    console.log(`  Explorer:     ${EXPLORER}/address/${address}`);
    console.log("");

    // Warnings
    const ethNum = parseFloat(ethFormatted);
    const usdcNum = parseFloat(usdcFormatted);

    if (ethNum === 0) {
      console.log(`  ⚠️  No ETH! You need ETH for gas fees.`);
      console.log(`     Send at least 0.001 ETH ($2-5) to ${address}`);
      if (isTestnet) {
        console.log(`     Faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet`);
      }
    } else if (ethNum < 0.001) {
      console.log(`  ⚠️  Low ETH balance — may run out of gas soon.`);
    } else {
      console.log(`  ✅ ETH balance OK (enough for ~${Math.floor(ethNum / 0.00005)} transactions)`);
    }

    if (usdcNum === 0) {
      console.log(`  ⚠️  No USDC! The facilitator can't make payments.`);
      console.log(`     Send USDC on ${isTestnet ? "Base Sepolia" : "Base"} to ${address}`);
      console.log(`     USDC contract: ${USDC_ADDRESS}`);
    } else if (usdcNum < 1) {
      console.log(`  ⚠️  Low USDC balance ($${usdcNum.toFixed(2)}).`);
      console.log(`     At $0.001/request, that's ~${Math.floor(usdcNum / 0.001)} API calls.`);
    } else {
      const calls = Math.floor(usdcNum / 0.001);
      console.log(`  ✅ USDC balance OK (~${calls.toLocaleString()} API calls at $0.001 each)`);
    }

    console.log("");

    // Overall readiness
    if (ethNum > 0 && usdcNum > 0) {
      console.log(`  🟢 WALLET READY — you can process payments!`);
    } else {
      console.log(`  🔴 WALLET NOT READY — fund it before going live.`);
    }

    console.log("");
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
    console.error("");
    if (error.message.includes("network")) {
      console.error(`  Check your internet connection and RPC URL.`);
    }
    process.exit(1);
  }
}

main().catch(console.error);
