import { getReprocessingYield } from '../lib/mining-reprocessing-yields';
import { calculateRefinedUnitPrice } from '../lib/mining-price-resolution';

// Mock prices
const prices: Record<number, number> = {
  34: 5, // Tritanium Buy Price
};

function testVeldspar() {
  const name = 'Veldspar';
  const yields = getReprocessingYield(name);
  console.log(`Yields for ${name}:`, yields);

  const materialYields = yields.map((y) => ({ materialId: y.mineralId, quantity: y.quantity }));
  
  const unitPrice = calculateRefinedUnitPrice(
    materialYields,
    prices,
    false // Not Ice
  );

  console.log(`Refined Unit Price (New helper): ${unitPrice}`);
  
  // (415 units of Tritanium * 5 ISK) / 100 units of Veldspar = 20.75 ISK/unit
  const expected = (415 * 5) / 100;
  console.log(`Expected Unit Price: ${expected}`);
  
  if (unitPrice === expected) {
    console.log('✅ SUCCESS: Refined unit price matches expected value.');
  } else {
    console.log('❌ FAILURE: Refined unit price is incorrect.');
  }
}

testVeldspar();
