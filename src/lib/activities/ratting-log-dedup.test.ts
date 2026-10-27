import {
  buildRattingLogFromJournalEntry,
  classifyRattingJournalRefType,
  isSameRattingEvent,
  normalizeRattingLog,
  rattingLogDedupKey,
  rattingLogMapHasEquivalent,
  rattingLogSemanticKey,
  registerRattingLogInMap,
  type RattingLogLike,
} from './ratting-log-dedup'

const CHAR_ID = 2123456789
const CHAR_NAME = 'Rodrigo Frozza'
const BOUNTY_DATE = '2026-05-21T19:39:22Z'
const BOUNTY_AMOUNT = 5_870_000
const REF_ID = '987654321'

describe('ratting-log-dedup', () => {
  describe('normalizeRattingLog', () => {
    it('fills charId and refId from legacy field names', () => {
      const legacy: RattingLogLike = {
        id: REF_ID,
        characterId: CHAR_ID,
        characterName: CHAR_NAME,
        type: 'bounty',
        date: BOUNTY_DATE,
        amount: BOUNTY_AMOUNT,
      }
      const n = normalizeRattingLog(legacy)
      expect(n.charId).toBe(CHAR_ID)
      expect(n.refId).toBe(REF_ID)
      expect(n.charName).toBe(CHAR_NAME)
    })

    it('buildRattingLogFromJournalEntry matches wallet sync shape', () => {
      const log = buildRattingLogFromJournalEntry(
        { id: Number(REF_ID), date: BOUNTY_DATE, amount: BOUNTY_AMOUNT },
        CHAR_ID,
        CHAR_NAME,
        'bounty'
      )
      expect(log).toEqual({
        refId: REF_ID,
        date: BOUNTY_DATE,
        amount: BOUNTY_AMOUNT,
        type: 'bounty',
        charName: CHAR_NAME,
        charId: CHAR_ID,
      })
    })
  })

  describe('classifyRattingJournalRefType', () => {
    it('classifies corporation tax before bounty', () => {
      expect(classifyRattingJournalRefType('bounty_prize_corporation_tax')).toBe('tax')
      expect(classifyRattingJournalRefType('bounty_prizes')).toBe('bounty')
    })
  })

  describe('first bounty duplicate scenario', () => {
    /** Log as auto-detection used to persist (no charId/refId, only spread ESI id). */
    const legacyAutoDetectLog: RattingLogLike = {
      type: 'bounty',
      amount: BOUNTY_AMOUNT,
      charName: CHAR_NAME,
      date: BOUNTY_DATE,
      id: REF_ID,
    }

    const walletSyncLog = buildRattingLogFromJournalEntry(
      { id: Number(REF_ID), date: BOUNTY_DATE, amount: BOUNTY_AMOUNT },
      CHAR_ID,
      CHAR_NAME,
      'bounty'
    )

    it('treats legacy auto-detect log and wallet log as the same event', () => {
      expect(isSameRattingEvent(legacyAutoDetectLog, walletSyncLog)).toBe(true)
    })

    it('does not add wallet log when legacy log is already in map', () => {
      const logMap = new Map<string, RattingLogLike>()
      registerRattingLogInMap(logMap, legacyAutoDetectLog, CHAR_ID)

      expect(rattingLogMapHasEquivalent(logMap, walletSyncLog, CHAR_ID)).toBe(true)
    })

    it('normalized auto-detect log shares primary dedup key with wallet log', () => {
      const legacyKey = rattingLogDedupKey(legacyAutoDetectLog, CHAR_ID)
      const walletKey = rattingLogDedupKey(walletSyncLog)
      expect(legacyKey).toBe(walletKey)
      expect(legacyKey).toBe(`${CHAR_ID}-${REF_ID}-bounty-${new Date(BOUNTY_DATE).getTime()}`)
    })

    it('semantic keys match when refId was missing on legacy row', () => {
      const withoutRef: RattingLogLike = {
        type: 'bounty',
        amount: BOUNTY_AMOUNT,
        charName: CHAR_NAME,
        charId: CHAR_ID,
        date: BOUNTY_DATE,
      }
      expect(rattingLogSemanticKey(withoutRef)).toBe(rattingLogSemanticKey(walletSyncLog))
    })
  })

  describe('registerRattingLogInMap', () => {
    it('stores one canonical log per event under multiple lookup keys', () => {
      const logMap = new Map<string, RattingLogLike>()
      const log = buildRattingLogFromJournalEntry(
        { id: 1, date: BOUNTY_DATE, amount: 100 },
        CHAR_ID,
        CHAR_NAME,
        'bounty'
      )
      registerRattingLogInMap(logMap, log, CHAR_ID)

      expect(logMap.has(rattingLogDedupKey(log))).toBe(true)
      expect(logMap.has(rattingLogSemanticKey(log))).toBe(true)
      expect(rattingLogMapHasEquivalent(logMap, log)).toBe(true)
    })
  })
})
