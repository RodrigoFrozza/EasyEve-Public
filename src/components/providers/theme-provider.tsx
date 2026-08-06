'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react'
import {
  ACCENT_STORAGE_KEY,
  applyAccentToDocument,
  DEFAULT_ACCENT_COLOR,
  isAccentColor,
  resolveAccentColor,
  type AccentColor,
} from '@/lib/theme/accent-palette'

export type { AccentColor }

interface ThemeContextType {
  accentColor: AccentColor
  setAccentColor: (color: AccentColor) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: React.ReactNode
  initialAccentColor?: AccentColor
}

export function ThemeProvider({ children, initialAccentColor }: ThemeProviderProps) {
  const [accentColor, setAccentColorState] = useState<AccentColor>(
    () => initialAccentColor ?? DEFAULT_ACCENT_COLOR
  )

  const setAccentColor = useCallback((color: AccentColor) => {
    setAccentColorState(color)
    applyAccentToDocument(color)
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACCENT_STORAGE_KEY, color)
    }
  }, [])

  useLayoutEffect(() => {
    applyAccentToDocument(accentColor)
  }, [accentColor])

  useEffect(() => {
    const hydrate = async () => {
      try {
        const res = await fetch('/api/settings/preferences')
        if (res.ok) {
          const data = await res.json()
          setAccentColor(resolveAccentColor(data.accentColor))
          return
        }
      } catch {
        // unauthenticated or network — fall through
      }

      const stored = localStorage.getItem(ACCENT_STORAGE_KEY)
      if (isAccentColor(stored)) {
        setAccentColor(stored)
        return
      }

      if (initialAccentColor) {
        setAccentColor(initialAccentColor)
      }
    }

    void hydrate()
  }, [initialAccentColor, setAccentColor])

  return (
    <ThemeContext.Provider value={{ accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
