/**
 * Joshi Mangodi Operations Math Engine - Safety Stock, ROP, EOQ with Quantity Discounts & FEFO Allocation
 * 
 * Implements:
 * 1. Dynamic Safety Stock & Reorder Point (ROP) with Dual Uncertainty (Demand & Lead Time Variance)
 * 2. Economic Order Quantity (EOQ) with All-Units Quantity Discounts optimizer
 * 3. FEFO (First Expired, First Out) batch allocation algorithm
 */

import { round2, round4 } from './precision';

export interface SafetyStockResult {
  averageDailyDemand: number;
  demandStdDev: number;
  averageLeadTimeDays: number;
  leadTimeStdDev: number;
  serviceLevelZ: number; // e.g. 1.65 for 95%
  safetyStockUnits: number;
  reorderPointUnits: number;
  currentStockUnits: number;
  stockStatus: 'CRITICAL_STOCKOUT_RISK' | 'REORDER_TRIGGERED' | 'HEALTHY_STOCK';
  daysOfSupplyRemaining: number;
}

export interface DiscountTier {
  tierName: string;
  minQty: number;
  unitPriceInr: number;
}

export interface EOQOptimizationResult {
  optimalOrderQty: number;
  bestTierName: string;
  unitPriceInr: number;
  ordersPerYear: number;
  cycleTimeDays: number;
  annualPurchaseCostInr: number;
  annualOrderingCostInr: number;
  annualHoldingCostInr: number;
  totalAnnualCostInr: number;
  tierEvaluations: Array<{
    tierName: string;
    minQty: number;
    unitPriceInr: number;
    unconstrainedEOQ: number;
    feasibleOrderQty: number;
    isFeasible: boolean;
    totalCostInr: number;
  }>;
}

export interface FEFOAllocationLot {
  batchId: string;
  batchCode: string;
  expiryDate: string;
  availableUnits: number;
  allocatedUnits: number;
  daysUntilExpiry: number;
}

/**
 * Computes Dynamic Safety Stock & Reorder Point (ROP) with Lead Time & Demand Variance.
 * Formula: SafetyStock = Z * sqrt( avgL * (sigmaD^2) + (avgD^2) * (sigmaL^2) )
 *          ROP = (avgD * avgL) + SafetyStock
 */
export function calculateDynamicSafetyStock(
  dailyDemands: number[],
  leadTimesDays: number[],
  currentStock: number,
  serviceLevel: '90%' | '95%' | '97.5%' | '99%' = '95%'
): SafetyStockResult {
  const zMap = {
    '90%': 1.28,
    '95%': 1.65,
    '97.5%': 1.96,
    '99%': 2.33,
  };
  const z = zMap[serviceLevel] || 1.65;

  const nD = dailyDemands.length || 1;
  const avgD = dailyDemands.reduce((a, b) => a + b, 0) / nD;
  const varianceD =
    dailyDemands.length > 1
      ? dailyDemands.reduce((sum, d) => sum + Math.pow(d - avgD, 2), 0) / (dailyDemands.length - 1)
      : 0;
  const sigmaD = Math.sqrt(varianceD);

  const nL = leadTimesDays.length || 1;
  const avgL = leadTimesDays.reduce((a, b) => a + b, 0) / nL;
  const varianceL =
    leadTimesDays.length > 1
      ? leadTimesDays.reduce((sum, l) => sum + Math.pow(l - avgL, 2), 0) / (leadTimesDays.length - 1)
      : 0;
  const sigmaL = Math.sqrt(varianceL);

  // Safety Stock formula
  const combinedVariance = avgL * Math.pow(sigmaD, 2) + Math.pow(avgD, 2) * Math.pow(sigmaL, 2);
  const safetyStock = round2(z * Math.sqrt(Math.max(0, combinedVariance)));
  const rop = round2(avgD * avgL + safetyStock);

  let stockStatus: SafetyStockResult['stockStatus'] = 'HEALTHY_STOCK';
  if (currentStock <= safetyStock) {
    stockStatus = 'CRITICAL_STOCKOUT_RISK';
  } else if (currentStock <= rop) {
    stockStatus = 'REORDER_TRIGGERED';
  }

  const daysOfSupply = avgD > 0 ? round2(currentStock / avgD) : 999;

  return {
    averageDailyDemand: round2(avgD),
    demandStdDev: round2(sigmaD),
    averageLeadTimeDays: round2(avgL),
    leadTimeStdDev: round2(sigmaL),
    serviceLevelZ: z,
    safetyStockUnits: Math.max(1, Math.ceil(safetyStock)),
    reorderPointUnits: Math.max(1, Math.ceil(rop)),
    currentStockUnits: currentStock,
    stockStatus,
    daysOfSupplyRemaining: daysOfSupply,
  };
}

/**
 * Computes Economic Order Quantity (EOQ) with All-Units Quantity Discounts.
 */
export function calculateEOQWithDiscounts(
  annualDemand: number,
  orderCostFixedInr: number = 500, // Cost to place tempo/trip order
  holdingCostRatePct: number = 18.0, // 18% annual inventory carrying cost
  tiers: DiscountTier[] = [
    { tierName: 'Standard / Small Lot', minQty: 0, unitPriceInr: 95.0 },
    { tierName: 'Mandi Wholesale (500kg+)', minQty: 500, unitPriceInr: 92.0 },
    { tierName: 'Direct Mill Truckload (1000kg+)', minQty: 1000, unitPriceInr: 88.0 },
  ]
): EOQOptimizationResult {
  const i = holdingCostRatePct / 100;
  let bestCost = Infinity;
  let bestTier = tiers[0];
  let bestQty = 0;

  const sortedTiers = [...tiers].sort((a, b) => a.minQty - b.minQty);
  const evaluations: EOQOptimizationResult['tierEvaluations'] = [];

  for (let idx = 0; idx < sortedTiers.length; idx++) {
    const tier = sortedTiers[idx];
    const nextTier = sortedTiers[idx + 1];
    const H = i * tier.unitPriceInr; // Annual holding cost per unit

    // Unconstrained EOQ = sqrt(2 * D * S / H)
    const unconstrainedEOQ = Math.sqrt((2 * annualDemand * orderCostFixedInr) / H);

    let feasibleQty = 0;
    let isFeasible = true;

    if (unconstrainedEOQ < tier.minQty) {
      // Below tier threshold: round up to tier minimum to qualify for discount
      feasibleQty = tier.minQty;
    } else if (nextTier && unconstrainedEOQ >= nextTier.minQty) {
      // Infeasible / dominated because higher quantity gives even lower price
      isFeasible = false;
      feasibleQty = nextTier.minQty - 1;
    } else {
      feasibleQty = unconstrainedEOQ;
    }

    // Evaluate Total Annual Cost = Purchase + Ordering + Holding
    const purchaseCost = annualDemand * tier.unitPriceInr;
    const orderingCost = (annualDemand / (feasibleQty || 1)) * orderCostFixedInr;
    const holdingCost = (feasibleQty / 2) * H;
    const totalCost = round2(purchaseCost + orderingCost + holdingCost);

    evaluations.push({
      tierName: tier.tierName,
      minQty: tier.minQty,
      unitPriceInr: tier.unitPriceInr,
      unconstrainedEOQ: round2(unconstrainedEOQ),
      feasibleOrderQty: Math.ceil(feasibleQty),
      isFeasible,
      totalCostInr: totalCost,
    });

    if (isFeasible && totalCost < bestCost) {
      bestCost = totalCost;
      bestTier = tier;
      bestQty = Math.ceil(feasibleQty);
    }
  }

  // Calculate breakdown for best choice
  const bestH = i * bestTier.unitPriceInr;
  const bestPurchase = round2(annualDemand * bestTier.unitPriceInr);
  const bestOrdering = round2((annualDemand / bestQty) * orderCostFixedInr);
  const bestHolding = round2((bestQty / 2) * bestH);
  const ordersPerYear = round2(annualDemand / bestQty);
  const cycleTimeDays = round2(365 / ordersPerYear);

  return {
    optimalOrderQty: bestQty,
    bestTierName: bestTier.tierName,
    unitPriceInr: bestTier.unitPriceInr,
    ordersPerYear,
    cycleTimeDays,
    annualPurchaseCostInr: bestPurchase,
    annualOrderingCostInr: bestOrdering,
    annualHoldingCostInr: bestHolding,
    totalAnnualCostInr: round2(bestPurchase + bestOrdering + bestHolding),
    tierEvaluations: evaluations,
  };
}

/**
 * FEFO (First Expired, First Out) Batch Allocator.
 * Greedily selects batches closest to expiration date while filtering out expired or rejected stock.
 */
export function allocateBatchesFEFO(
  requiredQty: number,
  availableBatches: Array<{
    id: string;
    batchCode: string;
    expiryDate: string;
    availableUnits: number;
    status: string;
  }>
): {
  allocatedLots: FEFOAllocationLot[];
  fulfilledQty: number;
  shortfallQty: number;
  isFullyFulfilled: boolean;
} {
  const today = new Date().toISOString().split('T')[0];

  // Filter only released, non-expired batches
  const validBatches = availableBatches
    .filter((b) => b.status === 'RELEASED' && b.availableUnits > 0 && b.expiryDate >= today)
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  let remaining = requiredQty;
  const allocatedLots: FEFOAllocationLot[] = [];

  for (const batch of validBatches) {
    if (remaining <= 0) break;

    const alloc = Math.min(remaining, batch.availableUnits);
    const msDiff = new Date(batch.expiryDate).getTime() - new Date(today).getTime();
    const daysUntilExpiry = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));

    allocatedLots.push({
      batchId: batch.id,
      batchCode: batch.batchCode,
      expiryDate: batch.expiryDate,
      availableUnits: batch.availableUnits,
      allocatedUnits: alloc,
      daysUntilExpiry,
    });

    remaining -= alloc;
  }

  const fulfilledQty = requiredQty - remaining;

  return {
    allocatedLots,
    fulfilledQty,
    shortfallQty: Math.max(0, remaining),
    isFullyFulfilled: remaining <= 0,
  };
}
