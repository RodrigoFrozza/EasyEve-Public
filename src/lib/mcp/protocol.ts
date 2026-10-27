import { z, ZodError } from 'zod'
import { logger } from '@/lib/server-logger'
import { McpToolError, type McpTool } from './types'

/**
 * Minimal MCP server over Streamable HTTP, stateless JSON mode: every POST carries
 * JSON-RPC message(s) and gets a plain `application/json` reply — no SSE, no
 * session id. Only the subset EasyEve needs: initialize, ping, tools/list,
 * tools/call. Hand-rolled on purpose: ~150 lines and no new dependency in a
 * production image.
 */

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0]

const SERVER_INFO = { name: 'easyeve', version: '1.0.0' }

const INSTRUCTIONS = [
  'EasyEve admin MCP. This talks to the LIVE database of the app — call env_info first to see which environment you are on.',
  'Read tools never return ESI tokens or share tokens. Lists are capped; use the returned nextCursor to page.',
  'Write tools (set_*) are dry-run by default: they return before/after without changing anything.',
  'Only pass confirm: true after the user has approved that specific change. Every confirmed write is audited in SecurityEvent (event MCP_WRITE).',
].join('\n')

const TOOL_TIMEOUT_MS = 20_000

const JSONRPC_PARSE_ERROR = -32700
const JSONRPC_INVALID_REQUEST = -32600
const JSONRPC_METHOD_NOT_FOUND = -32601
const JSONRPC_INVALID_PARAMS = -32602

type JsonRpcId = string | number | null

interface JsonRpcMessage {
  jsonrpc?: unknown
  id?: unknown
  method?: unknown
  params?: unknown
}

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId; error: { code: number; message: string } }

function ok(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result }
}

function fail(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

export function parseErrorResponse(): JsonRpcResponse {
  return fail(null, JSONRPC_PARSE_ERROR, 'Parse error')
}

function toolDescriptor(tool: McpTool) {
  const { $schema: _ignored, ...inputSchema } = z.toJSONSchema(tool.input, { io: 'input' }) as Record<
    string,
    unknown
  >
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema,
    annotations: {
      title: tool.title,
      readOnlyHint: tool.readOnly,
      destructiveHint: !tool.readOnly,
      idempotentHint: true,
      openWorldHint: false,
    },
  }
}

/** JSON.stringify that survives BigInt (raw Prisma aggregates can return it). */
function toJsonText(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new McpToolError(`Tool timed out after ${ms / 1000}s`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function callTool(tools: Map<string, McpTool>, id: JsonRpcId, params: unknown) {
  const { name, arguments: rawArgs } = (params ?? {}) as { name?: unknown; arguments?: unknown }
  const tool = typeof name === 'string' ? tools.get(name) : undefined
  if (!tool) {
    return fail(id, JSONRPC_INVALID_PARAMS, `Unknown tool: ${String(name)}`)
  }

  try {
    const args = tool.input.parse(rawArgs ?? {})
    const result = await withTimeout(tool.handler(args), TOOL_TIMEOUT_MS)
    return ok(id, { content: [{ type: 'text', text: toJsonText(result) }] })
  } catch (error) {
    // Tool failures go back as isError results (the model sees them and can
    // correct itself); they are not JSON-RPC protocol errors.
    let message: string
    if (error instanceof ZodError) {
      message = `Invalid arguments: ${error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`
    } else if (error instanceof McpToolError) {
      message = error.message
    } else {
      logger.error('MCP', `Tool ${tool.name} failed`, error)
      message = `Internal error in ${tool.name}: ${error instanceof Error ? error.message : String(error)}`
    }
    return ok(id, { content: [{ type: 'text', text: message }], isError: true })
  }
}

/**
 * Handles one JSON-RPC message. Returns null for notifications and for
 * client responses, which get no reply.
 */
export async function handleMcpMessage(
  message: unknown,
  tools: Map<string, McpTool>
): Promise<JsonRpcResponse | null> {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return fail(null, JSONRPC_INVALID_REQUEST, 'Invalid request')
  }
  const msg = message as JsonRpcMessage
  const hasId = 'id' in msg && (typeof msg.id === 'string' || typeof msg.id === 'number')
  const id: JsonRpcId = hasId ? (msg.id as string | number) : null

  if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    // A response object from the client (result/error, no method) needs no reply.
    if (msg.jsonrpc === '2.0' && hasId && msg.method === undefined) return null
    return fail(id, JSONRPC_INVALID_REQUEST, 'Invalid request')
  }

  if (!hasId) return null // notification (e.g. notifications/initialized)

  switch (msg.method) {
    case 'initialize': {
      const requested = (msg.params as { protocolVersion?: unknown } | undefined)?.protocolVersion
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested as never)
        ? (requested as string)
        : LATEST_PROTOCOL_VERSION
      return ok(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return ok(id, {})
    case 'tools/list':
      return ok(id, { tools: Array.from(tools.values()).map(toolDescriptor) })
    case 'tools/call':
      return callTool(tools, id, msg.params)
    default:
      return fail(id, JSONRPC_METHOD_NOT_FOUND, `Method not found: ${msg.method}`)
  }
}
