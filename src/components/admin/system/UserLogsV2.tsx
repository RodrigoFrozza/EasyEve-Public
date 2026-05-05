'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Terminal, AlertCircle, Clock, ChevronLeft, RefreshCw, ExternalLink } from 'lucide-react'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { cn } from '@/lib/utils'

interface LogEntry {
  id: string
  level: string
  message: string
  stack?: string
  url?: string
  userAgent?: string
  context: any
  createdAt: string
}

interface UserLogsV2Props {
  userId: string
  userName?: string
}

export function UserLogsV2({ userId, userName }: UserLogsV2Props) {
  const router = useRouter()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/admin/logs/${userId}`)
      if (res.ok) {
        setLogs(await res.json())
      } else {
        setFetchError('Could not load user logs.')
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err)
      setFetchError('Could not load user logs.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <AdminPageContainer
      title={`User Logs: ${userName || userId}`}
      description="Detailed error and activity history for this account"
      action={
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchLogs} 
            disabled={loading}
            className="border-eve-border/30 text-eve-text/60 hover:text-eve-text h-9"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.back()} 
            className="text-eve-text/40 hover:text-eve-text h-9"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {fetchError && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-sm text-red-100">{fetchError}</p>
            </div>
            <Button size="sm" variant="outline" onClick={fetchLogs} className="border-red-400/40 text-red-100 h-8">
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-eve-accent" />
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-eve-panel/40 border border-dashed border-eve-border/30 rounded-2xl py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-eve-panel/60 flex items-center justify-center mb-4">
              <Terminal className="w-8 h-8 text-eve-text/20" />
            </div>
            <h3 className="text-lg font-bold text-eve-text">No Errors Logged</h3>
            <p className="text-sm text-eve-text/40 max-w-xs mt-2">
              This user has not encountered any logged system errors in the last 7 days.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {logs.map((log) => (
              <Card key={log.id} className="bg-eve-panel/40 border-eve-border/30 overflow-hidden backdrop-blur-md transition-all hover:border-eve-border/60 group">
                <CardHeader className="bg-white/5 py-3 px-5 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <Badge className={cn(
                      "border-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      log.level === 'error' ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
                    )}>
                      {log.level}
                    </Badge>
                    <span className="text-[11px] text-eve-text/40 font-mono flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <FormattedDate date={log.createdAt} />
                    </span>
                  </div>
                  {log.url && (
                    <div className="text-[10px] text-eve-text/40 font-mono truncate max-w-sm flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="w-3 h-3" />
                      {log.url}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <p className="text-eve-text font-medium leading-relaxed">{log.message}</p>
                  
                  {log.stack && (
                    <div className="relative group/stack">
                      <div className="absolute top-2 right-2 opacity-0 group-hover/stack:opacity-100 transition-opacity">
                        <Badge variant="outline" className="bg-black/60 text-[10px] border-eve-border/30">Stack Trace</Badge>
                      </div>
                      <div className="text-[11px] font-mono text-eve-text/60 bg-black/40 p-4 rounded-xl border border-eve-border/30 overflow-x-auto whitespace-pre scrollbar-thin scrollbar-thumb-white/10">
                        {log.stack}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-eve-border/10">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-eve-text/20 mb-2 tracking-widest">Environment</p>
                      <p className="text-[11px] text-eve-text/60 leading-relaxed break-all font-mono bg-black/20 p-2 rounded-lg border border-eve-border/10">
                        {log.userAgent || 'Unknown User Agent'}
                      </p>
                    </div>
                    {log.context && Object.keys(log.context).length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase font-bold text-eve-text/20 mb-2 tracking-widest">Context</p>
                        <pre className="text-[11px] text-eve-text/60 font-mono bg-black/20 p-2 rounded-lg border border-eve-border/10 overflow-x-auto">
                          {JSON.stringify(log.context, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminPageContainer>
  )
}
