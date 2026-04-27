/**
 * Dogma / validation entrypoints for Fits v2.
 * Implementation remains in `fitting-validation-service` and `dogma-calculator`;
 * this module is the stable import surface for the v2 service layer.
 */
export {
  validateFittingState,
  modulesToFitSlots,
  normalizeEditorModules,
} from '@/lib/fits/fitting-validation-service'

export type { FitValidationResult } from '@/lib/fits/fitting-validation-service'
