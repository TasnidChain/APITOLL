import { NextRequest, NextResponse } from "next/server";

/**
 * Agent/Seller Registration Endpoint — POST /api/discover/register
 *
 * Agents and sellers call this to register their tools in the API Toll directory.
 * This creates a pipeline for the viral loop — new sellers register, their tools
 * get listed, other agents discover and pay for them.
 *
 * GET — Returns registration instructions (for agent discovery)
 * POST — Accepts tool registration (forward to Convex or manual review)
 */

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

    // For now, queue for manual review (later: auto-list via Convex mutation)
    // In production this would call the Convex API to create the tool listing
    const registration = {
      id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: "pending_review",
      tool: {
        name: body.name,
        url: body.url,
        method: body.method,
        path: body.path,
        price: body.price,
        description: body.description,
        category: body.category || "uncategorized",
        wallet_address: body.wallet_address,
        chain: body.chain || (isEth ? "base" : "solana"),
        referral_code: body.referral_code || undefined,
      },
      submitted_at: new Date().toISOString(),
    };

    // TODO: Forward to Convex mutation when we build the admin approval flow
    console.log("[api-toll] New tool registration:", JSON.stringify(registration));

    return NextResponse.json(
      {
        success: true,
        registration_id: registration.id,
        status: "pending_review",
        message:
          "Your tool has been submitted for review. Once approved, it will be " +
          "discoverable by AI agents in the API Toll directory. Typical review " +
          "time: < 24 hours.",
        dashboard: "https://apitoll.com/dashboard/sellers",
        next_steps: [
          "1. Ensure your API is live and returns proper x402 402 responses",
          "2. Monitor your seller dashboard for approval notification",
          "3. Share your referral code to earn 0.5% on referred transactions",
        ],
      },
      {
        status: 201,
        headers: { "X-APITOLL-DISCOVERY": "true" },
      }
    );
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
