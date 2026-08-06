export const ABYSSAL_DEFAULT_TIER = 'T6 (Cataclysmic)'
export const ABYSSAL_DEFAULT_WEATHER = 'Electrical'
export const ABYSSAL_DEFAULT_SHIP = 'Undefined'

export function getAbyssalRunDefaults(
  lastRunDefaults?: { tier?: string; weather?: string; ship?: string } | null
) {
  return {
    tier: lastRunDefaults?.tier || ABYSSAL_DEFAULT_TIER,
    weather: lastRunDefaults?.weather || ABYSSAL_DEFAULT_WEATHER,
    ship: lastRunDefaults?.ship || ABYSSAL_DEFAULT_SHIP,
  }
}
