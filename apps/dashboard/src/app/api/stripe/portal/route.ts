import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { auth } from "@clerk/nextjs/server";

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session so users can manage
 * their subscription, update payment methods, and view invoices.
 *
 * Body: { customerId: "cus_xxx" } (optional — looks up by userId if not provided)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY: Always look up customer by authenticated userId.
    // Never accept customerId from the request body (IDOR vulnerability).
    let customerId: string | undefined;

    const customers = await stripe.customers.search({
      query: `metadata["userId"]:"${userId}"`,
      limit: 1,
    });

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    if (!customerId) {
      return NextResponse.json(
        {
          error: "No Stripe customer found",
          message:
            "You don't have an active subscription. Upgrade to Pro or Enterprise first.",
        },
        { status: 404 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("Stripe portal error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Failed to create billing portal session" },
      { status: 500 }
    );
  }
}
