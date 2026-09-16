/**
 * Unit Test Suite for Joshi Mangodi Domain Math Engines
 */

import {
  round2,
  round4,
  mean,
  standardDeviation,
  resolveSKUPrice,
  calculateTaxBreakdown,
  calculateOrderFinancials,
  calculateBatchYieldMetrics,
  calculateLaborPayouts,
  calculateDynamicCOGS,
  calculateFinishedUnitCOGS,
  calculateBOMBackflushDeductions,
  detectBOMCircularDependencies,
  runHoltWintersForecast,
  calculateMasterProductionSchedule,
  calculateDynamicSafetyStock,
  calculateEOQWithDiscounts,
  allocateBatchesFEFO,
  sumDenominations,
  reconcileCashDrawer,
  calculateProfitAndLoss,
} from '../index';
import type { ProductSKU, Customer, Order, Expense, CashDenominations } from '../../../types';

export function runAllTests(): { passed: number; failed: number; errors: string[] } {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      passed++;
      // console.log(`✓ PASS: ${testName}`);
    } else {
      failed++;
      const errMsg = `✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`;
      console.error(errMsg);
      errors.push(errMsg);
    }
  }

  // 1. Precision & Arithmetic Tests
  assert(round2(0.1 + 0.2) === 0.3, 'Floating point addition 0.1 + 0.2 = 0.3');
  assert(round2(1.005) === 1.01, 'Half-up rounding on 1.005 -> 1.01');
  assert(round4(0.00254) === 0.0025, 'Round4 precision');
  assert(mean([10, 20, 30, 40]) === 25, 'Arithmetic mean calculation');
  assert(round2(standardDeviation([10, 20, 30, 40, 50])) === 15.81, 'Sample standard deviation');

  // 2. Multi-tier Price Resolution
  const mockSku: ProductSKU = {
    id: 'sku-test',
    name: 'Plain Mangodi (500g)',
    nameHindi: 'सादी मंगोड़ी',
    category: 'PLAIN_MANGODI',
    shape: 'LAMBI',
    packetSizeGrams: 500,
    barcode: '890123',
    mrpInr: 120,
    retailPriceInr: 110,
    wholesaleT1PriceInr: 87.5, // ₹175/kg
    wholesaleT2PriceInr: 82.5, // ₹165/kg
    currentStockUnits: 100,
    reorderPointUnits: 20,
    unitCostInr: 62.5,
    gstRate: 5,
    hsnCode: '21069099',
  };

  const retailResult = resolveSKUPrice(mockSku, 2, 'RETAIL');
  assert(retailResult.unitPriceInr === 110 && retailResult.totalInr === 220, 'Retail pricing standard');

  // Volume Break: 20 units of 500g = 10kg -> Qualifies for Wholesale T1 (₹87.5)
  const vol1Result = resolveSKUPrice(mockSku, 20, 'RETAIL');
  assert(vol1Result.priceSource === 'VOLUME_TIER_1' && vol1Result.unitPriceInr === 87.5, 'Volume Break Tier 1 (10kg)');

  // Volume Break: 100 units of 500g = 50kg -> Qualifies for Wholesale T2 (₹82.5)
  const vol2Result = resolveSKUPrice(mockSku, 100, 'RETAIL');
  assert(vol2Result.priceSource === 'VOLUME_TIER_2' && vol2Result.unitPriceInr === 82.5, 'Volume Break Tier 2 (50kg)');

  // Contract Override: Customer gets ₹160/kg rate -> ₹80 for 500g
  const mockCust: Customer = {
    id: 'c1',
    name: 'Special Mandi Dealer',
    phone: '9829000000',
    customerType: 'wholesale',
    creditLimitInr: 50000,
    totalOutstandingInr: 0,
    totalOrdersCount: 5,
    lifetimeValueInr: 50000,
    contractPricePerKg: 160,
    createdAt: '2026-01-01',
  };
  const contractResult = resolveSKUPrice(mockSku, 10, 'RETAIL', mockCust);
  assert(contractResult.priceSource === 'CONTRACT_OVERRIDE' && contractResult.unitPriceInr === 80, 'Customer Contract Price Override');

  // 3. GST Calculation (Intrastate vs Interstate)
  const rajasthanTax = calculateTaxBreakdown(210, 5, '08AAACS1234F1Z8');
  assert(rajasthanTax.taxableBaseInr === 200 && rajasthanTax.cgstInr === 5 && rajasthanTax.sgstInr === 5, 'Intrastate Rajasthan 5% GST split');

  const interstateTax = calculateTaxBreakdown(210, 5, '06BBFPS5678G2Z1'); // Haryana GSTIN 06
  assert(interstateTax.isInterstate && interstateTax.igstInr === 10, 'Interstate IGST 5%');

  // 4. Yield, Moisture & Shrinkage Math
  const yieldMetrics = calculateBatchYieldMetrics(100, 218, 96.5, 96.0);
  assert(yieldMetrics.moistureRatio === 2.18, 'Moisture ratio = 2.18');
  assert(yieldMetrics.shrinkagePct === 55.73, 'Sun-drying shrinkage %');
  assert(yieldMetrics.actualYieldPct === 96.5 && yieldMetrics.yieldVariancePct === 0.5, 'Yield variance against 96% baseline');
  assert(yieldMetrics.status === 'OPTIMAL', 'Optimal yield status');

  // 5. Piece-rate Kaarigar Labor Allocator
  const labor = calculateLaborPayouts([
    { workerId: 'w1', workerName: 'Sunita', driedKg: 50, ratePerKgInr: 25 },
    { workerId: 'w2', workerName: 'Kamla', driedKg: 46.5, ratePerKgInr: 25 },
  ]);
  assert(labor.totalLaborCostInr === 2412.5, 'Piece-rate labor sum ₹2412.50');

  // 6. Dynamic COGS Rollup
  const cogs = calculateDynamicCOGS(100, 92, 96.5, 2412.5, false, 6, 0);
  assert(cogs.dalCostInr === 9200 && cogs.grindingCostInr === 600, 'COGS Dal and Grinding');
  assert(cogs.totalBatchCostInr === 12712.5, 'Total Batch Cost rollup');
  assert(cogs.bulkCostPerKgInr === 131.74, 'Bulk cost per kg ₹131.74');

  const finishedUnitCost500 = calculateFinishedUnitCOGS(131.74, 500, 3.8, 28, 20);
  assert(finishedUnitCost500 === 70.37, '500g SKU Unit Cost including pouch & carton');

  // 7. Tarjan's SCC Cycle Detection
  const acyclicBOM = {
    'SKU-PLAIN': ['SUB-MANGODI-BULK', 'RM-PKG-P500'],
    'SUB-MANGODI-BULK': ['RM-DAL-MOGAR', 'RM-SPICE-HING'],
    'RM-DAL-MOGAR': [],
    'RM-SPICE-HING': [],
    'RM-PKG-P500': [],
  };
  assert(!detectBOMCircularDependencies(acyclicBOM).hasCycle, 'Acyclic BOM has no cycles');

  const cyclicBOM = {
    'ITEM-A': ['ITEM-B'],
    'ITEM-B': ['ITEM-C'],
    'ITEM-C': ['ITEM-A'],
  };
  assert(detectBOMCircularDependencies(cyclicBOM).hasCycle, 'Tarjan successfully detects cyclic BOM dependency');

  // 8. Holt-Winters Demand Forecasting
  const sampleSales = [45, 52, 60, 48, 55, 70, 85, 47, 54, 63, 50, 58, 72, 88];
  const hwResult = runHoltWintersForecast(sampleSales, 7, 7);
  assert(hwResult.forecastHorizon.length === 7, 'Holt-Winters produces 7-step forecast horizon');
  assert(hwResult.forecastHorizon.every((v) => v > 0), 'Forecasted demand values are strictly positive');

  // 9. Safety Stock & EOQ
  const safetyStock = calculateDynamicSafetyStock([50, 60, 55, 65, 45, 70, 55], [3, 4, 3, 5, 3], 150, '95%');
  assert(safetyStock.safetyStockUnits > 0 && safetyStock.reorderPointUnits > safetyStock.safetyStockUnits, 'Dynamic safety stock & ROP');

  const eoq = calculateEOQWithDiscounts(12000, 500, 18, [
    { tierName: 'Standard', minQty: 0, unitPriceInr: 95 },
    { tierName: 'Wholesale 500+', minQty: 500, unitPriceInr: 92 },
    { tierName: 'Mill Truckload 1000+', minQty: 1000, unitPriceInr: 88 },
  ]);
  assert(eoq.optimalOrderQty >= 500, 'EOQ evaluates quantity discounts and picks optimal cost tier');

  // 10. Cash Drawer Denominations & Reconciliation
  const denoms: CashDenominations = {
    n500: 10, // 5000
    n200: 5,  // 1000
    n100: 15, // 1500
    n50: 10,  // 500
    n20: 10,  // 200
    n10: 20,  // 200
    coins: 45,
  };
  const countSum = sumDenominations(denoms);
  assert(countSum.total === 8445, 'Physical cash denomination total sum = ₹8,445');

  const recon = reconcileCashDrawer(5000, [], [], [], denoms, 5000);
  assert(recon.countedCashInr === 8445 && recon.expectedCashInr === 5000 && recon.varianceInr === 3445, 'Cash drawer variance reconciliation');

  return { passed, failed, errors };
}
