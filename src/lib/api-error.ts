import { ErrorCodes, type ErrorCode, getErrorMessage } from './error-codes'
import { AppError, isAppError, getErrorCode } from './app-error'
import { toast } from 'sonner'

interface ApiResponse<T = unknown> {
  data?: T
  error?: AppError
}

interface FetchOptions extends RequestInit {
  timeout?: number
  showToast?: boolean
  retry?: {
    maxRetries?: number
    baseDelay?: number
  }
}

const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
}

function isRetryableError(status: number, error?: unknown): boolean {
  if (status === 408 || status === 429) return true
  if (status >= 500 && status <= 599) return true
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true

    const message = error.message.toLowerCase()
    if (message.includes('failed to fetch') || message.includes('network')) return true
  }
  return false
}

class ApiClient {
  private baseURL: string

  constructor(baseURL: string = '') {
    this.baseURL = baseURL
  }

  async get<T = unknown>(url: string, options?: FetchOptions): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' })
  }

  async post<T = unknown>(url: string, body?: unknown, options?: FetchOptions): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async put<T = unknown>(url: string, body?: unknown, options?: FetchOptions): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async delete<T = unknown>(url: string, options?: FetchOptions): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' })
  }

  private async request<T>(url: string, options?: FetchOptions): Promise<ApiResponse<T>> {
    const { timeout, retry, showToast, ...fetchOptions } = options || {}
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retry }
    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`
    const method = (fetchOptions.method || 'GET').toUpperCase()
    const canRetry = method === 'GET' || method === 'HEAD'

    let lastError: AppError | null = null
    let attempt = 0

    while (attempt <= retryConfig.maxRetries!) {
      const controller = new AbortController()
      const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : null

      try {
        const response = await fetch(fullURL, {
          ...fetchOptions,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...fetchOptions.headers,
          },
        })

        if (timeoutId) clearTimeout(timeoutId)

        if (!response.ok) {
          const error = this.mapHttpError(response)
          if (!canRetry || !isRetryableError(response.status, error) || attempt >= retryConfig.maxRetries!) {
            if (showToast) {
              toast.error(error.message, {
                description: `Code: ${error.code}`,
              })
            }
            return { error }
          }
          lastError = error
          attempt++
          const delay = retryConfig.baseDelay! * Math.pow(2, attempt - 1)
          if (attempt <= retryConfig.maxRetries!) {
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
          return { error: lastError }
        }

        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          const data = await response.json()
          return { data: data as T }
        }

        const data = await response.text()
        try {
          return { data: JSON.parse(data) as T }
        } catch {
          return { data: data as unknown as T }
        }
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId)

        const error = this.mapFetchError(err)

        if (canRetry && isRetryableError(0, err) && attempt < retryConfig.maxRetries!) {
          lastError = error
          attempt++
          const delay = retryConfig.baseDelay! * Math.pow(2, attempt - 1)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        if (showToast) {
          toast.error(error.message, {
            description: `Connection error`,
          })
        }
        return { error }
      }
    }

    return { error: lastError || new AppError(ErrorCodes.API_FETCH_FAILED, 'Max retries exceeded') }
  }

  private mapHttpError(response: Response): AppError {
    const status = response.status

    switch (status) {
      case 400:
        return new AppError(ErrorCodes.VALIDATION_FAILED, 'Invalid data', 400)
      case 401:
        return new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
      case 403:
        return new AppError(ErrorCodes.API_FORBIDDEN, 'Access denied', 403)
      case 404:
        return new AppError(ErrorCodes.API_NOT_FOUND, 'Resource not found', 404)
      case 500:
      case 502:
      case 503:
        return new AppError(ErrorCodes.API_SERVER_ERROR, 'Internal server error', status)
      default:
        return new AppError(ErrorCodes.API_FETCH_FAILED, `HTTP Error: ${status}`, status)
    }
  }

  private mapFetchError(error: unknown): AppError {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return new AppError(ErrorCodes.API_FETCH_FAILED, 'Timeout exceeded', 408)
      }
      return new AppError(ErrorCodes.API_FETCH_FAILED, error.message)
    }
    return new AppError(ErrorCodes.API_FETCH_FAILED, 'Unknown error')
  }
}

export const apiClient = new ApiClient()

export function extractErrorCode(error: unknown): ErrorCode | null {
  if (isAppError(error)) {
    return error.code
  }

  if (error instanceof Response) {
    if (!error.ok) {
      switch (error.status) {
        case 401:
          return ErrorCodes.API_UNAUTHORIZED
        case 403:
          return ErrorCodes.API_FORBIDDEN
        case 404:
          return ErrorCodes.API_NOT_FOUND
        default:
          return ErrorCodes.API_FETCH_FAILED
      }
    }
  }

  return getErrorCode(error)
}

export { AppError } from './app-error'
export { ErrorCodes } from './error-codes'
export type { ErrorCode } from './error-codes'
