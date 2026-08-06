type SortField = 'name' | 'totalSp' | 'walletBalance' | 'lastFetchedAt'
type SortOrder = 'asc' | 'desc'

export function getSortCombinedLabel(
  sortField: SortField,
  sortOrder: SortOrder,
  t: (key: string) => string
): string {
  const fieldLabels: Record<SortField, string> = {
    name: t('characters.filters.sortName'),
    totalSp: t('characters.filters.sortSp'),
    walletBalance: t('characters.filters.sortIsk'),
    lastFetchedAt: t('characters.filters.sortLastUpdate'),
  }
  const direction =
    sortOrder === 'asc' ? t('characters.filters.sortAscShort') : t('characters.filters.sortDescShort')
  return `${fieldLabels[sortField]} (${direction})`
}

export function isDefaultSort(sortField: SortField, sortOrder: SortOrder): boolean {
  return sortField === 'name' && sortOrder === 'asc'
}
