'use client'

import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslations } from '@/i18n/hooks'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { SETTINGS_TABS_CONFIG } from './settings-tabs-config'
import type { SettingsTabId } from './settings-types'

interface SettingsNavProps {
  activeTab: SettingsTabId
  variant: 'sidebar' | 'mobile'
}

export function SettingsNav({ activeTab, variant }: SettingsNavProps) {
  const { t } = useTranslations()
  const reduceMotion = useReducedMotion()

  if (variant === 'mobile') {
    return (
      <div className="sticky top-14 z-20 -mx-4 border-b border-eve-border/50 bg-[#03070c]/95 px-4 py-2 backdrop-blur md:top-0 lg:hidden">
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto border-none bg-transparent p-0 snap-x snap-mandatory scrollbar-none">
          {SETTINGS_TABS_CONFIG.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  'shrink-0 snap-start gap-1.5 rounded-full border border-eve-border/60 px-3 py-2 text-xs',
                  'data-[state=active]:border-eve-accent/40 data-[state=active]:bg-eve-accent/10 data-[state=active]:text-eve-accent',
                  'text-gray-400 hover:text-white'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap font-medium">{t(tab.labelKey)}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </div>
    )
  }

  return (
    <aside className="hidden shrink-0 lg:block lg:w-64">
      <div className="sticky top-24">
        <nav
          className="rounded-lg border border-eve-border bg-eve-panel/50 p-2"
          aria-label={t('settings.navAria')}
        >
          <TabsList className="flex h-auto w-full flex-col gap-1 border-none bg-transparent p-0">
            {SETTINGS_TABS_CONFIG.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    'relative w-full justify-start gap-3 rounded-md px-4 py-3 h-auto border-none',
                    'text-gray-400 transition-all hover:text-white',
                    'data-[state=active]:bg-eve-accent/10 data-[state=active]:text-eve-accent'
                  )}
                >
                  {!reduceMotion && isActive && (
                    <motion.div
                      layoutId="settingsActiveTabIndicator"
                      className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-eve-accent"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  {reduceMotion && isActive && (
                    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-eve-accent" />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-left text-sm font-medium">{t(tab.labelKey)}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </nav>
      </div>
    </aside>
  )
}
