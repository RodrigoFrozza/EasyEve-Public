import { isChunkLoadError } from '@/lib/chunk-load-recovery'

describe('chunk-load-recovery', () => {
  it('detects chunk load errors', () => {
    expect(isChunkLoadError(new Error('Loading chunk 6542 failed.'))).toBe(true)
    expect(isChunkLoadError(Object.assign(new Error('failed'), { name: 'ChunkLoadError' }))).toBe(
      true
    )
    expect(isChunkLoadError(new Error('Something else'))).toBe(false)
  })
})
