'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Loader2, Play, Terminal, Trash2, History, ShieldAlert, Wrench, Square, CheckSquare, SquareIcon, XCircle, Plus, Clock, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

type ScriptCategory =
  | 'sde'
  | 'fitting'
  | 'wallet'
  | 'characters'
  | 'operations'
  | 'database'
  | 'security'
  | 'custom'

const CATEGORY_LABELS: Record<ScriptCategory, string> = {
  sde: 'SDE',
  fitting: 'Fitting',
  wallet: 'Wallet',
  characters: 'Characters',
  operations: 'Operations',
  database: 'Database',
  security: 'Security',
  custom: 'Custom',
}

interface ScriptParamDefinition {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'json' | 'textarea'
  required?: boolean
  defaultValue?: string | number | boolean
  placeholder?: string
  description?: string
}

interface Script {
  id: string
  name: string
  description: string
  category: ScriptCategory
  dangerLevel: 'safe' | 'warning' | 'danger'
  deprecated?: boolean
  deprecatedReason?: string | null
  paramsSchema?: ScriptParamDefinition[]
  supportsDryRun?: boolean
  executionPolicy?: 'standard' | 'elevated'
  lastSync?: string | Date | null
}

interface CustomScriptMemo {
  id: string
  name: string
  description?: string | null
  code: string
  args: Record<string, unknown>
  isShared: boolean
  userId: string
  updatedAt: string | Date
}

interface ScriptLog {
  timestamp: string
  level: 'info' | 'success' | 'error' | 'warning'
  message: string
}

interface ScriptExecution {
  id: string
  scriptId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  logs: ScriptLog[]
  progress: Record<string, any>
  params?: Record<string, unknown>
  dryRun?: boolean
}

// Schedule form component
function ScheduleForm({ 
  scripts, 
  schedule, 
  onSubmit, 
  onCancel 
}: { 
  scripts: Script[]
  schedule: ScriptSchedule | null
  onSubmit: (data: Partial<ScriptSchedule>) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(schedule?.name || '')
  const [scriptId, setScriptId] = useState(schedule?.scriptId || '')
  const [interval, setInterval] = useState(schedule?.interval || 'custom')
  const [cron, setCron] = useState(schedule?.cron || '')
  const [dryRun, setDryRun] = useState(schedule?.dryRun || false)
  const [active, setActive] = useState(schedule?.active ?? true)
  const [loading, setLoading] = useState(false)
  
  // Time fields for more control
  const [hour, setHour] = useState(schedule?.cron ? parseInt(schedule.cron.split(' ')[1] || '0') : 0)
  const [minute, setMinute] = useState(schedule?.cron ? parseInt(schedule.cron.split(' ')[0] || '0') : 0)

  const selectedScript = scripts.find(s => s.id === scriptId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Build CRON expression based on interval
    let cronExpr = cron
    if (interval !== 'custom') {
      const minuteStr = minute.toString().padStart(2, '0')
      const hourStr = hour.toString().padStart(2, '0')
      
      switch (interval) {
        case '15m':
          cronExpr = `*/15 * * * *`
          break
        case 'hourly':
          cronExpr = `${minuteStr} * * * *`
          break
        case 'daily':
          cronExpr = `${minuteStr} ${hourStr} * * *`
          break
        case 'weekly':
          cronExpr = `${minuteStr} ${hourStr} * * 1`
          break
        case 'monthly':
          cronExpr = `${minuteStr} ${hourStr} 1 * *`
          break
      }

    }
    
    await onSubmit({
      name,
      scriptId,
      interval: interval === 'custom' ? null : (interval || null),
      cron: cronExpr || null,
      dryRun,
      active,
    })
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label>Schedule Name</Label>
        <Input 
          value={name} 
          onChange={e => setName(e.target.value)} 
          placeholder="My daily sync"
          required
          className="bg-eve-dark border-eve-border"
        />
      </div>

      <div className="grid gap-2">
        <Label>Script</Label>
        <Select value={scriptId} onValueChange={setScriptId} required>
          <SelectTrigger className="bg-eve-dark border-eve-border">
            <SelectValue placeholder="Select a script" />
          </SelectTrigger>
          <SelectContent>
            {scripts.map(script => (
              <SelectItem key={script.id} value={script.id}>
                {script.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {selectedScript && (
          <div className="mt-2 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className="text-xs font-medium text-cyan-400 mb-1">{selectedScript.name}</div>
            <div className="text-xs text-gray-400">{selectedScript.description}</div>
            {selectedScript.category && (
              <div className="mt-2">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">Category:</span>
                <span className="ml-2 text-[10px] text-zinc-400">{selectedScript.category}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Frequency</Label>
        <Select value={interval} onValueChange={setInterval}>
          <SelectTrigger className="bg-eve-dark border-eve-border">
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">Custom CRON</SelectItem>
            <SelectItem value="15m">Every 15 Minutes</SelectItem>
            <SelectItem value="hourly">Every Hour</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>

        </Select>
      </div>

      {interval !== 'custom' && interval !== 'hourly' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Hour (0-23)</Label>
            <Input 
              type="number"
              min={0}
              max={23}
              value={hour} 
              onChange={e => setHour(parseInt(e.target.value) || 0)} 
              className="bg-eve-dark border-eve-border"
            />
          </div>
          <div className="grid gap-2">
            <Label>Minute (0-59)</Label>
            <Input 
              type="number"
              min={0}
              max={59}
              value={minute} 
              onChange={e => setMinute(parseInt(e.target.value) || 0)} 
              className="bg-eve-dark border-eve-border"
            />
          </div>
        </div>
      )}

      {interval === 'hourly' && (
        <div className="grid gap-2">
          <Label>Minute (0-59)</Label>
          <Input 
            type="number"
            min={0}
            max={59}
            value={minute} 
            onChange={e => setMinute(parseInt(e.target.value) || 0)} 
            className="bg-eve-dark border-eve-border w-32"
          />
          <p className="text-[10px] text-gray-500">Script will run at minute X of every hour</p>
        </div>
      )}

      {interval === 'custom' && (
        <div className="grid gap-2">
          <Label>CRON Expression</Label>
          <Input 
            value={cron} 
            onChange={e => setCron(e.target.value)} 
            placeholder="0 0 * * *"
            className="bg-eve-dark border-eve-border font-mono"
          />
          <p className="text-[10px] text-gray-500">Format: minute hour day month weekday</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label>Dry Run</Label>
        <Switch checked={dryRun} onCheckedChange={setDryRun} />
      </div>

      <div className="flex items-center justify-between">
        <Label>Active</Label>
        <Switch checked={active} onCheckedChange={setActive} />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="bg-eve-accent text-black">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {schedule ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  )
}
interface ScriptSchedule {
  id: string
  scriptId: string
  name: string
  cron: string | null
  interval: string | null
  params: Record<string, unknown> | null
  dryRun: boolean
  lastRunAt: Date | null
  nextRunAt: Date | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const STORAGE_KEY = 'currentExecutionId'

// Multi-script execution state
interface RunningScript {
  scriptId: string
  scriptName: string
  executionId: string | null
  status: 'pending' | 'running' | 'completed' | 'failed'
  logs: ScriptLog[]
  progress: number
  startedAt: Date | null
  elapsedTime: number
  error?: string
}

export interface ScriptRunnerProps {
  /** When false, pauses background script list refresh (tab not visible). Execution polling still runs if a script is running. */
  isTabActive?: boolean
}

export function ScriptRunner({ isTabActive = true }: ScriptRunnerProps) {
  const [scripts, setScripts] = useState<Script[]>([])
  const [selectedScript, setSelectedScript] = useState<Script | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<ScriptCategory | 'all'>('all')
  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState<ScriptLog[]>([])
  const [dryRun, setDryRun] = useState(false)
  const [paramsForm, setParamsForm] = useState<Record<string, unknown>>({})
  const [customMemoName, setCustomMemoName] = useState('custom-memo')
  const [customMemoCode, setCustomMemoCode] = useState(
    "addLog('info', 'Custom script started');\nconst total = await prisma.shipStats.count();\naddLog('success', `shipStats=${total}`)"
  )
  const [customMemoArgs, setCustomMemoArgs] = useState('{}')
  const [customMemos, setCustomMemos] = useState<CustomScriptMemo[]>([])
  const [selectedMemoId, setSelectedMemoId] = useState<string>('')
  const [progress, setProgress] = useState<ScriptExecution['progress'] | null>(null)
  const [executionId, setExecutionId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<ScriptExecution[]>([])
  const [selectedHistoryExecution, setSelectedHistoryExecution] = useState<ScriptExecution | null>(null)
  const [loadingScripts, setLoadingScripts] = useState(true)
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set())
  const [elapsedTime, setElapsedTime] = useState<number>(0)
  const [selectionMode, setSelectionMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Multi-script execution state
  const [runningScripts, setRunningScripts] = useState<RunningScript[]>([])
  const [activeLogTab, setActiveLogTab] = useState<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const pollInterval = useRef<NodeJS.Timeout | null>(null)
  const scriptsRefreshInterval = useRef<NodeJS.Timeout | null>(null)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  // Polling refs for multi-script execution
  const multiPollIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const multiTimerIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  
  // Schedule state
  const [showSchedules, setShowSchedules] = useState(false)
  const [schedules, setSchedules] = useState<ScriptSchedule[]>([])
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScriptSchedule | null>(null)
  const [scheduleFilter, setScheduleFilter] = useState<string>('all')
  const [runningSchedules, setRunningSchedules] = useState<Set<string>>(new Set())

  const fetchScripts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/scripts')
      if (res.ok) {
        const data = await res.json()
        setScripts(data.scripts || [])
      } else {
        console.error('Failed to fetch scripts:', res.status, res.statusText)
        setScripts([])
      }
    } catch (e) {
      console.error('Scripts fetch error:', e)
      setScripts([])
    } finally {
      setLoadingScripts(false)
    }
  }, [])

  const fetchExecution = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/scripts/execute?executionId=${id}`)
      if (res.ok) {
        const data = await res.json()
        const execution = data.execution as ScriptExecution
        
        if (execution) {
          setLogs(execution.logs || [])
          setProgress(execution.progress || null)
          
          const running = execution.status === 'running' || execution.status === 'pending'
          setIsRunning(running)
          
          if (running) {
            // Restore startedAt from execution if not set
            if (!startedAt && execution.startedAt) {
              setStartedAt(new Date(execution.startedAt))
            }
          } else {
            localStorage.removeItem(STORAGE_KEY)
            setStartedAt(null)
            setElapsedTime(0)
            void fetchScripts()
          }
          
          return data
        }
      } else if (res.status === 404) {
        setIsRunning(false)
        localStorage.removeItem(STORAGE_KEY)
        setStartedAt(null)
        setElapsedTime(0)
      }
    } catch (e) {
      console.error('Fetch execution error:', e)
    }
    return null
  }, [startedAt])

  // Polling function for multi-script execution
  const startPollingForScript = useCallback((executionId: string, scriptId: string) => {
    const poll = () => {
      fetch(`/api/admin/scripts/execute?executionId=${executionId}`)
        .then(res => res.json())
        .then(data => {
          const execution = data.execution as ScriptExecution
          if (execution) {
            setRunningScripts(prev => prev.map(script => {
              if (script.scriptId === scriptId) {
                const isRunning = execution.status === 'running' || execution.status === 'pending'
                return {
                  ...script,
                  status: isRunning ? 'running' : execution.status === 'completed' ? 'completed' : 'failed',
                  logs: execution.logs || [],
                  progress: execution.progress?.processed || 0,
                }
              }
              return script
            }))
            
            // Stop polling if completed
            if (execution.status !== 'running' && execution.status !== 'pending') {
              const interval = multiPollIntervals.current.get(scriptId)
              if (interval) {
                clearInterval(interval)
                multiPollIntervals.current.delete(scriptId)
              }
              const timerInterval = multiTimerIntervals.current.get(scriptId)
              if (timerInterval) {
                clearInterval(timerInterval)
                multiTimerIntervals.current.delete(scriptId)
              }
              
              localStorage.setItem('runningScripts', JSON.stringify(
                runningScripts.map(s => s.scriptId === scriptId ? { ...s, status: execution.status === 'completed' ? 'completed' : 'failed' } : s)
              ))
              void fetchScripts()
            }
          }
        })
        .catch(console.error)
    }
    
    poll()
    const interval = setInterval(poll, 2000)
    multiPollIntervals.current.set(scriptId, interval)
    
    // Timer for this script
    setRunningScripts(prev => prev.map(s => s.scriptId === scriptId ? { ...s, startedAt: new Date() } : s))
    const timerInterval = setInterval(() => {
      setRunningScripts(prev => prev.map(script => {
        if (script.scriptId === scriptId && script.startedAt) {
          return { ...script, elapsedTime: Math.floor((Date.now() - script.startedAt.getTime()) / 1000) }
        }
        return script
      }))
    }, 1000)
    multiTimerIntervals.current.set(scriptId, timerInterval)
  }, [runningScripts])

  const stopPollingForScript = useCallback((scriptId: string) => {
    const pollInterval = multiPollIntervals.current.get(scriptId)
    if (pollInterval) {
      clearInterval(pollInterval)
      multiPollIntervals.current.delete(scriptId)
    }
    const timerInterval = multiTimerIntervals.current.get(scriptId)
    if (timerInterval) {
      clearInterval(timerInterval)
      multiTimerIntervals.current.delete(scriptId)
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/scripts/execute?limit=10')
      if (res.ok) {
        const data = await res.json()
        setHistory(data.executions || [])
      }
    } catch (e) {
      console.error('History fetch error:', e)
    }
  }, [])

  const fetchMemos = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/scripts/memos')
      if (res.ok) {
        const data = await res.json()
        setCustomMemos(data.memos || [])
      }
    } catch (e) {
      console.error('Memo fetch error:', e)
    }
  }, [])

  // Schedule functions
  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/scripts/schedules')
      if (res.ok) {
        const data = await res.json()
        setSchedules(data || [])
      }
    } catch (e) {
      console.error('Schedule fetch error:', e)
    }
  }, [])

  const runScheduleNow = useCallback(async (scheduleId: string, scriptId: string) => {
    if (runningSchedules.has(scheduleId)) return
    
    setRunningSchedules(prev => new Set(prev).add(scheduleId))
    try {
      const res = await fetch('/api/admin/scripts/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId, dryRun: false })
      })
      if (res.ok) {
        const data = await res.json()
        console.log(`Schedule "${scriptId}" triggered manually (execution: ${data.executionId})`)
        await fetchSchedules()
      } else {
        console.error('Failed to run schedule:', await res.text())
      }
    } catch (e) {
      console.error('Error running schedule:', e)
    } finally {
      setRunningSchedules(prev => {
        const next = new Set(prev)
        next.delete(scheduleId)
        return next
      })
    }
  }, [runningSchedules, fetchSchedules])

  // Load scripts / history when tab is active; pause list refresh when inactive
  useEffect(() => {
    if (!isTabActive) {
      if (scriptsRefreshInterval.current) {
        clearInterval(scriptsRefreshInterval.current)
        scriptsRefreshInterval.current = null
      }
      return
    }

    void fetchScripts()
    void fetchHistory()
    void fetchMemos()
    void fetchSchedules()

    // Restore single execution state
    const savedId = localStorage.getItem(STORAGE_KEY)
    if (savedId) {
      setExecutionId(savedId)
      fetchExecution(savedId).then(data => {
        if (data?.execution?.status === 'running') {
          setIsRunning(true)
          setStartedAt(new Date(data.execution.startedAt))
        }
      })
    }

    // Restore multi-script execution state
    const savedMultiScripts = localStorage.getItem('runningScripts')
    if (savedMultiScripts) {
      try {
        const parsed = JSON.parse(savedMultiScripts) as RunningScript[]
        if (parsed.length > 0) {
          setRunningScripts(parsed)
          // Restore active tab
          const running = parsed.find(s => s.status === 'running')
          if (running) {
            setActiveLogTab(running.scriptId)
            // Start polling for running scripts
            parsed.forEach(script => {
              if (script.status === 'running' && script.executionId) {
                startPollingForScript(script.executionId, script.scriptId)
              }
            })
          }
        }
      } catch (e) {
        console.error('Failed to restore multi-script state:', e)
      }
    }

    scriptsRefreshInterval.current = setInterval(() => {
      void fetchScripts()
    }, 30000)

    return () => {
      if (scriptsRefreshInterval.current) {
        clearInterval(scriptsRefreshInterval.current)
        scriptsRefreshInterval.current = null
      }
    }
  }, [isTabActive, fetchScripts, fetchHistory, fetchMemos, fetchSchedules, fetchExecution, startPollingForScript])

  // Poll for updates when running
  useEffect(() => {
    if (isRunning && executionId) {
      pollInterval.current = setInterval(() => {
        fetchExecution(executionId)
      }, 2000)
    } else if (pollInterval.current) {
      clearInterval(pollInterval.current)
      pollInterval.current = null
    }

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current)
      }
    }
  }, [isRunning, executionId, fetchExecution])

  // Timer for elapsed time
  useEffect(() => {
    if (isRunning && startedAt) {
      timerInterval.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000)
        setElapsedTime(elapsed)
      }, 1000)
    } else if (timerInterval.current) {
      clearInterval(timerInterval.current)
      timerInterval.current = null
    }

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
      }
    }
  }, [isRunning, startedAt])

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  // Reset dynamic params when script changes
  useEffect(() => {
    if (!selectedScript) {
      setParamsForm({})
      return
    }
    const defaults: Record<string, unknown> = {}
    for (const field of selectedScript.paramsSchema || []) {
      if (field.defaultValue !== undefined) defaults[field.key] = field.defaultValue
    }
    setParamsForm(defaults)
  }, [selectedScript])



  const createSchedule = async (schedule: Partial<ScriptSchedule>) => {
    try {
      const res = await fetch('/api/admin/scripts/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
      })
      if (res.ok) {
        addLog('success', `Schedule "${schedule.name}" created`)
        await fetchSchedules()
        return true
      } else {
        const msg = await res.text()
        addLog('error', `Failed to create schedule: ${msg}`)
        return false
      }
    } catch (e) {
      addLog('error', `Error creating schedule: ${e}`)
      return false
    }
  }

  const updateSchedule = async (id: string, data: Partial<ScriptSchedule>) => {
    try {
      const res = await fetch(`/api/admin/scripts/schedules?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        addLog('success', 'Schedule updated')
        await fetchSchedules()
        return true
      } else {
        const msg = await res.text()
        addLog('error', `Failed to update schedule: ${msg}`)
        return false
      }
    } catch (e) {
      addLog('error', `Error updating schedule: ${e}`)
      return false
    }
  }

  const deleteSchedule = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/scripts/schedules/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        addLog('success', 'Schedule deleted')
        await fetchSchedules()
        return true
      } else {
        const msg = await res.text()
        addLog('error', `Failed to delete schedule: ${msg}`)
        return false
      }
    } catch (e) {
      addLog('error', `Error deleting schedule: ${e}`)
      return false
    }
  }

  const saveMemo = async () => {
    if (!customMemoName.trim() || !customMemoCode.trim()) {
      addLog('error', 'Memo name and code are required.')
      return
    }
    let args: Record<string, unknown> = {}
    try {
      args = customMemoArgs.trim() ? JSON.parse(customMemoArgs) : {}
    } catch {
      addLog('error', 'Invalid memo args JSON.')
      return
    }

    try {
      const payload = {
        name: customMemoName,
        code: customMemoCode,
        args,
      }
      const res = selectedMemoId
        ? await fetch(`/api/admin/scripts/memos/${selectedMemoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/admin/scripts/memos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      if (!res.ok) {
        addLog('error', `Failed to save memo (${res.status}).`)
        return
      }
      const data = await res.json()
      const memo = data.memo as CustomScriptMemo
      setSelectedMemoId(memo.id)
      addLog('success', `Memo saved: ${memo.name}`)
      await fetchMemos()
    } catch (e) {
      addLog('error', `Memo save error: ${e}`)
    }
  }

  const deleteMemo = async () => {
    if (!selectedMemoId) return
    try {
      const res = await fetch(`/api/admin/scripts/memos/${selectedMemoId}`, { method: 'DELETE' })
      if (!res.ok) {
        addLog('error', `Failed to delete memo (${res.status}).`)
        return
      }
      addLog('success', 'Memo deleted.')
      setSelectedMemoId('')
      setCustomMemoName('custom-memo')
      setCustomMemoCode("addLog('info', 'Custom script started');\nconst total = await prisma.shipStats.count();\naddLog('success', `shipStats=${total}`)")
      setCustomMemoArgs('{}')
      await fetchMemos()
    } catch (e) {
      addLog('error', `Memo delete error: ${e}`)
    }
  }

  const loadMemo = (id: string) => {
    setSelectedMemoId(id)
    const memo = customMemos.find((m) => m.id === id)
    if (!memo) return
    setCustomMemoName(memo.name)
    setCustomMemoCode(memo.code)
    setCustomMemoArgs(JSON.stringify(memo.args ?? {}, null, 2))
    addLog('info', `Loaded memo: ${memo.name}`)
  }

  const runScript = async () => {
    if (!selectedScript || isRunning) return

    setLogs([])
    setProgress(null)
    setIsRunning(true)

    try {
      let params = { ...paramsForm }
      if (selectedScript.id === 'run-custom-memo-script') {
        let parsedArgs: unknown = {}
        try {
          parsedArgs = customMemoArgs.trim() ? JSON.parse(customMemoArgs) : {}
        } catch {
          addLog('error', 'Invalid JSON in custom memo args.')
          setIsRunning(false)
          return
        }
        params = {
          ...params,
          memoName: customMemoName,
          code: customMemoCode,
          args: parsedArgs,
        }
      }

      const url = `/api/admin/scripts/execute?scriptId=${selectedScript.id}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params, dryRun }),
      })

      if (res.ok) {
        const data = await res.json()
        setExecutionId(data.executionId)
        localStorage.setItem(STORAGE_KEY, data.executionId)
        setStartedAt(new Date())
        setElapsedTime(0)
      } else {
        const msg = await res.text()
        setIsRunning(false)
        addLog('error', `Failed to start script (${res.status}): ${msg}`)
      }
    } catch (error) {
      setIsRunning(false)
      addLog('error', `Error: ${error}`)
    }
  }

  const addLog = (level: ScriptLog['level'], message: string) => {
    setLogs(prev => [...prev, { timestamp: new Date().toISOString(), level, message }])
  }

  const clearLogs = () => {
    setLogs([])
    setProgress(null)
    setExecutionId(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  const loadExecution = (id: string) => {
    setExecutionId(id)
    localStorage.setItem(STORAGE_KEY, id)
    fetchExecution(id)
    setShowHistory(false)
  }

  const formatElapsedTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const cancelScript = async () => {
    if (!executionId) return
    try {
      const res = await fetch('/api/admin/scripts/execute', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId, action: 'cancel' }),
      })
      if (res.ok) {
        addLog('warning', 'Script cancellation requested...')
      } else {
        const msg = await res.text()
        addLog('error', `Failed to cancel: ${msg}`)
      }
    } catch (error) {
      addLog('error', `Cancel error: ${error}`)
    }
  }

  const toggleScriptSelection = (scriptId: string) => {
    setSelectedScripts(prev => {
      const next = new Set(prev)
      if (next.has(scriptId)) {
        next.delete(scriptId)
      } else {
        next.add(scriptId)
      }
      return next
    })
  }

  const runSelectedScripts = async () => {
    if (selectedScripts.size === 0) return
    
    // Initialize running scripts state
    const scriptsToRun = scripts.filter(s => selectedScripts.has(s.id))
    const initialScripts: RunningScript[] = scriptsToRun.map(s => ({
      scriptId: s.id,
      scriptName: s.name,
      executionId: null,
      status: 'pending' as const,
      logs: [],
      progress: 0,
      startedAt: null,
      elapsedTime: 0,
    }))
    
    setRunningScripts(initialScripts)
    setActiveLogTab(scriptsToRun[0]?.id || '')
    setLogs([])
    
    addLog('info', `Starting ${selectedScripts.size} scripts in parallel...`)
    
    // Execute all scripts in parallel
    await Promise.all(scriptsToRun.map(async (script) => {
      try {
        const res = await fetch(`/api/admin/scripts/execute?scriptId=${script.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params: {}, dryRun }),
        })
        
        if (res.ok) {
          const data = await res.json()
          
          // Update state with execution ID and start polling
          setRunningScripts(prev => prev.map(s => {
            if (s.scriptId === script.id) {
              startPollingForScript(data.executionId, script.id)
              return { 
                ...s, 
                executionId: data.executionId,
                status: 'running' as const,
                startedAt: new Date()
              }
            }
            return s
          }))
          
          addLog('success', `Started: ${script.name} (${data.executionId})`)
        } else {
          const msg = await res.text()
          setRunningScripts(prev => prev.map(s => {
            if (s.scriptId === script.id) {
              return { ...s, status: 'failed' as const, error: msg }
            }
            return s
          }))
          addLog('error', `Failed to start ${script.name}: ${msg}`)
        }
      } catch (error) {
        setRunningScripts(prev => prev.map(s => {
          if (s.scriptId === script.id) {
            return { ...s, status: 'failed' as const, error: String(error) }
          }
          return s
        }))
        addLog('error', `Error starting ${script.name}: ${error}`)
      }
    }))
    
    setSelectedScripts(new Set())
    setSelectionMode(false)
    
    // Save to localStorage for restoration
    localStorage.setItem('runningScripts', JSON.stringify(initialScripts))
  }

  const progressPercent = progress && progress.totalAvailable 
    ? Math.round((progress.processed / progress.totalAvailable) * 100)
    : 0

  const groupedScripts = useMemo(() => {
    const filtered =
      selectedCategory === 'all'
        ? scripts
        : scripts.filter((s) => s.category === selectedCategory)
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.id.toLowerCase().includes(query)
      )
    }
    return filtered
  }, [scripts, selectedCategory, searchQuery])

  const categories = useMemo(
    () =>
      Array.from(new Set(scripts.map((s) => s.category))).sort(
        (a, b) => CATEGORY_LABELS[a as ScriptCategory].localeCompare(CATEGORY_LABELS[b as ScriptCategory])
      ) as ScriptCategory[],
    [scripts]
  )

  const setParam = (key: string, value: unknown) => {
    setParamsForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Card className="bg-eve-panel border-eve-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-eve-accent" />
          Scripts
        </CardTitle>
        <CardDescription>
          Run synchronization and maintenance scripts against the platform database.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category filters + Search */}
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scripts by name, description, or ID..."
            className="w-full px-3 py-1.5 bg-zinc-900/50 border border-eve-border rounded-md text-xs text-gray-200 placeholder:text-zinc-600 focus:border-eve-accent focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              className={cn(
                'px-3 py-1.5 rounded-md text-xs border transition',
                selectedCategory === 'all' ? 'bg-eve-accent/20 border-eve-accent' : 'bg-zinc-900/50 border-eve-border'
              )}
              onClick={() => setSelectedCategory('all')}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs border transition',
                  selectedCategory === cat ? 'bg-eve-accent/20 border-eve-accent' : 'bg-zinc-900/50 border-eve-border'
                )}
                onClick={() => setSelectedCategory(cat)}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Script List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
          {loadingScripts ? (
            <div className="col-span-full flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-eve-accent" />
              <span className="ml-2 text-gray-400">Loading scripts...</span>
            </div>
          ) : groupedScripts.length === 0 ? (
            <div className="col-span-full p-4 text-center text-gray-500">
              No scripts found in /scripts directory.
            </div>
          ) : (
            groupedScripts.map(script => (
              <button
                key={script.id}
                onClick={() => selectionMode ? toggleScriptSelection(script.id) : setSelectedScript(script)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  selectedScript?.id === script.id
                    ? 'bg-eve-accent/20 border-eve-accent'
                    : 'bg-zinc-900/50 border-eve-border hover:border-eve-accent/50'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {selectionMode && (
                      <input
                        type="checkbox"
                        checked={selectedScripts.has(script.id)}
                        onChange={() => toggleScriptSelection(script.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 accent-eve-accent"
                      />
                    )}
                    <div className="font-medium text-sm">{script.name}</div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {CATEGORY_LABELS[script.category]}
                    </span>
                    {script.dangerLevel === 'warning' && (
                      <span className="px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-300">warning</span>
                    )}
                    {script.dangerLevel === 'danger' && (
                      <span className="px-1.5 py-0.5 rounded bg-red-900/40 text-red-300">danger</span>
                    )}
                    {script.executionPolicy === 'elevated' && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300">elevated</span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1 line-clamp-1">{script.description}</div>
                {script.lastSync && (
                  <div className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
                    <History className="h-3 w-3 text-zinc-600" />
                    Last Sync: {new Date(script.lastSync).toLocaleString('pt-BR')}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Dynamic Params */}
        {selectedScript && (
          <div className="space-y-3 p-3 bg-zinc-900/50 rounded-lg border border-eve-border">
            <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
              <Wrench className="h-4 w-4" />
              Script Parameters
            </div>
            {(selectedScript.paramsSchema || []).length === 0 ? (
              <div className="text-xs text-zinc-500">This script does not require parameters.</div>
            ) : (
              <div className="space-y-3">
                {(selectedScript.paramsSchema || []).map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label className="text-xs text-zinc-300">
                      {field.label}
                      {field.required ? ' *' : ''}
                    </label>
                    {field.type === 'boolean' ? (
                      <select
                        value={String(paramsForm[field.key] ?? field.defaultValue ?? false)}
                        onChange={(e) => setParam(field.key, e.target.value === 'true')}
                        className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
                      >
                        <option value="false">false</option>
                        <option value="true">true</option>
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={String(paramsForm[field.key] ?? '')}
                        onChange={(e) => setParam(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono min-h-[120px]"
                      />
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={String(paramsForm[field.key] ?? '')}
                        onChange={(e) =>
                          setParam(
                            field.key,
                            field.type === 'number' ? Number(e.target.value) : e.target.value
                          )
                        }
                        placeholder={field.placeholder}
                        className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
                      />
                    )}
                    {field.description && <div className="text-[11px] text-zinc-500">{field.description}</div>}
                  </div>
                ))}
              </div>
            )}
            {selectedScript.id === 'run-custom-memo-script' && (
              <div className="space-y-2 border-t border-zinc-800 pt-3">
                <div className="text-xs text-zinc-300 font-medium flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-yellow-500" />
                  Custom Memo Editor
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select
                    value={selectedMemoId}
                    onChange={(e) => loadMemo(e.target.value)}
                    className="md:col-span-2 w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs"
                  >
                    <option value="">Load saved memo...</option>
                    {customMemos.map((memo) => (
                      <option key={memo.id} value={memo.id}>
                        {memo.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" className="text-xs" onClick={saveMemo}>
                      Save Memo
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={deleteMemo}
                      disabled={!selectedMemoId}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <input
                  type="text"
                  value={customMemoName}
                  onChange={(e) => setCustomMemoName(e.target.value)}
                  placeholder="memo name"
                  className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
                />
                <textarea
                  value={customMemoCode}
                  onChange={(e) => setCustomMemoCode(e.target.value)}
                  className="w-full px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono min-h-[180px]"
                />
                <textarea
                  value={customMemoArgs}
                  onChange={(e) => setCustomMemoArgs(e.target.value)}
                  placeholder='{"shipTypeId":587}'
                  className="w-full px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono min-h-[80px]"
                />
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={runScript}
            disabled={!selectedScript || isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run
          </Button>
          {isRunning && (
            <Button
              variant="destructive"
              onClick={cancelScript}
              className="flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              Stop
            </Button>
          )}
          <label className="inline-flex items-center gap-2 px-2 py-1 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={selectedScript?.supportsDryRun === false}
            />
            Dry run
          </label>

          <Button
            variant="outline"
            onClick={clearLogs}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>

          <Button
            variant="ghost"
            onClick={() => { fetchSchedules(); setShowSchedules(!showSchedules) }}
            className={cn("flex items-center gap-2", showSchedules && "bg-eve-accent/20 text-eve-accent")}
          >
            <Wrench className="h-4 w-4" />
            Schedules
          </Button>
          <Button
            variant="ghost"
            onClick={() => { fetchHistory(); setShowHistory(!showHistory) }}
            className="flex items-center gap-2 ml-auto"
          >
            <History className="h-4 w-4" />
            History
          </Button>
          <Button
            variant={selectionMode ? "default" : "ghost"}
            onClick={() => setSelectionMode(!selectionMode)}
            className="flex items-center gap-2"
          >
            {selectionMode ? <CheckSquare className="h-4 w-4" /> : <SquareIcon className="h-4 w-4" />}
            Select ({selectedScripts.size})
          </Button>
          {selectionMode && selectedScripts.size > 0 && (
            <Button
              variant="default"
              onClick={runSelectedScripts}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Run Selected
            </Button>
          )}
        </div>

        {/* Progress Bar */}
        {(progress || isRunning) && (
          <div className="space-y-2 p-3 bg-zinc-900/50 rounded-lg">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">
                {progress?.step ? `Step: ${progress.step}` : isRunning ? `Running: ${formatElapsedTime(elapsedTime)}` : 'Complete'}
              </span>
              <span className="text-gray-400">
                {typeof progress?.processed === 'number' ? `${progress.processed} processed` : ''}
                {typeof progress?.inserted === 'number' && progress.inserted > 0 ? ` • ${progress.inserted} inserted` : ''}
                {typeof progress?.updated === 'number' && progress.updated > 0 ? ` • ${progress.updated} updated` : ''}
                {typeof progress?.errors === 'number' && progress.errors > 0 ? ` • ${progress.errors} errors` : ''}
              </span>
            </div>
            {progress?.totalAvailable && (
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-eve-accent transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Schedules Panel */}
        {showSchedules && (
          <div className="space-y-3">
            <div className="p-3 bg-blue-900/20 border border-blue-800 rounded-lg text-[11px] text-blue-200 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Pull-based Scheduler Active</p>
                <p>
                  Schedules require an external trigger to run. Ensure your production environment 
                  (Coolify, Vercel, or GitHub Actions) is calling the trigger endpoint:
                </p>
                <code className="block mt-2 p-1 bg-black/40 rounded border border-white/10 select-all">
                  GET /api/admin/scripts/scheduler/trigger?token=YOUR_CRON_SECRET
                </code>
              </div>
            </div>

            <div className="border border-eve-border rounded-lg overflow-hidden">

            <div className="bg-zinc-950 px-3 py-2 text-xs font-medium border-b border-eve-border flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Script Schedules
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={scheduleFilter}
                  onChange={(e) => setScheduleFilter(e.target.value)}
                  className="h-6 text-[10px] bg-zinc-900 border border-zinc-700 rounded px-2 text-gray-300"
                >
                  <option value="all">All</option>
                  <option value="15m">15m</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px]"
                  onClick={() => { setEditingSchedule(null); setIsScheduleModalOpen(true) }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {(() => {
                const filtered = scheduleFilter === 'all' 
                  ? schedules 
                  : schedules.filter(s => s.interval === scheduleFilter)
                
                return filtered.length === 0 ? (
                  <div className="p-4 text-xs text-gray-500 text-center">
                    {scheduleFilter === 'all' 
                      ? 'No schedules configured. Create one to automate script execution.' 
                      : `No ${scheduleFilter} schedules configured.`}
                  </div>
                ) : (
                  filtered.map(schedule => {
                    const script = scripts.find(s => s.id === schedule.scriptId)
                    const scriptName = script?.name || schedule.scriptId
                    
                    const intervalColors: Record<string, string> = {
                      '15m': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                      'hourly': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                      'daily': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
                      'weekly': 'bg-green-500/20 text-green-400 border-green-500/30',
                      'monthly': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                    }
                    const badgeClass = intervalColors[schedule.interval || ''] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                    
                    const isRunning = runningSchedules.has(schedule.id)
                    
                    return (
                      <div key={schedule.id} className="flex items-center justify-between px-3 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-xs font-medium text-white truncate">{schedule.name}</div>
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded border", badgeClass)}>
                              {schedule.interval || (schedule.cron ? 'Custom' : 'Daily')}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            {scriptName}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-[9px]">
                            <span className={cn("flex items-center gap-1", schedule.lastRunAt ? "text-green-400" : "text-zinc-500")}>
                              {schedule.lastRunAt ? (
                                <><CheckCircle className="h-3 w-3" /> {new Date(schedule.lastRunAt).toLocaleString('pt-BR')}</>
                              ) : (
                                <><Clock className="h-3 w-3" /> Never</>
                              )}
                            </span>
                            <span className="text-cyan-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Next: {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString('pt-BR') : 'Pending'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-100">
                          <button
                            onClick={() => runScheduleNow(schedule.id, schedule.scriptId)}
                            disabled={isRunning}
                            title="Run now"
                            className={cn(
                              "p-1.5 rounded transition-colors",
                              isRunning 
                                ? "bg-yellow-500/20 text-yellow-400 cursor-wait"
                                : "text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                            )}
                          >
                            {isRunning ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            onClick={() => updateSchedule(schedule.id, { active: !schedule.active })}
                            className={cn(
                              "text-[10px] px-2 py-1 rounded transition-colors",
                              schedule.active 
                                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" 
                                : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
                            )}
                          >
                            {schedule.active ? 'Active' : 'Paused'}
                          </button>
                          <button
                            onClick={() => { setEditingSchedule(schedule); setIsScheduleModalOpen(true) }}
                            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                            title="Edit"
                          >
                            <Wrench className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => deleteSchedule(schedule.id)}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )
              })()}
            </div>
          </div>
        </div>
      )}


        {/* History Panel */}
        {showHistory && (
          <div className="border border-eve-border rounded-lg overflow-hidden">
            <div className="bg-zinc-950 px-3 py-2 text-xs font-medium border-b border-eve-border flex items-center justify-between">
              <span>Previous Executions</span>
              <span className="text-gray-500 text-[10px]">{history.length} total</span>
            </div>
            <div className="max-h-60 overflow-y-auto">
               {history.length === 0 ? (
                 <div className="p-3 text-xs text-gray-500">No history</div>
               ) : (
                 history.map(h => {
                   const scriptName = scripts.find(s => s.id === h.scriptId)?.name || h.scriptId
                   const isSelected = selectedHistoryExecution?.id === h.id
                   return (
                     <button
                       key={h.id}
                       onClick={() => setSelectedHistoryExecution(isSelected ? null : h)}
                       className={cn(
                         "w-full p-3 text-left text-xs hover:bg-zinc-800 border-b border-zinc-800 transition-colors",
                         isSelected && "bg-zinc-800"
                       )}
                     >
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <span className={cn(
                             'px-2 py-1 rounded text-[10px] font-medium',
                             h.status === 'completed' && 'bg-emerald-900/50 text-emerald-400 border border-emerald-800',
                             h.status === 'running' && 'bg-blue-900/50 text-blue-400 border border-blue-800',
                             h.status === 'failed' && 'bg-red-900/50 text-red-400 border border-red-800',
                             h.status === 'pending' && 'bg-yellow-900/50 text-yellow-400 border border-yellow-800'
                           )}>
                             {h.status === 'completed' ? '✓' : h.status === 'failed' ? '✕' : h.status === 'running' ? '⟳' : '○'} {h.status}
                           </span>
                           <span className="text-gray-200 font-medium">{scriptName}</span>
                         </div>
                         <div className="text-right">
                           <div className="text-gray-400 text-[10px]">
                             {new Date(h.startedAt).toLocaleDateString('pt-BR')}
                           </div>
                           <div className="text-gray-500 text-[9px]">
                             {new Date(h.startedAt).toLocaleTimeString('pt-BR')}
                           </div>
                         </div>
                       </div>
                       
                       {isSelected && h.logs && h.logs.length > 0 && (
                         <div className="mt-3 p-2 bg-zinc-950 rounded border border-zinc-800 max-h-40 overflow-y-auto">
                           <div className="text-[10px] text-gray-500 mb-1">Execution Log:</div>
                           {h.logs.slice(0, 20).map((log, idx) => (
                             <div key={idx} className={cn(
                               "text-[10px] font-mono py-0.5",
                               log.level === 'error' && "text-red-400",
                               log.level === 'warning' && "text-yellow-400",
                               log.level === 'success' && "text-emerald-400",
                               log.level === 'info' && "text-gray-400"
                             )}>
                               {log.message}
                             </div>
                           ))}
                           {h.logs.length > 20 && (
                             <div className="text-[10px] text-gray-500 mt-1">... and {h.logs.length - 20} more</div>
                           )}
                         </div>
                       )}
                       
                       {isSelected && h.progress && (
                         <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-500">
                           <span>Processed: {h.progress.processed || 0}</span>
                           {h.progress.errors > 0 && <span className="text-red-400">Errors: {h.progress.errors}</span>}
                           {h.progress.updated > 0 && <span className="text-emerald-400">Updated: {h.progress.updated}</span>}
                         </div>
                       )}
                     </button>
                   )
                 })
               )}
            </div>
          </div>
        )}

        {/* Console Output with Tabs for Multi-Script */}
        <div className="border border-eve-border rounded-lg overflow-hidden">
          <div className="bg-zinc-950 px-3 py-1.5 text-xs font-mono text-gray-500 border-b border-eve-border">
            {/* Tabs for multi-script execution */}
            {runningScripts.length > 0 && (
              <div className="flex items-center gap-1 mb-2 -mt-1">
                {runningScripts.map(script => (
                  <button
                    key={script.scriptId}
                    onClick={() => {
                      setActiveLogTab(script.scriptId)
                      setLogs(script.logs)
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors",
                      activeLogTab === script.scriptId 
                        ? "bg-eve-accent/20 text-eve-accent" 
                        : "hover:bg-white/5 text-gray-400"
                    )}
                  >
                    {script.status === 'pending' && <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />}
                    {script.status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
                    {script.status === 'completed' && <CheckSquare className="h-3 w-3 text-green-400" />}
                    {script.status === 'failed' && <XCircle className="h-3 w-3 text-red-400" />}
                    <span className="truncate max-w-[120px]">{script.scriptName}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>
                {runningScripts.length > 0 
                  ? `Console: ${runningScripts.find(s => s.scriptId === activeLogTab)?.scriptName || 'Select a script'}`
                  : 'Console Output'}
              </span>
              <span className="text-[10px]">{logs.length} entries</span>
            </div>
          </div>
          <ScrollArea className="h-64" ref={scrollRef}>
            <div className="p-3 font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <div className="text-gray-600 italic">
                  Run a script to see log output here.
                </div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex gap-2',
                      log.level === 'error' && 'text-red-400',
                      log.level === 'success' && 'text-green-400',
                      log.level === 'warning' && 'text-yellow-400',
                      log.level === 'info' && 'text-gray-300'
                    )}
                  >
                    <span className="text-gray-600 shrink-0">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span>{typeof log.message === 'string' ? log.message : JSON.stringify(log.message)}</span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          
          {/* Summary when all scripts completed */}
          {runningScripts.length > 0 && runningScripts.every(s => s.status !== 'running' && s.status !== 'pending') && (
            <div className="px-3 py-2 bg-zinc-900 border-t border-eve-border">
              <div className="text-xs">
                {runningScripts.filter(s => s.status === 'completed').length}/{runningScripts.length} scripts completed successfully
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 text-[10px] mt-1"
                onClick={() => {
                  setRunningScripts([])
                  localStorage.removeItem('runningScripts')
                  setLogs([])
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Schedule Modal */}
        <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
          <DialogContent className="sm:max-w-[450px] bg-eve-panel border-eve-border text-white">
            <DialogHeader>
              <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'New Schedule'}</DialogTitle>
              <DialogDescription>
                Configure a scheduled execution for this script
              </DialogDescription>
            </DialogHeader>
            <ScheduleForm 
              scripts={scripts}
              schedule={editingSchedule}
              onSubmit={async (data) => {
                if (editingSchedule) {
                  await updateSchedule(editingSchedule.id, data)
                } else {
                  await createSchedule(data)
                }
                setIsScheduleModalOpen(false)
                setEditingSchedule(null)
              }}
              onCancel={() => {
                setIsScheduleModalOpen(false)
                setEditingSchedule(null)
              }}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}