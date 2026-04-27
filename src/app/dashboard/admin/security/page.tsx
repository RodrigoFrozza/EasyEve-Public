'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  ShieldAlert, ShieldCheck, Search, Filter, 
  ArrowLeft, Clock, Globe, Shield, User,
  MoreVertical, ChevronLeft, ChevronRight, Lock,
  AlertTriangle, Fingerprint
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatISK, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'

interface SecurityEvent {
  id: string
  event: string
  ipAddress: string | null
  userAgent: string | null
  path: string | null
  userId: string | null
  details: any
  createdAt: string
}

export default function AdminSecurityPage() {
  const { t } = useTranslations()
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ pages: 1, total: 0 })

  const fetchEvents = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/security?page=${page}&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events)
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error('[Admin Security] Error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const getEventBadge = (event: string) => {
    switch (event.toUpperCase()) {
      case 'RATE_LIMIT_BLOCKED':
      case 'RATE_LIMIT_HIT':
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Rate Limit</Badge>
      case 'FORBIDDEN_ENTRY':
      case 'FORBIDDEN_REQUEST':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Forbidden</Badge>
      case 'UNAUTHORIZED_API':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Unauthorized</Badge>
      case 'LOGIN_SUCCESS':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Auth Success</Badge>
      case 'LOGIN_FAILED':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Auth Failed</Badge>
      default:
        return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">{event}</Badge>
    }
  }

  const filteredEvents = events.filter(e => 
    e.event.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.ipAddress?.includes(searchTerm) ||
    e.path?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <Link 
            href="/dashboard/admin" 
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            Admin Dashboard
          </Link>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Security Center</h1>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Audit Logs & Threat Monitoring</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
            <Input 
              placeholder="Search IP, Event, Path..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 w-full md:w-[280px] bg-zinc-950 border-zinc-800 text-xs font-bold"
            />
          </div>
          <Button variant="outline" className="h-10 border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-950/40 border-zinc-900">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 font-black uppercase">Blocked Requests</p>
              <p className="text-xl font-black text-white">1,283</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950/40 border-zinc-900">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Lock className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 font-black uppercase">Failed Logins</p>
              <p className="text-xl font-black text-white">42</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950/40 border-zinc-900">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 font-black uppercase">Active Defense</p>
              <p className="text-xl font-black text-white">99.8%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950/40 border-zinc-900">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Globe className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 font-black uppercase">Unique IPs</p>
              <p className="text-xl font-black text-white">154</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="bg-zinc-950/20 border-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-900/50">
                <th className="py-4 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Event</th>
                <th className="py-4 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Identity / IP</th>
                <th className="py-4 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Path / Location</th>
                <th className="py-4 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Timing</th>
                <th className="py-4 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="py-8 px-6">
                      <div className="h-4 bg-zinc-900 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <Fingerprint className="h-12 w-12 text-zinc-800 mx-auto mb-4" />
                    <p className="text-zinc-600 text-sm font-bold uppercase tracking-wider">{t('global.noSecurityEventsFound')}</p>
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => (
                  <tr key={event.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1">
                        {getEventBadge(event.event)}
                        <span className="text-[9px] text-zinc-600 font-mono truncate max-w-[150px]">ID: {event.id}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-zinc-300 font-bold text-xs">
                          <Globe className="h-3 w-3 text-zinc-600" />
                          {event.ipAddress || 'Unknown IP'}
                        </div>
                        {event.userId && (
                          <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-1">
                            <User className="h-3 w-3" />
                            User: {event.userId.slice(0, 8)}...
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-white font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 inline-block w-fit">
                          {event.path || '/'}
                        </span>
                        <span className="text-[9px] text-zinc-600 truncate max-w-[200px]" title={event.userAgent || ''}>
                          {event.userAgent || 'No User Agent'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-zinc-400 text-xs">
                        <Clock className="h-3.5 w-3.5 text-zinc-600" />
                        <span>{formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-zinc-800">
                        <MoreVertical className="h-4 w-4 text-zinc-600" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-zinc-900 flex items-center justify-between">
          <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">
            Showing <span className="text-white">{events.length}</span> of <span className="text-white">{pagination.total}</span> logs
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0 border-zinc-800 bg-zinc-900" 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 text-zinc-500" />
            </Button>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-black text-white px-2 py-1 bg-red-500/20 rounded border border-red-500/30">
                {page}
              </span>
              <span className="text-zinc-600 text-[10px] font-black">/</span>
              <span className="text-zinc-500 text-[10px] font-black">{pagination.pages}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0 border-zinc-800 bg-zinc-900" 
              disabled={page >= pagination.pages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
