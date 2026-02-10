import {
  PaymentRequirement,
  PaymentHeader,
  VerificationResult,
  PaidToolConfig,
  CHAIN_CONFIG,
  SupportedChain,
} from './types'

// Payment Requirement Builder

export function buildPaymentRequirements(
  toolName: string,
  config: PaidToolConfig,
  walletAddress: string,
  chains: SupportedChain[] = ['base']
): PaymentRequirement[] {
  // Convert USD to USDC smallest unit (6 decimals)
  const amountInSmallestUnit = Math.round(config.price * 1_000_000).toString()

  return chains.map((chain) => {
    const chainConfig = CHAIN_CONFIG[chain]
    return {
      scheme: 'exact' as const,
      network: chainConfig.network,
      maxAmountRequired: amountInSmallestUnit,
      resource: `mcp://tool/${toolName}`,
      description: config.description || `Payment for ${toolName} tool`,
      mimeType: 'application/json',
      payTo: walletAddress,
      maxTimeoutSeconds: 60,
      asset: chainConfig.asset,
    }
  })
}

// Payment Verification

export async function verifyPayment(
  paymentHeader: string,
  requirements: PaymentRequirement[],
  facilitatorUrl: string = 'https://x402.org/facilitator'
): Promise<VerificationResult> {
  try {
    // Parse the X-PAYMENT header
    const payment = parsePaymentHeader(paymentHeader)
    if (!payment) {
      return { valid: false, error: 'Invalid payment header format' }
    }

    // Call facilitator to verify
    const response = await fetch(`${facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: payment.payload,
        signature: payment.signature,
        requirements,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return { valid: false, error: `Facilitator error: ${error}` }
    }

    const result = await response.json() as { valid?: boolean; txHash?: string; settledAt?: string; error?: string }

    if (result.valid) {
      return {
        valid: true,
        txHash: result.txHash || '',
        settledAt: result.settledAt ? new Date(result.settledAt) : new Date(),
      }
    }

    return { valid: false, error: result.error || 'Payment verification failed' }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown verification error',
    }
  }
}

function parsePaymentHeader(header: string): PaymentHeader | null {
  try {
    // Header format: base64(JSON({ payload, signature }))
    const decoded = Buffer.from(header, 'base64').toString('utf-8')
    const parsed = JSON.parse(decoded)

    if (parsed.payload && parsed.signature) {
      return parsed as PaymentHeader
    }

    return null
  } catch {
    return null
  }
}

// Payment Error Response

export function createPaymentRequiredResponse(
  requirements: PaymentRequirement[]
): {
  content: Array<{ type: 'text'; text: string }>
  isError: boolean
  _meta: { paymentRequired: PaymentRequirement[] }
} {
  return {
    content: [
      {
        type: 'text',
        text: `Payment required. Amount: $${(parseInt(requirements[0].maxAmountRequired) / 1_000_000).toFixed(4)} USDC`,
      },
    ],
    isError: true,
    _meta: {
      paymentRequired: requirements,
    },
  }
}

// Payment Receipt

export function createPaymentReceipt(
  result: VerificationResult,
  amount: number,
  chain: string
): { txHash: string; amount: number; chain: string; settledAt?: string } {
  return {
    txHash: result.txHash || '',
    amount,
    chain,
    settledAt: result.settledAt?.toISOString(),
  }
}
