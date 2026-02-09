import { Hono } from 'hono'
import { getToolBySlug, searchTools, Tool } from '../db/queries'

const app = new Hono()

// ═══════════════════════════════════════════════════
// MCP Tool Format Helpers
// ═══════════════════════════════════════════════════

interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  // x402 extensions
  'x-402': {
    baseUrl: string
    method: string
    path: string
    price: number
    currency: string
    chains: string[]
    sellerId: string
  }
}

function toolToMCP(tool: Tool): MCPTool {
  // Use custom MCP spec if provided, otherwise generate from schema
  if (tool.mcp_tool_spec) {
    return {
      ...(tool.mcp_tool_spec as MCPTool),
      'x-402': {
        baseUrl: tool.base_url,
        method: tool.method,
        path: tool.path,
        price: tool.price,
        currency: tool.currency,
        chains: tool.chains,
        sellerId: tool.seller_id,
      },
    }
  }

  return {
    name: tool.slug,
    description: tool.description,
    inputSchema: (tool.input_schema as MCPTool['inputSchema']) || {
      type: 'object',
      properties: {},
    },
    'x-402': {
      baseUrl: tool.base_url,
      method: tool.method,
      path: tool.path,
      price: tool.price,
      currency: tool.currency,
      chains: tool.chains,
      sellerId: tool.seller_id,
    },
  }
}

// ═══════════════════════════════════════════════════
// OpenAPI Spec Generator
// ═══════════════════════════════════════════════════

interface OpenAPISpec {
  openapi: string
  info: {
    title: string
    description: string
    version: string
  }
  servers: { url: string }[]
  paths: Record<string, unknown>
  'x-402-pricing': {
    price: number
    currency: string
    chains: string[]
  }
}

function toolToOpenAPI(tool: Tool): OpenAPISpec {
  const pathKey = tool.path.startsWith('/') ? tool.path : `/${tool.path}`

  return {
    openapi: '3.0.0',
    info: {
      title: tool.name,
      description: tool.description,
      version: '1.0.0',
    },
    servers: [{ url: tool.base_url }],
    paths: {
      [pathKey]: {
        [tool.method.toLowerCase()]: {
          summary: tool.name,
          description: tool.description,
          requestBody: tool.input_schema
            ? {
                content: {
                  'application/json': {
                    schema: tool.input_schema,
                  },
                },
              }
            : undefined,
          responses: {
            '200': {
              description: 'Successful response',
              content: tool.output_schema
                ? {
                    'application/json': {
                      schema: tool.output_schema,
                    },
                  }
                : undefined,
            },
            '402': {
              description: 'Payment Required',
              headers: {
                'X-Payment-Required': {
                  schema: { type: 'string' },
                  description: 'Payment requirements in x402 format',
                },
              },
            },
          },
        },
      },
    },
    'x-402-pricing': {
      price: tool.price,
      currency: tool.currency,
      chains: tool.chains,
    },
  }
}

// ═══════════════════════════════════════════════════
// MCP Endpoints
// ═══════════════════════════════════════════════════

// GET /mcp/tools - List all tools in MCP format
app.get('/mcp/tools', async (c) => {
  const category = c.req.query('category')
  const chains = c.req.query('chains')?.split(',')
  const limit = parseInt(c.req.query('limit') || '50')

  const tools = await searchTools({
    category,
    chains,
    limit,
    sortBy: 'popular',
  })

  const mcpTools = tools.map(toolToMCP)

  return c.json({
    tools: mcpTools,
    count: mcpTools.length,
  })
})

// GET /mcp/tools/:slug - Get single tool in MCP format
app.get('/mcp/tools/:slug', async (c) => {
  const { slug } = c.req.param()
  const tool = await getToolBySlug(slug)

  if (!tool) {
    return c.json({ error: 'Tool not found' }, 404)
  }

  return c.json(toolToMCP(tool))
})

// GET /openapi/tools/:slug - Get tool as OpenAPI spec
app.get('/openapi/tools/:slug', async (c) => {
  const { slug } = c.req.param()
  const tool = await getToolBySlug(slug)

  if (!tool) {
    return c.json({ error: 'Tool not found' }, 404)
  }

  return c.json(toolToOpenAPI(tool))
})

// ═══════════════════════════════════════════════════
// Agent Tool Discovery
// ═══════════════════════════════════════════════════

// POST /mcp/discover - AI-friendly discovery endpoint
// Agents can describe what they need, get matching tools
app.post('/mcp/discover', async (c) => {
  const { query, capabilities: _capabilities, maxPrice, preferredChains } = await c.req.json()

  const tools = await searchTools({
    query,
    maxPrice,
    chains: preferredChains,
    limit: 10,
    sortBy: 'rating',
  })

  // Return in a format optimized for AI agents
  return c.json({
    recommendations: tools.map((tool) => ({
      tool: toolToMCP(tool),
      relevance: {
        name: tool.name,
        category: tool.category,
        pricePerCall: `$${tool.price} ${tool.currency}`,
        rating: tool.rating,
        totalCalls: tool.total_calls,
        avgLatency: `${tool.avg_latency_ms}ms`,
      },
    })),
    query,
    totalMatches: tools.length,
  })
})

export default app
