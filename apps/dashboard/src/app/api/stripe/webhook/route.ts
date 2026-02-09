import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { api } from "../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import { convex } from "@/lib/convex-client";

/**
 * Derive the plan tier from a Stripe price ID.
 * Mirrors the logic in convex/billing.ts priceIdToPlan.
 */
function priceIdToPlan(priceId: string): "free" | "pro" | "enterprise" {
  if (priceId.includes("pro")) return "pro";
  if (priceId.includes("ent")) return "enterprise";
  return "free";
}

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
  } catch (err: unknown) {
    console.error("Webhook signature verification failed:", err instanceof Error ? err.message : err);
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
        const plan = (session.metadata?.plan ?? "pro") as
          | "pro"
          | "enterprise";

        const stripeCustomerId = session.customer as string;
        const stripeSubscriptionId = session.subscription as string;

        console.log(
          `[Stripe] Checkout completed: user=${userId} plan=${plan} subscription=${stripeSubscriptionId} customer=${stripeCustomerId}`
        );

        // Retrieve the full subscription to get the price ID and billing period
        const subscription =
          await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const firstItem = subscription.items.data[0];
        const priceId = firstItem?.price.id ?? "";
        const resolvedPlan = priceIdToPlan(priceId);
        const billingPeriodEnd = firstItem?.current_period_end ?? 0;

        // Look up the organization by Stripe customer ID
        const org = await convex.query(api.billing.getByStripeCustomer, {
          stripeCustomerId,
        });

        if (org) {
          // Org already has this Stripe customer linked — activate subscription
          await convex.mutation(api.billing.activateSubscription, {
            orgId: org._id as Id<"organizations">,
            stripeSubscriptionId,
            stripePriceId: priceId,
            plan: resolvedPlan,
            billingPeriodEnd,
          });

          console.log(
            `[Stripe] Activated subscription for org=${org._id} plan=${resolvedPlan}`
          );
        } else {
          // No org found for this customer yet — this means the customer was
          // just created during checkout. We need to associate the Stripe
          // customer with an org. The checkout metadata contains userId; look
          // up the org by owner.
          console.warn(
            `[Stripe] No org found for stripeCustomerId=${stripeCustomerId}. ` +
              `Checkout metadata userId=${userId}. ` +
              `Manual linking may be required if org lookup by userId is not available.`
          );
          // If there is an org lookup by userId available in the future,
          // call setStripeCustomer + activateSubscription here.
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = subscription.customer as string;
        const status = subscription.status;

        const firstItem = subscription.items.data[0];
        const priceId = firstItem?.price.id ?? "";
        const resolvedPlan = priceIdToPlan(priceId);
        const billingPeriodEnd = firstItem?.current_period_end ?? 0;

        console.log(
          `[Stripe] Subscription updated: customer=${stripeCustomerId} status=${status} plan=${resolvedPlan}`
        );

        const org = await convex.query(api.billing.getByStripeCustomer, {
          stripeCustomerId,
        });

        if (org) {
          await convex.mutation(api.billing.activateSubscription, {
            orgId: org._id as Id<"organizations">,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            plan: resolvedPlan,
            billingPeriodEnd,
          });

          console.log(
            `[Stripe] Updated subscription for org=${org._id} plan=${resolvedPlan}`
          );
        } else {
          console.warn(
            `[Stripe] subscription.updated — no org found for stripeCustomerId=${stripeCustomerId}`
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = subscription.customer as string;

        console.log(
          `[Stripe] Subscription canceled: customer=${stripeCustomerId}`
        );

        const org = await convex.query(api.billing.getByStripeCustomer, {
          stripeCustomerId,
        });

        if (org) {
          await convex.mutation(api.billing.cancelSubscription, {
            orgId: org._id as Id<"organizations">,
          });

          console.log(
            `[Stripe] Canceled subscription for org=${org._id}, downgraded to free`
          );
        } else {
          console.warn(
            `[Stripe] subscription.deleted — no org found for stripeCustomerId=${stripeCustomerId}`
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        console.log(
          `[Stripe] Payment failed: customer=${customerId} invoice=${invoice.id}`
        );

        // Log only for now — no mutation needed yet.
        // Future: notify user via email or in-app alert.
        break;
      }

      default:
        console.log(`[Stripe] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("Webhook handler error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
