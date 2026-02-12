/**
 * Code Eval Agent Tool
 *
 * Sandboxed JavaScript/TypeScript code execution.
 * Agents can test snippets, run calculations, transform data.
 * Runs in an isolated VM context — no filesystem or network access.
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

  // Security: block dangerous patterns
  const blocked = [
    'process.exit', 'require(', 'import(', 'child_process',
    'fs.', 'net.', 'http.', 'https.', 'dgram.',
    'exec(', 'spawn(', 'fork(',
    '__proto__', 'constructor.constructor',
    'globalThis.process', 'Deno.', 'Bun.',
  ]

  for (const pattern of blocked) {
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

  const logs: string[] = []
  const start = performance.now()

  // Create sandboxed context with safe globals
  const sandbox = {
    input,
    console: {
      log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => logs.push(`[ERROR] ${args.map(String).join(' ')}`),
      warn: (...args: unknown[]) => logs.push(`[WARN] ${args.map(String).join(' ')}`),
    },
    JSON,
    Math,
    Date,
    Array,
    Object,
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
    setTimeout: undefined,
    setInterval: undefined,
    fetch: undefined,
    process: undefined,
    require: undefined,
    __dirname: undefined,
    __filename: undefined,
  }

  try {
    const context = createContext(sandbox)

    // Wrap code to capture the last expression value
    const wrappedCode = `
      (async () => {
        ${code}
      })()
    `

    const result = await runInNewContext(wrappedCode, context, {
      timeout,
      filename: 'sandbox.js',
    })

    const executionMs = Math.round(performance.now() - start)

    return {
      success: true,
      output: result !== undefined ? result : null,
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
