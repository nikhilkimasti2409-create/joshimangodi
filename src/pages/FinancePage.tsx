import { useState, useMemo } from 'react';
import {
  BadgeIndianRupee,
  Receipt,
  Download,
  Plus,
  Truck,
  Layers,
  FileText,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Archive,
  Trash2,
  Code2,
} from 'lucide-react';
import { useAppState, store } from '../lib/store';
import { t } from '../lib/i18n';
import { toRFC4180CSV, downloadFile } from '../lib/csv';
import type { Expense, PaymentMethod, CashDenominations } from '../types';

export default function FinancePage() {
  const { orders, expenses, reconciliations, dispatchTickets, inboundShipments, openingCashFloat } = useAppState();

  const [activeTab, setActiveTab] = useState<'PNL' | 'DRAWER' | 'EXPENSES' | 'LOGISTICS' | 'EXPORTS'>('PNL');
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isDrawerModalOpen, setIsDrawerModalOpen] = useState(false);

  // Expense Form State
  const [expCategory, setExpCategory] = useState<Expense['category']>('PISAI');
  const [expAmount, setExpAmount] = useState('');
  const [expVendor, setExpVendor] = useState('');
  const [expMode, setExpMode] = useState<PaymentMethod>('Cash');
  const [expNote, setExpNote] = useState('');

  // Cash Drawer Denominations State
  const [denoms, setDenoms] = useState<CashDenominations>({
    n500: 8,
    n200: 4,
    n100: 5,
    n50: 6,
    n20: 10,
    n10: 15,
    coins: 40,
  });
  const [drawerNotes, setDrawerNotes] = useState('');

  // Domain P&L Calculations
  const pnlReport = useMemo(() => {
    return store.getProfitAndLossReport();
  }, [orders, expenses]);

  // Today's Cash Calculations for Drawer
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCashSales = useMemo(() => {
    return orders
      .filter((o) => o.date === todayStr && !o.isVoid && o.paymentMethod === 'Cash')
      .reduce((s, o) => s + (o.amountPaidInr || o.grandTotalInr), 0);
  }, [orders, todayStr]);

  const todayCashExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.date === todayStr && e.paymentMethod === 'Cash')
      .reduce((s, e) => s + e.amountInr, 0);
  }, [expenses, todayStr]);

  const expectedCashInDrawer = openingCashFloat + todayCashSales - todayCashExpenses;

  const countedCash = useMemo(() => {
    return (
      (denoms.n500 || 0) * 500 +
      (denoms.n200 || 0) * 200 +
      (denoms.n100 || 0) * 100 +
      (denoms.n50 || 0) * 50 +
      (denoms.n20 || 0) * 20 +
      (denoms.n10 || 0) * 10 +
      (denoms.coins || 0)
    );
  }, [denoms]);

  const drawerVariance = countedCash - expectedCashInDrawer;

  const handleLogExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expAmount);
    if (!amt || amt <= 0) {
      alert('Enter a valid expense amount.');
      return;
    }

    store.logExpense({
      date: todayStr,
      category: expCategory,
      vendor: expVendor.trim() || 'Local Vendor',
      paymentMethod: expMode,
      amountInr: amt,
      note: expNote.trim(),
    });

    setIsExpenseModalOpen(false);
    setExpAmount('');
    setExpVendor('');
    setExpNote('');
  };

  const handleCloseDrawer = () => {
    if (confirm(`Confirm closing today's cash drawer? Variance: ₹${drawerVariance}`)) {
      store.closeCashDrawer({
        date: todayStr,
        openingFloatInr: openingCashFloat,
        cashSalesInr: todayCashSales,
        cashExpensesInr: todayCashExpenses,
        expectedCashInr: expectedCashInDrawer,
        countedCashInr: countedCash,
        varianceInr: drawerVariance,
        denominations: denoms,
        nextDayFloatInr: Math.min(5000, countedCash),
        operator: 'Anjali B. (Owner)',
        notes: drawerNotes.trim() || undefined,
      });

      setIsDrawerModalOpen(false);
      alert('Cash drawer closed and reconciliation archived.');
    }
  };

  // CSV & XML Exports
  const exportGSTR1CSV = () => {
    const validOrders = orders.filter((o) => !o.isVoid);
    const headers = ['Invoice Number', 'Invoice Date', 'Channel', 'Customer Name', 'GSTIN', 'Taxable Value', 'GST Rate %', 'CGST Amount', 'SGST Amount', 'Total Invoice Value', 'Payment Mode'];
    const rows = validOrders.map((o) => {
      const taxable = Math.round((o.grandTotalInr - o.gstAmountInr) * 100) / 100;
      const halfGst = Math.round((o.gstAmountInr / 2) * 100) / 100;
      return [
        o.billNo,
        o.date,
        o.channel,
        o.customerName || 'Counter Retail',
        o.customerGstin || '',
        taxable,
        '5%',
        halfGst,
        halfGst,
        o.grandTotalInr,
        o.paymentMethod,
      ];
    });

    const csv = toRFC4180CSV(headers, rows);
    downloadFile(`joshi-mangodi-gstr1-${todayStr}.csv`, csv);
  };

  const exportExpensesCSV = () => {
    const headers = ['Date', 'Category', 'Vendor / Payee', 'Payment Mode', 'Amount (INR)', 'Note'];
    const rows = expenses.map((e) => [e.date, e.category, e.vendor, e.paymentMethod, e.amountInr, e.note]);
    const csv = toRFC4180CSV(headers, rows);
    downloadFile(`joshi-mangodi-expenses-${todayStr}.csv`, csv);
  };

  const exportTallyXML = () => {
    const xml = store.exportTallyXmlString();
    downloadFile(`joshi-mangodi-tally-vouchers-${todayStr}.xml`, xml, 'application/xml');
  };

  const exportFullJSONBackup = () => {
    const fullState = store.getState();
    const jsonStr = JSON.stringify(fullState, null, 2);
    downloadFile(`joshi-mangodi-full-backup-${todayStr}.json`, jsonStr, 'application/json');
  };

  return (
    <div className="min-h-[calc(100vh-120px)] pb-32 md:pb-12">
      {/* Top Banner */}
      <div className="bg-white border-b border-[#FCE7F3] px-3 sm:px-4 py-3 sm:py-4">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#31102A]">
              Finance, Cash Drawer & Tally Prime
            </h1>
            <p className="text-xs text-[#632055]">
              Real-time P&L income statement, physical notes counter, expense day-book & Tally XML integration
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="jm-btn-primary !min-h-[38px] !text-xs !font-extrabold flex items-center gap-1.5 shadow-sm flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <Plus size={15} />
              <span>+ Log Expense</span>
            </button>

            <button
              onClick={() => setIsDrawerModalOpen(true)}
              className="jm-btn-secondary !min-h-[38px] !text-xs flex items-center gap-1.5 bg-[#FEFCE8] border-[#FDE047] flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <Lock size={14} />
              <span>Cash Drawer Lock</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="bg-white border-b border-[#FCE7F3] px-3 sm:px-4 py-2 sticky top-[80px] sm:top-[68px] z-20 shadow-xs">
        <div className="mx-auto max-w-7xl flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {[
            { id: 'PNL', label: 'P&L Statement' },
            { id: 'DRAWER', label: 'Cash Drawer' },
            { id: 'EXPENSES', label: 'Expenses' },
            { id: 'LOGISTICS', label: 'Logistics & Dispatch' },
            { id: 'EXPORTS', label: 'GST, Tally & Backup' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#31102A] text-white shadow-xs'
                  : 'bg-[#FFF9FA] text-[#632055] hover:bg-[#FEFCE8] border border-[#FCE7F3]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Areas */}
      <div className="mx-auto max-w-7xl px-3 sm:px-6 pt-4">
        {activeTab === 'PNL' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="jm-card p-4 sm:p-5 bg-white">
                <div className="text-[10px] sm:text-[11px] font-bold text-[#632055] uppercase tracking-wider">
                  Net Sales Revenue
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#31102A] mt-1.5">
                  ₹{pnlReport.netRevenueInr.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] sm:text-xs text-emerald-700 font-semibold mt-0.5">
                  Gross: ₹{pnlReport.grossSalesInr.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="jm-card p-4 sm:p-5 bg-[#FFF9FA]">
                <div className="text-[10px] sm:text-[11px] font-bold text-[#632055] uppercase tracking-wider">
                  True COGS Rollup
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#9F1239] mt-1.5">
                  ₹{pnlReport.totalCogsInr.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] sm:text-xs text-[#632055] font-semibold mt-0.5">
                  Dal + labor + spices + packaging
                </div>
              </div>

              <div className="jm-card p-4 sm:p-5 bg-white">
                <div className="text-[10px] sm:text-[11px] font-bold text-[#632055] uppercase tracking-wider">
                  Operating Expenses
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#31102A] mt-1.5">
                  ₹{pnlReport.totalOperatingExpensesInr.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] sm:text-xs text-[#632055] font-semibold mt-0.5">
                  Grinding, transport & shop overhead
                </div>
              </div>

              <div className="jm-card p-4 sm:p-5 bg-[#FEFCE8] border border-[#FDE047]">
                <div className="text-[10px] sm:text-[11px] font-bold text-[#632055] uppercase tracking-wider">
                  Net Operating Profit
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-800 mt-1.5">
                  ₹{pnlReport.netOperatingProfitInr.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] sm:text-xs font-black text-emerald-700 mt-0.5">
                  {pnlReport.netProfitMarginPct}% Net profit rate
                </div>
              </div>
            </div>

            {/* Income Statement Table */}
            <div className="jm-card p-4 sm:p-6 bg-white">
              <h2 className="text-base sm:text-lg font-black text-[#31102A] mb-4 border-b border-[#FCE7F3] pb-2">
                Income Statement Breakdown
              </h2>

              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex justify-between py-2 border-b border-[#FCE7F3]">
                  <span className="font-bold text-[#31102A]">1. Gross Sales Revenue</span>
                  <span className="font-black text-[#31102A]">₹{pnlReport.grossSalesInr.toLocaleString('en-IN')}</span>
                </div>

                {pnlReport.discountsGivenInr > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-[#FCE7F3] pl-3 text-[#632055] text-xs">
                    <span>- Less: Discounts Given:</span>
                    <span className="font-semibold text-red-700">-₹{pnlReport.discountsGivenInr.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="flex justify-between py-2 border-b border-[#FCE7F3] text-red-800">
                  <span className="font-bold">2. Cost of Goods Sold (COGS)</span>
                  <span className="font-black">-₹{pnlReport.totalCogsInr.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between py-2.5 border-b-2 border-[#FCE7F3] bg-[#FFF9FA] px-3 rounded-lg font-black text-[#31102A]">
                  <span>Gross Profit (Margin: {pnlReport.grossMarginPct}%)</span>
                  <span className="text-[#047857]">₹{pnlReport.grossProfitInr.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between py-2 border-b border-[#FCE7F3] text-red-800">
                  <span className="font-bold">3. Total Operating Expenses</span>
                  <span className="font-black">-₹{pnlReport.totalOperatingExpensesInr.toLocaleString('en-IN')}</span>
                </div>

                {Object.entries(pnlReport.expensesByCategory).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between py-1 border-b border-gray-100 pl-4 text-xs text-gray-600">
                    <span>• {cat}:</span>
                    <span className="font-medium">₹{amt.toLocaleString('en-IN')}</span>
                  </div>
                ))}

                <div className="flex justify-between py-3 bg-[#FEFCE8] px-3 sm:px-4 rounded-xl border border-[#FDE047] font-black text-sm sm:text-base text-[#31102A]">
                  <span>Net Business Profit</span>
                  <span className="text-[#047857] text-lg sm:text-xl">₹{pnlReport.netOperatingProfitInr.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'DRAWER' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-6 jm-card p-4 sm:p-6 bg-white">
              <div className="flex items-center justify-between border-b border-[#FCE7F3] pb-3 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#31102A]">
                    Today’s Cash Drawer
                  </h2>
                  <p className="text-xs text-[#632055]">Date: {todayStr}</p>
                </div>
                <button
                  onClick={() => setIsDrawerModalOpen(true)}
                  className="jm-btn-primary !min-h-[34px] !text-xs !font-bold cursor-pointer"
                >
                  <Lock size={13} /> Lock Drawer
                </button>
              </div>

              <div className="space-y-2 p-3.5 rounded-xl bg-[#FFF9FA] border border-[#FCE7F3] text-xs">
                <div className="flex justify-between">
                  <span>Morning Opening Float:</span>
                  <span className="font-bold">₹{openingCashFloat.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-emerald-800">
                  <span>+ Today's Cash Inflows:</span>
                  <span className="font-bold">+₹{todayCashSales.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-red-800">
                  <span>- Today's Cash Expenses:</span>
                  <span className="font-bold">-₹{todayCashExpenses.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-[#31102A] pt-2 border-t border-[#FCE7F3]">
                  <span>Expected Cash in Drawer:</span>
                  <span>₹{expectedCashInDrawer.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="font-extrabold text-xs text-[#31102A] mb-2.5 uppercase tracking-wider">
                  Physical Notes & Coins Counting:
                </h3>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: '₹500 Notes', key: 'n500', val: 500 },
                    { label: '₹200 Notes', key: 'n200', val: 200 },
                    { label: '₹100 Notes', key: 'n100', val: 100 },
                    { label: '₹50 Notes', key: 'n50', val: 50 },
                    { label: '₹20 Notes', key: 'n20', val: 20 },
                    { label: '₹10 Notes', key: 'n10', val: 10 },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-2 rounded-lg border border-[#FCE7F3] bg-white">
                      <span className="font-bold text-[11px]">{item.label}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={(denoms as any)[item.key]}
                          onChange={(e) => setDenoms({ ...denoms, [item.key]: Number(e.target.value) || 0 })}
                          className="w-12 text-center px-1 py-1 border border-[#FCE7F3] rounded text-xs font-bold"
                        />
                        <span className="w-12 text-right text-[10px] font-mono font-bold text-[#632055]">
                          ₹{(denoms as any)[item.key] * item.val}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between p-2 mt-2 rounded-lg border border-[#FCE7F3] bg-white text-xs">
                  <span className="font-bold text-[11px]">Coins Total (₹)</span>
                  <input
                    type="number"
                    min="0"
                    value={denoms.coins}
                    onChange={(e) => setDenoms({ ...denoms, coins: Number(e.target.value) || 0 })}
                    className="w-16 text-right px-2 py-1 border border-[#FCE7F3] rounded text-xs font-bold"
                  />
                </div>

                <div className={`mt-3.5 p-3.5 rounded-xl border text-xs flex justify-between items-center ${
                  Math.abs(drawerVariance) === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : drawerVariance < 0
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  <div>
                    <div className="font-bold">Total Counted: ₹{countedCash}</div>
                    <div className="text-[10px] mt-0.5">
                      {Math.abs(drawerVariance) === 0 ? 'Exact Match' : drawerVariance < 0 ? 'Cash Shortage' : 'Cash Surplus'}
                    </div>
                  </div>
                  <div className="text-right font-black text-sm sm:text-base">
                    Variance: {drawerVariance > 0 ? `+₹${drawerVariance}` : `₹${drawerVariance}`}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 jm-card p-4 sm:p-6 bg-white">
              <div className="flex items-center justify-between border-b border-[#FCE7F3] pb-3 mb-4">
                <h2 className="text-base sm:text-lg font-black text-[#31102A]">
                  Drawer Closure Archive
                </h2>
                <span className="text-xs text-gray-500">{reconciliations.length} records</span>
              </div>

              <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                {reconciliations.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#632055]">
                    No past drawer closures recorded yet.
                  </div>
                ) : (
                  reconciliations.map((rec) => (
                    <div key={rec.id} className="p-3.5 rounded-xl border border-[#FCE7F3] bg-[#FFF9FA] space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-[#31102A]">{rec.date}</span>
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          Math.abs(rec.varianceInr) === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          Variance: ₹{rec.varianceInr}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#632055]">
                        <span>Expected: ₹{rec.expectedCashInr}</span>
                        <span>Counted: ₹{rec.countedCashInr}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 pt-1 border-t border-[#FCE7F3]">
                        Next Day Float: ₹{rec.nextDayFloatInr} · Operator: {rec.operator}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'EXPENSES' && (
          <div className="jm-card p-4 sm:p-6 bg-white">
            <div className="flex items-center justify-between border-b border-[#FCE7F3] pb-3 mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#31102A]">
                  Operational Expenses Ledger
                </h2>
                <p className="text-xs text-[#632055]">
                  {expenses.length} expenses logged
                </p>
              </div>

              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="jm-btn-primary !min-h-[36px] !text-xs !font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} /> + Add Expense
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FFF9FA] border-b border-[#FCE7F3] text-[#632055] font-bold">
                    <th className="p-2.5 sm:p-3">Date</th>
                    <th className="p-2.5 sm:p-3">Category</th>
                    <th className="p-2.5 sm:p-3">Vendor / Payee</th>
                    <th className="p-2.5 sm:p-3">Notes</th>
                    <th className="p-2.5 sm:p-3">Mode</th>
                    <th className="p-2.5 sm:p-3 text-right">Amount (₹)</th>
                    <th className="p-2.5 sm:p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FCE7F3]">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-[#FFF9FA]">
                      <td className="p-2.5 sm:p-3 font-mono">{exp.date}</td>
                      <td className="p-2.5 sm:p-3">
                        <span className="text-[10px] font-bold uppercase bg-[#FEF08A] text-[#31102A] px-2 py-0.5 rounded-md">
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-2.5 sm:p-3 font-bold text-[#31102A]">{exp.vendor}</td>
                      <td className="p-2.5 sm:p-3 text-gray-600">{exp.note}</td>
                      <td className="p-2.5 sm:p-3 font-semibold">{exp.paymentMethod}</td>
                      <td className="p-2.5 sm:p-3 text-right font-black text-red-700 text-sm">
                        ₹{exp.amountInr.toLocaleString('en-IN')}
                      </td>
                      <td className="p-2.5 sm:p-3 text-right">
                        <button
                          onClick={() => {
                            if (confirm('Delete expense?')) store.deleteExpense(exp.id);
                          }}
                          className="p-1 rounded text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'LOGISTICS' && (
          <div className="space-y-6">
            <div className="jm-card p-4 sm:p-6 bg-white">
              <div className="flex items-center justify-between border-b border-[#FCE7F3] pb-3 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#31102A]">
                    Wholesale Outbound Routes & Dispatch
                  </h2>
                  <p className="text-xs text-[#632055]">
                    {dispatchTickets.length} active delivery routes
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {dispatchTickets.map((ticket) => (
                  <div key={ticket.id} className="p-3.5 sm:p-4 rounded-xl border border-[#FCE7F3] bg-[#FFF9FA]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#FCE7F3] pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Truck size={17} className="text-[#9F1239]" />
                        <span className="font-mono font-bold text-[#31102A] text-xs sm:text-sm">{ticket.ticketNo}</span>
                        <span className="text-[11px] font-semibold text-[#632055]">({ticket.vehicleNumber})</span>
                      </div>
                      <div className="text-xs text-[#632055]">
                        Driver: <strong className="text-[#31102A]">{ticket.driverName}</strong> ({ticket.driverPhone})
                      </div>
                    </div>

                    <div className="space-y-1.5 mt-2">
                      {ticket.stops.map((stop) => (
                        <div key={stop.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs p-2 rounded-lg bg-white border border-[#FCE7F3]">
                          <div>
                            <div className="font-extrabold text-[#31102A]">{stop.customerName}</div>
                            <div className="text-[11px] text-[#632055]">{stop.customerAddress} · {stop.kg} kg</div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#FCE7F3]">
                            <span className="font-bold text-[#31102A]">₹{stop.amountInr}</span>
                            <button
                              onClick={() => {
                                const next = stop.status === 'delivered' ? 'pending' : 'delivered';
                                store.updateDispatchStopStatus(ticket.id, stop.id, next);
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition ${
                                stop.status === 'delivered'
                                   ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800 hover:bg-emerald-100'
                              }`}
                            >
                              {stop.status === 'delivered' ? 'Delivered ✓' : 'Mark Delivered'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="jm-card p-4 sm:p-6 bg-white">
              <h2 className="text-base sm:text-lg font-black text-[#31102A] mb-3">
                Inbound Supplier Deliveries
              </h2>

              <div className="space-y-2.5">
                {inboundShipments.map((inb) => (
                  <div key={inb.id} className="p-3 sm:p-3.5 rounded-xl border border-[#FCE7F3] bg-[#FFF9FA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#31102A]">{inb.shipmentNo}</span>
                        <span className="font-extrabold text-[#9F1239]">{inb.rawMaterialName}</span>
                      </div>
                      <div className="text-[#632055] mt-0.5">
                        Supplier: {inb.supplierName} · Vehicle: {inb.vehicleInfo} ({inb.driverName})
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#FCE7F3]">
                      <div className="text-right font-black text-[#31102A]">
                        {inb.orderedKg} kg (@ ₹{inb.ratePerKgInr}/kg)
                      </div>
                      {inb.status === 'delivered' ? (
                        <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                          Received in Stock ✓
                        </span>
                      ) : (
                        <button
                          onClick={() => store.receiveInboundDelivery(inb.id, inb.orderedKg)}
                          className="jm-btn-primary !min-h-[30px] !text-xs !py-1 cursor-pointer"
                        >
                          Add to Stock
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'EXPORTS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* GSTR-1 CSV Card */}
            <div className="jm-card p-5 sm:p-6 bg-white flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-[#FFF9FA] border border-[#FCE7F3] flex items-center justify-center text-[#9F1239] mb-3">
                  <FileText size={22} />
                </div>
                <h3 className="font-black text-base text-[#31102A]">GSTR-1 Sales CSV</h3>
                <p className="text-xs text-[#632055] mt-1">
                  RFC-4180 standard compliant B2B & B2C tax invoice records with HSN codes & CGST/SGST splits.
                </p>
              </div>
              <button
                onClick={exportGSTR1CSV}
                className="jm-btn-primary w-full mt-4 !text-xs !font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={14} /> Download GSTR-1 CSV
              </button>
            </div>

            {/* Tally Prime XML Export Card */}
            <div className="jm-card p-5 sm:p-6 bg-white flex flex-col justify-between border-2 border-[#FDE047]">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-[#FEFCE8] border border-[#FDE047] flex items-center justify-center text-[#31102A] mb-3">
                  <Code2 size={22} />
                </div>
                <h3 className="font-black text-base text-[#31102A]">Tally Prime XML</h3>
                <p className="text-xs text-[#632055] mt-1">
                  1-Click import format for Tally ERP 9 / TallyPrime sales vouchers & customer ledgers.
                </p>
              </div>
              <button
                onClick={exportTallyXML}
                className="jm-btn-primary w-full mt-4 !text-xs !font-bold flex items-center justify-center gap-2 bg-[#31102A] hover:bg-black text-white cursor-pointer"
              >
                <Download size={14} /> Download Tally XML
              </button>
            </div>

            {/* Expenses CSV Card */}
            <div className="jm-card p-5 sm:p-6 bg-white flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-[#FFF9FA] border border-[#FCE7F3] flex items-center justify-center text-[#9F1239] mb-3">
                  <Receipt size={22} />
                </div>
                <h3 className="font-black text-base text-[#31102A]">Expenses Day-Book CSV</h3>
                <p className="text-xs text-[#632055] mt-1">
                  Grinding, freight, packaging and operational expenditures export in Excel/CSV format.
                </p>
              </div>
              <button
                onClick={exportExpensesCSV}
                className="jm-btn-primary w-full mt-4 !text-xs !font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={14} /> Download Expenses CSV
              </button>
            </div>

            {/* JSON Snapshot Backup Card */}
            <div className="jm-card p-5 sm:p-6 bg-white flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-[#FEFCE8] border border-[#FDE047] flex items-center justify-center text-[#31102A] mb-3">
                  <Archive size={22} />
                </div>
                <h3 className="font-black text-base text-[#31102A]">Complete JSON Backup</h3>
                <p className="text-xs text-[#632055] mt-1">
                  Full offline snapshot of all products, customer ledgers, sales bills, batches and inventory.
                </p>
              </div>
              <button
                onClick={exportFullJSONBackup}
                className="jm-btn-secondary w-full mt-4 !text-xs !font-bold flex items-center justify-center gap-2 bg-[#FEFCE8] border-[#FDE047] cursor-pointer"
              >
                <Download size={14} /> Save JSON Backup
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 border-2 border-[#FCE7F3] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-[#FCE7F3] pb-2">
              <h3 className="font-black text-base sm:text-lg text-[#31102A]">Log New Expense</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleLogExpense} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Category *</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as any)}
                  className="jm-select !text-xs"
                >
                  <option value="PISAI">PISAI (Dal Grinding Mill)</option>
                  <option value="TRANSPORT">TRANSPORT (Tempo & Delivery Freight)</option>
                  <option value="PACKAGING">PACKAGING (Pouches, Sealing, Cartons)</option>
                  <option value="ENERGY">ENERGY (Electricity & Fuel)</option>
                  <option value="LABOR">LABOR (Daily Kaarigar Labor)</option>
                  <option value="MISC">MISC (Shop Overheads)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="jm-input !text-lg !font-black text-red-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Vendor / Payee</label>
                <input
                  type="text"
                  value={expVendor}
                  onChange={(e) => setExpVendor(e.target.value)}
                  placeholder="e.g. Kanhaiya Mill / Tempo Driver"
                  className="jm-input !text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'UPI', 'Card'] as PaymentMethod[]).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setExpMode(m)}
                      className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                        expMode === m ? 'bg-[#31102A] text-white' : 'bg-white text-[#632055] border-[#FCE7F3]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Description / Notes</label>
                <input
                  type="text"
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  placeholder="e.g. Grinding 120kg Moong Dal at Kanhaiya mill"
                  className="jm-input !text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="jm-btn-secondary flex-1 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button type="submit" className="jm-btn-primary flex-1 !font-black cursor-pointer">
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cash Drawer Lock Modal */}
      {isDrawerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 border-2 border-[#FCE7F3] shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-[#FCE7F3] pb-2">
              <div>
                <h3 className="font-black text-base sm:text-lg text-[#31102A]">End-of-Day Cash Drawer Lock</h3>
                <p className="text-xs text-[#632055]">Reconciliation & Safe Float Retention</p>
              </div>
              <button onClick={() => setIsDrawerModalOpen(false)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-2 p-3 rounded-xl bg-[#FFF9FA] border border-[#FCE7F3] text-xs">
              <div className="flex justify-between">
                <span>Total Counted Physical Cash:</span>
                <span className="font-black text-sm text-[#31102A]">₹{countedCash.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>Expected System Cash:</span>
                <span className="font-bold">₹{expectedCashInDrawer.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-black text-xs pt-1 border-t border-[#FCE7F3]">
                <span>Variance:</span>
                <span className={drawerVariance === 0 ? 'text-emerald-700' : 'text-red-700'}>
                  {drawerVariance > 0 ? `+₹${drawerVariance}` : `₹${drawerVariance}`}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#FEFCE8] border border-[#FDE047] text-xs space-y-1">
              <div className="flex justify-between">
                <span className="font-bold text-[#31102A]">Next Day Opening Float:</span>
                <span className="font-black">₹{Math.min(5000, countedCash)}</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-bold">
                <span>Bank Deposit Amount:</span>
                <span>₹{Math.max(0, countedCash - 5000)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#31102A] mb-1">Closing Notes</label>
              <input
                type="text"
                value={drawerNotes}
                onChange={(e) => setDrawerNotes(e.target.value)}
                placeholder="e.g. Daily shift closed smoothly, exact match."
                className="jm-input !text-xs"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDrawerModalOpen(false)}
                className="jm-btn-secondary flex-1 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="jm-btn-primary flex-1 !font-black bg-[#31102A] hover:bg-black text-white cursor-pointer"
              >
                Confirm & Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
