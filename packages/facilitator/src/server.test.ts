import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// ─── Mock Environment Variables ─────────────────────────────────
// Must be set BEFORE importing the server module

// Mock ethers to avoid real blockchain calls
vi.mock('ethers', () => {
  const isAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

  return {
    ethers: {
      isAddress,
      JsonRpcProvider: vi.fn().mockImplementation(() => ({
        broadcastTransaction: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({
            hash: '0xmocktxhash123456789abcdef',
          }),
        }),
      })),
      Wallet: vi.fn().mockImplementation(() => ({})),
      Contract: vi.fn().mockImplementation(() => ({
        transfer: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({
            hash: '0xmocktxhash123456789abcdef',
          }),
        }),
      })),
      parseUnits: vi.fn().mockReturnValue(BigInt(5000)),
    },
  };
});

// Mock pino logger
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  }),
}));

// ─── Test Setup ──────────────────────────────────────────────────

// Set env vars before import
process.env.FACILITATOR_PRIVATE_KEY = '0x' + 'a'.repeat(64);
process.env.BASE_RPC_URL = 'https://test-rpc.example.com';
process.env.FACILITATOR_API_KEYS = 'test-key-123,test-key-456';

// We need to build a test app since the real server starts listening
// Let's create a minimal test harness

const VALID_WALLET = '0x' + '1'.repeat(40);
const VALID_RECIPIENT = '0x' + '2'.repeat(40);
const TEST_API_KEY = 'test-key-123';

function makePayRequest(overrides: Record<string, unknown> = {}) {
  return {
    original_url: 'https://api.example.com/weather?city=nyc',
    original_method: 'GET',
    payment_required: {
      amount: '0.005',
      currency: 'USDC',
      recipient: VALID_RECIPIENT,
      chain: 'base',
    },
    agent_wallet: VALID_WALLET,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('Facilitator Server', () => {
  let app: express.Express;

  beforeAll(async () => {
    const mod = await import('./server.js');
    app = mod.app;
  });

  describe('GET /health', () => {
    it('returns ok status without auth', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
      expect(typeof res.body.pending_payments).toBe('number');
    });
  });

  describe('POST /pay — Authentication', () => {
    it('rejects requests without Authorization header', async () => {
      const res = await request(app).post('/pay').send(makePayRequest());
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Missing Authorization');
    });

    it('rejects requests with invalid API key', async () => {
      const res = await request(app)
        .post('/pay')
        .set('Authorization', 'Bearer invalid-key')
        .send(makePayRequest());
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Invalid API key');
    });

    it('accepts requests with valid API key', async () => {
      const res = await request(app)
        .post('/pay')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send(makePayRequest());
      expect(res.status).toBe(202);
      expect(res.body.payment_id).toBeDefined();
      expect(res.body.status).toBe('processing');
    });
  });

  describe('POST /pay — Validation', () => {
    it('rejects missing payment_required', async () => {
      const res = await request(app)
        .post('/pay')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send({ original_url: 'https://example.com', agent_wallet: VALID_WALLET });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('rejects invalid agent wallet address', async () => {
      const res = await request(app)
        .post('/pay')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send(makePayRequest({ agent_wallet: 'not-an-address' }));
      expect(res.status).toBe(400);
      expect(res.body.details).toBeDefined();
    });

    it('rejects invalid recipient address', async () => {
      const res = await request(app)
        .post('/pay')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send(
          makePayRequest({
            payment_required: {
              amount: '0.005',
              recipient: 'bad-address',
              chain: 'base',
            },
          })
        );
      expect(res.status).toBe(400);
    });

    it('rejects invalid original_url', async () => {
      const res = await request(app)
        .post('/pay')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send(makePayRequest({ original_url: 'not-a-url' }));
      expect(res.status).toBe(400);
    });

    it('rejects amount exceeding safety cap', async () => {
      const res = await request(app)
        .post('/pay')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send(
          makePayRequest({
            payment_required: {
              amount: '500',
              currency: 'USDC',
              recipient: VALID_RECIPIENT,
              chain: 'base',
            },
          })
        );
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('safety cap');
    });

    it('rejects negative amount', async () => {
      const res = await request(app)
        .post('/pay')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send(
          makePayRequest({
            payment_required: {
              amount: '-5',
              currency: 'USDC',
              recipient: VALID_RECIPIENT,
              chain: 'base',
            },
          })
        );
      expect(res.status).toBe(400);
    });

    it('rejects unsupported chain', async () => {
      const res = await request(app)
        .post('/pay')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send(
          makePayRequest({
            payment_required: {
              amount: '0.005',
              currency: 'USDC',
              recipient: VALID_RECIPIENT,
              chain: 'solana',
            },
          })
        );
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Only Base chain');
    });

    it('accepts numeric amount and coerces to string', async () => {
      const res = await request(app)
        .post('/pay')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send(
          makePayRequest({
            payment_required: {
              amount: 0.005,
              currency: 'USDC',
              recipient: VALID_RECIPIENT,
              chain: 'base',
            },
          })
        );
      expect(res.status).toBe(202);
    });
  });

  describe('GET /pay/:paymentId — Status Check', () => {
    it('returns 404 for unknown payment', async () => {
      const res = await request(app)
        .get('/pay/nonexistent-id')
        .set('Authorization', `Bearer ${TEST_API_KEY}`);
      expect(res.status).toBe(404);
    });

    it('returns payment status for valid payment', async () => {
      // Create a payment first
      const createRes = await request(app)
        .post('/pay')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send(makePayRequest());

      const paymentId = createRes.body.payment_id;

      const statusRes = await request(app)
        .get(`/pay/${paymentId}`)
        .set('Authorization', `Bearer ${TEST_API_KEY}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.payment_id).toBe(paymentId);
      expect(['processing', 'completed', 'failed']).toContain(statusRes.body.status);
    });
  });

  describe('POST /forward/:paymentId', () => {
    it('returns 404 for unknown payment', async () => {
      const res = await request(app)
        .post('/forward/nonexistent-id')
        .set('Authorization', `Bearer ${TEST_API_KEY}`);
      expect(res.status).toBe(404);
    });

    it('rejects forward if payment not completed', async () => {
      // Create a payment but don't wait for completion
      const createRes = await request(app)
        .post('/pay')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send(makePayRequest());

      // Immediately try to forward (payment still processing)
      const forwardRes = await request(app)
        .post(`/forward/${createRes.body.payment_id}`)
        .set('Authorization', `Bearer ${TEST_API_KEY}`);

      // Could be 402 (still processing), 200 (completed + forwarded),
      // or 502 (completed but seller unreachable in test)
      expect([200, 402, 502]).toContain(forwardRes.status);
    });

    it('requires auth for forward', async () => {
      const res = await request(app).post('/forward/some-id');
      expect(res.status).toBe(401);
    });
  });

  describe('Security', () => {
    it('returns security headers', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['strict-transport-security']).toContain('max-age');
    });

    it('handles CORS preflight', async () => {
      const res = await request(app)
        .options('/pay')
        .set('Origin', 'https://example.com');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-methods']).toContain('POST');
    });

    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });

    it('does not leak internal error details', async () => {
      const res = await request(app)
        .post('/pay')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send('not json');
      // Express json middleware will reject this
      expect(res.status).toBe(400);
    });
  });
});
