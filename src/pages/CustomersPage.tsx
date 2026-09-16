import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  UserPlus,
  Share2,
  Phone,
  MapPin,
  Plus,
  ShoppingBag,
  Download,
  UploadCloud,
} from 'lucide-react';
import { useAppState, store } from '../lib/store';
import { t } from '../lib/i18n';
import { toRFC4180CSV, downloadFile, parseVCFText } from '../lib/csv';
import type { Customer, CustomerType, PaymentMethod } from '../types';

export default function CustomersPage() {
  const { customers, orders, customerPayments } = useAppState();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // New Customer Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustType, setNewCustType] = useState<CustomerType>('retail');
  const [newCustArea, setNewCustArea] = useState('');
  const [newCustGstin, setNewCustGstin] = useState('');
  const [newCustLimit, setNewCustLimit] = useState('5000');

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMethod>('Cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Selected customer details
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Combined ledger for selected customer (Orders + Payments)
  const customerLedger = useMemo(() => {
    if (!selectedCustomerId) return [];

    const custOrders = orders
      .filter((o) => o.customerId === selectedCustomerId && !o.isVoid && o.creditAddedInr > 0)
      .map((o) => ({
        id: o.id,
        date: o.date,
        type: 'DEBIT_PURCHASE' as const,
        description: `Bill #${o.billNo} (${o.items.length} items)`,
        amountInr: o.creditAddedInr,
        createdAt: o.createdAt,
      }));

    const custPayments = customerPayments
      .filter((p) => p.customerId === selectedCustomerId)
      .map((p) => ({
        id: p.id,
        date: p.date,
        type: 'CREDIT_PAYMENT' as const,
        description: `Payment Received (${p.paymentMethod}) ${p.referenceNo ? `· Ref: ${p.referenceNo}` : ''}`,
        amountInr: p.amountInr,
        createdAt: p.createdAt,
      }));

    const combined = [...custOrders, ...custPayments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return combined;
  }, [selectedCustomerId, orders, customerPayments]);

  const totalOutstandingAll = useMemo(() => {
    return customers.reduce((s, c) => s + c.totalOutstandingInr, 0);
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      const matchType =
        filterType === 'ALL' ||
        (filterType === 'RETAIL' && c.customerType === 'retail') ||
        (filterType === 'WHOLESALE' && c.customerType === 'wholesale') ||
        (filterType === 'OUTSTANDING' && c.totalOutstandingInr > 0);

      const matchSearch =
        q === '' ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.area && c.area.toLowerCase().includes(q));

      return matchType && matchSearch;
    });
  }, [customers, filterType, search]);

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = newCustPhone.replace(/[^\d]/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    const newCust = store.addCustomer({
      name: newCustName.trim(),
      phone: cleanPhone,
      customerType: newCustType,
      area: newCustArea.trim() || undefined,
      gstin: newCustGstin.trim() || undefined,
      creditLimitInr: Number(newCustLimit) || 5000,
    });

    setIsAddModalOpen(false);
    setSelectedCustomerId(newCust.id);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustArea('');
    setNewCustGstin('');
    setNewCustLimit('5000');
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    store.recordCustomerPayment({
      customerId: selectedCustomer.id,
      amountInr: amt,
      paymentMethod: paymentMode,
      referenceNo: paymentRef.trim() || undefined,
      notes: paymentNotes.trim() || undefined,
    });

    setIsPaymentModalOpen(false);
    setPaymentAmount('');
    setPaymentRef('');
    setPaymentNotes('');
  };

  const handleOpenBillForCustomer = (cust: Customer) => {
    store.setActiveCustomer(cust);
    navigate('/pos');
  };

  const generateKhataWhatsApp = (cust: Customer) => {
    const text = `*JOSHI MANGODI - KHATA ACCOUNT STATEMENT*%0A` +
      `Hello ${cust.name},%0A` +
      `Your current outstanding balance on Khata is: *₹${cust.totalOutstandingInr.toLocaleString('en-IN')}*.%0A` +
      `You may settle this via UPI or at our shop counter.%0A` +
      `UPI ID: *joshimangodi@sbi*%0A` +
      `Thank you!%0A` +
      `Fatehpur, Sikar · Pure Handmade Moong Dal Mangodi`;

    return `https://wa.me/91${cust.phone}?text=${text}`;
  };

  const exportCustomersCSV = () => {
    const headers = ['Name', 'Phone', 'Type', 'Area', 'GSTIN', 'Credit Limit (INR)', 'Outstanding (INR)', 'Total Orders', 'LTV (INR)', 'Created At'];
    const rows = customers.map((c) => [
      c.name,
      c.phone,
      c.customerType,
      c.area || '',
      c.gstin || '',
      c.creditLimitInr,
      c.totalOutstandingInr,
      c.totalOrdersCount,
      c.lifetimeValueInr,
      c.createdAt,
    ]);
    const csvContent = toRFC4180CSV(headers, rows);
    downloadFile(`joshi-mangodi-customers-${new Date().toISOString().split('T')[0]}.csv`, csvContent);
  };

  const handleVCFUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const parsed = parseVCFText(content);
        if (parsed.length > 0) {
          const imported = store.importCustomersBulk(parsed);
          alert(`${imported} new contacts imported successfully!`);
          setIsImportModalOpen(false);
        } else {
          alert('No valid contacts found in file.');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-[calc(100vh-120px)] pb-32 md:pb-12">
      {/* Top Stats Banner */}
      <div className="bg-white border-b border-[#FCE7F3] px-3 sm:px-4 py-3 sm:py-4">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#31102A]">
              Customer Khata Directory
            </h1>
            <p className="text-xs text-[#632055]">
              {customers.length} registered customers (Wholesale & Retail)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {/* Total Outstanding Card */}
            <div className="bg-[#FFF9FA] border border-[#FCE7F3] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl flex items-center gap-2 sm:gap-3 flex-1 sm:flex-none">
              <div>
                <div className="text-[10px] uppercase font-bold text-[#632055] tracking-wider">
                  Total Outstanding Khata
                </div>
                <div className="text-base sm:text-lg font-black text-[#9F1239]">
                  ₹{totalOutstandingAll.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Import Button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="jm-btn-secondary !text-xs !min-h-[38px] flex items-center gap-1.5"
            >
              <UploadCloud size={15} />
              <span className="hidden sm:inline">Import Contacts</span>
              <span className="sm:hidden">Import</span>
            </button>

            {/* Export Button */}
            <button
              onClick={exportCustomersCSV}
              className="jm-btn-secondary !text-xs !min-h-[38px] flex items-center gap-1.5"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </button>

            {/* Add New Customer Button */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="jm-btn-primary !text-xs !min-h-[38px] !font-extrabold flex items-center gap-1.5 shadow-sm"
            >
              <UserPlus size={15} />
              <span>+ Add Customer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="mx-auto max-w-7xl px-3 sm:px-6 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Customer List (7 cols) */}
          <div className="lg:col-span-7 space-y-3.5">
            {/* Filters and Search */}
            <div className="jm-card p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#632055]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or last 4 digits..."
                  className="jm-input !pl-9 !text-xs !min-h-[38px]"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'OUTSTANDING', label: 'Has Due' },
                  { id: 'WHOLESALE', label: 'Wholesale' },
                  { id: 'RETAIL', label: 'Retail' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterType(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      filterType === f.id
                        ? 'bg-[#31102A] text-white shadow-xs'
                        : 'bg-[#FFF9FA] text-[#632055] border border-[#FCE7F3] hover:bg-[#FEFCE8]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customers List Cards */}
            <div className="space-y-2.5">
              {filteredCustomers.length === 0 ? (
                <div className="jm-card p-12 text-center text-[#632055] bg-white">
                  <Users size={40} className="mx-auto mb-2 opacity-40" />
                  <p className="font-bold text-sm">No customers match criteria</p>
                </div>
              ) : (
                filteredCustomers.map((cust) => {
                  const isSelected = selectedCustomerId === cust.id;
                  const hasDue = cust.totalOutstandingInr > 0;

                  return (
                    <div
                      key={cust.id}
                      onClick={() => setSelectedCustomerId(cust.id)}
                      className={`jm-card p-3.5 sm:p-4 transition cursor-pointer hover:border-[#E5B6D3] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isSelected ? 'border-2 border-[#31102A] bg-[#FFF9FA]' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 ${
                            cust.customerType === 'wholesale'
                              ? 'bg-[#FEF08A] text-[#31102A] border border-[#FDE047]'
                              : 'bg-[#FBCFE8] text-[#31102A] border border-[#E5B6D3]'
                          }`}
                        >
                          {cust.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-xs sm:text-sm text-[#31102A] truncate">{cust.name}</h3>
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-md bg-[#FFF9FA] border border-[#FCE7F3] text-[#632055]">
                              {cust.customerType}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#632055] mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1 font-mono font-medium text-[11px]">
                              <Phone size={11} /> +91 {cust.phone}
                            </span>
                            {cust.area && (
                              <span className="flex items-center gap-1 text-[11px]">
                                <MapPin size={11} /> {cust.area}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Balance & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#FCE7F3]">
                        <div className="text-left sm:text-right">
                          <div className="text-[9px] text-gray-500 uppercase font-bold">Outstanding</div>
                          <div
                            className={`text-sm font-black ${
                              hasDue ? 'text-[#9F1239]' : 'text-emerald-700'
                            }`}
                          >
                            ₹{cust.totalOutstandingInr.toLocaleString('en-IN')}
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenBillForCustomer(cust);
                          }}
                          className="jm-btn-primary !min-h-[34px] !text-xs !py-1 !px-2.5 shrink-0 flex items-center gap-1"
                          title="Open Bill in POS"
                        >
                          <ShoppingBag size={13} />
                          <span>Open Bill</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Selected Customer Profile & Khata Ledger (5 cols) */}
          <div className="lg:col-span-5">
            {selectedCustomer ? (
              <div className="jm-card p-4 sm:p-5 sticky top-[135px] bg-white shadow-md">
                <div className="flex items-start justify-between border-b border-[#FCE7F3] pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black text-[#31102A]">{selectedCustomer.name}</h2>
                      <span className="text-[10px] uppercase font-bold bg-[#FEF08A] text-[#31102A] px-2 py-0.5 rounded-md">
                        {selectedCustomer.customerType}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-[#632055] mt-0.5">+91 {selectedCustomer.phone}</p>
                    {selectedCustomer.area && (
                      <p className="text-xs text-gray-600 mt-0.5">Area: {selectedCustomer.area}</p>
                    )}
                    {selectedCustomer.gstin && (
                      <p className="text-[11px] font-mono text-gray-500">GSTIN: {selectedCustomer.gstin}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 my-3.5">
                  <div className="p-3 rounded-xl bg-[#FFF9FA] border border-[#FCE7F3]">
                    <div className="text-[10px] uppercase font-bold text-[#632055]">Outstanding Due</div>
                    <div className="text-base sm:text-lg font-black text-[#9F1239]">
                      ₹{selectedCustomer.totalOutstandingInr.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#FEFCE8] border border-[#FDE047]">
                    <div className="text-[10px] uppercase font-bold text-[#632055]">Lifetime Value</div>
                    <div className="text-base sm:text-lg font-black text-[#31102A]">
                      ₹{selectedCustomer.lifetimeValueInr.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="jm-btn-primary flex-1 !text-xs !py-2.5 flex items-center justify-center gap-1.5"
                  >
                    <Plus size={15} />
                    <span>Record Payment</span>
                  </button>

                  {selectedCustomer.totalOutstandingInr > 0 && (
                    <a
                      href={generateKhataWhatsApp(selectedCustomer)}
                      target="_blank"
                      rel="noreferrer"
                      className="jm-btn-secondary !text-xs !py-2.5 flex items-center justify-center gap-1.5 text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                      title="Send WhatsApp Reminder"
                    >
                      <Share2 size={15} />
                      <span>Remind</span>
                    </a>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-extrabold uppercase text-[#632055] tracking-wider">
                      Khata Ledger History
                    </h3>
                    <span className="text-[10px] text-gray-500">{customerLedger.length} records</span>
                  </div>

                  <div className="max-h-[260px] overflow-y-auto divide-y divide-[#FCE7F3] pr-1">
                    {customerLedger.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#632055]">
                        No Khata transactions for this customer.
                      </div>
                    ) : (
                      customerLedger.map((item) => (
                        <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-[#31102A]">{item.description}</div>
                            <div className="text-[10px] text-gray-500">{item.date}</div>
                          </div>
                          <div className="text-right">
                            {item.type === 'DEBIT_PURCHASE' ? (
                              <div className="font-black text-red-700">+₹{item.amountInr} (Due)</div>
                            ) : (
                              <div className="font-black text-emerald-700">-₹{item.amountInr} (Paid)</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="jm-card p-10 text-center text-[#632055] bg-white">
                <Users size={36} className="mx-auto mb-2 opacity-40" />
                <p className="font-bold text-sm">Select a customer to view ledger</p>
                <p className="text-xs text-gray-500 mt-1">Click on any customer in the list on the left.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 border-2 border-[#FCE7F3] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-[#FCE7F3] pb-2">
              <h3 className="font-black text-base sm:text-lg text-[#31102A]">Add New Customer</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Customer / Business Name *</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar / Shyam Kirana"
                  className="jm-input !text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Mobile Number (10 digits) *</label>
                <input
                  type="tel"
                  required
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="9829012345"
                  className="jm-input !text-xs !font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Customer Category</label>
                <select
                  value={newCustType}
                  onChange={(e) => setNewCustType(e.target.value as CustomerType)}
                  className="jm-select !text-xs"
                >
                  <option value="retail">Retail Customer</option>
                  <option value="wholesale">Wholesale Dealer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Area / Market Location</label>
                <input
                  type="text"
                  value={newCustArea}
                  onChange={(e) => setNewCustArea(e.target.value)}
                  placeholder="e.g. Fatehpur Mandi / Sikar"
                  className="jm-input !text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Credit Limit (₹)</label>
                <input
                  type="number"
                  value={newCustLimit}
                  onChange={(e) => setNewCustLimit(e.target.value)}
                  className="jm-input !text-xs !font-bold"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="jm-btn-secondary flex-1"
                >
                  {t('cancel')}
                </button>
                <button type="submit" className="jm-btn-primary flex-1 !font-black">
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment (Jama) Modal */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 border-2 border-[#FCE7F3] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-[#FCE7F3] pb-2">
              <div>
                <h3 className="font-black text-base sm:text-lg text-[#31102A]">Record Khata Payment</h3>
                <p className="text-xs text-[#632055]">{selectedCustomer.name}</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex justify-between items-center">
                <span>Current Outstanding Due:</span>
                <span className="font-black text-sm">₹{selectedCustomer.totalOutstandingInr.toLocaleString('en-IN')}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Received Amount (₹) *</label>
                <input
                  type="number"
                  required
                  autoFocus
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="jm-input !text-lg !font-black text-[#047857]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'UPI', 'Card'] as PaymentMethod[]).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setPaymentMode(m)}
                      className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                        paymentMode === m ? 'bg-[#31102A] text-white' : 'bg-white text-[#632055] border-[#FCE7F3]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">UPI Reference / Cheque No.</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. UPI/12345678"
                  className="jm-input !text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="jm-btn-secondary flex-1"
                >
                  {t('cancel')}
                </button>
                <button type="submit" className="jm-btn-primary flex-1 !font-black bg-emerald-600 hover:bg-emerald-700 text-white !border-emerald-700">
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Contacts Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 border-2 border-[#FCE7F3] shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-[#FCE7F3] pb-2">
              <h3 className="font-black text-base sm:text-lg text-[#31102A]">Import Contacts (VCF / CSV)</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-[#632055]">
                Upload your phone contacts VCF file (e.g. Contacts.vcf) or CSV file. The system will automatically parse and deduplicate contacts.
              </p>

              <div className="p-6 rounded-2xl border-2 border-dashed border-[#E5B6D3] bg-[#FFF9FA] text-center">
                <UploadCloud size={32} className="mx-auto mb-2 text-[#9F1239]" />
                <label className="jm-btn-primary !cursor-pointer">
                  <span>Choose .vcf / .csv File</span>
                  <input
                    type="file"
                    accept=".vcf,.csv,text/vcard"
                    onChange={handleVCFUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
