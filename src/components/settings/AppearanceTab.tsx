'use client'

import { useState } from 'react'
import { Palette, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'
import { useTheme, type AccentColor } from '../providers/theme-provider'
import { LanguageSelector } from './LanguageSelectorClient'
import { toast } from 'sonner'
import { SettingsSectionCard } from './SettingsSectionCard'

export function AppearanceTab() {
  const { t } = useTranslations()
  const { accentColor, setAccentColor } = useTheme()
  const [saving, setSaving] = useState(false)

  const colors: { id: AccentColor; hex: string; labelKey: string }[] = [
    { id: 'teal', hex: '#34b3a4', labelKey: 'settings.appearance.teal' },
    { id: 'cyan', hex: '#00d4ff', labelKey: 'settings.appearance.cyan' },
    { id: 'gold', hex: '#ffd700', labelKey: 'settings.appearance.gold' },
    { id: 'emerald', hex: '#10b981', labelKey: 'settings.appearance.emerald' },
    { id: 'rose', hex: '#f43f5e', labelKey: 'settings.appearance.rose' },
  ]

  const handleAccentChange = async (colorId: AccentColor) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accentColor: colorId }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success(t('settings.appearance.colorSaved'))
      setAccentColor(colorId)
    } catch {
      toast.error(t('settings.appearance.colorError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSectionCard
        title={t('settings.appearance.title')}
        description={t('settings.appearance.desc')}
        icon={Palette}
        contentClassName="space-y-8"
      >
        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">
            {t('settings.appearance.theme')}
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="group cursor-default">
              <div className="aspect-video overflow-hidden rounded-xl border-2 border-eve-accent/50 bg-eve-dark p-3 shadow-lg">
                <div className="flex h-full flex-col gap-2 rounded-lg border border-eve-border bg-eve-panel p-2">
                  <div className="h-2 w-1/2 rounded bg-eve-accent/20" />
                  <div className="h-2 w-full rounded bg-gray-800" />
                  <div className="h-2 w-3/4 rounded bg-gray-800" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-white">
                  {t('settings.appearance.darkEveStyle')}
                </span>
                <Badge className="bg-eve-accent px-2 py-0.5 text-[10px] font-bold tracking-wider text-black hover:bg-eve-accent">
                  {t('settings.appearance.selected')}
                </Badge>
              </div>
            </div>

            <div className="cursor-not-allowed opacity-40">
              <div className="aspect-video overflow-hidden rounded-xl border-2 border-transparent bg-gray-900 p-3 shadow-lg grayscale">
                <div className="flex h-full flex-col gap-2 rounded-lg border border-gray-700 bg-gray-800 p-2">
                  <div className="h-2 w-1/2 rounded bg-gray-700" />
                  <div className="h-2 w-full rounded bg-gray-700" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                  {t('settings.appearance.lightTheme')}
                </span>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {t('settings.comingSoon')}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t border-eve-border/50 pt-6">
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">
              {t('settings.appearance.accentColor')}
            </h4>
            <p className="mt-1 text-sm text-gray-400">{t('settings.appearance.accentDesc')}</p>
          </div>
          <div className="flex flex-wrap gap-6" role="list">
            {colors.map((color) => {
              const selected = accentColor === color.id
              return (
                <button
                  key={color.id}
                  type="button"
                  role="listitem"
                  onClick={() => handleAccentChange(color.id)}
                  disabled={saving}
                  aria-pressed={selected}
                  aria-label={t(color.labelKey)}
                  className={cn(
                    'group relative flex flex-col items-center gap-3 outline-none transition-all disabled:opacity-50',
                    'focus-visible:ring-2 focus-visible:ring-eve-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#03070c]',
                    selected ? 'scale-105' : 'hover:scale-105'
                  )}
                >
                  <div
                    className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border-2 shadow-xl transition-all"
                    style={{
                      backgroundColor: `${color.hex}15`,
                      borderColor: selected ? color.hex : 'transparent',
                    }}
                  >
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full shadow-lg transition-transform group-hover:rotate-6"
                      style={{ backgroundColor: color.hex }}
                    >
                      {selected && <Check className="h-4 w-4 stroke-[3px] text-black" />}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-widest transition-colors',
                      selected ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'
                    )}
                  >
                    {t(color.labelKey)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-4 border-t border-eve-border/50 pt-6">
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">
              {t('settings.appearance.language')}
            </h4>
            <p className="mt-1 text-sm text-gray-400">{t('settings.appearance.languageDesc')}</p>
          </div>
          <div className="max-w-xs">
            <LanguageSelector />
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  )
}
