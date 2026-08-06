import { prisma } from '@/lib/prisma'
import { esiClient } from '@/lib/esi-client'
import { logger } from '@/lib/server-logger'

interface KillmailSummary {
  killmail_id: number
  killmail_hash: string
  date: Date
}

interface KillmailDetail {
  killmail_id: number
  killmail_hash: string
  solar_system_id: number
  killmail_time: string
  victim: {
    character_id?: number
    corporation_id?: number
    alliance_id?: number
    ship_type_id: number
  }
  attackers: Array<{
    character_id?: number
    corporation_id?: number
    alliance_id?: number
    ship_type_id?: number
    weapon_type_id?: number
    final_blow: boolean
    damage_done: number
  }>
  items?: Array<{
    item_type_id: number
    quantity_destroyed?: number
    quantity_dropped?: number
  }>
  total_value?: number
}

interface CharacterMedal {
  medal_id: number
  title: string
  description: string
  corporation_id: number
  corporation_name: string
  date: string
}

// Cache functions removed — currently no-op stubs.
// TODO: Re-implement with in-memory LRU cache if needed.

export async function getCharacterKillmails(
  characterId: number,
  accessToken?: string,
  maxCount: number = 50
): Promise<KillmailSummary[]> {
  try {
    const response = await esiClient.get(`/characters/${characterId}/killmails/recent/`, {
      params: { max_count: maxCount },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    })

    const killmails = response.data.map((k: { killmail_id: number; killmail_hash: string; killmail_time?: string }) => ({
      killmail_id: k.killmail_id,
      killmail_hash: k.killmail_hash,
      date: new Date(k.killmail_time || Date.now()),
    }))

    return killmails
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('ESI', `Error fetching killmails for ${characterId}: ${message}`)
    return []
  }
}

export async function getKillmailDetail(
  killmailId: number,
  killmailHash: string
): Promise<KillmailDetail | null> {

  try {
    const response = await esiClient.get(`/killmails/${killmailId}/${killmailHash}/`)
    const data = response.data

    return {
      killmail_id: data.killmail_id,
      killmail_hash: data.killmail_hash,
      solar_system_id: data.solar_system_id,
      killmail_time: data.killmail_time,
      victim: data.victim,
      attackers: data.attackers,
      items: data.items,
      total_value: data.total_value,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('ESI', `Error fetching killmail ${killmailId}: ${message}`)
    return null
  }
}

export async function getCharacterMedals(
  characterId: number,
  accessToken: string
): Promise<CharacterMedal[]> {

  try {
    const response = await esiClient.get(`/characters/${characterId}/medals/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const medals = response.data.map((m: { medal_id: number; title: string; description: string; corporation_id: number; corporation_name: string; date: string }) => ({
      medal_id: m.medal_id,
      title: m.title,
      description: m.description,
      corporation_id: m.corporation_id,
      corporation_name: m.corporation_name,
      date: m.date,
    }))

    return medals
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('ESI', `Error fetching medals for ${characterId}: ${message}`)
    return []
  }
}

export async function getCharacterOnlineStatus(
  characterId: number,
  accessToken?: string
): Promise<{ online: boolean; last_login?: Date; last_logout?: Date }> {

  try {
    const response = await esiClient.get(`/characters/${characterId}/online/`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    })

    const data = response.data
    return {
      online: data.online,
      last_login: data.last_login ? new Date(data.last_login) : undefined,
      last_logout: data.last_logout ? new Date(data.last_logout) : undefined,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('ESI', `Error fetching online status for ${characterId}: ${message}`)
    return { online: false }
  }
}

export async function sendEmailViaESI(
  characterId: number,
  accessToken: string,
  recipients: number[],
  subject: string,
  body: string,
  toCorpOrAllianceId?: number
): Promise<boolean> {
  try {
    await esiClient.post(`/ui/openwindow/newmail/`, {
      recipients,
      subject,
      body,
      ...(toCorpOrAllianceId && { to_corp_or_alliance_id: toCorpOrAllianceId }),
    }, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return true
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('ESI', `Error sending email: ${message}`)
    return false
  }
}