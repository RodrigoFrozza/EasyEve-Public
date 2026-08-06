import { useState, useEffect } from 'react'
import type { CharacterListItem } from '@/types/character'

const TOKEN_EXPIRING_SOON_MS = 3 * 60 * 1000 // 3 minutes
const INVALID_TOKEN_THRESHOLD_MS = 1000000000000 // Roughly year 2001

export interface TokenStatus {
  tokenExpired: boolean
  tokenInvalid: boolean
}

export function useTokenStatus(
  tokenExpiresAt: CharacterListItem['tokenExpiresAt']
): TokenStatus {
  const [tokenExpired, setTokenExpired] = useState(false)
  const [tokenInvalid, setTokenInvalid] = useState(false)

  useEffect(() => {
    if (!tokenExpiresAt) {
      setTokenExpired(false)
      setTokenInvalid(false)
      return
    }

    const tokenExpiresAtMs = new Date(tokenExpiresAt).getTime()
    const now = Date.now()

    // tokenExpiresAtMs === 0 or very small indicates a specifically invalidated token in our backend
    const isInvalid = tokenExpiresAtMs <= 0 || tokenExpiresAtMs < INVALID_TOKEN_THRESHOLD_MS
    // Only consider expiring if the token expires in the next 3 minutes AND we're not in a fresh state
    const isExpiringSoon = tokenExpiresAtMs > 0 && 
      tokenExpiresAtMs > now && 
      tokenExpiresAtMs < (now + TOKEN_EXPIRING_SOON_MS)

    setTokenInvalid(isInvalid)
    setTokenExpired(isExpiringSoon)
  }, [tokenExpiresAt])

  return { tokenExpired, tokenInvalid }
}
