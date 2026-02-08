import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events for subscription lifecycle.
 * Set STRIPE_WEBHOOK_SECRET in environment.
 *
 * Events handled:
 * - checkout.session.completed: New subscription created
 * - customer.subscription.updated: Plan changed
 * - customer.subscription.deleted: Subscription canceled
 * - invoice.payment_failed: Payment failed
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;

        console.log(
          `[Stripe] Checkout completed: user=${userId} plan=${plan} subscription=${session.subscription}`
        );

        // TODO: Update user's plan in Convex
        // await convex.mutation(api.billing.updatePlan, { userId, plan, stripeSubscriptionId: session.subscription })
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        const status = subscription.status;

        console.log(
          `[Stripe] Subscription updated: user=${userId} status=${status}`
        );

        // TODO: Update subscription status in Convex
        // await convex.mutation(api.billing.updateSubscriptionStatus, { userId, status })
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        console.log(
          `[Stripe] Subscription canceled: user=${userId}`
        );

        // TODO: Downgrade user to free plan in Convex
        // await convex.mutation(api.billing.downgradeToFree, { userId })
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        console.log(
          `[Stripe] Payment failed: customer=${customerId}`
        );

        // TODO: Notify user of failed payment
        // Could send email or update dashboard notification
        break;
      }

      default:
        console.log(`[Stripe] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook handler error:", error.message);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
