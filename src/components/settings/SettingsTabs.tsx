'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AccountTab } from './AccountTab'
import { PrivacyTab } from './PrivacyTab'
import { AppearanceTab } from './AppearanceTab'
import { NotificationsTab } from './NotificationsTab'
import { IntegrationsTab } from './IntegrationsTab'
import { DataManagement as DataTab } from './DataManagement'
import { User, Shield, Bell, Palette, Link2, Database, Settings } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useMemo, memo } from 'react'

interface SettingsUser {
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

interface SettingsTabsProps {
  user: SettingsUser
}

const TABS_CONFIG = [
  { id: 'general', label: 'settings.tabs.general', icon: User },
  { id: 'privacy', label: 'settings.tabs.privacy', icon: Shield },
  { id: 'notifications', label: 'settings.tabs.notifications', icon: Bell },
  { id: 'appearance', label: 'settings.tabs.appearance', icon: Palette },
  { id: 'integrations', label: 'settings.tabs.integrations', icon: Link2 },
  { id: 'data', label: 'settings.tabs.data', icon: Database },
] as const

export function SettingsTabs({ user }: SettingsTabsProps) {
  const { t } = useTranslations()
  const [activeTab, setActiveTab] = useState('general')

  const tabs = useMemo(() => TABS_CONFIG, [])
  const translations = useMemo(() => ({
    general: t('settings.tabs.general'),
    privacy: t('settings.tabs.privacy'),
    notifications: t('settings.tabs.notifications'),
    appearance: t('settings.tabs.appearance'),
    integrations: t('settings.tabs.integrations'),
    data: t('settings.tabs.data'),
  }), [t])

  return (
    <Tabs defaultValue="general" className="w-full" onValueChange={setActiveTab}>
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar-like Tab List */}
        <aside className="lg:w-64 shrink-0">
          <div className="sticky top-24 space-y-2">
            <TabsList className="flex flex-col h-auto bg-transparent p-0 gap-1 w-full border-none">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="w-full justify-start gap-3 px-4 py-3 h-auto data-[state=active]:bg-eve-accent/10 data-[state=active]:text-eve-accent text-gray-400 hover:text-white transition-all border-none"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium text-sm">{translations[tab.id as keyof typeof translations]}</span>
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute left-0 w-1 h-6 bg-eve-accent rounded-r-full"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'general' && (
                <TabsContent value="general" className="mt-0 border-none p-0 focus-visible:ring-0">
                  <AccountTab 
                    user={user} 
                    mainCharacter={user.characters?.find((c: any) => c.isMain) || user.characters?.[0]} 
                  />
                </TabsContent>
              )}
              {activeTab === 'privacy' && (
                <TabsContent value="privacy" className="mt-0 border-none p-0 focus-visible:ring-0">
                  <PrivacyTab />
                </TabsContent>
              )}
              {activeTab === 'notifications' && (
                <TabsContent value="notifications" className="mt-0 border-none p-0 focus-visible:ring-0">
                  <NotificationsTab />
                </TabsContent>
              )}
              {activeTab === 'appearance' && (
                <TabsContent value="appearance" className="mt-0 border-none p-0 focus-visible:ring-0">
                  <AppearanceTab />
                </TabsContent>
              )}
              {activeTab === 'integrations' && (
                <TabsContent value="integrations" className="mt-0 border-none p-0 focus-visible:ring-0">
                  <IntegrationsTab />
                </TabsContent>
              )}
              {activeTab === 'data' && (
                <TabsContent value="data" className="mt-0 border-none p-0 focus-visible:ring-0">
                  <DataTab />
                </TabsContent>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Tabs>
  )
}
