/**
 * Web Research Agent Tool
 *
 * Compound operation: search → scrape top results → synthesize findings
 * Single API calls give raw data. This tool gives analyzed, actionable research.
 *
 * Price: $0.05/call (chains together ~5-10 internal API calls)
 */

import { z } from 'zod'

export const webResearchSchema = z.object({
  query: z.string().describe('Research question or topic'),
  depth: z.enum(['quick', 'standard', 'deep']).optional().describe('Research depth — quick (3 sources), standard (5), deep (10)'),
  format: z.enum(['summary', 'bullets', 'report']).optional().describe('Output format'),
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

export async function webResearch(input: z.infer<typeof webResearchSchema>) {
  const { query, depth = 'standard', format = 'summary' } = input
  const sourceCount = depth === 'quick' ? 3 : depth === 'standard' ? 5 : 10

  // Step 1: Search for relevant results
  const searchResults = await internalFetch(`/api/search?q=${encodeURIComponent(query)}&limit=${sourceCount}`)
  const results = searchResults.results || searchResults.data || []

  if (!results.length) {
    return { query, findings: 'No results found for this query.', sources: [] }
  }

  // Step 2: Scrape top results for full content
  const scrapedContent: Array<{ title: string; url: string; content: string }> = []

  const scrapePromises = results.slice(0, sourceCount).map(async (result: { url?: string; link?: string; title?: string; snippet?: string }) => {
    const url = result.url || result.link
    if (!url) return null

    try {
      const scraped = await internalFetch('/api/scrape', {
        method: 'POST',
        body: JSON.stringify({ url, format: 'text' }),
      })
      return {
        title: result.title || scraped.title || url,
        url,
        content: (scraped.content || scraped.text || result.snippet || '').slice(0, 2000),
      }
    } catch {
      return {
        title: result.title || url,
        url,
        content: result.snippet || '',
      }
    }
  })

  const scraped = await Promise.allSettled(scrapePromises)
  for (const result of scraped) {
    if (result.status === 'fulfilled' && result.value) {
      scrapedContent.push(result.value)
    }
  }

  // Step 3: Extract key entities from combined content
  const combinedText = scrapedContent.map(s => s.content).join('\n\n')

  let entities: string[] = []
  try {
    const entityResult = await internalFetch('/api/entities', {
      method: 'POST',
      body: JSON.stringify({ text: combinedText.slice(0, 5000) }),
    })
    entities = entityResult.entities || []
  } catch {
    // Entity extraction is optional
  }

  // Step 4: Run sentiment analysis on findings
  let sentiment = null
  try {
    const sentimentResult = await internalFetch('/api/sentiment', {
      method: 'POST',
      body: JSON.stringify({ text: combinedText.slice(0, 3000) }),
    })
    sentiment = sentimentResult.sentiment || sentimentResult.score
  } catch {
    // Sentiment is optional
  }

  // Step 5: Synthesize into requested format
  const sources = scrapedContent.map(s => ({ title: s.title, url: s.url }))

  const keyFindings = scrapedContent
    .filter(s => s.content.length > 50)
    .map(s => {
      const sentences = s.content.split(/[.!?]+/).filter(sent => sent.trim().length > 20)
      return {
        source: s.title,
        url: s.url,
        keyPoints: sentences.slice(0, 3).map(sent => sent.trim()),
      }
    })

  if (format === 'bullets') {
    const bullets = keyFindings.flatMap(f => f.keyPoints.map(p => `• ${p} (${f.source})`))
    return {
      query,
      findings: bullets.join('\n'),
      sourceCount: sources.length,
      sources,
      entities: entities.slice(0, 20),
      sentiment,
    }
  }

  if (format === 'report') {
    return {
      query,
      depth,
      sourcesAnalyzed: sources.length,
      keyFindings,
      entities: entities.slice(0, 20),
      sentiment,
      sources,
      generatedAt: new Date().toISOString(),
    }
  }

  // Default: summary
  const topPoints = keyFindings.flatMap(f => f.keyPoints).slice(0, 8)
  return {
    query,
    summary: topPoints.join('. ') + '.',
    sourceCount: sources.length,
    sources,
    entities: entities.slice(0, 10),
    sentiment,
  }
}
