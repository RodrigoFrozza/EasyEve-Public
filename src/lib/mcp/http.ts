import { mcpTokenConfigured, mcpTokenMatches } from './auth'
import { handleMcpMessage, parseErrorResponse, type JsonRpcResponse } from './protocol'
import { MCP_TOOLS } from './tools'

export interface McpHttpResult {
  status: number
  /** JSON body; absent for 202/404 replies. */
  json?: unknown
}

/**
 * Transport core of POST /api/mcp, kept free of Request/Response so it can be
 * unit-tested in the jsdom Jest environment. With MCP_TOKEN unset (or a
 * placeholder) the endpoint answers 404, i.e. it does not exist.
 */
export async function handleMcpHttpPost(authorization: string | null, rawBody: string): Promise<McpHttpResult> {
  if (!mcpTokenConfigured()) return { status: 404 }
  if (!mcpTokenMatches(authorization)) return { status: 401, json: { error: 'Unauthorized' } }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return { status: 400, json: parseErrorResponse() }
  }

  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map((m) => handleMcpMessage(m, MCP_TOOLS)))).filter(
      (r): r is JsonRpcResponse => r !== null
    )
    return responses.length > 0 ? { status: 200, json: responses } : { status: 202 }
  }

  const response = await handleMcpMessage(body, MCP_TOOLS)
  return response ? { status: 200, json: response } : { status: 202 }
}
