/**
 * Smart Scrape Agent Tool
 *
 * Compound operation: scrape URL → extract metadata → analyze content → structure output
 * More than raw HTML — returns clean, structured, enriched data from any URL.
 *
 * Price: $0.03/call
 */

import { z } from 'zod'

export const smartScrapeSchema = z.object({
  url: z.string().url().describe('URL to scrape and analyze'),
  extract: z.array(z.enum(['text', 'links', 'meta', 'entities', 'sentiment', 'summary']))
    .optional()
    .describe('What to extract (default: all)'),
})

const SELLER_API = process.env.SELLER_API_URL || 'https://api.apitoll.com'

async function internalFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${SELLER_API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`)
  return res.json()
}

export async function smartScrape(input: z.infer<typeof smartScrapeSchema>) {
  const { url, extract = ['text', 'links', 'meta', 'entities', 'summary'] } = input

  const output: Record<string, unknown> = { url, scrapedAt: new Date().toISOString() }

  // Step 1: Scrape the page content
  const scraped = await internalFetch('/api/scrape', {
    method: 'POST',
    body: JSON.stringify({ url, format: 'text' }),
  })

  const content = scraped.content || scraped.text || ''
  const title = scraped.title || ''

  if (extract.includes('text')) {
    output.title = title
    output.text = content.slice(0, 10000)
    output.wordCount = content.split(/\s+/).length
  }

  // Step 2: Extract metadata (parallel with other operations)
  const promises: Promise<void>[] = []

  if (extract.includes('meta')) {
    promises.push(
      internalFetch(`/api/meta?url=${encodeURIComponent(url)}`)
        .then(meta => { output.meta = meta })
        .catch(() => { output.meta = { title } })
    )
  }

  if (extract.includes('links')) {
    promises.push(
      internalFetch(`/api/links?url=${encodeURIComponent(url)}`)
        .then(links => {
          output.links = {
            total: links.links?.length || 0,
            internal: links.links?.filter((l: { type?: string }) => l.type === 'internal')?.length || 0,
            external: links.links?.filter((l: { type?: string }) => l.type === 'external')?.length || 0,
            items: (links.links || []).slice(0, 50),
          }
        })
        .catch(() => { output.links = { total: 0, items: [] } })
    )
  }

  if (extract.includes('entities') && content.length > 50) {
    promises.push(
      internalFetch('/api/entities', {
        method: 'POST',
        body: JSON.stringify({ text: content.slice(0, 5000) }),
      })
        .then(result => { output.entities = result.entities || [] })
        .catch(() => { output.entities = [] })
    )
  }

  if (extract.includes('sentiment') && content.length > 50) {
    promises.push(
      internalFetch('/api/sentiment', {
        method: 'POST',
        body: JSON.stringify({ text: content.slice(0, 3000) }),
      })
        .then(result => { output.sentiment = result })
        .catch(() => { output.sentiment = null })
    )
  }

  if (extract.includes('summary') && content.length > 200) {
    promises.push(
      internalFetch('/api/summarize', {
        method: 'POST',
        body: JSON.stringify({ text: content.slice(0, 5000), sentences: 3 }),
      })
        .then(result => { output.summary = result.summary || result.text })
        .catch(() => { output.summary = null })
    )
  }

  await Promise.allSettled(promises)

  return output
}
