const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export interface CharacterPaginationInput {
  pageParam: string | null
  limitParam: string | null
}

export interface CharacterPagination {
  paginated: boolean
  page: number
  limit: number
  skip: number
}

export function parseCharacterPagination(input: CharacterPaginationInput): CharacterPagination {
  const { pageParam, limitParam } = input
  const rawPage = Number.parseInt(pageParam || `${DEFAULT_PAGE}`, 10)
  const rawLimit = Number.parseInt(limitParam || `${DEFAULT_LIMIT}`, 10)
  const paginated = pageParam !== null || limitParam !== null

  const page = Number.isNaN(rawPage) ? DEFAULT_PAGE : Math.max(1, rawPage)
  const limit = Number.isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(Math.max(1, rawLimit), MAX_LIMIT)
  const skip = (page - 1) * limit

  return {
    paginated,
    page,
    limit,
    skip,
  }
}
