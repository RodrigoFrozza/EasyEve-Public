import { AppError } from './app-error'
import { ErrorCodes } from './error-codes'

const EXTERNAL_RATE_LIMIT = new Map<string, { count: number, timestamp: number }>()
const MAX_EXTERNAL_REQUESTS = 100
const EXTERNAL_RATE_WINDOW_MS = 60 * 1000 // 1 minute

function getSecret() {
  return process.env.EXTERNAL_API_KEY
}

export function verifyExternalApiKey(req: Request) {
  const secret = getSecret()
  const apiKey = req.headers.get('X-API-Key')

  if (!secret) {
    console.error('[AUTH] EXTERNAL_API_KEY is not configured in the environment.')
    throw new AppError(
      ErrorCodes.API_SERVER_ERROR,
      'External API access is not configured.',
      500
    )
  }

  if (apiKey !== secret) {
    throw new AppError(
      ErrorCodes.API_UNAUTHORIZED,
      'Invalid or missing API Key.',
      401
    )
  }
}

function checkExternalRateLimit() {
  const secret = getSecret()
  if (!secret) return
  
  const now = Date.now()
  const current = EXTERNAL_RATE_LIMIT.get(secret)
  
  if (current) {
    if (now - current.timestamp > EXTERNAL_RATE_WINDOW_MS) {
      EXTERNAL_RATE_LIMIT.set(secret, { count: 1, timestamp: now })
    } else {
      current.count += 1
      if (current.count > MAX_EXTERNAL_REQUESTS) {
        throw new AppError(
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          'Too many requests. Please try again later.',
          429
        )
      }
      EXTERNAL_RATE_LIMIT.set(secret, current)
    }
  } else {
    EXTERNAL_RATE_LIMIT.set(secret, { count: 1, timestamp: now })
  }
}

export function withExternalAuth(handler: (req: Request, ...args: any[]) => Promise<any>) {
  return async (req: Request, ...args: any[]) => {
    try {
      verifyExternalApiKey(req)
      checkExternalRateLimit()
      return await handler(req, ...args)
    } catch (error) {
      throw error
    }
  }
}