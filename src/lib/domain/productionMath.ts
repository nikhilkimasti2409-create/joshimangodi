/**
 * Joshi Mangodi Operations Math Engine - Production, Yield, BOM Backflushing & COGS Rollup
 * 
 * Implements:
 * 1. Physical transformation math (Moisture ratio, sun-drying shrinkage, yield variance against 96% baseline)
 * 2. Piece-rate labor allocation and aggregate cost
 * 3. Dynamic Cost of Goods Sold (COGS) rollup from dal lot rates, grinding, masala, and piece rates
 * 4. Automated BOM Backflushing proportional deduction calculations
 * 5. Tarjan's Strongly Connected Components (SCC) algorithm for BOM cycle detection
 */

import { round2, round4 } from './precision';

export interface YieldAnalysis {
  rawDalWeightKg: number;
  wetMixtureWeightKg: number;
  moistureRatio: number; // Wet / Dry
  driedYieldKg: number;
  shrinkagePct: number; // % mass lost in sun-drying
  actualYieldPct: number; // Dried / Raw Dal
  expectedBaselineYieldPct: number; // 96.0% standard
  yieldVariancePct: number; // Actual - Expected
  status: 'OPTIMAL' | 'WARNING_LOW_YIELD' | 'WARNING_HIGH_MOISTURE' | 'ANOMALOUS';
  diagnosisMessage: string;
}

export interface WorkerLaborCalculation {
  workerId: string;
  workerName: string;
  driedKg: number;
  ratePerKgInr: number;
  payoutInr: number;
}

export interface BatchCostBreakdown {
  dalCostInr: number;
  grindingCostInr: number; // Pisai
  masalaCostInr: number;
  laborCostInr: number;
  overheadCostInr: number;
  totalBatchCostInr: number;
  bulkCostPerKgInr: number;
}

export interface BOMRequirement {
  rawMaterialCode: string;
  rawMaterialName: string;
  unit: string;
  quantityRequired: number;
  unitCostInr: number;
  totalCostInr: number;
}

/**
 * Calculates moisture absorption, sun-drying shrinkage, and yield variance.
 */
export function calculateBatchYieldMetrics(
  rawDalWeightKg: number,
  wetMixtureWeightKg: number,
  driedYieldKg: number,
  baselineYieldPct: number = 96.0
): YieldAnalysis {
  if (rawDalWeightKg <= 0 || wetMixtureWeightKg <= 0 || driedYieldKg <= 0) {
    return {
      rawDalWeightKg,
      wetMixtureWeightKg,
      moistureRatio: 0,
      driedYieldKg,
      shrinkagePct: 0,
      actualYieldPct: 0,
      expectedBaselineYieldPct: baselineYieldPct,
      yieldVariancePct: 0,
      status: 'ANOMALOUS',
      diagnosisMessage: 'Invalid positive weights required for all transformation stages.',
    };
  }

  const moistureRatio = round4(wetMixtureWeightKg / rawDalWeightKg);
  const shrinkagePct = round2(((wetMixtureWeightKg - driedYieldKg) / wetMixtureWeightKg) * 100);
  const actualYieldPct = round2((driedYieldKg / rawDalWeightKg) * 100);
  const yieldVariancePct = round2(actualYieldPct - baselineYieldPct);

  let status: YieldAnalysis['status'] = 'OPTIMAL';
  let diagnosisMessage = `Yield is within normal range (${actualYieldPct}% vs ${baselineYieldPct}% standard).`;

  if (actualYieldPct < 92.0) {
    status = 'WARNING_LOW_YIELD';
    diagnosisMessage = `Low yield alert: ${actualYieldPct}% achieved. Potential causes: excessive dal soaking loss, dust spillage, or over-grinding.`;
  } else if (actualYieldPct > 102.0) {
    status = 'WARNING_HIGH_MOISTURE';
    diagnosisMessage = `Excess weight alert: ${actualYieldPct}% achieved. Mangodi may retain dangerous residual moisture (>10%) risking fungal spoilage. Extend sun-drying.`;
  } else if (Math.abs(yieldVariancePct) > 2.0) {
    status = 'OPTIMAL';
    diagnosisMessage = `Minor yield variance of ${yieldVariancePct > 0 ? '+' : ''}${yieldVariancePct}%. Within acceptable artisanal limits.`;
  }

  return {
    rawDalWeightKg,
    wetMixtureWeightKg,
    moistureRatio,
    driedYieldKg,
    shrinkagePct,
    actualYieldPct,
    expectedBaselineYieldPct: baselineYieldPct,
    yieldVariancePct,
    status,
    diagnosisMessage,
  };
}

/**
 * Calculates piece-rate labor payouts for Kaarigar team.
 */
export function calculateLaborPayouts(
  entries: Array<{ workerId: string; workerName: string; driedKg: number; ratePerKgInr: number }>
): {
  processedEntries: WorkerLaborCalculation[];
  totalLaborCostInr: number;
  totalKgLogged: number;
} {
  let totalLaborCost = 0;
  let totalKg = 0;

  const processedEntries = entries.map((entry) => {
    const payout = round2(entry.driedKg * entry.ratePerKgInr);
    totalLaborCost += payout;
    totalKg += entry.driedKg;
    return {
      workerId: entry.workerId,
      workerName: entry.workerName,
      driedKg: entry.driedKg,
      ratePerKgInr: entry.ratePerKgInr,
      payoutInr: payout,
    };
  });

  return {
    processedEntries,
    totalLaborCostInr: round2(totalLaborCost),
    totalKgLogged: round2(totalKg),
  };
}

/**
 * Calculates complete Dynamic COGS Rollup for a production batch.
 */
export function calculateDynamicCOGS(
  rawDalWeightKg: number,
  dalRatePerKgInr: number,
  driedYieldKg: number,
  totalLaborCostInr: number,
  isMasala: boolean = false,
  pisaiRatePerKgInr: number = 6.0, // Standard Fatehpur mill rate: ₹6/kg
  overheadCostInr: number = 0
): BatchCostBreakdown {
  const dalCost = round2(rawDalWeightKg * dalRatePerKgInr);
  const grindingCost = round2(rawDalWeightKg * pisaiRatePerKgInr);
  
  // Spices cost formulation: Masala Mangodi requires ₹15/kg spice mix, Plain requires ₹4/kg (Hing + salt base)
  const masalaCost = isMasala ? round2(rawDalWeightKg * 15) : round2(rawDalWeightKg * 5);
  
  const totalBatchCost = round2(dalCost + grindingCost + masalaCost + totalLaborCostInr + overheadCostInr);
  const bulkCostPerKg = driedYieldKg > 0 ? round2(totalBatchCost / driedYieldKg) : 0;

  return {
    dalCostInr: dalCost,
    grindingCostInr: grindingCost,
    masalaCostInr: masalaCost,
    laborCostInr: totalLaborCostInr,
    overheadCostInr,
    totalBatchCostInr: totalBatchCost,
    bulkCostPerKgInr: bulkCostPerKg,
  };
}

/**
 * Calculates Unit COGS for packaged finished goods including pouch and carton allocation.
 */
export function calculateFinishedUnitCOGS(
  bulkCostPerKgInr: number,
  packetSizeGrams: number,
  pouchCostInr: number = 3.8,
  cartonCostInr: number = 28.0,
  cartonCapacityKg: number = 20.0
): number {
  const bulkShare = (bulkCostPerKgInr * packetSizeGrams) / 1000;
  const cartonShare = (cartonCostInr / cartonCapacityKg) * (packetSizeGrams / 1000);
  return round2(bulkShare + pouchCostInr + cartonShare);
}

/**
 * Calculates automated BOM raw material backflushing requirements for a production output.
 */
export function calculateBOMBackflushDeductions(
  shape: 'LAMBI' | 'GOL' | 'MASALA' | 'SPECIAL',
  driedYieldKg: number,
  outputPacks: Array<{ packetSizeGrams: number; quantity: number }>
): BOMRequirement[] {
  const requirements: BOMRequirement[] = [];

  // 1. Raw Moong Dal (Based on 96% baseline conversion with 1.5% soaking/handling tolerance)
  const dalQtyKg = round2((driedYieldKg / 0.96) * 1.015);
  requirements.push({
    rawMaterialCode: 'RM-DAL-MOGAR',
    rawMaterialName: 'Moong Mogar Dal (Grade A)',
    unit: 'KG',
    quantityRequired: dalQtyKg,
    unitCostInr: 92.0,
    totalCostInr: round2(dalQtyKg * 92.0),
  });

  // 2. Pure Hing (0.25% dosage = 2.5g per kg)
  const hingQtyKg = round4((driedYieldKg * 2.5) / 1000);
  requirements.push({
    rawMaterialCode: 'RM-SPICE-HING',
    rawMaterialName: 'Asafoetida / Pure Hing',
    unit: 'KG',
    quantityRequired: hingQtyKg,
    unitCostInr: 1800.0,
    totalCostInr: round2(hingQtyKg * 1800.0),
  });

  // 3. Spices (if Masala Mangodi)
  if (shape === 'MASALA') {
    const chiliQtyKg = round2((driedYieldKg * 25) / 1000); // 25g Mathania chili per kg
    requirements.push({
      rawMaterialCode: 'RM-SPICE-CHILI',
      rawMaterialName: 'Mathania Red Chili Flakes',
      unit: 'KG',
      quantityRequired: chiliQtyKg,
      unitCostInr: 260.0,
      totalCostInr: round2(chiliQtyKg * 260.0),
    });
  }

  // 4. Packaging Pouches
  for (const pack of outputPacks) {
    if (pack.quantity <= 0) continue;
    const is1000 = pack.packetSizeGrams === 1000;
    requirements.push({
      rawMaterialCode: is1000 ? 'RM-PKG-P1000' : 'RM-PKG-P500',
      rawMaterialName: is1000 ? 'Printed Zip Pouch 1kg' : 'Printed Zip Pouch 500g',
      unit: 'PCS',
      quantityRequired: pack.quantity,
      unitCostInr: is1000 ? 5.2 : 3.8,
      totalCostInr: round2(pack.quantity * (is1000 ? 5.2 : 3.8)),
    });
  }

  return requirements;
}

/**
 * Tarjan's Strongly Connected Components (SCC) algorithm for BOM circular dependency detection.
 * Ensures the Bill of Materials remains a strictly Directed Acyclic Graph (DAG).
 */
export function detectBOMCircularDependencies(
  adjacencyList: Record<string, string[]>
): { hasCycle: boolean; circularComponents: string[][] } {
  let index = 0;
  const indices: Record<string, number> = {};
  const lowlinks: Record<string, number> = {};
  const onStack: Record<string, boolean> = {};
  const stack: string[] = [];
  const sccs: string[][] = [];

  function strongConnect(node: string) {
    indices[node] = index;
    lowlinks[node] = index;
    index++;
    stack.push(node);
    onStack[node] = true;

    const neighbors = adjacencyList[node] || [];
    for (const neighbor of neighbors) {
      if (indices[neighbor] === undefined) {
        // Successor has not yet been visited
        strongConnect(neighbor);
        lowlinks[node] = Math.min(lowlinks[node], lowlinks[neighbor]);
      } else if (onStack[neighbor]) {
        // Successor is on stack and hence in the current SCC
        lowlinks[node] = Math.min(lowlinks[node], indices[neighbor]);
      }
    }

    // If node is a root node, pop the stack and generate an SCC
    if (lowlinks[node] === indices[node]) {
      const currentSCC: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack[w] = false;
        currentSCC.push(w);
      } while (w !== node);

      if (currentSCC.length > 1) {
        sccs.push(currentSCC);
      }
    }
  }

  const allNodes = Object.keys(adjacencyList);
  for (const node of allNodes) {
    if (indices[node] === undefined) {
      strongConnect(node);
    }
  }

  return {
    hasCycle: sccs.length > 0,
    circularComponents: sccs,
  };
}
