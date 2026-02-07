import express, { Request, Response } from 'express';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { AgentWallet } from '@apitoll/buyer-sdk';
import { PaymentRequired } from '@apitoll/shared';

const logger = pino();
const app = express();

// Constants
const USDC_ADDRESS_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];
const PORT = process.env.PORT || 3000;

// Types
interface PaymentRequest {
  id: string;
  originalUrl: string;
  originalMethod: string;
  paymentRequired: PaymentRequired;
  agentWallet: string;
  sellerAddress: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
  txHash?: string;
  error?: string;
}

// In-memory store (use Redis in production)
const pendingPayments = new Map<string, PaymentRequest>();

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /pay
 * Initiates payment for a 402 response
 *
 * Body:
 * {
 *   "original_url": "https://api.example.com/weather?location=nyc",
 *   "original_method": "GET",
 *   "payment_required": {
 *     "amount": 1000,
 *     "currency": "USDC",
 *     "recipient": "0x...",
 *     "chain": "base",
 *     "metadata": {...}
 *   },
 *   "agent_wallet": "0x...",
 *   "agent_private_key": "0x..." (optional - for signing)
 * }
 *
 * Returns:
 * {
 *   "payment_id": "uuid",
 *   "tx_hash": "0x...",
 *   "status": "processing"
 * }
 */
app.post('/pay', async (req: Request, res: Response) => {
  try {
    const {
      original_url,
      original_method,
      payment_required,
      agent_wallet,
      agent_private_key,
    } = req.body;

    // Validate inputs
    if (!payment_required?.amount || !payment_required?.recipient) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    if (!ethers.isAddress(agent_wallet) || !ethers.isAddress(payment_required.recipient)) {
      return res.status(400).json({ error: 'Invalid wallet addresses' });
    }

    const paymentId = uuidv4();
    const payment: PaymentRequest = {
      id: paymentId,
      originalUrl: original_url,
      originalMethod: original_method || 'GET',
      paymentRequired,
      agentWallet: agent_wallet,
      sellerAddress: payment_required.recipient,
      status: 'processing',
      createdAt: Date.now(),
    };

    pendingPayments.set(paymentId, payment);

    // Process payment asynchronously
    processPayment(paymentId, agent_private_key).catch((err) => {
      logger.error({ paymentId, error: err.message }, 'Payment processing failed');
      payment.status = 'failed';
      payment.error = err.message;
      payment.completedAt = Date.now();
    });

    res.status(202).json({
      payment_id: paymentId,
      status: 'processing',
      check_url: `/pay/${paymentId}`,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Payment request failed');
    res.status(500).json({ error: 'Payment initiation failed' });
  }
});

/**
 * GET /pay/:paymentId
 * Check status of a payment
 */
app.get('/pay/:paymentId', (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const payment = pendingPayments.get(paymentId);

  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  res.json({
    payment_id: paymentId,
    status: payment.status,
    tx_hash: payment.txHash,
    error: payment.error,
    completed_at: payment.completedAt,
  });
});

/**
 * Process the actual payment
 */
async function processPayment(paymentId: string, agentPrivateKey?: string) {
  const payment = pendingPayments.get(paymentId);
  if (!payment) throw new Error('Payment not found');

  logger.info({ paymentId }, 'Processing payment');

  try {
    // Get RPC provider
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');

    // Determine signer
    let signer: ethers.Signer;
    if (agentPrivateKey) {
      // Use provided private key (for testing/internal agents)
      signer = new ethers.Wallet(agentPrivateKey, provider);
    } else {
      // In production, this would use a wallet connected to the agent
      // For now, we require the private key
      throw new Error('Agent private key required for payment signing');
    }

    // Create USDC contract instance
    const usdc = new ethers.Contract(USDC_ADDRESS_BASE, USDC_ABI, signer);

    // Convert amount to USDC decimals (6)
    const amount = ethers.parseUnits(payment.paymentRequired.amount.toString(), 6);

    logger.info(
      { paymentId, to: payment.sellerAddress, amount: amount.toString() },
      'Submitting USDC transfer'
    );

    // Submit transfer
    const tx = await usdc.transfer(payment.sellerAddress, amount);
    const receipt = await tx.wait(2); // Wait for 2 confirmations

    if (!receipt) {
      throw new Error('Transaction failed - no receipt');
    }

    logger.info({ paymentId, txHash: receipt.hash }, 'Payment confirmed');

    // Update payment status
    payment.status = 'completed';
    payment.txHash = receipt.hash;
    payment.completedAt = Date.now();
  } catch (error: any) {
    logger.error({ paymentId, error: error.message }, 'Payment processing error');
    payment.status = 'failed';
    payment.error = error.message;
    payment.completedAt = Date.now();
    throw error;
  }
}

/**
 * POST /forward
 * Complete payment and forward original request to seller
 *
 * After payment completes, forward the original request
 */
app.post('/forward/:paymentId', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const payment = pendingPayments.get(paymentId);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'completed') {
      return res.status(402).json({ error: 'Payment not yet completed', payment_id: paymentId });
    }

    // Forward original request to seller with receipt
    // This would typically call the original URL with a receipt header
    const receipt = {
      payment_id: paymentId,
      tx_hash: payment.txHash,
      amount: payment.paymentRequired.amount,
      currency: payment.paymentRequired.currency,
    };

    // In production, forward to original seller URL
    logger.info({ paymentId, originalUrl: payment.originalUrl }, 'Forwarding to seller');

    res.json({
      success: true,
      payment_id: paymentId,
      tx_hash: payment.txHash,
      receipt,
      // In real implementation, would include seller response here
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Forward request failed');
    res.status(500).json({ error: 'Forward failed' });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Apitoll Facilitator listening');
});
