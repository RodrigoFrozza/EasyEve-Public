'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export type AccentColor = 'cyan' | 'gold' | 'emerald' | 'rose'

interface ThemeContextType {
  accentColor: AccentColor
  setAccentColor: (color: AccentColor) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const ACCENT_COLORS: Record<AccentColor, string> = {
  cyan: '188 100% 50%',    // #00d4ff
  gold: '45 100% 50%',     // #ffd700
  emerald: '160 84% 39%',  // #10b981
  rose: '341 81% 55%',     // #f43f5e
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accentColor, setAccentColor] = useState<AccentColor>('cyan')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('easyeve-accent-color') as AccentColor
    if (saved && ACCENT_COLORS[saved]) {
      setAccentColor(saved)
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    localStorage.setItem('easyeve-accent-color', accentColor)
    
    // Update CSS variables for the entire application
    const root = document.documentElement
    root.style.setProperty('--primary', ACCENT_COLORS[accentColor])
    root.style.setProperty('--ring', ACCENT_COLORS[accentColor])
    
    // Optional: add a specific class for the accent color
    Object.keys(ACCENT_COLORS).forEach(color => {
      root.classList.remove(`accent-${color}`)
    })
    root.classList.add(`accent-${accentColor}`)
    
  }, [accentColor, mounted])

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
