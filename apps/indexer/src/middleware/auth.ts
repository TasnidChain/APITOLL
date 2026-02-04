import { Context, Next } from 'hono'
import { getOrganizationByApiKey, getSellerByApiKey } from '../db/queries'

// Auth middleware for dashboard/platform API
export async function requireOrgAuth(c: Context, next: Next) {
  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '')

  if (!apiKey) {
    return c.json({ error: 'Missing API key' }, 401)
  }

  const org = await getOrganizationByApiKey(apiKey)
  if (!org) {
    return c.json({ error: 'Invalid API key' }, 401)
  }

  c.set('org', org)
  await next()
}

// Auth middleware for seller SDK webhook
export async function requireSellerAuth(c: Context, next: Next) {
  const apiKey = c.req.header('X-Seller-Key')

  if (!apiKey) {
    return c.json({ error: 'Missing seller API key' }, 401)
  }

  const seller = await getSellerByApiKey(apiKey)
  if (!seller) {
    return c.json({ error: 'Invalid seller API key' }, 401)
  }

  c.set('seller', seller)
  await next()
}
