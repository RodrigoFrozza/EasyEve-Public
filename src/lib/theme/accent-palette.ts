export type AccentColor = 'teal' | 'cyan' | 'gold' | 'emerald' | 'rose'

export const ACCENT_STORAGE_KEY = 'easyeve-accent-color'

export const ACCENT_COLORS: AccentColor[] = ['teal', 'cyan', 'gold', 'emerald', 'rose']

export interface AccentPalette {
  /** HSL components only, e.g. "188 100% 50%" */
  accent: string
  accentDim: string
  highlight: string
}

export const ACCENT_PALETTES: Record<AccentColor, AccentPalette> = {
  teal: {
    // Teal Aurora accent — --acc #34b3a4, --acc-soft #5cc9bb
    accent: '173 55% 45%',
    accentDim: '172 60% 38%',
    highlight: '172 50% 58%',
  },
  cyan: {
    accent: '188 100% 50%',
    accentDim: '187 65% 42%',
    highlight: '187 72% 55%',
  },
  gold: {
    accent: '45 100% 50%',
    accentDim: '43 90% 42%',
    highlight: '48 100% 58%',
  },
  emerald: {
    accent: '160 84% 39%',
    accentDim: '160 72% 32%',
    highlight: '158 76% 48%',
  },
  rose: {
    accent: '341 81% 55%',
    accentDim: '341 70% 45%',
    highlight: '341 85% 62%',
  },
}

export const DEFAULT_ACCENT_COLOR: AccentColor = 'teal'

export function isAccentColor(value: string | null | undefined): value is AccentColor {
  return ACCENT_COLORS.includes(value as AccentColor)
}

export function resolveAccentColor(value: string | null | undefined): AccentColor {
  return isAccentColor(value) ? value : DEFAULT_ACCENT_COLOR
}

/** Inline style for SSR first paint (matches applyAccentToDocument). */
export function getAccentInlineStyle(
  color: AccentColor
): Record<string, string> {
  const palette = ACCENT_PALETTES[color]
  return {
    '--eve-accent': palette.accent,
    '--eve-accent-dim': palette.accentDim,
    '--eve-highlight': palette.highlight,
    // Teal Aurora accent aliases (themeable) — consumed by color-mix recipes
    '--acc': `hsl(${palette.accent})`,
    '--acc-soft': `hsl(${palette.highlight})`,
    '--primary': palette.accent,
    '--ring': palette.accent,
    '--scrollbar-thumb': `hsl(${palette.accent} / 0.25)`,
    '--scrollbar-thumb-hover': `hsl(${palette.accent} / 0.45)`,
    '--scrollbar-thumb-subtle': `hsl(${palette.accent} / 0.2)`,
    '--scrollbar-thumb-subtle-hover': `hsl(${palette.accent} / 0.35)`,
  }
}

/** Apply user accent to document root (core UI + shadcn primary). */
export function applyAccentToDocument(color: AccentColor): void {
  if (typeof document === 'undefined') return

  const palette = ACCENT_PALETTES[color]
  const root = document.documentElement

  root.style.setProperty('--eve-accent', palette.accent)
  root.style.setProperty('--eve-accent-dim', palette.accentDim)
  root.style.setProperty('--eve-highlight', palette.highlight)
  root.style.setProperty('--acc', `hsl(${palette.accent})`)
  root.style.setProperty('--acc-soft', `hsl(${palette.highlight})`)
  root.style.setProperty('--primary', palette.accent)
  root.style.setProperty('--ring', palette.accent)
  root.style.setProperty('--scrollbar-thumb', `hsl(${palette.accent} / 0.25)`)
  root.style.setProperty('--scrollbar-thumb-hover', `hsl(${palette.accent} / 0.45)`)
  root.style.setProperty('--scrollbar-thumb-subtle', `hsl(${palette.accent} / 0.2)`)
  root.style.setProperty('--scrollbar-thumb-subtle-hover', `hsl(${palette.accent} / 0.35)`)

  ACCENT_COLORS.forEach((id) => {
    root.classList.remove(`accent-${id}`)
  })
  root.classList.add(`accent-${color}`)
}
