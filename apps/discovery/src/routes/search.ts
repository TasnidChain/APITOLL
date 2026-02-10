import { Hono } from 'hono'
import { z } from 'zod'
import {
  searchTools,
  getToolBySlug,
  getFeaturedTools,
  getToolsByCategory,
  getCategories,
  getPopularTags,
} from '../db/queries'

const app = new Hono()

// Search query params schema
const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  chains: z.string().optional(), // comma-separated
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minRating: z.coerce.number().optional(),
  sort: z.enum(['popular', 'rating', 'price_low', 'price_high', 'newest']).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
})

// Search Tools

// GET /tools - Search and list tools
app.get('/tools', async (c) => {
  const query = c.req.query()
  const params = searchSchema.safeParse(query)

  if (!params.success) {
    return c.json({ error: 'Invalid parameters', details: params.error.issues }, 400)
  }

  const { q, category, tags, chains, minPrice, maxPrice, minRating, sort, limit, offset } = params.data

  const tools = await searchTools({
    query: q,
    category,
    tags: tags?.split(',').map(t => t.trim()),
    chains: chains?.split(',').map(c => c.trim()),
    minPrice,
    maxPrice,
    minRating,
    sortBy: sort,
    limit: limit || 20,
    offset: offset || 0,
  })

  return c.json({
    tools,
    count: tools.length,
    query: q,
    filters: { category, tags, chains, minPrice, maxPrice, minRating },
  })
})

// GET /tools/featured - Get featured/top tools
app.get('/tools/featured', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10')
  const tools = await getFeaturedTools(limit)
  return c.json({ tools })
})

// GET /tools/:slug - Get tool by slug
app.get('/tools/:slug', async (c) => {
  const { slug } = c.req.param()
  const tool = await getToolBySlug(slug)

  if (!tool) {
    return c.json({ error: 'Tool not found' }, 404)
  }

  return c.json({ tool })
})

// Categories

// GET /categories - List all categories
app.get('/categories', async (c) => {
  const categories = await getCategories()
  return c.json({ categories })
})

// GET /categories/:id/tools - Get tools in category
app.get('/categories/:id/tools', async (c) => {
  const { id } = c.req.param()
  const limit = parseInt(c.req.query('limit') || '20')
  const tools = await getToolsByCategory(id, limit)
  return c.json({ tools, category: id })
})

// Tags

// GET /tags - Get popular tags
app.get('/tags', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20')
  const tags = await getPopularTags(limit)
  return c.json({ tags })
})

export default app
