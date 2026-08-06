'use client'

import { useTranslations } from '@/i18n/hooks'
import { Globe, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export function LanguageSelector() {
  const { t, locale, setLocale } = useTranslations()
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const languages = [
    { code: 'en', name: t('settings.appearance.english') },
    { code: 'pt-BR', name: t('settings.appearance.portuguese') },
    { code: 'zh', name: t('settings.appearance.chinese') },
    { code: 'ja', name: t('settings.appearance.japanese') },
    { code: 'ko', name: t('settings.appearance.korean') }
  ]

  const currentLang = languages.find(l => l.code === locale) || languages[0]

  const handleLanguageChange = async (langCode: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: langCode })
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success(t('settings.appearance.languageSaved'))
      setLocale(langCode)
    } catch {
      toast.error(t('settings.appearance.languageError'))
    } finally {
      setSaving(false)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={saving}
        className="flex items-center gap-2 w-full justify-between p-2 rounded-lg bg-eve-dark/50 border border-eve-border hover:border-gray-500 transition-colors disabled:opacity-50"
        aria-label={t('settings.appearance.language')}
      >
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-eve-accent" />
          <span className="text-sm text-white">{currentLang.name}</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-eve-panel border border-eve-border rounded-lg shadow-xl z-50 overflow-hidden">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              disabled={saving}
              className={`w-full p-2 text-left text-sm hover:bg-eve-dark/50 transition-colors ${
                lang.code === locale ? 'text-eve-accent bg-eve-dark/30' : 'text-gray-300'
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}