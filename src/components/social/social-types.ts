export interface SocialContact {
  id: string
  contactId: string
  name: string
  isOnline: boolean
  isTester: boolean
  mainCharacterId?: string
  activeActivity?: {
    type: string
  }
  updatedAt: string
}

export interface PlayerSearchUser {
  id: string
  name: string
  mainCharacterId?: string
}

export type FriendsSubTab = 'friends' | 'pending' | 'sent' | 'search'

export type SocialMainTab = 'friends' | 'notifications'
