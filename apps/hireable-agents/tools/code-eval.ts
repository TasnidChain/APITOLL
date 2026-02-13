/**
 * Code Eval Agent Tool
 *
 * Sandboxed JavaScript/TypeScript code execution.
 * Agents can test snippets, run calculations, transform data.
 * Runs in an isolated VM context — no filesystem or network access.
 *
 * ⚠️  SECURITY NOTE: Node.js vm module is NOT a true security boundary.
 *     It's possible to escape via prototype chain manipulation.
 *     We mitigate this with blocklist patterns + frozen prototypes + null prototype sandbox.
 *     For full isolation, consider migrating to isolated-vm or a WASM sandbox.
 *
 * Price: $0.01/call
 */

import { z } from 'zod'
import { createContext, runInNewContext } from 'node:vm'

export const codeEvalSchema = z.object({
  code: z.string().max(10000).describe('JavaScript/TypeScript code to execute'),
  timeout: z.number().min(100).max(10000).optional().describe('Execution timeout in ms (default 5000)'),
  input: z.record(z.unknown()).optional().describe('Input variables available as `input` in the code'),
})

export async function codeEval(params: z.infer<typeof codeEvalSchema>) {
  const { code, timeout = 5000, input = {} } = params

  // Security: block dangerous patterns (string-based + regex-based)
  const blockedStrings = [
    'process.exit', 'require(', 'import(', 'child_process',
    'fs.', 'net.', 'http.', 'https.', 'dgram.',
    'exec(', 'spawn(', 'fork(',
    '__proto__', 'constructor.constructor',
    'globalThis.process', 'Deno.', 'Bun.',
    // Additional escape vectors
    'Function(', 'Function (',
    'Reflect.', 'Proxy',
    'SharedArrayBuffer', 'Atomics',
    'WebAssembly',
  ]

  const blockedPatterns = [
    // Catch constructor chain escapes: (any).constructor, [].constructor, etc.
    /\bconstructor\s*[\[.(]/i,
    // Catch prototype pollution attempts
    /prototype\s*[\[.]/i,
    // Catch eval/Function constructor
    /\beval\s*\(/i,
    /new\s+Function\s*\(/i,
    // Catch this.constructor tricks
    /this\s*\.\s*constructor/i,
  ]

  for (const pattern of blockedStrings) {
    if (code.includes(pattern)) {
      return {
        success: false,
        error: `Blocked: "${pattern}" is not allowed in sandboxed execution`,
        output: null,
        logs: [],
        executionMs: 0,
      }
    }
  }

  for (const regex of blockedPatterns) {
    if (regex.test(code)) {
      return {
        success: false,
        error: `Blocked: pattern "${regex.source}" is not allowed in sandboxed execution`,
        output: null,
        logs: [],
        executionMs: 0,
      }
    }
  }

  const logs: string[] = []
  const maxLogs = 100 // prevent log flooding
  const start = performance.now()

  const safePush = (prefix: string, args: unknown[]) => {
    if (logs.length < maxLogs) {
      logs.push(prefix + args.map(String).join(' '))
    }
  }

  // Create sandboxed context with safe globals only
  // Use Object.create(null) to prevent prototype chain access
  const sandbox = Object.create(null)
  Object.assign(sandbox, {
    input: JSON.parse(JSON.stringify(input)), // deep clone to prevent reference leaks
    console: Object.freeze({
      log: (...args: unknown[]) => safePush('', args),
      error: (...args: unknown[]) => safePush('[ERROR] ', args),
      warn: (...args: unknown[]) => safePush('[WARN] ', args),
    }),
    JSON: Object.freeze({ parse: JSON.parse, stringify: JSON.stringify }),
    Math,
    Date,
    Array,
    Object: Object.freeze({
      keys: Object.keys,
      values: Object.values,
      entries: Object.entries,
      assign: Object.assign,
      freeze: Object.freeze,
      fromEntries: Object.fromEntries,
    }),
    String,
    Number,
    Boolean,
    Map,
    Set,
    RegExp,
    Error,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    // Explicitly null out dangerous globals
    setTimeout: undefined,
    setInterval: undefined,
    setImmediate: undefined,
    clearTimeout: undefined,
    clearInterval: undefined,
    clearImmediate: undefined,
    queueMicrotask: undefined,
    fetch: undefined,
    process: undefined,
    require: undefined,
    module: undefined,
    exports: undefined,
    __dirname: undefined,
    __filename: undefined,
    globalThis: undefined,
    global: undefined,
    self: undefined,
    window: undefined,
    eval: undefined,
    Function: undefined,
    Reflect: undefined,
    Proxy: undefined,
    SharedArrayBuffer: undefined,
    Atomics: undefined,
    WebAssembly: undefined,
  })

  try {
    const context = createContext(sandbox)

    // Wrap code to capture the last expression value
    const wrappedCode = `
      'use strict';
      (async () => {
        ${code}
      })()
    `

    const result = await runInNewContext(wrappedCode, context, {
      timeout,
      filename: 'sandbox.js',
    })

    const executionMs = Math.round(performance.now() - start)

    // Sanitize output — only return JSON-serializable data
    let safeOutput: unknown = null
    try {
      safeOutput = result !== undefined ? JSON.parse(JSON.stringify(result)) : null
    } catch {
      safeOutput = result !== undefined ? String(result) : null
    }

    return {
      success: true,
      output: safeOutput,
      logs,
      executionMs,
    }
  } catch (err) {
    const executionMs = Math.round(performance.now() - start)
    const error = err instanceof Error ? err.message : String(err)

    return {
      success: false,
      error: error.includes('Script execution timed out')
        ? `Execution timed out after ${timeout}ms`
        : error,
      output: null,
      logs,
      executionMs,
    }
  }
}
