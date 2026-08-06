/** SDE type_ids for deployable cargo containers (standard + secure + faction variants). */
export const CONTAINER_TYPE_IDS = [
  17364, 17365, 17366, 17367, 17368, 17369,
  33397, 33398, 33399, 33400, 33401, 33402,
  17370, 17531, 17532, 17533, 17534, 17535,
  17536, 17537, 17538, 17539, 26872,
] as const

export const CONTAINER_TYPE_ID_SET = new Set<number>(CONTAINER_TYPE_IDS)

/** SDE type_id for the Mobile Tractor Unit. Deployed in space (not inside a
 *  station/structure), so it can't be discovered via the Structure -> Container
 *  flow — it needs its own type_id-based asset search. */
export const MOBILE_TRACTOR_UNIT_TYPE_ID = 28748
