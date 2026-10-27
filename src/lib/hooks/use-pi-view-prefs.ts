'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Client-only display preferences for the PI view: whether to show the sourcing
 * suggestions and the warning/alarm indicators. These are purely visual (they do
 * not affect any server-side computation), so they live in localStorage — no DB
 * migration, no risk to the config load, and they toggle instantly.
 */
export type PiViewPrefs = {
  showSuggestions: boolean
  showWarnings: boolean
}

const STORAGE_KEY = 'pi:viewPrefs'
const DEFAULTS: PiViewPrefs = { showSuggestions: true, showWarnings: true }

function readStored(): PiViewPrefs {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<PiViewPrefs>
    return {
      showSuggestions: parsed.showSuggestions ?? DEFAULTS.showSuggestions,
      showWarnings: parsed.showWarnings ?? DEFAULTS.showWarnings,
    }
  } catch {
    return DEFAULTS
  }
}

export function usePiViewPrefs() {
  // Start from defaults so server and first client render agree (no hydration
  // mismatch); hydrate the stored value right after mount.
  const [prefs, setPrefs] = useState<PiViewPrefs>(DEFAULTS)

  useEffect(() => {
    setPrefs(readStored())
  }, [])

  const update = useCallback((patch: Partial<PiViewPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore storage failures (private mode, quota) — state still applies for the session
      }
      return next
    })
  }, [])

  const setShowSuggestions = useCallback(
    (v: boolean) => update({ showSuggestions: v }),
    [update]
  )
  const setShowWarnings = useCallback((v: boolean) => update({ showWarnings: v }), [update])

  return {
    showSuggestions: prefs.showSuggestions,
    showWarnings: prefs.showWarnings,
    setShowSuggestions,
    setShowWarnings,
  }
}
