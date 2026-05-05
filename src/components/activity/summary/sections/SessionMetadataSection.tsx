'use client'

import { ActivityEnhanced } from '@/types/domain'
import { ExpandableSection } from '../shared/ExpandableSection'
import { Info, MapPin, Clock, Fingerprint, Activity as ActivityIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SessionMetadataSectionProps {
  activity: ActivityEnhanced
}

export function SessionMetadataSection({ activity }: SessionMetadataSectionProps) {
  const start = new Date(activity.startTime)
  const end = activity.endTime ? new Date(activity.endTime) : null
  const durationMs = (end || new Date()).getTime() - start.getTime()
  
  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  const data = activity.data || {}

  const metaItems = [
    { label: 'Start Time', value: start.toLocaleString(), icon: <Clock className="w-3.5 h-3.5" /> },
    { label: 'End Time', value: end ? end.toLocaleString() : 'In Progress', icon: <Clock className="w-3.5 h-3.5" /> },
    { label: 'Duration', value: formatDuration(durationMs), icon: <ActivityIcon className="w-3.5 h-3.5" /> },
    { label: 'Location', value: data.system || data.siteName || 'Unknown Space', icon: <MapPin className="w-3.5 h-3.5" /> },
    { label: 'Activity Type', value: activity.type.toUpperCase(), icon: <ActivityIcon className="w-3.5 h-3.5" /> },
    { label: 'Operation ID', value: activity.id.substring(0, 12) + '...', icon: <Fingerprint className="w-3.5 h-3.5" /> },
  ]

  return (
    <ExpandableSection
      title="Session Metadata"
      icon={<Info className="w-4 h-4" />}
      variant="default"
      summary={
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">
          {activity.type.toUpperCase()} · {data.system || 'Unknown'} · {formatDuration(durationMs)}
        </p>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
        {metaItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-4 px-5 py-4 bg-white/5 border border-white/5 rounded-2xl group hover:bg-white/10 transition-all">
            <div className="p-2.5 rounded-xl bg-white/5 text-zinc-500 group-hover:text-zinc-300 transition-colors">
              {item.icon}
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                {item.label}
              </span>
              <span className="text-sm font-black text-zinc-200 truncate max-w-[180px]">
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ExpandableSection>
  )
}
