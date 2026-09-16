/**
 * Joshi Mangodi Operations Math Engine - Precision & Statistical Utilities
 * 
 * Provides IEEE 754 floating point safe arithmetic, financial half-up rounding,
 * clamp utilities, and basic descriptive statistics.
 */

/**
 * Rounds a number to exactly 2 decimal places using half-up arithmetic
 * (avoids JS floating-point issues like 1.005 rounding to 1.00).
 */
export function round2(value: number): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Rounds a number to 4 decimal places (for unit prices, tax ratios, and shrinkage percentages).
 */
export function round4(value: number): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

/**
 * Clamps a number between min and max bounds.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculates the arithmetic mean of an array of numbers.
 */
export function mean(values: number[]): number {
  if (!values.length) return 0;
  const total = values.reduce((sum, v) => sum + v, 0);
  return total / values.length;
}

/**
 * Calculates the sample standard deviation of an array of numbers.
 * Uses N - 1 denominator for sample standard deviation (Bessel's correction).
 */
export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const sumSquaredDiffs = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0);
  return Math.sqrt(sumSquaredDiffs / (values.length - 1));
}

/**
 * Calculates the sum of an array of numbers with precision rounding.
 */
export function sumPrecise(values: number[]): number {
  return round2(values.reduce((sum, v) => sum + v, 0));
}
