/** Shared admin script types (kept separate from `registry.ts` to avoid circular imports with `scripts/` handlers). */

export interface ScriptContext {
  executionId: string
  params: Record<string, any>
  dryRun: boolean
  addLog: (level: 'info' | 'success' | 'error' | 'warning', message: string) => void
  updateProgress: (progress: Record<string, any>) => void
  shouldStop: () => Promise<boolean>
}

export type ScriptHandler = (ctx: ScriptContext) => Promise<void>
