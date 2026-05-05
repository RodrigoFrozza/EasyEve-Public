'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAdminScripts, useExecuteScript, useCancelScript, useScriptExecutions, useScriptExecution } from '@/lib/admin/hooks/useAdminScripts'
import type { Script, ScriptExecution } from '@/lib/admin/hooks/useAdminScripts'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Play, Clock, CheckCircle, XCircle, AlertTriangle, Shield, Terminal, History, X, Settings, Search, RefreshCw, Calendar } from 'lucide-react'
import { toast } from 'sonner'

const CATEGORIES = ['all', 'operations', 'security', 'wallet', 'database', 'fitting', 'custom']

interface ScriptManagerV2Props {
  onGoToSchedules?: () => void
}

export function ScriptManagerV2({ onGoToSchedules }: ScriptManagerV2Props) {
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
  const [selectedExecution, setSelectedExecution] = useState<ScriptExecution | null>(null)
  
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
        } as { scriptId: string; params?: Record<string, any>; dryRun?: boolean })
        setExecutionId((result as any).executionId)
        setShowOutput(true)
        toast.success(`Script started: ${script.name}`)
      } catch {
        toast.error('Failed to execute script')
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
      toast.success(`Script started: ${selectedScript.name}`)
    } catch {
      toast.error('Failed to execute script')
    }
  }

  const handleCancel = async (execId: string) => {
    try {
      await cancelMutation.mutateAsync(execId)
      toast.success('Script cancelled')
    } catch {
      toast.error('Failed to cancel script')
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'running') return { status: 'warning' as const, label: 'Running' }
    if (status === 'completed') return { status: 'success' as const, label: 'Completed' }
    if (status === 'failed') return { status: 'error' as const, label: 'Failed' }
    if (status === 'cancelled') return { status: 'default' as const, label: 'Cancelled' }
    if (status === 'idle') return { status: 'default' as const, label: 'Idle' }
    return { status: 'default' as const, label: status }
  }

  const lastRunBadge = (execStatus: string | null | undefined) => {
    if (!execStatus) return { status: 'default' as const, label: '' }
    if (execStatus === 'running' || execStatus === 'pending') return { status: 'warning' as const, label: execStatus }
    if (execStatus === 'completed') return { status: 'success' as const, label: 'completed' }
    if (execStatus === 'failed') return { status: 'error' as const, label: 'failed' }
    if (execStatus === 'cancelled') return { status: 'default' as const, label: 'cancelled' }
    return { status: 'default' as const, label: execStatus }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-40 bg-eve-panel/60 animate-pulse rounded-lg flex-1" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-eve-text/40" />
          <Input
            placeholder="Search scripts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 bg-eve-panel/60 border-eve-border/30"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 bg-eve-panel/60 border-eve-border/30">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setCategoryFilter('all')
            setSearchTerm('')
          }}
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      {/* Script Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredScripts.map((script: Script) => {
          const badge = getStatusBadge(script.status)
          const isRunning = script.status === 'running'
          return (
            <Card key={script.id} className="bg-eve-panel/60 border-eve-border/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-medium text-eve-text">{script.name}</CardTitle>
                  {script.dangerLevel === 'danger' && (
                    <AdminBadge status="error">Danger</AdminBadge>
                  )}
                  {script.dangerLevel === 'warning' && (
                    <AdminBadge status="warning">Warning</AdminBadge>
                  )}
                  {script.executionPolicy === 'elevated' && (
                    <AdminBadge status="info">Elevated</AdminBadge>
                  )}
                  {script.deprecated && (
                    <AdminBadge status="default">Deprecated</AdminBadge>
                  )}
                </div>
                <AdminBadge status={badge.status}>{badge.label}</AdminBadge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-eve-text/60 mb-3">{script.description}</p>
                
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-eve-text/40 space-y-1 min-w-0">
                    {script.lastRunAt ? (
                      <span className="flex flex-wrap items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>Last run: {new Date(script.lastRunAt).toLocaleString()}</span>
                        {script.lastExecutionStatus && (
                          <AdminBadge status={lastRunBadge(script.lastExecutionStatus).status}>
                            {lastRunBadge(script.lastExecutionStatus).label}
                          </AdminBadge>
                        )}
                      </span>
                    ) : (
                      <span>Never run</span>
                    )}
                    {script.lastSync && (
                      <div className="text-[10px] text-eve-text/30">
                        Last successful: {new Date(script.lastSync).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedScript(script)
                        setShowHistory(true)
                      }}
                      className="text-eve-text/60"
                      title="View history"
                    >
                      <History className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (onGoToSchedules) onGoToSchedules()
                        else
                          router.push(
                            `/dashboard/admin/system/schedules?scriptId=${encodeURIComponent(script.id)}`
                          )
                      }}
                      className="text-eve-text/60"
                      title="Manage schedules"
                    >
                      <Calendar className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleExecute(script)}
                      disabled={isRunning || executeMutation.isPending}
                      className="bg-eve-accent/20 text-eve-accent hover:bg-eve-accent/30"
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Run
                    </Button>
                  </div>
                </div>

                {script.schedule && (
                  <Link
                    href={`/dashboard/admin/system/schedules?scriptId=${encodeURIComponent(script.id)}`}
                    className="text-xs text-eve-accent/90 hover:text-eve-accent hover:underline mt-2 inline-flex items-center gap-1"
                  >
                    <Calendar className="w-3 h-3" />
                    Scheduled: {script.schedule}
                  </Link>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* No results */}
      {filteredScripts.length === 0 && (
        <AdminEmptyState
          icon={Terminal}
          title="No Scripts Found"
          description="Try adjusting your filters or search term."
        />
      )}

      {/* Parameters Dialog */}
      {showParams && selectedScript && (
        <Dialog open={showParams} onOpenChange={setShowParams}>
          <DialogContent className="bg-eve-panel border-eve-border/30 max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-eve-text">Configure: {selectedScript.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedScript.paramsSchema?.map((param: any) => (
                <div key={param.key}>
                  <label className="text-sm text-eve-text/60">
                    {param.label}
                    {param.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {param.description && (
                    <p className="text-xs text-eve-text/30 mb-1">{param.description}</p>
                  )}
                  {param.type === 'string' && (
                    <Input
                      value={paramValues[param.key] ?? param.defaultValue ?? ''}
                      onChange={(e) => setParamValues({ ...paramValues, [param.key]: e.target.value })}
                      placeholder={param.placeholder}
                      className="mt-1 bg-eve-background/50 border-eve-border/30"
                    />
                  )}
                  {param.type === 'number' && (
                    <Input
                      type="number"
                      value={paramValues[param.key] ?? param.defaultValue ?? ''}
                      onChange={(e) => setParamValues({ ...paramValues, [param.key]: parseFloat(e.target.value) })}
                      placeholder={param.placeholder}
                      className="mt-1 bg-eve-background/50 border-eve-border/30"
                    />
                  )}
                  {param.type === 'boolean' && (
                    <label className="flex items-center gap-2 mt-1">
                      <input
                        type="checkbox"
                        checked={paramValues[param.key] ?? param.defaultValue ?? false}
                        onChange={(e) => setParamValues({ ...paramValues, [param.key]: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm text-eve-text">{param.label}</span>
                    </label>
                  )}
                  {param.type === 'textarea' && (
                    <textarea
                      value={paramValues[param.key] ?? param.defaultValue ?? ''}
                      onChange={(e) => setParamValues({ ...paramValues, [param.key]: e.target.value })}
                      placeholder={param.placeholder}
                      rows={4}
                      className="mt-1 w-full p-2 bg-eve-background/50 border border-eve-border/30 rounded text-eve-text text-sm"
                    />
                  )}
                  {param.type === 'json' && (
                    <textarea
                      value={paramValues[param.key] ? JSON.stringify(paramValues[param.key], null, 2) : ''}
                      onChange={(e) => {
                        try {
                          setParamValues({ ...paramValues, [param.key]: JSON.parse(e.target.value) })
                        } catch {}
                      }}
                      placeholder="Enter valid JSON"
                      rows={4}
                      className="mt-1 w-full p-2 bg-eve-background/50 border border-eve-border/30 rounded font-mono text-xs text-eve-text"
                    />
                  )}
                </div>
              ))}

              {selectedScript.supportsDryRun && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-eve-text">Dry Run Mode</span>
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowParams(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteWithParams}
                disabled={executeMutation.isPending}
                className="bg-eve-accent/20 text-eve-accent"
              >
                {executeMutation.isPending ? 'Starting...' : 'Run Script'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Output Dialog */}
      {showOutput && currentExecution && (
        <Dialog open={showOutput} onOpenChange={setShowOutput}>
          <DialogContent className="bg-eve-panel border-eve-border/30 max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex items-center justify-between">
              <DialogTitle className="text-eve-text flex items-center gap-2">
                Execution Output
                <AdminBadge status={
                  currentExecution.status === 'running' ? 'warning' :
                  currentExecution.status === 'completed' ? 'success' :
                  currentExecution.status === 'failed' ? 'error' : 'default'
                }>
                  {currentExecution.status}
                </AdminBadge>
                {currentExecution.dryRun && (
                  <AdminBadge status="info">Dry Run</AdminBadge>
                )}
                {currentExecution.status === 'running' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleCancel(currentExecution.id)}
                    disabled={cancelMutation.isPending}
                  >
                    Cancel
                  </Button>
                )}
              </DialogTitle>
              <Button size="sm" variant="ghost" onClick={() => setShowOutput(false)}>
                <X className="w-4 h-4" />
              </Button>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Progress */}
              {currentExecution.progress && (currentExecution.progress as any)?.total > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-eve-text/60">
                    <span>Progress</span>
                    <span>
                      {(currentExecution.progress as any)?.processed || 0} / {(currentExecution.progress as any)?.total}
                    </span>
                  </div>
                  <div className="w-full bg-eve-background/50 rounded-full h-2">
                    <div
                      className="bg-eve-accent h-2 rounded-full transition-all"
                      style={{
                        width: `${((currentExecution.progress as any)?.processed || 0) / ((currentExecution.progress as any)?.total || 1) * 100}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Logs */}
              <div className="bg-black/30 rounded-md p-3 font-mono text-xs max-h-96 overflow-y-auto">
                {currentExecution.logs?.map((log: any, i: number) => (
                  <div
                    key={i}
                    className={
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warning' ? 'text-yellow-400' :
                      log.level === 'success' ? 'text-green-400' :
                      'text-eve-text/80'
                    }
                  >
                    [{log.level.toUpperCase()}] {log.message}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>

              {/* Error */}
              {currentExecution.error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  {currentExecution.error}
                </div>
              )}

              {/* Timing */}
              <div className="text-xs text-eve-text/40">
                {currentExecution.startedAt && (
                  <>Started: {new Date(currentExecution.startedAt).toLocaleString()}</>
                )}
                {currentExecution.completedAt && (
                  <>
                    {currentExecution.startedAt ? ' | ' : ''}
                    Completed: {new Date(currentExecution.completedAt).toLocaleString()}
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* History Dialog */}
      {showHistory && selectedScript && (
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="bg-eve-panel border-eve-border/30 max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-eve-text">Execution History: {selectedScript.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-4">
              {executions
                ?.filter((e: ScriptExecution) => e.scriptId === selectedScript.id)
                .slice(0, 10)
                .map((exec: ScriptExecution) => (
                  <div
                    key={exec.id}
                    className="flex items-center justify-between p-3 bg-eve-background/50 rounded cursor-pointer hover:bg-eve-background/70"
                    onClick={() => {
                      setSelectedExecution(exec)
                      setExecutionId(exec.id)
                      setShowOutput(true)
                      setShowHistory(false)
                    }}
                  >
                    <div>
                      <AdminBadge status={
                        exec.status === 'running' ? 'warning' :
                        exec.status === 'completed' ? 'success' :
                        exec.status === 'failed' ? 'error' : 'default'
                      }>
                        {exec.status}
                      </AdminBadge>
                      {exec.dryRun && <span className="text-xs text-eve-text/40 ml-2">Dry Run</span>}
                    </div>
                    <span className="text-xs text-eve-text/40">
                      {new Date(exec.startedAt || exec.createdAt || Date.now()).toLocaleString()}
                    </span>
                  </div>
                ))}
              {executions?.filter((e: ScriptExecution) => e.scriptId === selectedScript.id).length === 0 && (
                <p className="text-center text-sm text-eve-text/40 py-4">No execution history</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
