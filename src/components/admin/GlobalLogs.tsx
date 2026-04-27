'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, AlertTriangle, ShieldAlert, Info, Terminal, Copy, Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { FormattedDate } from '../shared/FormattedDate'

interface GlobalLog {
  id: string
  userId: string
  level: string
  message: string
  stack: string | null
  url: string | null
  userAgent: string | null
  createdAt: string
  user: {
    name: string | null
    accountCode: string | null
  }
}

const ITEMS_PER_PAGE = 10

export interface GlobalLogsProps {
  /** When false, stops the 30s polling interval (e.g. when another admin tab is active). */
  enablePolling?: boolean
}

export function GlobalLogs({ enablePolling = true }: GlobalLogsProps) {
  const { t } = useTranslations()
  const [logs, setLogs] = useState<GlobalLog[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [selectedLog, setSelectedLog] = useState<GlobalLog | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/admin/logs')
      if (res.ok) {
        const data = await res.json()
        setLogs(Array.isArray(data) ? data : [])
      } else {
        setFetchError(t('admin.logsFetchFailed') || 'Could not load system logs.')
        setLogs([])
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err)
      setFetchError(t('admin.logsFetchFailed') || 'Could not load system logs.')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    if (!enablePolling) return
    const interval = setInterval(() => {
      void fetchLogs()
    }, 30000)
    return () => clearInterval(interval)
  }, [enablePolling, fetchLogs])

  const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE)
  const paginatedLogs = useMemo(() => {
    const start = page * ITEMS_PER_PAGE
    return logs.slice(start, start + ITEMS_PER_PAGE)
  }, [logs, page])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('Failed to copy')
    }
  }

  const copyAllLogs = async () => {
    const text = logs.map(l => 
      `[${l.level.toUpperCase()}] ${new Date(l.createdAt).toLocaleString()}\n${l.message}\n${l.stack || ''}\n`
    ).join('\n---\n\n')
    await copyToClipboard(text)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Terminal className="h-5 w-5 text-red-500" />
            {t('global.systemErrors')}
          </h2>
          <p className="text-xs text-gray-500">{t('global.realTimeMonitoring')}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => void copyAllLogs()}
            variant="outline"
            size="sm"
            className="border-eve-border"
          >
            {copied ? <Check className="h-4 w-4 mr-1 text-green-400" /> : <Copy className="h-4 w-4 mr-1" />}
            Copy All
          </Button>
          <button 
            type="button"
            onClick={() => void fetchLogs()} 
            disabled={loading}
            aria-label={t('admin.logsRefresh') || 'Reload system logs'}
            className="p-2 rounded-lg bg-eve-panel border border-eve-border hover:bg-eve-dark transition-colors"
            title={t('admin.logsRefresh') || 'Reload logs now'}
          >
            <RefreshCw className={cn("h-4 w-4 text-gray-400", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {fetchError && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {fetchError}
        </div>
      )}

      <div className="grid gap-2">
        {loading && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-eve-panel rounded-xl border border-eve-border/30">
            <Loader2 className="h-8 w-8 animate-spin text-eve-accent mb-2" />
            <p className="text-gray-500 text-sm">{t('global.scanningLogs')}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-eve-panel rounded-xl border border-eve-border/30">
            <Info className="h-8 w-8 text-gray-600 mb-2" />
            <p className="text-gray-500 text-sm font-medium">{t('global.noErrorsFound')}</p>
            <p className="text-xs text-gray-600">{t('global.systemRunningSmoothly')}</p>
          </div>
        ) : (
          <>
            {paginatedLogs.map((log) => (
              <Dialog key={log.id}>
                <DialogTrigger asChild>
                  <Card className="bg-eve-panel border-eve-border hover:bg-eve-dark/30 transition-all group cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div 
                          className={cn(
                              "p-2 rounded-lg shrink-0",
                              log.level === 'error' ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500"
                          )}
                          title={log.level === 'error' ? "Critical Error" : "Warning/Alert"}
                        >
                          {log.level === 'error' ? <ShieldAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white uppercase tracking-tighter">
                                {log.user?.name || log.user?.accountCode || 'Unknown User'}
                              </span>
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 opacity-50 border-gray-700">
                                {log.user?.accountCode}
                              </Badge>
                            </div>
                            <span className="text-[10px] text-gray-500 font-medium">
                              <FormattedDate date={log.createdAt} />
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 font-medium line-clamp-1">{log.message}</p>
                          {log.url && <p className="text-[10px] text-gray-600 truncate mt-1">URL: {log.url}</p>}
                        </div>
                        <Copy 
                          className="h-4 w-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                          onClick={(e) => {
                            e.stopPropagation()
                            copyToClipboard(`${log.message}\n${log.stack || ''}`)
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-2xl bg-eve-panel border-eve-border text-white max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-bold",
                        log.level === 'error' ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
                      )}>
                        {log.level.toUpperCase()}
                      </span>
                      Error Details
                    </DialogTitle>
                    <DialogDescription className="text-xs text-gray-500 mt-1">
                      Detailed error information from the system
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Message</p>
                      <p className="text-white font-medium">{log.message}</p>
                    </div>
                    {log.stack && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Stack Trace</p>
                        <pre className="text-xs text-gray-400 bg-eve-dark p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                          {log.stack}
                        </pre>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">User</p>
                        <p className="text-white">{log.user?.name || log.user?.accountCode || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Date</p>
                        <p className="text-white"><FormattedDate date={log.createdAt} /></p>
                      </div>
                      {log.url && (
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500 uppercase mb-1">URL</p>
                          <p className="text-white text-xs">{log.url}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => copyToClipboard(`${log.message}\n${log.stack || ''}`)}
                      className="border-eve-border"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Raw
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-eve-border/20">
                <span className="text-xs text-gray-500">
                  Page {page + 1} of {totalPages} ({logs.length} errors)
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-eve-panel"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-eve-panel"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}