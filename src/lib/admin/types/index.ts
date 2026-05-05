export interface AdminStats {
  totalAccounts: number
  activeSubscriptions: number
  pendingIsk: number
  totalCharacters: number
  trends?: {
    accounts: { value: number; isUp: boolean }
    subscriptions: { value: number; isUp: boolean }
    isk: { value: number; isUp: boolean }
    characters: { value: number; isUp: boolean }
  }
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  isBlocked: boolean
  createdAt: Date
  characterCount: number
}

export interface AdminPayment {
  id: string
  userId: string
  userName: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  createdAt: Date
}

export interface AdminLog {
  id: string
  userId: string
  event: string
  details: Record<string, unknown>
  createdAt: Date
}
