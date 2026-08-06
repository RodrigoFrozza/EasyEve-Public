const CHUNK_RELOAD_KEY = 'easyeve:chunk-reload'

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    const message = typeof error === 'string' ? error : ''
    return message.toLowerCase().includes('loading chunk')
  }

  return (
    error.name === 'ChunkLoadError' ||
    error.message.includes('Loading chunk') ||
    error.message.toLowerCase().includes('loading chunk')
  )
}

/** Reload once per tab session when a stale JS chunk fails after deploy. */
export function tryRecoverFromChunkLoadError(error: unknown): boolean {
  if (!isChunkLoadError(error)) return false
  if (typeof window === 'undefined') return false

  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') return false
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
  } catch {
    return false
  }

  window.location.reload()
  return true
}
