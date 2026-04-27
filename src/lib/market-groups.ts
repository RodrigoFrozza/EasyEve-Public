import { ESI_BASE_URL, USER_AGENT, MarketGroupNode } from '@/lib/constants/market'
import { batchPromiseAll } from '@/lib/utils'

interface MarketGroupResponse {
  market_group_id: number
  name: string
  description?: string
  parent_group_id: number | null
  types: number[]
}

export async function fetchMarketGroup(
  groupId: number,
  language: string = 'en'
): Promise<MarketGroupResponse | null> {
  try {
    const response = await fetch(
      `${ESI_BASE_URL}/markets/groups/${groupId}/?datasource=tranquility&language=${language}`,
      {
        headers: { 'User-Agent': USER_AGENT }
      }
    )
    
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

export async function buildMarketGroupTree(
  groupIds: number[],
  language: string = 'en'
): Promise<MarketGroupNode[]> {
  const groupMap = new Map<number, MarketGroupNode>()
  const roots: MarketGroupNode[] = []

  const GROUP_FETCH_CONCURRENCY = 15
  const results = await batchPromiseAll(groupIds, GROUP_FETCH_CONCURRENCY, async (id) => {
    const data = await fetchMarketGroup(id, language)
    return { id, data }
  })

  for (const { id, data } of results) {
    if (!data || !data.types || data.types.length === 0) continue

    const node: MarketGroupNode = {
      id: data.market_group_id,
      name: data.name,
      description: data.description,
      parentId: data.parent_group_id,
      children: [],
      items: []
    }

    groupMap.set(id, node)
  }

  for (const node of groupMap.values()) {
    if (node.parentId === null || !groupMap.has(node.parentId)) {
      roots.push(node)
    } else {
      const parent = groupMap.get(node.parentId)
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
  }

  function sortTree(nodes: MarketGroupNode[]): MarketGroupNode[] {
    const sorted = nodes.sort((a, b) => a.name.localeCompare(b.name))
    for (const node of sorted) {
      node.children = sortTree(node.children)
    }
    return sorted
  }

  return sortTree(roots)
}
