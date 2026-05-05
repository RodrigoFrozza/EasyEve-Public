import Papa from 'papaparse'

export interface ExportActivity {
  id: string
  type: string
  status: string
  startTime: Date | string
  endTime?: Date | string | null
  region?: string | null
  space?: string | null
  isPaused?: boolean
  data?: Record<string, unknown>
}

export interface ExportOptions {
  filename?: string
  columns?: string[]
}

const ACTIVITY_COLUMNS: Record<keyof ExportActivity | string, string> = {
  id: 'ID',
  type: 'Type',
  status: 'Status',
  startTime: 'Start Time',
  endTime: 'End Time',
  region: 'Region',
  space: 'Space',
  isPaused: 'Paused',
  automatedBounties: 'Automated Bounties',
  automatedEss: 'ESS Bank',
  miningValue: 'Mining Value',
  totalQuantity: 'Quantity Mined',
  totalLootValue: 'Loot Value',
  systemsVisited: 'Systems Visited',
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString()
}

function extractActivityValue(data: Record<string, unknown> | undefined, key: string): string {
  if (!data) return '0'
  const value = data[key]
  if (value === null || value === undefined) return '0'
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  return String(value)
}

function calculateDuration(startTime: Date | string, endTime: Date | string | null | undefined): string {
  if (!endTime) return ''
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime
  const diffMs = end.getTime() - start.getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${minutes}m`
}

export function exportActivitiesToCSV(
  activities: ExportActivity[],
  options: ExportOptions = {}
): string {
  const { filename = 'activities' } = options

  const data = activities.map((activity) => ({
    ID: activity.id,
    Type: activity.type,
    Status: activity.status,
    'Start Time': formatDate(activity.startTime),
    'End Time': formatDate(activity.endTime),
    Duration: calculateDuration(activity.startTime, activity.endTime),
    Region: activity.region || '',
    Space: activity.space || '',
    Paused: activity.isPaused ? 'Yes' : 'No',
    'Automated Bounties': extractActivityValue(activity.data, 'automatedBounties'),
    'ESS Bank': extractActivityValue(activity.data, 'automatedEss'),
    'Mining Value': extractActivityValue(activity.data, 'miningValue'),
    'Total Quantity': extractActivityValue(activity.data, 'totalQuantity'),
    'Loot Value': extractActivityValue(activity.data, 'totalLootValue'),
    'Systems Visited': extractActivityValue(activity.data, 'systemsVisited'),
  }))

  return Papa.unparse(data, {
    quotes: true,
    quoteChar: '"',
    escapeChar: '"',
    delimiter: ',',
    header: true,
    newline: '\r\n',
  })
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportAndDownloadActivities(
  activities: ExportActivity[],
  options: ExportOptions = {}
): void {
  const csv = exportActivitiesToCSV(activities, options)
  downloadCSV(csv, options.filename || 'easyeve-activities')
}