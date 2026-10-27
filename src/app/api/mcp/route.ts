import { NextResponse } from 'next/server'
import { handleMcpHttpPost } from '@/lib/mcp/http'

export const dynamic = 'force-dynamic'

/**
 * EasyEve admin MCP server (Streamable HTTP, stateless JSON). See docs/MCP_SERVER.md.
 * Auth: `Authorization: Bearer $MCP_TOKEN`. With MCP_TOKEN unset the route 404s.
 */
export async function POST(request: Request) {
  const result = await handleMcpHttpPost(request.headers.get('authorization'), await request.text())
  return result.json !== undefined
    ? NextResponse.json(result.json, { status: result.status })
    : new NextResponse(null, { status: result.status })
}

// No server-initiated SSE stream and no sessions to terminate.
export async function GET() {
  return new NextResponse('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } })
}

export async function DELETE() {
  return new NextResponse('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } })
}
