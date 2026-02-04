import { Hono } from 'hono'
import { z } from 'zod'
import { requireOrgAuth } from '../middleware/auth'
import {
  getSellersByOrg,
  createSeller,
  getEndpointsBySeller,
  upsertEndpoint,
} from '../db/queries'

const app = new Hono()

const createSellerSchema = z.object({
  name: z.string().min(1),
  walletAddress: z.string().min(1),
})

const upsertEndpointSchema = z.object({
  method: z.string().default('GET'),
  path: z.string().min(1),
  price: z.number().min(0),
  chains: z.array(z.enum(['base', 'solana'])),
  description: z.string().optional(),
})

// List sellers
app.get('/', requireOrgAuth, async (c) => {
  const org = c.get('org')
  const sellers = await getSellersByOrg(org.id)
  return c.json({ sellers })
})

// Create seller
app.post('/', requireOrgAuth, async (c) => {
  const org = c.get('org')
  const body = await c.req.json()

  const result = createSellerSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Invalid payload', details: result.error.issues }, 400)
  }

  const seller = await createSeller({
    orgId: org.id,
    name: result.data.name,
    walletAddress: result.data.walletAddress,
  })

  return c.json({ seller }, 201)
})

// Get seller endpoints
app.get('/:id/endpoints', requireOrgAuth, async (c) => {
  const { id } = c.req.param()
  const endpoints = await getEndpointsBySeller(id)
  return c.json({ endpoints })
})

// Create/update endpoint
app.post('/:id/endpoints', requireOrgAuth, async (c) => {
  const { id } = c.req.param()
  const body = await c.req.json()

  const result = upsertEndpointSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Invalid payload', details: result.error.issues }, 400)
  }

  const endpoint = await upsertEndpoint({
    sellerId: id,
    ...result.data,
  })

  return c.json({ endpoint }, 201)
})

export default app
