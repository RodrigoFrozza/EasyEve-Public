import { prisma } from '@/lib/prisma'

const ESI_BASE_URL = 'https://esi.evetech.net/latest'
const USER_AGENT = 'EasyEve/1.0.0 (https://github.com/RodrigoFrozza/EasyEve_)'

export interface FilamentType {
  id: number
  name: string
  weather: string
  tier: number
  effect: string
  published: boolean
}

const WEATHER_MAP: Record<string, { weather: string, tier: number }> = {
  'Calm': { weather: 'calm', tier: 1 },
  'Agitated': { weather: 'agitated', tier: 2 },
  'Fierce': { weather: 'fierce', tier: 3 },
  'Raging': { weather: 'raging', tier: 4 },
  'Chaotic': { weather: 'chaotic', tier: 5 },
  'Cataclysmic': { weather: 'cataclysmic', tier: 6 },
}

const EFFECT_MAP: Record<string, string> = {
  'Electrical': 'electrical',
  'Dark': 'dark',
  'Exotic': 'exotic',
  'Firestorm': 'firestorm',
  'Gamma': 'gamma',
}

export async function fetchFilamentTypesFromESI(): Promise<FilamentType[]> {
  // We no longer need this as sync-sde.ts handles it into EveType
  return getFilamentTypes()
}

export async function syncFilamentTypes(): Promise<void> {
  // Redundant - handled by scripts/sync-sde.ts
}

export async function getFilamentTypes(): Promise<FilamentType[]> {
  const cached = await prisma.sdeCache.findUnique({
    where: { key: 'filament_types' },
  })
  
  if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
    return (cached.value as unknown) as FilamentType[]
  }
  
  const dbFilaments = await prisma.eveType.findMany({
    where: { 
      groupId: 1979, // Abyssal Filaments
      published: true 
    },
    orderBy: { name: 'asc' },
  })
  
  const mappedFilaments: FilamentType[] = dbFilaments.map(type => {
    const fullName = type.name
    let weather = 'unknown'
    let tier = 1
    let effect = 'unknown'
    
    for (const [weatherKey, config] of Object.entries(WEATHER_MAP)) {
      if (fullName.includes(weatherKey)) {
        weather = config.weather
        tier = config.tier
        break
      }
    }
    
    for (const [effectKey, effectValue] of Object.entries(EFFECT_MAP)) {
      if (fullName.includes(effectKey)) {
        effect = effectValue
        break
      }
    }
    
    return {
      id: type.id,
      name: fullName,
      weather,
      tier,
      effect,
      published: type.published,
    }
  })

  // Sort by tier after mapping
  mappedFilaments.sort((a, b) => a.tier - b.tier)
  
  if (mappedFilaments.length > 0) {
    await prisma.sdeCache.upsert({
      where: { key: 'filament_types' },
      create: {
        key: 'filament_types',
        value: mappedFilaments as unknown as any,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      update: {
        value: mappedFilaments as unknown as any,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
  }
  
  return mappedFilaments
}

export function getTierLabel(tier: number): string {
  const tiers: Record<number, string> = {
    1: 'Calm',
    2: 'Agitated',
    3: 'Fierce',
    4: 'Raging',
    5: 'Chaotic',
    6: 'Cataclysmic',
  }
  return tiers[tier] || `Tier ${tier}`
}
