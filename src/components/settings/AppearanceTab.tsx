'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Palette, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'
import { useTheme, AccentColor } from '../providers/theme-provider'
import { LanguageSelector } from './LanguageSelectorClient'

export function AppearanceTab() {
  const { t } = useTranslations()
  const { accentColor, setAccentColor } = useTheme()

  const colors: { id: AccentColor; hex: string; label: string }[] = [
    { id: 'cyan', hex: '#00d4ff', label: 'settings.appearance.cyan' },
    { id: 'gold', hex: '#ffd700', label: 'settings.appearance.gold' },
    { id: 'emerald', hex: '#10b981', label: 'settings.appearance.emerald' },
    { id: 'rose', hex: '#f43f5e', label: 'settings.appearance.rose' },
  ]

  return (
    <div className="space-y-6">
      <Card className="bg-eve-panel/40 border-eve-border/50 backdrop-blur-xl shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2 text-xl font-bold tracking-tight">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            {t('settings.appearance.title')}
          </CardTitle>
          <CardDescription className="text-gray-400">{t('settings.appearance.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">{t('settings.appearance.theme')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative group cursor-pointer">
                <div className="aspect-video rounded-xl bg-eve-dark border-2 border-primary p-3 overflow-hidden shadow-lg transition-all group-hover:border-primary/80">
                  <div className="w-full h-full bg-eve-panel rounded-lg border border-eve-border flex flex-col gap-2 p-2">
                    <div className="h-2 w-1/2 bg-primary/20 rounded" />
                    <div className="h-2 w-full bg-gray-800 rounded" />
                    <div className="h-2 w-3/4 bg-gray-800 rounded" />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-white font-medium">{t('settings.appearance.darkEveStyle')}</span>
                  <Badge variant="success" className="bg-primary text-black hover:bg-primary font-bold px-2 py-0.5 text-[10px] tracking-wider">SELECTED</Badge>
                </div>
              </div>
              
              <div className="relative group cursor-not-allowed opacity-40">
                <div className="aspect-video rounded-xl bg-gray-900 border-2 border-transparent p-3 overflow-hidden shadow-lg grayscale">
                   <div className="w-full h-full bg-gray-800 rounded-lg border border-gray-700 flex flex-col gap-2 p-2">
                    <div className="h-2 w-1/2 bg-gray-700 rounded" />
                    <div className="h-2 w-full bg-gray-700 rounded" />
                   </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-gray-500 font-medium">Coming Soon</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-eve-border/50">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">{t('settings.appearance.accentColor')}</h4>
            <div className="flex flex-wrap gap-6">
              {colors.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setAccentColor(color.id)}
                  className={cn(
                    "group relative flex flex-col items-center gap-3 outline-none transition-all",
                    accentColor === color.id ? "scale-110" : "hover:scale-105"
                  )}
                >
                  <div 
                    className="h-14 w-14 rounded-2xl border-2 transition-all flex items-center justify-center shadow-xl overflow-hidden relative"
                    style={{ 
                      backgroundColor: `${color.hex}15`, 
                      borderColor: accentColor === color.id ? color.hex : 'transparent' 
                    }}
                  >
                    {/* Glossy overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                    
                    <div 
                      className="h-8 w-8 rounded-full shadow-lg flex items-center justify-center transition-transform group-hover:rotate-12"
                      style={{ backgroundColor: color.hex }}
                    >
                      {accentColor === color.id && <Check className="h-4 w-4 text-black stroke-[3px]" />}
                    </div>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest transition-colors",
                    accentColor === color.id ? "text-white" : "text-gray-500 group-hover:text-gray-300"
                  )}>
                    {t(color.label)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Language Section */}
          <div className="space-y-4 pt-6 border-t border-eve-border/50">
            <div className="flex flex-col gap-1">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">{t('settings.appearance.language')}</h4>
              <p className="text-sm text-gray-400">{t('settings.appearance.languageDesc')}</p>
            </div>
            <div className="max-w-xs">
              <LanguageSelector />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
