import type { LucideIcon } from 'lucide-react'
import { User, Shield, Bell, Palette, Link2, Database } from 'lucide-react'
import type { SettingsTabId } from './settings-types'

export const SETTINGS_TABS_CONFIG: {
  id: SettingsTabId
  labelKey: string
  icon: LucideIcon
}[] = [
  { id: 'general', labelKey: 'settings.tabs.general', icon: User },
  { id: 'privacy', labelKey: 'settings.tabs.privacy', icon: Shield },
  { id: 'notifications', labelKey: 'settings.tabs.notifications', icon: Bell },
  { id: 'appearance', labelKey: 'settings.tabs.appearance', icon: Palette },
  { id: 'integrations', labelKey: 'settings.tabs.integrations', icon: Link2 },
  { id: 'data', labelKey: 'settings.tabs.data', icon: Database },
]
