import { Hono } from 'hono'
import { z } from 'zod'
import { requireOrgAuth } from '../middleware/auth'
import {
  getAgentsByOrg,
  getAgentById,
  createAgent,
  updateAgentBalance,
} from '../db/queries'

const app = new Hono()

const createAgentSchema = z.object({
  name: z.string().min(1),
  walletAddress: z.string().min(1),
  chain: z.enum(['base', 'solana']),
  policies: z.array(z.object({
    type: z.enum(['budget', 'vendor_acl', 'rate_limit']),
  }).passthrough()).optional(),
})

// List agents
app.get('/', requireOrgAuth, async (c) => {
  const org = c.get('org') as { id: string } | undefined
  if (!org) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const agents = await getAgentsByOrg(org.id)
  return c.json({ agents })
})

// Get single agent
app.get('/:id', requireOrgAuth, async (c) => {
  const { id } = c.req.param()
  const agent = await getAgentById(id)

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  return c.json({ agent })
})

// Create agent
app.post('/', requireOrgAuth, async (c) => {
  const org = c.get('org') as { id: string } | undefined
  if (!org) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const body = await c.req.json()

  const result = createAgentSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Invalid payload', details: result.error.issues }, 400)
  }

  const agent = await createAgent({
    orgId: org.id,
    name: result.data.name,
    walletAddress: result.data.walletAddress,
    chain: result.data.chain,
    policiesJson: result.data.policies,
  })

  return c.json({ agent }, 201)
})

// Update agent balance
app.patch('/:id/balance', requireOrgAuth, async (c) => {
  const { id } = c.req.param()
  const { balance } = await c.req.json()

  if (typeof balance !== 'number' || balance < 0) {
    return c.json({ error: 'Invalid balance' }, 400)
  }

  const agent = await updateAgentBalance(id, balance)

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  return c.json({ agent })
})

export default app
