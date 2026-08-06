export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { getAppraisalByToken } from '@/lib/appraisal/get-appraisal'

/**
 * Public, read-only fetch of a saved appraisal by its share token. No auth — the
 * unguessable 128-bit token is the capability, same model as the shareable
 * character profile. Prices are the frozen snapshot from creation time.
 */
export const GET = withErrorHandling(
  async (_request: Request, context: { params: { token: string } }) => {
    const appraisal = await getAppraisalByToken(context.params.token)
    if (!appraisal) {
      throw new AppError(ErrorCodes.API_NOT_FOUND, 'Appraisal not found', 404)
    }
    return NextResponse.json(appraisal)
  }
)
