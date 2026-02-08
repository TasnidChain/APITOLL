import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'

import { checkConnection } from './db/client'
import transactionsRouter from './routes/transactions'
import agentsRouter from './routes/agents'
import sellersRouter from './routes/sellers'
import analyticsRouter from './routes/analytics'

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

// API routes
app.route('/api/transactions', transactionsRouter)
app.route('/api/agents', agentsRouter)
app.route('/api/sellers', sellersRouter)
app.route('/api/analytics', analyticsRouter)

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
const port = parseInt(process.env.PORT || '3002')

console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   API Toll Transaction Indexer              ║
║                                                   ║
║   Port: ${port}                                    ║
║   Health: http://localhost:${port}/health           ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
`)

serve({
  fetch: app.fetch,
  port,
})

export default app
