/** CCP image server only accepts powers of two between 32 and 1024. */
export const EVE_IMAGE_URL = 'https://images.evetech.net'

const VALID_EVE_IMAGE_SIZES = [32, 64, 128, 256, 512, 1024] as const

export function normalizeEveImageSize(displayPx: number): number {
  const target = Math.max(32, Math.ceil(displayPx))
  for (const size of VALID_EVE_IMAGE_SIZES) {
    if (size >= target) return size
  }
  return 1024
}

export function eveTypeIconUrl(typeId: number, displayPx: number): string {
  return `${EVE_IMAGE_URL}/types/${typeId}/icon?size=${normalizeEveImageSize(displayPx)}`
}

export function eveTypeRenderUrl(typeId: number, displayPx: number): string {
  return `${EVE_IMAGE_URL}/types/${typeId}/render?size=${normalizeEveImageSize(displayPx)}`
}
