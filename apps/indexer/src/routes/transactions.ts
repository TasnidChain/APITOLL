import { Hono } from 'hono'
import { z } from 'zod'
import { requireOrgAuth, requireSellerAuth } from '../middleware/auth'
import {
  createTransaction,
  updateTransactionStatus,
  getTransactionsByOrg,
} from '../db/queries'

const app = new Hono()

// Schema for transaction report from seller SDK
const transactionReportSchema = z.object({
  id: z.string(),
  txHash: z.string().optional(),
  agentAddress: z.string(),
  endpointPath: z.string(),
  method: z.string().default('GET'),
  amount: z.number(),
  chain: z.enum(['base', 'solana']),
  status: z.enum(['pending', 'settled', 'failed', 'refunded']),
  responseStatus: z.number().optional(),
  latencyMs: z.number().optional(),
  requestedAt: z.string().datetime(),
  settledAt: z.string().datetime().optional(),
  blockNumber: z.number().optional(),
})

const batchReportSchema = z.object({
  transactions: z.array(transactionReportSchema),
})

// ═══════════════════════════════════════════════════
// Webhook endpoint for Seller SDK
// ═══════════════════════════════════════════════════

app.post('/report', requireSellerAuth, async (c) => {
  const seller = c.get('seller') as { id: string } | undefined
  if (!seller) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const body = await c.req.json()

  const result = batchReportSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Invalid payload', details: result.error.issues }, 400)
  }

  const { transactions } = result.data
  const created = []

  for (const tx of transactions) {
    try {
      const record = await createTransaction({
        ...tx,
        sellerId: seller.id,
        requestedAt: new Date(tx.requestedAt),
        settledAt: tx.settledAt ? new Date(tx.settledAt) : undefined,
      })
      created.push(record)
    } catch (error: unknown) {
      // Ignore duplicates (idempotent)
      if ((error as { code?: string }).code !== '23505') {
        console.error('Failed to create transaction:', error)
      }
    }
  }

  return c.json({
    received: transactions.length,
    created: created.length,
  })
})

// ═══════════════════════════════════════════════════
// Dashboard API endpoints
// ═══════════════════════════════════════════════════

app.get('/', requireOrgAuth, async (c) => {
  const org = c.get('org') as { id: string } | undefined
  if (!org) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const { limit, offset, status, chain, agentId } = c.req.query()

  const transactions = await getTransactionsByOrg(org.id, {
    limit: limit ? parseInt(limit) : undefined,
    offset: offset ? parseInt(offset) : undefined,
    status,
    chain,
    agentId,
  })

  return c.json({ transactions })
})

app.patch('/:id/status', requireOrgAuth, async (c) => {
  const { id } = c.req.param()
  const { status, txHash } = await c.req.json()

  if (!['settled', 'failed', 'refunded'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }

  const tx = await updateTransactionStatus(
    id,
    status,
    txHash,
    status === 'settled' ? new Date() : undefined
  )

  if (!tx) {
    return c.json({ error: 'Transaction not found' }, 404)
  }

  return c.json({ transaction: tx })
})

export default app
