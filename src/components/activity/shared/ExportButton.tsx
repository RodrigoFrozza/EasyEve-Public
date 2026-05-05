'use client'

import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ExportButtonProps {
  activity: any
  className?: string
  variant?: 'outline' | 'ghost' | 'default'
}

export function ExportButton({ activity, className, variant = 'outline' }: ExportButtonProps) {
  const handleExport = () => {
    try {
      const logs = (activity.data as any)?.logs || []
      if (logs.length === 0) {
        toast.error('No data to export')
        return
      }

      // Dynamic headers based on activity type
      let headers = ['Date', 'Character', 'Type', 'Value (ISK)']
      let csvRows = [headers.join(',')]

      for (const log of logs) {
        const dateStr = new Date(log.date).toISOString().replace(/T/, ' ').replace(/\..+/, '')
        const char = log.charName || log.characterName || 'Unknown'
        const type = log.type || log.siteName || 'Entry'
        const value = Math.round(log.amount || log.value || 0)
        
        csvRows.push(`${dateStr},${char},${type},${value}`)
      }

      const csvContent = csvRows.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${activity.type}_export_${activity.id}_${new Date().getTime()}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success('Export Successful')
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Export failed')
    }
  }

  return (
    <Button 
      variant={variant}
      size="sm"
      onClick={handleExport}
      className={cn("h-8 gap-2", className)}
    >
      <Download className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Export</span>
    </Button>
  )
}
