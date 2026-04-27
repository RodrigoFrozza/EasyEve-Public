'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Terminal, AlertCircle, Clock, ChevronLeft, Trash2 } from 'lucide-react'
import { formatISK, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { FormattedDate } from '@/components/shared/FormattedDate'

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

export default function UserLogsPage() {
  const { t } = useTranslations()
  const { userId } = useParams()
  const router = useRouter()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState<string>('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/logs/${userId}`)
      if (res.ok) {
        setLogs(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  const fetchUserInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/accounts')
      if (res.ok) {
        const data = await res.json()
        const user = data.accounts?.find((a: any) => a.id === userId)
        if (user) setUserName(user.name || user.accountCode || userId as string)
      }
    } catch (err) {}
  }, [userId])

  useEffect(() => {
    fetchLogs()
    fetchUserInfo()
  }, [userId, fetchLogs, fetchUserInfo])

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()} className="text-gray-400">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Terminal className="h-8 w-8 text-red-500" />
              {t('admin.logsTitle')}: {userName}
            </h1>
            <p className="text-gray-400">{t('global.viewingLast7Days')}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchLogs} 
          disabled={loading}
          className="border-eve-border text-gray-300"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
          {t('global.refresh')}
        </Button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-eve-accent" />
          </div>
        ) : logs.length === 0 ? (
          <Card className="bg-eve-panel border-dashed border-eve-border py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-10 w-10 text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-white">{t('global.noErrorsLogged')}</h3>
              <p className="text-sm text-gray-500 max-w-xs mt-2">
                {t('global.noErrorsLoggedDesc')}
              </p>
            </CardContent>
          </Card>
        ) : (
          logs.map((log) => (
            <Card key={log.id} className="bg-eve-panel border-eve-border overflow-hidden">
              <CardHeader className="bg-eve-dark/30 py-3 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <Badge className="bg-red-500/20 text-red-500 border-none">ERROR</Badge>
                  <span className="text-xs text-gray-500 font-mono">
                    <FormattedDate date={log.createdAt} />
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 font-mono hidden md:block truncate max-w-sm">
                  {log.url}
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <p className="text-white font-medium">{log.message}</p>
                
                {log.stack && (
                  <div className="mt-2 text-[11px] font-mono text-gray-400 bg-black/40 p-3 rounded border border-eve-border/50 overflow-x-auto whitespace-pre">
                    {log.stack}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 mt-2 border-t border-eve-border/30">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-600 mb-1">User Agent</p>
                    <p className="text-[10px] text-gray-400 truncate">{log.userAgent}</p>
                  </div>
                  {log.context && Object.keys(log.context).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-600 mb-1">Contexto</p>
                      <pre className="text-[10px] text-gray-400">{JSON.stringify(log.context, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
