const RETRY_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 300

function isRetryableEsiError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status == null) return true // network error / timeout — worth a retry
  // 4xx (auth, not-found, error-limit) won't be fixed by retrying immediately.
  return status >= 500
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * ESI has zero built-in retry. A transient blip (5xx, timeout) on a single
 * paginated call used to discard everything already fetched for that request,
 * silently falling back to whatever the caller's next-cheapest price source
 * was — making numbers look like they "randomly" changed between refreshes
 * when it was really one flaky page. Retrying a couple of times before giving
 * up smooths that out without masking a genuine, non-retryable failure (4xx).
 */
export async function withEsiRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isRetryableEsiError(error) || attempt === RETRY_ATTEMPTS) break
      await sleep(RETRY_BASE_DELAY_MS * attempt)
    }
  }
  throw lastError
}
