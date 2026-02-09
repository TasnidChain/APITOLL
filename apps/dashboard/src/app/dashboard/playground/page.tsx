'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import type { Tool } from '@/lib/types'
import { useOrgId } from '@/lib/hooks'
import { PageLoading } from '@/components/loading'
import { cn } from '@/lib/utils'
import {
  Send,
  Play,
  Code2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
  AlertCircle,
  Terminal,
  Loader2,
} from 'lucide-react'

// -------------------------------------------------------
// Types
// -------------------------------------------------------

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface HeaderPair {
  key: string
  value: string
  id: string
}

interface ProxyResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: unknown
  latencyMs: number
}

type RequestState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; data: ProxyResponse }
  | { kind: 'error'; message: string }

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

let _headerId = 0
function nextHeaderId() {
  return `hdr-${++_headerId}`
}

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
  if (code >= 300 && code < 500) return 'bg-amber-500/15 text-amber-500 border-amber-500/30'
  return 'bg-red-500/15 text-red-500 border-red-500/30'
}

function formatJson(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function buildCurl(
  method: HttpMethod,
  url: string,
  headers: HeaderPair[],
  body: string,
): string {
  const parts = ['curl']
  if (method !== 'GET') {
    parts.push(`-X ${method}`)
  }
  parts.push(`'${url}'`)

  for (const h of headers) {
    if (h.key.trim()) {
      parts.push(`-H '${h.key}: ${h.value}'`)
    }
  }

  if ((method === 'POST' || method === 'PUT') && body.trim()) {
    parts.push(`-d '${body.replace(/'/g, "'\\''")}'`)
  }

  return parts.join(' \\\n  ')
}

// -------------------------------------------------------
// Sub-components
// -------------------------------------------------------

function MethodPill({
  method,
  selected,
  onClick,
}: {
  method: HttpMethod
  selected: boolean
  onClick: () => void
}) {
  const colors: Record<HttpMethod, string> = {
    GET: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    POST: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
    PUT: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    DELETE: 'bg-red-500/15 text-red-600 border-red-500/30',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all',
        selected
          ? colors[method]
          : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/80',
      )}
    >
      {method}
    </button>
  )
}

function HeaderRow({
  pair,
  onChange,
  onRemove,
}: {
  pair: HeaderPair
  onChange: (updated: HeaderPair) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder="Header name"
        value={pair.key}
        onChange={(e) => onChange({ ...pair, key: e.target.value })}
        className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <input
        type="text"
        placeholder="Value"
        value={pair.value}
        onChange={(e) => onChange({ ...pair, value: e.target.value })}
        className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        title="Remove header"
      >
        <span className="text-lg leading-none">&times;</span>
      </button>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function ToolQuickCard({
  tool,
  onSelect,
}: {
  tool: { name: string; method: string; baseUrl: string; path: string; price: number }
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Zap className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{tool.name}</p>
        <p className="truncate text-[11px] font-mono text-muted-foreground">
          {tool.method} {tool.baseUrl}{tool.path}
        </p>
      </div>
      <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
        ${tool.price}
      </span>
    </button>
  )
}

// -------------------------------------------------------
// x402 Payment Flow Indicator
// -------------------------------------------------------

function X402Indicator({ body }: { body: unknown }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15">
          <Zap className="h-4 w-4 text-amber-500" />
        </div>
        <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400">
          x402 Payment Required
        </h4>
      </div>
      <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
        This endpoint requires payment via the x402 protocol. The response contains payment
        details that an agent wallet can use to automatically fulfill the payment and retry the
        request.
      </p>
      <div className="mt-3 space-y-1.5 text-xs text-amber-600/70 dark:text-amber-400/70">
        <p className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-[10px] font-bold text-amber-500">1</span>
          Client sends request to the endpoint
        </p>
        <p className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-[10px] font-bold text-amber-500">2</span>
          Server responds with 402 and payment details
        </p>
        <p className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-[10px] font-bold text-amber-500">3</span>
          Agent wallet signs and sends payment on-chain
        </p>
        <p className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-[10px] font-bold text-amber-500">4</span>
          Client retries original request with payment proof
        </p>
      </div>
      {body && typeof body === 'object' ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-amber-500/20 bg-amber-500/5">
          <div className="border-b border-amber-500/20 px-3 py-1.5">
            <span className="text-[11px] font-medium text-amber-500">Payment Details</span>
          </div>
          <pre className="overflow-x-auto p-3 text-xs font-mono text-amber-600 dark:text-amber-300">
            {formatJson(body)}
          </pre>
        </div>
      ) : null}
    </div>
  )
}

// -------------------------------------------------------
// cURL Export Modal
// -------------------------------------------------------

function CurlExportModal({
  curlCmd,
  onClose,
}: {
  curlCmd: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(curlCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">cURL Export</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>
        <div className="overflow-hidden rounded-xl border bg-muted/50">
          <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
              bash
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto p-4">
            <code className="text-sm font-mono text-foreground">{curlCmd}</code>
          </pre>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------
// Response Panel
// -------------------------------------------------------

function ResponsePanel({ state }: { state: RequestState }) {
  const [headersOpen, setHeadersOpen] = useState(false)

  if (state.kind === 'idle') {
    return (
      <div className="flex h-full flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
          <Send className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          Send a request to see the response
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Build your request on the left, then hit Send
        </p>
      </div>
    )
  }

  if (state.kind === 'loading') {
    return (
      <div className="flex h-full flex-col items-center justify-center py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          Sending request...
        </p>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
          <AlertCircle className="h-6 w-6 text-red-500" />
        </div>
        <p className="mt-4 text-sm font-medium text-red-500">
          Request failed
        </p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          {state.message}
        </p>
      </div>
    )
  }

  // state.kind === 'success'
  const { data } = state
  const is402 = data.status === 402
  const formattedBody = formatJson(data.body)

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-bold',
              statusColor(data.status),
            )}
          >
            {data.status} {data.statusText}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {data.latencyMs}ms
        </div>
      </div>

      {/* x402 indicator */}
      {is402 && <X402Indicator body={data.body} />}

      {/* Response headers (collapsible) */}
      <div className="rounded-xl border bg-card">
        <button
          type="button"
          onClick={() => setHeadersOpen(!headersOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>Response Headers</span>
          {headersOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {headersOpen && (
          <div className="border-t px-4 py-3">
            <div className="space-y-1">
              {Object.entries(data.headers).map(([key, value]) => (
                <div key={key} className="flex gap-2 text-xs">
                  <span className="shrink-0 font-mono font-semibold text-foreground">
                    {key}:
                  </span>
                  <span className="font-mono text-muted-foreground break-all">
                    {value}
                  </span>
                </div>
              ))}
              {Object.keys(data.headers).length === 0 && (
                <p className="text-xs text-muted-foreground">No headers returned</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Response body */}
      {!is402 && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
            <span className="text-sm font-medium text-muted-foreground">
              Response Body
            </span>
            <CopyButton text={formattedBody} />
          </div>
          <pre className="max-h-[500px] overflow-auto p-4">
            <code className="text-sm font-mono text-foreground whitespace-pre-wrap break-words">
              {formattedBody}
            </code>
          </pre>
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------
// Main Page
// -------------------------------------------------------

export default function PlaygroundPage() {
  const orgId = useOrgId()

  // Load active tools for quick-select (unconditional hook call).
  const toolsResult = useQuery(api.tools.search, { limit: 20 })
  const tools: Tool[] = Array.isArray(toolsResult) ? toolsResult : []

  // Request builder state
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState<HeaderPair[]>([
    { key: 'Content-Type', value: 'application/json', id: nextHeaderId() },
  ])
  const [body, setBody] = useState('')

  // Response state
  const [reqState, setReqState] = useState<RequestState>({ kind: 'idle' })

  // cURL modal
  const [showCurl, setShowCurl] = useState(false)

  // ---- Header management ----
  const addHeader = () =>
    setHeaders((prev) => [...prev, { key: '', value: '', id: nextHeaderId() }])

  const updateHeader = (id: string, updated: HeaderPair) =>
    setHeaders((prev) => prev.map((h) => (h.id === id ? updated : h)))

  const removeHeader = (id: string) =>
    setHeaders((prev) => prev.filter((h) => h.id !== id))

  // ---- Tool quick-select ----
  const selectTool = (tool: Tool) => {
    setMethod(tool.method?.toUpperCase() ?? 'GET')
    setUrl(`${tool.baseUrl ?? ''}${tool.path ?? ''}`)
    setHeaders([
      { key: 'Content-Type', value: 'application/json', id: nextHeaderId() },
    ])
    setBody('')
  }

  // ---- Send request ----
  const sendRequest = async () => {
    if (!url.trim()) return

    setReqState({ kind: 'loading' })

    try {
      // Build headers object
      const headersObj: Record<string, string> = {}
      for (const h of headers) {
        if (h.key.trim()) headersObj[h.key.trim()] = h.value
      }

      // Parse body for POST/PUT
      let parsedBody: unknown = undefined
      if ((method === 'POST' || method === 'PUT') && body.trim()) {
        try {
          parsedBody = JSON.parse(body)
        } catch {
          parsedBody = body
        }
      }

      const res = await fetch('/api/playground/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, url, headers: headersObj, body: parsedBody }),
      })

      const data = await res.json()

      if (data.status !== undefined) {
        setReqState({
          kind: 'success',
          data: {
            status: data.status,
            statusText: data.statusText ?? '',
            headers: data.headers ?? {},
            body: data.body,
            latencyMs: data.latencyMs ?? 0,
          },
        })
      } else {
        setReqState({
          kind: 'error',
          message: data.error ?? 'Unknown error from proxy',
        })
      }
    } catch (err: unknown) {
      setReqState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      })
    }
  }

  if (!orgId) {
    return <PageLoading />
  }

  const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE']
  const showBody = method === 'POST' || method === 'PUT'

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          <Play className="h-7 w-7 text-primary" />
          API Playground
        </h1>
        <p className="mt-1 text-muted-foreground">
          Test API calls against seller endpoints, including x402 payment flows.
        </p>
      </div>

      {/* Quick-select tools */}
      {tools.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Zap className="h-3.5 w-3.5" />
            Quick Select from Discovered Tools
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tools.slice(0, 6).map((tool) => (
              <ToolQuickCard
                key={tool._id}
                tool={tool}
                onSelect={() => selectTool(tool)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- Left Panel: Request Builder ---- */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Code2 className="h-4 w-4 text-primary" />
              Request Builder
            </h2>

            {/* Method pills */}
            <div className="flex flex-wrap gap-2">
              {methods.map((m) => (
                <MethodPill
                  key={m}
                  method={m}
                  selected={method === m}
                  onClick={() => setMethod(m)}
                />
              ))}
            </div>

            {/* URL input */}
            <div className="mt-4">
              <label className="text-xs font-medium text-muted-foreground">URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/v1/endpoint"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendRequest()
                }}
              />
            </div>

            {/* Headers */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Headers
                </label>
                <button
                  type="button"
                  onClick={addHeader}
                  className="rounded-md px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  + Add
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {headers.map((h) => (
                  <HeaderRow
                    key={h.id}
                    pair={h}
                    onChange={(updated) => updateHeader(h.id, updated)}
                    onRemove={() => removeHeader(h.id)}
                  />
                ))}
                {headers.length === 0 && (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    No headers. Click + Add to include one.
                  </p>
                )}
              </div>
            </div>

            {/* Body (POST/PUT only) */}
            {showBody && (
              <div className="mt-4">
                <label className="text-xs font-medium text-muted-foreground">
                  Body (JSON)
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder='{\n  "key": "value"\n}'
                  rows={6}
                  className="mt-1 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={sendRequest}
                disabled={reqState.kind === 'loading' || !url.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {reqState.kind === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Request
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowCurl(true)}
                className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Export as cURL"
              >
                <Terminal className="h-4 w-4" />
                cURL
              </button>
            </div>
          </div>
        </div>

        {/* ---- Right Panel: Response Viewer ---- */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Terminal className="h-4 w-4 text-primary" />
            Response
          </h2>
          <ResponsePanel state={reqState} />
        </div>
      </div>

      {/* cURL Export Modal */}
      {showCurl && (
        <CurlExportModal
          curlCmd={buildCurl(method, url, headers, body)}
          onClose={() => setShowCurl(false)}
        />
      )}
    </div>
  )
}
