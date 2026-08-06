'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Download, Upload, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTranslations } from '@/i18n/hooks'
import { SettingsSectionCard } from './SettingsSectionCard'
import { cn } from '@/lib/utils'

function DataActionRow({
  icon: Icon,
  title,
  description,
  onClick,
  disabled,
  loading,
  variant = 'default',
}: {
  icon: typeof Download
  title: string
  description: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-all',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'danger'
          ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
          : 'border-eve-border bg-white/5 hover:bg-white/[0.08]'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          variant === 'danger' ? 'bg-red-500/10 text-red-400' : 'bg-eve-accent/10 text-eve-accent'
        )}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', variant === 'danger' ? 'text-red-300' : 'text-white')}>
          {title}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
    </button>
  )
}

export function DataManagement() {
  const { t } = useTranslations()
  const router = useRouter()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const response = await fetch('/api/account/data/export')
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `easyeve-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(t('settings.data.exportSuccess'))
    } catch (error) {
      toast.error(t('settings.data.exportError'))
      console.error(error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    const toastId = toast.loading(t('settings.data.importing'))

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const json = JSON.parse(e.target?.result as string)
          const response = await fetch('/api/account/data/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(json),
          })

          const result = await response.json()
          if (response.ok) {
            toast.success(result.message || t('settings.data.importSuccess'), { id: toastId })
            router.refresh()
          } else {
            toast.error(result.error || t('settings.data.importError'), { id: toastId })
          }
        } catch {
          toast.error(t('settings.data.importInvalidJson'), { id: toastId })
        }
      }
      reader.readAsText(file)
    } catch (error) {
      toast.error(t('settings.data.importReadError'), { id: toastId })
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAll = async () => {
    setIsDeleting(true)
    const toastId = toast.loading(t('settings.data.deleting'))

    try {
      const response = await fetch('/api/account/data/delete-all', {
        method: 'POST',
      })

      if (response.ok) {
        toast.success(t('settings.data.deleteSuccess'), { id: toastId })
        setShowDeleteConfirm(false)
        setDeleteConfirmText('')
        router.refresh()
      } else {
        const result = await response.json()
        toast.error(result.error || t('settings.data.deleteError'), { id: toastId })
      }
    } catch (error) {
      toast.error(t('settings.data.deleteError'), { id: toastId })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      <SettingsSectionCard
        title={t('settings.data.title')}
        description={t('settings.data.desc')}
        contentClassName="space-y-3"
      >
        <DataActionRow
          icon={Download}
          title={t('settings.data.exportTitle')}
          description={t('settings.data.exportDesc')}
          onClick={handleExport}
          loading={isExporting}
          disabled={isExporting}
        />
        <DataActionRow
          icon={Upload}
          title={t('settings.data.importTitle')}
          description={t('settings.data.importDesc')}
          onClick={handleImportClick}
          loading={isImporting}
          disabled={isImporting}
        />
      </SettingsSectionCard>

      <SettingsSectionCard
        title={t('settings.data.dangerTitle')}
        description={t('settings.data.dangerDesc')}
        icon={AlertTriangle}
        className="border-red-500/30 bg-red-500/5"
        contentClassName="space-y-3"
      >
        <DataActionRow
          icon={Trash2}
          title={t('settings.data.clearTitle')}
          description={t('settings.data.clearDesc')}
          onClick={() => setShowDeleteConfirm(true)}
          variant="danger"
        />
      </SettingsSectionCard>

      <Dialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          setShowDeleteConfirm(open)
          if (!open) setDeleteConfirmText('')
        }}
      >
        <DialogContent className="border border-eve-border bg-eve-panel">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {t('settings.data.confirmDelete')}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {t('settings.data.clearDataWarning')}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded border border-red-500/20 bg-red-500/10 p-3 text-xs italic text-red-400">
            {t('settings.data.clearDataWarning2')}
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-300">{t('settings.data.typeDeletePrompt')}</p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded border border-eve-border bg-eve-dark/50 p-2 text-white placeholder-gray-500 focus:border-red-500/50 focus:outline-none"
              aria-label={t('settings.data.typeDeletePrompt')}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => {
                setShowDeleteConfirm(false)
                setDeleteConfirmText('')
              }}
              disabled={isDeleting}
              className="text-gray-400 hover:text-white"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={isDeleting || deleteConfirmText !== 'DELETE'}
              className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('settings.data.yesDeleteAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
