import { Hono, type Context, type Next } from 'hono'

type Env = { Variables: { sellerId: string } }
import { z } from 'zod'
import {
  createTool,
  updateTool,
  deleteTool,
  getToolsBySeller,
  getToolById,
  getSellerByApiKey,
} from '../db/queries'

const app = new Hono<Env>()

// Schema for tool registration
const toolSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().min(10).max(1000),
  baseUrl: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().min(1),
  price: z.number().min(0),
  chains: z.array(z.enum(['base', 'solana'])).min(1),
  category: z.string().min(1),
  tags: z.array(z.string()).optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  mcpToolSpec: z.record(z.unknown()).optional(),
})

// Middleware to authenticate seller via API key
// Accepts: X-Seller-Key header (preferred) or X-Seller-ID (legacy, deprecated)
async function requireSeller(c: Context, next: Next) {
  const apiKey = c.req.header('X-Seller-Key') || c.req.header('Authorization')?.replace('Bearer ', '')

  if (apiKey) {
    // Preferred: validate against sellers table
    const seller = await getSellerByApiKey(apiKey)
    if (!seller) {
      return c.json({ error: 'Invalid seller API key' }, 401)
    }
    c.set('sellerId', seller.id)
    return next()
  }

  // Legacy fallback: X-Seller-ID header (for backward compatibility during migration)
  // TODO: Remove this fallback after all sellers migrate to API key auth
  const sellerId = c.req.header('X-Seller-ID')
  if (!sellerId) {
    return c.json({ error: 'Missing authentication. Provide X-Seller-Key header with your seller API key.' }, 401)
  }

  console.warn(`⚠️  Seller ${sellerId} using deprecated X-Seller-ID auth — migrate to X-Seller-Key`)
  c.set('sellerId', sellerId)
  await next()
}

// Seller Tool Management

// GET /seller/tools - List seller's tools
app.get('/seller/tools', requireSeller, async (c) => {
  const sellerId = c.get('sellerId')
  if (!sellerId) {
    return c.json({ error: 'Missing seller ID' }, 401)
  }
  const tools = await getToolsBySeller(sellerId)
  return c.json({ tools })
})

// POST /seller/tools - Register a new tool
app.post('/seller/tools', requireSeller, async (c) => {
  const sellerId = c.get('sellerId')
  if (!sellerId) {
    return c.json({ error: 'Missing seller ID' }, 401)
  }
  const body = await c.req.json()

  const result = toolSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Invalid tool data', details: result.error.issues }, 400)
  }

  try {
    const tool = await createTool({
      sellerId,
      ...result.data,
    })
    return c.json({ tool }, 201)
  } catch (error: unknown) {
    if ((error as { code?: string }).code === '23505') {
      return c.json({ error: 'Tool with this slug already exists' }, 409)
    }
    throw error
  }
})

// PATCH /seller/tools/:id - Update a tool
app.patch('/seller/tools/:id', requireSeller, async (c) => {
  const sellerId = c.get('sellerId')
  if (!sellerId) {
    return c.json({ error: 'Missing seller ID' }, 401)
  }
  const { id } = c.req.param()
  const body = await c.req.json()

  // Verify ownership
  const existing = await getToolById(id)
  if (!existing || existing.seller_id !== sellerId) {
    return c.json({ error: 'Tool not found' }, 404)
  }

  const updates = toolSchema.partial().safeParse(body)
  if (!updates.success) {
    return c.json({ error: 'Invalid update data', details: updates.error.issues }, 400)
  }

  const tool = await updateTool(id, updates.data)
  return c.json({ tool })
})

// DELETE /seller/tools/:id - Delete (deactivate) a tool
app.delete('/seller/tools/:id', requireSeller, async (c) => {
  const sellerId = c.get('sellerId')
  if (!sellerId) {
    return c.json({ error: 'Missing seller ID' }, 401)
  }
  const { id } = c.req.param()

  // Verify ownership
  const existing = await getToolById(id)
  if (!existing || existing.seller_id !== sellerId) {
    return c.json({ error: 'Tool not found' }, 404)
  }

  await deleteTool(id)
  return c.json({ success: true })
})

export default app
