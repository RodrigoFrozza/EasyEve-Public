export interface RattingCsvLog {
  date: string
  charName?: string
  type?: string
  amount?: number
}

export interface RattingCsvLabels {
  date: string
  character: string
  type: string
  amount: string
  unknown: string
}

/** Pure CSV-string builder for the ratting activity log export — kept
 *  separate from the DOM download side effect so it's directly testable. */
export function buildRattingLogsCsv(logs: RattingCsvLog[], labels: RattingCsvLabels): string {
  const headers = [labels.date, labels.character, labels.type, labels.amount]
  const csvRows = [headers.join(',')]

  logs.forEach((log) => {
    const dateStr = new Date(log.date).toISOString().replace(/T/, ' ').replace(/\..+/, '')
    const char = log.charName || labels.unknown
    const type = log.type || 'entry'
    const amount = Math.round(log.amount || 0)
    csvRows.push(`${dateStr},${char},${type},${amount}`)
  })

  return csvRows.join('\n')
}
