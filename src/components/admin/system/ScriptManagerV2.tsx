'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAdminScripts, useExecuteScript, useCancelScript, useScriptExecutions, useScriptExecution } from '@/lib/admin/hooks/useAdminScripts'
import type { Script, ScriptExecution } from '@/lib/admin/hooks/useAdminScripts'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Play, Clock, Terminal, History, X, Settings, Search, RefreshCw, Calendar, TerminalSquare, Database, ShieldAlert, Zap, Command, ChevronRight, Activity, HardDrive } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { AdminToolbar } from '@/components/admin/shared/AdminToolbar'
import { Skeleton } from '@/components/ui/skeleton'

const CATEGORIES = ['all', 'operations', 'security', 'wallet', 'database', 'fitting', 'custom']

interface ScriptManagerV2Props {
  onGoToSchedules?: () => void
}

export function ScriptManagerV2({ onGoToSchedules }: ScriptManagerV2Props) {
  const { t } = useTranslations()
  const router = useRouter()
  const { data: scripts, isLoading } = useAdminScripts()
  const executeMutation = useExecuteScript()
  const cancelMutation = useCancelScript()
  const { data: executions } = useScriptExecutions(50)
  
  const [selectedScript, setSelectedScript] = useState<Script | null>(null)
  const [showParams, setShowParams] = useState(false)
  const [paramValues, setParamValues] = useState<Record<string, any>>({})
  const [dryRun, setDryRun] = useState(false)
  const [showOutput, setShowOutput] = useState(false)
  const [executionId, setExecutionId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  const { data: currentExecution } = useScriptExecution(showOutput ? executionId : null)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logEndRef.current && currentExecution?.logs?.length) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [currentExecution?.logs])

  const filteredScripts = (scripts || []).filter(script => {
    if (categoryFilter !== 'all' && script.category !== categoryFilter) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return (
        script.id.toLowerCase().includes(term) ||
        script.name.toLowerCase().includes(term) ||
        script.description.toLowerCase().includes(term)
      )
    }
    return true
  })

  const handleExecute = async (script: Script) => {
    if (script.paramsSchema && script.paramsSchema.length > 0) {
      setSelectedScript(script)
      setShowParams(true)
      setParamValues({})
      setDryRun(false)
    } else {
      try {
        const result = await executeMutation.mutateAsync({ 
          scriptId: script.id, 
          params: {}, 
          dryRun: false 
        } as any)
        setExecutionId((result as any).executionId)
        setShowOutput(true)
        toast.success(t('admin.scripts.started', { name: script.name }))
      } catch {
        toast.error(t('admin.scripts.startError'))
      }
    }
  }

  const handleExecuteWithParams = async () => {
    if (!selectedScript) return
    try {
      const result = await executeMutation.mutateAsync({
        scriptId: selectedScript.id,
        params: paramValues,
        dryRun
      })
      setShowParams(false)
      setExecutionId(result.executionId)
      setShowOutput(true)
      toast.success(t('admin.scripts.started', { name: selectedScript.name }))
    } catch {
      toast.error(t('admin.scripts.startError'))
    }
  }

  const handleCancel = async (execId: string) => {
    try {
      await cancelMutation.mutateAsync(execId)
      toast.success(t('admin.scripts.cancelled'))
    } catch {
      toast.error(t('admin.scripts.cancelError'))
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'running') return { status: 'warning' as const, label: status }
    if (status === 'completed') return { status: 'success' as const, label: status }
    if (status === 'failed') return { status: 'error' as const, label: status }
    if (status === 'cancelled') return { status: 'default' as const, label: status }
    if (status === 'idle') return { status: 'default' as const, label: status }
    return { status: 'default' as const, label: status }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <AdminToolbar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('admin.searchPlaceholder')}
        actions={
          <>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder={t('admin.filterAll')} />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat === 'all' ? t('admin.filterAll') : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => {
                setCategoryFilter('all')
                setSearchTerm('')
              }}
            >
              <RefreshCw className="h-4 w-4" />
              {t('admin.scripts.reset')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {filteredScripts.map((script: Script) => {
          const badge = getStatusBadge(script.status)
          const isRunning = script.status === 'running'
          return (
            <div
              key={script.id}
              className="rounded-lg border border-border bg-card flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-border flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{script.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {script.dangerLevel === 'danger' && (
                    <span className="text-xs text-destructive font-medium">
                      {t('admin.scripts.danger')}
                    </span>
                  )}
                  <AdminBadge status={badge.status}>{badge.label}</AdminBadge>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col gap-4">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {script.description}
                </p>
                <p className="text-xs text-muted-foreground font-mono">{script.id}</p>

                <div className="mt-auto pt-3 border-t border-border flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {script.lastRunAt
                      ? new Date(script.lastRunAt).toLocaleString()
                      : t('admin.scripts.noHistory')}
                  </span>

                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => {
                        setSelectedScript(script)
                        setShowHistory(true)
                      }}
                      title={t('admin.scripts.history')}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => {
                        if (onGoToSchedules) onGoToSchedules()
                        else
                          router.push(
                            `/dashboard/admin/system/schedules?scriptId=${encodeURIComponent(script.id)}`
                          )
                      }}
                      title={t('admin.scripts.schedule')}
                    >
                      <Calendar className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleExecute(script)}
                      disabled={isRunning || executeMutation.isPending}
                    >
                      <Command className="h-4 w-4 mr-2" />
                      {t('admin.scripts.run')}
                    </Button>
                  </div>
                </div>

                {script.schedule && (
                  <Link
                    href={`/dashboard/admin/system/schedules?scriptId=${encodeURIComponent(script.id)}`}
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <Zap className="h-3 w-3" />
                    {script.schedule}
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* No results */}
      {filteredScripts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-border text-muted-foreground">
          <HardDrive className="h-10 w-10 mb-3 opacity-50" />
          <p className="text-sm">{t('admin.scripts.empty')}</p>
        </div>
      )}

      {/* Parameters Dialog */}
      {showParams && selectedScript && (
        <Dialog open={showParams} onOpenChange={setShowParams}>
          <DialogContent className="bg-black border-zinc-900 p-0 overflow-hidden sm:max-w-[640px] font-mono rounded-none shadow-2xl">
            <div className="p-10 space-y-10">
              <DialogHeader className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-zinc-900 border border-zinc-800">
                    <Settings className="w-4 h-4 text-zinc-500" />
                  </div>
                  <DialogTitle className="text-[14px] font-black text-zinc-100 uppercase tracking-[0.4em]">
                    INVOCATION_PARAMETERS
                  </DialogTitle>
                </div>
                <div className="flex items-center gap-3 px-4 py-2 bg-zinc-950 border border-zinc-900">
                   <div className="w-1.5 h-1.5 bg-zinc-800 animate-pulse" />
                   <span className="text-[9px] text-zinc-500 font-black tracking-widest uppercase">TARGET_MANIFEST: {selectedScript.id.toUpperCase()}</span>
                </div>
              </DialogHeader>

              <div className="space-y-10 max-h-[55vh] overflow-y-auto pr-6 custom-scrollbar">
                {selectedScript.paramsSchema?.map((param: any) => (
                  <div key={param.key} className="space-y-4 relative pl-6 border-l border-zinc-900">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black text-zinc-200 uppercase tracking-[0.2em]">
                        {param.label}
                        {param.required && <span className="text-red-600 ml-1 font-black">!</span>}
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] text-zinc-700 font-black uppercase tracking-widest px-2 py-0.5 border border-zinc-900 bg-black">TYPE::{param.type}</span>
                      </div>
                    </div>
                    {param.description && (
                      <p className="text-[9px] text-zinc-600 uppercase tracking-widest leading-relaxed font-bold italic">{param.description}</p>
                    )}
                    
                    {param.type === 'string' && (
                      <Input
                        value={paramValues[param.key] ?? param.defaultValue ?? ''}
                        onChange={(e) => setParamValues({ ...paramValues, [param.key]: e.target.value })}
                        placeholder={param.placeholder || "AWAITING_INPUT_STREAM..."}
                        className="h-10 bg-zinc-950 border-zinc-900 text-[11px] font-black uppercase tracking-tighter rounded-none focus-visible:ring-1 focus-visible:ring-zinc-700 placeholder:text-zinc-800 transition-none"
                      />
                    )}
                    {param.type === 'number' && (
                      <Input
                        type="number"
                        value={paramValues[param.key] ?? param.defaultValue ?? ''}
                        onChange={(e) => setParamValues({ ...paramValues, [param.key]: parseFloat(e.target.value) })}
                        placeholder={param.placeholder || "VALUE_INT_FLOAT..."}
                        className="h-10 bg-zinc-950 border-zinc-900 text-[11px] font-black tracking-tighter rounded-none focus-visible:ring-1 focus-visible:ring-zinc-700 placeholder:text-zinc-800 transition-none"
                      />
                    )}
                    {param.type === 'boolean' && (
                      <div className="flex items-center gap-4 p-5 bg-zinc-950 border border-zinc-900 rounded-none group hover:border-zinc-800 transition-none cursor-pointer" onClick={() => setParamValues({ ...paramValues, [param.key]: !(paramValues[param.key] ?? param.defaultValue ?? false) })}>
                        <input
                          type="checkbox"
                          readOnly
                          checked={paramValues[param.key] ?? param.defaultValue ?? false}
                          className="w-4 h-4 rounded-none border-zinc-800 bg-black text-zinc-400 focus:ring-0 focus:ring-offset-0 pointer-events-none"
                        />
                        <div className="flex flex-col gap-0.5">
                           <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">TOGGLE_STATE</span>
                           <span className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest">CURRENT: {(paramValues[param.key] ?? param.defaultValue ?? false) ? 'ENABLED' : 'DISABLED'}</span>
                        </div>
                      </div>
                    )}
                    {(param.type === 'textarea' || param.type === 'json') && (
                      <div className="relative">
                         <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black border border-zinc-900 text-[8px] text-zinc-800 font-black uppercase tracking-widest z-10">CODE_INPUT</div>
                         <textarea
                          value={param.type === 'json' ? (paramValues[param.key] ? JSON.stringify(paramValues[param.key], null, 2) : '') : (paramValues[param.key] ?? param.defaultValue ?? '')}
                          onChange={(e) => {
                            if (param.type === 'json') {
                              try {
                                setParamValues({ ...paramValues, [param.key]: JSON.parse(e.target.value) })
                              } catch {}
                            } else {
                              setParamValues({ ...paramValues, [param.key]: e.target.value })
                            }
                          }}
                          placeholder={param.placeholder || (param.type === 'json' ? "LOAD_JSON_BLOB..." : "LOAD_PLAINTEXT_BLOB...")}
                          rows={8}
                          className="w-full p-5 bg-zinc-950 border border-zinc-900 rounded-none text-[11px] font-bold text-zinc-400 placeholder:text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-700 transition-none shadow-inner resize-none"
                        />
                      </div>
                    )}
                  </div>
                ))}

                {selectedScript.supportsDryRun && (
                  <div className="flex items-center gap-5 p-6 bg-red-950/10 border border-red-900/40 rounded-none cursor-pointer group" onClick={() => setDryRun(!dryRun)}>
                    <input
                      type="checkbox"
                      readOnly
                      checked={dryRun}
                      className={cn(
                        "w-5 h-5 rounded-none border-red-900 bg-black focus:ring-0 focus:ring-offset-0 transition-all pointer-events-none",
                        dryRun ? "text-red-600" : "text-zinc-900"
                      )}
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-black text-red-500 uppercase tracking-[0.2em]">DRY_RUN_ENFORCEMENT</span>
                      <span className="text-[9px] text-red-400/50 uppercase tracking-widest font-black italic">PREVENT_PERMANENT_DATABASE_MUTATION</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 bg-zinc-950 border-t border-zinc-900 flex justify-end gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowParams(false)}
                className="h-11 px-8 text-zinc-600 border-zinc-900 bg-black hover:text-zinc-100 hover:border-zinc-700 transition-none rounded-none uppercase text-[10px] font-black tracking-[0.3em]"
              >
                ABORT_OP
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteWithParams}
                disabled={executeMutation.isPending}
                className="h-11 px-12 bg-zinc-100 text-black border border-white hover:bg-white transition-none rounded-none uppercase text-[10px] font-black tracking-[0.4em] shadow-[0_0_15px_rgba(255,255,255,0.1)]"
              >
                {executeMutation.isPending ? 'DEPLOYING...' : 'COMMIT_TASK'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Output Dialog */}
      {showOutput && currentExecution && (
        <Dialog open={showOutput} onOpenChange={setShowOutput}>
          <DialogContent className="bg-black border-zinc-900 p-0 overflow-hidden sm:max-w-6xl h-[90vh] flex flex-col font-mono rounded-none shadow-2xl">
            <div className="p-4 bg-zinc-900/50 border-b border-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3 px-3 py-1 bg-black border border-zinc-800">
                   <Terminal className="w-4 h-4 text-emerald-500 animate-pulse" />
                   <span className="text-[12px] font-black text-zinc-100 uppercase tracking-[0.3em]">CORE_TELEMETRY_LINK</span>
                </div>
                <div className="flex gap-2">
                  <AdminBadge status={
                    currentExecution.status === 'running' ? 'warning' :
                    currentExecution.status === 'completed' ? 'success' :
                    currentExecution.status === 'failed' ? 'error' : 'default'
                  }>
                    {currentExecution.status.toUpperCase()}
                  </AdminBadge>
                  {currentExecution.dryRun && (
                    <div className="text-[9px] font-black text-amber-500 border border-amber-900 px-2 py-0.5 bg-amber-950/20 tracking-widest uppercase">DRY_RUN_VECTOR</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {currentExecution.status === 'running' && (
                  <Button
                    size="sm"
                    className="h-9 px-6 bg-red-950/30 text-red-500 border border-red-900/50 hover:bg-red-600 hover:text-white transition-none rounded-none uppercase text-[10px] font-black tracking-[0.3em]"
                    onClick={() => handleCancel(currentExecution.id)}
                    disabled={cancelMutation.isPending}
                  >
                    KILL_PROCESS
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setShowOutput(false)}
                  className="h-9 w-9 p-0 border-zinc-800 text-zinc-500 hover:text-zinc-100 transition-none rounded-none"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-10 bg-black custom-scrollbar">
              {/* Progress */}
              {currentExecution.progress && (currentExecution.progress as any)?.total > 0 && (
                <div className="space-y-4 p-6 bg-zinc-950 border border-zinc-900 rounded-none relative">
                  <div className="absolute top-0 right-6 -translate-y-1/2 px-3 bg-black border border-zinc-900 text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em]">
                    EXECUTION_PROGRESS
                  </div>
                  <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.3em]">
                    <span className="text-zinc-700 italic">TRANSMITTING_PACKETS...</span>
                    <span className="text-zinc-200">
                      {(currentExecution.progress as any)?.processed || 0} / {(currentExecution.progress as any)?.total} REQS
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-none h-1.5 overflow-hidden shadow-inner">
                    <div
                      className="bg-zinc-400 h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                      style={{
                        width: `${((currentExecution.progress as any)?.processed || 0) / ((currentExecution.progress as any)?.total || 1) * 100}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Logs */}
              <div className="relative">
                <div className="absolute top-0 right-8 -translate-y-1/2 px-4 bg-black text-[10px] font-black text-zinc-700 uppercase tracking-[0.4em] z-10 border border-zinc-900">
                  REALTIME_STDOUT_STREAM
                </div>
                <div className="bg-zinc-950 border border-zinc-900 rounded-none p-8 font-mono text-[12px] leading-relaxed h-[500px] overflow-y-auto custom-scrollbar shadow-[inset_0_5px_30px_rgba(0,0,0,0.8)]">
                  {currentExecution.logs?.length ? (
                    currentExecution.logs.map((log: any, i: number) => (
                      <div
                        key={i}
                        className={cn(
                          "flex gap-6 py-1.5 border-b border-zinc-900/50 last:border-0 group",
                          log.level === 'error' ? 'text-red-500 font-black' :
                          log.level === 'warning' ? 'text-amber-500 font-bold' :
                          log.level === 'success' ? 'text-emerald-500 font-bold' :
                          'text-zinc-500'
                        )}
                      >
                        <span className="opacity-10 shrink-0 select-none w-12 font-black italic">#{i.toString().padStart(3, '0')}</span>
                        <span className="w-24 shrink-0 font-black tracking-widest text-[10px]">[{log.level.toUpperCase()}]</span>
                        <span className="break-all tracking-tight font-bold italic">{log.message}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                       <Activity className="w-8 h-8 text-zinc-900 animate-pulse" />
                       <div className="text-zinc-900 font-black uppercase tracking-[0.5em] animate-pulse">AWAITING_BUFFER_HANDSHAKE...</div>
                    </div>
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>

              {/* Error Block */}
              {currentExecution.error && (
                <div className="bg-red-950/10 border border-red-900 rounded-none p-6 flex gap-6 items-start shadow-xl">
                  <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-1" />
                  <div className="space-y-4 flex-1">
                     <div className="flex items-center gap-2">
                        <span className="text-[12px] font-black text-red-500 uppercase tracking-[0.4em]">CRITICAL_EXECUTION_EXCEPTION</span>
                        <div className="h-[1px] flex-1 bg-red-900/30" />
                     </div>
                     <div className="text-[13px] text-red-400 font-bold font-mono leading-relaxed bg-black p-5 border border-red-900/50 shadow-inner italic">
                       {currentExecution.error}
                     </div>
                  </div>
                </div>
              )}

              {/* Metrics Summary */}
              <div className="grid grid-cols-2 gap-6">
                 <div className="p-5 bg-zinc-950 border border-zinc-900 rounded-none flex flex-col gap-3 group hover:border-zinc-700 transition-none">
                    <span className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.3em]">TIMESTAMP_INITIALIZED</span>
                    <div className="flex items-center gap-3">
                       <div className="w-1.5 h-1.5 bg-zinc-800" />
                       <span className="text-[12px] text-zinc-400 font-black italic tracking-widest uppercase">
                          {currentExecution.startedAt ? new Date(currentExecution.startedAt).toLocaleString().toUpperCase() : 'NULL_STATE'}
                       </span>
                    </div>
                 </div>
                 <div className="p-5 bg-zinc-950 border border-zinc-900 rounded-none flex flex-col gap-3 group hover:border-zinc-700 transition-none">
                    <span className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.3em]">TIMESTAMP_TERMINATED</span>
                    <div className="flex items-center gap-3">
                       <div className="w-1.5 h-1.5 bg-zinc-800" />
                       <span className="text-[12px] text-zinc-400 font-black italic tracking-widest uppercase">
                          {currentExecution.completedAt ? new Date(currentExecution.completedAt).toLocaleString().toUpperCase() : 'PENDING_FINALIZATION'}
                       </span>
                    </div>
                 </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* History Dialog */}
      {showHistory && selectedScript && (
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="bg-black border-zinc-900 p-0 overflow-hidden sm:max-w-4xl h-[85vh] flex flex-col font-mono rounded-none shadow-2xl">
            <div className="p-6 bg-zinc-900/50 border-b border-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <History className="w-4 h-4 text-zinc-500" />
                 <span className="text-[13px] font-black text-zinc-100 uppercase tracking-[0.4em]">EXECUTION_REGISTRY_LOG</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-1.5 bg-black border border-zinc-800">
                <span className="text-[10px] text-zinc-700 uppercase font-black tracking-widest">MANIFEST:</span>
                <span className="text-[11px] text-zinc-200 font-black tracking-widest italic">{selectedScript.id.toUpperCase()}</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-4 bg-black custom-scrollbar">
              {executions
                ?.filter((e: ScriptExecution) => e.scriptId === selectedScript.id)
                .slice(0, 30)
                .map((exec: ScriptExecution) => (
                  <div
                    key={exec.id}
                    className="flex items-center justify-between p-5 bg-zinc-950 border border-zinc-900 rounded-none cursor-pointer hover:bg-zinc-900 hover:border-zinc-600 transition-none group relative overflow-hidden"
                    onClick={() => {
                      setExecutionId(exec.id)
                      setShowOutput(true)
                      setShowHistory(false)
                    }}
                  >
                    <div className="absolute top-0 left-0 w-[2px] h-full bg-zinc-900 group-hover:bg-zinc-500 transition-colors" />
                    
                    <div className="flex items-center gap-10">
                      <AdminBadge status={
                        exec.status === 'running' ? 'warning' :
                        exec.status === 'completed' ? 'success' :
                        exec.status === 'failed' ? 'error' : 'default'
                      }>
                        {exec.status.toUpperCase()}
                      </AdminBadge>
                      <div className="flex flex-col gap-1.5">
                         <span className="text-[12px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-zinc-100 transition-none italic">
                            {new Date(exec.startedAt || exec.createdAt || Date.now()).toLocaleString().toUpperCase()}
                         </span>
                         <div className="flex items-center gap-3">
                            <span className="text-[9px] text-zinc-700 font-black tracking-widest uppercase">ID::{exec.id.slice(0, 12).toUpperCase()}...</span>
                            {exec.dryRun && <span className="text-[8px] text-amber-500 font-black uppercase tracking-widest border border-amber-900/50 px-2 bg-amber-950/10">DRY_RUN</span>}
                         </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-none transform translate-x-4 group-hover:translate-x-0">
                       <span className="text-[10px] text-zinc-400 uppercase tracking-[0.2em] font-black">RECALL_OUTPUT</span>
                       <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </div>
                  </div>
                ))}
              {executions?.filter((e: ScriptExecution) => e.scriptId === selectedScript.id).length === 0 && (
                <div className="flex flex-col items-center justify-center py-40 gap-8">
                   <div className="p-6 bg-zinc-900/20 border border-zinc-900 rounded-none relative">
                      <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-zinc-700" />
                      <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-zinc-700" />
                      <Database className="w-12 h-12 text-zinc-900" />
                   </div>
                   <span className="text-[12px] font-black text-zinc-900 uppercase tracking-[0.6em]">RECORDS_NOT_FOUND</span>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
