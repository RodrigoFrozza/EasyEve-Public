import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isPremium(subscriptionEnd: string | Date | null | undefined): boolean {
  if (!subscriptionEnd) return false
  const end = new Date(subscriptionEnd)
  return end.getTime() > new Date().getTime()
}

export function getRemainingDays(subscriptionEnd: string | Date | null | undefined): number {
  if (!subscriptionEnd) return 0
  const end = new Date(subscriptionEnd)
  const diff = end.getTime() - new Date().getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  return days > 0 ? days : 0
}

export function formatNumber(num: number | undefined | null): string {
  if (num == null || isNaN(num)) return '0'
  return new Intl.NumberFormat('en-US').format(num)
}

export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toLocaleString()
}

export function formatISK(isk: number | undefined | null): string {
  if (isk == null || isNaN(isk)) return '0 ISK'
  const isNegative = isk < 0
  const absIsk = Math.abs(isk)
  let result = ''
  
  if (absIsk >= 1_000_000_000) {
    result = `${(absIsk / 1_000_000_000).toFixed(2)}B ISK`
  } else if (absIsk >= 1_000_000) {
    result = `${(absIsk / 1_000_000).toFixed(2)}M ISK`
  } else if (absIsk >= 1_000) {
    result = `${(absIsk / 1_000).toFixed(2)}K ISK`
  } else {
    result = `${absIsk.toFixed(2)} ISK`
  }

  return isNegative ? `-${result}` : result
}

export function calculateNetProfit(data: any): number {
  if (!data) return 0
  const bounties = (data.automatedBounties || 0) + (data.automatedEss || 0) + (data.additionalBounties || 0)
  const assets = (data.estimatedLootValue || 0) + (data.estimatedSalvageValue || 0)
  const taxes = (data.automatedTaxes || 0)
  return (bounties + assets) - taxes
}

export function formatSP(sp: number | undefined | null): string {
  if (sp == null || isNaN(sp)) return '0 SP'
  if (sp >= 1_000_000) {
    return `${(sp / 1_000_000).toFixed(2)}M SP`
  }
  if (sp >= 1_000) {
    return `${(sp / 1_000).toFixed(1)}K SP`
  }
  return `${sp} SP`
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000)
  
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ]
  
  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds)
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`
    }
  }
  return 'just now'
}

export function parseScopesFromJwt(token: string | null): string[] {
  if (!token || !token.includes('.')) return []
  try {
    const segments = token.split('.')
    if (segments.length < 2) return []
    
    let payloadStr = ''
    try {
      // Browser environment
      if (typeof window !== 'undefined') {
        payloadStr = atob(segments[1])
      } else {
        // Node environment
        payloadStr = Buffer.from(segments[1], 'base64').toString()
      }
    } catch (e) {
      // Fallback for cases where atob or Buffer might fail with padding or specific chars
      console.warn('Base64 decode failed, trying alternative:', e)
      return []
    }
    
    const payload = JSON.parse(payloadStr)
    if (Array.isArray(payload.scp)) return payload.scp
    if (typeof payload.scp === 'string') return [payload.scp]
    return []
  } catch (error) {
    console.warn('Failed to parse scopes from token:', error)
    return []
  }
}

export interface SiteSafetyResult {
  name: string
  safety: 'safe' | 'not_safe' | 'warning'
  type: 'relic' | 'data' | 'sleeper' | 'ghost' | 'gas' | 'drone' | 'unknown'
  warnings: string[]
  difficulty: number
}

export function checkSiteSafety(siteName: string): SiteSafetyResult {
  const name = siteName.trim()
  const lowerName = name.toLowerCase()
  
  // GHOST / COVERT SITES - very dangerous!
  if (lowerName.includes('covert') || lowerName.includes('ghost')) {
    return {
      name,
      safety: 'not_safe',
      type: 'ghost',
      warnings: [
        'DANGER! Invisible time limit',
        'Hack failure causes 4000-6000 explosive damage',
        'Hostile NPCs spawn after timer ends'
      ],
      difficulty: 5
    }
  }
  
  // SLEEPER CACHE
  if (lowerName.includes('sleeper cache')) {
    const difficulty = lowerName.includes('superior') ? 5 : lowerName.includes('standard') ? 4 : 4
    const dangerMsg = lowerName.includes('superior') 
      ? 'Superior: Active sentinels, toxic clouds, explosions'
      : lowerName.includes('limited')
        ? 'Limited: Medium explosion risk'
        : 'Standard: multiple hazards'
    
    return {
      name,
      safety: 'not_safe',
      type: 'sleeper',
      warnings: [dangerMsg, 'Requires combat before hacking'],
      difficulty
    }
  }
  
  // DRONE DATA (Abandoned Research Complex)
  if (lowerName.includes('abandoned research complex') || lowerName.includes('drone')) {
    return {
      name,
      safety: 'not_safe',
      type: 'drone',
      warnings: [
        'Failure spawns hostile frigates (Rogue Drones)',
        'Only in Drone regions'
      ],
      difficulty: 3
    }
  }
  
  // FORGOTTEN / UNSECURED (Sleeper sites in wormholes)
  if (lowerName.includes('forgotten') || lowerName.includes('unsecured')) {
    return {
      name,
      safety: 'not_safe',
      type: 'relic',
      warnings: ['Active SLEEPERS! Combat required first'],
      difficulty: 5
    }
  }
  
  // GAS SITES
  if (lowerName.includes('gas') || lowerName.includes('nebula') || lowerName.includes('reservoir')) {
    const isSafe = lowerName.includes('nebula') && !lowerName.includes('reservoir')
    return {
      name,
      safety: isSafe ? 'warning' : 'not_safe',
      type: 'gas',
      warnings: isSafe 
        ? ['Nebula is safe in wormholes (timer starts on warp)']
        : ['Reservoir: NPCs spawn after timer', 'Be careful with gas mining in nullsec'],
      difficulty: 2
    }
  }
  
  // Pirate Relic Sites - by state
  if (lowerName.startsWith('crumbling') || lowerName.startsWith('ruined') || lowerName.startsWith('decayed')) {
    return {
      name,
      safety: 'safe',
      type: 'relic',
      warnings: [],
      difficulty: lowerName.startsWith('crumbing') || lowerName.startsWith('ruined') ? 1 : 2
    }
  }
  
  // Monument/Temple/Crystal (Hard relic sites)
  if (lowerName.startsWith('monument') || lowerName.startsWith('temple') || lowerName.startsWith('crystal')) {
    return {
      name,
      safety: 'safe',
      type: 'relic',
      warnings: [],
      difficulty: 4
    }
  }
  
  // Pirate Data Sites - by location
  if (lowerName.startsWith('local') || lowerName.startsWith('regional') || lowerName.startsWith('central')) {
    const diff = lowerName.startsWith('local') ? 1 : lowerName.startsWith('regional') ? 2 : 3
    return {
      name,
      safety: 'safe',
      type: 'data',
      warnings: [],
      difficulty: diff
    }
  }
  
  // Fallback - desconhecido
  return {
    name,
    safety: 'warning',
    type: 'unknown',
    warnings: ['Unknown site - verify manually'],
    difficulty: 0
  }
}

/**
 * Executes an array of async functions in batches to limit concurrency.
 * This prevents overwhelming external APIs or exhausting system resources.
 */
export async function batchPromiseAll<T, K>(
  items: T[],
  batchSize: number,
  iteratorFn: (item: T, index: number) => Promise<K>
): Promise<K[]> {
  const results: K[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map((item, index) => iteratorFn(item, i + index))
    )
    results.push(...batchResults)
  }
  return results
}
