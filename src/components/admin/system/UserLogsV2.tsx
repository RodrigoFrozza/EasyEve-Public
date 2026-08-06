'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Terminal, AlertCircle, Clock, ChevronLeft, RefreshCw, ExternalLink, Hash, Info, Database, Shield, Activity, Search } from 'lucide-react'
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
        setFetchError('ERR_LOAD_FAILED_BUFFER_FAULT')
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err)
      setFetchError('ERR_NETWORK_OR_SYSTEM_FAULT')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <AdminPageContainer
      title={`USER_DIAG::${userName?.toUpperCase() || userId.toUpperCase()}`}
      description="ACCOUNT_TELEMETRY_AND_EVENT_TRACE_HISTORY"
      action={
        <div className="flex gap-1.5">
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchLogs} 
            disabled={loading}
            className="border-zinc-900 text-zinc-500 hover:text-zinc-100 h-8 rounded-none font-mono text-[10px] uppercase tracking-widest bg-zinc-950 transition-none"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <RefreshCw className="h-3 w-3 mr-2 text-emerald-500" />}
            RESCAN_BUFFER
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.back()} 
            className="border-zinc-900 text-zinc-500 hover:text-zinc-100 h-8 rounded-none font-mono text-[10px] uppercase tracking-widest bg-zinc-950 transition-none"
          >
            <ChevronLeft className="h-3 w-3 mr-1" />
            RETURN
          </Button>
        </div>
      }
    >
      <div className="space-y-6 font-mono">
        {fetchError && (
          <div className="p-4 bg-red-950/20 border border-red-900 rounded-none flex items-center justify-between gap-4 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black tracking-[0.2em] text-red-500 uppercase">CRITICAL_SYSTEM_ERROR</span>
                <span className="text-[9px] text-red-400/60 uppercase tracking-widest">{fetchError}</span>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={fetchLogs} 
              className="border-red-900 bg-red-950/30 text-red-400 h-7 rounded-none text-[9px] font-bold uppercase tracking-widest hover:bg-red-900 transition-none"
            >
              RETRY_PROTOCOL
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6 bg-zinc-950/30 border border-zinc-900 rounded-none relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-800 to-transparent animate-[shimmer_2s_infinite]" />
             <Activity className="h-10 w-10 animate-pulse text-zinc-800" />
             <div className="flex flex-col items-center gap-3">
               <div className="flex items-center gap-2">
                 <div className="w-1 h-1 bg-zinc-700 animate-bounce" />
                 <div className="w-1 h-1 bg-zinc-700 animate-bounce [animation-delay:0.2s]" />
                 <div className="w-1 h-1 bg-zinc-700 animate-bounce [animation-delay:0.4s]" />
               </div>
               <p className="text-[10px] text-zinc-500 uppercase tracking-[0.4em] font-black">SCANNING_REMOTE_NODE_TELEMETRY</p>
             </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-zinc-950/30 border border-zinc-900 rounded-none py-24 flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-zinc-900 border border-zinc-800 mb-6 relative">
               <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-zinc-600" />
               <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-zinc-600" />
               <Search className="w-6 h-6 text-zinc-700" />
            </div>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.4em]">NULL_EVENT_BUFFER</h3>
            <p className="text-[9px] text-zinc-700 max-w-xs mt-4 uppercase tracking-[0.2em] leading-relaxed">
              [ NO_TELEMETRY_RECORDS_REGISTERED_FOR_TARGET_IDENTIFIER ]
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {logs.map((log) => (
              <div key={log.id} className="relative bg-zinc-950 border border-zinc-900 rounded-none overflow-hidden transition-none group hover:border-zinc-700">
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-[2px]",
                  log.level === 'error' ? "bg-red-900 group-hover:bg-red-500" : "bg-zinc-800 group-hover:bg-zinc-400"
                )} />

                <div className="bg-zinc-900/30 py-3 px-5 flex flex-row items-center justify-between border-b border-zinc-900">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                       <div className={cn(
                         "w-1.5 h-1.5",
                         log.level === 'error' ? "bg-red-500" : "bg-zinc-600"
                       )} />
                       <span className={cn(
                         "text-[10px] font-black uppercase tracking-widest",
                         log.level === 'error' ? "text-red-500" : "text-zinc-500"
                       )}>
                         {log.level.toUpperCase()}
                       </span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-zinc-600 font-bold tracking-tighter uppercase">
                      <Clock className="w-3 h-3 text-zinc-700" />
                      <FormattedDate date={log.createdAt} />
                    </div>
                  </div>
                  {log.url && (
                    <div className="hidden sm:flex text-[9px] text-zinc-700 font-bold truncate max-w-xs items-center gap-2 px-2 py-0.5 bg-black/40 border border-zinc-900/50">
                      <Database className="w-2.5 h-2.5" />
                      {log.url.toUpperCase()}
                    </div>
                  )}
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="relative pl-4 border-l border-zinc-900">
                    <p className="text-[11px] text-zinc-300 leading-relaxed break-words tracking-tight uppercase font-bold italic">
                      {log.message}
                    </p>
                  </div>
                  
                  {log.stack && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <Terminal className="w-3.5 h-3.5 text-zinc-700" />
                           <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em]">TRACE_RECOVERY_PROTOCOL</span>
                         </div>
                         <div className="h-[1px] flex-1 bg-zinc-900/50 mx-4" />
                      </div>
                      <div className="text-[10px] text-zinc-500 bg-black/80 p-5 border border-zinc-900 overflow-x-auto whitespace-pre font-mono custom-scrollbar max-h-64 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                        {log.stack}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-zinc-900">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-zinc-700" />
                        <p className="text-[8px] uppercase font-black text-zinc-600 tracking-[0.3em]">USER_AGENT_SPEC</p>
                      </div>
                      <div className="text-[9px] text-zinc-500 leading-tight break-all font-bold bg-zinc-900/20 p-3 border border-zinc-900 tracking-tighter">
                        {log.userAgent || 'AGENT_IDENT_REDACTED'}
                      </div>
                    </div>
                    {log.context && Object.keys(log.context).length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Terminal className="w-3.5 h-3.5 text-zinc-700" />
                          <p className="text-[8px] uppercase font-black text-zinc-600 tracking-[0.3em]">CONTEXT_PAYLOAD_v2</p>
                        </div>
                        <div className="text-[9px] text-zinc-500 font-mono bg-zinc-900/20 p-3 border border-zinc-900 overflow-x-auto max-h-40 custom-scrollbar shadow-inner">
                          <pre className="tracking-tighter">
                            {JSON.stringify(log.context, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminPageContainer>
  )
}
