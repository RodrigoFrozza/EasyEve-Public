'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Zap, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'

export function AutoTrackingToggle() {
  const { t } = useTranslations()
  const [isEnabled, setIsEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/players/settings')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.autoTrackingEnabled === 'boolean') {
          setIsEnabled(data.autoTrackingEnabled)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (checked: boolean) => {
    setSaving(true)
    try {
      const res = await fetch('/api/players/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoTrackingEnabled: checked }),
      })
      
      if (res.ok) {
        setIsEnabled(checked)
        toast.success(checked ? t('settings.autoTrackingEnabled') : t('settings.autoTrackingDisabled'))
      } else {
        throw new Error('Failed to save')
      }
    } catch (err) {
      console.error(err)
      toast.error(t('settings.errorSaving'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-eve-dark animate-pulse" />
          <div>
            <div className="h-4 w-32 bg-eve-dark rounded animate-pulse" />
            <div className="h-3 w-48 bg-eve-dark rounded animate-pulse mt-1" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        {isEnabled ? (
          <Sparkles className="h-5 w-5 text-eve-accent" />
        ) : (
          <Zap className="h-5 w-5 text-gray-500" />
        )}
        <div>
          <p className="text-sm font-medium text-white">
            {t('settings.autoTracking')}
          </p>
          <p className="text-xs text-gray-500">
            {t('settings.autoTrackingDesc')}
          </p>
        </div>
      </div>
      <Switch 
        checked={isEnabled}
        onCheckedChange={handleToggle}
        disabled={saving}
        className="data-[state=checked]:bg-eve-accent"
      />
    </div>
  )
}