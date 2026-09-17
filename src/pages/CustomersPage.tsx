import { useState, useMemo } from 'react';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';

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
      <div className="mx-auto max-w-7xl px-3 sm:px-6 pt-4 pb-0">
        <PageHeader
          title="Customer Khata Directory & Ledgers"
          description={`${customers.length} registered customers · Real-time order movements, payment receipts & editable contact profiles`}
          primaryAction={
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="jm-btn-primary flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <UserPlus size={15} />
              <span>+ Add Customer</span>
            </button>
          }
          secondaryActions={
            <>
              {/* Total Outstanding Card */}
              <div className="bg-card border border-border rounded-xl p-2 sm:p-3 flex items-center gap-4">
                <div>
                  <div className="text-[11px] uppercase font-bold text-ink-muted tracking-wider">
                    Total Outstanding Khata
                  </div>
                  <div className="text-sm font-bold text-danger font-mono">
                    ₹{totalOutstandingAll.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="jm-btn-secondary flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <UploadCloud size={15} />
                <span className="hidden sm:inline">Import Contacts</span>
                <span className="sm:hidden">Import</span>
              </button>
              <button
                onClick={exportCustomersCSV}
                className="jm-btn-secondary flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download size={15} />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">Export</span>
              </button>
            </>
          }
        />
      </div>

      {/* Main Content Layout */}
      <div className="mx-auto max-w-7xl px-3 sm:px-6 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Customer List (7 cols) */}
          <div className="lg:col-span-7 space-y-3.5">
            {/* Filters and Search */}
            <div className="jm-card p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white shadow-xs">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, phone or area..."
                  className="jm-input !pl-9 "
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${ filterType === f.id ? 'bg-primary text-white' : 'bg-card border-border text-ink-muted hover:bg-primary-soft hover:text-primary' }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customers List Cards */}
            <div className="space-y-2.5">
              {filteredCustomers.length === 0 ? (
                <EmptyState icon={Users} title="No customers match criteria" description="Try clearing search or add a new customer." />
              ) : (
                filteredCustomers.map((cust) => {
                  const isSelected = selectedCustomerId === cust.id;
                  const hasDue = cust.totalOutstandingInr > 0;

                  return (
                    <div
                      key={cust.id}
                      onClick={() => setSelectedCustomerId(cust.id)}
                      className={`bg-card border rounded-lg p-5 sm:p-6 transition cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${ isSelected ? 'border-primary bg-primary-soft' : 'bg-card border-border' }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-sm shrink-0 ${ cust.customerType === 'wholesale' ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary' }`}
                        >
                          {cust.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-xs sm:text-sm text-ink truncate">{cust.name}</h3>
                            <StatusBadge variant={cust.customerType === "wholesale" ? "warning" : "info"} label={cust.customerType} />
                          </div>
                          <div className="flex items-center gap-3 text-sm text-ink-muted mt-0.5 flex-wrap">
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
                      <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                        <div className="text-left sm:text-right mr-1">
                          <div className="text-[11px] text-ink-muted uppercase font-bold">Outstanding</div>
                          <div
                            className={`text-sm font-bold font-mono ${ hasDue ? 'text-danger' : 'text-success' }`}
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
                          className="px-2.5 py-1.5 rounded-xl border border-border hover:bg-warning-soft text-ink font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                          title="View Movements & Statement"
                        >
                          <Eye size={13} className="text-danger" />
                          <span>Details</span>
                        </button>

                        {/* Edit Customer Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(cust);
                          }}
                          className="px-2.5 py-1.5 rounded-xl border border-border hover:bg-warning-soft text-ink font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                          title="Edit Name, Phone, Address"
                        >
                          <Edit3 size={13} className="text-ink-muted" />
                          <span>Edit</span>
                        </button>

                        {/* Open Bill in POS Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenBillForCustomer(cust);
                          }}
                          className="jm-btn-primary shrink-0 flex items-center gap-1 shadow-xs"
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
              <div className="jm-card p-6 sticky top-[135px] space-y-4">
                <div className="flex items-start justify-between border-b border-border pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-ink">{selectedCustomer.name}</h2>
                      <span className="text-[11px] uppercase font-bold bg-warning-soft text-warning px-2 py-0.5 rounded-md">
                        {selectedCustomer.customerType}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-ink-muted mt-0.5">+91 {selectedCustomer.phone}</p>
                    {selectedCustomer.area && (
                      <p className="text-xs text-ink-muted mt-0.5 flex items-center gap-1">
                        <MapPin size={11} /> {selectedCustomer.area}
                      </p>
                    )}
                    {selectedCustomer.gstin && (
                      <p className="text-[11px] font-mono text-ink-muted mt-0.5">GSTIN: {selectedCustomer.gstin}</p>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenEditModal(selectedCustomer)}
                    className="p-2 rounded-xl border border-border hover:bg-warning-soft text-ink cursor-pointer"
                    title="Edit Customer Profile"
                  >
                    <Edit3 size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-surface border border-border">
                    <div className="text-[11px] uppercase font-bold text-ink-muted">Outstanding Due</div>
                    <div className="text-base sm:text-lg font-bold text-danger font-mono">
                      ₹{selectedCustomer.totalOutstandingInr.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-warning-soft border border-warning-soft">
                    <div className="text-[11px] uppercase font-bold text-ink-muted">Lifetime Value</div>
                    <div className="text-base sm:text-lg font-bold text-ink">
                      ₹{selectedCustomer.lifetimeValueInr.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="jm-btn-primary flex-1 flex items-center justify-center gap-1.5"
                  >
                    <Plus size={15} />
                    <span>Record Payment</span>
                  </button>

                  <button
                    onClick={() => handleOpenDetailsModal(selectedCustomer)}
                    className="jm-btn-secondary flex-1 flex items-center justify-center gap-1.5"
                  >
                    <Eye size={15} />
                    <span>View Statement</span>
                  </button>

                  {selectedCustomer.totalOutstandingInr > 0 && (
                    <a
                      href={generateKhataWhatsApp(selectedCustomer)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-xl border border-success-soft text-success hover:bg-success-soft flex items-center justify-center"
                      title="Send WhatsApp Reminder" aria-label="Send WhatsApp Reminder"
                    >
                      <Share2 size={16} />
                    </a>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold uppercase text-ink-muted tracking-wider">
                      Recent Ledger Movements
                    </h3>
                    <span className="text-[11px] text-ink-muted">{selectedLedger.length} records</span>
                  </div>

                  <div className="max-h-[260px] overflow-y-auto divide-y divide-border pr-1">
                    {selectedLedger.length === 0 ? (
                      <div className="py-8 text-center text-sm text-ink-muted">
                        No Khata transactions for this customer yet.
                      </div>
                    ) : (
                      selectedLedger.map((item) => (
                        <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-ink">{item.description}</div>
                            <div className="text-[11px] text-ink-muted">{item.date} · {item.paymentMethod}</div>
                          </div>
                          <div className="text-right">
                            {item.type === 'ORDER' ? (
                              <div className={`font-bold ${item.creditAddedInr > 0 ? 'text-danger' : 'text-success'}`}>
                                {item.creditAddedInr > 0 ? `+₹${item.creditAddedInr} (Due)` : `₹${item.grandTotalInr} (Paid)`}
                              </div>
                            ) : (
                              <div className="font-bold text-success">-₹{item.amountInr} (Paid)</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="jm-card p-10 text-center text-ink-muted bg-white">
                <Users size={36} className="mx-auto mb-2 opacity-40" />
                <p className="font-bold text-sm">Select a customer to view ledger</p>
                <p className="text-xs text-ink-muted mt-1">Click on any customer in the list on the left.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer Full Movement & Statement Modal */}
      <Modal
        id="customer-statement"
        open={isDetailsModalOpen && Boolean(activeDetailsCust)}
        onClose={() => setIsDetailsModalOpen(false)}
        title={activeDetailsCust?.name || ''}
        size="2xl"
        footer={
          activeDetailsCust && (
            <div className="flex flex-wrap items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="jm-btn-primary flex items-center gap-1.5"
                >
                  <Plus size={15} />
                  <span>Record Payment</span>
                </button>

                <button
                  onClick={() => {
                    if(activeDetailsCust) handleOpenBillForCustomer(activeDetailsCust);
                    setIsDetailsModalOpen(false);
                  }}
                  className="jm-btn-secondary flex items-center gap-1.5"
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
                  className="jm-btn-secondary flex items-center gap-1.5 text-success border-success-soft hover:bg-success-soft"
                >
                  <Share2 size={15} />
                  <span>WhatsApp Reminder</span>
                </a>
              )}
            </div>
          )
        }
      >
        {activeDetailsCust && (
          <div className="flex flex-col space-y-4 pt-1">
            {/* Custom Info Row */}
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <StatusBadge variant={activeDetailsCust.customerType === "wholesale" ? "warning" : "info"} label={activeDetailsCust.customerType} />
                <div className="flex items-center gap-3 text-sm text-ink-muted mt-2 flex-wrap font-mono">
                  <span>Phone: +91 {activeDetailsCust.phone}</span>
                  {activeDetailsCust.area && <span>Area: {activeDetailsCust.area}</span>}
                  {activeDetailsCust.gstin && <span>GSTIN: {activeDetailsCust.gstin}</span>}
                </div>
              </div>
              <button
                onClick={() => handleOpenEditModal(activeDetailsCust)}
                className="p-2 rounded-xl border border-border hover:bg-warning-soft text-ink text-xs font-bold flex items-center gap-1 cursor-pointer"
                title="Edit Customer"
              >
                <Edit3 size={14} />
                <span className="hidden sm:inline">Edit Details</span>
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0 pt-2">
              <div className="p-3 rounded-xl bg-surface border border-border">
                <div className="text-[11px] uppercase font-bold text-ink-muted">Current Outstanding</div>
                <div className="text-base sm:text-lg font-bold text-danger font-mono mt-0.5">
                  ₹{activeDetailsCust.totalOutstandingInr.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-warning-soft border border-warning-soft">
                <div className="text-[11px] uppercase font-bold text-ink-muted">Lifetime Purchases</div>
                <div className="text-base sm:text-lg font-bold font-mono text-ink mt-0.5">
                  ₹{activeDetailsCust.lifetimeValueInr.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-card border border-border">
                <div className="text-[11px] uppercase font-bold text-ink-muted">Credit Limit</div>
                <div className="text-base sm:text-lg font-bold text-ink mt-0.5">
                  ₹{(activeDetailsCust.creditLimitInr || 5000).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-success-soft border border-success-soft">
                <div className="text-[11px] uppercase font-bold text-success">Total Bills</div>
                <div className="text-base sm:text-lg font-bold text-success mt-0.5">
                  {activeDetailsCust.totalOrdersCount} orders
                </div>
              </div>
            </div>

            {/* Movements / Chronological Statement */}
            <div className="pt-2">
              <div className="flex items-center justify-between pb-3">
                <h3 className="text-xs font-bold uppercase text-ink tracking-wider flex items-center gap-1.5">
                  <FileText size={15} className="text-danger" />
                  <span>Full Transaction & Movement Statement:</span>
                </h3>
                <span className="text-xs text-ink-muted font-medium">{detailsLedger.length} total entries</span>
              </div>

              {detailsLedger.length === 0 ? (
                <EmptyState icon={FileText} title="No statements" description="No past orders or payments recorded for this customer." />
              ) : (
                <div className="space-y-2.5">
                  {detailsLedger.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-border bg-card shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold uppercase ${ item.type === 'ORDER' ? 'bg-primary-soft text-ink' : 'bg-success-soft text-success' }`}
                          >
                            {item.type === 'ORDER' ? 'Sales Bill' : 'Khata Payment'}
                          </span>
                          <span className="font-mono font-semibold text-ink">{item.description}</span>
                        </div>
                        <span className="text-ink-muted font-mono text-[11px]">{item.date}</span>
                      </div>

                      {/* Items details if Order */}
                      {item.type === 'ORDER' && item.items && item.items.length > 0 && (
                        <div className="text-[11px] text-ink-muted space-y-1 bg-surface p-2.5 rounded-xl border border-border">
                          <div className="font-bold text-ink mb-1">Purchased Products:</div>
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
                        <div className="text-[11px] text-ink-muted bg-success-soft/50 p-2 rounded-xl">
                          {item.referenceNo && <div>Ref/Cheque: <strong>{item.referenceNo}</strong></div>}
                          {item.notes && <div>Notes: {item.notes}</div>}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-ink-muted">
                          Mode: <strong>{item.paymentMethod}</strong>
                        </span>
                        <div>
                          {item.type === 'ORDER' ? (
                            item.creditAddedInr > 0 ? (
                              <span className="font-bold text-danger">+₹{item.creditAddedInr} (Khata Due)</span>
                            ) : (
                              <span className="font-bold text-success">₹{item.grandTotalInr} (Paid in Full)</span>
                            )
                          ) : (
                            <span className="font-bold text-success">-₹{item.amountInr} (Received)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Customer Modal */}
      <Modal
        id="edit-customer"
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Customer Details"
        description="Update name, phone number, address & category"
      >
        {editingCustomer && (
          <form onSubmit={handleSaveCustomerEdit} className="space-y-3.5 pt-2">
            <div>
              <label htmlFor="editName" className="block text-xs font-bold text-ink mb-1">Customer / Business Name *</label>
              <input id="editName" type="text" required value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Ramesh Kumar / Shyam Kirana"
                className="jm-input"
              />
            </div>

            <div>
              <label htmlFor="editPhone" className="block text-xs font-bold text-ink mb-1">Mobile Number (10 digits) *</label>
              <input id="editPhone" type="tel" required value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="9829012345"
                className="jm-input !font-mono"
              />
            </div>

            <div>
              <label htmlFor="editType" className="block text-xs font-bold text-ink mb-1">Customer Category</label>
              <select id="editType" value={editType}
                onChange={(e) => setEditType(e.target.value as 'retail' | 'wholesale')}
                className="jm-select"
              >
                <option value="retail">Retail Customer</option>
                <option value="wholesale">Wholesale Dealer</option>
              </select>
            </div>

            <div>
              <label htmlFor="editArea" className="block text-xs font-bold text-ink mb-1">Area / Address / Location</label>
              <input id="editArea" type="text" value={editArea}
                onChange={(e) => setEditArea(e.target.value)}
                placeholder="e.g. Fatehpur Mandi / Sikar Road"
                className="jm-input"
              />
            </div>

            <div>
              <label htmlFor="editGstin" className="block text-xs font-bold text-ink mb-1">GSTIN (Optional)</label>
              <input id="editGstin" type="text" value={editGstin}
                onChange={(e) => setEditGstin(e.target.value.toUpperCase())}
                placeholder="e.g. 08AABFJ1234F1Z5"
                className="jm-input !font-mono"
              />
            </div>

            <div>
              <label htmlFor="editLimit" className="block text-xs font-bold text-ink mb-1">Credit Limit (₹)</label>
              <input id="editLimit" type="number" value={editLimit}
                onChange={(e) => setEditLimit(e.target.value)}
                className="jm-input"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="jm-btn-secondary flex-1 cursor-pointer"
              >
                Cancel
              </button>
              <button type="submit" className="jm-btn-primary flex-1 cursor-pointer shadow-md">
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Customer Modal */}
      <Modal
        id="add-customer"
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Customer"
      >
        <form onSubmit={handleAddCustomer} className="space-y-3.5 pt-2">
          <div>
            <label htmlFor="newCustName" className="block text-xs font-bold text-ink mb-1">Customer / Business Name *</label>
            <input id="newCustName" type="text" required value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              placeholder="e.g. Ramesh Kumar / Shyam Kirana"
              className="jm-input"
            />
          </div>

          <div>
            <label htmlFor="newCustPhone" className="block text-xs font-bold text-ink mb-1">Mobile Number (10 digits) *</label>
            <input id="newCustPhone" type="tel" required value={newCustPhone}
              onChange={(e) => setNewCustPhone(e.target.value)}
              placeholder="9829012345"
              className="jm-input !font-mono"
            />
          </div>

          <div>
            <label htmlFor="newCustType" className="block text-xs font-bold text-ink mb-1">Customer Category</label>
            <select id="newCustType" value={newCustType}
              onChange={(e) => setNewCustType(e.target.value as 'retail' | 'wholesale')}
              className="jm-select"
            >
              <option value="retail">Retail Customer</option>
              <option value="wholesale">Wholesale Dealer</option>
            </select>
          </div>

          <div>
            <label htmlFor="newCustArea" className="block text-xs font-bold text-ink mb-1">Area / Market Location</label>
            <input id="newCustArea" type="text" value={newCustArea}
              onChange={(e) => setNewCustArea(e.target.value)}
              placeholder="e.g. Fatehpur Mandi / Sikar"
              className="jm-input"
            />
          </div>

          <div>
            <label htmlFor="newCustLimit" className="block text-xs font-bold text-ink mb-1">Credit Limit (₹)</label>
            <input id="newCustLimit" type="number" value={newCustLimit}
              onChange={(e) => setNewCustLimit(e.target.value)}
              className="jm-input"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="jm-btn-secondary flex-1 cursor-pointer"
            >
              Cancel
            </button>
            <button type="submit" className="jm-btn-primary flex-1 cursor-pointer shadow-md">
              Save Customer
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Payment (Jama) Modal */}
      <Modal
        id="record-payment"
        open={isPaymentModalOpen && Boolean(activeDetailsCust || selectedCustomer)}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Khata Payment"
        description={(activeDetailsCust || selectedCustomer)?.name || ''}
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
          <div className="p-3 rounded-xl bg-danger-soft border border-danger-soft text-xs text-danger flex justify-between items-center">
            <span>Current Outstanding Due:</span>
            <span className="font-bold text-sm">
              ₹{((activeDetailsCust || selectedCustomer)?.totalOutstandingInr || 0).toLocaleString('en-IN')}
            </span>
          </div>

          <div>
            <label htmlFor="paymentAmount" className="block text-xs font-bold text-ink mb-1">Received Amount (₹) *</label>
            <input id="paymentAmount" type="number" required autoFocus value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="e.g. 5000"
              className="jm-input text-success"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Payment Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Cash', 'UPI', 'Card'] as PaymentMethod[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  aria-pressed={paymentMode === m}
                  onClick={() => setPaymentMode(m)}
                  className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${ paymentMode === m ? 'bg-ink text-white' : 'bg-card text-ink-muted border-border' }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="paymentRef" className="block text-xs font-bold text-ink mb-1">UPI Reference / Cheque No.</label>
            <input id="paymentRef" type="text" value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="e.g. UPI/12345678"
              className="jm-input"
            />
          </div>

          <div>
            <label htmlFor="paymentNotes" className="block text-xs font-bold text-ink mb-1">Notes (Optional)</label>
            <input id="paymentNotes" type="text" value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="e.g. Part payment settled at counter"
              className="jm-input"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="jm-btn-secondary flex-1"
            >
              Cancel
            </button>
            <button type="submit" className="jm-btn-primary flex-1 bg-success hover:bg-success/90 text-white">
              Confirm Payment
            </button>
          </div>
        </form>
      </Modal>

      {/* Import Contacts Modal */}
      <Modal
        id="import-contacts"
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Contacts (VCF / CSV)"
      >
        <div className="space-y-4 text-xs pt-2">
          <p className="text-ink-muted">
            Upload your phone contacts VCF file (e.g. Contacts.vcf) or CSV file. The system will automatically parse and deduplicate contacts.
          </p>

          <div className="p-6 rounded-xl border-2 border-dashed border-border bg-surface text-center">
            <UploadCloud size={32} className="mx-auto mb-2 text-danger" />
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
      </Modal>
    </div>
  );
}
