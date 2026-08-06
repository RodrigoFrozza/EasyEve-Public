import { aggregateActivityData } from './leaderboard'

describe('aggregateActivityData', () => {
  describe('RATTING', () => {
    it('should aggregate basic bounties and ESS', () => {
      const data = {
        automatedBounties: 1000000,
        automatedEss: 500000
      }
      const result = aggregateActivityData(data as any, 'RATTING')
      
      expect(result.total).toBe(1500000)
      expect(result.label1).toBe(1000000)
      expect(result.label2).toBe(500000)
    })

    it('should include additional income fields', () => {
      const data = {
        automatedBounties: 1000000,
        automatedEss: 500000,
        additionalBounties: 100000,
        estimatedLootValue: 200000,
        estimatedSalvageValue: 50000
      }
      const result = aggregateActivityData(data as any, 'RATTING')
      
      expect(result.total).toBe(1850000)
      expect(result.label1).toBe(1000000)
      expect(result.label2).toBe(500000)
    })

    it('should handle null data', () => {
      const result = aggregateActivityData(null, 'RATTING')
      
      expect(result.total).toBe(0)
      expect(result.label1).toBe(0)
      expect(result.label2).toBe(0)
    })

    it('should handle undefined values as zero', () => {
      const data = {} as any
      const result = aggregateActivityData(data, 'RATTING')
      
      expect(result.total).toBe(0)
    })
  })

  describe('MINING', () => {
    it('should aggregate mining value', () => {
      const data = {
        miningValue: 50000000,
        totalQuantity: 1000
      }
      const result = aggregateActivityData(data as any, 'MINING')
      
      expect(result.total).toBe(50000000)
      expect(result.label1).toBe(1000)
    })

    it('should use totalEstimatedValue as fallback', () => {
      const data = {
        totalEstimatedValue: 30000000,
        totalQuantity: 500
      }
      const result = aggregateActivityData(data as any, 'MINING')
      
      expect(result.total).toBe(30000000)
      expect(result.label1).toBe(500)
    })

    it('should prioritize miningValue over totalEstimatedValue', () => {
      const data = {
        miningValue: 50000000,
        totalEstimatedValue: 30000000,
        totalQuantity: 1000
      }
      const result = aggregateActivityData(data as any, 'MINING')
      
      expect(result.total).toBe(50000000)
    })
  })

  describe('EXPLORATION', () => {
    it('should aggregate exploration value', () => {
      const data = {
        totalLootValue: 25000000,
        systemsVisited: 15
      }
      const result = aggregateActivityData(data as any, 'EXPLORATION')
      
      expect(result.total).toBe(25000000)
      expect(result.label1).toBe(15)
    })

    it('should use totalEstimatedValue as fallback', () => {
      const data = {
        totalEstimatedValue: 10000000,
        systemsVisited: 5
      }
      const result = aggregateActivityData(data as any, 'EXPLORATION')
      
      expect(result.total).toBe(10000000)
      expect(result.label1).toBe(5)
    })
  })
})