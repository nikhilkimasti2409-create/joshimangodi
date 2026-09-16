/**
 * Joshi Mangodi Operations Math Engine - Finance, Cash Drawer Reconciliation, P&L & Tally XML
 * 
 * Implements:
 * 1. Cash Drawer Denomination Counter and Expected Cash Reconciliation
 * 2. Comprehensive P&L Engine with COGS, gross margin %, operating expenses, and net profit
 * 3. Tally ERP 9 / TallyPrime XML Voucher export generator
 */

import type { CashDenominations, Order, Expense, CustomerPayment, ProductSKU } from '../../types';
import { round2 } from './precision';

export interface CashReconciliationCalculation {
  openingFloatInr: number;
  cashSalesInr: number;
  customerCashPaymentsInr: number;
  cashExpensesInr: number;
  expectedCashInr: number;
  countedCashInr: number;
  varianceInr: number;
  status: 'BALANCED' | 'SHORTAGE' | 'OVERAGE';
  nextDayFloatInr: number;
  bankDepositHandoverInr: number;
  denominationBreakdown: {
    n500Amount: number;
    n200Amount: number;
    n100Amount: number;
    n50Amount: number;
    n20Amount: number;
    n10Amount: number;
    coinsAmount: number;
  };
}

export interface ProfitAndLossReport {
  grossSalesInr: number;
  discountsGivenInr: number;
  netRevenueInr: number;
  totalCogsInr: number;
  grossProfitInr: number;
  grossMarginPct: number;
  expensesByCategory: Record<string, number>;
  totalOperatingExpensesInr: number;
  netOperatingProfitInr: number;
  netProfitMarginPct: number;
}

/**
 * Calculates physical cash denomination sum.
 */
export function sumDenominations(denoms: CashDenominations): {
  total: number;
  breakdown: CashReconciliationCalculation['denominationBreakdown'];
} {
  const n500Amount = (denoms.n500 || 0) * 500;
  const n200Amount = (denoms.n200 || 0) * 200;
  const n100Amount = (denoms.n100 || 0) * 100;
  const n50Amount = (denoms.n50 || 0) * 50;
  const n20Amount = (denoms.n20 || 0) * 20;
  const n10Amount = (denoms.n10 || 0) * 10;
  const coinsAmount = denoms.coins || 0;

  const total = round2(
    n500Amount + n200Amount + n100Amount + n50Amount + n20Amount + n10Amount + coinsAmount
  );

  return {
    total,
    breakdown: {
      n500Amount,
      n200Amount,
      n100Amount,
      n50Amount,
      n20Amount,
      n10Amount,
      coinsAmount,
    },
  };
}

/**
 * Computes Cash Drawer Expected Cash & Variance reconciliation.
 */
export function reconcileCashDrawer(
  openingFloatInr: number,
  cashOrders: Order[],
  cashPayments: CustomerPayment[],
  cashExpensesList: Expense[],
  denominations: CashDenominations,
  targetNextDayFloatInr: number = 5000
): CashReconciliationCalculation {
  const cashSales = cashOrders
    .filter((o) => !o.isVoid && o.paymentMethod === 'Cash')
    .reduce((sum, o) => sum + (o.amountPaidInr || o.grandTotalInr), 0);

  const customerCashIn = cashPayments
    .filter((p) => p.paymentMethod === 'Cash')
    .reduce((sum, p) => sum + p.amountInr, 0);

  const cashExpensesOut = cashExpensesList
    .filter((e) => e.paymentMethod === 'Cash')
    .reduce((sum, e) => sum + e.amountInr, 0);

  const expectedCash = round2(openingFloatInr + cashSales + customerCashIn - cashExpensesOut);
  const { total: countedCash, breakdown } = sumDenominations(denominations);
  const variance = round2(countedCash - expectedCash);

  let status: CashReconciliationCalculation['status'] = 'BALANCED';
  if (Math.abs(variance) < 0.01) {
    status = 'BALANCED';
  } else if (variance > 0) {
    status = 'OVERAGE';
  } else {
    status = 'SHORTAGE';
  }

  const bankDeposit = round2(Math.max(0, countedCash - targetNextDayFloatInr));

  return {
    openingFloatInr: round2(openingFloatInr),
    cashSalesInr: round2(cashSales),
    customerCashPaymentsInr: round2(customerCashIn),
    cashExpensesInr: round2(cashExpensesOut),
    expectedCashInr: expectedCash,
    countedCashInr: countedCash,
    varianceInr: variance,
    status,
    nextDayFloatInr: targetNextDayFloatInr,
    bankDepositHandoverInr: bankDeposit,
    denominationBreakdown: breakdown,
  };
}

/**
 * Generates dynamic Profit & Loss statement across orders, products COGS, and expenses.
 */
export function calculateProfitAndLoss(
  orders: Order[],
  products: ProductSKU[],
  expenses: Expense[]
): ProfitAndLossReport {
  const activeOrders = orders.filter((o) => !o.isVoid);

  const grossSales = activeOrders.reduce((sum, o) => sum + o.subtotalInr, 0);
  const discountsGiven = activeOrders.reduce((sum, o) => sum + (o.discountInr || 0), 0);
  const netRevenue = round2(grossSales - discountsGiven);

  // Compute Cost of Goods Sold
  let totalCogs = 0;
  for (const ord of activeOrders) {
    for (const item of ord.items) {
      const prod = products.find((p) => p.id === item.skuId);
      const unitCogs = prod?.unitCostInr || item.unitPriceInr * 0.6;
      totalCogs += unitCogs * item.quantity;
    }
  }
  totalCogs = round2(totalCogs);

  const grossProfit = round2(netRevenue - totalCogs);
  const grossMarginPct = netRevenue > 0 ? round2((grossProfit / netRevenue) * 100) : 0;

  // Aggregate expenses by category
  const expensesByCategory: Record<string, number> = {};
  let totalExpenses = 0;

  for (const exp of expenses) {
    expensesByCategory[exp.category] = round2((expensesByCategory[exp.category] || 0) + exp.amountInr);
    totalExpenses += exp.amountInr;
  }
  totalExpenses = round2(totalExpenses);

  const netOperatingProfit = round2(grossProfit - totalExpenses);
  const netProfitMarginPct = netRevenue > 0 ? round2((netOperatingProfit / netRevenue) * 100) : 0;

  return {
    grossSalesInr: round2(grossSales),
    discountsGivenInr: round2(discountsGiven),
    netRevenueInr: netRevenue,
    totalCogsInr: totalCogs,
    grossProfitInr: grossProfit,
    grossMarginPct,
    expensesByCategory,
    totalOperatingExpensesInr: totalExpenses,
    netOperatingProfitInr: netOperatingProfit,
    netProfitMarginPct,
  };
}

/**
 * XML string escaper for Tally ERP XML export.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates standard Tally Prime / ERP 9 XML import string for sales vouchers.
 */
export function generateTallySalesXml(orders: Order[]): string {
  const activeOrders = orders.filter((o) => !o.isVoid);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<ENVELOPE>\n`;
  xml += `  <HEADER>\n`;
  xml += `    <TALLYREQUEST>Import Data</TALLYREQUEST>\n`;
  xml += `  </HEADER>\n`;
  xml += `  <BODY>\n`;
  xml += `    <IMPORTDATA>\n`;
  xml += `      <REQUESTDESC>\n`;
  xml += `        <REPORTNAME>Vouchers</REPORTNAME>\n`;
  xml += `      </REQUESTDESC>\n`;
  xml += `      <REQUESTDATA>\n`;

  for (const ord of activeOrders) {
    const tallyDate = ord.date.replace(/-/g, '');
    const partyName = escapeXml(ord.customerName || 'Cash Sales');
    const voucherType = ord.channel.startsWith('WHOLESALE') ? 'Wholesale Sales' : 'Retail Sales';

    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `          <VOUCHER VCHTYPE="${voucherType}" ACTION="Create">\n`;
    xml += `            <DATE>${tallyDate}</DATE>\n`;
    xml += `            <VOUCHERNUMBER>${escapeXml(ord.billNo)}</VOUCHERNUMBER>\n`;
    xml += `            <PARTYLEDGERNAME>${partyName}</PARTYLEDGERNAME>\n`;
    xml += `            <PERSISTEDVIEW>Invoice View</PERSISTEDVIEW>\n`;
    xml += `            <ISINVOICE>Yes</ISINVOICE>\n`;
    xml += `            <NARRATION>${escapeXml(ord.notes || 'Joshi Mangodi POS Bill')}</NARRATION>\n`;

    // Customer Ledger Entry (Debit)
    xml += `            <ALLLEDGERENTRIES.LIST>\n`;
    xml += `              <LEDGERNAME>${partyName}</LEDGERNAME>\n`;
    xml += `              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`;
    xml += `              <AMOUNT>-${ord.grandTotalInr.toFixed(2)}</AMOUNT>\n`;
    xml += `            </ALLLEDGERENTRIES.LIST>\n`;

    // Sales Ledger Entry (Credit)
    const taxableTotal = Math.max(0, ord.grandTotalInr - ord.gstAmountInr);
    xml += `            <ALLLEDGERENTRIES.LIST>\n`;
    xml += `              <LEDGERNAME>Sales Account @ 5%</LEDGERNAME>\n`;
    xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
    xml += `              <AMOUNT>${taxableTotal.toFixed(2)}</AMOUNT>\n`;
    xml += `            </ALLLEDGERENTRIES.LIST>\n`;

    // GST Ledger Entries
    if (ord.gstAmountInr > 0) {
      const halfGst = (ord.gstAmountInr / 2).toFixed(2);
      xml += `            <ALLLEDGERENTRIES.LIST>\n`;
      xml += `              <LEDGERNAME>Output CGST @ 2.5%</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>${halfGst}</AMOUNT>\n`;
      xml += `            </ALLLEDGERENTRIES.LIST>\n`;
      xml += `            <ALLLEDGERENTRIES.LIST>\n`;
      xml += `              <LEDGERNAME>Output SGST @ 2.5%</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>${halfGst}</AMOUNT>\n`;
      xml += `            </ALLLEDGERENTRIES.LIST>\n`;
    }

    xml += `          </VOUCHER>\n`;
    xml += `        </TALLYMESSAGE>\n`;
  }

  xml += `      </REQUESTDATA>\n`;
  xml += `    </IMPORTDATA>\n`;
  xml += `  </BODY>\n`;
  xml += `</ENVELOPE>\n`;

  return xml;
}
