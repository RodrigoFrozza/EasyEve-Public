'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  DialogTrigger 
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Award, Plus, Search, Edit2, Trash2, Power, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseCriteria, TIER_COLORS, type Medal } from '@/lib/medals/types'
import Link from 'next/link'
import { handleAdminError } from '@/lib/admin/error-handler'

interface MedalWithStats extends Medal {
  awardCount: number
  uniqueRecipients: number
}

interface MedalManagementProps {
  onEdit?: (medal: MedalWithStats) => void
  onCreate?: () => void
}

export function MedalManagement({ onEdit, onCreate }: MedalManagementProps) {
  const [medals, setMedals] = useState<MedalWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const fetchMedals = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/medals')
      if (res.ok) {
        const data = await res.json()
        const medalsWithStats = await Promise.all(
          data.medals.map(async (medal: Medal) => {
            const awardCount = await fetch(`/api/admin/medals?stats=${medal.id}`).then(r => r.json()).catch(() => ({ count: 0, recipients: 0 }))
            return {
              ...medal,
              awardCount: awardCount.count || 0,
              uniqueRecipients: awardCount.recipients || 0,
            }
          })
        )
        setMedals(medalsWithStats)
      }
    } catch (err) {
      console.error('Failed to fetch medals:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMedals()
  }, [])

  const filteredMedals = medals.filter(medal => {
    const matchesSearch = !search || medal.name.toLowerCase().includes(search.toLowerCase())
    const matchesTier = tierFilter === 'all' || medal.tier === tierFilter
    const matchesType = typeFilter === 'all' || medal.type === typeFilter
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && medal.isActive) || 
      (statusFilter === 'inactive' && !medal.isActive)
    return matchesSearch && matchesTier && matchesType && matchesStatus
  })

  const handleToggle = async (medalId: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/admin/medals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', medalId, isActive }),
      })
      if (res.ok) {
        toast.success(isActive ? 'Medal activated' : 'Medal deactivated')
        fetchMedals()
      }
    } catch (err) {
      handleAdminError(err, 'Failed to update medal')
    }
  }

  const handleDelete = async (medalId: string) => {
    if (!confirm('Are you sure you want to delete this medal? This cannot be undone.')) return
    
    try {
      const res = await fetch(`/api/admin/medals?id=${medalId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Medal deleted')
        fetchMedals()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete medal')
      }
    } catch (err) {
      handleAdminError(err, 'Failed to delete medal')
    }
  }

  const getCriteriaLabel = (criteriaStr: string) => {
    try {
      const criteria = parseCriteria(criteriaStr)
      switch (criteria.type) {
        case 'first_activity': return 'First Activity'
        case 'hours': return `${criteria.value} Hours`
        case 'count': return `${criteria.value} ${criteria.activity} Activities`
        case 'ranking': return `Top ${criteria.value} ${criteria.activity} Ranking`
        default: return 'Custom'
      }
    } catch {
      return 'Custom'
    }
  }

  const stats = {
    total: medals.length,
    active: medals.filter(m => m.isActive).length,
    inactive: medals.filter(m => !m.isActive).length,
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input 
            placeholder="Search medals..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-eve-dark border-eve-border text-white"
          />
        </div>
        
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[130px] bg-eve-dark border-eve-border">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="bronze">Bronze</SelectItem>
            <SelectItem value="silver">Silver</SelectItem>
            <SelectItem value="gold">Gold</SelectItem>
            <SelectItem value="platinum">Platinum</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px] bg-eve-dark border-eve-border">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="instant">Instant</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] bg-eve-dark border-eve-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          onClick={onCreate}
          className="ml-auto bg-eve-accent text-black hover:bg-eve-accent/80"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Medal
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-eve-border/60">
        <span>Total: <strong className="text-white">{stats.total}</strong></span>
        <span>Active: <strong className="text-green-400">{stats.active}</strong></span>
        <span>Inactive: <strong className="text-gray-500">{stats.inactive}</strong></span>
      </div>

      {/* Medal Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12 bg-eve-panel/40 rounded-xl border border-eve-border/30">
          <Loader2 className="h-8 w-8 animate-spin text-eve-accent" />
        </div>
      ) : filteredMedals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 bg-eve-panel/40 rounded-xl border border-eve-border/30 text-center">
          <Award className="h-10 w-10 text-gray-600 mb-3" />
          <p className="text-gray-500">No medals found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMedals.map((medal) => {
            const criteria = parseCriteria(medal.criteria)
            return (
              <Card 
                key={medal.id} 
                className={cn(
                  "bg-eve-panel border-eve-border overflow-hidden transition-all",
                  !medal.isActive && "opacity-60"
                )}
              >
                <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-10 w-10 rounded-lg flex items-center justify-center text-xl bg-eve-dark border border-white/10"
                      style={{ color: TIER_COLORS[medal.tier as keyof typeof TIER_COLORS] }}
                    >
                      {medal.icon || '🎖️'}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-white font-outfit">
                        {medal.name}
                      </CardTitle>
                      <Badge 
                        variant="outline" 
                        className="text-[10px] mt-0.5"
                        style={{ 
                          borderColor: TIER_COLORS[medal.tier as keyof typeof TIER_COLORS],
                          color: TIER_COLORS[medal.tier as keyof typeof TIER_COLORS]
                        }}
                      >
                        {medal.tier}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEdit?.(medal)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        medal.isActive ? "text-emerald-400 hover:text-emerald-300" : "text-gray-500 hover:text-gray-400"
                      )}
                      onClick={() => handleToggle(medal.id, !medal.isActive)}
                    >
                      <Power className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-300"
                      onClick={() => handleDelete(medal.id)}
                      disabled={medal.awardCount > 0}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-3">
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {medal.description || 'No description'}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs">
                    <Badge variant="outline" className="text-[10px]">
                      {medal.type}
                    </Badge>
                    <span className="text-gray-500">
                      {getCriteriaLabel(medal.criteria)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                    <span>{medal.awardCount} awards</span>
                    <span>{medal.uniqueRecipients} recipients</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}