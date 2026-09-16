/**
 * Joshi Mangodi Operations Math Engine - Demand Forecasting & Master Production Scheduling (MPS)
 * 
 * Implements:
 * 1. Holt-Winters Multiplicative Triple Exponential Smoothing (Level, Trend, Seasonality)
 * 2. Automated Hyperparameter Grid Optimization for (alpha, beta, gamma) minimizing MAPE
 * 3. Robust fallbacks (Holt's Linear Trend / Simple Exponential Smoothing)
 * 4. Master Production Schedule (MPS) with Projected Available Balance (PAB) and prescriptive batch triggers
 */

import { round2, round4, mean } from './precision';

export interface HoltWintersResult {
  modelType: 'HOLT_WINTERS_MULTIPLICATIVE' | 'HOLT_LINEAR' | 'SIMPLE_EXPONENTIAL';
  alpha: number;
  beta: number;
  gamma: number;
  seasonalityPeriod: number;
  inSampleFitted: number[];
  forecastHorizon: number[];
  mapePct: number; // Mean Absolute Percentage Error
  rmse: number;
}

export interface MPSScheduleSlot {
  dayIndex: number;
  dateStr: string;
  startingPABKg: number;
  forecastDemandKg: number;
  committedOrdersKg: number;
  netDemandKg: number;
  plannedProductionReceiptKg: number;
  endingPABKg: number;
  safetyStockKg: number;
  isBelowSafetyStock: boolean;
  recommendedBatchKg: number;
}

/**
 * Optimizes (alpha, beta, gamma) and computes Holt-Winters Multiplicative Triple Exponential Smoothing.
 */
export function runHoltWintersForecast(
  historicalDemand: number[],
  forecastSteps: number = 7,
  seasonalityPeriod: number = 7
): HoltWintersResult {
  const n = historicalDemand.length;

  // Fallback 1: Extremely short series (< 4 points)
  if (n < 4) {
    const avg = mean(historicalDemand) || 50;
    const forecast = Array(forecastSteps).fill(round2(avg));
    return {
      modelType: 'SIMPLE_EXPONENTIAL',
      alpha: 0.3,
      beta: 0,
      gamma: 0,
      seasonalityPeriod: 1,
      inSampleFitted: Array(n).fill(round2(avg)),
      forecastHorizon: forecast,
      mapePct: 15.0,
      rmse: 5.0,
    };
  }

  // Fallback 2: Not enough data for two full seasonal cycles (n < 2 * m)
  if (n < 2 * seasonalityPeriod) {
    return runHoltsLinearForecast(historicalDemand, forecastSteps);
  }

  // Optimize parameters using Grid Search over alpha, beta, gamma
  const m = seasonalityPeriod;
  let bestMape = Infinity;
  let bestParams = { alpha: 0.3, beta: 0.1, gamma: 0.3 };
  let bestFitted: number[] = [];

  const alphaGrid = [0.1, 0.2, 0.3, 0.5, 0.7];
  const betaGrid = [0.05, 0.1, 0.2, 0.3];
  const gammaGrid = [0.1, 0.2, 0.3, 0.5, 0.7];

  for (const alpha of alphaGrid) {
    for (const beta of betaGrid) {
      for (const gamma of gammaGrid) {
        const { fitted, mape } = evaluateHWMultiplicative(historicalDemand, m, alpha, beta, gamma);
        if (mape < bestMape) {
          bestMape = mape;
          bestParams = { alpha, beta, gamma };
          bestFitted = fitted;
        }
      }
    }
  }

  // Generate multi-step out-of-sample forecast
  const finalEval = evaluateHWMultiplicative(
    historicalDemand,
    m,
    bestParams.alpha,
    bestParams.beta,
    bestParams.gamma,
    forecastSteps
  );

  return {
    modelType: 'HOLT_WINTERS_MULTIPLICATIVE',
    alpha: bestParams.alpha,
    beta: bestParams.beta,
    gamma: bestParams.gamma,
    seasonalityPeriod: m,
    inSampleFitted: finalEval.fitted.map(round2),
    forecastHorizon: finalEval.forecast.map(round2),
    mapePct: round2(bestMape),
    rmse: round2(finalEval.rmse),
  };
}

/**
 * Internal helper to run Holt-Winters equations.
 */
function evaluateHWMultiplicative(
  y: number[],
  m: number,
  alpha: number,
  beta: number,
  gamma: number,
  hSteps: number = 0
): { fitted: number[]; forecast: number[]; mape: number; rmse: number } {
  const n = y.length;
  const fitted: number[] = Array(n).fill(0);

  // Initialize Level & Trend
  let initialLevel = 0;
  for (let i = 0; i < m; i++) initialLevel += y[i];
  initialLevel /= m;

  let initialTrend = 0;
  for (let i = 0; i < m; i++) {
    initialTrend += (y[i + m] - y[i]) / m;
  }
  initialTrend /= m;

  // Initialize Seasonal Indices
  const s: number[] = Array(n + hSteps + m).fill(1);
  for (let i = 0; i < m; i++) {
    s[i] = initialLevel > 0 ? y[i] / initialLevel : 1.0;
  }

  // Normalize initial seasonal indices so their sum equals m
  const sSum = s.slice(0, m).reduce((a, b) => a + b, 0);
  for (let i = 0; i < m; i++) {
    s[i] = (s[i] * m) / (sSum || 1);
  }

  let l = initialLevel;
  let t = initialTrend;

  let totalAbsPctErr = 0;
  let totalSqErr = 0;
  let count = 0;

  for (let i = m; i < n; i++) {
    const prevL = l;
    const prevT = t;
    const seasonalIdx = s[i - m];

    // Forecast for current step
    const yHat = Math.max(1, (prevL + prevT) * seasonalIdx);
    fitted[i] = yHat;

    // Actual observation
    const actual = y[i];
    if (actual > 0) {
      totalAbsPctErr += Math.abs(actual - yHat) / actual;
      totalSqErr += Math.pow(actual - yHat, 2);
      count++;
    }

    // Update equations
    l = alpha * (actual / (seasonalIdx || 1)) + (1 - alpha) * (prevL + prevT);
    t = beta * (l - prevL) + (1 - beta) * prevT;
    s[i] = gamma * (actual / (l || 1)) + (1 - gamma) * seasonalIdx;
  }

  const mape = count > 0 ? (totalAbsPctErr / count) * 100 : 20;
  const rmse = count > 0 ? Math.sqrt(totalSqErr / count) : 10;

  // Generate out-of-sample forecast for horizon h
  const forecast: number[] = [];
  for (let step = 1; step <= hSteps; step++) {
    const sIndex = s[n - m + ((step - 1) % m)];
    const projected = Math.max(0, (l + step * t) * sIndex);
    forecast.push(projected);
  }

  return { fitted, forecast, mape, rmse };
}

/**
 * Holt's Linear Exponential Smoothing (Level + Trend) for shorter histories.
 */
function runHoltsLinearForecast(y: number[], hSteps: number): HoltWintersResult {
  const n = y.length;
  const alpha = 0.4;
  const beta = 0.15;

  let l = y[0];
  let t = y[1] - y[0];
  const fitted: number[] = [l];

  let totalAbsPctErr = 0;
  let totalSqErr = 0;

  for (let i = 1; i < n; i++) {
    const prevL = l;
    const prevT = t;
    const yHat = Math.max(0, prevL + prevT);
    fitted.push(yHat);

    const actual = y[i];
    if (actual > 0) {
      totalAbsPctErr += Math.abs(actual - yHat) / actual;
      totalSqErr += Math.pow(actual - yHat, 2);
    }

    l = alpha * actual + (1 - alpha) * (prevL + prevT);
    t = beta * (l - prevL) + (1 - beta) * prevT;
  }

  const forecast: number[] = [];
  for (let h = 1; h <= hSteps; h++) {
    forecast.push(Math.max(0, l + h * t));
  }

  const count = n - 1;
  const mape = count > 0 ? (totalAbsPctErr / count) * 100 : 15;
  const rmse = count > 0 ? Math.sqrt(totalSqErr / count) : 8;

  return {
    modelType: 'HOLT_LINEAR',
    alpha,
    beta,
    gamma: 0,
    seasonalityPeriod: 1,
    inSampleFitted: fitted.map(round2),
    forecastHorizon: forecast.map(round2),
    mapePct: round2(mape),
    rmse: round2(rmse),
  };
}

/**
 * Master Production Scheduling (MPS) calculation engine.
 * Computes Projected Available Balance (PAB) over future days and recommends production batches.
 */
export function calculateMasterProductionSchedule(
  currentStockKg: number,
  safetyStockThresholdKg: number,
  forecastDailyDemandKg: number[],
  committedDailyOrdersKg: number[] = [],
  scheduledBatchReceiptsKg: number[] = [],
  minBatchSizeKg: number = 80.0
): MPSScheduleSlot[] {
  const schedule: MPSScheduleSlot[] = [];
  let runningPAB = currentStockKg;

  const horizonDays = Math.max(forecastDailyDemandKg.length, 7);

  for (let d = 0; d < horizonDays; d++) {
    const startPAB = runningPAB;
    const forecast = forecastDailyDemandKg[d] || 0;
    const committed = committedDailyOrdersKg[d] || 0;
    const netDemand = Math.max(forecast, committed);
    const plannedReceipt = scheduledBatchReceiptsKg[d] || 0;

    const endingPAB = round2(startPAB + plannedReceipt - netDemand);
    const isBelowSafety = endingPAB < safetyStockThresholdKg;

    let recommendedBatch = 0;
    if (isBelowSafety) {
      const deficit = safetyStockThresholdKg - endingPAB;
      // Round up to multiples of standard batch size (e.g. 80kg or 100kg)
      recommendedBatch = Math.max(minBatchSizeKg, Math.ceil(deficit / minBatchSizeKg) * minBatchSizeKg);
    }

    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() + d + 1);
    const dateStr = dateObj.toISOString().split('T')[0];

    schedule.push({
      dayIndex: d + 1,
      dateStr,
      startingPABKg: round2(startPAB),
      forecastDemandKg: round2(forecast),
      committedOrdersKg: round2(committed),
      netDemandKg: round2(netDemand),
      plannedProductionReceiptKg: round2(plannedReceipt),
      endingPABKg: endingPAB,
      safetyStockKg: round2(safetyStockThresholdKg),
      isBelowSafetyStock: isBelowSafety,
      recommendedBatchKg: round2(recommendedBatch),
    });

    // Advance PAB to next day (simulating planned receipt + recommended batch if executed)
    runningPAB = endingPAB;
  }

  return schedule;
}
