'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { AccountTab } from './AccountTab'
import { PrivacyTab } from './PrivacyTab'
import { AppearanceTab } from './AppearanceTab'
import { NotificationsTab } from './NotificationsTab'
import { IntegrationsTab } from './IntegrationsTab'
import { DataManagement as DataTab } from './DataManagement'
import { SettingsNav } from './SettingsNav'
import { isValidSettingsTab, type SettingsIntegrationsMeta, type SettingsTabId, type SettingsUser } from './settings-types'

interface SettingsTabsProps {
  user: SettingsUser
  defaultTab: SettingsTabId
  integrations: SettingsIntegrationsMeta
}

function TabPanel({ tabId, activeTab, children }: { tabId: SettingsTabId; activeTab: SettingsTabId; children: ReactNode }) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return activeTab === tabId ? <div>{children}</div> : null
  }

  return (
    <AnimatePresence mode="wait">
      {activeTab === tabId && (
        <motion.div
          key={tabId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function SettingsTabs({ user, defaultTab, integrations }: SettingsTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<SettingsTabId>(defaultTab)

  const syncTabToUrl = useCallback(
    (tab: SettingsTabId) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', tab)
      router.replace(`/dashboard/settings?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (isValidSettingsTab(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [searchParams, activeTab])

  const handleTabChange = (value: string) => {
    if (!isValidSettingsTab(value)) return
    setActiveTab(value)
    syncTabToUrl(value)
  }

  const mainCharacter =
    user.characters.find((c) => c.isMain) ?? user.characters[0] ?? null

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <SettingsNav variant="mobile" activeTab={activeTab} />

      <div className="mt-4 flex flex-col gap-6 lg:mt-0 lg:flex-row lg:gap-8">
        <SettingsNav variant="sidebar" activeTab={activeTab} />

        <div className="min-w-0 flex-1">
          <TabsContent value="general" className="mt-0 border-none p-0 focus-visible:ring-0">
            <TabPanel tabId="general" activeTab={activeTab}>
              <AccountTab user={user} mainCharacter={mainCharacter} />
            </TabPanel>
          </TabsContent>

          <TabsContent value="privacy" className="mt-0 border-none p-0 focus-visible:ring-0">
            <TabPanel tabId="privacy" activeTab={activeTab}>
              <PrivacyTab />
            </TabPanel>
          </TabsContent>

          <TabsContent value="notifications" className="mt-0 border-none p-0 focus-visible:ring-0">
            <TabPanel tabId="notifications" activeTab={activeTab}>
              <NotificationsTab />
            </TabPanel>
          </TabsContent>

          <TabsContent value="appearance" className="mt-0 border-none p-0 focus-visible:ring-0">
            <TabPanel tabId="appearance" activeTab={activeTab}>
              <AppearanceTab />
            </TabPanel>
          </TabsContent>

          <TabsContent value="integrations" className="mt-0 border-none p-0 focus-visible:ring-0">
            <TabPanel tabId="integrations" activeTab={activeTab}>
              <IntegrationsTab integrations={integrations} />
            </TabPanel>
          </TabsContent>

          <TabsContent value="data" className="mt-0 border-none p-0 focus-visible:ring-0">
            <TabPanel tabId="data" activeTab={activeTab}>
              <DataTab />
            </TabPanel>
          </TabsContent>
        </div>
      </div>
    </Tabs>
  )
}
