import { useState, useMemo } from 'react';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';
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
  Edit2,
  Coins,
  X,
} from 'lucide-react';
import { useAppState, store } from '../lib/store';
import { t } from '../lib/i18n';
import { showToast } from '../components/common/Toast';
import { toRFC4180CSV, downloadFile } from '../lib/csv';
import type { Expense, PaymentMethod, CashDenominations } from '../types';

export default function FinancePage() {
  const { orders, expenses, reconciliations, dispatchTickets, inboundShipments, openingCashFloat } = useAppState();

  const [activeTab, setActiveTab] = useState<'PNL' | 'DRAWER' | 'EXPENSES' | 'LOGISTICS' | 'EXPORTS'>('PNL');
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isDrawerModalOpen, setIsDrawerModalOpen] = useState(false);
  const [isFloatModalOpen, setIsFloatModalOpen] = useState(false);
  const [newFloatAmount, setNewFloatAmount] = useState(String(openingCashFloat || 0));

  // Expense Form State
  const [expCategory, setExpCategory] = useState<Expense['category']>('PISAI');
  const [expAmount, setExpAmount] = useState('');
  const [expVendor, setExpVendor] = useState('');
  const [expMode, setExpMode] = useState<PaymentMethod>('Cash');
  const [expNote, setExpNote] = useState('');

  // Cash Drawer Denominations State - 100% Clean Zero Initial State
  const [denoms, setDenoms] = useState<CashDenominations>({
    n500: 0,
    n200: 0,
    n100: 0,
    n50: 0,
    n20: 0,
    n10: 0,
    coins: 0,
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
      showToast('Invalid Amount', 'Please enter a valid positive expense amount.', 'warning');
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

    showToast('Expense Logged', `₹${amt} recorded under ${expCategory}.`, 'success');
    setIsExpenseModalOpen(false);
    setExpAmount('');
    setExpVendor('');
    setExpNote('');
  };

  const handleSaveOpeningFloat = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.max(0, Number(newFloatAmount) || 0);
    store.setOpeningCashFloat(amt);
    showToast('Float Updated', `Morning cash float set to ₹${amt}.`, 'success');
    setIsFloatModalOpen(false);
  };

  const handleCloseDrawer = () => {
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
    showToast('Drawer Reconciled', `Cash drawer closed. Variance: ₹${drawerVariance}.`, 'success');
  };

  // CSV & XML Exports
  const exportGSTR1CSV = () => {
    const validOrders = orders.filter((o) => !o.isVoid);
    if (validOrders.length === 0) {
      showToast('No Orders', 'No sales bills found to generate GSTR-1 CSV.', 'warning');
      return;
    }
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
    showToast('Download Complete', 'GSTR-1 Sales CSV exported successfully.', 'success');
  };

  const exportExpensesCSV = () => {
    if (expenses.length === 0) {
      showToast('No Expenses', 'No expenses recorded yet.', 'warning');
      return;
    }
    const headers = ['Date', 'Category', 'Vendor / Payee', 'Payment Mode', 'Amount (INR)', 'Note'];
    const rows = expenses.map((e) => [e.date, e.category, e.vendor, e.paymentMethod, e.amountInr, e.note]);
    const csv = toRFC4180CSV(headers, rows);
    downloadFile(`joshi-mangodi-expenses-${todayStr}.csv`, csv);
    showToast('Download Complete', 'Expenses Day-Book CSV exported successfully.', 'success');
  };

  const exportTallyXML = () => {
    const xml = store.exportTallyXmlString();
    downloadFile(`joshi-mangodi-tally-vouchers-${todayStr}.xml`, xml, 'application/xml');
    showToast('Download Complete', 'Tally Prime XML vouchers exported successfully.', 'success');
  };

  const exportFullJSONBackup = () => {
    const fullState = store.getState();
    const jsonStr = JSON.stringify(fullState, null, 2);
    downloadFile(`joshi-mangodi-full-backup-${todayStr}.json`, jsonStr, 'application/json');
    showToast('Download Complete', 'Full operational JSON backup saved.', 'success');
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] pb-32 md:pb-12 mx-auto max-w-7xl px-4 sm:px-6 py-6">
      
      <PageHeader
        title="Finance, Cash Drawer & Tally Prime"
        description="Real-time P&L income statement, physical notes counter, expense day-book & Tally XML integration"
        primaryAction={
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="jm-btn-primary flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={15} aria-hidden="true" />
            <span>Log Expense</span>
          </button>
        }
        secondaryActions={
          <button
            onClick={() => setIsDrawerModalOpen(true)}
            className="jm-btn-secondary flex items-center gap-1.5"
          >
            <Lock size={14} aria-hidden="true" />
            <span>Cash Drawer Lock</span>
          </button>
        }
      />

      {/* Navigation Sub-Tabs */}
      <div className="bg-surface border-b border-border py-2 sticky top-0 z-20 mb-6">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary text-white shadow-xs' : 'bg-surface text-ink-muted hover:bg-primary-soft border border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Areas */}
      <div>
        {activeTab === 'PNL' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="jm-card p-5 sm:p-6">
                <div className="text-[11px] sm:text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                  Net Sales Revenue
                </div>
                <div className="text-xl font-bold text-ink mt-1.5">
                  ₹{pnlReport.netRevenueInr.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] sm:text-xs text-success font-semibold mt-0.5">
                  Gross: ₹{pnlReport.grossSalesInr.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="jm-card p-5 sm:p-6">
                <div className="text-[11px] sm:text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                  True COGS Rollup
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-danger mt-1.5">
                  ₹{pnlReport.totalCogsInr.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] sm:text-xs text-ink-muted font-semibold mt-0.5">
                  Dal + labor + spices + packaging
                </div>
              </div>

              <div className="jm-card p-5 sm:p-6">
                <div className="text-[11px] sm:text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                  Operating Expenses
                </div>
                <div className="text-xl font-bold text-ink mt-1.5">
                  ₹{pnlReport.totalOperatingExpensesInr.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] sm:text-xs text-ink-muted font-semibold mt-0.5">
                  Grinding, transport & shop overhead
                </div>
              </div>

              <div className="jm-card p-5 sm:p-6">
                <div className="text-[11px] sm:text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                  Net Operating Profit
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-success mt-1.5">
                  ₹{pnlReport.netOperatingProfitInr.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] sm:text-xs font-bold text-success mt-0.5">
                  {pnlReport.netProfitMarginPct}% Net profit rate
                </div>
              </div>
            </div>

            {/* Income Statement Table */}
            <div className="jm-card p-5 sm:p-6">
              <h2 className="text-base sm:text-lg font-bold text-ink mb-4 border-b border-border pb-2">
                Income Statement Breakdown
              </h2>

              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="font-bold text-ink">1. Gross Sales Revenue</span>
                  <span className="font-bold text-ink">₹{pnlReport.grossSalesInr.toLocaleString('en-IN')}</span>
                </div>

                {pnlReport.discountsGivenInr > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-border pl-3 text-ink-muted text-xs">
                    <span>- Less: Discounts Given:</span>
                    <span className="font-semibold text-danger">-₹{pnlReport.discountsGivenInr.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="flex justify-between py-2 border-b border-border text-danger">
                  <span className="font-bold">2. Cost of Goods Sold (COGS)</span>
                  <span className="font-bold">-₹{pnlReport.totalCogsInr.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between py-2.5 border-b-2 border-border bg-surface px-3 rounded-lg font-bold text-ink">
                  <span>Gross Profit (Margin: {pnlReport.grossMarginPct}%)</span>
                  <span className="text-success">₹{pnlReport.grossProfitInr.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between py-2 border-b border-border text-danger">
                  <span className="font-bold">3. Total Operating Expenses</span>
                  <span className="font-bold">-₹{pnlReport.totalOperatingExpensesInr.toLocaleString('en-IN')}</span>
                </div>

                {Object.entries(pnlReport.expensesByCategory).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between py-1 border-b border-border pl-4 text-xs text-ink-muted">
                    <span>• {cat}:</span>
                    <span className="font-medium">₹{amt.toLocaleString('en-IN')}</span>
                  </div>
                ))}

                <div className="flex justify-between py-3 bg-warning-soft px-3 sm:px-4 rounded-xl border border-warning-soft font-bold text-sm sm:text-base text-ink">
                  <span>Net Business Profit</span>
                  <span className="text-success text-lg sm:text-xl">₹{pnlReport.netOperatingProfitInr.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'DRAWER' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-6 jm-card p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-ink">
                    Today’s Cash Drawer
                  </h2>
                  <p className="text-xs text-ink-muted">Date: {todayStr}</p>
                </div>
                <button
                  onClick={() => setIsDrawerModalOpen(true)}
                  className="jm-btn-primary cursor-pointer"
                >
                  <Lock size={13} /> Lock Drawer
                </button>
              </div>

              <div className="space-y-2 p-3.5 rounded-xl bg-surface border border-border text-xs">
                <div className="flex justify-between items-center">
                  <span>Morning Opening Float:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">₹{openingCashFloat.toLocaleString('en-IN')}</span>
                    <button
                      onClick={() => {
                        setNewFloatAmount(String(openingCashFloat));
                        setIsFloatModalOpen(true);
                      }}
                      className="p-1 rounded-md hover:bg-white border border-border text-danger cursor-pointer"
                      title="Edit Opening Float"
                      aria-label="Edit Opening Float"
                    >
                      <Edit2 size={12} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-success">
                  <span>+ Today's Cash Inflows:</span>
                  <span className="font-bold">+₹{todayCashSales.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-danger">
                  <span>- Today's Cash Expenses:</span>
                  <span className="font-bold">-₹{todayCashExpenses.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-ink pt-2 border-t border-border">
                  <span>Expected Cash in Drawer:</span>
                  <span>₹{expectedCashInDrawer.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="font-semibold text-xs text-ink mb-2.5 uppercase tracking-wider">
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
                    <div key={item.key} className="flex items-center justify-between p-2 rounded-lg border border-border bg-white">
                      <span className="font-bold text-[11px]">{item.label}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          aria-label={`Count of ₹${item.val} notes`}
                          value={(denoms as any)[item.key]}
                          onChange={(e) => setDenoms({ ...denoms, [item.key]: Number(e.target.value) || 0 })}
                          className="w-12 text-center px-1 py-1 border border-border rounded text-xs font-bold"
                        />
                        <span className="w-12 text-right text-[11px] font-mono font-bold text-ink-muted">
                          ₹{(denoms as any)[item.key] * item.val}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between p-2 mt-2 rounded-lg border border-border bg-white text-xs">
                  <span className="font-bold text-[11px]">Coins Total (₹)</span>
                  <input
                    type="number"
                    min="0"
                    aria-label="Coins total amount"
                    value={denoms.coins}
                    onChange={(e) => setDenoms({ ...denoms, coins: Number(e.target.value) || 0 })}
                    className="w-16 text-right px-2 py-1 border border-border rounded text-xs font-bold"
                  />
                </div>

                <div className={`mt-3.5 p-3.5 rounded-xl border text-xs flex justify-between items-center ${
                  Math.abs(drawerVariance) === 0
                    ? 'bg-success-soft text-success'
                    : drawerVariance < 0
                    ? 'bg-danger-soft text-danger'
                    : 'bg-warning-soft text-warning'
                }`}>
                  <div>
                    <div className="font-bold">Total Counted: ₹{countedCash}</div>
                    <div className="text-[11px] mt-0.5">
                      {Math.abs(drawerVariance) === 0 ? 'Exact Match' : drawerVariance < 0 ? 'Cash Shortage' : 'Cash Surplus'}
                    </div>
                  </div>
                  <div className="text-right font-bold text-sm sm:text-base">
                    Variance: {drawerVariance > 0 ? `+₹${drawerVariance}` : `₹${drawerVariance}`}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 jm-card p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <h2 className="text-base sm:text-lg font-bold text-ink">
                  Drawer Closure Archive
                </h2>
                <span className="text-xs text-ink-muted">{reconciliations.length} records</span>
              </div>

              <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                {reconciliations.length === 0 ? (
                  <div className="py-12 text-center text-xs text-ink-muted">
                    No past drawer closures recorded yet.
                  </div>
                ) : (
                  reconciliations.map((rec) => (
                    <div key={rec.id} className="p-3.5 rounded-xl border border-border bg-surface space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-ink">{rec.date}</span>
                        <StatusBadge variant={Math.abs(rec.varianceInr) === 0 ? 'success' : 'danger'} label={`Variance: ₹${rec.varianceInr}`} />
                      </div>
                      <div className="flex justify-between text-ink-muted">
                        <span>Expected: ₹{rec.expectedCashInr}</span>
                        <span>Counted: ₹{rec.countedCashInr}</span>
                      </div>
                      <div className="text-[11px] text-ink-muted pt-1 border-t border-border">
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
          <div className="jm-card p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-ink">
                  Operational Expenses Ledger
                </h2>
                <p className="text-xs text-ink-muted">
                  {expenses.length} expenses logged
                </p>
              </div>

              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="jm-btn-primary flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} /> + Add Expense
              </button>
            </div>

            
            {expenses.length === 0 ? (
              <EmptyState 
                title="No expenses logged"
                description="Click Add Expense to record operational expenditures."
                action={
                  <button onClick={() => setIsExpenseModalOpen(true)} className="jm-btn-primary">
                    <Plus size={14} className="mr-1 inline" aria-hidden="true" /> Add Expense
                  </button>
                }
              />
            ) : (
              <div className="overflow-x-auto">

              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-surface border-b border-border text-ink-muted font-semibold text-xs uppercase tracking-wide">
                    <th scope="col" className="p-2.5 sm:p-3">Date</th>
                    <th scope="col" className="p-2.5 sm:p-3">Category</th>
                    <th scope="col" className="p-2.5 sm:p-3">Vendor / Payee</th>
                    <th scope="col" className="p-2.5 sm:p-3">Notes</th>
                    <th scope="col" className="p-2.5 sm:p-3">Mode</th>
                    <th scope="col" className="p-2.5 sm:p-3 text-right">Amount (₹)</th>
                    <th scope="col" className="p-2.5 sm:p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="even:bg-surface hover:bg-surface">
                      <td className="p-2.5 sm:p-3 font-mono">{exp.date}</td>
                      <td className="p-2.5 sm:p-3">
                        <span className="text-[11px] font-bold uppercase bg-surface text-ink-muted px-2 py-0.5 rounded-md">
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-2.5 sm:p-3 font-bold text-ink">{exp.vendor}</td>
                      <td className="p-2.5 sm:p-3 text-ink-muted">{exp.note}</td>
                      <td className="p-2.5 sm:p-3 font-semibold">{exp.paymentMethod}</td>
                      <td className="p-2.5 sm:p-3 text-right font-bold text-danger text-sm">
                        ₹{exp.amountInr.toLocaleString('en-IN')}
                      </td>
                      <td className="p-2.5 sm:p-3 text-right">
                        <button
                          onClick={() => {
                            store.deleteExpense(exp.id);
                            showToast('Expense Deleted', `₹${exp.amountInr} expense removed.`, 'info');
                          }}
                          className="p-1.5 rounded-lg text-danger hover:bg-danger-soft cursor-pointer transition"
                          title="Delete Expense"
                          aria-label="Delete Expense"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}

        {activeTab === 'LOGISTICS' && (
          <div className="space-y-6">
            <div className="jm-card p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-ink">
                    Wholesale Outbound Routes & Dispatch
                  </h2>
                  <p className="text-xs text-ink-muted">
                    {dispatchTickets.length} active delivery routes
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {dispatchTickets.map((ticket) => (
                  <div key={ticket.id} className="p-3.5 sm:p-4 rounded-xl border border-border bg-surface">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Truck size={17} className="text-danger" />
                        <span className="font-mono font-bold text-ink text-xs sm:text-sm">{ticket.ticketNo}</span>
                        <span className="text-[11px] font-semibold text-ink-muted">({ticket.vehicleNumber})</span>
                      </div>
                      <div className="text-xs text-ink-muted">
                        Driver: <strong className="text-ink">{ticket.driverName}</strong> ({ticket.driverPhone})
                      </div>
                    </div>

                    <div className="space-y-1.5 mt-2">
                      {ticket.stops.map((stop) => (
                        <div key={stop.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs p-2 rounded-lg bg-white border border-border">
                          <div>
                            <div className="font-semibold text-ink">{stop.customerName}</div>
                            <div className="text-[11px] text-ink-muted">{stop.customerAddress} · {stop.kg} kg</div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-border">
                            <span className="font-bold text-ink">₹{stop.amountInr}</span>
                            <button
                              onClick={() => {
                                const next = stop.status === 'delivered' ? 'pending' : 'delivered';
                                store.updateDispatchStopStatus(ticket.id, stop.id, next);
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition ${
                                stop.status === 'delivered'
                                   ? 'bg-success-soft text-success'
                                  : 'bg-warning-soft text-warning'
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

            <div className="jm-card p-5 sm:p-6">
              <h2 className="text-base sm:text-lg font-bold text-ink mb-3">
                Inbound Supplier Deliveries
              </h2>

              <div className="space-y-2.5">
                {inboundShipments.map((inb) => (
                  <div key={inb.id} className="p-3 sm:p-3.5 rounded-xl border border-border bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-ink">{inb.shipmentNo}</span>
                        <span className="font-semibold text-danger">{inb.rawMaterialName}</span>
                      </div>
                      <div className="text-ink-muted mt-0.5">
                        Supplier: {inb.supplierName} · Vehicle: {inb.vehicleInfo} ({inb.driverName})
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                      <div className="text-right font-bold text-ink">
                        {inb.orderedKg} kg (@ ₹{inb.ratePerKgInr}/kg)
                      </div>
                      {inb.status === 'delivered' ? (
                        <StatusBadge variant="success" label="Received in Stock ✓" />
                      ) : (
                        <button
                          onClick={() => store.receiveInboundDelivery(inb.id, inb.orderedKg)}
                          className="jm-btn-primary cursor-pointer"
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
            <div className="jm-card p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-xl bg-surface border border-border flex items-center justify-center text-danger mb-3">
                  <FileText size={22} />
                </div>
                <h3 className="font-bold text-base text-ink">GSTR-1 Sales CSV</h3>
                <p className="text-xs text-ink-muted mt-1">
                  RFC-4180 standard compliant B2B & B2C tax invoice records with HSN codes & CGST/SGST splits.
                </p>
              </div>
              <button
                onClick={exportGSTR1CSV}
                className="jm-btn-primary w-full mt-4 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={14} /> Download GSTR-1 CSV
              </button>
            </div>

            {/* Tally Prime XML Export Card */}
            <div className="jm-card p-5 sm:p-6 flex flex-col justify-between ">
              <div>
                <div className="w-11 h-11 rounded-xl bg-warning-soft border border-warning-soft flex items-center justify-center text-ink mb-3">
                  <Code2 size={22} />
                </div>
                <h3 className="font-bold text-base text-ink">Tally Prime XML</h3>
                <p className="text-xs text-ink-muted mt-1">
                  1-Click import format for Tally ERP 9 / TallyPrime sales vouchers & customer ledgers.
                </p>
              </div>
              <button
                onClick={exportTallyXML}
                className="jm-btn-primary w-full mt-4 flex items-center justify-center gap-2 jm-btn-primary cursor-pointer"
              >
                <Download size={14} /> Download Tally XML
              </button>
            </div>

            {/* Expenses CSV Card */}
            <div className="jm-card p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-xl bg-surface border border-border flex items-center justify-center text-danger mb-3">
                  <Receipt size={22} />
                </div>
                <h3 className="font-bold text-base text-ink">Expenses Day-Book CSV</h3>
                <p className="text-xs text-ink-muted mt-1">
                  Grinding, freight, packaging and operational expenditures export in Excel/CSV format.
                </p>
              </div>
              <button
                onClick={exportExpensesCSV}
                className="jm-btn-primary w-full mt-4 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={14} /> Download Expenses CSV
              </button>
            </div>

            {/* JSON Snapshot Backup Card */}
            <div className="jm-card p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-xl bg-warning-soft border border-warning-soft flex items-center justify-center text-ink mb-3">
                  <Archive size={22} />
                </div>
                <h3 className="font-bold text-base text-ink">Complete JSON Backup</h3>
                <p className="text-xs text-ink-muted mt-1">
                  Full offline snapshot of all products, customer ledgers, sales bills, batches and inventory.
                </p>
              </div>
              <button
                onClick={exportFullJSONBackup}
                className="jm-btn-secondary w-full mt-4 flex items-center justify-center gap-2 bg-warning-soft border-warning-soft cursor-pointer"
              >
                <Download size={14} /> Save JSON Backup
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expense Modal */}
      <Modal
        id="expense-form"
        open={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="Log New Expense"
        size="md"
      >
        <form onSubmit={handleLogExpense} className="space-y-4 pt-4">
              <div>
                <label htmlFor="expCategory" className="block text-xs font-bold text-ink mb-1">Category *</label>
                <select id="expCategory"
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as any)}
                  className="jm-select"
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
                <label htmlFor="expAmount" className="block text-xs font-bold text-ink mb-1">Amount (₹) *</label>
                <input id="expAmount"
                  type="number"
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="jm-inputtext-danger"
                />
              </div>

              <div>
                <label htmlFor="expVendor" className="block text-xs font-bold text-ink mb-1">Vendor / Payee</label>
                <input id="expVendor"
                  type="text"
                  value={expVendor}
                  onChange={(e) => setExpVendor(e.target.value)}
                  placeholder="e.g. Kanhaiya Mill / Tempo Driver"
                  className="jm-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'UPI', 'Card'] as PaymentMethod[]).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setExpMode(m)}
                      className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                        expMode === m ? 'jm-btn-primary' : 'jm-btn-secondary'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="expNote" className="block text-xs font-bold text-ink mb-1">Description / Notes</label>
                <input id="expNote"
                  type="text"
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  placeholder="e.g. Grinding 120kg Moong Dal at Kanhaiya mill"
                  className="jm-input"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="jm-btn-secondary flex-1 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button type="submit" className="jm-btn-primary flex-1 cursor-pointer">
                  {t('save')}
                </button>
              </div>
            </form>
      </Modal>

      {/* Cash Drawer Lock Modal */}
      <Modal
        id="drawer-lock"
        open={isDrawerModalOpen}
        onClose={() => setIsDrawerModalOpen(false)}
        title="End-of-Day Cash Drawer Lock"
        description="Reconciliation & Safe Float Retention"
        size="md"
        footer={
          <div className="flex gap-3 w-full">
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
              className="jm-btn-primary flex-1 cursor-pointer shadow-md"
            >
              Confirm & Close Drawer
            </button>
          </div>
        }
      >
        <div className="space-y-4 pt-4">

            <div className="space-y-2 p-3 rounded-xl bg-surface border border-border text-xs">
              <div className="flex justify-between">
                <span>Total Counted Physical Cash:</span>
                <span className="font-bold text-sm text-ink">₹{countedCash.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>Expected System Cash:</span>
                <span className="font-bold">₹{expectedCashInDrawer.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-border">
                <span>Variance:</span>
                <span className={drawerVariance === 0 ? 'text-success' : 'text-danger'}>
                  {drawerVariance > 0 ? `+₹${drawerVariance}` : `₹${drawerVariance}`}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-warning-soft border border-warning-soft text-xs space-y-1">
              <div className="flex justify-between">
                <span className="font-bold text-ink">Next Day Opening Float:</span>
                <span className="font-bold">₹{Math.min(5000, countedCash)}</span>
              </div>
              <div className="flex justify-between text-success font-bold">
                <span>Bank Deposit Amount:</span>
                <span>₹{Math.max(0, countedCash - 5000)}</span>
              </div>
            </div>

            <div>
              <label htmlFor="drawerNotes" className="block text-xs font-bold text-ink mb-1">Closing Notes</label>
              <input id="drawerNotes"
                type="text"
                value={drawerNotes}
                onChange={(e) => setDrawerNotes(e.target.value)}
                placeholder="e.g. Daily shift closed smoothly, exact match."
                className="jm-input"
              />
            </div>
        </div>
      </Modal>

      {/* Set Morning Cash Float Modal */}
      <Modal
        id="morning-float"
        open={isFloatModalOpen}
        onClose={() => setIsFloatModalOpen(false)}
        title="Set Morning Cash Float"
        description="Counter opening physical cash"
        size="sm"
      >
        <form onSubmit={handleSaveOpeningFloat} className="space-y-4 pt-4">
              <div>
                <label htmlFor="floatAmount" className="block text-xs font-bold text-ink mb-1">Morning Opening Float (₹)</label>
                <input id="floatAmount"
                  type="number"
                  required
                  min="0"
                  autoFocus
                  value={newFloatAmount}
                  onChange={(e) => setNewFloatAmount(e.target.value)}
                  placeholder="e.g. 2000"
                  className="jm-inputtext-ink"
                />
              </div>

              <div className="flex gap-2">
                {[0, 1000, 2000, 3000, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setNewFloatAmount(String(amt))}
                    className="flex-1 py-1.5 rounded-lg border border-border bg-surface text-xs font-bold hover:bg-warning-soft"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsFloatModalOpen(false)}
                  className="jm-btn-secondary flex-1 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="jm-btn-primary flex-1 cursor-pointer shadow-md"
                >
                  Save Float
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
}
