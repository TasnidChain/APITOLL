/**
 * Example: Paid MCP Server
 *
 * A weather tools MCP server that charges for premium features.
 *
 * Free tools:
 *   - get_weather_simple: Basic weather for any city
 *
 * Paid tools:
 *   - get_weather_detailed: Full forecast with hourly data ($0.005/call)
 *   - get_weather_historical: Historical weather data ($0.01/call)
 *   - get_weather_alerts: Severe weather alerts ($0.002/call)
 */

import { z } from 'zod'
import { createPaidMCPServer, toExpressRouter, runStdio } from '@apitoll/mcp-server'

// Create the MCP Server

const server = createPaidMCPServer({
  walletAddress: '0xYourWalletAddress', // Your USDC wallet
  defaultChain: 'base',
  onPayment: (tool, amount, txHash) => {
    console.log(`💰 Received $${amount} for ${tool} (tx: ${txHash})`)
  },
  onPaymentError: (tool, error) => {
    console.error(`❌ Payment failed for ${tool}:`, error.message)
  },
})

// Free Tool: Simple Weather

server.tool(
  'get_weather_simple',
  'Get basic current weather for a city (free)',
  z.object({
    city: z.string().describe('City name'),
  }),
  async ({ city }) => {
    // In production, call a real weather API
    return {
      city,
      temperature: Math.round(Math.random() * 30 + 5),
      condition: ['sunny', 'cloudy', 'rainy', 'snowy'][Math.floor(Math.random() * 4)],
      humidity: Math.round(Math.random() * 60 + 30),
    }
  }
)

// Paid Tool: Detailed Forecast

server.paidTool(
  'get_weather_detailed',
  'Get detailed weather forecast with hourly predictions',
  z.object({
    city: z.string().describe('City name'),
    days: z.number().min(1).max(14).optional().describe('Number of days (1-14)'),
  }),
  {
    price: 0.005, // $0.005 per call
    chains: ['base', 'solana'],
    category: 'data',
    tags: ['weather', 'forecast', 'api'],
  },
  async ({ city, days = 7 }) => {
    // Generate mock detailed forecast
    const hourly = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      temp: Math.round(Math.random() * 15 + 10),
      precipitation: Math.round(Math.random() * 100),
      windSpeed: Math.round(Math.random() * 30),
    }))

    const daily = Array.from({ length: days }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() + i)
      return {
        date: date.toISOString().split('T')[0],
        high: Math.round(Math.random() * 15 + 15),
        low: Math.round(Math.random() * 10 + 5),
        condition: ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)],
        precipitation: Math.round(Math.random() * 100),
      }
    })

    return {
      city,
      timezone: 'UTC',
      hourly,
      daily,
      generatedAt: new Date().toISOString(),
    }
  }
)

// Paid Tool: Historical Data

server.paidTool(
  'get_weather_historical',
  'Get historical weather data for a specific date range',
  z.object({
    city: z.string().describe('City name'),
    startDate: z.string().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().describe('End date (YYYY-MM-DD)'),
  }),
  {
    price: 0.01, // $0.01 per call
    chains: ['base'],
    category: 'data',
    tags: ['weather', 'historical', 'analytics'],
  },
  async ({ city, startDate, endDate }) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    const historical = Array.from({ length: Math.min(days, 365) }, (_, i) => {
      const date = new Date(start)
      date.setDate(date.getDate() + i)
      return {
        date: date.toISOString().split('T')[0],
        avgTemp: Math.round(Math.random() * 20 + 5),
        maxTemp: Math.round(Math.random() * 15 + 15),
        minTemp: Math.round(Math.random() * 10),
        precipitation: Math.round(Math.random() * 50),
        humidity: Math.round(Math.random() * 40 + 40),
      }
    })

    return {
      city,
      startDate,
      endDate,
      dataPoints: historical.length,
      data: historical,
    }
  }
)

// Paid Tool: Weather Alerts

server.paidTool(
  'get_weather_alerts',
  'Get active severe weather alerts for a location',
  z.object({
    city: z.string().describe('City name'),
    radius: z.number().optional().describe('Radius in km (default 50)'),
  }),
  {
    price: 0.002, // $0.002 per call
    chains: ['base', 'solana'],
    category: 'data',
    tags: ['weather', 'alerts', 'safety'],
  },
  async ({ city, radius = 50 }) => {
    // Mock alerts
    const alertTypes = ['Thunderstorm Warning', 'Heat Advisory', 'Flood Watch', 'Wind Advisory']
    const hasAlerts = Math.random() > 0.7

    return {
      city,
      radius,
      alerts: hasAlerts
        ? [
            {
              type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
              severity: ['minor', 'moderate', 'severe'][Math.floor(Math.random() * 3)],
              headline: 'Weather alert in your area',
              description: 'Please take appropriate precautions.',
              expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
          ]
        : [],
      checkedAt: new Date().toISOString(),
    }
  }
)

// Run the Server

const mode = process.argv[2] || 'http'

if (mode === 'stdio') {
  // Run as stdio for Claude Desktop
  runStdio(server)
} else {
  // Run as HTTP server
  const express = require('express')
  const app = express()

  app.use(express.json())
  app.use('/mcp', toExpressRouter(server))

  // Health check
  app.get('/health', (_req: import('express').Request, res: import('express').Response) => {
    res.json({ status: 'ok', tools: server.getToolDefinitions().length })
  })

  const port = process.env.PORT || 3004
  app.listen(port, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   Paid MCP Server (Weather Tools)                 ║
║                                                   ║
║   Port: ${port}                                    ║
║   Endpoints:                                      ║
║     GET  /mcp/tools         - List tools          ║
║     POST /mcp/tools/:name   - Call tool           ║
║     POST /mcp/rpc           - JSON-RPC            ║
║                                                   ║
║   Tools:                                          ║
║     get_weather_simple      - FREE                ║
║     get_weather_detailed    - $0.005/call         ║
║     get_weather_historical  - $0.01/call          ║
║     get_weather_alerts      - $0.002/call         ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
`)
  })
}
