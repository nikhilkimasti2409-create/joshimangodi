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
  FileText,
  Edit3,
  Eye,
  CheckCircle2,
  Receipt,
  CreditCard,
  Building2,
  TrendingUp,
  X,
  QrCode,
} from 'lucide-react';
import { useAppState, store } from '../lib/store';
import { t } from '../lib/i18n';
import { showToast } from '../components/common/Toast';
import { toRFC4180CSV, downloadFile, parseVCFText } from '../lib/csv';
import type { Customer, CustomerType, PaymentMethod, Order } from '../types';

export default function CustomersPage() {
  const { customers, orders, customerPayments } = useAppState();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Edit Customer Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editType, setEditType] = useState<CustomerType>('retail');
  const [editArea, setEditArea] = useState('');
  const [editGstin, setEditGstin] = useState('');
  const [editLimit, setEditLimit] = useState('5000');

  // Customer Details / Movements Modal State
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);

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

  // Active customer for details view (either modal customer or selected customer)
  const activeDetailsCust = useMemo(() => {
    if (detailsCustomer) {
      return customers.find((c) => c.id === detailsCustomer.id) || detailsCustomer;
    }
    return selectedCustomer;
  }, [detailsCustomer, selectedCustomer, customers]);

  // Combined ledger for selected customer (Orders + Payments)
  const getCustomerLedger = (cust: Customer | null) => {
    if (!cust) return [];

    const custOrders = orders
      .filter((o) => o.customerId === cust.id && !o.isVoid)
      .map((o) => ({
        id: o.id,
        date: o.date,
        type: 'ORDER' as const,
        description: `Bill #${o.billNo}`,
        billNo: o.billNo,
        itemsCount: o.items.length,
        items: o.items,
        subtotalInr: o.subtotalInr,
        grandTotalInr: o.grandTotalInr,
        amountPaidInr: o.amountPaidInr,
        creditAddedInr: o.creditAddedInr,
        paymentMethod: o.paymentMethod,
        amountInr: o.creditAddedInr > 0 ? o.creditAddedInr : o.grandTotalInr,
        createdAt: o.createdAt,
      }));

    const custPayments = customerPayments
      .filter((p) => p.customerId === cust.id)
      .map((p) => ({
        id: p.id,
        date: p.date,
        type: 'PAYMENT' as const,
        description: `Payment Received (${p.paymentMethod})`,
        billNo: undefined,
        itemsCount: 0,
        items: [],
        subtotalInr: 0,
        grandTotalInr: 0,
        amountPaidInr: p.amountInr,
        creditAddedInr: 0,
        paymentMethod: p.paymentMethod,
        referenceNo: p.referenceNo,
        notes: p.notes,
        amountInr: p.amountInr,
        createdAt: p.createdAt,
      }));

    return [...custOrders, ...custPayments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

  const selectedLedger = useMemo(() => getCustomerLedger(selectedCustomer), [selectedCustomer, orders, customerPayments]);
  const detailsLedger = useMemo(() => getCustomerLedger(activeDetailsCust), [activeDetailsCust, orders, customerPayments]);

  const totalOutstandingAll = useMemo(() => {
    return customers.reduce((s, c) => s + (Number(c.totalOutstandingInr) || 0), 0);
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

  const handleOpenEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setEditName(cust.name);
    setEditPhone(cust.phone);
    setEditType(cust.customerType);
    setEditArea(cust.area || '');
    setEditGstin(cust.gstin || '');
    setEditLimit(String(cust.creditLimitInr || 5000));
    setIsEditModalOpen(true);
  };

  const handleOpenDetailsModal = (cust: Customer) => {
    setDetailsCustomer(cust);
    setSelectedCustomerId(cust.id);
    setIsDetailsModalOpen(true);
  };

  const handleSaveCustomerEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    const cleanPhone = editPhone.replace(/[^\d]/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      showToast('Invalid Phone', 'Please enter a valid 10-digit mobile number.', 'warning');
      return;
    }

    store.updateCustomer(editingCustomer.id, {
      name: editName.trim(),
      phone: cleanPhone,
      customerType: editType,
      area: editArea.trim() || undefined,
      gstin: editGstin.trim() || undefined,
      creditLimitInr: Math.max(0, Number(editLimit) || 0),
    });

    showToast('Customer Updated', `${editName.trim()}'s profile updated successfully.`, 'success');
    setIsEditModalOpen(false);
  };

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = newCustPhone.replace(/[^\d]/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      showToast('Invalid Phone', 'Please enter a valid 10-digit mobile number.', 'warning');
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

    showToast('Customer Created', `${newCust.name} added to khata directory.`, 'success');
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
    const targetCust = activeDetailsCust || selectedCustomer;
    if (!targetCust) return;

    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      showToast('Invalid Amount', 'Please enter a valid payment amount.', 'warning');
      return;
    }

    store.recordCustomerPayment({
      customerId: targetCust.id,
      amountInr: amt,
      paymentMethod: paymentMode,
      referenceNo: paymentRef.trim() || undefined,
      notes: paymentNotes.trim() || undefined,
    });

    showToast('Payment Recorded', `₹${amt} credited to ${targetCust.name}'s account.`, 'success');
    setIsPaymentModalOpen(false);
    setPaymentAmount('');
    setPaymentRef('');
    setPaymentNotes('');
  };

  const handleOpenBillForCustomer = (cust: Customer) => {
    store.setActiveCustomer(cust);
    showToast('Customer Attached', `Switched active POS customer to ${cust.name}`, 'info', 1500);
    navigate('/pos');
  };

  const generateKhataWhatsApp = (cust: Customer) => {
    const upiPayLink = `upi://pay?pa=nikhilkimasti2409@okaxis&pn=Joshi%20Mangodi%20Udyog&am=${cust.totalOutstandingInr}&cu=INR`;

    const text = `*JOSHI MANGODI UDYOG - KHATA STATEMENT*%0A` +
      `--------------------------------%0A` +
      `Namaste *${cust.name}*,%0A` +
      `Your current pending balance on Khata is: *₹${cust.totalOutstandingInr.toLocaleString('en-IN')}*.%0A` +
      (cust.area ? `Area: ${cust.area}%0A` : '') +
      `--------------------------------%0A` +
      `👉 *Pay Online via UPI:*%0A` +
      `UPI ID: *nikhilkimasti2409@okaxis*%0A` +
      `Payment Link: ${encodeURIComponent(upiPayLink)}%0A` +
      `--------------------------------%0A` +
      `Or settle cash at our counter.%0A` +
      `Thank you!%0A` +
      `JOSHI MANGODI UDYOG · Fatehpur, Sikar (Raj.)`;

    return `https://wa.me/91${cust.phone}?text=${text}`;
  };

  const exportCustomersCSV = () => {
    if (customers.length === 0) {
      showToast('No Data', 'No customers to export.', 'warning');
      return;
    }
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
    showToast('CSV Exported', 'Customer directory exported successfully.', 'success');
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
          showToast('Import Complete', `${imported} new contacts imported successfully!`, 'success');
          setIsImportModalOpen(false);
        } else {
          showToast('No Contacts', 'No valid phone contacts found in file.', 'warning');
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
              Customer Khata Directory & Ledgers
            </h1>
            <p className="text-xs text-[#632055]">
              {customers.length} registered customers · Real-time order movements, payment receipts & editable contact profiles
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {/* Total Outstanding Card */}
            <div className="bg-[#FFF9FA] border border-[#FCE7F3] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl flex items-center gap-2 sm:gap-3 flex-1 sm:flex-none shadow-xs">
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
              className="jm-btn-secondary !text-xs !min-h-[38px] flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UploadCloud size={15} />
              <span className="hidden sm:inline">Import Contacts</span>
              <span className="sm:hidden">Import</span>
            </button>

            {/* Export Button */}
            <button
              onClick={exportCustomersCSV}
              className="jm-btn-secondary !text-xs !min-h-[38px] flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </button>

            {/* Add New Customer Button */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="jm-btn-primary !text-xs !min-h-[38px] !font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
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
            <div className="jm-card p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white shadow-xs">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#632055]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, phone or area..."
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
                  <p className="text-xs text-gray-500 mt-1">Try clearing search or add a new customer.</p>
                </div>
              ) : (
                filteredCustomers.map((cust) => {
                  const isSelected = selectedCustomerId === cust.id;
                  const hasDue = cust.totalOutstandingInr > 0;

                  return (
                    <div
                      key={cust.id}
                      onClick={() => setSelectedCustomerId(cust.id)}
                      className={`jm-card p-3.5 sm:p-4 transition cursor-pointer hover:border-[#E5B6D3] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
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

                      {/* Right: Balance & Action Buttons (Details, Edit, Open Bill) */}
                      <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#FCE7F3]">
                        <div className="text-left sm:text-right mr-1">
                          <div className="text-[9px] text-gray-500 uppercase font-bold">Outstanding</div>
                          <div
                            className={`text-sm font-black ${
                              hasDue ? 'text-[#9F1239]' : 'text-emerald-700'
                            }`}
                          >
                            ₹{cust.totalOutstandingInr.toLocaleString('en-IN')}
                          </div>
                        </div>

                        {/* Details / Movements Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetailsModal(cust);
                          }}
                          className="px-2.5 py-1.5 rounded-xl border border-[#FCE7F3] hover:bg-[#FEFCE8] text-[#31102A] font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                          title="View Movements & Statement"
                        >
                          <Eye size={13} className="text-[#9F1239]" />
                          <span>Details</span>
                        </button>

                        {/* Edit Customer Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(cust);
                          }}
                          className="px-2.5 py-1.5 rounded-xl border border-[#FCE7F3] hover:bg-[#FEF08A] text-[#31102A] font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                          title="Edit Name, Phone, Address"
                        >
                          <Edit3 size={13} className="text-[#632055]" />
                          <span>Edit</span>
                        </button>

                        {/* Open Bill in POS Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenBillForCustomer(cust);
                          }}
                          className="jm-btn-primary !min-h-[32px] !text-xs !py-1 !px-2.5 shrink-0 flex items-center gap-1 shadow-xs"
                          title="Open Bill in POS"
                        >
                          <ShoppingBag size={13} />
                          <span>Bill</span>
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
              <div className="jm-card p-4 sm:p-5 sticky top-[135px] bg-white shadow-md space-y-3.5">
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
                      <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                        <MapPin size={11} /> {selectedCustomer.area}
                      </p>
                    )}
                    {selectedCustomer.gstin && (
                      <p className="text-[11px] font-mono text-gray-500 mt-0.5">GSTIN: {selectedCustomer.gstin}</p>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenEditModal(selectedCustomer)}
                    className="p-2 rounded-xl border border-[#FCE7F3] hover:bg-[#FEFCE8] text-[#31102A] cursor-pointer"
                    title="Edit Customer Profile"
                  >
                    <Edit3 size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
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

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="jm-btn-primary flex-1 !text-xs !py-2.5 flex items-center justify-center gap-1.5"
                  >
                    <Plus size={15} />
                    <span>Record Payment</span>
                  </button>

                  <button
                    onClick={() => handleOpenDetailsModal(selectedCustomer)}
                    className="jm-btn-secondary flex-1 !text-xs !py-2.5 flex items-center justify-center gap-1.5"
                  >
                    <Eye size={15} />
                    <span>View Statement</span>
                  </button>

                  {selectedCustomer.totalOutstandingInr > 0 && (
                    <a
                      href={generateKhataWhatsApp(selectedCustomer)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-2xl border border-emerald-300 text-emerald-800 hover:bg-emerald-50 flex items-center justify-center"
                      title="Send WhatsApp Reminder"
                    >
                      <Share2 size={16} />
                    </a>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-extrabold uppercase text-[#632055] tracking-wider">
                      Recent Ledger Movements
                    </h3>
                    <span className="text-[10px] text-gray-500">{selectedLedger.length} records</span>
                  </div>

                  <div className="max-h-[260px] overflow-y-auto divide-y divide-[#FCE7F3] pr-1">
                    {selectedLedger.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#632055]">
                        No Khata transactions for this customer yet.
                      </div>
                    ) : (
                      selectedLedger.map((item) => (
                        <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-[#31102A]">{item.description}</div>
                            <div className="text-[10px] text-gray-500">{item.date} · {item.paymentMethod}</div>
                          </div>
                          <div className="text-right">
                            {item.type === 'ORDER' ? (
                              <div className="font-black text-red-700">
                                {item.creditAddedInr > 0 ? `+₹${item.creditAddedInr} (Due)` : `₹${item.grandTotalInr} (Paid)`}
                              </div>
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

      {/* Customer Full Movement & Statement Modal */}
      {isDetailsModalOpen && activeDetailsCust && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 border-2 border-[#FCE7F3] shadow-2xl max-h-[90vh] flex flex-col space-y-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#FCE7F3] pb-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-lg sm:text-xl text-[#31102A] truncate">
                    {activeDetailsCust.name}
                  </h2>
                  <span className="text-[10px] uppercase font-bold bg-[#FEF08A] text-[#31102A] px-2 py-0.5 rounded-md shrink-0">
                    {activeDetailsCust.customerType}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#632055] mt-1 flex-wrap font-mono">
                  <span>Phone: +91 {activeDetailsCust.phone}</span>
                  {activeDetailsCust.area && <span>Area: {activeDetailsCust.area}</span>}
                  {activeDetailsCust.gstin && <span>GSTIN: {activeDetailsCust.gstin}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    handleOpenEditModal(activeDetailsCust);
                  }}
                  className="p-2 rounded-xl border border-[#FCE7F3] hover:bg-[#FEFCE8] text-[#31102A] text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="Edit Customer"
                >
                  <Edit3 size={14} />
                  <span className="hidden sm:inline">Edit Details</span>
                </button>
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold hover:bg-gray-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div className="p-3 rounded-2xl bg-[#FFF9FA] border border-[#FCE7F3]">
                <div className="text-[10px] uppercase font-bold text-[#632055]">Current Outstanding</div>
                <div className="text-base sm:text-lg font-black text-[#9F1239] mt-0.5">
                  ₹{activeDetailsCust.totalOutstandingInr.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#FEFCE8] border border-[#FDE047]">
                <div className="text-[10px] uppercase font-bold text-[#632055]">Lifetime Purchases</div>
                <div className="text-base sm:text-lg font-black text-[#31102A] mt-0.5">
                  ₹{activeDetailsCust.lifetimeValueInr.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-[#FCE7F3]">
                <div className="text-[10px] uppercase font-bold text-[#632055]">Credit Limit</div>
                <div className="text-base sm:text-lg font-black text-gray-800 mt-0.5">
                  ₹{(activeDetailsCust.creditLimitInr || 5000).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#F0FDF4] border border-emerald-200">
                <div className="text-[10px] uppercase font-bold text-emerald-800">Total Bills</div>
                <div className="text-base sm:text-lg font-black text-emerald-950 mt-0.5">
                  {activeDetailsCust.totalOrdersCount} orders
                </div>
              </div>
            </div>

            {/* Movements / Chronological Statement */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-[#31102A] tracking-wider flex items-center gap-1.5">
                  <FileText size={15} className="text-[#9F1239]" />
                  <span>Full Transaction & Movement Statement:</span>
                </h3>
                <span className="text-xs text-gray-500 font-medium">{detailsLedger.length} total entries</span>
              </div>

              {detailsLedger.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#632055] bg-[#FFF9FA] rounded-2xl border border-dashed border-[#FCE7F3]">
                  No past orders or payments recorded for this customer.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {detailsLedger.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl border border-[#FCE7F3] bg-white shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-[#FCE7F3] pb-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                              item.type === 'ORDER'
                                ? 'bg-[#FBCFE8] text-[#31102A]'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {item.type === 'ORDER' ? 'Sales Bill' : 'Khata Payment'}
                          </span>
                          <span className="font-mono font-extrabold text-[#31102A]">{item.description}</span>
                        </div>
                        <span className="text-gray-500 font-mono text-[11px]">{item.date}</span>
                      </div>

                      {/* Items details if Order */}
                      {item.type === 'ORDER' && item.items && item.items.length > 0 && (
                        <div className="text-[11px] text-[#632055] space-y-1 bg-[#FFF9FA] p-2.5 rounded-xl border border-[#FCE7F3]">
                          <div className="font-bold text-[#31102A] mb-1">Purchased Products:</div>
                          {item.items.map((i, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>• {i.skuName} ({i.quantity} pcs)</span>
                              <span>₹{i.totalInr}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Payment note if Payment */}
                      {item.type === 'PAYMENT' && (item.referenceNo || item.notes) && (
                        <div className="text-[11px] text-gray-600 bg-emerald-50/50 p-2 rounded-xl">
                          {item.referenceNo && <div>Ref/Cheque: <strong>{item.referenceNo}</strong></div>}
                          {item.notes && <div>Notes: {item.notes}</div>}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-gray-500">
                          Mode: <strong>{item.paymentMethod}</strong>
                        </span>
                        <div>
                          {item.type === 'ORDER' ? (
                            item.creditAddedInr > 0 ? (
                              <span className="font-black text-red-700">+₹{item.creditAddedInr} (Khata Due)</span>
                            ) : (
                              <span className="font-black text-emerald-800">₹{item.grandTotalInr} (Paid in Full)</span>
                            )
                          ) : (
                            <span className="font-black text-emerald-700">-₹{item.amountInr} (Received)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="pt-3 border-t border-[#FCE7F3] flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsPaymentModalOpen(true);
                  }}
                  className="jm-btn-primary !text-xs !py-2.5 flex items-center gap-1.5"
                >
                  <Plus size={15} />
                  <span>Record Payment</span>
                </button>

                <button
                  onClick={() => {
                    handleOpenBillForCustomer(activeDetailsCust);
                    setIsDetailsModalOpen(false);
                  }}
                  className="jm-btn-secondary !text-xs !py-2.5 flex items-center gap-1.5"
                >
                  <ShoppingBag size={15} />
                  <span>Create Bill</span>
                </button>
              </div>

              {activeDetailsCust.totalOutstandingInr > 0 && (
                <a
                  href={generateKhataWhatsApp(activeDetailsCust)}
                  target="_blank"
                  rel="noreferrer"
                  className="jm-btn-secondary !text-xs !py-2.5 flex items-center gap-1.5 text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                >
                  <Share2 size={15} />
                  <span>WhatsApp Reminder</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal (Name, Phone, Address, GSTIN, Type) */}
      {isEditModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 border-2 border-[#FCE7F3] shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-[#FCE7F3] pb-2">
              <div>
                <h3 className="font-black text-base sm:text-lg text-[#31102A]">Edit Customer Details</h3>
                <p className="text-xs text-[#632055]">Update name, phone number, address & category</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomerEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Customer / Business Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar / Shyam Kirana"
                  className="jm-input !text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Mobile Number (10 digits) *</label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="9829012345"
                  className="jm-input !text-xs !font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Customer Category</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as CustomerType)}
                  className="jm-select !text-xs"
                >
                  <option value="retail">Retail Customer</option>
                  <option value="wholesale">Wholesale Dealer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Area / Address / Location</label>
                <input
                  type="text"
                  value={editArea}
                  onChange={(e) => setEditArea(e.target.value)}
                  placeholder="e.g. Fatehpur Mandi / Sikar Road"
                  className="jm-input !text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">GSTIN (Optional)</label>
                <input
                  type="text"
                  value={editGstin}
                  onChange={(e) => setEditGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 08AABFJ1234F1Z5"
                  className="jm-input !text-xs !font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Credit Limit (₹)</label>
                <input
                  type="number"
                  value={editLimit}
                  onChange={(e) => setEditLimit(e.target.value)}
                  className="jm-input !text-xs !font-bold"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="jm-btn-secondary flex-1 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button type="submit" className="jm-btn-primary flex-1 !font-black cursor-pointer shadow-md">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
      {isPaymentModalOpen && (activeDetailsCust || selectedCustomer) && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 border-2 border-[#FCE7F3] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-[#FCE7F3] pb-2">
              <div>
                <h3 className="font-black text-base sm:text-lg text-[#31102A]">Record Khata Payment</h3>
                <p className="text-xs text-[#632055]">{(activeDetailsCust || selectedCustomer)?.name}</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex justify-between items-center">
                <span>Current Outstanding Due:</span>
                <span className="font-black text-sm">
                  ₹{((activeDetailsCust || selectedCustomer)?.totalOutstandingInr || 0).toLocaleString('en-IN')}
                </span>
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

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Part payment settled at counter"
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
