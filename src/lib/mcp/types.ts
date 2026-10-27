import type { z } from 'zod'

/**
 * One MCP tool. `input` is validated with zod before `handler` runs, and its
 * JSON Schema (input side, so fields with defaults are optional) is what
 * `tools/list` advertises.
 *
 * Write tools must set `readOnly: false` and follow the confirm contract:
 * without `confirm: true` they only report what would change (see `writes.ts`).
 */
export interface McpTool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string
  title: string
  description: string
  input: S
  readOnly: boolean
  handler: (args: z.output<S>) => Promise<unknown>
}

export function defineTool<S extends z.ZodTypeAny>(tool: McpTool<S>): McpTool<S> {
  return tool
}

/** Thrown by tool handlers for expected, user-facing failures (not found, bad state). */
export class McpToolError extends Error {}
