export const EXTERNAL_LINKS = {
  GITHUB: 'https://github.com/RodrigoFrozza/EasyEve-Public.git',
  DISCORD: 'https://discord.gg/6Tt7XP3JhH',
} as const

const rawPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://easyeve.cloud'
export const PUBLIC_APP_URL = rawPublicAppUrl.replace(/\/$/, '')

/** Canonical public site URL (same as {@link PUBLIC_APP_URL}). */
export const APP_URL = PUBLIC_APP_URL
