/**
 * Fixtures de colônia para os testes do pi-v2.
 *
 * A `sterileConduitsColony` reproduz a topologia da **6-IAFR I** real, que é a
 * colônia com a qual a Fase A foi validada contra o jogo: planeta-fábrica (sem
 * extrator), 5 HTIF de Sterile Conduits alimentados por uma launchpad de import
 * reposta à mão. Com 5 fábricas, o consumo de Water dá exatamente −200/h, que é
 * a taxa medida in-game — é isso que torna o caso âncora (4.600 → ~400 em 21h)
 * um teste ponta a ponta e não só um teste da fórmula isolada.
 */

import type { PiColonyLayout, PiColonySummary } from '@/lib/pi-v2/esi'

/** Sterile Conduits: 6× Smartfab Units + 40× Water + 6× Vaccines → 1, 1h. */
export const SCHEMATIC_STERILE_CONDUITS = 113
export const TYPE_SMARTFAB_UNITS = 2351
export const TYPE_WATER = 3645
export const TYPE_VACCINES = 28974
export const TYPE_STERILE_CONDUITS = 2875

const LAUNCHPAD = 2256
const HTIF = 2475

export const PIN_IMPORT_LAUNCHPAD = 500
export const PIN_EXPORT_LAUNCHPAD = 700
const FIRST_FACTORY_PIN = 600
const FACTORY_COUNT = 5

/**
 * Volumes reais (m³/un) que tornam este fixture fisicamente possível — uma
 * launchpad tem 10.000 m³, e enchê-la além disso faz a colônia nascer "lotada",
 * mascarando tudo o mais. Water 0,19 · Smartfab 3 · Nuclear Reactors 3 ·
 * Sterile Conduits 50.
 *
 * Defaults: 4.600 Water (23h a −200/h, ligeiramente sub-provisionado para uma
 * cadência de 24h) e 800 de cada P3 (26,7h, folgados). Total ≈ 5.674 m³ = 57%
 * da launchpad — o mesmo regime da colônia real.
 */
export interface SterileConduitsOptions {
  /** Estoque medido de Water na launchpad de import (default: o caso âncora). */
  waterAmount?: number
  smartfabAmount?: number
  vaccinesAmount?: number
  /** Produto acabado já acumulado na launchpad de saída (50 m³/un — cuidado). */
  sterileConduitsAmount?: number
}

/**
 * Planeta-fábrica: launchpad de import → 5 HTIF → launchpad de export.
 * Sem extrator, exatamente como os 35 planetas do Rodrigo.
 */
export function sterileConduitsColony(
  options: SterileConduitsOptions = {}
): PiColonyLayout {
  const {
    waterAmount = 4600,
    smartfabAmount = 800,
    vaccinesAmount = 800,
    sterileConduitsAmount = 0,
  } = options

  const factoryPinIds = Array.from({ length: FACTORY_COUNT }, (_, i) => FIRST_FACTORY_PIN + i)

  const routes: PiColonyLayout['routes'] = []
  let routeId = 1

  for (const pinId of factoryPinIds) {
    // Import: launchpad → fábrica, uma rota por insumo, na quantidade da receita.
    for (const [typeId, qty] of [
      [TYPE_SMARTFAB_UNITS, 6],
      [TYPE_WATER, 40],
      [TYPE_VACCINES, 6],
    ] as const) {
      routes.push({
        route_id: routeId++,
        source_pin_id: PIN_IMPORT_LAUNCHPAD,
        destination_pin_id: pinId,
        content_type_id: typeId,
        quantity: qty,
      })
    }
    // Export: fábrica → launchpad de saída.
    routes.push({
      route_id: routeId++,
      source_pin_id: pinId,
      destination_pin_id: PIN_EXPORT_LAUNCHPAD,
      content_type_id: TYPE_STERILE_CONDUITS,
      quantity: 1,
    })
  }

  return {
    links: [],
    routes,
    pins: [
      {
        pin_id: PIN_IMPORT_LAUNCHPAD,
        type_id: LAUNCHPAD,
        contents: [
          { type_id: TYPE_WATER, amount: waterAmount },
          { type_id: TYPE_SMARTFAB_UNITS, amount: smartfabAmount },
          { type_id: TYPE_VACCINES, amount: vaccinesAmount },
        ],
      },
      ...factoryPinIds.map((pin_id) => ({
        pin_id,
        type_id: HTIF,
        factory_details: { schematic_id: SCHEMATIC_STERILE_CONDUITS },
      })),
      {
        pin_id: PIN_EXPORT_LAUNCHPAD,
        type_id: LAUNCHPAD,
        contents: [{ type_id: TYPE_STERILE_CONDUITS, amount: sterileConduitsAmount }],
      },
    ],
  }
}

/** Colônia extrativa integrada: extrator → launchpad → BIF → launchpad. */
export function extractionColony(lastCycleAmount = 500): PiColonyLayout {
  return {
    links: [],
    routes: [
      {
        route_id: 1,
        source_pin_id: 100,
        destination_pin_id: 300,
        content_type_id: 2073,
        quantity: 5000,
      },
      {
        route_id: 2,
        source_pin_id: 300,
        destination_pin_id: 200,
        content_type_id: 2073,
        quantity: 20,
      },
    ],
    pins: [
      {
        pin_id: 100,
        type_id: 3060,
        install_time: '2026-07-20T00:00:00Z',
        expiry_time: '2026-07-23T00:00:00Z',
        extractor_details: {
          product_type_id: 2073,
          qty_per_cycle: 5000,
          cycle_time: 1800,
        },
      },
      { pin_id: 200, type_id: 2469, factory_details: { schematic_id: 131 } },
      {
        pin_id: 300,
        type_id: LAUNCHPAD,
        contents: [{ type_id: 2073, amount: lastCycleAmount }],
      },
    ],
  }
}

// --- 6-IAFR IX — Self-Harmonizing Power Core (cadeia integrada) ---------------
// Decodificada do template real do Rodrigo. É a colônia que expôs o bug do
// "Restock Hermetic Membranes": HM é FABRICADA aqui (AIF) e CONSUMIDA aqui
// (HTIF), com storages no meio. Nada de HM se compra — só Polyaramids,
// Genetically Enhanced Livestock, Camera Drones e Nuclear Reactors.

export const TYPE_HERMETIC_MEMBRANES = 2361
export const TYPE_POLYARAMIDS = 2321
export const TYPE_GEN_ENH_LIVESTOCK = 15317
export const TYPE_CAMERA_DRONES = 2345
export const TYPE_NUCLEAR_REACTORS = 2352
export const TYPE_SHPC = 2872

const SCHEMATIC_HERMETIC_MEMBRANES = 107 // 10 Polyaramids + 10 GEL -> 3 HM, 1h
const SCHEMATIC_SHPC = 115 // 6 Camera Drones + 6 Nuclear Reactors + 6 HM -> 1 SHPC, 1h

const AIF = 2474
const HTIF_SHPC = 2475

export const PIN_IX_IMPORT_LAUNCHPAD = 500
export const PIN_IX_HM_STORAGE = 700

export interface SelfHarmonizingOptions {
  /** Fábricas de Hermetic Membranes (3/h cada). Default 16 → 48/h. */
  membraneFactories?: number
  /** Fábricas de Self-Harmonizing (1/h cada, consomem 6 HM/h). Default 8 → 48/h. */
  powerCoreFactories?: number
  hermeticMembranesAmount?: number
  importedAmount?: number
}

/**
 * Cadeia integrada: launchpad de import → AIFs (HM) → storage → HTIFs (SHPC).
 * Com os defaults (16 AIF / 8 HTIF), HM fica exatamente balanceada — 48 produz,
 * 48 consome — que é o caso do bug: buffer de intermediário local equilibrado
 * jamais deveria pedir "restock".
 */
export function selfHarmonizingColony(options: SelfHarmonizingOptions = {}): PiColonyLayout {
  const {
    membraneFactories = 16,
    powerCoreFactories = 8,
    hermeticMembranesAmount = 48,
    importedAmount = 6000,
  } = options

  const aifIds = Array.from({ length: membraneFactories }, (_, i) => 1000 + i)
  const htifIds = Array.from({ length: powerCoreFactories }, (_, i) => 2000 + i)
  const exportLaunchpad = 900

  const routes: PiColonyLayout['routes'] = []
  let routeId = 1

  for (const pinId of aifIds) {
    // Insumos comprados: launchpad → AIF.
    for (const typeId of [TYPE_POLYARAMIDS, TYPE_GEN_ENH_LIVESTOCK]) {
      routes.push({
        route_id: routeId++,
        source_pin_id: PIN_IX_IMPORT_LAUNCHPAD,
        destination_pin_id: pinId,
        content_type_id: typeId,
        quantity: 10,
      })
    }
    // Produto local: AIF → storage (3 por ciclo).
    routes.push({
      route_id: routeId++,
      source_pin_id: pinId,
      destination_pin_id: PIN_IX_HM_STORAGE,
      content_type_id: TYPE_HERMETIC_MEMBRANES,
      quantity: 3,
    })
  }

  for (const pinId of htifIds) {
    for (const typeId of [TYPE_CAMERA_DRONES, TYPE_NUCLEAR_REACTORS]) {
      routes.push({
        route_id: routeId++,
        source_pin_id: PIN_IX_IMPORT_LAUNCHPAD,
        destination_pin_id: pinId,
        content_type_id: typeId,
        quantity: 6,
      })
    }
    // Intermediário local: storage → HTIF (6 por ciclo).
    routes.push({
      route_id: routeId++,
      source_pin_id: PIN_IX_HM_STORAGE,
      destination_pin_id: pinId,
      content_type_id: TYPE_HERMETIC_MEMBRANES,
      quantity: 6,
    })
    routes.push({
      route_id: routeId++,
      source_pin_id: pinId,
      destination_pin_id: exportLaunchpad,
      content_type_id: TYPE_SHPC,
      quantity: 1,
    })
  }

  return {
    links: [],
    routes,
    pins: [
      {
        pin_id: PIN_IX_IMPORT_LAUNCHPAD,
        type_id: LAUNCHPAD,
        contents: [
          { type_id: TYPE_POLYARAMIDS, amount: importedAmount },
          { type_id: TYPE_GEN_ENH_LIVESTOCK, amount: importedAmount },
          { type_id: TYPE_CAMERA_DRONES, amount: 1500 },
          { type_id: TYPE_NUCLEAR_REACTORS, amount: 1500 },
        ],
      },
      ...aifIds.map((pin_id) => ({
        pin_id,
        type_id: AIF,
        factory_details: { schematic_id: SCHEMATIC_HERMETIC_MEMBRANES },
      })),
      {
        pin_id: PIN_IX_HM_STORAGE,
        type_id: 2541,
        contents: [{ type_id: TYPE_HERMETIC_MEMBRANES, amount: hermeticMembranesAmount }],
      },
      ...htifIds.map((pin_id) => ({
        pin_id,
        type_id: HTIF_SHPC,
        factory_details: { schematic_id: SCHEMATIC_SHPC },
      })),
      { pin_id: exportLaunchpad, type_id: LAUNCHPAD, contents: [] },
    ],
  }
}

export function summaryWithLastUpdate(lastUpdate: string | undefined): PiColonySummary {
  return {
    last_update: lastUpdate,
    owner_id: 90000001,
    planet_id: 40000001,
    planet_type: 'barren',
    solar_system_id: 30000001,
    upgrade_level: 5,
    num_pins: 7,
  }
}

/** Instante do snapshot usado como T₀ nos testes (o mesmo da validação real). */
export const ANCHOR_ISO = '2026-07-20T20:38:00Z'
export const ANCHOR_MS = Date.parse(ANCHOR_ISO)
export const HOUR_MS = 3_600_000
