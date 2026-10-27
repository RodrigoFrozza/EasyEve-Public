import { prisma } from '@/lib/prisma'

const DB_TIMEOUT_MS = 3000

export interface HealthResult {
  status: 200 | 503
  body: { status: 'ok' | 'error'; version: string | null; database: 'ok' | 'unreachable' }
}

/**
 * Commit of the running build. APP_COMMIT is baked into the image by CI; Coolify
 * injects SOURCE_COMMIT=HEAD into image apps (useless), so a real SOURCE_COMMIT is
 * only a fallback for Coolify's own git builds.
 */
export function deployedCommit(): string | null {
  if (process.env.APP_COMMIT) return process.env.APP_COMMIT
  const fromCoolify = process.env.SOURCE_COMMIT
  return fromCoolify && fromCoolify !== 'HEAD' ? fromCoolify : null
}

/**
 * Liveness + database check behind GET /api/health (Coolify health check and the
 * CI smoke test in .github/workflows/deploy.yml). 200 only when the database
 * answers, so a container that booted but cannot reach Postgres never takes
 * traffic. Exposes nothing but the deployed commit. Kept free of Request/Response
 * so it is testable in the jsdom Jest environment.
 */
export async function checkHealth(): Promise<HealthResult> {
  const version = deployedCommit()
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('database timeout')), DB_TIMEOUT_MS)),
    ])
    return { status: 200, body: { status: 'ok', version, database: 'ok' } }
  } catch {
    return { status: 503, body: { status: 'error', version, database: 'unreachable' } }
  }
}
