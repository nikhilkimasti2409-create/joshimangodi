import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  Trash2,
  Receipt,
  Printer,
  Share2,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  UserPlus,
  ShoppingBag,
  Clock,
  ChevronUp,
  Tag,
  QrCode,
  X,
  AlertTriangle,
  XCircle,
  Coins,
  Banknote,
  Sparkles,
  RotateCcw,
  Truck,
} from 'lucide-react';
import { useAppState, store } from '../lib/store';
import { t } from '../lib/i18n';
import { showToast } from '../components/common/Toast';
import { playTapSound, playSuccessSound, playErrorSound, speakEnglish } from '../lib/audio';
import { round2 } from '../lib/domain/precision';
import type { ProductSKU, Order, PaymentMethod, CashDenominations, Customer } from '../types';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';
import WholesalerModal from '../components/pos/WholesalerModal';

export const CASH_DENOM_CONFIG = [
  { key: 'n500', val: 500, label: '₹500 Notes', shortLabel: '₹500', type: 'note' as const },
  { key: 'n200', val: 200, label: '₹200 Notes', shortLabel: '₹200', type: 'note' as const },
  { key: 'n100', val: 100, label: '₹100 Notes', shortLabel: '₹100', type: 'note' as const },
  { key: 'n50', val: 50, label: '₹50 Notes', shortLabel: '₹50', type: 'note' as const },
  { key: 'n20', val: 20, label: '₹20 Notes', shortLabel: '₹20', type: 'note' as const },
  { key: 'n10', val: 10, label: '₹10 Notes/Coins', shortLabel: '₹10', type: 'note' as const },
  { key: 'n5', val: 5, label: '₹5 Coins', shortLabel: '₹5', type: 'coin' as const },
  { key: 'n2', val: 2, label: '₹2 Coins', shortLabel: '₹2', type: 'coin' as const },
  { key: 'n1', val: 1, label: '₹1 Coins', shortLabel: '₹1', type: 'coin' as const },
] as const;

export type DenomKey = typeof CASH_DENOM_CONFIG[number]['key'];

export const formatDenominationBreakdown = (d?: CashDenominations) => {
  if (!d) return null;
  const parts: string[] = [];
  if (d.n500) parts.push(`${d.n500}x ₹500`);
  if (d.n200) parts.push(`${d.n200}x ₹200`);
  if (d.n100) parts.push(`${d.n100}x ₹100`);
  if (d.n50) parts.push(`${d.n50}x ₹50`);
  if (d.n20) parts.push(`${d.n20}x ₹20`);
  if (d.n10) parts.push(`${d.n10}x ₹10`);
  if (d.n5) parts.push(`${d.n5}x ₹5`);
  if (d.n2) parts.push(`${d.n2}x ₹2`);
  if (d.n1) parts.push(`${d.n1}x ₹1`);
  if (!parts.length && d.coins) parts.push(`₹${d.coins} in Coins`);
  return parts.join(', ');
};

export default function POSPage() {
  const { products, cart, activeChannel, activeCustomer, orders, customers } = useAppState();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMethod>('Cash');
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [orderNotes, setOrderNotes] = useState('');
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [viewHistory, setViewHistory] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [mobileCartDrawerOpen, setMobileCartDrawerOpen] = useState(false);
  const [voidModalOrder, setVoidModalOrder] = useState<Order | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [useManualCashInput, setUseManualCashInput] = useState(false);

  // Customer search in customer picker modal
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Wholesaler Order modal
  const [isWholesalerModalOpen, setIsWholesalerModalOpen] = useState(false);

  // Save Contact from completed bill modal (for walk-in customers becoming regular)
  const [isSaveContactOpen, setIsSaveContactOpen] = useState(false);
  const [saveContactName, setSaveContactName] = useState('');
  const [saveContactPhone, setSaveContactPhone] = useState('');
  const [saveContactArea, setSaveContactArea] = useState('');
  const [savedContactCustomer, setSavedContactCustomer] = useState<Customer | null>(null);

  // Listen to open-wholesaler-modal event from Navbar or anywhere in app
  useEffect(() => {
    const handleOpenWholesaler = () => setIsWholesalerModalOpen(true);
    window.addEventListener('open-wholesaler-modal', handleOpenWholesaler);
    return () => window.removeEventListener('open-wholesaler-modal', handleOpenWholesaler);
  }, []);

  // Customer sorting algorithm matching user specification:
  // "lists the person who has made the most purchases at the very top.
  // For those who haven't made any purchases, arrange their names in alphabetical order—listing them after the buyers"
  const processedCustomers = useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase();

    // 1. Filter by search query if provided
    const filtered = customers.filter((c) => {
      if (!q) return true;
      const matchName = c.name.toLowerCase().includes(q);
      const cleanPhone = c.phone ? c.phone.replace(/[^\d]/g, '') : '';
      const cleanQ = q.replace(/[^\d]/g, '');
      const matchPhone = (cleanQ && cleanPhone.includes(cleanQ)) || (c.phone && c.phone.toLowerCase().includes(q));
      const matchArea = c.area ? c.area.toLowerCase().includes(q) : false;
      const matchAddress = c.address ? c.address.toLowerCase().includes(q) : false;
      return matchName || matchPhone || matchArea || matchAddress;
    });

    // 2. Sort: Buyers first (by most purchases descending), then Non-buyers (alphabetically by name)
    return filtered.sort((a, b) => {
      const aPurchases = Number(a.totalOrdersCount) || 0;
      const bPurchases = Number(b.totalOrdersCount) || 0;
      const aLtv = Number(a.lifetimeValueInr) || 0;
      const bLtv = Number(b.lifetimeValueInr) || 0;

      const aHasPurchases = aPurchases > 0 || aLtv > 0;
      const bHasPurchases = bPurchases > 0 || bLtv > 0;

      // Rule 1: Buyers are listed BEFORE non-buyers
      if (aHasPurchases && !bHasPurchases) return -1;
      if (!aHasPurchases && bHasPurchases) return 1;

      // Rule 2: Among buyers, the person who has made the most purchases is at the very top
      if (aHasPurchases && bHasPurchases) {
        if (bPurchases !== aPurchases) {
          return bPurchases - aPurchases; // descending by number of purchases
        }
        if (bLtv !== aLtv) {
          return bLtv - aLtv; // tie-breaker: descending by total spend
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }

      // Rule 3: For those who haven't made any purchases, arrange their names in alphabetical order
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [customers, customerSearchQuery]);

  // Handler to save walk-in customer details directly from bill receipt
  const handleSaveWalkInContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveContactName.trim() || !saveContactPhone.trim()) {
      showToast('Customer name and phone number are required.', 'error');
      return;
    }
    if (!completedOrder) return;

    // Create regular customer with this completed order's purchase data
    const newCust = store.addCustomer({
      name: saveContactName.trim(),
      phone: saveContactPhone.trim(),
      area: saveContactArea.trim() || 'Counter Retail',
      address: saveContactArea.trim() || undefined,
      customerType: 'retail',
      creditLimitInr: 5000,
    });

    // Seed customer purchase statistics
    newCust.totalOrdersCount = 1;
    newCust.lifetimeValueInr = completedOrder.grandTotalInr;
    newCust.lastOrderDate = completedOrder.date;

    // Update order in store to link customer
    store.updateOrder(completedOrder.id, {
      customerId: newCust.id,
      customerName: newCust.name,
      customerPhone: newCust.phone,
    });

    // Update local state
    setCompletedOrder({
      ...completedOrder,
      customerId: newCust.id,
      customerName: newCust.name,
      customerPhone: newCust.phone,
    });
    setSavedContactCustomer(newCust);
    setIsSaveContactOpen(false);

    showToast(`Customer "${newCust.name}" saved as regular customer!`, 'success');
  };

  // Denominations State for cash payments
  const [cashDenoms, setCashDenoms] = useState<Record<DenomKey, number>>({
    n500: 0,
    n200: 0,
    n100: 0,
    n50: 0,
    n20: 0,
    n10: 0,
    n5: 0,
    n2: 0,
    n1: 0,
  });

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchSearch =
        search === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode.includes(search);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, search]);

  // Low stock products alert calculation
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.currentStockUnits <= p.reorderPointUnits);
  }, [products]);

  // Cart calculations with bulletproof numeric price evaluation
  const cartSubtotal = useMemo(() => {
    return cart.reduce((s, i) => {
      const unitP = Number(i.unitPriceInr) > 0
        ? Number(i.unitPriceInr)
        : (Number(i.sku?.retailPriceInr) || Number(i.sku?.mrpInr) || 0);
      const lineTotal = Number(i.totalInr) > 0
        ? Number(i.totalInr)
        : unitP * (Number(i.quantity) || 1);
      return s + (Number(lineTotal) || 0);
    }, 0);
  }, [cart]);

  const discountNum = Math.max(0, Number(discountAmount) || 0);
  const grandTotal = Math.max(0, cartSubtotal - discountNum);

  // Total cash calculated from denomination entries
  const cashDenomTotal = useMemo(() => {
    return CASH_DENOM_CONFIG.reduce((sum, d) => sum + (cashDenoms[d.key] || 0) * d.val, 0);
  }, [cashDenoms]);

  const handleUpdateDenom = (key: DenomKey, delta: number) => {
    const nextCount = Math.max(0, (cashDenoms[key] || 0) + delta);
    const updated = { ...cashDenoms, [key]: nextCount };
    setCashDenoms(updated);
    const newTotal = CASH_DENOM_CONFIG.reduce((sum, d) => sum + (updated[d.key] || 0) * d.val, 0);
    setReceivedAmount(newTotal > 0 ? String(newTotal) : '');
  };

  const handleSetDenom = (key: DenomKey, count: number) => {
    const updated = { ...cashDenoms, [key]: Math.max(0, count) };
    setCashDenoms(updated);
    const newTotal = CASH_DENOM_CONFIG.reduce((sum, d) => sum + (updated[d.key] || 0) * d.val, 0);
    setReceivedAmount(newTotal > 0 ? String(newTotal) : '');
  };

  const handleAutoFillExactDenominations = (targetAmount: number) => {
    const roundedTarget = Math.ceil(Math.max(0, targetAmount));
    let remaining = roundedTarget;
    const next: Record<DenomKey, number> = {
      n500: 0,
      n200: 0,
      n100: 0,
      n50: 0,
      n20: 0,
      n10: 0,
      n5: 0,
      n2: 0,
      n1: 0,
    };
    for (const d of CASH_DENOM_CONFIG) {
      if (remaining >= d.val) {
        const count = Math.floor(remaining / d.val);
        next[d.key] = count;
        remaining = remaining % d.val;
      }
    }
    setCashDenoms(next);
    setReceivedAmount(String(roundedTarget));
  };

  const handleResetDenominations = () => {
    setCashDenoms({
      n500: 0,
      n200: 0,
      n100: 0,
      n50: 0,
      n20: 0,
      n10: 0,
      n5: 0,
      n2: 0,
      n1: 0,
    });
    setReceivedAmount('');
  };

  const handleAddToCart = (product: ProductSKU) => {
    playTapSound();
    store.addToCart(product, 1);
    showToast('Item Added', `${product.name} added to cart`, 'info', 1200);
  };

  const handleUpdateQty = (skuId: string, qty: number) => {
    playTapSound();
    store.updateCartQty(skuId, qty);
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    store.clearCart();
    showToast('Cart Cleared', 'All items removed from cart', 'info');
  };

  const openCheckout = () => {
    if (cart.length === 0) {
      showToast('Empty Cart', 'Add at least one product to create a bill', 'warning');
      return;
    }
    setPaymentMode('Cash');
    setUseManualCashInput(false);
    handleAutoFillExactDenominations(grandTotal);
    setMobileCartDrawerOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleFinalizeBill = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveCash = cashDenomTotal > 0 ? cashDenomTotal : (receivedAmount !== '' ? Number(receivedAmount) : grandTotal);
    const paidNum = paymentMode === 'Credit' ? 0 : effectiveCash;

    if (paymentMode === 'Credit' && !activeCustomer) {
      showToast('Customer Required', 'Please attach a customer to record credit on Khata.', 'warning');
      return;
    }

    if (paymentMode !== 'Credit' && paidNum < Math.floor(grandTotal) && !activeCustomer) {
      showToast('Customer Required', 'Attach customer to record remaining balance on Khata.', 'warning');
      return;
    }

    const denomsPayload: CashDenominations | undefined =
      paymentMode === 'Cash' && cashDenomTotal > 0
        ? {
            n500: cashDenoms.n500 || 0,
            n200: cashDenoms.n200 || 0,
            n100: cashDenoms.n100 || 0,
            n50: cashDenoms.n50 || 0,
            n20: cashDenoms.n20 || 0,
            n10: cashDenoms.n10 || 0,
            n5: cashDenoms.n5 || 0,
            n2: cashDenoms.n2 || 0,
            n1: cashDenoms.n1 || 0,
            coins: (cashDenoms.n5 || 0) * 5 + (cashDenoms.n2 || 0) * 2 + (cashDenoms.n1 || 0) * 1,
          }
        : undefined;

    try {
      const newOrder = store.createOrder({
        paymentMethod: paymentMode,
        amountPaidInr: Math.max(0, paidNum),
        discountInr: discountNum,
        notes: orderNotes.trim() || undefined,
        denominations: denomsPayload,
      });

      playSuccessSound();
      speakEnglish(`Bill completed. Total ₹${grandTotal}`);
      showToast('Bill Generated', `Bill #${newOrder.billNo} for ₹${grandTotal} completed!`, 'success');

      // Check if any product breached reorder point
      const lowStockAfter = store.getState().products.filter((p) => p.currentStockUnits <= p.reorderPointUnits);
      if (lowStockAfter.length > 0) {
        showToast(
          'Reorder Alert Triggered',
          `${lowStockAfter.length} SKU(s) reached reorder threshold. Stock replenishment queued in Production.`,
          'warning',
          3500
        );
      }

      setCompletedOrder(newOrder);
      setIsCheckoutOpen(false);
      setIsReceiptModalOpen(true);
      setDiscountAmount('0');
      setOrderNotes('');
      setReceivedAmount('');
      handleResetDenominations();
    } catch (err) {
      playErrorSound();
      showToast('Billing Error', 'Failed to generate bill. Please verify cart items.', 'error');
    }
  };

  const handleVoidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidModalOrder) return;
    if (!voidReason.trim()) {
      showToast('Reason Required', 'Please enter reason for voiding bill', 'warning');
      return;
    }

    store.voidOrder(voidModalOrder.id, voidReason.trim());
    showToast('Bill Voided', `Bill ${voidModalOrder.billNo} voided and stock restocked.`, 'info');
    setVoidModalOrder(null);
    setVoidReason('');
  };

  // WhatsApp Bill Text Generator - Clean & Professional (No internal wholesale tier classifications)
  const generateWhatsAppLink = (order: Order) => {
    const itemsList = order.items
      .map((i) => `• ${i.skuName} (${i.quantity} x ₹${i.unitPriceInr}) = ₹${i.totalInr}`)
      .join('%0A');

    const upiPayLink = `upi://pay?pa=nikhilkimasti2409@okaxis&pn=Joshi%20Mangodi%20Udyog&am=${order.creditAddedInr}&cu=INR`;

    let msg = `*JOSHI MANGODI UDYOG - TAX INVOICE*%0A` +
      `--------------------------------%0A` +
      `*Bill No:* ${order.billNo}%0A` +
      `*Date:* ${order.date}%0A` +
      `*Customer:* ${order.customerName || 'Counter Retail'}%0A` +
      (order.customerGstin ? `*GSTIN:* ${order.customerGstin}%0A` : '') +
      `--------------------------------%0A` +
      `*ITEMS:*%0A${itemsList}%0A` +
      `--------------------------------%0A` +
      `*Subtotal:* ₹${order.subtotalInr}%0A` +
      (order.discountInr > 0 ? `*Discount:* -₹${order.discountInr}%0A` : '') +
      `*GST (Incl.):* ₹${order.gstAmountInr}%0A` +
      `*GRAND TOTAL:* *₹${order.grandTotalInr}*%0A` +
      `*Payment Mode:* ${order.paymentMethod}%0A` +
      `*Amount Paid:* ₹${order.amountPaidInr}%0A` +
      (order.denominations ? `*Cash Breakdown:* ${formatDenominationBreakdown(order.denominations)}%0A` : '');

    if (order.creditAddedInr > 0) {
      msg += `--------------------------------%0A` +
        `*⚠️ BALANCE DUE / KHATA:* *₹${order.creditAddedInr}*%0A` +
        `%0A👉 *Pay Due Online via UPI:*%0A` +
        `UPI ID: *nikhilkimasti2409@okaxis*%0A` +
        `Payment Link: ${encodeURIComponent(upiPayLink)}%0A`;
    }

    msg += `--------------------------------%0A` +
      `Thank you for your business!%0A` +
      `JOSHI MANGODI UDYOG · Fatehpur, Sikar (Raj.)%0A` +
      `Pure Handmade Moong Dal Mangodi`;

    const cleanPhone = order.customerPhone ? `91${order.customerPhone.replace(/[^\d]/g, '').slice(-10)}` : '';
    return `https://wa.me/${cleanPhone}?text=${msg}`;
  };

  return (
    <div className="min-h-[calc(100vh-100px)] pb-36 md:pb-16 pt-2 bg-surface">
      {/* Top Controls Bar (Open & Airy) */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Categories Pill Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'ALL', name: 'All Products' },
              { id: 'PLAIN_MANGODI', name: 'Plain Mangodi' },
              { id: 'MASALA_MANGODI', name: 'Masala Spiced' },
              { id: 'SPECIALTY', name: 'Specialty (Palak/Lehsun)' },
              { id: 'SPICES_GATTE', name: 'Spices & Gatte' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-white'
                    : 'bg-card text-ink-muted border border-border hover:bg-surface'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search bar & customer attachment */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-72">
              <label htmlFor="pos-search" className="sr-only">Search products</label>
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                id="pos-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('pos_search_placeholder')}
                className="jm-input pl-10 w-full"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink cursor-pointer"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Attach Customer Button */}
            <button
              onClick={() => setShowCustomerPicker(true)}
              className="jm-btn-secondary shrink-0 flex items-center gap-2"
            >
              {activeCustomer ? (
                <>
                  <UserCheck size={16} className="text-success" />
                  <span className="truncate max-w-[110px] font-semibold text-success">{activeCustomer.name}</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span className="hidden sm:inline">Attach Customer</span>
                  <span className="sm:hidden">Customer</span>
                </>
              )}
            </button>

            {/* Wholesaler Order Button */}
            <button
              onClick={() => setIsWholesalerModalOpen(true)}
              className="jm-btn-secondary shrink-0 flex items-center gap-1.5 border-border hover:border-primary text-ink font-semibold cursor-pointer"
              title="Wholesaler Order & Custom Rates"
            >
              <Truck size={16} className="text-primary" />
              <span className="hidden sm:inline">Wholesaler</span>
            </button>

            {/* Today's bills toggle */}
            <button
              onClick={() => setViewHistory(!viewHistory)}
              className={`p-2.5 rounded-lg border transition cursor-pointer shrink-0 ${
                viewHistory ? 'bg-primary text-white border-primary' : 'bg-card text-ink-muted border-border hover:bg-surface'
              }`}
              title="Today's Bills History"
              aria-label="Toggle bills history"
            >
              <Clock size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid & Cart Layout */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {viewHistory ? (
          /* Today's Bills History Panel */
          <div className="jm-card p-6 mb-8">
            <div className="border-b border-border pb-4 mb-5">
              <PageHeader 
                title="Today’s Sales History"
                description={`${orders.length} total bills recorded`}
                primaryAction={
                  <button
                    onClick={() => setViewHistory(false)}
                    className="jm-btn-secondary"
                  >
                    Back to POS Grid
                  </button>
                }
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-surface border-b border-border text-xs font-semibold text-ink-muted uppercase tracking-wide">
                    <th scope="col" className="p-3.5">Bill No</th>
                    <th scope="col" className="p-3.5">Customer</th>
                    <th scope="col" className="p-3.5">Items</th>
                    <th scope="col" className="p-3.5">Amount</th>
                    <th scope="col" className="p-3.5">Mode</th>
                    <th scope="col" className="p-3.5">Status</th>
                    <th scope="col" className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((ord) => (
                    <tr key={ord.id} className={ord.isVoid ? 'opacity-40 line-through bg-surface' : 'even:bg-surface'}>
                      <td className="p-3.5 font-mono font-medium text-ink">{ord.billNo}</td>
                      <td className="p-3.5 font-medium">
                        <div className="font-semibold text-ink">{ord.customerName}</div>
                        {ord.customerPhone && <div className="text-[11px] text-ink-muted">{ord.customerPhone}</div>}
                      </td>
                      <td className="p-3.5">
                        {ord.items.map((i) => `${i.skuName} (${i.quantity})`).join(', ')}
                      </td>
                      <td className="p-3.5 font-mono font-semibold text-sm text-ink">₹{(ord.grandTotalInr ?? 0).toLocaleString('en-IN')}</td>
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1">
                          <span className="px-2.5 py-1 rounded-full bg-surface border border-border font-medium text-[11px] w-fit">
                            {ord.paymentMethod}
                          </span>
                          {ord.paymentMethod === 'Cash' && ord.denominations && (
                            <span className="text-[10px] text-ink-muted font-mono" title={formatDenominationBreakdown(ord.denominations) || ''}>
                              {formatDenominationBreakdown(ord.denominations)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        {ord.isVoid ? (
                          <StatusBadge variant="danger" label="VOID" />
                        ) : (
                          <StatusBadge variant="success" label="PAID" />
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setCompletedOrder(ord);
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-2 rounded-lg border border-border hover:bg-surface text-ink cursor-pointer"
                            title="Print / View"
                            aria-label="Print or View Bill"
                          >
                            <Printer size={16} />
                          </button>
                          {!ord.isVoid && (
                            <button
                              onClick={() => {
                                setVoidModalOrder(ord);
                                setVoidReason('');
                              }}
                              className="p-2 rounded-lg border border-danger-soft text-danger hover:bg-danger-soft cursor-pointer"
                              title="Void Bill & Restock"
                              aria-label="Void Bill"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Product Grid (8 cols on lg) */}
            <div className="lg:col-span-8">
              {lowStockProducts.length > 0 && (
                <div className="mb-4 p-3.5 rounded-lg bg-warning-soft border border-warning/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-warning font-semibold">
                    <AlertTriangle size={18} className="shrink-0 text-warning" />
                    <span>
                      <strong>Stock Reorder Alert:</strong> {lowStockProducts.length} product(s) at or below Reorder Point ({lowStockProducts.map((p) => `${p.name} (${p.currentStockUnits} left)`).slice(0, 2).join(', ')}{lowStockProducts.length > 2 ? '...' : ''}).
                    </span>
                  </div>
                  <Link
                    to="/production"
                    className="jm-btn-secondary !text-xs !py-1.5 shrink-0 flex items-center gap-1.5"
                  >
                    <span>Launch Production Batch</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              )}

              {products.length === 0 ? (
                <EmptyState
                  icon={<Tag size={24} />}
                  title="No Products in Catalog Yet"
                  description="All seed products were cleared. Please upload or create your custom Mangodi products to begin counter billing."
                  action={
                    <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                      <Link
                        to="/products"
                        className="jm-btn-primary flex items-center gap-2"
                      >
                        <Plus size={16} />
                        <span>Upload / Add Products</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => store.loadSampleProducts()}
                        className="jm-btn-secondary"
                      >
                        Load Demo SKUs
                      </button>
                    </div>
                  }
                />
              ) : filteredProducts.length === 0 ? (
                <EmptyState
                  icon={<ShoppingBag size={24} />}
                  title="No products match search criteria."
                  description="Try selecting another category or clearing search."
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProducts.map((prod) => {
                    const inCartItem = cart.find((c) => c?.sku?.id === prod.id);
                    const isLowStock = prod.currentStockUnits <= prod.reorderPointUnits;
                    
                    let activePrice = prod.retailPriceInr;
                    if (activeCustomer?.contractPricePerKg && Number(activeCustomer.contractPricePerKg) > 0) {
                      activePrice = round2((Number(activeCustomer.contractPricePerKg) * Number(prod.packetSizeGrams || 1000)) / 1000);
                    } else if (activeChannel === 'WHOLESALE_T1') {
                      activePrice = prod.wholesaleT1PriceInr;
                    } else if (activeChannel === 'WHOLESALE_T2') {
                      activePrice = prod.wholesaleT2PriceInr;
                    }

                    return (
                      <div
                        key={prod.id}
                        onClick={() => handleAddToCart(prod)}
                        className={`bg-card border rounded-lg p-4 flex flex-col justify-between transition cursor-pointer active:scale-[0.98] relative ${
                          inCartItem ? 'border-primary ring-1 ring-primary bg-primary-soft/10' : 'border-border hover:border-ink-muted'
                        }`}
                      >
                        {/* Top Stock Badge */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] uppercase font-semibold text-ink-muted tracking-wider bg-surface border border-border px-2 py-0.5 rounded-full">
                            {prod.shape}
                          </span>
                          <StatusBadge
                            variant={prod.currentStockUnits === 0 ? 'danger' : isLowStock ? 'warning' : 'success'}
                            label={prod.currentStockUnits === 0 ? 'Out of Stock' : isLowStock ? `${prod.currentStockUnits} left (ROP: ${prod.reorderPointUnits})` : `${prod.currentStockUnits} left`}
                          />
                        </div>

                        {/* Product Image */}
                        <div className="h-32 sm:h-36 w-full rounded-lg bg-surface flex items-center justify-center p-3 mb-4 overflow-hidden">
                          {prod.image ? (
                            <img
                              src={prod.image}
                              alt={prod.name}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="h-16 w-16 rounded-full bg-border flex items-center justify-center text-ink font-semibold text-xl">
                              JM
                            </div>
                          )}
                        </div>

                        {/* Name & Details */}
                        <div className="space-y-1">
                          <h3 className="font-semibold text-sm sm:text-base text-ink line-clamp-1 leading-snug">
                            {prod.name}
                          </h3>
                          <div className="text-xs text-ink-muted font-medium">
                            Pack: <strong className="text-ink">{prod.packetSizeGrams}g</strong>
                          </div>
                        </div>

                        {/* Price & Action Button */}
                        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                          <div>
                            <div className="font-mono text-base sm:text-lg font-bold text-ink">
                              ₹{activePrice}
                            </div>
                            {prod.mrpInr > activePrice && (
                              <div className="font-mono text-[11px] text-ink-faint line-through">
                                MRP ₹{prod.mrpInr}
                              </div>
                            )}
                          </div>

                          {inCartItem ? (
                            <div className="flex items-center gap-1 bg-surface rounded-lg p-1 border border-border">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateQty(prod.id, inCartItem.quantity - 1);
                                }}
                                aria-label="Decrease quantity"
                                className="w-9 h-9 rounded bg-card text-ink font-bold flex items-center justify-center hover:bg-surface cursor-pointer text-sm border border-border"
                              >
                                -
                              </button>
                              <span className="w-6 text-center font-mono text-xs font-semibold text-ink">
                                {inCartItem.quantity}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateQty(prod.id, inCartItem.quantity + 1);
                                }}
                                aria-label="Increase quantity"
                                className="w-9 h-9 rounded bg-primary text-white font-bold flex items-center justify-center hover:bg-primary-hover cursor-pointer text-sm"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCart(prod);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-surface hover:bg-border text-ink font-semibold text-xs border border-border flex items-center gap-1.5 cursor-pointer transition"
                            >
                              <Plus size={14} /> Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Cart & Quick Checkout Panel (Desktop) */}
            <div className="hidden lg:block lg:col-span-4">
              <div className="jm-card p-6 sticky top-6 space-y-4">
                {/* Cart Header */}
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center text-primary">
                      <ShoppingBag size={20} />
                    </div>
                    <h2 className="font-bold text-lg text-ink">{t('pos_cart')}</h2>
                    <span className="bg-surface text-ink-muted text-xs px-2.5 py-1 rounded-full font-semibold border border-border">
                      {cart.length}
                    </span>
                  </div>
                  {cart.length > 0 && (
                    <button
                      onClick={handleClearCart}
                      className="text-xs font-semibold text-danger hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={14} /> Clear
                    </button>
                  )}
                </div>

                {/* Attached Customer Card */}
                <div className="p-4 rounded-lg bg-surface border border-border flex items-center justify-between">
                  <div className="truncate">
                    <div className="text-[11px] font-medium text-ink-muted">Attached Customer</div>
                    <div className="font-semibold text-sm text-ink truncate mt-1">
                      {activeCustomer ? `${activeCustomer.name} (${activeCustomer.phone})` : t('pos_walk_in')}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCustomerPicker(true)}
                    className="text-xs font-semibold text-primary hover:underline shrink-0 ml-4 cursor-pointer"
                  >
                    {activeCustomer ? 'Change' : 'Select'}
                  </button>
                </div>

                {/* Cart Items List */}
                <div className="max-h-[320px] overflow-y-auto divide-y divide-border pr-2 space-y-2">
                  {cart.length === 0 ? (
                    <div className="py-12 text-center text-ink-muted">
                      <p className="text-sm font-semibold">Cart is currently empty</p>
                      <p className="text-xs mt-1">Tap any product card on the left to add.</p>
                    </div>
                  ) : (
                    cart.map((item, idx) => {
                      const skuId = item.sku?.id || `cart-item-${idx}`;
                      const skuName = item.sku?.name || 'Product';
                      const defaultPrice = item.sku?.retailPriceInr || 0;
                      return (
                      <div key={skuId} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-ink truncate">
                            {skuName}
                          </div>
                          <div className="font-mono text-xs text-ink-muted mt-1">
                            {item.quantity} x ₹{Number(item.unitPriceInr) > 0 ? item.unitPriceInr : defaultPrice}
                          </div>
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
                            <button
                              onClick={() => handleUpdateQty(skuId, item.quantity - 1)}
                              aria-label="Decrease quantity"
                              className="w-9 h-9 flex items-center justify-center text-sm font-bold text-ink hover:bg-border rounded cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-mono text-sm font-semibold text-ink">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateQty(skuId, item.quantity + 1)}
                              aria-label="Increase quantity"
                              className="w-9 h-9 flex items-center justify-center text-sm font-bold text-ink hover:bg-border rounded cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                          <div className="w-20 text-right font-mono font-bold text-sm text-ink">
                            ₹{(Number(item.totalInr) > 0 ? Number(item.totalInr) : (Number(item.unitPriceInr || defaultPrice) * item.quantity)).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    )})
                  )}
                </div>

                {/* Cart Totals & Checkout Button */}
                {cart.length > 0 && (
                  <div className="pt-4 border-t border-border space-y-4">
                    <div className="flex justify-between text-sm text-ink-muted font-medium">
                      <span>Subtotal</span>
                      <span className="font-mono font-semibold text-ink">₹{cartSubtotal.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between text-sm text-ink-muted items-center">
                      <label htmlFor="discount-amount" className="font-medium">Discount (₹)</label>
                      <input
                        id="discount-amount"
                        type="number"
                        min="0"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                        className="jm-input w-24 text-right font-mono"
                      />
                    </div>

                    <div className="flex justify-between text-base font-bold text-ink pt-4 border-t border-border">
                      <span>{t('pos_total')}</span>
                      <span className="font-mono text-primary text-xl">₹{grandTotal.toLocaleString('en-IN')}</span>
                    </div>

                    <button
                      onClick={openCheckout}
                      className="jm-btn-primary w-full flex items-center justify-center gap-2.5 mt-2"
                    >
                      <Receipt size={20} />
                      <span className="font-mono">Complete Bill · ₹{grandTotal.toLocaleString('en-IN')}</span>
                      <ArrowRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Mobile Cart Bar */}
      <div className="lg:hidden fixed bottom-6 inset-x-0 z-30 px-4 pointer-events-none">
        {cart.length > 0 && (
          <div
            onClick={() => setMobileCartDrawerOpen(true)}
            className="pointer-events-auto bg-ink text-surface p-4 rounded-xl shadow-lg flex items-center justify-between cursor-pointer active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface text-ink flex items-center justify-center font-bold text-sm">
                {cart.length}
              </div>
              <div>
                <div className="text-xs text-ink-faint font-medium">Current Bill</div>
                <div className="font-mono text-lg font-bold text-surface">₹{grandTotal.toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg font-semibold text-sm">
              <span>Review</span>
              <ChevronUp size={16} />
            </div>
          </div>
        )}
      </div>

      {/* Mobile Cart Bottom Sheet Drawer */}
      {mobileCartDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 flex flex-col justify-end backdrop-blur-sm">
          <div className="bg-card rounded-t-xl p-6 border-t border-border shadow-lg max-h-[85vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <ShoppingBag size={20} className="text-primary" />
                <h3 className="font-bold text-lg text-ink">Current Cart ({cart.length})</h3>
              </div>
              <button
                onClick={() => setMobileCartDrawerOpen(false)}
                aria-label="Close"
                className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-ink-muted hover:text-ink font-bold"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border pr-2 space-y-2">
              {cart.map((item, idx) => {
                const skuId = item.sku?.id || `mobile-cart-item-${idx}`;
                const skuName = item.sku?.name || 'Product';
                const defaultPrice = item.sku?.retailPriceInr || 0;
                return (
                <div key={skuId} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-ink truncate">{skuName}</div>
                    <div className="font-mono text-xs text-ink-muted mt-1">
                      {item.quantity} x ₹{Number(item.unitPriceInr) > 0 ? item.unitPriceInr : defaultPrice}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-surface border border-border rounded-lg">
                      <button
                        onClick={() => handleUpdateQty(skuId, item.quantity - 1)}
                        aria-label="Decrease quantity"
                        className="w-9 h-9 flex items-center justify-center text-sm font-bold text-ink"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-mono text-sm font-semibold text-ink">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQty(skuId, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="w-9 h-9 flex items-center justify-center text-sm font-bold text-ink"
                      >
                        +
                      </button>
                    </div>
                    <div className="w-20 text-right font-mono font-bold text-sm text-ink">
                      ₹{(Number(item.totalInr) > 0 ? Number(item.totalInr) : (Number(item.unitPriceInr || defaultPrice) * item.quantity)).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              )})}
            </div>

            <div className="pt-4 border-t border-border space-y-4">
              <div className="flex justify-between font-bold text-lg text-ink">
                <span>Total Amount:</span>
                <span className="font-mono text-primary">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
              <button
                onClick={openCheckout}
                className="jm-btn-primary w-full flex items-center justify-center gap-2"
              >
                <Receipt size={20} />
                <span>Proceed to Checkout</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Picker Modal */}
      <Modal 
        open={showCustomerPicker} 
        onClose={() => {
          setShowCustomerPicker(false);
          setCustomerSearchQuery('');
        }} 
        title="Select Customer" 
        id="customer-picker"
      >
        <div className="flex flex-col space-y-3">
          {/* Walk-in Cash Sale Button */}
          <button
            onClick={() => {
              store.setActiveCustomer(null);
              setShowCustomerPicker(false);
              setCustomerSearchQuery('');
            }}
            className="w-full text-left p-3.5 rounded-lg border border-border hover:bg-surface transition font-semibold text-sm flex items-center justify-between cursor-pointer bg-card"
          >
            <span className="text-ink">{t('pos_walk_in')}</span>
            <span className="text-success font-medium">Counter Cash Sale</span>
          </button>

          {/* Search Box - Placed exactly where indicated by user */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
            <input
              type="text"
              placeholder="Search contact by name, phone, or area..."
              value={customerSearchQuery}
              onChange={(e) => setCustomerSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm bg-surface border border-border rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              autoFocus
            />
            {customerSearchQuery && (
              <button
                type="button"
                onClick={() => setCustomerSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink p-1 cursor-pointer"
                aria-label="Clear contact search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-semibold text-ink-muted uppercase tracking-wider pt-1">
            <span>Select Registered Customer ({processedCustomers.length}):</span>
            <span className="text-[10px] font-normal normal-case text-ink-muted hidden sm:inline">
              Top buyers first · Non-buyers alphabetical
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 divide-y divide-border pr-1 max-h-[50vh]">
            {processedCustomers.length === 0 ? (
              <div className="text-center py-8 text-ink-muted text-xs bg-surface rounded-lg border border-dashed border-border p-4">
                No contacts match "{customerSearchQuery}"
              </div>
            ) : (
              processedCustomers.map((c) => {
                const purchases = Number(c.totalOrdersCount) || 0;
                const hasPurchases = purchases > 0 || (Number(c.lifetimeValueInr) || 0) > 0;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      store.setActiveCustomer(c);
                      setShowCustomerPicker(false);
                      setCustomerSearchQuery('');
                    }}
                    className="py-2.5 px-3 hover:bg-surface rounded-lg cursor-pointer flex items-center justify-between transition group"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-ink truncate">{c.name}</span>
                        {hasPurchases && (
                          <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded shrink-0">
                            {purchases > 0 ? `${purchases} ${purchases === 1 ? 'order' : 'orders'}` : 'Buyer'}
                          </span>
                        )}
                        {c.customerType === 'wholesale' && (
                          <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded shrink-0">
                            ₹{c.contractPricePerKg || 170}/kg
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink-muted font-mono mt-0.5 flex items-center gap-2">
                        <span>{c.phone}</span>
                        {c.area && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[130px]">{c.area}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-semibold text-danger">
                        Due: ₹{c.totalOutstandingInr}
                      </div>
                      {c.lifetimeValueInr > 0 && (
                        <div className="text-[10px] text-ink-muted font-mono">
                          Spent: ₹{c.lifetimeValueInr}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* Checkout Modal */}
      <Modal
        open={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        title="Complete Bill"
        id="checkout"
        size="md"
        footer={
          <div className="flex gap-4 w-full">
            <button
              type="button"
              onClick={() => setIsCheckoutOpen(false)}
              className="jm-btn-secondary flex-1"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              form="checkout-form"
              disabled={paymentMode === 'Credit' && !activeCustomer}
              className="jm-btn-primary flex-1"
            >
              Save Bill
            </button>
          </div>
        }
      >
        <p className="text-sm text-ink-muted mb-4 -mt-2">
          {activeCustomer ? `${activeCustomer.name} (${activeCustomer.phone})` : t('pos_walk_in')}
        </p>

        <form id="checkout-form" onSubmit={handleFinalizeBill} className="space-y-5">
          <div className="p-5 rounded-lg bg-surface border border-border flex items-center justify-between">
            <span className="font-semibold text-sm text-ink-muted">Amount Due:</span>
            <span className="font-mono font-bold text-2xl text-primary">₹{grandTotal.toLocaleString('en-IN')}</span>
          </div>

          <div>
            <div className="block text-sm font-semibold text-ink mb-3">Select Payment Method</div>
            <div className="grid grid-cols-4 gap-3">
              {(['Cash', 'UPI', 'Card', 'Credit'] as PaymentMethod[]).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setPaymentMode(mode)}
                  className={`py-3 rounded-lg text-sm font-semibold border transition cursor-pointer ${
                    paymentMode === mode
                      ? 'bg-ink text-surface border-ink'
                      : 'bg-card text-ink-muted border-border hover:bg-surface'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {paymentMode === 'Cash' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <Banknote size={18} className="text-primary" />
                  <span className="text-sm font-semibold text-ink">Cash Denominations Breakdown</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAutoFillExactDenominations(grandTotal)}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer bg-primary-soft px-2.5 py-1 rounded"
                    title="Auto-calculate exact notes and coins"
                  >
                    <Sparkles size={12} />
                    <span>Exact Notes</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDenominations}
                    className="text-[11px] font-semibold text-danger hover:underline flex items-center gap-1 cursor-pointer px-1 py-1"
                    title="Clear denominations"
                  >
                    <RotateCcw size={12} />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Denomination Counter Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 border border-border rounded-lg p-2.5 bg-surface">
                {CASH_DENOM_CONFIG.map((d) => {
                  const count = cashDenoms[d.key] || 0;
                  const itemSum = count * d.val;
                  return (
                    <div
                      key={d.key}
                      className={`flex items-center justify-between p-2 rounded-lg border transition ${
                        count > 0 ? 'bg-card border-primary/40 shadow-xs' : 'bg-card/70 border-border'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-ink truncate flex items-center gap-1.5">
                          {d.type === 'note' ? (
                            <span className="w-2 h-2 rounded-full bg-success"></span>
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-warning"></span>
                          )}
                          <span>{d.label}</span>
                        </div>
                        <div className="font-mono text-[11px] text-ink-muted">
                          {count > 0 ? (
                            <strong className="text-primary font-mono font-semibold">₹{itemSum.toLocaleString('en-IN')}</strong>
                          ) : (
                            <span>₹{d.val}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateDenom(d.key, -1)}
                          disabled={count <= 0}
                          aria-label={`Decrease ${d.label}`}
                          className="w-7 h-7 flex items-center justify-center text-xs font-bold text-ink hover:bg-border rounded disabled:opacity-30 cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          aria-label={`Count of ${d.label}`}
                          value={count || ''}
                          placeholder="0"
                          onChange={(e) => handleSetDenom(d.key, parseInt(e.target.value) || 0)}
                          className="w-9 text-center font-mono text-xs font-bold text-ink bg-transparent outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateDenom(d.key, 1)}
                          aria-label={`Increase ${d.label}`}
                          className="w-7 h-7 flex items-center justify-center text-xs font-bold text-ink hover:bg-border rounded cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cash Summary Banner */}
              <div className="p-3.5 rounded-lg border border-border bg-card space-y-2 text-xs">
                <div className="flex justify-between items-center text-ink-muted">
                  <span>Total Cash Counted:</span>
                  <span className="font-mono font-bold text-sm text-ink">
                    ₹{cashDenomTotal.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-ink-muted">
                  <span>Bill Amount Due:</span>
                  <span className="font-mono font-semibold text-ink">₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
                {cashDenomTotal > grandTotal && (
                  <div className="flex justify-between items-center pt-2 border-t border-border text-success font-bold">
                    <span>Change to Return to Customer:</span>
                    <span className="font-mono text-sm bg-success-soft px-2 py-0.5 rounded border border-success-soft">
                      ₹{(cashDenomTotal - grandTotal).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
                {cashDenomTotal > 0 && cashDenomTotal < grandTotal && (
                  <div className="flex justify-between items-center pt-2 border-t border-border text-danger font-semibold">
                    <span>Remaining Shortfall (Add to Khata):</span>
                    <span className="font-mono text-sm bg-danger-soft px-2 py-0.5 rounded border border-danger-soft">
                      ₹{(grandTotal - cashDenomTotal).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick direct received amount fallback toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setUseManualCashInput(!useManualCashInput)}
                  className="text-[11px] text-ink-muted hover:text-ink font-medium underline cursor-pointer"
                >
                  {useManualCashInput ? 'Hide quick lump-sum override' : 'Enter lump-sum cash amount instead'}
                </button>
                {useManualCashInput && (
                  <div className="mt-2 space-y-2">
                    <input
                      id="received-amount"
                      type="number"
                      value={receivedAmount}
                      onChange={(e) => setReceivedAmount(e.target.value)}
                      placeholder="Enter custom lump sum received"
                      className="jm-input text-base font-mono w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {paymentMode === 'UPI' && (
            <div className="p-5 rounded-lg bg-surface border border-border text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-ink">
                <QrCode size={18} className="text-primary" />
                <span>Scan Shop UPI QR Code to Pay:</span>
              </div>
              <div className="inline-block p-3 bg-card rounded-lg border border-border shadow-sm">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=nikhilkimasti2409@okaxis&pn=Joshi%20Mangodi%20Udyog&am=${grandTotal}&cu=INR`)}`}
                  alt="UPI QR Code"
                  className="w-32 h-32 mx-auto rounded"
                />
              </div>
              <div className="text-sm font-mono font-medium text-ink bg-card py-2 px-4 rounded-lg border border-border">
                UPI ID: <strong>nikhilkimasti2409@okaxis</strong>
              </div>
              <div className="text-xs text-ink-muted">
                Amount: <strong className="text-ink font-mono font-bold">₹{grandTotal}</strong> · Auto verified at counter
              </div>
            </div>
          )}

          {paymentMode === 'Credit' && (
            <div className="p-4 rounded-lg bg-danger-soft border border-danger-soft text-sm text-danger font-medium space-y-2">
              {activeCustomer ? (
                <>
                  <div className="font-bold">Khata Due Credit Account</div>
                  <div>₹{grandTotal} will be added to <strong>{activeCustomer.name}</strong>'s outstanding balance.</div>
                </>
              ) : (
                <div className="font-semibold">
                  ⚠️ Customer selection required to record credit / Khata bill!
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="order-notes" className="block text-sm font-semibold text-ink mb-2">Notes (Optional)</label>
            <input
              id="order-notes"
              type="text"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="e.g. Special packaging requested"
              className="jm-input"
            />
          </div>
        </form>
      </Modal>

      {/* Void Bill Confirmation Modal */}
      <Modal
        open={!!voidModalOrder}
        onClose={() => setVoidModalOrder(null)}
        title={<span className="text-danger">Void & Restock Bill</span>}
        id="void-bill"
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={() => setVoidModalOrder(null)}
              className="jm-btn-secondary flex-1"
            >
              Keep Bill
            </button>
            <button
              type="submit"
              form="void-bill-form"
              className="jm-btn-danger flex-1"
            >
              Confirm Void
            </button>
          </div>
        }
      >
        {voidModalOrder && (
          <div className="space-y-5">
            <div className="text-sm text-ink-muted space-y-2">
              <div>Are you sure you want to void Bill <strong className="text-ink font-mono">{voidModalOrder.billNo}</strong>?</div>
              <div>Amount: <strong className="text-danger font-mono font-semibold">₹{voidModalOrder.grandTotalInr}</strong> · Customer: <strong className="text-ink">{voidModalOrder.customerName}</strong></div>
              <div className="text-xs text-ink-faint pt-2">All {voidModalOrder.items.length} items will be automatically returned to stock.</div>
            </div>

            <form id="void-bill-form" onSubmit={handleVoidSubmit} className="space-y-4">
              <div>
                <label htmlFor="void-reason" className="block text-sm font-semibold text-ink mb-2">Reason for Cancellation *</label>
                <input
                  id="void-reason"
                  type="text"
                  required
                  autoFocus
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Customer cancelled order / Billing mistake"
                  className="jm-input w-full"
                />
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Printable Thermal Receipt Modal */}
      <Modal
        open={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setCompletedOrder(null);
          setSavedContactCustomer(null);
          setIsSaveContactOpen(false);
        }}
        title={
          <div className="flex items-center gap-2 text-success font-bold text-base">
            <CheckCircle2 size={20} />
            <span>Bill Generated Successfully!</span>
          </div>
        }
        id="receipt"
        size="md"
        footer={
          <div className="flex flex-col gap-3 w-full no-print">
            {/* Walk-in Customer: Save Contact Button & Form */}
            {completedOrder && (!completedOrder.customerId || completedOrder.customerName === 'Walk-in Customer' || savedContactCustomer) && (
              <div className="w-full">
                {savedContactCustomer ? (
                  <div className="w-full py-2 px-3 bg-success-soft/30 border border-success/30 rounded-lg text-success text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5 truncate">
                      <CheckCircle2 size={15} className="shrink-0" />
                      <span className="truncate">Saved Regular Customer: <strong>{savedContactCustomer.name}</strong> ({savedContactCustomer.phone})</span>
                    </span>
                    <span className="text-[10px] bg-success text-white px-2 py-0.5 rounded font-bold shrink-0">
                      Tracked
                    </span>
                  </div>
                ) : !isSaveContactOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSaveContactName('');
                      setSaveContactPhone('');
                      setSaveContactArea('');
                      setIsSaveContactOpen(true);
                    }}
                    className="w-full py-2.5 px-3 rounded-lg bg-primary/10 border border-primary/30 text-primary font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary-soft transition cursor-pointer"
                  >
                    <UserPlus size={16} />
                    <span>Save Contact (Convert to Regular Customer)</span>
                  </button>
                ) : (
                  <form onSubmit={handleSaveWalkInContact} className="p-3 bg-surface border border-primary/30 rounded-xl space-y-2 text-left">
                    <div className="flex items-center justify-between text-xs font-bold text-ink">
                      <span className="flex items-center gap-1 text-primary">
                        <UserPlus size={13} /> Save Contact Details
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsSaveContactOpen(false)}
                        className="text-ink-muted hover:text-ink text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-ink-muted mb-0.5">Name *</label>
                        <input
                          type="text"
                          placeholder="Customer full name"
                          value={saveContactName}
                          onChange={(e) => setSaveContactName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-card border border-border rounded-lg text-ink font-semibold"
                          required
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-ink-muted mb-0.5">Phone *</label>
                        <input
                          type="tel"
                          placeholder="9829012345"
                          value={saveContactPhone}
                          onChange={(e) => setSaveContactPhone(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-card border border-border rounded-lg text-ink font-mono"
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-ink-muted mb-0.5">Area / City (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Fatehpur, Sikar"
                          value={saveContactArea}
                          onChange={(e) => setSaveContactArea(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-card border border-border rounded-lg text-ink"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsSaveContactOpen(false)}
                        className="px-2.5 py-1 text-xs text-ink-muted border border-border rounded-lg hover:bg-card cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="jm-btn-primary text-xs py-1 px-3.5 font-bold cursor-pointer"
                      >
                        Save & Link Contact
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="flex gap-4 w-full">
              <button
                onClick={() => window.print()}
                className="jm-btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Print Receipt
              </button>
              {completedOrder && (
                <a
                  href={generateWhatsAppLink(completedOrder)}
                  target="_blank"
                  rel="noreferrer"
                  className="jm-btn-primary flex-1 flex items-center justify-center gap-2 !bg-success hover:!bg-success-soft hover:!text-success !text-white !border-success"
                >
                  <Share2 size={16} /> Send WhatsApp
                </a>
              )}
            </div>
            <button
              onClick={() => {
                setIsReceiptModalOpen(false);
                setCompletedOrder(null);
                setSavedContactCustomer(null);
                setIsSaveContactOpen(false);
              }}
              className="w-full py-3 rounded-lg bg-ink text-surface text-sm font-semibold hover:bg-ink-muted cursor-pointer transition"
            >
              Start Next Bill
            </button>
          </div>
        }
      >
        {completedOrder && (
          <div className="space-y-5">
            {/* Thermal Print Slip with ID for Clean Browser Printing */}
            <div
              id="printable-receipt"
              className="receipt-thermal jm-card p-5 font-mono text-xs text-ink shadow-inner space-y-3"
            >
              <div className="text-center pb-3 border-b border-dashed border-border">
                <h2 className="font-bold text-base tracking-wider text-ink">JOSHI MANGODI UDYOG</h2>
                <p className="text-[11px] font-medium text-ink-muted">Pure Handmade Moong Dal Mangodi</p>
                <p className="text-[10px] text-ink-faint">Near Head Post Office, Fatehpur, Sikar (Raj.)</p>
                <p className="text-[10px] text-ink-faint">Mob: +91 98290 12345 | GSTIN: 08AABFJ1234F1Z5</p>
                <p className="text-[11px] font-bold mt-2 uppercase tracking-wide">*** TAX INVOICE ***</p>
              </div>

              <div className="py-2.5 border-b border-dashed border-border text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span>Bill No: <strong>{completedOrder.billNo}</strong></span>
                  <span>{completedOrder.date}</span>
                </div>
                <div>Customer: <strong>{completedOrder.customerName}</strong></div>
                {completedOrder.customerPhone && <div>Phone: +91 {completedOrder.customerPhone}</div>}
                {completedOrder.customerGstin && <div>GSTIN: {completedOrder.customerGstin}</div>}
              </div>

              <div className="py-2.5 border-b border-dashed border-border">
                <div className="flex justify-between font-bold pb-2 text-[10px] uppercase text-ink-muted">
                  <span>Item</span>
                  <span>Qty x Rate</span>
                  <span className="text-right">Amt</span>
                </div>
                {completedOrder.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between py-1 text-[11px]">
                    <span className="truncate max-w-[130px] font-medium">{it.skuName}</span>
                    <span>{it.quantity} x ₹{it.unitPriceInr}</span>
                    <span className="font-bold text-right">₹{it.totalInr}</span>
                  </div>
                ))}
              </div>

              <div className="py-2.5 border-b border-dashed border-border text-[11px] space-y-1.5">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{completedOrder.subtotalInr}</span>
                </div>
                {completedOrder.discountInr > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Discount:</span>
                    <span>-₹{completedOrder.discountInr}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GST (Included):</span>
                  <span>₹{completedOrder.gstAmountInr}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-2 border-t border-border">
                  <span>GRAND TOTAL:</span>
                  <span>₹{completedOrder.grandTotalInr}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Paid ({completedOrder.paymentMethod}):</span>
                  <span>₹{completedOrder.amountPaidInr}</span>
                </div>
                {completedOrder.paymentMethod === 'Cash' && completedOrder.denominations && (
                  <div className="pt-2 border-t border-dashed border-border space-y-1 bg-surface p-2 rounded">
                    <div className="flex justify-between font-bold text-[10px] text-ink uppercase">
                      <span>Cash Denominations Breakdown:</span>
                      <span>₹{completedOrder.amountPaidInr}</span>
                    </div>
                    <div className="text-[10px] text-ink-muted leading-relaxed">
                      {formatDenominationBreakdown(completedOrder.denominations)}
                    </div>
                  </div>
                )}
                {completedOrder.changeDueInr > 0 && (
                  <div className="flex justify-between text-[11px] font-bold text-success">
                    <span>Change Returned:</span>
                    <span>₹{completedOrder.changeDueInr}</span>
                  </div>
                )}
                {completedOrder.creditAddedInr > 0 && (
                  <div className="flex justify-between text-[11px] font-bold text-danger">
                    <span>Balance Due on Khata:</span>
                    <span>₹{completedOrder.creditAddedInr}</span>
                  </div>
                )}
              </div>

              {/* Dynamic UPI QR Code on Printed Receipt if Balance is Due */}
              {completedOrder.creditAddedInr > 0 && (
                <div className="py-3 border-b border-dashed border-border text-center space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink">
                    Scan to Pay Due Balance (₹{completedOrder.creditAddedInr}):
                  </p>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`upi://pay?pa=nikhilkimasti2409@okaxis&pn=Joshi%20Mangodi%20Udyog&am=${completedOrder.creditAddedInr}&cu=INR`)}`}
                    alt="UPI Due QR Code"
                    className="w-24 h-24 mx-auto border border-border p-1 bg-card rounded"
                  />
                  <p className="text-[9px] font-mono text-ink-muted">UPI ID: nikhilkimasti2409@okaxis</p>
                </div>
              )}

              <div className="text-center pt-3 text-[10px] text-ink-faint">
                <p className="font-bold">Thank you for your visit!</p>
                <p>Traditional Handmade Taste of Rajasthan</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Wholesaler Order & Management Modal */}
      <WholesalerModal
        open={isWholesalerModalOpen}
        onClose={() => setIsWholesalerModalOpen(false)}
      />
    </div>
  );
}
