function parseEveValue(raw, localeHint = 'EU') {
  if (!raw) return null;
  // Keep only numbers, dots, commas, and minus sign
  let clean = raw.replace(/[^0-9.,-]/g, '').trim();
  if (!clean) return null;

  if (localeHint === 'EU') {
    // . is thousand, , is decimal
    // Remove dots, then replace comma with dot
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else {
    // , is thousand, . is decimal
    clean = clean.replace(/,/g, '');
  }

  const n = parseFloat(clean);
  return isFinite(n) ? n : null;
}

const inputLines = [
  "Dark Glitter	226	226.000 m3	70.000.000,00 ISK	8.891 m",
  "Gelidus	69	69.000 m3	15.900.000,00 ISK	12 km",
  "Glacial Mass IV-Grade	335	335.000 m3	45.300.000,00 ISK	5.626 m"
];

inputLines.forEach(line => {
  const parts = line.split('\t');
  console.log(`Line: ${line}`);
  console.log(`  Name: ${parts[0]}`);
  console.log(`  Qty: ${parseEveValue(parts[1])}`);
  console.log(`  Vol: ${parseEveValue(parts[2])}`);
  console.log(`  ISK: ${parseEveValue(parts[3])}`);
  console.log(`  Dist: ${parseEveValue(parts[4])}`);
});
