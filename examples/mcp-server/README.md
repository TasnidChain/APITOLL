# Paid MCP Server Example

This example shows how to create an MCP server with paid tools using Apitoll.

## Tools

| Tool | Price | Description |
|------|-------|-------------|
| `get_weather_simple` | FREE | Basic current weather |
| `get_weather_detailed` | $0.005 | Detailed forecast with hourly data |
| `get_weather_historical` | $0.01 | Historical weather data |
| `get_weather_alerts` | $0.002 | Severe weather alerts |

## Running

### As HTTP Server

```bash
npx ts-node server.ts
```

Then call tools:

```bash
# Free tool
curl -X POST http://localhost:3004/mcp/tools/get_weather_simple \
  -H "Content-Type: application/json" \
  -d '{"city": "New York"}'

# Paid tool (without payment - returns 402)
curl -X POST http://localhost:3004/mcp/tools/get_weather_detailed \
  -H "Content-Type: application/json" \
  -d '{"city": "New York", "days": 5}'

# Paid tool (with payment header)
curl -X POST http://localhost:3004/mcp/tools/get_weather_detailed \
  -H "Content-Type: application/json" \
  -H "X-Payment: <base64-encoded-payment>" \
  -d '{"city": "New York", "days": 5}'
```

### As Stdio (for Claude Desktop)

```bash
npx ts-node server.ts stdio
```

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "weather": {
      "command": "npx",
      "args": ["ts-node", "/path/to/server.ts", "stdio"]
    }
  }
}
```

## Payment Flow

1. Agent calls a paid tool without payment
2. Server returns 402 with `X-Payment-Required` header
3. Agent's wallet creates a payment signature
4. Agent retries with `X-Payment` header
5. Server verifies payment via facilitator
6. Tool executes and returns result

## Integration with Agent Wallet

```typescript
import { createAgentWallet } from '@agentcommerce/buyer-sdk'

const agent = createAgentWallet({
  name: 'WeatherBot',
  chain: 'base',
  policies: [{ type: 'budget', dailyCap: 10 }],
  signer: mySignerFunction,
})

// Auto-handles payment
const forecast = await agent.fetch('http://localhost:3004/mcp/tools/get_weather_detailed', {
  method: 'POST',
  body: JSON.stringify({ city: 'New York', days: 7 }),
})
```
