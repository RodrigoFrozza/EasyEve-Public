'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { cn } from '@/lib/utils'
import { 
  BarChart3, 
  Calendar, 
  Copy, 
  Edit2, 
  ExternalLink, 
  Gift, 
  Globe, 
  Layout, 
  Megaphone, 
  MessageSquare, 
  MoreHorizontal, 
  Play, 
  Trash2 
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface CampaignListProps {
  campaigns: any[]
  onEdit: (campaign: any) => void
  onDelete: (id: string) => void
  loading: boolean
}

export function CampaignList({ campaigns, onEdit, onDelete, loading }: CampaignListProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-12 w-12 border-4 border-eve-accent/20 border-t-eve-accent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium animate-pulse">Loading campaigns...</p>
      </div>
    )
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 border border-eve-border/30 rounded-xl bg-eve-dark/20 px-6 text-center">
        <div className="h-12 w-12 bg-eve-border/30 rounded-full flex items-center justify-center mb-2">
          <Megaphone className="h-6 w-6 text-gray-500" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">No campaigns active</h3>
        <p className="text-sm text-gray-500 max-w-xs">Start your first marketing or onboarding campaign to see results here.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {campaigns.map((campaign) => (
        <div
          key={campaign.id}
          className={cn(
            "group relative overflow-hidden rounded-xl border transition-colors",
            campaign.isActive 
              ? "bg-eve-panel border-eve-border/30 hover:border-eve-accent/40" 
              : "bg-eve-dark/40 border-eve-border/50 opacity-70"
          )}
        >
          {/* Status line */}
          <div className={cn(
            "absolute top-0 left-0 w-1 h-full",
            campaign.isActive ? "bg-eve-accent" : "bg-gray-700"
          )} />

          <div className="p-4 flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Icon & Type */}
            <div className="flex shrink-0 items-center justify-center h-14 w-14 rounded-2xl bg-eve-dark border border-eve-border shadow-inner">
              {campaign.type === 'BANNER' && <Layout className="h-6 w-6 text-blue-400" />}
              {campaign.type === 'POPUP' && <MessageSquare className="h-6 w-6 text-purple-400" />}
              {campaign.type === 'TOAST' && <Megaphone className="h-6 w-6 text-amber-400" />}
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="outline" className={cn(
                  "text-[10px] font-black uppercase tracking-widest px-2 py-0",
                  campaign.isActive ? "border-eve-accent text-eve-accent bg-eve-accent/5" : "text-gray-500"
                )}>
                  {campaign.isActive ? 'Active' : 'Paused'}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {campaign.type}
                </Badge>
                <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold ml-2">
                  <BarChart3 className="h-3 w-3" />
                  PRIORITY {campaign.priority}
                </div>
              </div>
              <h4 className="text-lg font-bold text-white truncate">{campaign.title}</h4>
              <p className="text-xs text-gray-500 line-clamp-1">{campaign.description}</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 px-6 border-l border-eve-border/50">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">Engagements</p>
                <p className="text-xl font-black text-white">{campaign.stats?.claimCount || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">Success Rate</p>
                <p className="text-xl font-black text-emerald-400">
                  {campaign.stats?.claimCount > 0 
                    ? Math.round((campaign.stats.redeemedCount / campaign.stats.claimCount) * 100)
                    : 0}%
                </p>
              </div>
              <div className="hidden md:block space-y-1">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">Dismissals</p>
                <p className="text-xl font-black text-amber-500">{campaign.stats?.dismissCount || 0}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-10 border-eve-border bg-eve-dark hover:bg-eve-border hover:text-white"
                onClick={() => onEdit(campaign)}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-400 hover:text-white">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-eve-panel border-eve-border">
                  <DropdownMenuItem className="text-xs cursor-pointer">
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate Campaign
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs cursor-pointer">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Detailed Analytics
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-eve-border/50" />
                  <DropdownMenuItem 
                    className="text-xs cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => onDelete(campaign.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Archive Campaign
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Footer Info */}
          <div className="px-4 py-2 bg-black/20 border-t border-eve-border/30 flex items-center justify-between text-[10px] text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                STARTS: {campaign.startsAt ? <FormattedDate date={campaign.startsAt} /> : 'NOW'}
              </span>
              <span className="flex items-center gap-1">
                <Play className="h-3 w-3" />
                ACTION: {campaign.actionType.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-3 w-3" />
              {campaign.targetSegment.replace(/_/g, ' ')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
