import {
  appendRattingExpense,
  deleteRattingExpense,
  recalcExpenseTotals,
  dedupeRattingExpenses,
} from './ratting-manual-entries'
import { getActivityFinancialMetrics } from './activity-metrics'

describe('ratting session expenses', () => {
  it('appendRattingExpense adds expense entry and log', () => {
    const result = appendRattingExpense({}, {
      amount: 35_000_000,
      note: 'Lost Leshak + MTU',
      charName: 'Pilot One',
    })

    expect(result.sessionExpenses).toHaveLength(1)
    expect(result.sessionExpenses![0]).toMatchObject({
      amount: 35_000_000,
      note: 'Lost Leshak + MTU',
      charName: 'Pilot One',
    })
    expect(result.estimatedExpenseValue).toBe(35_000_000)
    expect(result.logs).toHaveLength(1)
    expect(result.logs![0]).toMatchObject({
      type: 'expense',
      amount: 35_000_000,
      note: 'Lost Leshak + MTU',
    })
  })

  it('appendRattingExpense works without optional note', () => {
    const result = appendRattingExpense({}, { amount: 5_000_000 })

    expect(result.sessionExpenses![0].note).toBeUndefined()
    expect(result.estimatedExpenseValue).toBe(5_000_000)
  })

  it('deleteRattingExpense removes expense and log', () => {
    const withExpense = appendRattingExpense({}, { amount: 10_000_000, note: 'MTU' })
    const refId = withExpense.sessionExpenses![0].refId

    const result = deleteRattingExpense(withExpense, refId)

    expect(result).not.toBeNull()
    expect(result!.sessionExpenses).toHaveLength(0)
    expect(result!.logs).toHaveLength(0)
    expect(result!.estimatedExpenseValue).toBe(0)
  })

  it('recalcExpenseTotals sums all expenses', () => {
    const totals = recalcExpenseTotals([
      { refId: 'a', amount: 100, recordedAt: '2026-01-01' },
      { refId: 'b', amount: 250, recordedAt: '2026-01-01' },
    ])

    expect(totals.estimatedExpenseValue).toBe(350)
  })

  it('dedupeRattingExpenses keeps first entry per refId', () => {
    const deduped = dedupeRattingExpenses([
      { refId: 'a', amount: 100, recordedAt: '2026-01-01' },
      { refId: 'a', amount: 999, recordedAt: '2026-01-02' },
    ])

    expect(deduped).toHaveLength(1)
    expect(deduped[0].amount).toBe(100)
  })
})

describe('getActivityFinancialMetrics expenses', () => {
  it('subtracts estimatedExpenseValue from ratting net', () => {
    const metrics = getActivityFinancialMetrics({
      type: 'ratting',
      data: {
        automatedBounties: 1_000_000,
        estimatedExpenseValue: 200_000,
      },
    })

    expect(metrics.expenses).toBe(200_000)
    expect(metrics.net).toBe(800_000)
  })
})
