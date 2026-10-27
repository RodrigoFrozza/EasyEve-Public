const input = `Dark Glitter	226	226.000 m3	70.000.000,00 ISK	8.891 m
Dark Glitter	238	238.000 m3	73.700.000,00 ISK	35 km
Dark Glitter	264	264.000 m3	81.800.000,00 ISK	38 km
Dark Glitter	264	264.000 m3	81.800.000,00 ISK	39 km
Gelidus	69	69.000 m3	15.900.000,00 ISK	12 km
Gelidus	96	96.000 m3	22.200.000,00 ISK	29 km
Gelidus	98	98.000 m3	22.600.000,00 ISK	40 km
Gelidus	94	94.000 m3	21.700.000,00 ISK	48 km
Glacial Mass IV-Grade	335	335.000 m3	45.300.000,00 ISK	5.626 m
Glacial Mass IV-Grade	286	286.000 m3	38.700.000,00 ISK	7.564 m
Glacial Mass IV-Grade	351	351.000 m3	47.400.000,00 ISK	9.360 m
Glacial Mass IV-Grade	334	334.000 m3	45.100.000,00 ISK	9.483 m
Glacial Mass IV-Grade	357	357.000 m3	48.300.000,00 ISK	10 km
Glacial Mass IV-Grade	350	350.000 m3	47.300.000,00 ISK	12 km
Glacial Mass IV-Grade	337	337.000 m3	45.600.000,00 ISK	13 km
Glacial Mass IV-Grade	329	329.000 m3	44.500.000,00 ISK	17 km
Glacial Mass IV-Grade	354	354.000 m3	47.800.000,00 ISK	19 km
Glacial Mass IV-Grade	334	334.000 m3	45.100.000,00 ISK	26 km
Glacial Mass IV-Grade	363	363.000 m3	49.100.000,00 ISK	29 km
Glacial Mass IV-Grade	306	306.000 m3	41.400.000,00 ISK	29 km
Glacial Mass IV-Grade	357	357.000 m3	48.300.000,00 ISK	34 km
Glacial Mass IV-Grade	321	321.000 m3	43.400.000,00 ISK	35 km
Glacial Mass IV-Grade	330	330.000 m3	44.600.000,00 ISK	41 km
Glare Crust	120	120.000 m3	23.300.000,00 ISK	14 km
Glare Crust	151	151.000 m3	29.300.000,00 ISK	17 km
Glare Crust	89	89.000 m3	17.200.000,00 ISK	22 km
Glare Crust	109	109.000 m3	21.100.000,00 ISK	27 km
Glare Crust	143	143.000 m3	27.700.000,00 ISK	42 km
Glare Crust	102	102.000 m3	19.800.000,00 ISK	46 km
Glare Crust	81	81.000 m3	15.700.000,00 ISK	47 km`;

// Note: the original file is .ts, so I need to mock the environment or use ts-node
// But I can just copy the logic here for a quick test.

function parseEveQuantityToken(raw) {
  const compact = raw.replace(/\s/g, '').replace(/,/g, '')
  if (!/^\d+(\.\d+)?$/.test(compact)) return null
  const n = Number(compact)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

function parseMiningScanLine(line) {
  const raw = line.trim()
  if (!raw) return null

  const parts = raw.split(/\t+/).map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0]
    const b = parts[1]
    const qa = parseEveQuantityToken(a)
    const qb = parseEveQuantityToken(b)
    if (qa != null && qb == null) return { name: b, quantity: qa }
    if (qb != null && qa == null) return { name: a, quantity: qb }
  }

  const lead = raw.match(/^([\d\s,]+)\s+(.+)$/)
  if (lead) {
    const q = parseEveQuantityToken(lead[1])
    if (q != null) return { name: lead[2].trim(), quantity: q }
  }

  const trail = raw.match(/^(.+?)\s+([\d\s,]+)$/)
  if (trail) {
    const q = parseEveQuantityToken(trail[2])
    if (q != null) return { name: trail[1].trim(), quantity: q }
  }

  return null
}

function parseMiningScanBlock(text) {
  const out = []
  for (const line of text.split(/\r?\n/)) {
    const row = parseMiningScanLine(line)
    if (row) out.push(row)
  }
  return out
}

const parsed = parseMiningScanBlock(input);
console.log(JSON.stringify(parsed, null, 2));
console.log(`Total parsed: ${parsed.length}`);
