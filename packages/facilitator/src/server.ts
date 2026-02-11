import 'dotenv/config';
import * as Sentry from '@sentry/node';
import express, { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import pino from 'pino';
import {
  SECURITY_HEADERS,
  isOriginAllowed,
  secureCompare,
  BASE_USDC_ADDRESS,
} from '@apitoll/shared';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

// Must be initialized before any other middleware/handlers
if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.3, // 30% of transactions for perf monitoring
    integrations: [
      Sentry.expressIntegration(),
    ],
    ignoreErrors: [
      // Rate limit responses are expected, not errors
      'Too many requests',
      // Validation errors are expected user input issues
      'Validation failed',
    ],
    initialScope: {
      tags: {
        app: 'facilitator',
        platform: 'apitoll',
      },
    },
  });
}

const logger = pino();

// ─── Convex Persistence (optional — falls back to in-memory only) ──
const CONVEX_URL = process.env.CONVEX_URL;
let convexClient: ConvexHttpClient | null = null;

if (CONVEX_URL) {
  convexClient = new ConvexHttpClient(CONVEX_URL);
  logger.info({ convexUrl: CONVEX_URL }, 'Convex persistence enabled');
} else {
  logger.warn('CONVEX_URL not set — payments will NOT persist across restarts');
}

// Convex function references (avoids importing generated API)
const upsertPaymentRef = makeFunctionReference<"mutation">("facilitator:upsertPayment");
const updatePaymentStatusRef = makeFunctionReference<"mutation">("facilitator:updatePaymentStatus");
const getActivePaymentsRef = makeFunctionReference<"query">("facilitator:getActivePayments");
const getByIdempotencyKeyRef = makeFunctionReference<"query">("facilitator:getByIdempotencyKey");

// Shared secret for Convex facilitator functions (defense-in-depth)
const FACILITATOR_CONVEX_SECRET = process.env.FACILITATOR_CONVEX_SECRET || '';


function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    logger.fatal({ variable: name }, 'Missing required environment variable');
    process.exit(1);
  }
  return value;
}

// Validate critical env vars at startup
const FACILITATOR_PRIVATE_KEY = requireEnv('FACILITATOR_PRIVATE_KEY');
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY || ''; // Optional: enables Solana payments
const PORT = parseInt(process.env.PORT || '3000', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
const API_KEYS = (process.env.FACILITATOR_API_KEYS || '').split(',').filter(Boolean);
if (API_KEYS.length === 0 && process.env.NODE_ENV === 'production') {
  logger.fatal('FACILITATOR_API_KEYS must be set in production — refusing to start in open auth mode');
  process.exit(1);
}

// ─── Platform Fee Configuration ──────────────────────────────────────
// The facilitator collects a platform fee on every custodial payment.
// Fee is deducted from the payment: seller gets (amount - fee), platform gets fee.
const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || '300', 10); // 300 = 3%
const PLATFORM_FEE_WALLET_BASE = process.env.PLATFORM_FEE_WALLET_BASE || '';
const PLATFORM_FEE_WALLET_SOLANA = process.env.PLATFORM_FEE_WALLET_SOLANA || '';

if (PLATFORM_FEE_WALLET_BASE) {
  logger.info({ wallet: PLATFORM_FEE_WALLET_BASE, feeBps: PLATFORM_FEE_BPS }, 'Platform fee enabled (Base)');
} else {
  logger.warn('PLATFORM_FEE_WALLET_BASE not set — no platform fee will be collected on Base payments');
}
if (PLATFORM_FEE_WALLET_SOLANA) {
  logger.info({ wallet: PLATFORM_FEE_WALLET_SOLANA, feeBps: PLATFORM_FEE_BPS }, 'Platform fee enabled (Solana)');
}


import { transferSolanaUSDC, transferSolanaUSDCWithFee, broadcastSolanaTransaction, verifySolanaTransaction } from './solana';

const SOLANA_ENABLED = !!SOLANA_PRIVATE_KEY;
if (SOLANA_ENABLED) {
  logger.info('Solana chain enabled for USDC payments');
} else {
  logger.info('Solana chain disabled (no SOLANA_PRIVATE_KEY)');
}


const USDC_ADDRESS_BASE = process.env.USDC_ADDRESS || BASE_USDC_ADDRESS;
const USDC_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];
const MAX_PAYMENT_AMOUNT = 100; // $100 USDC max per single payment (safety cap)
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per API key

// ─── Redis for Rate Limiting (optional — falls back to in-memory) ──
let redisClient: { incr(key: string): Promise<number>; expire(key: string, seconds: number): Promise<void> } | null = null;
let redisCircuitOpen = true;
let redisCircuitOpenedAt = Date.now();
let redisFailureCount = 0;
const REDIS_CIRCUIT_FAILURE_THRESHOLD = 5;
const REDIS_CIRCUIT_RESET_MS = 30_000;

const REDIS_URL = process.env.REDIS_URL
  || (process.env.REDIS_HOST
    ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || '6379'}`
    : null);

if (REDIS_URL) {
  const redisModuleName = 'redis';
  (import(redisModuleName) as Promise<any>).then((Redis: any) => {
    const client = Redis.createClient({ url: REDIS_URL });
    client.connect?.().then(() => {
      redisClient = client as any;
      redisCircuitOpen = false;
      logger.info('Redis connected for facilitator rate limiting');
    }).catch((err: Error) => {
      logger.warn({ error: err.message }, 'Redis connect failed, using in-memory rate limiting');
    });
    client.on?.('error', (err: Error) => {
      logger.error({ error: err.message }, 'Redis error (facilitator)');
      redisFailureCount++;
      if (redisFailureCount >= REDIS_CIRCUIT_FAILURE_THRESHOLD) {
        redisCircuitOpen = true;
        redisCircuitOpenedAt = Date.now();
        logger.warn('Redis circuit breaker OPEN (facilitator). Falling back to in-memory.');
      }
    });
  }).catch(() => {
    logger.warn('Redis not available for facilitator, using in-memory rate limiting');
  });
}


// Solana addresses are base58-encoded, 32-44 chars. EVM addresses start with 0x.
function isValidAddress(addr: string, chain: string): boolean {
  if (chain === 'solana') {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
  }
  return ethers.isAddress(addr);
}

const PaymentRequirementSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  currency: z.string().default('USDC'),
  recipient: z.string().min(1, 'Recipient address is required'),
  chain: z.enum(['base', 'solana']).default('base'),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const PayRequestSchema = z.object({
  original_url: z.string().url('Invalid original URL'),
  original_method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']).default('GET'),
  original_headers: z.record(z.string()).optional(),
  original_body: z.unknown().optional(),
  payment_required: PaymentRequirementSchema,
  agent_wallet: z.string().min(1, 'Agent wallet address is required'),
  signed_tx: z.string().optional(),
}).refine((data) => isValidAddress(data.payment_required.recipient, data.payment_required.chain), {
  message: 'Invalid recipient address for the specified chain',
  path: ['payment_required', 'recipient'],
}).refine((data) => isValidAddress(data.agent_wallet, data.payment_required.chain), {
  message: 'Invalid agent wallet address for the specified chain',
  path: ['agent_wallet'],
});


/** Express Request with an attached API key (set by requireAuth middleware). */
interface AuthenticatedRequest extends Request {
  apiKey: string;
}

/** JSON-serializable value (used for Convex `v.any()` fields). */
type JsonValue = string | number | boolean | null | undefined | JsonValue[] | { [key: string]: JsonValue };

interface FeeInfo {
  feeBps: number;
  platformWallet: string;
  sellerAmount: bigint;  // USDC smallest units (6 decimals)
  platformFee: bigint;   // USDC smallest units (6 decimals)
}

/**
 * Calculate the fee split for a payment.
 * Returns null if no platform fee should be collected (no wallet configured).
 */
function calculateFeeSplit(chain: 'base' | 'solana', amountUsdc: string, metadata?: Record<string, unknown>): FeeInfo | null {
  const platformWallet = chain === 'base' ? PLATFORM_FEE_WALLET_BASE : PLATFORM_FEE_WALLET_SOLANA;
  if (!platformWallet) return null;

  const feeBps = PLATFORM_FEE_BPS;
  if (feeBps <= 0) return null;

  const totalSmallest = ethers.parseUnits(amountUsdc, 6);
  const platformFee = (totalSmallest * BigInt(feeBps)) / 10000n;
  const sellerAmount = totalSmallest - platformFee;

  if (platformFee <= 0n) return null;

  return { feeBps, platformWallet, sellerAmount, platformFee };
}

interface PaymentRecord {
  id: string;
  idempotencyKey?: string; // Client-provided key to prevent duplicate payments
  originalUrl: string;
  originalMethod: string;
  originalHeaders?: Record<string, string>;
  originalBody?: unknown;
  paymentRequired: z.infer<typeof PaymentRequirementSchema>;
  agentWallet: string;
  sellerAddress: string;
  apiKey: string; // track which API key initiated
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
  txHash?: string;
  feeTxHash?: string; // tx hash of the platform fee transfer (if separate)
  feeInfo?: { feeBps: number; platformFee: string; sellerAmount: string }; // human-readable
  error?: string;
}


const pendingPayments = new Map<string, PaymentRecord>();
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale payments every 10 minutes (prevent memory leaks)
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24h
  for (const [id, payment] of pendingPayments) {
    if (payment.completedAt && payment.completedAt < cutoff) {
      pendingPayments.delete(id);
    }
  }
}, 10 * 60 * 1000);

/**
 * Persist a payment record to Convex (fire-and-forget).
 * Errors are logged but don't block the payment flow.
 */
async function persistPayment(payment: PaymentRecord) {
  if (!convexClient) return;
  try {
    await convexClient.mutation(upsertPaymentRef, {
      _secret: FACILITATOR_CONVEX_SECRET,
      paymentId: payment.id,
      idempotencyKey: payment.idempotencyKey,
      originalUrl: payment.originalUrl,
      originalMethod: payment.originalMethod,
      originalHeaders: payment.originalHeaders,
      originalBody: payment.originalBody as JsonValue,
      amount: payment.paymentRequired.amount,
      currency: payment.paymentRequired.currency,
      recipient: payment.paymentRequired.recipient,
      chain: payment.paymentRequired.chain,
      agentWallet: payment.agentWallet,
      sellerAddress: payment.sellerAddress,
      apiKey: payment.apiKey,
      status: payment.status,
      txHash: payment.txHash,
      error: payment.error,
      createdAt: payment.createdAt,
      completedAt: payment.completedAt,
    });
  } catch (err: unknown) {
    logger.error({ paymentId: payment.id, error: err instanceof Error ? err.message : String(err) }, 'Failed to persist payment to Convex');
  }
}

/**
 * Update payment status in Convex (fire-and-forget).
 */
async function persistPaymentStatus(paymentId: string, status: PaymentRecord['status'], txHash?: string, error?: string) {
  if (!convexClient) return;
  try {
    await convexClient.mutation(updatePaymentStatusRef, {
      _secret: FACILITATOR_CONVEX_SECRET,
      paymentId,
      status,
      txHash,
      error,
      completedAt: (status === 'completed' || status === 'failed') ? Date.now() : undefined,
    });
  } catch (err: unknown) {
    logger.error({ paymentId, error: err instanceof Error ? err.message : String(err) }, 'Failed to update payment status in Convex');
  }
}

/**
 * Recover active payments from Convex on startup.
 */
async function recoverPaymentsFromConvex() {
  if (!convexClient) return;
  try {
    const activePayments = await convexClient.query(getActivePaymentsRef, { _secret: FACILITATOR_CONVEX_SECRET });
    let recovered = 0;
    for (const p of activePayments) {
      if (!pendingPayments.has(p.paymentId)) {
        pendingPayments.set(p.paymentId, {
          id: p.paymentId,
          originalUrl: p.originalUrl,
          originalMethod: p.originalMethod,
          originalHeaders: p.originalHeaders as Record<string, string> | undefined,
          originalBody: p.originalBody,
          paymentRequired: {
            amount: p.amount,
            currency: p.currency,
            recipient: p.recipient,
            chain: p.chain as 'base' | 'solana',
          },
          agentWallet: p.agentWallet,
          sellerAddress: p.sellerAddress,
          apiKey: p.apiKey,
          status: p.status as PaymentRecord['status'],
          createdAt: p.createdAt,
          completedAt: p.completedAt,
          txHash: p.txHash,
          error: p.error,
        });
        recovered++;
      }
    }
    if (recovered > 0) {
      logger.info({ recovered }, 'Recovered active payments from Convex');
    }
  } catch (err: unknown) {
    logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to recover payments from Convex');
  }
}


const app = express();
app.use(express.json({ limit: '1mb' }));


app.use((_req: Request, res: Response, next: NextFunction) => {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(header, value);
  }
  next();
});


app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin || null;

  if (ALLOWED_ORIGINS.length === 0) {
    // Development: allow all
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (origin && isOriginAllowed(origin, ALLOWED_ORIGINS)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// ─── Rate Limiting Middleware (Redis-backed with in-memory fallback) ──

function checkMemoryRateLimit(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

async function checkRedisRateLimit(key: string): Promise<{ allowed: boolean; count: number }> {
  if (!redisClient || redisCircuitOpen) {
    if (redisCircuitOpen && Date.now() - redisCircuitOpenedAt > REDIS_CIRCUIT_RESET_MS) {
      redisCircuitOpen = false;
      redisFailureCount = 0;
    } else {
      throw new Error('circuit_open');
    }
  }
  try {
    const windowSec = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
    const count = await redisClient!.incr(key);
    if (count === 1) {
      await redisClient!.expire(key, windowSec);
    }
    redisFailureCount = 0;
    return { allowed: count <= RATE_LIMIT_MAX_REQUESTS, count };
  } catch (e) {
    redisFailureCount++;
    if (redisFailureCount >= REDIS_CIRCUIT_FAILURE_THRESHOLD) {
      redisCircuitOpen = true;
      redisCircuitOpenedAt = Date.now();
      logger.warn('Redis circuit breaker OPEN (facilitator). Falling back to in-memory.');
    }
    throw e;
  }
}

async function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.headers.authorization || req.ip || 'unknown';

  try {
    const redisKey = `fac:rl:${key}:${Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS)}`;
    const result = await checkRedisRateLimit(redisKey);
    if (!result.allowed) {
      const retryAfter = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests', retry_after_seconds: retryAfter });
    }
    return next();
  } catch {
    // Fallback to in-memory
    const result = checkMemoryRateLimit(key);
    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfter));
      return res.status(429).json({ error: 'Too many requests', retry_after_seconds: result.retryAfter });
    }
    return next();
  }
}

// Cleanup in-memory rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);


function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header (Bearer <api-key>)' });
  }

  const providedKey = authHeader.slice(7);

  // If no API keys configured, allow all (development mode)
  if (API_KEYS.length === 0) {
    logger.warn('No FACILITATOR_API_KEYS configured — running in open mode (development only)');
    (req as AuthenticatedRequest).apiKey = 'dev';
    return next();
  }

  const isValid = API_KEYS.some((key) => secureCompare(key, providedKey));
  if (!isValid) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  (req as AuthenticatedRequest).apiKey = providedKey.slice(0, 8) + '...'; // truncated for logging
  next();
}


app.get('/', (req: Request, res: Response) => {
  const accept = req.headers.accept || '';
  if (accept.includes('text/html')) {
    return res.redirect(302, 'https://apitoll.com');
  }
  res.json({
    service: 'apitoll-facilitator',
    protocol: 'x402',
    description: 'API Toll payment facilitator — handles USDC micropayments for AI agent API calls on Base.',
    docs: 'https://github.com/TasnidChain/APITOLL',
    dashboard: 'https://apitoll.com/dashboard',
    health: 'https://pay.apitoll.com/health',
    endpoints: {
      pay: 'POST /pay — Initiate a payment',
      status: 'GET /pay/:paymentId — Check payment status',
      forward: 'POST /forward/:paymentId — Forward request to seller after payment',
      verify: 'POST /verify — Verify a payment on-chain',
    },
    discovery: 'https://apitoll.com/api/discover',
  });
});


app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    pending_payments: pendingPayments.size,
  });
});


/**
 * Detailed facilitator status including wallet balance.
 * Use this endpoint to monitor your facilitator in production.
 */
app.get('/status', rateLimit, requireAuth, async (_req: Request, res: Response) => {
  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const wallet = new ethers.Wallet(FACILITATOR_PRIVATE_KEY, provider);
    const usdc = new ethers.Contract(
      USDC_ADDRESS_BASE,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );

    const [ethBalance, usdcBalance, blockNumber] = await Promise.all([
      provider.getBalance(wallet.address),
      usdc.balanceOf(wallet.address),
      provider.getBlockNumber(),
    ]);

    const ethFormatted = parseFloat(ethers.formatEther(ethBalance));
    const usdcFormatted = parseFloat(ethers.formatUnits(usdcBalance, 6));

    // Count payments by status
    let completed = 0, failed = 0, processing = 0, totalVolume = 0;
    for (const payment of pendingPayments.values()) {
      if (payment.status === 'completed') {
        completed++;
        totalVolume += parseFloat(payment.paymentRequired.amount);
      }
      else if (payment.status === 'failed') failed++;
      else if (payment.status === 'processing') processing++;
    }

    // Estimate gas runway
    const avgGasPerTx = 0.00005; // ~50k gas at typical Base fees
    const estimatedTxRunway = ethFormatted > 0 ? Math.floor(ethFormatted / avgGasPerTx) : 0;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      network: BASE_RPC_URL.includes('sepolia') ? 'base-sepolia' : 'base-mainnet',
      wallet: {
        address: wallet.address,
        eth_balance: ethFormatted.toFixed(6),
        usdc_balance: usdcFormatted.toFixed(2),
        estimated_tx_runway: estimatedTxRunway,
      },
      payments: {
        completed,
        failed,
        processing,
        total: pendingPayments.size,
        total_volume_usdc: totalVolume.toFixed(4),
      },
      block_number: blockNumber,
      uptime_seconds: Math.floor(process.uptime()),
    });
  } catch (error: unknown) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Status check failed');
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve status — check RPC connection',
    });
  }
});


/**
 * Initiates a USDC payment on behalf of the agent.
 *
 * The facilitator holds a custodial hot wallet (FACILITATOR_PRIVATE_KEY)
 * that agents pre-fund. Agents never send their private keys — instead,
 * they call this endpoint with their wallet address and the facilitator
 * executes the transfer from its own funded wallet.
 *
 * For agents that prefer self-custody, they can provide a pre-signed
 * transaction in `signed_tx` and the facilitator will broadcast it.
 */
app.post('/pay', rateLimit, requireAuth, async (req: Request, res: Response) => {
  try {
    // If the client sends an Idempotency-Key header and we've seen it before,
    // return the cached response immediately — no duplicate payment.
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    if (idempotencyKey) {
      // Check in-memory first (fast path)
      for (const payment of pendingPayments.values()) {
        if (payment.idempotencyKey === idempotencyKey) {
          logger.info({ idempotencyKey, paymentId: payment.id }, 'Idempotent hit (in-memory)');
          return res.status(202).json({
            payment_id: payment.id,
            status: payment.status,
            check_url: `/pay/${payment.id}`,
            idempotent: true,
          });
        }
      }

      // Check Convex (covers server restarts)
      if (convexClient) {
        try {
          const existing = await convexClient.query(getByIdempotencyKeyRef, {
            _secret: FACILITATOR_CONVEX_SECRET,
            idempotencyKey,
          });
          if (existing) {
            logger.info({ idempotencyKey, paymentId: existing.paymentId }, 'Idempotent hit (Convex)');
            return res.status(202).json({
              payment_id: existing.paymentId,
              status: existing.status,
              check_url: `/pay/${existing.paymentId}`,
              idempotent: true,
            });
          }
        } catch (err: unknown) {
          // Don't block payment if Convex lookup fails — log and continue
          logger.warn({ idempotencyKey, error: err instanceof Error ? err.message : String(err) }, 'Idempotency check failed (Convex), proceeding');
        }
      }
    }

    const parseResult = PayRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const data = parseResult.data;

    // Safety check: enforce max payment amount
    const amountNum = parseFloat(data.payment_required.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Payment amount must be positive' });
    }
    if (amountNum > MAX_PAYMENT_AMOUNT) {
      return res.status(400).json({
        error: `Payment amount $${amountNum} exceeds safety cap of $${MAX_PAYMENT_AMOUNT}`,
      });
    }

    // Chain validation
    if (data.payment_required.chain === 'solana' && !SOLANA_ENABLED) {
      return res.status(400).json({ error: 'Solana chain not configured on this facilitator. Set SOLANA_PRIVATE_KEY to enable.' });
    }
    if (!['base', 'solana'].includes(data.payment_required.chain)) {
      return res.status(400).json({ error: 'Unsupported chain. Supported: base, solana' });
    }

    const paymentId = uuidv4();
    const payment: PaymentRecord = {
      id: paymentId,
      idempotencyKey,
      originalUrl: data.original_url,
      originalMethod: data.original_method,
      originalHeaders: data.original_headers,
      originalBody: data.original_body,
      paymentRequired: data.payment_required,
      agentWallet: data.agent_wallet,
      sellerAddress: data.payment_required.recipient,
      apiKey: (req as AuthenticatedRequest).apiKey || 'unknown',
      status: 'processing',
      createdAt: Date.now(),
    };

    pendingPayments.set(paymentId, payment);

    // Persist to Convex (fire-and-forget)
    persistPayment(payment);

    // Process payment asynchronously
    processPayment(paymentId, data.signed_tx).catch((err: unknown) => {
      logger.error({ paymentId, error: err instanceof Error ? err.message : String(err) }, 'Payment processing failed');
      payment.status = 'failed';
      payment.error = 'Payment processing failed. Please try again.';
      payment.completedAt = Date.now();
      persistPaymentStatus(paymentId, 'failed', undefined, payment.error);
    });

    res.status(202).json({
      payment_id: paymentId,
      status: 'processing',
      check_url: `/pay/${paymentId}`,
    });
  } catch (error: unknown) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Payment request failed');
    res.status(500).json({ error: 'Payment initiation failed' });
  }
});


app.get('/pay/:paymentId', rateLimit, requireAuth, (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const payment = pendingPayments.get(paymentId);

  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  res.json({
    payment_id: paymentId,
    status: payment.status,
    tx_hash: payment.txHash,
    fee_tx_hash: payment.feeTxHash,
    fee_info: payment.feeInfo,
    error: payment.error,
    created_at: payment.createdAt,
    completed_at: payment.completedAt,
  });
});


async function processPayment(paymentId: string, signedTx?: string) {
  const payment = pendingPayments.get(paymentId);
  if (!payment) throw new Error('Payment not found');

  const chain = payment.paymentRequired.chain;
  const fee = calculateFeeSplit(chain, payment.paymentRequired.amount, payment.paymentRequired.metadata);

  if (fee) {
    payment.feeInfo = {
      feeBps: fee.feeBps,
      platformFee: ethers.formatUnits(fee.platformFee, 6),
      sellerAmount: ethers.formatUnits(fee.sellerAmount, 6),
    };
    logger.info(
      { paymentId, chain, total: payment.paymentRequired.amount, sellerAmount: payment.feeInfo.sellerAmount, platformFee: payment.feeInfo.platformFee, feeBps: fee.feeBps, to: payment.sellerAddress },
      'Processing payment with fee split'
    );
  } else {
    logger.info(
      { paymentId, chain, amount: payment.paymentRequired.amount, to: payment.sellerAddress },
      'Processing payment (no fee — platform wallet not configured)'
    );
  }

  try {
    if (chain === 'solana') {
      if (signedTx) {
        // Pre-signed: can't split fees — broadcast as-is
        logger.info({ paymentId }, 'Broadcasting pre-signed Solana transaction (no fee split on pre-signed)');
        const result = await broadcastSolanaTransaction(SOLANA_RPC_URL, signedTx);
        payment.status = 'completed';
        payment.txHash = result.txHash;
        payment.completedAt = Date.now();
        logger.info({ paymentId, txHash: result.txHash, slot: result.slot }, 'Solana pre-signed payment confirmed');
        persistPaymentStatus(paymentId, 'completed', result.txHash);
      } else if (fee) {
        // Custodial Solana with fee split: two transfers in one atomic tx
        const result = await transferSolanaUSDCWithFee(
          { rpcUrl: SOLANA_RPC_URL, privateKey: SOLANA_PRIVATE_KEY },
          payment.sellerAddress,
          fee.sellerAmount,
          fee.platformWallet,
          fee.platformFee
        );
        payment.status = 'completed';
        payment.txHash = result.txHash;
        payment.completedAt = Date.now();
        logger.info({ paymentId, txHash: result.txHash, slot: result.slot, feeBps: fee.feeBps }, 'Solana USDC payment with fee split confirmed');
        persistPaymentStatus(paymentId, 'completed', result.txHash);
      } else {
        // Custodial Solana, no fee
        const result = await transferSolanaUSDC(
          { rpcUrl: SOLANA_RPC_URL, privateKey: SOLANA_PRIVATE_KEY },
          payment.sellerAddress,
          payment.paymentRequired.amount
        );
        payment.status = 'completed';
        payment.txHash = result.txHash;
        payment.completedAt = Date.now();
        logger.info({ paymentId, txHash: result.txHash, slot: result.slot }, 'Solana USDC payment confirmed');
        persistPaymentStatus(paymentId, 'completed', result.txHash);
      }
    } else {
      // ─── Base (EVM) ───────────────────────────────────────────
      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);

      if (signedTx) {
        // Pre-signed: can't split fees — broadcast as-is
        logger.info({ paymentId }, 'Broadcasting pre-signed EVM transaction (no fee split on pre-signed)');
        const txResponse = await provider.broadcastTransaction(signedTx);
        const receipt = await txResponse.wait(2);

        if (!receipt) throw new Error('Transaction failed — no receipt');

        payment.status = 'completed';
        payment.txHash = receipt.hash;
        payment.completedAt = Date.now();
        logger.info({ paymentId, txHash: receipt.hash }, 'Pre-signed payment confirmed');
        persistPaymentStatus(paymentId, 'completed', receipt.hash);
      } else {
        const signer = new ethers.Wallet(FACILITATOR_PRIVATE_KEY, provider);
        const usdc = new ethers.Contract(USDC_ADDRESS_BASE, USDC_ABI, signer);

        if (fee) {
          // ─── Custodial EVM with fee split ───────────────────────
          logger.info(
            { paymentId, seller: payment.sellerAddress, sellerAmount: fee.sellerAmount.toString(), platformWallet: fee.platformWallet, platformFee: fee.platformFee.toString() },
            'Submitting split USDC transfers (seller + platform fee)'
          );

          // Transfer 1: Seller gets their share
          const sellerTx = await usdc.transfer(payment.sellerAddress, fee.sellerAmount);
          const sellerReceipt = await sellerTx.wait(2);
          if (!sellerReceipt) throw new Error('Seller transfer failed — no receipt');

          payment.txHash = sellerReceipt.hash;
          logger.info({ paymentId, txHash: sellerReceipt.hash }, 'Seller payment confirmed');

          // Transfer 2: Platform fee
          try {
            const feeTx = await usdc.transfer(fee.platformWallet, fee.platformFee);
            const feeReceipt = await feeTx.wait(2);
            if (feeReceipt) {
              payment.feeTxHash = feeReceipt.hash;
              logger.info({ paymentId, feeTxHash: feeReceipt.hash, feeAmount: payment.feeInfo?.platformFee }, 'Platform fee transfer confirmed');
            }
          } catch (feeError: unknown) {
            // Seller already got paid — log fee failure but don't fail the whole payment
            logger.error({ paymentId, error: feeError instanceof Error ? feeError.message : String(feeError) }, 'Platform fee transfer failed (seller payment succeeded)');
          }

          payment.status = 'completed';
          payment.completedAt = Date.now();
          persistPaymentStatus(paymentId, 'completed', sellerReceipt.hash);
        } else {
          // ─── Custodial EVM, no fee ──────────────────────────────
          const amount = ethers.parseUnits(payment.paymentRequired.amount, 6);

          logger.info(
            { paymentId, to: payment.sellerAddress, amount: amount.toString() },
            'Submitting USDC transfer from facilitator wallet'
          );

          const tx = await usdc.transfer(payment.sellerAddress, amount);
          const receipt = await tx.wait(2);

          if (!receipt) throw new Error('Transaction failed — no receipt');

          payment.status = 'completed';
          payment.txHash = receipt.hash;
          payment.completedAt = Date.now();
          logger.info({ paymentId, txHash: receipt.hash }, 'Payment confirmed');
          persistPaymentStatus(paymentId, 'completed', receipt.hash);
        }
      }
    }
  } catch (error: unknown) {
    logger.error({ paymentId, chain, error: error instanceof Error ? error.message : String(error) }, 'Payment processing error');
    payment.status = 'failed';
    payment.error = 'Payment processing failed. Please try again.';
    payment.completedAt = Date.now();
    persistPaymentStatus(paymentId, 'failed', undefined, payment.error);
    throw error;
  }
}


/**
 * After payment completes, forward the original request to the seller
 * with the payment receipt in X-PAYMENT header.
 */
app.post('/forward/:paymentId', rateLimit, requireAuth, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const payment = pendingPayments.get(paymentId);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'completed') {
      return res.status(402).json({
        error: 'Payment not yet completed',
        payment_id: paymentId,
        status: payment.status,
      });
    }

    // Build receipt for the seller
    const receipt = {
      payment_id: paymentId,
      tx_hash: payment.txHash,
      amount: payment.paymentRequired.amount,
      currency: payment.paymentRequired.currency,
      chain: payment.paymentRequired.chain,
      payer: payment.agentWallet,
    };

    logger.info(
      { paymentId, originalUrl: payment.originalUrl, method: payment.originalMethod },
      'Forwarding request to seller'
    );

    // Actually forward the original request to the seller
    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-PAYMENT': JSON.stringify(receipt),
      'X-PAYMENT-TX-HASH': payment.txHash || '',
      ...(payment.originalHeaders || {}),
    };

    // Remove auth headers — don't forward the agent's facilitator API key to the seller
    delete forwardHeaders['authorization'];
    delete forwardHeaders['Authorization'];

    const fetchOptions: RequestInit = {
      method: payment.originalMethod,
      headers: forwardHeaders,
    };

    // Include body for non-GET/HEAD requests
    if (payment.originalBody && !['GET', 'HEAD'].includes(payment.originalMethod)) {
      fetchOptions.body = typeof payment.originalBody === 'string'
        ? payment.originalBody
        : JSON.stringify(payment.originalBody);
    }

    const sellerResponse = await fetch(payment.originalUrl, fetchOptions);
    const sellerContentType = sellerResponse.headers.get('content-type') || '';
    let sellerData: unknown;

    if (sellerContentType.includes('application/json')) {
      sellerData = await sellerResponse.json();
    } else {
      sellerData = await sellerResponse.text();
    }

    res.status(sellerResponse.status).json({
      success: sellerResponse.ok,
      payment_id: paymentId,
      tx_hash: payment.txHash,
      receipt,
      seller_status: sellerResponse.status,
      seller_response: sellerData,
    });
  } catch (error: unknown) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Forward request failed');
    res.status(502).json({ error: 'Failed to forward request to seller' });
  }
});


/**
 * Verify a payment from an X-PAYMENT header.
 * Called by seller middleware to validate that a payment is real.
 *
 * Body: { payload: <decoded X-PAYMENT>, requirements: PaymentRequirement[] }
 * Returns: { valid: boolean, txHash?: string, from?: string, blockNumber?: number, error?: string }
 */
app.post('/verify', rateLimit, async (req: Request, res: Response) => {
  try {
    const parseResult = z.object({
      payload: z.record(z.unknown()),
      requirements: z.array(z.record(z.unknown())),
    }).safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        valid: false,
        error: 'Invalid verification request',
      });
    }

    const { payload, requirements } = parseResult.data;
    const txHash = payload.txHash as string | undefined;
    const paymentId = payload.paymentId as string | undefined;

    // Option 1: Verify by payment ID (facilitator-managed payment)
    if (paymentId) {
      const payment = pendingPayments.get(paymentId);
      if (!payment) {
        return res.json({ valid: false, error: 'Payment ID not found' });
      }
      if (payment.status === 'completed') {
        return res.json({
          valid: true,
          txHash: payment.txHash,
          from: payment.agentWallet,
        });
      }
      return res.json({
        valid: false,
        error: `Payment status: ${payment.status}`,
      });
    }

    // Option 2: Verify by on-chain transaction hash
    if (txHash) {
      // Detect chain from payload or txHash format
      const chain = (payload.chain as string) || 'base';
      const isSolana = chain === 'solana' || (txHash.length >= 64 && !txHash.startsWith('0x'));

      if (isSolana) {
        // Solana verification
        const requirement = requirements[0] as { payTo?: string } | undefined;
        const result = await verifySolanaTransaction(SOLANA_RPC_URL, txHash, requirement?.payTo);
        return res.json(result);
      }

      // Base (EVM) verification
      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return res.json({
          valid: false,
          error: 'Transaction not found or not confirmed',
        });
      }

      const currentBlock = await provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      if (confirmations < 1) {
        return res.json({
          valid: false,
          error: `Insufficient confirmations: ${confirmations}`,
        });
      }

      // Verify recipient matches requirement if provided
      const requirement = requirements[0] as { payTo?: string } | undefined;
      if (requirement?.payTo && receipt.to?.toLowerCase() !== requirement.payTo.toLowerCase()) {
        return res.json({
          valid: false,
          error: 'Payment recipient mismatch',
        });
      }

      return res.json({
        valid: true,
        txHash: receipt.hash,
        from: receipt.from,
        blockNumber: receipt.blockNumber,
      });
    }

    return res.json({
      valid: false,
      error: 'No txHash or paymentId provided for verification',
    });
  } catch (error: unknown) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Verification failed');
    res.status(500).json({
      valid: false,
      error: 'Verification failed',
    });
  }
});


app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Sentry Error Handler (must be before custom error handler) ──
Sentry.setupExpressErrorHandler(app);


app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ error: err.message }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});


let server: ReturnType<typeof app.listen>;

function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received, closing server...');
  server.close(async () => {
    // Flush Sentry events before exiting
    await Sentry.close(2000);
    logger.info('Server closed.');
    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.warn('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));


process.on('unhandledRejection', (reason) => {
  logger.error(
    { reason: reason instanceof Error ? reason.message : String(reason) },
    'Unhandled promise rejection'
  );
  Sentry.captureException(reason);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught exception — shutting down');
  Sentry.captureException(error);
  Sentry.close(2000).then(() => process.exit(1));
});


// Only start listening when run directly (not when imported by tests)
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  server = app.listen(PORT, async () => {
    logger.info({ port: PORT }, 'API Toll Facilitator listening');
    if (API_KEYS.length === 0) {
      logger.warn('No FACILITATOR_API_KEYS set — running in open mode (development only)');
    }
    if (ALLOWED_ORIGINS.length === 0) {
      logger.warn('No ALLOWED_ORIGINS set — CORS allows all origins (development only)');
    }

    // Recover any in-flight payments from Convex
    await recoverPaymentsFromConvex();
  });
}

export { app };
