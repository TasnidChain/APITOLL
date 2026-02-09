/**
 * API Toll Cloudflare Worker
 * 
 * Routes:
 * - /api/* → Backend API (indexer, payments, discovery)
 * - /health → Health check
 * - /* → Dashboard (static assets)
 */

import { Router } from 'itty-router';

interface Env {
  CACHE: KVNamespace;
  SESSIONS: KVNamespace;
  DB: D1Database;
  BUCKET: R2Bucket;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  EXECUTOR_PRIVATE_KEY: string;
  BASE_RPC_URL: string;
  ALLOWED_ORIGINS: string;
  LOG_LEVEL: string;
}

const router = Router<{ Bindings: Env }>();

/**
 * Health Check
 */
router.get('/health', (req, env) => {
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.ENVIRONMENT || 'unknown',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});

/**
 * API Routes
 */

// Discovery API
router.get('/api/discovery/tools', async (req, env) => {
  try {
    // Query D1 database for tools
    const { results } = await env.DB.prepare(
      'SELECT * FROM tools WHERE isActive = 1 LIMIT 100'
    ).all();

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch tools' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Payment webhook
router.post('/api/webhook/stripe', async (req, env) => {
  try {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    // Verify webhook signature using HMAC-SHA256
    if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: 'Missing signature or webhook secret' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse Stripe signature header (t=timestamp,v1=signature)
    const sigParts = sig.split(',').reduce((acc: Record<string, string>, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {});

    const timestamp = sigParts['t'];
    const signature = sigParts['v1'];

    if (!timestamp || !signature) {
      return new Response(JSON.stringify({ error: 'Invalid signature format' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Reject if timestamp is older than 5 minutes (replay protection)
    const age = Math.abs(Date.now() / 1000 - parseInt(timestamp));
    if (age > 300) {
      return new Response(JSON.stringify({ error: 'Webhook timestamp too old' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Compute expected signature: HMAC-SHA256(secret, "timestamp.body")
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.STRIPE_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`));
    const expected = Array.from(new Uint8Array(signed), (b) => b.toString(16).padStart(2, '0')).join('');

    // Constant-time comparison to prevent timing attacks on signature
    const len = Math.max(expected.length, signature.length);
    let diff = expected.length ^ signature.length;
    for (let i = 0; i < len; i++) {
      diff |= (expected.charCodeAt(i) || 0) ^ (signature.charCodeAt(i) || 0);
    }
    if (diff !== 0) {
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(body);

    if (event.type === 'payment_intent.succeeded') {
      // Store payment event in KV for processing
      await env.SESSIONS.put(
        `stripe_event:${event.id}`,
        JSON.stringify({ type: event.type, paymentIntentId: event.data.object.id, timestamp: Date.now() }),
        { expirationTtl: 86400 }
      );
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Facilitator payment endpoint
router.post('/api/pay', async (req, env) => {
  try {
    const { original_url, original_method, payment_required, agent_wallet } = await req.json();

    // Validate inputs
    if (!payment_required?.amount || !payment_required?.recipient) {
      return new Response(JSON.stringify({ error: 'Missing payment details' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const paymentId = crypto.randomUUID();

    // Store payment in KV (fast access)
    await env.SESSIONS.put(
      `payment:${paymentId}`,
      JSON.stringify({
        id: paymentId,
        originalUrl: original_url,
        originalMethod: original_method,
        paymentRequired,
        agentWallet: agent_wallet,
        status: 'processing',
        createdAt: Date.now(),
      }),
      { expirationTtl: 3600 } // 1 hour expiry
    );

    return new Response(
      JSON.stringify({
        payment_id: paymentId,
        status: 'processing',
        check_url: `/api/pay/${paymentId}`,
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch {
    return new Response(JSON.stringify({ error: 'Payment initiation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Check payment status
router.get('/api/pay/:paymentId', async (req, env) => {
  try {
    const { paymentId } = req.params;
    const payment = await env.SESSIONS.get(`payment:${paymentId}`);

    if (!payment) {
      return new Response(JSON.stringify({ error: 'Payment not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(payment, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch payment status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Dashboard static files (placeholder)
 */
router.get('/*', () => {
  return new Response('API Toll Dashboard - Deploy static assets from apps/dashboard', {
    headers: { 'Content-Type': 'text/html' },
  });
});

/**
 * 404
 */
router.all('*', () => {
  return new Response('Not found', { status: 404 });
});

/**
 * Export handler
 */
export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) =>
    router.handle(req, env, ctx).catch(() => {
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
};
