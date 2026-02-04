import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/agentcommerce'

export const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

// Health check
export async function checkConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`
    return true
  } catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
}
