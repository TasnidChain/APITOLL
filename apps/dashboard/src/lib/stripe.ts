import Stripe from "stripe";

/**
 * Lazy Stripe client — only initialized when first accessed.
 * This prevents build-time errors when STRIPE_SECRET_KEY is not set.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Add it to your environment variables."
      );
    }
    _stripe = new Stripe(key, {
      apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return _stripe;
}

/** @deprecated Use getStripe() instead for lazy initialization */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});

/**
 * Stripe Price IDs for each plan.
 * Create these in Stripe Dashboard → Products → Pricing.
 * Set via environment variables.
 */
export const STRIPE_PRICES = {
  pro: process.env.STRIPE_PRICE_PRO || "",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || "",
} as const;

/**
 * Map plan IDs to Stripe price IDs.
 */
export function getStripePriceId(plan: string): string | null {
  if (plan === "pro") return STRIPE_PRICES.pro || null;
  if (plan === "enterprise") return STRIPE_PRICES.enterprise || null;
  return null;
}
