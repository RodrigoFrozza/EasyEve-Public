'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Globe, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'

interface ProfileSettings {
  isPublic: boolean
}

export function PrivacyToggle() {
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { t } = useTranslations()

  useEffect(() => {
    fetch('/api/players/settings')
      .then(res => res.json())
      .then(data => {
        setIsPublic(data.isPublic ?? true)
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
        body: JSON.stringify({ isPublic: checked }),
      })
      if (res.ok) {
        setIsPublic(checked)
        toast.success(checked ? t('settings.profileNowPublic') : t('settings.profileNowPrivate'))
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
          <div className="w-10 h-10 rounded-full bg-eve-dark animate-pulse" />
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
        {isPublic ? (
          <Globe className="h-5 w-5 text-green-500" />
        ) : (
          <Lock className="h-5 w-5 text-gray-500" />
        )}
        <div>
          <p className="text-sm font-medium text-white">
            {isPublic ? t('settings.profilePublic') : t('settings.profilePrivate')}
          </p>
          <p className="text-xs text-gray-500">
            {isPublic 
              ? t('settings.profilePublicDesc')
              : t('settings.profilePrivateDesc')
            }
          </p>
        </div>
      </div>
      <Switch 
        checked={isPublic}
        onCheckedChange={handleToggle}
        disabled={saving}
        className="data-[state=checked]:bg-green-500"
      />
    </div>
  )
}