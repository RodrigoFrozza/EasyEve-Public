export interface SubscriptionPlan {
  id: string
  durationDays: number
  priceIsk: number
  label: string
  popular?: boolean
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly',
    durationDays: 30,
    priceIsk: 100_000_000,
    label: 'Plano Mensal'
  },
  {
    id: 'quarterly',
    durationDays: 90,
    priceIsk: 250_000_000,
    label: 'Plano Trimestral',
    popular: true
  },
  {
    id: 'semiannual',
    durationDays: 180,
    priceIsk: 500_000_000,
    label: 'Plano Semestral'
  },
  {
    id: 'annual',
    durationDays: 365,
    priceIsk: 1_000_000_000,
    label: 'Plano Anual'
  }
]

export const FREE_PLAN_LIMITS = {
  maxCharactersPerActivity: 1,
  maxConcurrentActivities: 1,
  hasLeaderboard: false,
  hasFitManagement: false
}
