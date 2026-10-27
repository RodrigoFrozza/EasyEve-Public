'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Loader2, 
  RefreshCw, 
  ShieldAlert, 
  ShieldCheck, 
  Shield, 
  Database, 
  Lock, 
  Activity, 
  Globe, 
  User,
  Terminal,
  ChevronRight,
  AlertTriangle,
  Zap,
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { FormattedDate } from '../shared/FormattedDate'
import { AdminBadge } from './shared/AdminBadge'
import { AdminTable } from './shared/AdminTable'
import { Button } from '@/components/ui/button'

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
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 })

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/security?page=${page}&limit=${pagination.limit}`)
      if (!res.ok) {
        setError('SEC_DATA_LINK_FAILURE')
        setEvents([])
        return
      }
      const data = await res.json()
      setEvents(data.events || [])
      setPagination({
        page: data?.pagination?.page || page,
        pages: data?.pagination?.pages || 1,
        total: data?.pagination?.total || 0,
        limit: data?.pagination?.limit || pagination.limit,
      })
    } catch (err) {
      console.error('Failed to fetch security events:', err)
      setError('SEC_FETCH_CRITICAL_ERROR')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [page, pagination.limit])

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

  const columns = [
    {
      key: 'event',
      header: 'Event Type',
      render: (event: SecurityEventRow) => {
        const isAlert = event.event.includes('UNAUTHORIZED') || event.event.includes('FAILED')
        return (
          <div className="flex flex-col py-1">
            <span className={cn(
              "text-xs font-bold tracking-tight",
              isAlert ? "text-destructive" : "text-foreground"
            )}>
              {event.event}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
               <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[200px]">
                 ID: {event.id.slice(0, 8)}...
               </span>
            </div>
          </div>
        )
      }
    },
    {
      key: 'subject',
      header: 'User / Source',
      render: (event: SecurityEventRow) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">
              {event.userId || 'Guest User'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-3 h-3 text-muted-foreground/60" />
            <span className="text-[10px] text-muted-foreground font-medium">
              {event.ipAddress?.trim() || 'Unknown IP'}
            </span>
          </div>
        </div>
      )
    },
    {
      key: 'path',
      header: 'Request Path',
      render: (event: SecurityEventRow) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 px-2 py-1 bg-muted/40 border border-border rounded-md">
            <Activity className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-foreground font-medium truncate max-w-[220px]">
              {event.path || '/ (Root)'}
            </span>
          </div>
          <span className="text-[9px] text-muted-foreground font-medium truncate max-w-[220px] ml-1">
            {event.userAgent ? event.userAgent.slice(0, 48) : 'No user agent'}
          </span>
        </div>
      )
    },
    {
      key: 'createdAt',
      header: 'Time',
      render: (event: SecurityEventRow) => (
        <div className="flex flex-col items-end gap-1">
           <span className="text-xs font-bold text-foreground">
             {new Date(event.createdAt).toLocaleTimeString()}
           </span>
           <span className="text-[10px] text-muted-foreground font-medium">
             <FormattedDate date={event.createdAt} />
           </span>
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Analysis',
      render: (event: SecurityEventRow) => {
        const detailsText = formatSecurityDetails(event.details)
        return (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all rounded-lg font-semibold gap-2"
              onClick={() => {
                if (detailsText) {
                  console.log('Event Details:', detailsText)
                  toast.info(`Details: ${event.event}`, {
                    description: (
                      <div className="mt-2 rounded-lg bg-card border border-border p-3">
                        <pre className="text-[10px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed">
                          {detailsText}
                        </pre>
                      </div>
                    )
                  })
                }
              }}
            >
              <Search className="w-3.5 h-3.5" />
              Analyze
            </Button>
          </div>
        )
      }
    }
  ]

  return (
    <div className="space-y-6 font-sans">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-card border border-border rounded-xl shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 flex items-center justify-center bg-primary/10 border border-primary/20 rounded-xl shadow-sm">
              <Shield className="h-6 w-6 text-primary" />
           </div>
           <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                Security Audit Log
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Monitoring system access and authentication events
              </p>
           </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="hidden sm:flex flex-col items-end gap-1 px-4 border-r border-border">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Live Protection</span>
              </div>
              <span className="text-xs text-muted-foreground font-medium">Policy Enforcement Active</span>
           </div>
           
           <Button
             size="sm"
             variant="outline"
             onClick={() => void fetchEvents()}
             disabled={loading}
             className="h-10 px-4 gap-2 border-border bg-background hover:bg-muted text-foreground transition-all rounded-lg font-semibold shadow-sm"
           >
             <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
             {loading ? 'Updating...' : 'Refresh Logs'}
           </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-4 bg-destructive/10 p-4 border border-destructive/20 rounded-xl">
           <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
           <div className="space-y-1">
              <span className="text-sm font-bold text-destructive">Data Sync Failure</span>
              <p className="text-sm text-destructive/80 leading-relaxed">
                Could not retrieve security records: {error}
              </p>
           </div>
        </div>
      )}

      {/* Main Stream */}
      <div className="relative">
         {loading && events.length === 0 ? (
           <div className="space-y-3">
             {[1, 2, 3, 4, 5].map((i) => (
               <div key={i} className="h-20 bg-muted/30 border border-border animate-pulse rounded-xl" />
             ))}
           </div>
         ) : events.length === 0 ? (
           <div className="py-32 bg-card border border-border rounded-xl flex flex-col items-center justify-center gap-4">
              <ShieldCheck className="h-16 w-16 text-muted-foreground/20" />
              <div className="text-center">
                 <p className="text-lg font-semibold text-foreground">No security events</p>
                 <p className="text-sm text-muted-foreground">Everything looks secure. No threats detected in the current buffer.</p>
              </div>
           </div>
         ) : (
           <div className="border border-border rounded-xl overflow-hidden shadow-sm">
             <AdminTable
               columns={columns}
               data={events}
               keyExtractor={(e) => e.id}
               emptyMessage="No security events found"
             />
           </div>
         )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-6">
           <div className="flex items-center gap-6">
              <div className="flex flex-col">
                 <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Total Records</span>
                 <span className="text-sm text-foreground font-semibold">{pagination.total} events logged</span>
              </div>
              <div className="w-[1px] h-8 bg-border" />
              <div className="flex flex-col">
                 <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Current View</span>
                 <span className="text-sm text-foreground font-semibold">Page {pagination.page} of {pagination.pages}</span>
              </div>
           </div>
           
           <div className="flex gap-2">
             <Button
               variant="outline"
               size="sm"
               disabled={page <= 1}
               onClick={() => setPage((prev) => Math.max(1, prev - 1))}
               className="h-9 px-4 border-border bg-background hover:bg-muted text-foreground transition-all rounded-lg font-semibold"
             >
               Previous
             </Button>
             <Button
               variant="outline"
               size="sm"
               disabled={page >= pagination.pages}
               onClick={() => setPage((prev) => Math.min(pagination.pages, prev + 1))}
               className="h-9 px-4 border-border bg-background hover:bg-muted text-foreground transition-all rounded-lg font-semibold"
             >
               Next
             </Button>
           </div>
        </div>
      )}
    </div>
  )
}
