import { CreateFittingSchema, resolveFitShipTypeId } from './index'

// Regression test for AUDIT_REPORT_2026-07-05.md #5.1: both fit editors used to
// save their local `shipId` field straight onto the wire, but the API schema
// only recognized `shipTypeId` — Zod silently stripped the unknown key and the
// fit was persisted with no ship. Covers the schema accepting the legacy alias
// and the normalization helper the routes use to resolve the DB column value.
describe('CreateFittingSchema / resolveFitShipTypeId (fit shipId <-> shipTypeId round-trip)', () => {
  const basePayload = {
    name: 'Test Fit',
    ship: 'Rifter',
    modules: [],
  }

  it('accepts a payload sent with the canonical shipTypeId field', () => {
    const parsed = CreateFittingSchema.parse({ ...basePayload, shipTypeId: 587 })
    expect(parsed.shipTypeId).toBe(587)
    expect(resolveFitShipTypeId(parsed)).toBe(587)
  })

  it('accepts a payload sent with the legacy shipId field (pre-fix client bundle)', () => {
    const parsed = CreateFittingSchema.parse({ ...basePayload, shipId: 587 })
    // Zod no longer drops the field: it's readable back off the parsed body...
    expect(parsed.shipId).toBe(587)
    // ...and the route-level normalization resolves it to the same DB value
    // that a canonical shipTypeId payload would produce.
    expect(resolveFitShipTypeId(parsed)).toBe(587)
  })

  it('prefers shipTypeId over shipId when a client sends both', () => {
    const parsed = CreateFittingSchema.parse({ ...basePayload, shipTypeId: 587, shipId: 999 })
    expect(resolveFitShipTypeId(parsed)).toBe(587)
  })

  it('resolves to undefined when neither field is present, so a PUT never clears the ship via ??', () => {
    const parsed = CreateFittingSchema.parse({ ...basePayload })
    expect(resolveFitShipTypeId(parsed)).toBeUndefined()

    const existingShipTypeId = 587
    expect(resolveFitShipTypeId(parsed) ?? existingShipTypeId).toBe(existingShipTypeId)
  })

  it('keeps working through .partial() as used by the PUT route', () => {
    const PartialSchema = CreateFittingSchema.partial()

    const legacyPatch = PartialSchema.parse({ shipId: 12345 })
    expect(resolveFitShipTypeId(legacyPatch)).toBe(12345)

    const canonicalPatch = PartialSchema.parse({ shipTypeId: 12345 })
    expect(resolveFitShipTypeId(canonicalPatch)).toBe(12345)
  })

  it('simulates the create-payload result: both shipId-only and shipTypeId-only fits end up with a persisted ship', () => {
    const fromLegacyClient = CreateFittingSchema.parse({ ...basePayload, shipId: 42 })
    const fromFixedClient = CreateFittingSchema.parse({ ...basePayload, shipTypeId: 42 })

    const persistedShipTypeIdLegacy = resolveFitShipTypeId(fromLegacyClient) ?? undefined
    const persistedShipTypeIdFixed = resolveFitShipTypeId(fromFixedClient) ?? undefined

    expect(persistedShipTypeIdLegacy).toBe(42)
    expect(persistedShipTypeIdFixed).toBe(42)
    expect(persistedShipTypeIdLegacy).toBe(persistedShipTypeIdFixed)
  })
})
