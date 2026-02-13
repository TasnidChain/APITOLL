import { z } from 'zod'
import {
  PaidMCPServerConfig,
  ToolDefinition,
  PaidToolConfig,
  MCPToolResponse,
  SupportedChain,
} from './types'
import {
  buildPaymentRequirements,
  verifyPayment,
  createPaymentRequiredResponse,
  createPaymentReceipt,
} from './payment'

// Paid MCP Server

export class PaidMCPServer {
  private tools: Map<string, ToolDefinition & { handler: Function }> = new Map()
  private config: Required<PaidMCPServerConfig>

  constructor(config: PaidMCPServerConfig) {
    this.config = {
      walletAddress: config.walletAddress,
      defaultChain: config.defaultChain || 'base',
      facilitatorUrl: config.facilitatorUrl || 'https://x402.org/facilitator',
      discoveryUrl: config.discoveryUrl || '',
      sellerId: config.sellerId || '',
      onPayment: config.onPayment || (() => {}),
      onPaymentError: config.onPaymentError || (() => {}),
    }
  }

  // Tool Registration

  /**
   * Register a free tool (no payment required)
   */
  tool<T extends z.ZodType>(
    name: string,
    description: string,
    inputSchema: T,
    handler: (input: z.infer<T>) => Promise<string | object>
  ): this {
    this.tools.set(name, {
      name,
      description,
      inputSchema,
      handler,
    })
    return this
  }

  /**
   * Register a paid tool
   */
  paidTool<T extends z.ZodType>(
    name: string,
    description: string,
    inputSchema: T,
    payment: PaidToolConfig,
    handler: (input: z.infer<T>) => Promise<string | object>
  ): this {
    this.tools.set(name, {
      name,
      description,
      inputSchema,
      payment: {
        ...payment,
        chains: payment.chains || [this.config.defaultChain],
      },
      handler,
    })
    return this
  }

  // Tool Execution

  /**
   * Handle a tool call request
   */
  async handleToolCall(
    toolName: string,
    args: Record<string, unknown>,
    paymentHeader?: string
  ): Promise<MCPToolResponse> {
    const tool = this.tools.get(toolName)

    if (!tool) {
      return {
        content: [{ type: 'text', text: `Tool "${toolName}" not found` }],
        isError: true,
      }
    }

    // Validate input
    const parseResult = tool.inputSchema.safeParse(args)
    if (!parseResult.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Invalid input: ${parseResult.error.message}`,
          },
        ],
        isError: true,
      }
    }

    // Check if payment is required
    if (tool.payment) {
      const requirements = buildPaymentRequirements(
        toolName,
        tool.payment,
        this.config.walletAddress,
        tool.payment.chains as SupportedChain[]
      )

      // No payment header - return 402 equivalent
      if (!paymentHeader) {
        return createPaymentRequiredResponse(requirements)
      }

      // Verify payment
      const verification = await verifyPayment(
        paymentHeader,
        requirements,
        this.config.facilitatorUrl
      )

      if (!verification.valid) {
        this.config.onPaymentError(toolName, new Error(verification.error))
        return {
          content: [
            {
              type: 'text',
              text: `Payment failed: ${verification.error}`,
            },
          ],
          isError: true,
        }
      }

      // Payment successful - execute tool
      try {
        const result = await tool.handler(parseResult.data)

        this.config.onPayment(
          toolName,
          tool.payment.price,
          verification.txHash || ''
        )

        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
          _meta: {
            paymentReceipt: createPaymentReceipt(
              { ...verification, txHash: verification.txHash || '0x0' },
              tool.payment.price,
              tool.payment.chains?.[0] || this.config.defaultChain
            ),
          },
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        }
      }
    }

    // Free tool - just execute
    try {
      const result = await tool.handler(parseResult.data)
      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      }
    }
  }

  // Tool Listing (for MCP protocol)

  /**
   * Get all tool definitions for MCP tools/list
   */
  getToolDefinitions() {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: this.zodToJsonSchema(tool.inputSchema),
      // x402 extension
      ...(tool.payment && {
        'x-402': {
          price: tool.payment.price,
          currency: 'USDC',
          chains: tool.payment.chains || [this.config.defaultChain],
          payTo: this.config.walletAddress,
        },
      }),
    }))
  }

  /**
   * Get payment info for a tool
   */
  getToolPaymentInfo(toolName: string) {
    const tool = this.tools.get(toolName)
    if (!tool?.payment) return null

    return {
      price: tool.payment.price,
      currency: 'USDC',
      chains: tool.payment.chains || [this.config.defaultChain],
      payTo: this.config.walletAddress,
      requirements: buildPaymentRequirements(
        toolName,
        tool.payment,
        this.config.walletAddress,
        tool.payment.chains as SupportedChain[]
      ),
    }
  }

  // Discovery Registration

  /**
   * Register all paid tools with the Discovery API
   */
  async registerWithDiscovery(baseUrl: string): Promise<void> {
    if (!this.config.discoveryUrl || !this.config.sellerId) {
      console.warn('Discovery URL or Seller ID not configured')
      return
    }

    for (const [name, tool] of this.tools) {
      if (!tool.payment) continue

      try {
        const response = await fetch(`${this.config.discoveryUrl}/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Seller-ID': this.config.sellerId,
          },
          body: JSON.stringify({
            name: tool.name,
            description: tool.description,
            url: baseUrl,
            method: 'POST',
            path: `/mcp/tools/${name}`,
            price: String(tool.payment.price),
            wallet_address: this.config.walletAddress,
            chain: (tool.payment.chains || [this.config.defaultChain])[0],
            category: tool.payment.category || 'other',
            referral_code: this.config.sellerId,
          }),
        })

        if (!response.ok) {
          console.error(`Failed to register tool ${name}:`, await response.text())
        }
      } catch (error) {
        console.error(`Error registering tool ${name}:`, error)
      }
    }
  }

  // Helpers

  private zodToJsonSchema(schema: z.ZodType): object {
    // Basic zod to JSON schema conversion
    // In production, use zod-to-json-schema package
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape as Record<string, z.ZodType>
      const properties: Record<string, object> = {}
      const required: string[] = []

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = this.zodTypeToJsonSchema(value)
        if (!(value instanceof z.ZodOptional)) {
          required.push(key)
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      }
    }

    return { type: 'object', properties: {} }
  }

  private zodTypeToJsonSchema(type: z.ZodType): object {
    if (type instanceof z.ZodString) return { type: 'string' }
    if (type instanceof z.ZodNumber) return { type: 'number' }
    if (type instanceof z.ZodBoolean) return { type: 'boolean' }
    if (type instanceof z.ZodArray) {
      return { type: 'array', items: this.zodTypeToJsonSchema(type.element) }
    }
    if (type instanceof z.ZodOptional) {
      return this.zodTypeToJsonSchema(type.unwrap())
    }
    if (type instanceof z.ZodEnum) {
      return { type: 'string', enum: type.options }
    }
    return { type: 'string' }
  }
}

// Factory Function

export function createPaidMCPServer(config: PaidMCPServerConfig): PaidMCPServer {
  return new PaidMCPServer(config)
}
