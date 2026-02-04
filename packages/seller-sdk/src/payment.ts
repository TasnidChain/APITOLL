import {
  type SupportedChain,
  type PaymentRequirement,
  type PaymentReceipt,
  type EndpointConfig,
  type ChainConfig,
  DEFAULT_CHAIN_CONFIGS,
  usdcToSmallestUnit,
  usdcFromSmallestUnit,
  matchRoute,
  generateId,
} from "@agentcommerce/shared";

// ─── Payment Requirement Builder ────────────────────────────────

/**
 * Build the PaymentRequired response body for a given endpoint config.
 * Returns an array of PaymentRequirement objects (one per supported chain).
 */
export function buildPaymentRequirements(
  endpoint: EndpointConfig,
  sellerWallet: string,
  chainConfigs: Record<SupportedChain, ChainConfig>
): PaymentRequirement[] {
  return endpoint.chains.map((chain) => {
    const config = chainConfigs[chain];
    return {
      scheme: "exact" as const,
      network: config.networkId,
      maxAmountRequired: usdcToSmallestUnit(endpoint.price),
      description: endpoint.description,
      payTo: sellerWallet,
      asset: config.usdcAddress,
      extra: {
        name: "USDC",
        decimals: 6,
      },
    };
  });
}

/**
 * Build the base64-encoded PAYMENT-REQUIRED header value.
 */
export function encodePaymentRequired(requirements: PaymentRequirement[]): string {
  return Buffer.from(JSON.stringify(requirements)).toString("base64");
}

// ─── Payment Verification ───────────────────────────────────────

export interface VerifyPaymentOptions {
  /** The X-PAYMENT header value from the client */
  paymentHeader: string;
  /** The payment requirements that were sent in the 402 response */
  requirements: PaymentRequirement[];
  /** Facilitator URL for verification */
  facilitatorUrl: string;
}

export interface VerificationResult {
  valid: boolean;
  receipt?: PaymentReceipt;
  error?: string;
}

/**
 * Verify a payment by calling the x402 facilitator.
 * The facilitator checks on-chain that the payment is valid and settles it.
 */
export async function verifyPayment(options: VerifyPaymentOptions): Promise<VerificationResult> {
  const { paymentHeader, requirements, facilitatorUrl } = options;

  try {
    // Parse the payment payload from the header
    const paymentPayload = JSON.parse(
      Buffer.from(paymentHeader, "base64").toString("utf-8")
    );

    // Call the facilitator's /verify endpoint
    const response = await fetch(`${facilitatorUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: paymentPayload,
        requirements,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        valid: false,
        error: `Facilitator returned ${response.status}: ${errorBody}`,
      };
    }

    const result = await response.json();

    if (result.valid || result.success) {
      return {
        valid: true,
        receipt: {
          txHash: result.txHash || result.transaction?.hash || "",
          chain: detectChainFromNetwork(paymentPayload.network || requirements[0]?.network),
          amount: requirements[0] ? usdcFromSmallestUnit(requirements[0].maxAmountRequired) : "0",
          from: result.from || paymentPayload.from || "",
          to: requirements[0]?.payTo || "",
          timestamp: new Date().toISOString(),
          blockNumber: result.blockNumber,
        },
      };
    }

    return {
      valid: false,
      error: result.error || result.message || "Payment verification failed",
    };
  } catch (err) {
    return {
      valid: false,
      error: `Payment verification error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Detect chain from CAIP-2 network identifier.
 */
function detectChainFromNetwork(network: string): SupportedChain {
  if (network.startsWith("eip155:")) return "base";
  if (network.startsWith("solana:")) return "solana";
  return "base"; // default fallback
}

// ─── Route Matching ─────────────────────────────────────────────

/**
 * Find the matching endpoint config for a given request.
 */
export function findEndpointConfig(
  method: string,
  path: string,
  endpoints: Record<string, EndpointConfig>
): { pattern: string; config: EndpointConfig } | null {
  for (const [pattern, config] of Object.entries(endpoints)) {
    if (matchRoute(method, path, pattern)) {
      return { pattern, config };
    }
  }
  return null;
}
