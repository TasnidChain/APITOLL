-- Discovery API Schema
-- Extends the main agentcommerce schema with tool registry tables

-- ═══════════════════════════════════════════════════
-- Tools (registered paid APIs/endpoints)
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tools (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    seller_id       TEXT REFERENCES sellers(id) ON DELETE CASCADE,

    -- Basic info
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    description     TEXT NOT NULL,

    -- Endpoint details
    base_url        TEXT NOT NULL,
    method          TEXT NOT NULL DEFAULT 'GET',
    path            TEXT NOT NULL,

    -- Pricing
    price           NUMERIC(20, 6) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'USDC',
    chains          TEXT[] NOT NULL DEFAULT ARRAY['base'],

    -- Categorization
    category        TEXT NOT NULL,
    tags            TEXT[] NOT NULL DEFAULT '{}',

    -- Schema (OpenAPI/JSON Schema compatible)
    input_schema    JSONB,          -- Parameters the tool accepts
    output_schema   JSONB,          -- What the tool returns

    -- MCP compatibility
    mcp_tool_spec   JSONB,          -- Full MCP tool specification

    -- Stats
    total_calls     BIGINT NOT NULL DEFAULT 0,
    avg_latency_ms  INTEGER DEFAULT 0,
    uptime_pct      NUMERIC(5, 2) DEFAULT 100.00,
    rating          NUMERIC(3, 2) DEFAULT 0,
    rating_count    INTEGER DEFAULT 0,

    -- Status
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_verified     BOOLEAN NOT NULL DEFAULT false,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for search
CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category);
CREATE INDEX IF NOT EXISTS idx_tools_tags ON tools USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_tools_active ON tools(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tools_search ON tools USING GIN(
    to_tsvector('english', name || ' ' || description || ' ' || category)
);
CREATE INDEX IF NOT EXISTS idx_tools_price ON tools(price);
CREATE INDEX IF NOT EXISTS idx_tools_rating ON tools(rating DESC);

-- ═══════════════════════════════════════════════════
-- Categories (predefined tool categories)
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS categories (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    icon            TEXT,
    tool_count      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default categories
INSERT INTO categories (id, name, description, icon) VALUES
    ('data', 'Data & APIs', 'Weather, prices, news, and other data feeds', 'database'),
    ('ai', 'AI & ML', 'Language models, image generation, embeddings', 'brain'),
    ('search', 'Search & Discovery', 'Web search, knowledge bases, semantic search', 'search'),
    ('compute', 'Compute & Processing', 'Code execution, file conversion, data processing', 'cpu'),
    ('communication', 'Communication', 'Email, SMS, notifications, messaging', 'message-circle'),
    ('finance', 'Finance & Payments', 'Prices, transactions, DeFi protocols', 'dollar-sign'),
    ('storage', 'Storage & Files', 'File storage, IPFS, databases', 'hard-drive'),
    ('identity', 'Identity & Auth', 'KYC, verification, credentials', 'shield'),
    ('social', 'Social & Web3', 'Social graphs, NFTs, on-chain data', 'users'),
    ('other', 'Other', 'Miscellaneous tools', 'box')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════
-- Tool Reviews
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tool_reviews (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tool_id         TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    agent_id        TEXT REFERENCES agents(id) ON DELETE SET NULL,
    rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_tool ON tool_reviews(tool_id);

-- Trigger to update tool rating on review
CREATE OR REPLACE FUNCTION update_tool_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tools SET
        rating = (SELECT AVG(rating) FROM tool_reviews WHERE tool_id = NEW.tool_id),
        rating_count = (SELECT COUNT(*) FROM tool_reviews WHERE tool_id = NEW.tool_id)
    WHERE id = NEW.tool_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_tool_rating ON tool_reviews;
CREATE TRIGGER trg_update_tool_rating
    AFTER INSERT OR UPDATE ON tool_reviews
    FOR EACH ROW EXECUTE FUNCTION update_tool_rating();

-- ═══════════════════════════════════════════════════
-- Agent Favorites (bookmarked tools)
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agent_favorites (
    agent_id        TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    tool_id         TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (agent_id, tool_id)
);
