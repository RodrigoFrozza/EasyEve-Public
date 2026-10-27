import { withErrorHandling } from '@/lib/api-handler'
import { withExternalAuth } from '@/lib/external-auth'
import { normalizeEditorModules } from '@/lib/fits/fitting-validation-service'
import {
  fittingServiceCapacitor,
  fittingServiceCompare,
  fittingServiceExplain,
  fittingServicePresets,
  fittingServiceRecommend,
  fittingServiceValidate,
} from '@/lib/fits-v2/fitting-service-v2'

export const dynamic = 'force-dynamic'

type FitPayload = {
  shipTypeId: number
  modules?: unknown[]
  drones?: Array<{ id: number; name: string; quantity: number }>
  cargo?: Array<{ id: number; name: string; quantity: number }>
}

async function postValidate(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    fit?: FitPayload
    rightFit?: FitPayload
    includeCapacitor?: boolean
    includeSuggestions?: boolean
    includeExplain?: boolean
    includeCompare?: boolean
    includePresets?: boolean
  }

  const fit = body.fit
  if (!fit || !fit.shipTypeId || !Number.isFinite(fit.shipTypeId)) {
    return {
      success: false,
      error: 'Missing fit.shipTypeId',
      hint: 'POST body example: {"fit":{"shipTypeId":587,"modules":[]}}',
    }
  }

  const modules = normalizeEditorModules(Array.isArray(fit.modules) ? fit.modules : [])
  const drones = Array.isArray(fit.drones) ? fit.drones : []
  const cargo = Array.isArray(fit.cargo) ? fit.cargo : []
  const userId = 'external-api-smoke'

  const validate = await fittingServiceValidate({
    shipTypeId: fit.shipTypeId,
    modules,
    drones,
    cargo,
    userId,
  })

  const out: Record<string, unknown> = {
    ok: true,
    validate,
  }

  if (body.includeCapacitor) {
    out.capacitor = await fittingServiceCapacitor({
      shipTypeId: fit.shipTypeId,
      modules,
      drones,
      cargo,
      userId,
    })
  }

  if (body.includeSuggestions) {
    out.recommend = await fittingServiceRecommend({
      shipTypeId: fit.shipTypeId,
      modules,
      drones,
      cargo,
      userId,
    })
  }

  if (body.includeExplain) {
    out.explain = await fittingServiceExplain({
      shipTypeId: fit.shipTypeId,
      modules,
      drones,
      cargo,
      userId,
    })
  }

  if (body.includeCompare && body.rightFit?.shipTypeId) {
    const right = body.rightFit
    out.compare = await fittingServiceCompare({
      left: {
        shipTypeId: fit.shipTypeId,
        modules,
        drones,
        cargo,
      },
      right: {
        shipTypeId: right.shipTypeId,
        modules: normalizeEditorModules(Array.isArray(right.modules) ? right.modules : []),
        drones: Array.isArray(right.drones) ? right.drones : [],
        cargo: Array.isArray(right.cargo) ? right.cargo : [],
      },
      userId,
    })
  }

  if (body.includePresets) {
    out.presets = fittingServicePresets()
  }

  return out
}

export const POST = withErrorHandling(withExternalAuth(postValidate))
