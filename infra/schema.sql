-- AgentCommerce Schema v2.0
-- PostgreSQL 15+
-- Includes: billing, fees, disputes, deposits, premium marketplace

-- ═══════════════════════════════════════════════════
-- Organizations (multi-tenant) — with Stripe billing
-- ═══════════════════════════════════════════════════

CREATE TABLE organizations (
    id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name                    TEXT NOT NULL,
    billing_wallet          TEXT,
    plan                    TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    api_key                 TEXT UNIQUE NOT NULL DEFAULT 'org_' || encode(gen_random_bytes(32), 'hex'),
    -- Stripe billing
    stripe_customer_id      TEXT,
    stripe_subscription_id  TEXT,
    stripe_price_id         TEXT,
    billing_email           TEXT,
    billing_period_end      TIMESTAMPTZ,
    -- Usage tracking
    daily_call_count        INTEGER NOT NULL DEFAULT 0,
    daily_call_date         DATE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orgs_api_key ON organizations(api_key);
CREATE INDEX idx_orgs_stripe ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ═══════════════════════════════════════════════════
-- Agents (buyer-side wallets)
-- ═══════════════════════════════════════════════════

CREATE TABLE agents (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    wallet_address  TEXT NOT NULL,
    chain           TEXT NOT NULL CHECK (chain IN ('base', 'solana')),
    balance         NUMERIC(20, 6) NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'depleted')),
    policies_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agents_org ON agents(org_id);
CREATE INDEX idx_agents_wallet ON agents(wallet_address);

-- ═══════════════════════════════════════════════════
-- Sellers (API/tool providers)
-- ═══════════════════════════════════════════════════

CREATE TABLE sellers (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    org_id          TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    wallet_address  TEXT NOT NULL,
    api_key         TEXT UNIQUE DEFAULT 'sk_' || encode(gen_random_bytes(32), 'hex'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sellers_wallet ON sellers(wallet_address);

-- ═══════════════════════════════════════════════════
-- Endpoints (registered paid endpoints)
-- ═══════════════════════════════════════════════════

CREATE TABLE endpoints (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    seller_id       TEXT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    method          TEXT NOT NULL DEFAULT 'GET',
    path            TEXT NOT NULL,
    price           NUMERIC(20, 6) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'USDC',
    chains          TEXT[] NOT NULL DEFAULT ARRAY['base'],
    description     TEXT,
    category        TEXT,
    input_schema    JSONB,
    output_schema   JSONB,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    total_calls     BIGINT NOT NULL DEFAULT 0,
    total_revenue   NUMERIC(20, 6) NOT NULL DEFAULT 0,
    uptime_pct      NUMERIC(5, 2) DEFAULT 100.00,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_endpoints_seller ON endpoints(seller_id);
CREATE INDEX idx_endpoints_active ON endpoints(is_active) WHERE is_active = true;
CREATE INDEX idx_endpoints_category ON endpoints(category);

-- ═══════════════════════════════════════════════════
-- Transactions — with platform fee tracking
-- ═══════════════════════════════════════════════════

CREATE TABLE transactions (
    id              TEXT PRIMARY KEY,
    tx_hash         TEXT,
    agent_address   TEXT NOT NULL,
    agent_id        TEXT REFERENCES agents(id) ON DELETE SET NULL,
    seller_id       TEXT REFERENCES sellers(id) ON DELETE SET NULL,
    endpoint_id     TEXT REFERENCES endpoints(id) ON DELETE SET NULL,
    endpoint_path   TEXT NOT NULL,
    method          TEXT NOT NULL DEFAULT 'GET',
    amount          NUMERIC(20, 6) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'USDC',
    chain           TEXT NOT NULL CHECK (chain IN ('base', 'solana')),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'settled', 'failed', 'refunded')),
    response_status INTEGER,
    latency_ms      INTEGER,
    requested_at    TIMESTAMPTZ NOT NULL,
    settled_at      TIMESTAMPTZ,
    block_number    BIGINT,
    -- Platform fee tracking
    platform_fee    NUMERIC(20, 6),
    seller_amount   NUMERIC(20, 6),
    fee_bps         INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes for common queries
CREATE INDEX idx_txns_agent ON transactions(agent_address, requested_at DESC);
CREATE INDEX idx_txns_agent_id ON transactions(agent_id, requested_at DESC);
CREATE INDEX idx_txns_seller ON transactions(seller_id, requested_at DESC);
CREATE INDEX idx_txns_endpoint ON transactions(endpoint_id, requested_at DESC);
CREATE INDEX idx_txns_chain ON transactions(chain, requested_at DESC);
CREATE INDEX idx_txns_status ON transactions(status);
CREATE INDEX idx_txns_time ON transactions(requested_at DESC);
CREATE INDEX idx_txns_hash ON transactions(tx_hash) WHERE tx_hash IS NOT NULL;

-- ═══════════════════════════════════════════════════
-- Disputes & Refunds
-- ═══════════════════════════════════════════════════

CREATE TABLE disputes (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    transaction_id  TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    reason          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
    resolution      TEXT CHECK (resolution IN ('refunded', 'partial_refund', 'denied')),
    refund_amount   NUMERIC(20, 6),
    admin_notes     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_disputes_org ON disputes(org_id);
CREATE INDEX idx_disputes_transaction ON disputes(transaction_id);
CREATE INDEX idx_disputes_status ON disputes(status);

-- ═══════════════════════════════════════════════════
-- Platform Revenue Ledger
-- ═══════════════════════════════════════════════════

CREATE TABLE platform_revenue (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    transaction_id  TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    amount          NUMERIC(20, 6) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'USDC',
    chain           TEXT NOT NULL CHECK (chain IN ('base', 'solana')),
    fee_bps         INTEGER NOT NULL,
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_rev_time ON platform_revenue(collected_at DESC);

-- ═══════════════════════════════════════════════════
-- Fiat Deposits (Stripe → USDC on-ramp)
-- ═══════════════════════════════════════════════════

CREATE TABLE deposits (
    id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    org_id                  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id                TEXT REFERENCES agents(id) ON DELETE SET NULL,
    stripe_payment_intent_id TEXT NOT NULL,
    fiat_amount             NUMERIC(20, 2) NOT NULL,
    usdc_amount             NUMERIC(20, 6) NOT NULL,
    exchange_rate           NUMERIC(10, 6) NOT NULL DEFAULT 1.0,
    fee_amount              NUMERIC(20, 6) NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    wallet_address          TEXT NOT NULL,
    chain                   TEXT NOT NULL CHECK (chain IN ('base', 'solana')),
    tx_hash                 TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at            TIMESTAMPTZ
);

CREATE INDEX idx_deposits_org ON deposits(org_id);
CREATE INDEX idx_deposits_stripe_pi ON deposits(stripe_payment_intent_id);
CREATE INDEX idx_deposits_status ON deposits(status);

-- ═══════════════════════════════════════════════════
-- Policies (buyer-side rules)
-- ═══════════════════════════════════════════════════

CREATE TABLE policies (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        TEXT REFERENCES agents(id) ON DELETE CASCADE,
    policy_type     TEXT NOT NULL CHECK (policy_type IN ('budget', 'vendor_acl', 'rate_limit')),
    rules_json      JSONB NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_policies_org ON policies(org_id);
CREATE INDEX idx_policies_agent ON policies(agent_id);

-- ═══════════════════════════════════════════════════
-- Materialized views for analytics
-- ═══════════════════════════════════════════════════

CREATE MATERIALIZED VIEW mv_hourly_spend AS
SELECT
    date_trunc('hour', requested_at) AS hour,
    agent_id,
    seller_id,
    chain,
    COUNT(*) AS tx_count,
    SUM(amount) AS total_spend,
    SUM(platform_fee) AS total_platform_fees,
    AVG(amount) AS avg_spend,
    AVG(latency_ms) AS avg_latency
FROM transactions
WHERE status = 'settled'
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX idx_mv_hourly ON mv_hourly_spend(hour, agent_id, seller_id, chain);

CREATE MATERIALIZED VIEW mv_daily_spend AS
SELECT
    date_trunc('day', requested_at) AS day,
    agent_id,
    seller_id,
    chain,
    COUNT(*) AS tx_count,
    SUM(amount) AS total_spend,
    SUM(platform_fee) AS total_platform_fees,
    AVG(amount) AS avg_spend,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency
FROM transactions
WHERE status = 'settled'
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX idx_mv_daily ON mv_daily_spend(day, agent_id, seller_id, chain);

-- Platform revenue daily summary
CREATE MATERIALIZED VIEW mv_daily_revenue AS
SELECT
    date_trunc('day', collected_at) AS day,
    chain,
    COUNT(*) AS tx_count,
    SUM(amount) AS total_revenue,
    AVG(fee_bps) AS avg_fee_bps
FROM platform_revenue
GROUP BY 1, 2;

CREATE UNIQUE INDEX idx_mv_daily_rev ON mv_daily_revenue(day, chain);

-- ═══════════════════════════════════════════════════
-- Alerts configuration
-- ═══════════════════════════════════════════════════

CREATE TABLE alert_rules (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        TEXT REFERENCES agents(id) ON DELETE CASCADE,
    rule_type       TEXT NOT NULL CHECK (rule_type IN (
        'budget_threshold', 'budget_exceeded', 'low_balance',
        'high_failure_rate', 'anomalous_spend'
    )),
    threshold_json  JSONB NOT NULL,
    webhook_url     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_triggered  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- Updated_at trigger
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_agents_updated BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sellers_updated BEFORE UPDATE ON sellers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_endpoints_updated BEFORE UPDATE ON endpoints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_policies_updated BEFORE UPDATE ON policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
