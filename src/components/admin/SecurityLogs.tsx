'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, ShieldAlert, ShieldCheck, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { FormattedDate } from '../shared/FormattedDate'

/** Matches Prisma/API `SecurityEvent` — `details` is JSON, not a string. */
export interface SecurityEventRow {
  id: string
  userId: string | null
  event: string
  details: unknown | null
  ipAddress: string | null
  path?: string | null
  userAgent: string | null
  createdAt: string
}

function formatSecurityDetails(details: unknown | null): string {
  if (details == null) return ''
  if (typeof details === 'string') return details.trim()
  if (typeof details === 'number' || typeof details === 'boolean') return String(details)
  try {
    return JSON.stringify(details, null, 2)
  } catch {
    return String(details)
  }
}

export interface SecurityLogsProps {
  /** When false, stops the 30s polling interval (e.g. when another admin tab is active). */
  enablePolling?: boolean
}

export function SecurityLogs({ enablePolling = true }: SecurityLogsProps) {
  const { t } = useTranslations()
  const [events, setEvents] = useState<SecurityEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/security')
      if (!res.ok) {
        setError(t('admin.securityFetchFailed') || 'Could not load security events.')
        setEvents([])
        return
      }
      const data = await res.json()
      setEvents(data.events || [])
    } catch (err) {
      console.error('Failed to fetch security events:', err)
      setError(t('admin.securityFetchFailed') || 'Could not load security events.')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  useEffect(() => {
    if (!enablePolling) return
    const interval = setInterval(() => {
      void fetchEvents()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchEvents, enablePolling])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-eve-accent" />
            {t('admin.securityLogs') || 'Security Audit Logs'}
          </h2>
          <p className="text-xs text-gray-500">
            {t('admin.securityLogsDesc') || 'Monitoring access attempts and security events'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchEvents()}
          disabled={loading}
          aria-label={t('admin.securityRefresh') || 'Refresh security events'}
          className="p-2 rounded-lg bg-eve-panel border border-eve-border hover:bg-eve-dark transition-colors"
        >
          <RefreshCw className={cn('h-4 w-4 text-gray-400', loading && 'animate-spin')} />
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {loading && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-eve-panel rounded-xl border border-eve-border/30">
            <Loader2 className="h-8 w-8 animate-spin text-eve-accent mb-2" />
            <p className="text-gray-500 text-sm">{t('global.loadingSecurityEvents')}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-eve-panel rounded-xl border border-eve-border/30">
            <ShieldCheck className="h-8 w-8 text-green-500/50 mb-2" />
            <p className="text-gray-500 text-sm font-medium">{t('global.noSecurityEventsFound')}</p>
            <p className="text-xs text-gray-600">{t('global.allSystemsSecure')}</p>
          </div>
        ) : (
          events.map((event) => {
            const detailsText = formatSecurityDetails(event.details)
            const ipLabel = event.ipAddress?.trim() || 'Unknown IP'

            return (
              <Card
                key={event.id}
                className="bg-eve-panel border-eve-border/30 hover:bg-eve-dark/30 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "p-2 rounded-lg shrink-0",
                        event.event.includes('UNAUTHORIZED') || event.event.includes('FAILED') 
                          ? "bg-red-500/10 text-red-500" 
                          : "bg-yellow-500/10 text-yellow-500"
                      )}>
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white uppercase tracking-tight">
                            {event.event}
                          </span>
                          <Badge variant="outline" className="text-[10px] h-4 border-eve-border bg-eve-dark/50">
                            {ipLabel}
                          </Badge>
                          {event.path ? (
                            <Badge variant="outline" className="text-[10px] h-4 max-w-[200px] truncate border-eve-border/80">
                              {event.path}
                            </Badge>
                          ) : null}
                        </div>
                        {detailsText ? (
                          <pre className="text-xs text-gray-400 mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono rounded-md bg-black/20 p-2 border border-eve-border/40">
                            {detailsText}
                          </pre>
                        ) : (
                          <p className="text-xs text-gray-500 mt-1">No additional details provided</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-gray-500 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-eve-border/50">
                      <div className="flex items-center gap-1.5 min-w-[120px]">
                        <span className="text-[10px] font-medium truncate max-w-[120px]">
                          {event.userId || 'Guest'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-[140px] border-l border-eve-border/50 pl-4">
                        <span className="text-[10px] font-medium whitespace-nowrap">
                          <FormattedDate date={event.createdAt} />
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
