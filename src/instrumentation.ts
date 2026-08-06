export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startSchedulerHeartbeat } = await import('@/lib/scripts/internal-heartbeat')
    startSchedulerHeartbeat()
  }
}
