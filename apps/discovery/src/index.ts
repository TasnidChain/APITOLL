import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'

import { checkConnection } from './db/client'
import searchRouter from './routes/search'
import registerRouter from './routes/register'
import mcpRouter from './routes/mcp'

const app = new Hono()

// Middleware
app.use('*', cors())
app.use('*', logger())

// Health check
app.get('/health', async (c) => {
  const dbOk = await checkConnection()
  return c.json({
    status: dbOk ? 'healthy' : 'degraded',
    database: dbOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  })
})

// Landing page with API docs
app.get('/', (c) => {
  return c.json({
    name: 'AgentCommerce Discovery API',
    version: '0.1.0',
    description: 'Find and discover paid AI tools and APIs',
    endpoints: {
      search: {
        'GET /tools': 'Search tools (query: q, category, tags, chains, minPrice, maxPrice, sort)',
        'GET /tools/featured': 'Get featured tools',
        'GET /tools/:slug': 'Get tool by slug',
        'GET /categories': 'List categories',
        'GET /categories/:id/tools': 'Get tools in category',
        'GET /tags': 'Get popular tags',
      },
      mcp: {
        'GET /mcp/tools': 'List tools in MCP format',
        'GET /mcp/tools/:slug': 'Get tool in MCP format',
        'GET /openapi/tools/:slug': 'Get tool as OpenAPI spec',
        'POST /mcp/discover': 'AI-friendly discovery (body: query, maxPrice, preferredChains)',
      },
      seller: {
        'GET /seller/tools': 'List your registered tools (header: X-Seller-ID)',
        'POST /seller/tools': 'Register a new tool',
        'PATCH /seller/tools/:id': 'Update a tool',
        'DELETE /seller/tools/:id': 'Deactivate a tool',
      },
    },
  })
})

// Routes
app.route('/', searchRouter)
app.route('/', registerRouter)
app.route('/', mcpRouter)

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

// Start server
const port = parseInt(process.env.PORT || '3003')

console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   AgentCommerce Discovery API                     ║
║                                                   ║
║   Port: ${port}                                    ║
║   Docs: http://localhost:${port}/                   ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
`)

serve({
  fetch: app.fetch,
  port,
})

export default app
