'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Lock, Globe, Shield, Swords, Trophy, Users, Layout, Zap, MapPin, Ship, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'

export function PrivacyTab() {
  const { t } = useTranslations()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [settings, setSettings] = useState({
    isPublic: true,
    showKills: true,
    showDeaths: true,
    showReputation: true,
    showMedals: true,
    showActivities: true,
    showFits: true,
    showContacts: true,
    showLocation: false,
    showShip: false,
    showWallet: true,
  })

  useEffect(() => {
    fetch('/api/players/settings')
      .then(res => res.json())
      .then(data => {
        if (data) setSettings(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (key: keyof typeof settings, checked: boolean) => {
    setSaving(key)
    try {
      const newSettings = { ...settings, [key]: checked }
      const res = await fetch('/api/players/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      })
      
      if (res.ok) {
        setSettings(newSettings)
        toast.success(t('common.success'))
      } else {
        throw new Error('Failed to save')
      }
    } catch (err) {
      console.error(err)
      toast.error(t('settings.errorSaving'))
    } finally {
      setSaving(null)
    }
  }

  const sections = [
    { key: 'isPublic', icon: Globe, label: 'privacy.profilePublic', desc: 'privacy.profilePublicDesc', color: 'text-blue-500' },
    { key: 'showKills', icon: Swords, label: 'privacy.showKills', color: 'text-red-500' },
    { key: 'showDeaths', icon: Zap, label: 'privacy.showDeaths', color: 'text-orange-500' },
    { key: 'showReputation', icon: Shield, label: 'privacy.showReputation', color: 'text-green-500' },
    { key: 'showMedals', icon: Trophy, label: 'privacy.showMedals', color: 'text-yellow-500' },
    { key: 'showActivities', icon: Layout, label: 'privacy.showActivities', color: 'text-purple-500' },
    { key: 'showFits', icon: Layout, label: 'privacy.showFits', color: 'text-cyan-500' },
    { key: 'showContacts', icon: Users, label: 'privacy.showContacts', color: 'text-pink-500' },
    { key: 'showLocation', icon: MapPin, label: 'privacy.showLocation', color: 'text-emerald-500' },
    { key: 'showShip', icon: Zap, label: 'privacy.showShip', color: 'text-amber-500' },
    { key: 'showWallet', icon: Wallet, label: 'privacy.showWallet', color: 'text-green-400' },
  ]

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 bg-eve-panel/50 border border-eve-border rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-eve-panel/50 border-eve-border backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Lock className="h-5 w-5 text-eve-accent" />
            {t('settings.privacy.title')}
          </CardTitle>
          <CardDescription>{t('settings.privacy.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-eve-border/50">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <div key={section.key} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-white/5 ${section.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t(`settings.${section.label}`)}</p>
                    {section.desc && (
                      <p className="text-xs text-gray-500 mt-0.5">{t(`settings.${section.desc}`)}</p>
                    )}
                  </div>
                </div>
                <Switch 
                  checked={settings[section.key as keyof typeof settings]}
                  onCheckedChange={(checked) => handleToggle(section.key as keyof typeof settings, checked)}
                  disabled={saving === section.key}
                  className="data-[state=checked]:bg-eve-accent"
                />
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
