import { parseMiningScanBlock } from 'f:/EasyEve_/src/lib/mining-scan-parse'

const sample = `Dark Glitter	226	226.000 m3	70.000.000,00 ISK	8.891 m
Dark Glitter	238	238.000 m3	73.700.000,00 ISK	35 km
Gelidus	69	69.000 m3	15.900.000,00 ISK	12 km
Glacial Mass IV-Grade	335	335.000 m3	45.300.000,00 ISK	5.626 m`

console.log('--- Parsing Sample ---')
const results = parseMiningScanBlock(sample)
console.log(JSON.stringify(results, null, 2))

const expected = [
  { name: 'Dark Glitter', quantity: 226 },
  { name: 'Dark Glitter', quantity: 238 },
  { name: 'Gelidus', quantity: 69 },
  { name: 'Glacial Mass IV-Grade', quantity: 335 }
]

console.log('\n--- Verification ---')
results.forEach((r, i) => {
  const match = r.name === expected[i].name && r.quantity === expected[i].quantity
  console.log(`Row ${i + 1}: ${match ? 'PASS' : 'FAIL'} (${r.name}, ${r.quantity})`)
})
