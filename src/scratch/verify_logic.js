// Simulação da lógica corrigida para verificação
const miningType = 'MoonOre'; // Exemplo
const groupId = 0; // Para minério de lua não é gelo (465)

const logs = [
    { oreName: 'Bountiful Xenotime', quantity: 8702 },
    { oreName: 'Bountiful Xenotime', quantity: 8721 },
    { oreName: 'Bountiful Ytterbite', quantity: 1384 },
    { oreName: 'Bountiful Ytterbite', quantity: 1271 },
    { oreName: 'Bountiful Ytterbite', quantity: 883 },
    { oreName: 'Bountiful Xenotime', quantity: 7770 },
];

// Preço aproximado de um "lote" de 100 unidades no mercado
const batchPriceXenotime = 2400000; 
const batchPriceYtterbite = 1800000;

function calculateValue(log) {
    const isIce = groupId === 465;
    const ratio = isIce ? 1 : 100;
    
    // Simulação do fallback de preço
    let pricePerBatch = log.oreName.includes('Xenotime') ? batchPriceXenotime : batchPriceYtterbite;
    
    // Lógica corrigida: dividir o preço do lote pelo ratio para ter o preço unitário
    const unitPrice = pricePerBatch / ratio;
    
    return log.quantity * unitPrice;
}

console.log('--- TESTE DE LÓGICA DE VALORIZAÇÃO ---');
let totalVal = 0;
logs.forEach(log => {
    const val = calculateValue(log);
    totalVal += val;
    console.log(`${log.oreName}: ${log.quantity} unidades -> ${val.toLocaleString()} ISK`);
});

console.log('\nVALOR FINAL TOTAL:', totalVal.toLocaleString(), 'ISK');
console.log('VALOR SEM A CORREÇÃO (ERRADO):', (totalVal * 100).toLocaleString(), 'ISK');
