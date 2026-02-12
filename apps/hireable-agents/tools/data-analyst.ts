/**
 * Data Analyst Agent Tool
 *
 * Analyze structured data (JSON arrays, CSV) — compute stats, find patterns,
 * generate insights. Agents can pipe data through this for analysis.
 *
 * Price: $0.02/call
 */

import { z } from 'zod'

export const dataAnalystSchema = z.object({
  data: z.union([
    z.array(z.record(z.unknown())),
    z.string().describe('CSV string'),
  ]).describe('Data to analyze — JSON array of objects or CSV string'),
  question: z.string().optional().describe('Specific question about the data'),
  operations: z.array(z.enum([
    'summary', 'statistics', 'correlations', 'outliers',
    'distribution', 'top_values', 'missing_data', 'trends',
  ])).optional().describe('Analysis operations to perform (default: all basic)'),
})

function parseCSV(csv: string): Record<string, unknown>[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
    const row: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      const num = Number(values[i])
      row[h] = isNaN(num) || values[i] === '' ? values[i] : num
    })
    return row
  })
}

function getNumericColumns(data: Record<string, unknown>[]): string[] {
  if (!data.length) return []
  return Object.keys(data[0]).filter(key =>
    data.some(row => typeof row[key] === 'number')
  )
}

function getStringColumns(data: Record<string, unknown>[]): string[] {
  if (!data.length) return []
  return Object.keys(data[0]).filter(key =>
    data.some(row => typeof row[key] === 'string')
  )
}

function computeStats(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const sum = values.reduce((a, b) => a + b, 0)
  const mean = sum / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  const stdDev = Math.sqrt(variance)

  return {
    count: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(mean * 1000) / 1000,
    median: sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)],
    stdDev: Math.round(stdDev * 1000) / 1000,
    sum: Math.round(sum * 1000) / 1000,
    q25: sorted[Math.floor(sorted.length * 0.25)],
    q75: sorted[Math.floor(sorted.length * 0.75)],
  }
}

export async function dataAnalyst(input: z.infer<typeof dataAnalystSchema>) {
  const { question, operations = ['summary', 'statistics', 'top_values', 'missing_data'] } = input

  // Parse data
  const data = typeof input.data === 'string' ? parseCSV(input.data) : input.data

  if (!data.length) {
    return { error: 'No data to analyze', rowCount: 0 }
  }

  const numericCols = getNumericColumns(data)
  const stringCols = getStringColumns(data)
  const allColumns = Object.keys(data[0])

  const result: Record<string, unknown> = {
    rowCount: data.length,
    columnCount: allColumns.length,
    columns: allColumns,
    numericColumns: numericCols,
    categoricalColumns: stringCols,
  }

  // Summary
  if (operations.includes('summary')) {
    result.summary = {
      rows: data.length,
      columns: allColumns.length,
      numericFields: numericCols.length,
      categoricalFields: stringCols.length,
      sampleRow: data[0],
    }
  }

  // Statistics for numeric columns
  if (operations.includes('statistics')) {
    const stats: Record<string, unknown> = {}
    for (const col of numericCols) {
      const values = data.map(r => r[col]).filter((v): v is number => typeof v === 'number')
      stats[col] = computeStats(values)
    }
    result.statistics = stats
  }

  // Correlations between numeric columns
  if (operations.includes('correlations') && numericCols.length >= 2) {
    const correlations: Array<{ col1: string; col2: string; correlation: number }> = []
    for (let i = 0; i < numericCols.length; i++) {
      for (let j = i + 1; j < numericCols.length; j++) {
        const col1 = numericCols[i]
        const col2 = numericCols[j]
        const pairs = data.filter(r => typeof r[col1] === 'number' && typeof r[col2] === 'number')
        if (pairs.length < 3) continue

        const vals1 = pairs.map(r => r[col1] as number)
        const vals2 = pairs.map(r => r[col2] as number)
        const mean1 = vals1.reduce((a, b) => a + b, 0) / vals1.length
        const mean2 = vals2.reduce((a, b) => a + b, 0) / vals2.length

        let num = 0, den1 = 0, den2 = 0
        for (let k = 0; k < vals1.length; k++) {
          const d1 = vals1[k] - mean1
          const d2 = vals2[k] - mean2
          num += d1 * d2
          den1 += d1 * d1
          den2 += d2 * d2
        }
        const corr = den1 && den2 ? num / Math.sqrt(den1 * den2) : 0
        correlations.push({ col1, col2, correlation: Math.round(corr * 1000) / 1000 })
      }
    }
    correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
    result.correlations = correlations.slice(0, 20)
  }

  // Outliers (values beyond 2 std devs)
  if (operations.includes('outliers')) {
    const outliers: Record<string, Array<{ index: number; value: number; zScore: number }>> = {}
    for (const col of numericCols) {
      const values = data.map(r => r[col]).filter((v): v is number => typeof v === 'number')
      const stats = computeStats(values)
      if (!stats || stats.stdDev === 0) continue

      const colOutliers: Array<{ index: number; value: number; zScore: number }> = []
      data.forEach((row, idx) => {
        if (typeof row[col] !== 'number') return
        const z = (row[col] as number - stats.mean) / stats.stdDev
        if (Math.abs(z) > 2) {
          colOutliers.push({ index: idx, value: row[col] as number, zScore: Math.round(z * 100) / 100 })
        }
      })
      if (colOutliers.length > 0) {
        outliers[col] = colOutliers.slice(0, 10)
      }
    }
    result.outliers = outliers
  }

  // Top values for categorical columns
  if (operations.includes('top_values')) {
    const topValues: Record<string, Array<{ value: string; count: number; percentage: number }>> = {}
    for (const col of stringCols) {
      const counts: Record<string, number> = {}
      data.forEach(row => {
        const val = String(row[col] ?? '')
        counts[val] = (counts[val] || 0) + 1
      })
      const sorted = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([value, count]) => ({
          value,
          count,
          percentage: Math.round((count / data.length) * 1000) / 10,
        }))
      topValues[col] = sorted
    }
    result.topValues = topValues
  }

  // Missing data
  if (operations.includes('missing_data')) {
    const missing: Record<string, { count: number; percentage: number }> = {}
    for (const col of allColumns) {
      const missingCount = data.filter(r => r[col] === null || r[col] === undefined || r[col] === '').length
      if (missingCount > 0) {
        missing[col] = {
          count: missingCount,
          percentage: Math.round((missingCount / data.length) * 1000) / 10,
        }
      }
    }
    result.missingData = missing
  }

  // Trends (simple: first vs last quartile means for numeric cols)
  if (operations.includes('trends') && data.length >= 8) {
    const trends: Record<string, { direction: string; change: number; changePercent: number }> = {}
    const q1End = Math.floor(data.length * 0.25)
    const q4Start = Math.floor(data.length * 0.75)

    for (const col of numericCols) {
      const firstQ = data.slice(0, q1End).map(r => r[col]).filter((v): v is number => typeof v === 'number')
      const lastQ = data.slice(q4Start).map(r => r[col]).filter((v): v is number => typeof v === 'number')

      if (firstQ.length && lastQ.length) {
        const firstMean = firstQ.reduce((a, b) => a + b, 0) / firstQ.length
        const lastMean = lastQ.reduce((a, b) => a + b, 0) / lastQ.length
        const change = lastMean - firstMean
        const changePercent = firstMean !== 0 ? (change / Math.abs(firstMean)) * 100 : 0

        trends[col] = {
          direction: change > 0 ? 'increasing' : change < 0 ? 'decreasing' : 'stable',
          change: Math.round(change * 1000) / 1000,
          changePercent: Math.round(changePercent * 10) / 10,
        }
      }
    }
    result.trends = trends
  }

  // Answer specific question
  if (question) {
    result.questionContext = {
      question,
      note: 'Use the statistics, correlations, and trends above to answer this question. The data has been fully analyzed for you.',
    }
  }

  return result
}
