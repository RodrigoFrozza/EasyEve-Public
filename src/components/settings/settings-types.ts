export const SETTINGS_TAB_IDS = [
  'general',
  'privacy',
  'notifications',
  'appearance',
  'integrations',
  'data',
] as const

export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[number]

export function isValidSettingsTab(tab: string | null | undefined): tab is SettingsTabId {
  return SETTINGS_TAB_IDS.includes(tab as SettingsTabId)
}

export interface SettingsUser {
  id: string
  accountCode: string | null
  lastLoginAt: Date | null
  subscriptionEnd: Date | null
  role: string
  profile?: {
    locale: string | null
    accentColor: string | null
    isPublic: boolean
    autoTrackingEnabled: boolean
  } | null
  characters: {
    id: string
    name: string
    isMain: boolean
  }[]
}

export interface SettingsIntegrationsMeta {
  esiConnected: boolean
  characterCount: number
  lastSyncLabel: string | null
}
