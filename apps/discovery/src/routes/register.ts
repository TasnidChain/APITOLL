import { Hono, type Context, type Next } from 'hono'
import { z } from 'zod'
import {
  createTool,
  updateTool,
  deleteTool,
  getToolsBySeller,
  getToolById,
} from '../db/queries'

const app = new Hono()

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

// Middleware to get seller from header
async function requireSeller(c: Context, next: Next) {
  const sellerId = c.req.header('X-Seller-ID')
  if (!sellerId) {
    return c.json({ error: 'Missing X-Seller-ID header' }, 401)
  }
  c.set('sellerId', sellerId)
  await next()
}

// ═══════════════════════════════════════════════════
// Seller Tool Management
// ═══════════════════════════════════════════════════

// GET /seller/tools - List seller's tools
app.get('/seller/tools', requireSeller, async (c) => {
  const sellerId = c.get('sellerId') as string | undefined
  if (!sellerId) {
    return c.json({ error: 'Missing seller ID' }, 401)
  }
  const tools = await getToolsBySeller(sellerId)
  return c.json({ tools })
})

// POST /seller/tools - Register a new tool
app.post('/seller/tools', requireSeller, async (c) => {
  const sellerId = c.get('sellerId') as string | undefined
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
  const sellerId = c.get('sellerId') as string | undefined
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
  const sellerId = c.get('sellerId') as string | undefined
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
