import { parseCharacterPagination } from './pagination'

describe('parseCharacterPagination', () => {
  it('returns non-paginated defaults when params are missing', () => {
    const result = parseCharacterPagination({ pageParam: null, limitParam: null })
    expect(result).toEqual({
      paginated: false,
      page: 1,
      limit: 25,
      skip: 0,
    })
  })

  it('sanitizes invalid values', () => {
    const result = parseCharacterPagination({ pageParam: '-9', limitParam: '0' })
    expect(result).toEqual({
      paginated: true,
      page: 1,
      limit: 1,
      skip: 0,
    })
  })

  it('caps max limit at 100', () => {
    const result = parseCharacterPagination({ pageParam: '2', limitParam: '9999' })
    expect(result).toEqual({
      paginated: true,
      page: 2,
      limit: 100,
      skip: 100,
    })
  })

  it('falls back to defaults on NaN values', () => {
    const result = parseCharacterPagination({ pageParam: 'abc', limitParam: 'xyz' })
    expect(result).toEqual({
      paginated: true,
      page: 1,
      limit: 25,
      skip: 0,
    })
  })
})
