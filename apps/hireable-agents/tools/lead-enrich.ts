/**
 * Lead Enrichment Agent Tool
 *
 * Compound operation: domain → DNS + WHOIS + meta + tech stack + socials + SSL
 * One call gives a complete company/domain intelligence profile.
 *
 * Price: $0.08/call (chains 6-8 internal API calls)
 */

import { z } from 'zod'

export const leadEnrichSchema = z.object({
  domain: z.string().describe('Domain to enrich (e.g., "stripe.com")'),
  include: z.array(z.enum(['dns', 'whois', 'meta', 'tech', 'ssl', 'security', 'social']))
    .optional()
    .describe('What to include (default: all)'),
})

const SELLER_API = process.env.SELLER_API_URL || 'https://api.apitoll.com'

async function internalFetch(path: string) {
  const res = await fetch(`${SELLER_API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`)
  return res.json()
}

export async function leadEnrich(input: z.infer<typeof leadEnrichSchema>) {
  const { domain, include = ['dns', 'whois', 'meta', 'tech', 'ssl', 'security', 'social'] } = input

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const url = `https://${cleanDomain}`

  const profile: Record<string, unknown> = {
    domain: cleanDomain,
    enrichedAt: new Date().toISOString(),
  }

  const promises: Promise<void>[] = []

  // DNS records
  if (include.includes('dns')) {
    promises.push(
      internalFetch(`/api/dns?domain=${encodeURIComponent(cleanDomain)}`)
        .then(data => {
          profile.dns = {
            a: data.A || data.a || [],
            mx: data.MX || data.mx || [],
            ns: data.NS || data.ns || [],
            txt: data.TXT || data.txt || [],
          }
          // Infer email provider from MX
          const mxRecords = (data.MX || data.mx || []).map((r: { exchange?: string } | string) =>
            typeof r === 'string' ? r : r.exchange || ''
          ).join(' ').toLowerCase()
          if (mxRecords.includes('google')) profile.emailProvider = 'Google Workspace'
          else if (mxRecords.includes('outlook') || mxRecords.includes('microsoft')) profile.emailProvider = 'Microsoft 365'
          else if (mxRecords.includes('protonmail')) profile.emailProvider = 'ProtonMail'
        })
        .catch(() => { profile.dns = null })
    )
  }

  // WHOIS
  if (include.includes('whois')) {
    promises.push(
      internalFetch(`/api/whois?domain=${encodeURIComponent(cleanDomain)}`)
        .then(data => {
          profile.whois = {
            registrar: data.registrar,
            createdDate: data.creationDate || data.created,
            expiresDate: data.expirationDate || data.expires,
            updatedDate: data.updatedDate || data.updated,
            nameServers: data.nameServers || data.nameservers,
          }
          // Calculate domain age
          const created = data.creationDate || data.created
          if (created) {
            const ageMs = Date.now() - new Date(created).getTime()
            profile.domainAgeYears = Math.round(ageMs / (365.25 * 24 * 60 * 60 * 1000) * 10) / 10
          }
        })
        .catch(() => { profile.whois = null })
    )
  }

  // Page metadata
  if (include.includes('meta')) {
    promises.push(
      internalFetch(`/api/meta?url=${encodeURIComponent(url)}`)
        .then(data => {
          profile.meta = {
            title: data.title,
            description: data.description,
            ogImage: data.ogImage || data.image,
            favicon: data.favicon,
          }
          // Extract social links from meta if available
          profile.companyName = data.ogSiteName || data.title?.split(/[-|–]/)[0]?.trim()
        })
        .catch(() => { profile.meta = null })
    )
  }

  // Tech stack detection
  if (include.includes('tech')) {
    promises.push(
      internalFetch(`/api/security/techstack?url=${encodeURIComponent(url)}`)
        .then(data => {
          profile.techStack = data.technologies || data.tech || data
        })
        .catch(() => { profile.techStack = null })
    )
  }

  // SSL certificate
  if (include.includes('ssl')) {
    promises.push(
      internalFetch(`/api/ssl?domain=${encodeURIComponent(cleanDomain)}`)
        .then(data => {
          profile.ssl = {
            issuer: data.issuer,
            validFrom: data.validFrom || data.valid_from,
            validTo: data.validTo || data.valid_to,
            daysRemaining: data.daysRemaining || data.days_remaining,
          }
        })
        .catch(() => { profile.ssl = null })
    )
  }

  // Security headers
  if (include.includes('security')) {
    promises.push(
      internalFetch(`/api/security/headers?url=${encodeURIComponent(url)}`)
        .then(data => {
          profile.security = {
            grade: data.grade || data.score,
            headers: data.headers || data.results,
          }
        })
        .catch(() => { profile.security = null })
    )
  }

  await Promise.allSettled(promises)

  // Compute a simple trust score
  let trustScore = 50
  if (profile.ssl && (profile.ssl as Record<string, unknown>).daysRemaining && Number((profile.ssl as Record<string, unknown>).daysRemaining) > 30) trustScore += 10
  if (profile.domainAgeYears && Number(profile.domainAgeYears) > 2) trustScore += 15
  if (profile.security && (profile.security as Record<string, unknown>).grade) trustScore += 10
  if (profile.dns) trustScore += 5
  if (profile.emailProvider) trustScore += 10
  profile.trustScore = Math.min(trustScore, 100)

  return profile
}
