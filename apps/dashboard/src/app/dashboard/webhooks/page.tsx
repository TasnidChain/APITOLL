'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import { useOrgId } from '@/lib/hooks'
import { PageLoading } from '@/components/loading'
import { cn } from '@/lib/utils'
import type { Webhook as WebhookType, WebhookDelivery } from '@/lib/types'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import {
  Webhook,
  Plus,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  RotateCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  FileCode2,
  X,
  Zap,
  Activity,
  Clock,
} from 'lucide-react'

const AVAILABLE_EVENTS = [
  'payment.received',
  'payment.failed',
  'payment.refunded',
  'dispute.created',
  'dispute.resolved',
  'agent.registered',
  'seller.registered',
  'budget.exceeded',
  'balance.low',
] as const

type WebhookEvent = (typeof AVAILABLE_EVENTS)[number]

const EVENT_CATEGORIES: Record<string, WebhookEvent[]> = {
  Payments: ['payment.received', 'payment.failed', 'payment.refunded'],
  Disputes: ['dispute.created', 'dispute.resolved'],
  Agents: ['agent.registered', 'seller.registered'],
  Budgets: ['budget.exceeded', 'balance.low'],
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full',
        status === 'active' && 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]',
        status === 'failing' && 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]',
        status === 'disabled' && 'bg-zinc-400 dark:bg-zinc-600'
      )}
    />
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  accent?: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div
          className={cn(
            'h-9 w-9 rounded-lg flex items-center justify-center',
            accent || 'bg-muted'
          )}
        >
          <Icon className="h-4.5 w-4.5 text-foreground/70" />
        </div>
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function CreateWebhookModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (url: string, events: string[]) => Promise<{ signingSecret?: string } | undefined>
}) {
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())
  const [isCreating, setIsCreating] = useState(false)
  const [signingSecret, setSigningSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [secretCopied, setSecretCopied] = useState(false)

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev)
      if (next.has(event)) {
        next.delete(event)
      } else {
        next.add(event)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedEvents.size === AVAILABLE_EVENTS.length) {
      setSelectedEvents(new Set())
    } else {
      setSelectedEvents(new Set(AVAILABLE_EVENTS))
    }
  }

  const handleCreate = async () => {
    if (!url.trim()) {
      setError('Webhook URL is required')
      return
    }

    try {
      new URL(url)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    if (selectedEvents.size === 0) {
      setError('Select at least one event')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const result = await onCreate(url.trim(), Array.from(selectedEvents))
      if (result?.signingSecret) {
        setSigningSecret(result.signingSecret)
      } else {
        onClose()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook')
    } finally {
      setIsCreating(false)
    }
  }

  const copySecret = () => {
    if (signingSecret) {
      navigator.clipboard.writeText(signingSecret)
      setSecretCopied(true)
      setTimeout(() => setSecretCopied(false), 2000)
    }
  }

  if (signingSecret) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Webhook Created</h2>
              <p className="text-sm text-muted-foreground">Save your signing secret now</p>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                This is the only time this signing secret will be shown. Copy it now and store
                it securely. You will not be able to view it again.
              </p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 mb-6">
            <label className="text-xs text-muted-foreground mb-1.5 block">Signing Secret</label>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono flex-1 break-all">{signingSecret}</code>
              <button
                onClick={copySecret}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  secretCopied
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {secretCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Webhook className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Create Webhook</h2>
              <p className="text-sm text-muted-foreground">Receive real-time event notifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Endpoint URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setError(null)
              }}
              placeholder="https://api.example.com/webhooks"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium">Events to subscribe</label>
              <button
                onClick={toggleAll}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {selectedEvents.size === AVAILABLE_EVENTS.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div className="space-y-4">
              {Object.entries(EVENT_CATEGORIES).map(([category, events]) => (
                <div key={category}>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    {category}
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {events.map((event) => (
                      <label
                        key={event}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors border',
                          selectedEvents.has(event)
                            ? 'bg-primary/5 border-primary/20'
                            : 'bg-muted/30 border-transparent hover:bg-muted/50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEvents.has(event)}
                          onChange={() => toggleEvent(event)}
                          className="rounded border-border text-primary focus:ring-primary/50 h-4 w-4"
                        />
                        <code className="text-xs font-mono">{event}</code>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <XCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Create Webhook'}
          </button>
        </div>
      </div>
    </div>
  )
}

function WebhookCard({
  webhook,
  onUpdate,
  onRemove,
  onRotateSecret,
  onTestPing,
  deliveries,
}: {
  webhook: WebhookType
  onUpdate: (id: Id<'webhooks'>, data: { status?: string }) => Promise<void>
  onRemove: (id: Id<'webhooks'>) => Promise<void>
  onRotateSecret: (id: Id<'webhooks'>) => Promise<{ signingSecret?: string } | void>
  onTestPing: (id: Id<'webhooks'>) => Promise<void>
  deliveries: WebhookDelivery[] | undefined
}) {
  const [expanded, setExpanded] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPinging, setIsPinging] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const status = webhook.status || 'active'
  const events: string[] = webhook.events || []

  const handleToggle = async () => {
    setIsToggling(true)
    try {
      await onUpdate(webhook._id, {
        status: status === 'active' ? 'disabled' : 'active',
      })
    } finally {
      setIsToggling(false)
    }
  }

  const handleTestPing = async () => {
    setIsPinging(true)
    try {
      await onTestPing(webhook._id)
    } finally {
      setIsPinging(false)
    }
  }

  const handleRotateSecret = async () => {
    setIsRotating(true)
    try {
      const result = await onRotateSecret(webhook._id)
      if (result?.signingSecret) {
        setNewSecret(result.signingSecret)
      }
    } finally {
      setIsRotating(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setIsDeleting(true)
    try {
      await onRemove(webhook._id)
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden transition-shadow hover:shadow-sm">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="text-muted-foreground shrink-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <StatusDot status={status} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate font-mono">{webhook.url}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {events.length} event{events.length !== 1 ? 's' : ''} subscribed
            {webhook.lastDeliveryAt && (
              <span> &middot; Last delivery {formatDate(webhook.lastDeliveryAt)}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleToggle}
            disabled={isToggling}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              status === 'active'
                ? 'text-emerald-600 hover:bg-emerald-500/10'
                : 'text-muted-foreground hover:bg-muted'
            )}
            title={status === 'active' ? 'Disable' : 'Enable'}
          >
            {status === 'active' ? (
              <ToggleRight className="h-5 w-5" />
            ) : (
              <ToggleLeft className="h-5 w-5" />
            )}
          </button>

          <button
            onClick={handleTestPing}
            disabled={isPinging || status === 'disabled'}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
            title="Send test ping"
          >
            <Send className={cn('h-4 w-4', isPinging && 'animate-pulse')} />
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              confirmDelete
                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            title={confirmDelete ? 'Click again to confirm' : 'Delete'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Subscribed Events
            </p>
            <div className="flex flex-wrap gap-1.5">
              {events.map((event: string) => (
                <span
                  key={event}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono bg-primary/5 text-primary border border-primary/10"
                >
                  {event}
                </span>
              ))}
              {events.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No events subscribed</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Signing Secret
            </p>
            {newSecret ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-2">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    New signing secret generated. Save it now — it will not be shown again.
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-background/50 rounded px-2 py-1.5">
                  <code className="text-xs font-mono flex-1 break-all">{newSecret}</code>
                  <CopyButton text={newSecret} />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted/50 rounded-lg px-3 py-2">
                  <code className="text-xs font-mono">
                    {showSecret && webhook.signingSecret
                      ? webhook.signingSecret
                      : '••••••••••••••••••••••••••••••••'}
                  </code>
                </div>
                {webhook.signingSecret && (
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title={showSecret ? 'Hide secret' : 'Show secret'}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
                <button
                  onClick={handleRotateSecret}
                  disabled={isRotating}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
                  title="Rotate signing secret"
                >
                  <RotateCw className={cn('h-4 w-4', isRotating && 'animate-spin')} />
                </button>
              </div>
            )}
          </div>

          {deliveries && deliveries.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Recent Deliveries
              </p>
              <div className="space-y-1.5">
                {deliveries.map((delivery) => (
                  <div
                    key={delivery._id}
                    className="flex items-center gap-3 text-xs bg-muted/30 rounded-lg px-3 py-2"
                  >
                    {delivery.status === 'delivered' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : delivery.status === 'failed' ? (
                      <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    )}
                    <code className="font-mono text-muted-foreground">{delivery.event}</code>
                    <span className="text-muted-foreground">
                      {delivery.statusCode && `HTTP ${delivery.statusCode}`}
                    </span>
                    <span className="text-muted-foreground ml-auto">
                      {delivery.duration && `${delivery.duration}ms`}
                    </span>
                    <span className="text-muted-foreground">
                      {delivery._creationTime && formatDate(delivery._creationTime)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {confirmDelete && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Click delete again to permanently remove this webhook.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DocumentationSection() {
  const [showDocs, setShowDocs] = useState(false)

  const payloadExample = `{
  "id": "evt_1a2b3c4d5e6f",
  "type": "payment.received",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "paymentId": "pay_abc123",
    "amount": 1500,
    "currency": "USD",
    "agentId": "agent_xyz789",
    "sellerId": "seller_def456",
    "metadata": {}
  }
}`

  const verificationExample = `import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// In your webhook handler:
app.post('/webhooks', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const isValid = verifyWebhookSignature(
    JSON.stringify(req.body),
    signature,
    process.env.WEBHOOK_SECRET
  );

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  // Process the event
  const { type, data } = req.body;
  // ...

  res.status(200).send('OK');
});`

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setShowDocs(!showDocs)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <FileCode2 className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium">Webhook Documentation</p>
          <p className="text-xs text-muted-foreground">
            Payload format, headers, and signature verification
          </p>
        </div>
        {showDocs ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {showDocs && (
        <div className="border-t border-border p-4 space-y-5">
          <div>
            <h3 className="text-sm font-medium mb-2">Headers</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Every webhook delivery includes the following headers:
            </p>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-primary">X-Webhook-Signature</span>
                <span className="text-muted-foreground">
                  — HMAC-SHA256 hex digest of the request body
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-primary">X-Webhook-Id</span>
                <span className="text-muted-foreground">
                  — Unique delivery ID for idempotency
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-primary">X-Webhook-Timestamp</span>
                <span className="text-muted-foreground">— ISO 8601 timestamp of the event</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-primary">Content-Type</span>
                <span className="text-muted-foreground">— application/json</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Payload Format</h3>
            <div className="bg-zinc-950 rounded-lg p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-zinc-300 whitespace-pre">{payloadExample}</pre>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Signature Verification</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Verify the <code className="px-1 py-0.5 bg-muted rounded text-[11px]">X-Webhook-Signature</code> header
              to ensure the payload was sent by API Toll and has not been tampered with.
            </p>
            <div className="bg-zinc-950 rounded-lg p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-zinc-300 whitespace-pre">
                {verificationExample}
              </pre>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Retry Policy</h3>
            <p className="text-xs text-muted-foreground">
              Failed deliveries are retried up to 5 times with exponential backoff (1 min, 5 min,
              30 min, 2 hr, 24 hr). A delivery is considered failed if your endpoint does not
              respond with a 2xx status code within 30 seconds. After all retries are exhausted,
              the webhook status will transition to &quot;failing&quot;.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function WebhooksPage() {
  const orgId = useOrgId()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const stats = useQuery(api.webhooks.getStats, orgId ? { orgId } : 'skip')
  const webhooks = useQuery(api.webhooks.listByOrg, orgId ? { orgId } : 'skip')

  const createWebhook = useMutation(api.webhooks.create)
  const updateWebhook = useMutation(api.webhooks.update)
  const removeWebhook = useMutation(api.webhooks.remove)
  const rotateSecret = useMutation(api.webhooks.rotateSecret)
  const createTestDelivery = useMutation(api.webhooks.createTestDelivery)

  const handleCreate = async (url: string, events: string[]) => {
    if (!orgId) return
    const result = await createWebhook({ orgId, url, events })
    return { signingSecret: result.secret }
  }

  const handleUpdate = async (id: Id<'webhooks'>, data: { status?: string }) => {
    await updateWebhook({ id, ...data })
  }

  const handleRemove = async (id: Id<'webhooks'>) => {
    await removeWebhook({ id })
  }

  const handleRotateSecret = async (id: Id<'webhooks'>) => {
    const secret = await rotateSecret({ id })
    return { signingSecret: secret }
  }

  const handleTestPing = async (id: Id<'webhooks'>) => {
    await createTestDelivery({ webhookId: id })
  }

  const getDeliveriesForWebhook = (_webhookId: string) => {
    // Deliveries are loaded per-webhook when expanded
    return undefined
  }

  if (!orgId) {
    return <PageLoading />
  }

  if (webhooks === undefined || stats === undefined) {
    return <PageLoading />
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Receive real-time notifications when events happen in your account
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create Webhook
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Webhooks"
            value={stats?.total ?? 0}
            icon={Webhook}
            accent="bg-blue-500/10"
          />
          <StatCard
            label="Active"
            value={stats?.active ?? 0}
            icon={Zap}
            accent="bg-emerald-500/10"
          />
          <StatCard
            label="Inactive"
            value={(stats?.total ?? 0) - (stats?.active ?? 0)}
            icon={Activity}
            accent="bg-violet-500/10"
          />
          <StatCard
            label="Failing"
            value={stats?.failing ?? 0}
            icon={AlertTriangle}
            accent="bg-red-500/10"
          />
        </div>

        {/* Webhook List */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Endpoints ({webhooks?.length ?? 0})
          </h2>

          {webhooks && webhooks.length > 0 ? (
            <div className="space-y-3">
              {webhooks.map((webhook) => (
                <WebhookCard
                  key={webhook._id}
                  webhook={webhook}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                  onRotateSecret={handleRotateSecret}
                  onTestPing={handleTestPing}
                  deliveries={getDeliveriesForWebhook(webhook._id)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border border-dashed rounded-xl p-12 text-center">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Webhook className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium mb-1">No webhooks configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first webhook endpoint to start receiving event notifications.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Webhook
              </button>
            </div>
          )}
        </div>

        {/* Documentation */}
        <DocumentationSection />
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateWebhookModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
