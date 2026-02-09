import { Id } from '../../../../convex/_generated/dataModel'

// ═══════════════════════════════════════════════════
// Dashboard Types — derived from Convex schema
// ═══════════════════════════════════════════════════

// ─── Webhook Types ──────────────────────────────────

export interface Webhook {
  _id: Id<'webhooks'>
  _creationTime: number
  orgId: Id<'organizations'>
  sellerId?: Id<'sellers'>
  url: string
  secret?: string
  events: string[]
  isActive: boolean
  failureCount: number
  lastTriggeredAt?: number
  lastFailureAt?: number
  createdAt: number
  // UI-derived fields
  status?: 'active' | 'failing' | 'disabled'
  signingSecret?: string
  lastDeliveryAt?: number
}

export interface WebhookDelivery {
  _id: Id<'webhookDeliveries'>
  _creationTime: number
  webhookId: Id<'webhooks'>
  event: string
  payload: string
  status: 'pending' | 'delivered' | 'failed'
  httpStatus?: number
  attempts: number
  lastAttemptAt: number
  responseBody?: string
  // UI-derived fields
  statusCode?: number
  duration?: number
}

export interface WebhookStats {
  total: number
  active: number
  failing: number
}

// ─── Policy Types ───────────────────────────────────

export interface BudgetRules {
  dailyLimit?: number
  perTransactionLimit?: number
  monthlyLimit?: number
}

export interface VendorAclRules {
  allowedVendors?: string[]
  blockedVendors?: string[]
}

export interface RateLimitRules {
  maxRequestsPerMinute?: number
  maxRequestsPerHour?: number
}

export type PolicyType = 'budget' | 'vendor_acl' | 'rate_limit'

export interface Policy {
  _id: Id<'policies'>
  _creationTime: number
  orgId: Id<'organizations'>
  agentId?: Id<'agents'>
  policyType: PolicyType
  rulesJson: BudgetRules | VendorAclRules | RateLimitRules
  isActive: boolean
}

// ─── Alert Rule Types ───────────────────────────────

export type AlertRuleType =
  | 'budget_threshold'
  | 'budget_exceeded'
  | 'low_balance'
  | 'high_failure_rate'
  | 'anomalous_spend'

export interface AlertThreshold {
  percentage?: number
  amount?: number
  rate?: number
  windowMinutes?: number
}

export interface AlertRule {
  _id: Id<'alertRules'>
  _creationTime: number
  orgId: Id<'organizations'>
  agentId?: Id<'agents'>
  ruleType: AlertRuleType
  thresholdJson: AlertThreshold
  webhookUrl?: string
  isActive: boolean
  lastTriggered?: number
}

// ─── Organization Types ─────────────────────────────

export type PlanTier = 'free' | 'pro' | 'enterprise'

export interface Organization {
  _id: Id<'organizations'>
  _creationTime: number
  name: string
  billingWallet?: string
  plan: PlanTier
  apiKey: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripePriceId?: string
  billingEmail?: string
  billingPeriodEnd?: number
  dailyCallCount?: number
  dailyCallDate?: string
  createdAt?: number
}

// ─── Agent Types ────────────────────────────────────

export type AgentStatus = 'active' | 'paused' | 'depleted'

export interface Agent {
  _id: Id<'agents'>
  _creationTime: number
  orgId: Id<'organizations'>
  name: string
  walletAddress: string
  chain: 'base' | 'solana'
  balance: number
  status: AgentStatus
  policiesJson: PolicyConfig[]
}

export interface PolicyConfig {
  type: 'budget' | 'vendor_acl' | 'rate_limit'
  budget?: BudgetRules
  vendorAcl?: VendorAclRules
  rateLimit?: RateLimitRules
}

// ─── Transaction Types ──────────────────────────────

export type TransactionStatus = 'pending' | 'settled' | 'failed' | 'refunded'

export interface Transaction {
  _id: Id<'transactions'>
  _creationTime: number
  txHash?: string
  agentAddress: string
  agentId?: Id<'agents'>
  sellerId?: Id<'sellers'>
  endpointId?: Id<'endpoints'>
  endpointPath: string
  method: string
  amount: number
  currency: string
  chain: 'base' | 'solana'
  status: TransactionStatus
  responseStatus?: number
  latencyMs?: number
  requestedAt: number
  settledAt?: number
  blockNumber?: number
  platformFee?: number
  sellerAmount?: number
  feeBps?: number
}

// ─── Tool Types ─────────────────────────────────────

export type ListingTier = 'free' | 'featured' | 'verified' | 'premium'

export interface Tool {
  _id: Id<'tools'>
  _creationTime: number
  sellerId?: Id<'sellers'>
  name: string
  slug: string
  description: string
  baseUrl: string
  method: string
  path: string
  price: number
  currency: string
  chains: string[]
  category: string
  tags: string[]
  totalCalls: number
  avgLatencyMs: number
  rating: number
  ratingCount: number
  isActive: boolean
  isVerified: boolean
  isFeatured?: boolean
  featuredUntil?: number
  listingTier?: ListingTier
  boostScore?: number
}

// ─── Dispute Types ──────────────────────────────────

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected'
export type DisputeResolution = 'refunded' | 'partial_refund' | 'denied'

export interface Dispute {
  _id: Id<'disputes'>
  _creationTime: number
  transactionId: Id<'transactions'>
  orgId: Id<'organizations'>
  reason: string
  status: DisputeStatus
  resolution?: DisputeResolution
  refundAmount?: number
  adminNotes?: string
  createdAt: number
  resolvedAt?: number
}
