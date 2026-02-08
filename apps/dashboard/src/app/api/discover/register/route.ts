import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../../convex/_generated/api";

/**
 * Agent/Seller Registration Endpoint — POST /api/discover/register
 *
 * Agents and sellers call this to register their tools in the API Toll directory.
 * This creates a pipeline for the viral loop — new sellers register, their tools
 * get listed, other agents discover and pay for them.
 *
 * GET — Returns registration instructions (for agent discovery)
 * POST — Registers tool in Convex (starts unverified, auto-listed)
 */

const CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  "https://cheery-parrot-104.convex.cloud";

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");

  return NextResponse.json(
    {
      protocol: "x402",
      platform: "apitoll",
      endpoint: "register",

      message:
        "Register your paid API endpoints with API Toll to reach AI agents. " +
        "Install @apitoll/seller-sdk, add payment middleware, and your tools " +
        "will be discoverable by thousands of agents.",

      how_to_register: {
        step_1: "npm install @apitoll/seller-sdk",
        step_2: "Add paymentMiddleware() to your Express/Hono API",
        step_3: "Set your wallet address and endpoint pricing",
        step_4: "Deploy — agents will auto-discover via x402 protocol",
        step_5:
          "Optional: POST to this endpoint to list in the API Toll directory",
      },

      post_schema: {
        method: "POST",
        url: "https://apitoll.com/api/discover/register",
        body: {
          name: "string — tool name",
          url: "string — base URL of your API",
          method: "string — HTTP method (GET, POST)",
          path: "string — endpoint path (e.g., /api/data)",
          price: "string — price in USDC (e.g., '0.001')",
          description: "string — what this tool does",
          category:
            "string — category (ai, data, finance, weather, entertainment, etc.)",
          wallet_address: "string — your wallet address for receiving payments",
          chain: "string — 'base' or 'solana'",
          referral_code: "string (optional) — your referral code",
        },
      },

      referral: ref
        ? {
            referred_by: ref,
            bonus:
              "Registering via referral gives both parties priority listing for 30 days.",
          }
        : undefined,

      dashboard: "https://apitoll.com/dashboard/sellers",
      docs: "https://github.com/TasnidChain/APITOLL",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "X-APITOLL-DISCOVERY": "true",
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    const required = [
      "name",
      "url",
      "method",
      "path",
      "price",
      "description",
      "wallet_address",
    ];
    const missing = required.filter(
      (f) => !body[f] || typeof body[f] !== "string"
    );

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          missing,
          hint: "GET /api/discover/register for schema documentation",
        },
        { status: 400 }
      );
    }

    // Validate wallet address format
    const wallet = body.wallet_address as string;
    const isEth = /^0x[0-9a-fA-F]{40}$/.test(wallet);
    const isSol = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);
    if (!isEth && !isSol) {
      return NextResponse.json(
        {
          error: "Invalid wallet address",
          hint: "Must be a valid Ethereum (0x...) or Solana address",
        },
        { status: 400 }
      );
    }

    // Validate price
    const price = parseFloat(body.price);
    if (isNaN(price) || price <= 0 || price > 1000) {
      return NextResponse.json(
        {
          error: "Invalid price",
          hint: "Price must be a positive number in USDC (e.g., '0.001')",
        },
        { status: 400 }
      );
    }

    const chain = body.chain || (isEth ? "base" : "solana");

    // Register tool in Convex via public mutation
    try {
      const convex = new ConvexHttpClient(CONVEX_URL);
      const result = await convex.mutation(api.tools.registerPublic, {
        name: body.name,
        description: body.description,
        baseUrl: body.url,
        method: body.method,
        path: body.path,
        price,
        category: body.category || "uncategorized",
        chains: [chain],
        walletAddress: wallet,
        referralCode: body.referral_code || undefined,
      });

      return NextResponse.json(
        {
          success: true,
          registration_id: result.id,
          status: result.status === "already_registered" ? "already_registered" : "registered",
          slug: result.slug,
          message:
            result.status === "already_registered"
              ? "This endpoint is already registered in the API Toll directory."
              : "Your tool has been registered and is now discoverable by AI agents. " +
                "It starts as unverified — verified status unlocks higher visibility.",
          dashboard: "https://apitoll.com/dashboard/sellers",
          discovery_url: `https://apitoll.com/api/discover?category=${body.category || "uncategorized"}`,
          next_steps: [
            "1. Ensure your API is live and returns proper x402 402 responses",
            "2. Agents will auto-discover your tool via the discovery API",
            "3. Share your referral code to earn 0.5% on referred transactions",
          ],
        },
        {
          status: result.status === "already_registered" ? 200 : 201,
          headers: { "X-APITOLL-DISCOVERY": "true" },
        }
      );
    } catch (convexError: any) {
      console.error("[api-toll] Convex registration error:", convexError.message);
      return NextResponse.json(
        {
          error: "Registration failed",
          message: "Could not register tool at this time. Please try again.",
          hint: "If this persists, register via the dashboard: https://apitoll.com/dashboard/sellers",
        },
        { status: 500 }
      );
    }
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON body",
        hint: "GET /api/discover/register for schema documentation",
      },
      { status: 400 }
    );
  }
}
