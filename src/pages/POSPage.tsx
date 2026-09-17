import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useAppState, store } from '../lib/store';
import { t } from '../lib/i18n';
import { showToast } from '../components/common/Toast';
import { playTapSound, playSuccessSound, playErrorSound, speakEnglish } from '../lib/audio';
import type { ProductSKU, Order, PaymentMethod } from '../types';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';
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

  // Cart calculations with safe dynamic numeric evaluation
  const cartSubtotal = useMemo(() => {
    return cart.reduce((s, i) => {
      const lineTotal = Number(i.totalInr) > 0
        ? Number(i.totalInr)
        : (Number(i.unitPriceInr || i.sku?.retailPriceInr || 0) * (Number(i.quantity) || 1));
      return s + (Number(lineTotal) || 0);
    }, 0);
  }, [cart]);

  const discountNum = Math.max(0, Number(discountAmount) || 0);
  const grandTotal = Math.max(0, cartSubtotal - discountNum);

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
    setReceivedAmount(String(grandTotal));
    setPaymentMode('Cash');
    setMobileCartDrawerOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleFinalizeBill = (e: React.FormEvent) => {
    e.preventDefault();
    const paidNum = paymentMode === 'Credit' ? 0 : (receivedAmount !== '' ? Number(receivedAmount) : grandTotal);

    if (paymentMode === 'Credit' && !activeCustomer) {
      showToast('Customer Required', 'Please attach a customer to record credit on Khata.', 'warning');
      return;
    }

    if (paymentMode !== 'Credit' && paidNum < grandTotal && !activeCustomer) {
      showToast('Customer Required', 'Attach customer to record remaining balance on Khata.', 'warning');
      return;
    }

    try {
      const newOrder = store.createOrder({
        paymentMethod: paymentMode,
        amountPaidInr: Math.max(0, paidNum),
        discountInr: discountNum,
        notes: orderNotes.trim() || undefined,
      });

      playSuccessSound();
      speakEnglish(`Bill completed. Total ₹${grandTotal}`);
      showToast('Bill Generated', `Bill #${newOrder.billNo} for ₹${grandTotal} completed!`, 'success');

      setCompletedOrder(newOrder);
      setIsCheckoutOpen(false);
      setIsReceiptModalOpen(true);
      setDiscountAmount('0');
      setOrderNotes('');
      setReceivedAmount('');
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
      `*Amount Paid:* ₹${order.amountPaidInr}%0A`;

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
                      <td className="p-3.5 font-mono font-semibold text-sm text-ink">₹{ord.grandTotalInr.toLocaleString('en-IN')}</td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-full bg-surface border border-border font-medium text-[11px]">
                          {ord.paymentMethod}
                        </span>
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
                    const inCartItem = cart.find((c) => c.sku.id === prod.id);
                    const isLowStock = prod.currentStockUnits <= prod.reorderPointUnits;
                    
                    let activePrice = prod.retailPriceInr;
                    if (activeChannel === 'WHOLESALE_T1') activePrice = prod.wholesaleT1PriceInr;
                    if (activeChannel === 'WHOLESALE_T2') activePrice = prod.wholesaleT2PriceInr;

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
                            label={`${prod.currentStockUnits} left`}
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
                    cart.map((item) => (
                      <div key={item.sku.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-ink truncate">
                            {item.sku.name}
                          </div>
                          <div className="font-mono text-xs text-ink-muted mt-1">
                            {item.quantity} x ₹{Number(item.unitPriceInr) > 0 ? item.unitPriceInr : (item.sku.retailPriceInr || 0)}
                          </div>
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
                            <button
                              onClick={() => handleUpdateQty(item.sku.id, item.quantity - 1)}
                              aria-label="Decrease quantity"
                              className="w-9 h-9 flex items-center justify-center text-sm font-bold text-ink hover:bg-border rounded cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-mono text-sm font-semibold text-ink">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateQty(item.sku.id, item.quantity + 1)}
                              aria-label="Increase quantity"
                              className="w-9 h-9 flex items-center justify-center text-sm font-bold text-ink hover:bg-border rounded cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                          <div className="w-20 text-right font-mono font-bold text-sm text-ink">
                            ₹{(Number(item.totalInr) > 0 ? Number(item.totalInr) : (Number(item.unitPriceInr || item.sku.retailPriceInr || 0) * item.quantity)).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    ))
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
              {cart.map((item) => (
                <div key={item.sku.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-ink truncate">{item.sku.name}</div>
                    <div className="font-mono text-xs text-ink-muted mt-1">
                      {item.quantity} x ₹{Number(item.unitPriceInr) > 0 ? item.unitPriceInr : (item.sku.retailPriceInr || 0)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-surface border border-border rounded-lg">
                      <button
                        onClick={() => handleUpdateQty(item.sku.id, item.quantity - 1)}
                        aria-label="Decrease quantity"
                        className="w-9 h-9 flex items-center justify-center text-sm font-bold text-ink"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-mono text-sm font-semibold text-ink">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQty(item.sku.id, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="w-9 h-9 flex items-center justify-center text-sm font-bold text-ink"
                      >
                        +
                      </button>
                    </div>
                    <div className="w-20 text-right font-mono font-bold text-sm text-ink">
                      ₹{(Number(item.totalInr) > 0 ? Number(item.totalInr) : (Number(item.unitPriceInr || item.sku.retailPriceInr || 0) * item.quantity)).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              ))}
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
        onClose={() => setShowCustomerPicker(false)} 
        title="Select Customer" 
        id="customer-picker"
      >
        <div className="flex flex-col space-y-4">
          <button
            onClick={() => {
              store.setActiveCustomer(null);
              setShowCustomerPicker(false);
            }}
            className="w-full text-left p-4 rounded-lg border border-border hover:bg-surface transition font-semibold text-sm flex items-center justify-between cursor-pointer bg-card"
          >
            <span className="text-ink">{t('pos_walk_in')}</span>
            <span className="text-success font-medium">Counter Cash Sale</span>
          </button>

          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider mt-2">Select Registered Customer:</div>

          <div className="flex-1 overflow-y-auto space-y-1 divide-y divide-border pr-2 max-h-[50vh]">
            {customers.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  store.setActiveCustomer(c);
                  setShowCustomerPicker(false);
                }}
                className="py-3 px-3 hover:bg-surface rounded-lg cursor-pointer flex items-center justify-between transition"
              >
                <div>
                  <div className="font-semibold text-sm text-ink">{c.name}</div>
                  <div className="text-xs text-ink-muted font-mono mt-1">{c.phone} · {c.customerType}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold text-danger">Due: ₹{c.totalOutstandingInr}</div>
                </div>
              </div>
            ))}
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="received-amount" className="text-sm font-semibold text-ink">Received Cash (₹)</label>
                {Number(receivedAmount) > grandTotal && (
                  <span className="font-mono text-xs font-semibold text-success bg-success-soft px-3 py-1.5 rounded-full border border-success-soft">
                    Change: ₹{Number(receivedAmount) - grandTotal}
                  </span>
                )}
              </div>
              <input
                id="received-amount"
                type="number"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
                className="jm-input text-lg font-mono"
                autoFocus
              />
              <div className="flex items-center gap-2 pt-2 overflow-x-auto pb-1 scrollbar-none">
                {[grandTotal, 100, 200, 500, 1000, 2000].map((amt, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => setReceivedAmount(String(amt))}
                    className="flex-1 py-2 px-3 rounded-lg border border-border bg-surface text-sm font-semibold text-ink hover:bg-border cursor-pointer whitespace-nowrap font-mono"
                  >
                    {amt === grandTotal ? 'Exact' : `₹${amt}`}
                  </button>
                ))}
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
        onClose={() => { setIsReceiptModalOpen(false); setCompletedOrder(null); }}
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
              onClick={() => { setIsReceiptModalOpen(false); setCompletedOrder(null); }}
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
    </div>
  );
}
