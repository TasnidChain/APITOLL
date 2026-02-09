import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { blockchainCache } from "../cache";

const router = Router();
const CACHE_TTL = 1800_000;
const BASE_RPC = "https://mainnet.base.org";
const ETH_RPC = "https://eth.llamarpc.com";

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await resp.json() as { result?: unknown; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

function namehash(name: string): string {
  let node = "0x0000000000000000000000000000000000000000000000000000000000000000";
  if (name) {
    const labels = name.split(".");
    for (let i = labels.length - 1; i >= 0; i--) {
      const crypto = require("crypto");
      const labelHash = "0x" + crypto.createHash("sha3-256").update(labels[i]).digest("hex");
      // keccak256 equivalent using eth abi encoding
      node = keccak256(node + labelHash.slice(2));
    }
  }
  return node;
}

function keccak256(hexInput: string): string {
  const crypto = require("crypto");
  const clean = hexInput.startsWith("0x") ? hexInput.slice(2) : hexInput;
  // Use sha3-256 which is available in Node.js crypto
  return "0x" + crypto.createHash("sha3-256").update(Buffer.from(clean, "hex")).digest("hex");
}

router.get("/api/ens", async (req: Request, res: Response) => {
  const name = req.query.name as string;
  const address = req.query.address as string;

  if (!name && !address) {
    return res.status(400).json({ error: "Provide ?name=vitalik.eth or ?address=0x..." });
  }

  const query = name || address!;
  const cacheKey = `ens:${query}`;
  const cached = blockchainCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    if (name) {
      // Forward resolution: name → address
      // Use ENS Universal Resolver
      // Simplified: use eth_call to the ENS registry

      // Try using a public ENS API
      const ensResp = await fetch(`https://ensdata.net/${encodeURIComponent(name)}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (ensResp.ok) {
        const data = await ensResp.json() as Record<string, unknown>;
        const payload = {
          name,
          address: data.address || null,
          avatar: data.avatar || null,
          contentHash: data.contentHash || null,
          records: data,
          direction: "forward",
        };
        blockchainCache.set(cacheKey, payload, CACHE_TTL);
        return res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
      }

      // Fallback: just return what we know
      return res.json({
        name,
        address: null,
        note: "ENS resolution service temporarily unavailable",
        direction: "forward",
        payment: formatPayment(getX402Context(req)),
      });
    }

    if (address) {
      // Reverse resolution: address → name
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return res.status(400).json({ error: "Invalid Ethereum address format" });
      }

      const ensResp = await fetch(`https://ensdata.net/${address}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (ensResp.ok) {
        const data = await ensResp.json() as Record<string, unknown>;
        const payload = {
          address,
          name: data.ens || null,
          avatar: data.avatar || null,
          direction: "reverse",
          records: data,
        };
        blockchainCache.set(cacheKey, payload, CACHE_TTL);
        return res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
      }

      return res.json({
        address,
        name: null,
        note: "ENS reverse resolution service temporarily unavailable",
        direction: "reverse",
        payment: formatPayment(getX402Context(req)),
      });
    }
  } catch (err) {
    res.status(502).json({ error: "ENS resolution failed", details: (err as Error).message });
  }
});

export default router;
