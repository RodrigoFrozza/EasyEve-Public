export const PI_COLONIES_CACHE_PREFIX = 'pi-colonies:v3'

export function piColoniesCachePrefixForUser(userId: string): string {
  return `${PI_COLONIES_CACHE_PREFIX}:${userId}:`
}
