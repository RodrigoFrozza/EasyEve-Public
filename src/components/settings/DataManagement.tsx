'use client'

import { useState, useRef } from 'react'
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

export function DataManagement() {
  const { t } = useTranslations()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
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
      
      toast.success('Data exported successfully')
    } catch (error) {
      toast.error('Failed to export data')
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
    const toastId = toast.loading('Importing data...')

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const json = JSON.parse(e.target?.result as string)
          const response = await fetch('/api/account/data/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(json)
          })

          const result = await response.json()
          if (response.ok) {
            toast.success(result.message, { id: toastId })
            // Refresh the page to show new data
            window.location.reload()
          } else {
            toast.error(result.error || 'Import failed', { id: toastId })
          }
        } catch (err) {
          toast.error('Invalid JSON file', { id: toastId })
        }
      }
      reader.readAsText(file)
    } catch (error) {
      toast.error('Failed to read file', { id: toastId })
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAll = async () => {
    setIsDeleting(true)
    const toastId = toast.loading('Deleting all data...')
    try {
      const response = await fetch('/api/account/data/delete-all', {
        method: 'POST'
      })
      
      if (response.ok) {
        toast.success('All data has been wiped', { id: toastId })
        setShowDeleteConfirm(false)
        window.location.reload()
      } else {
        const result = await response.json()
        toast.error(result.error || 'Deletion failed', { id: toastId })
      }
    } catch (error) {
      toast.error('Failed to delete data', { id: toastId })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      <Button 
        variant="outline" 
        className="w-full justify-start border-eve-border gap-2"
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {t('settings.exportData')}
      </Button>

      <Button 
        variant="outline" 
        className="w-full justify-start border-eve-border gap-2"
        onClick={handleImportClick}
        disabled={isImporting}
      >
        {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {t('settings.importData')}
      </Button>

      <Button 
        variant="outline" 
        className="w-full justify-start border-red-500/50 text-red-500 hover:bg-red-500/10 gap-2"
        onClick={() => setShowDeleteConfirm(true)}
      >
        <Trash2 className="h-4 w-4" />
        {t('settings.clearData')}
      </Button>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-eve-panel border-eve-border border-red-500/20">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {t('settings.confirmDelete')}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {t('settings.clearDataWarning')}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-500/10 border border-red-500/20 rounded p-3 text-red-400 text-xs italic">
            {t('settings.clearDataWarning2')}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="ghost" 
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              className="text-gray-400 hover:text-white"
            >
              {t('common.cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAll}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('settings.yesDeleteAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
