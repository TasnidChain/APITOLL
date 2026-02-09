import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/stripe/webhook
 *
 * Forwards Stripe webhook events to the Convex HTTP endpoint at /webhook/stripe.
 * All billing mutations are now internalMutation in Convex, so we cannot call them
 * directly from the Next.js dashboard via ConvexHttpClient.
 *
 * The Convex /webhook/stripe handler verifies the Stripe signature and processes
 * all subscription lifecycle events.
 *
 * IMPORTANT: In production, configure Stripe to send webhooks directly to:
 *   https://cheery-parrot-104.convex.site/webhook/stripe
 * This Next.js route exists only as a fallback/proxy.
 */
export async function POST(req: NextRequest) {
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(
    ".cloud",
    ".site"
  );

  if (!convexSiteUrl) {
    console.error("NEXT_PUBLIC_CONVEX_URL is not set — cannot forward Stripe webhook");
    return NextResponse.json(
      { error: "Webhook forwarding not configured" },
      { status: 500 }
    );
  }

  try {
    // Forward the raw request (with signature header) to Convex HTTP endpoint
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    const response = await fetch(`${convexSiteUrl}/webhook/stripe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body,
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error: unknown) {
    console.error(
      "Stripe webhook forwarding failed:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: "Webhook forwarding failed" },
      { status: 500 }
    );
  }
}
