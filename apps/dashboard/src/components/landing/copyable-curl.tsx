'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

const CURL_COMMAND = 'curl -s https://api.apitoll.com/api/joke'

export function CopyableCurl() {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(CURL_COMMAND)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-2.5">
      <span className="text-xs text-slate-500">Try it yourself</span>
      <code className="flex-1 truncate font-mono text-xs text-slate-300">{CURL_COMMAND}</code>
      <button
        onClick={handleCopy}
        className="shrink-0 rounded p-1 text-slate-500 transition-colors hover:bg-slate-700/50 hover:text-slate-300"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}
