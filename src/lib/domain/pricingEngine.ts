/**
 * Joshi Mangodi Operations Math Engine - Dynamic Pricing & GST Engine
 * 
 * Implements 4-tier hierarchical price resolution:
 * 1. Customer Contract Override (₹/kg mapped to packet grams)
 * 2. Quantity-Break Volume Discount (≥50kg -> Tier 2, ≥10kg -> Tier 1)
 * 3. Sales Channel Tier (Retail / Wholesale T1 / Wholesale T2)
 * 4. Standard Retail Price
 * 
 * Also handles Indian GST (CGST/SGST/IGST) calculations with 2-decimal precision.
 */

import type { ProductSKU, Customer, SalesChannel, CartItem, OrderLineItem } from '../../types';
import { round2 } from './precision';

export interface PriceResolutionResult {
  unitPriceInr: number;
  totalInr: number;
  priceSource: 'CONTRACT_OVERRIDE' | 'VOLUME_TIER_2' | 'VOLUME_TIER_1' | 'CHANNEL_WHOLESALE_T2' | 'CHANNEL_WHOLESALE_T1' | 'RETAIL';
  unitMrpInr: number;
  savingsVsMrpInr: number;
}

export interface TaxBreakdown {
  taxableBaseInr: number;
  gstRatePct: number;
  totalGstInr: number;
  cgstInr: number;
  sgstInr: number;
  igstInr: number;
  isInterstate: boolean;
}

export interface OrderFinancialSummary {
  itemCount: number;
  totalWeightKg: number;
  grossSubtotalInr: number;
  discountInr: number;
  taxableBaseInr: number;
  totalGstInr: number;
  cgstInr: number;
  sgstInr: number;
  igstInr: number;
  grandTotalInr: number;
  amountPaidInr: number;
  creditAddedInr: number;
  changeDueInr: number;
}

/**
 * Resolves the optimal unit price for a given SKU and customer context.
 */
export function resolveSKUPrice(
  sku: ProductSKU,
  quantity: number,
  channel: SalesChannel,
  customer: Customer | null = null
): PriceResolutionResult {
  const packetGrams = sku.packetSizeGrams || 500;
  const weightKg = (quantity * packetGrams) / 1000;

  // 1. Check Customer Contract Price Override (in INR per kg)
  if (customer && customer.contractPricePerKg && customer.contractPricePerKg > 0) {
    const unitPrice = round2((customer.contractPricePerKg * packetGrams) / 1000);
    const total = round2(unitPrice * quantity);
    const savings = round2(Math.max(0, sku.mrpInr * quantity - total));
    return {
      unitPriceInr: unitPrice,
      totalInr: total,
      priceSource: 'CONTRACT_OVERRIDE',
      unitMrpInr: sku.mrpInr,
      savingsVsMrpInr: savings,
    };
  }

  // 2. Check Volume Discount Quantity Breaks
  if (weightKg >= 50 && sku.wholesaleT2PriceInr > 0) {
    const unitPrice = sku.wholesaleT2PriceInr;
    const total = round2(unitPrice * quantity);
    const savings = round2(Math.max(0, sku.mrpInr * quantity - total));
    return {
      unitPriceInr: unitPrice,
      totalInr: total,
      priceSource: 'VOLUME_TIER_2',
      unitMrpInr: sku.mrpInr,
      savingsVsMrpInr: savings,
    };
  }

  if (weightKg >= 10 && sku.wholesaleT1PriceInr > 0) {
    const unitPrice = sku.wholesaleT1PriceInr;
    const total = round2(unitPrice * quantity);
    const savings = round2(Math.max(0, sku.mrpInr * quantity - total));
    return {
      unitPriceInr: unitPrice,
      totalInr: total,
      priceSource: 'VOLUME_TIER_1',
      unitMrpInr: sku.mrpInr,
      savingsVsMrpInr: savings,
    };
  }

  // 3. Channel Tier
  if (channel === 'WHOLESALE_T2' && sku.wholesaleT2PriceInr > 0) {
    const unitPrice = sku.wholesaleT2PriceInr;
    const total = round2(unitPrice * quantity);
    return {
      unitPriceInr: unitPrice,
      totalInr: total,
      priceSource: 'CHANNEL_WHOLESALE_T2',
      unitMrpInr: sku.mrpInr,
      savingsVsMrpInr: round2(Math.max(0, sku.mrpInr * quantity - total)),
    };
  }

  if (channel === 'WHOLESALE_T1' && sku.wholesaleT1PriceInr > 0) {
    const unitPrice = sku.wholesaleT1PriceInr;
    const total = round2(unitPrice * quantity);
    return {
      unitPriceInr: unitPrice,
      totalInr: total,
      priceSource: 'CHANNEL_WHOLESALE_T1',
      unitMrpInr: sku.mrpInr,
      savingsVsMrpInr: round2(Math.max(0, sku.mrpInr * quantity - total)),
    };
  }

  // 4. Default Retail Price
  const unitPrice = sku.retailPriceInr;
  const total = round2(unitPrice * quantity);
  return {
    unitPriceInr: unitPrice,
    totalInr: total,
    priceSource: 'RETAIL',
    unitMrpInr: sku.mrpInr,
    savingsVsMrpInr: round2(Math.max(0, sku.mrpInr * quantity - total)),
  };
}

/**
 * Computes GST breakdown from gross tax-inclusive amount.
 * Intrastate (Rajasthan) splits into equal CGST + SGST.
 * Interstate (Outside Rajasthan, e.g. Haryana / Delhi) applies full IGST.
 */
export function calculateTaxBreakdown(
  grossTotalInr: number,
  gstRatePct: number,
  customerGstinOrState?: string
): TaxBreakdown {
  if (grossTotalInr <= 0 || gstRatePct <= 0) {
    return {
      taxableBaseInr: grossTotalInr,
      gstRatePct: 0,
      totalGstInr: 0,
      cgstInr: 0,
      sgstInr: 0,
      igstInr: 0,
      isInterstate: false,
    };
  }

  // Check state code: Rajasthan GSTIN begins with "08"
  const isInterstate = Boolean(
    customerGstinOrState &&
      customerGstinOrState.length >= 2 &&
      !customerGstinOrState.startsWith('08') &&
      !customerGstinOrState.toLowerCase().includes('rajasthan')
  );

  // Inclusive GST Formula: TaxableBase = Gross / (1 + Rate / 100)
  const taxableBase = round2(grossTotalInr / (1 + gstRatePct / 100));
  const totalGst = round2(grossTotalInr - taxableBase);

  if (isInterstate) {
    return {
      taxableBaseInr: taxableBase,
      gstRatePct,
      totalGstInr: totalGst,
      cgstInr: 0,
      sgstInr: 0,
      igstInr: totalGst,
      isInterstate: true,
    };
  }

  // Intrastate: 50% CGST + 50% SGST
  const cgst = round2(totalGst / 2);
  const sgst = round2(totalGst - cgst); // Prevents rounding penny discrepancy

  return {
    taxableBaseInr: taxableBase,
    gstRatePct,
    totalGstInr: totalGst,
    cgstInr: cgst,
    sgstInr: sgst,
    igstInr: 0,
    isInterstate: false,
  };
}

/**
 * Calculates complete financial breakdown for an entire order.
 */
export function calculateOrderFinancials(
  items: Array<{ quantity: number; unitPriceInr: number; totalInr: number; gstRate: number; packetSizeGrams?: number }>,
  discountInr: number = 0,
  amountPaidInr: number = 0,
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Credit' = 'Cash',
  customerStateOrGstin?: string
): OrderFinancialSummary {
  const grossSubtotal = round2(items.reduce((acc, item) => acc + item.totalInr, 0));
  const clampedDiscount = round2(Math.min(discountInr, grossSubtotal));
  const grandTotal = round2(Math.max(0, grossSubtotal - clampedDiscount));

  const totalWeightKg = round2(
    items.reduce((acc, item) => acc + (item.quantity * (item.packetSizeGrams || 500)) / 1000, 0)
  );

  // Calculate taxes across line items
  let totalTaxableBase = 0;
  let totalGst = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  for (const item of items) {
    // Distribute discount proportionally across items for tax base
    const itemDiscountRatio = grossSubtotal > 0 ? (item.totalInr / grossSubtotal) * clampedDiscount : 0;
    const netItemTotal = Math.max(0, item.totalInr - itemDiscountRatio);
    const tax = calculateTaxBreakdown(netItemTotal, item.gstRate || 5, customerStateOrGstin);

    totalTaxableBase += tax.taxableBaseInr;
    totalGst += tax.totalGstInr;
    totalCgst += tax.cgstInr;
    totalSgst += tax.sgstInr;
    totalIgst += tax.igstInr;
  }

  const effectiveAmountPaid = paymentMethod === 'Credit' ? 0 : Math.min(amountPaidInr, grandTotal);
  const creditAdded = paymentMethod === 'Credit' ? grandTotal : round2(Math.max(0, grandTotal - amountPaidInr));
  const changeDue = paymentMethod === 'Cash' && amountPaidInr > grandTotal ? round2(amountPaidInr - grandTotal) : 0;

  return {
    itemCount: items.reduce((acc, i) => acc + i.quantity, 0),
    totalWeightKg,
    grossSubtotalInr: grossSubtotal,
    discountInr: clampedDiscount,
    taxableBaseInr: round2(totalTaxableBase),
    totalGstInr: round2(totalGst),
    cgstInr: round2(totalCgst),
    sgstInr: round2(totalSgst),
    igstInr: round2(totalIgst),
    grandTotalInr: grandTotal,
    amountPaidInr: effectiveAmountPaid,
    creditAddedInr: creditAdded,
    changeDueInr: changeDue,
  };
}
