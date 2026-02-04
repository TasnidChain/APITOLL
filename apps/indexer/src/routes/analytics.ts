import { Hono } from 'hono'
import { requireOrgAuth } from '../middleware/auth'
import { getOverviewStats, getDailyStats } from '../db/queries'

const app = new Hono()

// Overview stats for dashboard
app.get('/overview', requireOrgAuth, async (c) => {
  const org = c.get('org')
  const stats = await getOverviewStats(org.id)
  return c.json(stats)
})

// Daily spend chart data
app.get('/daily', requireOrgAuth, async (c) => {
  const org = c.get('org')
  const { days } = c.req.query()
  const data = await getDailyStats(org.id, days ? parseInt(days) : 30)
  return c.json({ data })
})

export default app
