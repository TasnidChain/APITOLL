import { NextRequest, NextResponse } from "next/server";
import { stripe, getStripePriceId } from "@/lib/stripe";
import { auth } from "@clerk/nextjs/server";

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for plan upgrades.
 * Requires authenticated user (Clerk).
 *
 * Body: { plan: "pro" | "enterprise" }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { plan } = body;

    if (!plan || !["pro", "enterprise"].includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan. Must be 'pro' or 'enterprise'." },
        { status: 400 }
      );
    }

    const priceId = getStripePriceId(plan);
    if (!priceId) {
      return NextResponse.json(
        {
          error: "Stripe not configured for this plan yet.",
          message:
            plan === "enterprise"
              ? "Enterprise plans require a sales call. Contact sales@apitoll.com."
              : "Stripe price IDs not configured. Set STRIPE_PRICE_PRO in environment.",
        },
        { status: 503 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/billing?canceled=true`,
      client_reference_id: userId,
      metadata: {
        userId,
        plan,
        platform: "apitoll",
      },
      subscription_data: {
        metadata: {
          userId,
          plan,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("Stripe checkout error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
