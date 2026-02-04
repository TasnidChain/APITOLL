import { sql } from './client'

// ═══════════════════════════════════════════════════
// Tool Types
// ═══════════════════════════════════════════════════

export interface Tool {
  id: string
  seller_id: string
  name: string
  slug: string
  description: string
  base_url: string
  method: string
  path: string
  price: number
  currency: string
  chains: string[]
  category: string
  tags: string[]
  input_schema: object | null
  output_schema: object | null
  mcp_tool_spec: object | null
  total_calls: number
  avg_latency_ms: number
  uptime_pct: number
  rating: number
  rating_count: number
  is_active: boolean
  is_verified: boolean
  created_at: Date
  updated_at: Date
  seller_name?: string
}

export interface SearchOptions {
  query?: string
  category?: string
  tags?: string[]
  chains?: string[]
  minPrice?: number
  maxPrice?: number
  minRating?: number
  sortBy?: 'popular' | 'rating' | 'price_low' | 'price_high' | 'newest'
  limit?: number
  offset?: number
}

// ═══════════════════════════════════════════════════
// Search & Discovery
// ═══════════════════════════════════════════════════

export async function searchTools(options: SearchOptions = {}): Promise<Tool[]> {
  const {
    query,
    category,
    tags,
    chains,
    minPrice,
    maxPrice,
    minRating,
    sortBy = 'popular',
    limit = 20,
    offset = 0,
  } = options

  // Build sort clause
  const sortClause = {
    popular: sql`t.total_calls DESC`,
    rating: sql`t.rating DESC NULLS LAST`,
    price_low: sql`t.price ASC`,
    price_high: sql`t.price DESC`,
    newest: sql`t.created_at DESC`,
  }[sortBy]

  return sql<Tool[]>`
    SELECT t.*, s.name as seller_name
    FROM tools t
    LEFT JOIN sellers s ON t.seller_id = s.id
    WHERE t.is_active = true
      ${query ? sql`AND (
        to_tsvector('english', t.name || ' ' || t.description || ' ' || t.category)
        @@ plainto_tsquery('english', ${query})
        OR t.name ILIKE ${'%' + query + '%'}
        OR t.description ILIKE ${'%' + query + '%'}
      )` : sql``}
      ${category ? sql`AND t.category = ${category}` : sql``}
      ${tags && tags.length > 0 ? sql`AND t.tags && ${tags}` : sql``}
      ${chains && chains.length > 0 ? sql`AND t.chains && ${chains}` : sql``}
      ${minPrice !== undefined ? sql`AND t.price >= ${minPrice}` : sql``}
      ${maxPrice !== undefined ? sql`AND t.price <= ${maxPrice}` : sql``}
      ${minRating !== undefined ? sql`AND t.rating >= ${minRating}` : sql``}
    ORDER BY ${sortClause}
    LIMIT ${limit} OFFSET ${offset}
  `
}

export async function getToolBySlug(slug: string): Promise<Tool | null> {
  const [tool] = await sql<Tool[]>`
    SELECT t.*, s.name as seller_name
    FROM tools t
    LEFT JOIN sellers s ON t.seller_id = s.id
    WHERE t.slug = ${slug} AND t.is_active = true
  `
  return tool || null
}

export async function getToolById(id: string): Promise<Tool | null> {
  const [tool] = await sql<Tool[]>`
    SELECT t.*, s.name as seller_name
    FROM tools t
    LEFT JOIN sellers s ON t.seller_id = s.id
    WHERE t.id = ${id}
  `
  return tool || null
}

export async function getFeaturedTools(limit = 10): Promise<Tool[]> {
  return sql<Tool[]>`
    SELECT t.*, s.name as seller_name
    FROM tools t
    LEFT JOIN sellers s ON t.seller_id = s.id
    WHERE t.is_active = true AND t.is_verified = true
    ORDER BY t.rating DESC, t.total_calls DESC
    LIMIT ${limit}
  `
}

export async function getToolsByCategory(category: string, limit = 20): Promise<Tool[]> {
  return sql<Tool[]>`
    SELECT t.*, s.name as seller_name
    FROM tools t
    LEFT JOIN sellers s ON t.seller_id = s.id
    WHERE t.is_active = true AND t.category = ${category}
    ORDER BY t.total_calls DESC
    LIMIT ${limit}
  `
}

// ═══════════════════════════════════════════════════
// Categories
// ═══════════════════════════════════════════════════

export interface Category {
  id: string
  name: string
  description: string | null
  icon: string | null
  tool_count: number
}

export async function getCategories(): Promise<Category[]> {
  return sql<Category[]>`
    SELECT c.*, COUNT(t.id)::int as tool_count
    FROM categories c
    LEFT JOIN tools t ON t.category = c.id AND t.is_active = true
    GROUP BY c.id
    ORDER BY tool_count DESC
  `
}

// ═══════════════════════════════════════════════════
// Tool Registration (for sellers)
// ═══════════════════════════════════════════════════

export interface CreateToolInput {
  sellerId: string
  name: string
  slug: string
  description: string
  baseUrl: string
  method: string
  path: string
  price: number
  chains: string[]
  category: string
  tags?: string[]
  inputSchema?: object
  outputSchema?: object
  mcpToolSpec?: object
}

export async function createTool(input: CreateToolInput): Promise<Tool> {
  const [tool] = await sql<Tool[]>`
    INSERT INTO tools (
      seller_id, name, slug, description, base_url, method, path,
      price, chains, category, tags, input_schema, output_schema, mcp_tool_spec
    )
    VALUES (
      ${input.sellerId},
      ${input.name},
      ${input.slug},
      ${input.description},
      ${input.baseUrl},
      ${input.method},
      ${input.path},
      ${input.price},
      ${input.chains},
      ${input.category},
      ${input.tags || []},
      ${input.inputSchema ? JSON.stringify(input.inputSchema) : null},
      ${input.outputSchema ? JSON.stringify(input.outputSchema) : null},
      ${input.mcpToolSpec ? JSON.stringify(input.mcpToolSpec) : null}
    )
    RETURNING *
  `
  return tool
}

export async function updateTool(id: string, updates: Partial<CreateToolInput>): Promise<Tool | null> {
  const [tool] = await sql<Tool[]>`
    UPDATE tools SET
      name = COALESCE(${updates.name ?? null}, name),
      description = COALESCE(${updates.description ?? null}, description),
      price = COALESCE(${updates.price ?? null}, price),
      chains = COALESCE(${updates.chains ?? null}, chains),
      category = COALESCE(${updates.category ?? null}, category),
      tags = COALESCE(${updates.tags ?? null}, tags),
      input_schema = COALESCE(${updates.inputSchema ? JSON.stringify(updates.inputSchema) : null}, input_schema),
      output_schema = COALESCE(${updates.outputSchema ? JSON.stringify(updates.outputSchema) : null}, output_schema),
      mcp_tool_spec = COALESCE(${updates.mcpToolSpec ? JSON.stringify(updates.mcpToolSpec) : null}, mcp_tool_spec),
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `
  return tool || null
}

export async function deleteTool(id: string): Promise<boolean> {
  const result = await sql`
    UPDATE tools SET is_active = false WHERE id = ${id}
  `
  return result.count > 0
}

export async function getToolsBySeller(sellerId: string): Promise<Tool[]> {
  return sql<Tool[]>`
    SELECT * FROM tools
    WHERE seller_id = ${sellerId}
    ORDER BY created_at DESC
  `
}

// ═══════════════════════════════════════════════════
// Stats & Analytics
// ═══════════════════════════════════════════════════

export async function incrementToolCalls(toolId: string, latencyMs: number): Promise<void> {
  await sql`
    UPDATE tools SET
      total_calls = total_calls + 1,
      avg_latency_ms = (avg_latency_ms * total_calls + ${latencyMs}) / (total_calls + 1)
    WHERE id = ${toolId}
  `
}

export async function getPopularTags(limit = 20): Promise<{ tag: string; count: number }[]> {
  return sql`
    SELECT unnest(tags) as tag, COUNT(*) as count
    FROM tools
    WHERE is_active = true
    GROUP BY tag
    ORDER BY count DESC
    LIMIT ${limit}
  `
}
