import { sql } from './client'

// ═══════════════════════════════════════════════════
// Organizations
// ═══════════════════════════════════════════════════

export async function getOrganizationByApiKey(apiKey: string) {
  const [org] = await sql`
    SELECT * FROM organizations WHERE api_key = ${apiKey}
  `
  return org
}

export async function createOrganization(name: string, billingWallet?: string) {
  const [org] = await sql`
    INSERT INTO organizations (name, billing_wallet)
    VALUES (${name}, ${billingWallet ?? null})
    RETURNING *
  `
  return org
}

// ═══════════════════════════════════════════════════
// Agents
// ═══════════════════════════════════════════════════

export async function getAgentsByOrg(orgId: string) {
  return sql`
    SELECT * FROM agents
    WHERE org_id = ${orgId}
    ORDER BY created_at DESC
  `
}

export async function getAgentById(id: string) {
  const [agent] = await sql`SELECT * FROM agents WHERE id = ${id}`
  return agent
}

export async function createAgent(data: {
  orgId: string
  name: string
  walletAddress: string
  chain: 'base' | 'solana'
  policiesJson?: object
}) {
  const [agent] = await sql`
    INSERT INTO agents (org_id, name, wallet_address, chain, policies_json)
    VALUES (
      ${data.orgId},
      ${data.name},
      ${data.walletAddress},
      ${data.chain},
      ${JSON.stringify(data.policiesJson ?? [])}
    )
    RETURNING *
  `
  return agent
}

export async function updateAgentBalance(id: string, balance: number) {
  const [agent] = await sql`
    UPDATE agents SET balance = ${balance} WHERE id = ${id} RETURNING *
  `
  return agent
}

// ═══════════════════════════════════════════════════
// Sellers
// ═══════════════════════════════════════════════════

export async function getSellersByOrg(orgId: string) {
  return sql`
    SELECT * FROM sellers
    WHERE org_id = ${orgId}
    ORDER BY created_at DESC
  `
}

export async function getSellerByApiKey(apiKey: string) {
  const [seller] = await sql`
    SELECT * FROM sellers WHERE api_key = ${apiKey}
  `
  return seller
}

export async function createSeller(data: {
  orgId?: string
  name: string
  walletAddress: string
}) {
  const [seller] = await sql`
    INSERT INTO sellers (org_id, name, wallet_address)
    VALUES (${data.orgId ?? null}, ${data.name}, ${data.walletAddress})
    RETURNING *
  `
  return seller
}

// ═══════════════════════════════════════════════════
// Endpoints
// ═══════════════════════════════════════════════════

export async function getEndpointsBySeller(sellerId: string) {
  return sql`
    SELECT * FROM endpoints
    WHERE seller_id = ${sellerId}
    ORDER BY created_at DESC
  `
}

export async function upsertEndpoint(data: {
  sellerId: string
  method: string
  path: string
  price: number
  chains: string[]
  description?: string
}) {
  const [endpoint] = await sql`
    INSERT INTO endpoints (seller_id, method, path, price, chains, description)
    VALUES (
      ${data.sellerId},
      ${data.method},
      ${data.path},
      ${data.price},
      ${data.chains},
      ${data.description ?? null}
    )
    ON CONFLICT (seller_id, method, path)
    DO UPDATE SET
      price = EXCLUDED.price,
      chains = EXCLUDED.chains,
      description = EXCLUDED.description,
      updated_at = now()
    RETURNING *
  `
  return endpoint
}

// ═══════════════════════════════════════════════════
// Transactions
// ═══════════════════════════════════════════════════

export async function createTransaction(data: {
  id: string
  txHash?: string
  agentAddress: string
  agentId?: string
  sellerId?: string
  endpointId?: string
  endpointPath: string
  method: string
  amount: number
  chain: 'base' | 'solana'
  status: 'pending' | 'settled' | 'failed' | 'refunded'
  responseStatus?: number
  latencyMs?: number
  requestedAt: Date
  settledAt?: Date
  blockNumber?: number
}) {
  const [tx] = await sql`
    INSERT INTO transactions (
      id, tx_hash, agent_address, agent_id, seller_id, endpoint_id,
      endpoint_path, method, amount, chain, status, response_status,
      latency_ms, requested_at, settled_at, block_number
    )
    VALUES (
      ${data.id},
      ${data.txHash ?? null},
      ${data.agentAddress},
      ${data.agentId ?? null},
      ${data.sellerId ?? null},
      ${data.endpointId ?? null},
      ${data.endpointPath},
      ${data.method},
      ${data.amount},
      ${data.chain},
      ${data.status},
      ${data.responseStatus ?? null},
      ${data.latencyMs ?? null},
      ${data.requestedAt},
      ${data.settledAt ?? null},
      ${data.blockNumber ?? null}
    )
    RETURNING *
  `
  return tx
}

export async function updateTransactionStatus(
  id: string,
  status: 'settled' | 'failed' | 'refunded',
  txHash?: string,
  settledAt?: Date
) {
  const [tx] = await sql`
    UPDATE transactions
    SET status = ${status},
        tx_hash = COALESCE(${txHash ?? null}, tx_hash),
        settled_at = COALESCE(${settledAt ?? null}, settled_at)
    WHERE id = ${id}
    RETURNING *
  `
  return tx
}

export async function getTransactionsByOrg(
  orgId: string,
  options: {
    limit?: number
    offset?: number
    status?: string
    chain?: string
    agentId?: string
  } = {}
) {
  const { limit = 100, offset = 0, status, chain, agentId } = options

  return sql`
    SELECT t.*, a.name as agent_name, s.name as seller_name
    FROM transactions t
    LEFT JOIN agents a ON t.agent_id = a.id
    LEFT JOIN sellers s ON t.seller_id = s.id
    WHERE (a.org_id = ${orgId} OR s.org_id = ${orgId})
      ${status ? sql`AND t.status = ${status}` : sql``}
      ${chain ? sql`AND t.chain = ${chain}` : sql``}
      ${agentId ? sql`AND t.agent_id = ${agentId}` : sql``}
    ORDER BY t.requested_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `
}

// ═══════════════════════════════════════════════════
// Analytics
// ═══════════════════════════════════════════════════

export async function getOverviewStats(orgId: string) {
  const [stats] = await sql`
    SELECT
      COUNT(*) as total_transactions,
      COALESCE(SUM(CASE WHEN status = 'settled' THEN amount ELSE 0 END), 0) as total_spend,
      COALESCE(SUM(CASE WHEN status = 'settled' AND requested_at >= CURRENT_DATE THEN amount ELSE 0 END), 0) as today_spend,
      COALESCE(AVG(CASE WHEN status = 'settled' THEN latency_ms END), 0) as avg_latency,
      COALESCE(
        COUNT(CASE WHEN status = 'settled' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100,
        0
      ) as success_rate
    FROM transactions t
    LEFT JOIN agents a ON t.agent_id = a.id
    LEFT JOIN sellers s ON t.seller_id = s.id
    WHERE a.org_id = ${orgId} OR s.org_id = ${orgId}
  `

  const [agentCounts] = await sql`
    SELECT
      COUNT(*) as total_agents,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_agents
    FROM agents
    WHERE org_id = ${orgId}
  `

  return {
    totalTransactions: Number(stats.total_transactions),
    totalSpend: Number(stats.total_spend),
    todaySpend: Number(stats.today_spend),
    avgLatency: Math.round(Number(stats.avg_latency)),
    successRate: Number(stats.success_rate),
    totalAgents: Number(agentCounts.total_agents),
    activeAgents: Number(agentCounts.active_agents),
  }
}

export async function getDailyStats(orgId: string, days: number = 30) {
  return sql`
    SELECT
      DATE(requested_at) as date,
      COUNT(*) as transactions,
      COALESCE(SUM(CASE WHEN status = 'settled' THEN amount ELSE 0 END), 0) as spend
    FROM transactions t
    LEFT JOIN agents a ON t.agent_id = a.id
    LEFT JOIN sellers s ON t.seller_id = s.id
    WHERE (a.org_id = ${orgId} OR s.org_id = ${orgId})
      AND requested_at >= CURRENT_DATE - ${days}::interval
    GROUP BY DATE(requested_at)
    ORDER BY date
  `
}
