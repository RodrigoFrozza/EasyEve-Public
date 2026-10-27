import { buildRattingLogsCsv } from './ratting-csv-export'

const labels = {
  date: 'Date',
  character: 'Character',
  type: 'Type',
  amount: 'Amount (ISK)',
  unknown: 'Unknown',
}

describe('buildRattingLogsCsv', () => {
  it('writes the header row followed by one row per log', () => {
    const csv = buildRattingLogsCsv(
      [
        { date: '2026-06-01T12:00:00.000Z', charName: 'Pilot One', type: 'bounty', amount: 1234.6 },
        { date: '2026-06-01T12:05:00.000Z', charName: 'Pilot Two', type: 'ess', amount: 500 },
      ],
      labels
    )

    const rows = csv.split('\n')
    expect(rows[0]).toBe('Date,Character,Type,Amount (ISK)')
    expect(rows[1]).toBe('2026-06-01 12:00:00,Pilot One,bounty,1235')
    expect(rows[2]).toBe('2026-06-01 12:05:00,Pilot Two,ess,500')
  })

  it('falls back to the unknown-character label when charName is missing', () => {
    const csv = buildRattingLogsCsv([{ date: '2026-06-01T12:00:00.000Z', type: 'bounty', amount: 100 }], labels)

    expect(csv.split('\n')[1]).toBe('2026-06-01 12:00:00,Unknown,bounty,100')
  })

  it('falls back to "entry" when type is missing and rounds a missing amount to 0', () => {
    const csv = buildRattingLogsCsv([{ date: '2026-06-01T12:00:00.000Z', charName: 'Pilot' }], labels)

    expect(csv.split('\n')[1]).toBe('2026-06-01 12:00:00,Pilot,entry,0')
  })

  it('returns only the header row when there are no logs', () => {
    expect(buildRattingLogsCsv([], labels)).toBe('Date,Character,Type,Amount (ISK)')
  })
})
