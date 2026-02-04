import { PaidMCPServer } from './server'

// ═══════════════════════════════════════════════════
// Express Adapter
// ═══════════════════════════════════════════════════

/**
 * Create an Express router for the MCP server
 * Handles both JSON-RPC and REST-style requests
 */
export function toExpressRouter(server: PaidMCPServer) {
  // Return a middleware function that handles MCP requests
  return async (req: any, res: any, next: any) => {
    const path = req.path

    // Handle tools/list
    if (path === '/tools' && req.method === 'GET') {
      return res.json({ tools: server.getToolDefinitions() })
    }

    // Handle tool call (REST style)
    if (path.startsWith('/tools/') && req.method === 'POST') {
      const toolName = path.replace('/tools/', '')
      const paymentHeader = req.headers['x-payment']

      const result = await server.handleToolCall(
        toolName,
        req.body || {},
        paymentHeader
      )

      // Check if payment is required
      if (result._meta?.paymentRequired) {
        res.setHeader(
          'X-Payment-Required',
          JSON.stringify(result._meta.paymentRequired)
        )
        return res.status(402).json(result)
      }

      return res.json(result)
    }

    // Handle JSON-RPC style
    if (path === '/rpc' && req.method === 'POST') {
      const { method, params } = req.body

      if (method === 'tools/list') {
        return res.json({
          jsonrpc: '2.0',
          result: { tools: server.getToolDefinitions() },
        })
      }

      if (method === 'tools/call') {
        const paymentHeader = req.headers['x-payment']
        const result = await server.handleToolCall(
          params.name,
          params.arguments || {},
          paymentHeader
        )

        if (result._meta?.paymentRequired) {
          res.setHeader(
            'X-Payment-Required',
            JSON.stringify(result._meta.paymentRequired)
          )
          return res.status(402).json({
            jsonrpc: '2.0',
            error: {
              code: 402,
              message: 'Payment required',
              data: result._meta.paymentRequired,
            },
          })
        }

        return res.json({
          jsonrpc: '2.0',
          result,
        })
      }
    }

    // Handle tool payment info
    if (path.startsWith('/tools/') && path.endsWith('/payment') && req.method === 'GET') {
      const toolName = path.replace('/tools/', '').replace('/payment', '')
      const paymentInfo = server.getToolPaymentInfo(toolName)

      if (!paymentInfo) {
        return res.status(404).json({ error: 'Tool not found or is free' })
      }

      return res.json(paymentInfo)
    }

    next()
  }
}

// ═══════════════════════════════════════════════════
// Hono Adapter
// ═══════════════════════════════════════════════════

/**
 * Create Hono routes for the MCP server
 */
export function toHonoApp(server: PaidMCPServer) {
  // Return an object with route handlers
  return {
    // GET /tools - List all tools
    listTools: () => {
      return { tools: server.getToolDefinitions() }
    },

    // POST /tools/:name - Call a tool
    callTool: async (
      toolName: string,
      args: Record<string, unknown>,
      paymentHeader?: string
    ) => {
      return server.handleToolCall(toolName, args, paymentHeader)
    },

    // GET /tools/:name/payment - Get payment info
    getPaymentInfo: (toolName: string) => {
      return server.getToolPaymentInfo(toolName)
    },

    // POST /rpc - JSON-RPC endpoint
    handleRpc: async (
      method: string,
      params: any,
      paymentHeader?: string
    ) => {
      if (method === 'tools/list') {
        return { tools: server.getToolDefinitions() }
      }

      if (method === 'tools/call') {
        return server.handleToolCall(
          params.name,
          params.arguments || {},
          paymentHeader
        )
      }

      throw new Error(`Unknown method: ${method}`)
    },
  }
}

// ═══════════════════════════════════════════════════
// Stdio Adapter (for Claude Desktop)
// ═══════════════════════════════════════════════════

/**
 * Run the MCP server over stdio (for Claude Desktop integration)
 */
export function runStdio(server: PaidMCPServer) {
  const readline = require('readline')

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  })

  rl.on('line', async (line: string) => {
    try {
      const request = JSON.parse(line)
      const { id, method, params } = request

      let result: any

      if (method === 'initialize') {
        result = {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'agentcommerce-mcp', version: '0.1.0' },
        }
      } else if (method === 'tools/list') {
        result = { tools: server.getToolDefinitions() }
      } else if (method === 'tools/call') {
        // For stdio, payment header comes in params._payment
        const paymentHeader = params._payment
        delete params._payment
        result = await server.handleToolCall(
          params.name,
          params.arguments || {},
          paymentHeader
        )
      } else {
        result = { error: `Unknown method: ${method}` }
      }

      const response = JSON.stringify({ jsonrpc: '2.0', id, result })
      process.stdout.write(response + '\n')
    } catch (error) {
      const errorResponse = JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: error instanceof Error ? error.message : 'Parse error',
        },
      })
      process.stdout.write(errorResponse + '\n')
    }
  })

  // Log to stderr so it doesn't interfere with stdio protocol
  console.error('MCP server running on stdio')
}
