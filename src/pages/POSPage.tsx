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
  SlidersHorizontal,
  Tag,
  QrCode,
} from 'lucide-react';
import { useAppState, store } from '../lib/store';
import { t } from '../lib/i18n';
import { showToast } from '../components/common/Toast';
import { playTapSound, playSuccessSound, playErrorSound, speakEnglish } from '../lib/audio';
import type { ProductSKU, Order, PaymentMethod } from '../types';

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
    <div className="min-h-[calc(100vh-100px)] pb-36 md:pb-16 pt-2">
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
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#31102A] text-white shadow-md'
                    : 'bg-white text-[#632055] hover:bg-[#FEFCE8] border border-[#FCE7F3]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search bar & customer attachment */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-72">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#632055]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('pos_search_placeholder')}
                className="jm-input !pl-10 !text-xs !min-h-[44px] shadow-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-black cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Attach Customer Button */}
            <button
              onClick={() => setShowCustomerPicker(true)}
              className="jm-btn-secondary !min-h-[44px] !text-xs !py-2 !px-4 shrink-0 flex items-center gap-2 shadow-xs"
            >
              {activeCustomer ? (
                <>
                  <UserCheck size={16} className="text-emerald-700" />
                  <span className="truncate max-w-[110px] font-black text-emerald-800">{activeCustomer.name}</span>
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
              className={`p-2.5 rounded-2xl border border-[#FCE7F3] transition cursor-pointer shrink-0 shadow-xs ${
                viewHistory ? 'bg-[#31102A] text-white' : 'bg-white text-[#632055] hover:bg-[#FEFCE8]'
              }`}
              title="Today's Bills History"
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
          <div className="jm-card p-6 mb-8 bg-white">
            <div className="flex items-center justify-between mb-5 border-b border-[#FCE7F3] pb-4">
              <div>
                <h2 className="text-xl font-black text-[#31102A]">Today’s Sales History</h2>
                <p className="text-xs text-[#632055] mt-0.5">{orders.length} total bills recorded</p>
              </div>
              <button
                onClick={() => setViewHistory(false)}
                className="jm-btn-secondary !min-h-[40px] !text-xs"
              >
                Back to POS Grid
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FFF9FA] border-b border-[#FCE7F3] text-[#632055] font-bold">
                    <th className="p-3.5">Bill No</th>
                    <th className="p-3.5">Customer</th>
                    <th className="p-3.5">Items</th>
                    <th className="p-3.5">Amount</th>
                    <th className="p-3.5">Mode</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FCE7F3]">
                  {orders.map((ord) => (
                    <tr key={ord.id} className={ord.isVoid ? 'opacity-40 line-through bg-gray-50' : 'hover:bg-[#FFF9FA]'}>
                      <td className="p-3.5 font-mono font-bold text-[#31102A]">{ord.billNo}</td>
                      <td className="p-3.5 font-medium">
                        <div className="font-extrabold text-[#31102A]">{ord.customerName}</div>
                        {ord.customerPhone && <div className="text-[11px] text-[#632055]">{ord.customerPhone}</div>}
                      </td>
                      <td className="p-3.5">
                        {ord.items.map((i) => `${i.skuName} (${i.quantity})`).join(', ')}
                      </td>
                      <td className="p-3.5 font-black text-sm text-[#31102A]">₹{ord.grandTotalInr.toLocaleString('en-IN')}</td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-lg bg-[#FFF9FA] border border-[#FCE7F3] font-bold text-[11px]">
                          {ord.paymentMethod}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {ord.isVoid ? (
                          <span className="text-red-700 font-black text-xs">VOID</span>
                        ) : (
                          <span className="text-emerald-700 font-black text-xs">PAID</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setCompletedOrder(ord);
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-2 rounded-xl border border-[#FCE7F3] hover:bg-[#FEFCE8] text-[#31102A] cursor-pointer"
                            title="Print / View"
                          >
                            <Printer size={15} />
                          </button>
                          {!ord.isVoid && (
                            <button
                              onClick={() => {
                                setVoidModalOrder(ord);
                                setVoidReason('');
                              }}
                              className="p-2 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                              title="Void Bill & Restock"
                            >
                              <Trash2 size={15} />
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Product Grid (8 cols on lg) */}
            <div className="lg:col-span-8">
              {products.length === 0 ? (
                <div className="jm-card p-12 sm:p-16 text-center text-[#632055] bg-white border-2 border-dashed border-[#FBCFE8] space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-3xl bg-[#FFF9FA] border border-[#FCE7F3] flex items-center justify-center text-[#9F1239]">
                    <Tag size={32} />
                  </div>
                  <div>
                    <h3 className="font-serif-brand font-black text-xl text-[#31102A]">No Products in Catalog Yet</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                      All seed products were cleared. Please upload or create your custom Mangodi products to begin counter billing.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Link
                      to="/products"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#9F1239] text-white font-extrabold text-xs shadow-md hover:bg-[#881337] transition"
                    >
                      <Plus size={16} />
                      <span>Upload / Add Products</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => store.loadSampleProducts()}
                      className="px-4 py-2.5 rounded-2xl bg-[#FEF08A] border border-[#FDE047] text-[#31102A] font-extrabold text-xs hover:bg-[#FDE047] transition cursor-pointer"
                    >
                      Load Demo SKUs
                    </button>
                  </div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="jm-card p-16 text-center text-[#632055] bg-white">
                  <ShoppingBag size={52} className="mx-auto mb-3 opacity-30" />
                  <p className="font-extrabold text-base">No products match search criteria.</p>
                  <p className="text-xs text-gray-500 mt-1">Try selecting another category or clearing search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
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
                        className={`jm-card overflow-hidden p-4 flex flex-col justify-between transition cursor-pointer hover:-translate-y-1 hover:shadow-lg active:scale-[0.98] relative ${
                          inCartItem ? 'ring-2 ring-[#9F1239] bg-[#FFF9FA]' : 'bg-white'
                        }`}
                      >
                        {/* Top Stock Badge */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase font-bold text-[#632055] tracking-wider bg-[#FFF9FA] border border-[#FCE7F3] px-2 py-0.5 rounded-lg">
                            {prod.shape}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              prod.currentStockUnits === 0
                                ? 'bg-red-100 text-red-800'
                                : isLowStock
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {prod.currentStockUnits} left
                          </span>
                        </div>

                        {/* Product Image */}
                        <div className="h-32 sm:h-36 w-full rounded-2xl bg-gradient-to-b from-[#FFF9FA] to-[#FEFCE8] flex items-center justify-center p-3 mb-3 overflow-hidden">
                          {prod.image ? (
                            <img
                              src={prod.image}
                              alt={prod.name}
                              className="h-full w-full object-contain filter drop-shadow-sm transition hover:scale-105"
                            />
                          ) : (
                            <div className="h-16 w-16 rounded-2xl bg-[#FBCFE8] flex items-center justify-center text-[#31102A] font-serif-brand font-bold text-xl">
                              JM
                            </div>
                          )}
                        </div>

                        {/* Name & Details */}
                        <div className="space-y-1">
                          <h3 className="font-extrabold text-sm sm:text-base text-[#31102A] line-clamp-1 leading-snug">
                            {prod.name}
                          </h3>
                          <div className="text-xs text-gray-500 font-medium">
                            Pack: <strong className="text-[#31102A] font-bold">{prod.packetSizeGrams}g</strong>
                          </div>
                        </div>

                        {/* Price & Action Button */}
                        <div className="mt-3.5 pt-3 border-t border-[#FCE7F3] flex items-center justify-between">
                          <div>
                            <div className="text-base sm:text-lg font-black text-[#9F1239]">
                              ₹{activePrice}
                            </div>
                            {prod.mrpInr > activePrice && (
                              <div className="text-[10px] text-gray-400 line-through">
                                MRP ₹{prod.mrpInr}
                              </div>
                            )}
                          </div>

                          {inCartItem ? (
                            <div className="flex items-center gap-1 bg-[#FBCFE8] rounded-xl p-1 border border-[#E5B6D3]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateQty(prod.id, inCartItem.quantity - 1);
                                }}
                                className="w-7 h-7 rounded-lg bg-white text-[#31102A] font-black flex items-center justify-center hover:bg-gray-100 cursor-pointer text-xs"
                              >
                                -
                              </button>
                              <span className="w-5 text-center text-xs font-black text-[#31102A]">
                                {inCartItem.quantity}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateQty(prod.id, inCartItem.quantity + 1);
                                }}
                                className="w-7 h-7 rounded-lg bg-[#31102A] text-white font-black flex items-center justify-center hover:bg-black cursor-pointer text-xs"
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
                              className="px-3 py-1.5 rounded-xl bg-[#FBCFE8] hover:bg-[#F472B6] text-[#31102A] font-extrabold text-xs border border-[#E5B6D3] flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                            >
                              <Plus size={14} strokeWidth={3} /> Add
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
              <div className="jm-card p-5 sticky top-[95px] shadow-lg bg-white space-y-4">
                {/* Cart Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-[#FCE7F3]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#FBCFE8] flex items-center justify-center text-[#9F1239]">
                      <ShoppingBag size={18} />
                    </div>
                    <h2 className="font-black text-lg text-[#31102A]">{t('pos_cart')}</h2>
                    <span className="bg-[#FEF08A] text-[#31102A] text-xs px-2.5 py-0.5 rounded-full font-black">
                      {cart.length}
                    </span>
                  </div>
                  {cart.length > 0 && (
                    <button
                      onClick={handleClearCart}
                      className="text-xs font-bold text-red-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={14} /> Clear
                    </button>
                  )}
                </div>

                {/* Attached Customer Card */}
                <div className="p-3.5 rounded-2xl bg-[#FFF9FA] border border-[#FCE7F3] flex items-center justify-between">
                  <div className="truncate">
                    <div className="text-[11px] font-bold text-[#632055]">Attached Customer</div>
                    <div className="font-black text-xs text-[#31102A] truncate mt-0.5">
                      {activeCustomer ? `${activeCustomer.name} (${activeCustomer.phone})` : t('pos_walk_in')}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCustomerPicker(true)}
                    className="text-xs font-extrabold text-[#9F1239] hover:underline shrink-0 ml-3 cursor-pointer"
                  >
                    {activeCustomer ? 'Change' : 'Select'}
                  </button>
                </div>

                {/* Cart Items List */}
                <div className="max-h-[320px] overflow-y-auto divide-y divide-[#FCE7F3] pr-1.5 space-y-1">
                  {cart.length === 0 ? (
                    <div className="py-12 text-center text-[#632055]">
                      <p className="text-sm font-extrabold">Cart is currently empty</p>
                      <p className="text-xs text-gray-500 mt-1">Tap any product card on the left to add.</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.sku.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-xs text-[#31102A] truncate">
                            {item.sku.name}
                          </div>
                          <div className="text-xs text-[#632055] mt-0.5">
                            {item.quantity} x ₹{Number(item.unitPriceInr) > 0 ? item.unitPriceInr : (item.sku.retailPriceInr || 0)}
                          </div>
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-[#FFF9FA] border border-[#FCE7F3] rounded-xl p-0.5">
                            <button
                              onClick={() => handleUpdateQty(item.sku.id, item.quantity - 1)}
                              className="w-7 h-7 flex items-center justify-center text-xs font-bold text-[#31102A] hover:bg-[#FBCFE8] rounded-lg cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs font-black">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateQty(item.sku.id, item.quantity + 1)}
                              className="w-7 h-7 flex items-center justify-center text-xs font-bold text-[#31102A] hover:bg-[#FBCFE8] rounded-lg cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                          <div className="w-16 text-right font-black text-sm text-[#31102A]">
                            ₹{(Number(item.totalInr) > 0 ? Number(item.totalInr) : (Number(item.unitPriceInr || item.sku.retailPriceInr || 0) * item.quantity)).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Cart Totals & Checkout Button */}
                {cart.length > 0 && (
                  <div className="pt-4 border-t-2 border-[#FCE7F3] space-y-3">
                    <div className="flex justify-between text-xs text-[#632055] font-medium">
                      <span>Subtotal</span>
                      <span className="font-bold text-[#31102A]">₹{cartSubtotal.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between text-xs text-[#632055] items-center">
                      <span className="font-medium">Discount (₹)</span>
                      <input
                        type="number"
                        min="0"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                        className="w-24 text-right px-2.5 py-1.5 border border-[#FCE7F3] rounded-xl text-xs font-extrabold"
                      />
                    </div>

                    <div className="flex justify-between text-base font-black text-[#31102A] pt-3 border-t border-[#FCE7F3]">
                      <span>{t('pos_total')}</span>
                      <span className="text-[#9F1239] text-2xl">₹{grandTotal.toLocaleString('en-IN')}</span>
                    </div>

                    <button
                      onClick={openCheckout}
                      className="jm-btn-primary w-full mt-2 !py-4 !text-base !font-black shadow-lg flex items-center justify-center gap-2.5"
                    >
                      <Receipt size={20} />
                      <span>Complete Bill · ₹{grandTotal.toLocaleString('en-IN')}</span>
                      <ArrowRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Mobile Cart Bar (Clean & uncluttered) */}
      <div className="lg:hidden fixed bottom-6 inset-x-0 z-30 px-4 pointer-events-none">
        {cart.length > 0 && (
          <div
            onClick={() => setMobileCartDrawerOpen(true)}
            className="pointer-events-auto bg-[#31102A] text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between border-2 border-[#FBCFE8] cursor-pointer active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#FBCFE8] text-[#31102A] flex items-center justify-center font-black text-sm">
                {cart.length}
              </div>
              <div>
                <div className="text-xs text-pink-200 font-semibold">Current Bill</div>
                <div className="text-lg font-black text-white">₹{grandTotal.toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-[#FBCFE8] text-[#31102A] px-4 py-2.5 rounded-2xl font-black text-xs shadow-xs">
              <span>Review & Pay</span>
              <ChevronUp size={16} strokeWidth={3} />
            </div>
          </div>
        )}
      </div>

      {/* Mobile Cart Bottom Sheet Drawer */}
      {mobileCartDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 flex flex-col justify-end backdrop-blur-xs">
          <div className="bg-white rounded-t-[2rem] p-6 border-t-2 border-[#FCE7F3] shadow-2xl max-h-[85vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#FCE7F3]">
              <div className="flex items-center gap-2.5">
                <ShoppingBag size={20} className="text-[#9F1239]" />
                <h3 className="font-black text-lg text-[#31102A]">Current Cart ({cart.length})</h3>
              </div>
              <button
                onClick={() => setMobileCartDrawerOpen(false)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#FCE7F3] pr-1 space-y-2">
              {cart.map((item) => (
                <div key={item.sku.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-xs text-[#31102A] truncate">{item.sku.name}</div>
                    <div className="text-xs text-[#632055]">
                      {item.quantity} x ₹{Number(item.unitPriceInr) > 0 ? item.unitPriceInr : (item.sku.retailPriceInr || 0)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-[#FFF9FA] border border-[#FCE7F3] rounded-xl">
                      <button
                        onClick={() => handleUpdateQty(item.sku.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center text-xs font-bold text-[#31102A]"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-xs font-black">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQty(item.sku.id, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center text-xs font-bold text-[#31102A]"
                      >
                        +
                      </button>
                    </div>
                    <div className="w-16 text-right font-black text-sm text-[#31102A]">
                      ₹{(Number(item.totalInr) > 0 ? Number(item.totalInr) : (Number(item.unitPriceInr || item.sku.retailPriceInr || 0) * item.quantity)).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t-2 border-[#FCE7F3] space-y-3">
              <div className="flex justify-between font-black text-xl text-[#31102A]">
                <span>Total Amount:</span>
                <span className="text-[#9F1239]">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
              <button
                onClick={openCheckout}
                className="jm-btn-primary w-full !py-4 !text-base !font-black shadow-md flex items-center justify-center gap-2"
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
      {showCustomerPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#FCE7F3] shadow-2xl max-h-[85vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#FCE7F3]">
              <h3 className="font-black text-lg text-[#31102A]">Attach Customer for Bill</h3>
              <button onClick={() => setShowCustomerPicker(false)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <button
              onClick={() => {
                store.setActiveCustomer(null);
                setShowCustomerPicker(false);
              }}
              className="w-full text-left p-4 rounded-2xl border border-[#FCE7F3] hover:bg-[#FEFCE8] transition font-bold text-xs flex items-center justify-between cursor-pointer"
            >
              <span>{t('pos_walk_in')}</span>
              <span className="text-emerald-700 font-extrabold">Counter Cash Sale</span>
            </button>

            <div className="text-xs font-black text-[#632055] uppercase tracking-wider">Select Registered Customer:</div>

            <div className="flex-1 overflow-y-auto space-y-2 divide-y divide-[#FCE7F3] pr-1">
              {customers.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    store.setActiveCustomer(c);
                    setShowCustomerPicker(false);
                  }}
                  className="pt-3 pb-2 px-2.5 hover:bg-[#FFF9FA] rounded-xl cursor-pointer flex items-center justify-between transition"
                >
                  <div>
                    <div className="font-black text-sm text-[#31102A]">{c.name}</div>
                    <div className="text-xs text-[#632055] font-mono mt-0.5">{c.phone} · {c.customerType}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-[#9F1239]">Due: ₹{c.totalOutstandingInr}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 border-2 border-[#FCE7F3] shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#FCE7F3]">
              <div>
                <h3 className="font-black text-xl text-[#31102A]">Payment & Complete Bill</h3>
                <p className="text-xs text-[#632055] mt-0.5">
                  {activeCustomer ? `${activeCustomer.name} (${activeCustomer.phone})` : t('pos_walk_in')}
                </p>
              </div>
              <button onClick={() => setIsCheckoutOpen(false)} className="text-gray-400 hover:text-black font-bold text-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleFinalizeBill} className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#FFF9FA] border border-[#FCE7F3] flex items-center justify-between">
                <span className="font-bold text-sm text-[#632055]">Amount Due:</span>
                <span className="font-black text-2xl text-[#9F1239]">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-2">Select Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Cash', 'UPI', 'Card', 'Credit'] as PaymentMethod[]).map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      onClick={() => setPaymentMode(mode)}
                      className={`py-3 rounded-2xl text-xs font-black border transition cursor-pointer ${
                        paymentMode === mode
                          ? 'bg-[#31102A] text-white border-[#31102A] shadow-xs'
                          : 'bg-white text-[#632055] border-[#FCE7F3] hover:bg-[#FEFCE8]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMode === 'Cash' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#31102A]">Received Cash (₹)</label>
                    {Number(receivedAmount) > grandTotal && (
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        Change: ₹{Number(receivedAmount) - grandTotal}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    className="jm-input !font-black !text-xl"
                    autoFocus
                  />
                  <div className="flex items-center gap-2 pt-1 overflow-x-auto">
                    {[grandTotal, 100, 200, 500, 1000, 2000].map((amt, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setReceivedAmount(String(amt))}
                        className="flex-1 py-2 rounded-xl border border-[#FCE7F3] bg-[#FEFCE8] text-xs font-bold text-[#31102A] hover:bg-[#FEF08A] cursor-pointer whitespace-nowrap"
                      >
                        {amt === grandTotal ? 'Exact' : `₹${amt}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {paymentMode === 'UPI' && (
                <div className="p-4 rounded-2xl bg-[#FEFCE8] border border-[#FDE047] text-center space-y-2.5">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-black text-[#31102A]">
                    <QrCode size={16} className="text-[#9F1239]" />
                    <span>Scan Shop UPI QR Code to Pay:</span>
                  </div>
                  <div className="inline-block p-2 bg-white rounded-2xl border-2 border-[#FDE047] shadow-sm">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=nikhilkimasti2409@okaxis&pn=Joshi%20Mangodi%20Udyog&am=${grandTotal}&cu=INR`)}`}
                      alt="UPI QR Code"
                      className="w-32 h-32 mx-auto rounded-lg"
                    />
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-900 bg-emerald-50 py-1.5 px-3 rounded-xl border border-emerald-200">
                    UPI ID: <strong>nikhilkimasti2409@okaxis</strong>
                  </div>
                  <div className="text-[11px] text-[#632055]">
                    Amount: <strong className="text-[#9F1239] font-black">₹{grandTotal}</strong> · Auto verified at counter
                  </div>
                </div>
              )}

              {paymentMode === 'Credit' && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold space-y-1">
                  {activeCustomer ? (
                    <>
                      <div className="font-bold text-red-950">Khata Due Credit Account</div>
                      <div>₹{grandTotal} will be added to <strong>{activeCustomer.name}</strong>'s outstanding balance.</div>
                    </>
                  ) : (
                    <div className="text-red-900 font-black">
                      ⚠️ Customer selection required to record credit / Khata bill!
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="e.g. Special packaging requested"
                  className="jm-input !text-xs"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="jm-btn-secondary flex-1"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={paymentMode === 'Credit' && !activeCustomer}
                  className="jm-btn-primary flex-1 !font-black !text-base shadow-md"
                >
                  Save Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Bill Confirmation Modal */}
      {voidModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border-2 border-red-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-red-100 pb-3">
              <div className="font-black text-lg text-red-950">Void & Restock Bill</div>
              <button onClick={() => setVoidModalOrder(null)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <div className="text-xs text-[#632055] space-y-1">
              <div>Are you sure you want to void Bill <strong className="text-[#31102A]">{voidModalOrder.billNo}</strong>?</div>
              <div>Amount: <strong className="text-red-700 font-bold">₹{voidModalOrder.grandTotalInr}</strong> · Customer: <strong>{voidModalOrder.customerName}</strong></div>
              <div className="text-[11px] text-gray-500 pt-1">All {voidModalOrder.items.length} items will be automatically returned to stock.</div>
            </div>

            <form onSubmit={handleVoidSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Reason for Cancellation *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Customer cancelled order / Billing mistake"
                  className="jm-input !text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidModalOrder(null)}
                  className="jm-btn-secondary flex-1 !text-xs"
                >
                  Keep Bill
                </button>
                <button
                  type="submit"
                  className="jm-btn-primary flex-1 !text-xs !bg-red-700 hover:!bg-red-800 !text-white !border-red-800 !font-black"
                >
                  Confirm Void
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Thermal Receipt Modal */}
      {isReceiptModalOpen && completedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border-2 border-[#FCE7F3] shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#FCE7F3] no-print">
              <div className="flex items-center gap-2 text-emerald-700 font-black text-sm">
                <CheckCircle2 size={20} />
                <span>Bill Generated Successfully!</span>
              </div>
              <button onClick={() => setIsReceiptModalOpen(false)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            {/* Thermal Print Slip with ID for Clean Browser Printing */}
            <div
              id="printable-receipt"
              className="receipt-thermal bg-white border border-gray-200 rounded-2xl p-5 font-mono text-xs text-black shadow-inner space-y-2.5"
            >
              <div className="text-center pb-2.5 border-b border-dashed border-gray-400">
                <h2 className="font-extrabold text-base tracking-wider text-black">JOSHI MANGODI UDYOG</h2>
                <p className="text-[11px] font-medium text-gray-700">Pure Handmade Moong Dal Mangodi</p>
                <p className="text-[10px] text-gray-600">Near Head Post Office, Fatehpur, Sikar (Raj.)</p>
                <p className="text-[10px] text-gray-600">Mob: +91 98290 12345 | GSTIN: 08AABFJ1234F1Z5</p>
                <p className="text-[11px] font-black mt-1.5 uppercase tracking-wide">*** TAX INVOICE ***</p>
              </div>

              <div className="py-2 border-b border-dashed border-gray-400 text-[11px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Bill No: <strong>{completedOrder.billNo}</strong></span>
                  <span>{completedOrder.date}</span>
                </div>
                <div>Customer: <strong>{completedOrder.customerName}</strong></div>
                {completedOrder.customerPhone && <div>Phone: +91 {completedOrder.customerPhone}</div>}
                {completedOrder.customerGstin && <div>GSTIN: {completedOrder.customerGstin}</div>}
              </div>

              <div className="py-2 border-b border-dashed border-gray-400">
                <div className="flex justify-between font-bold pb-1 text-[10px] uppercase text-gray-700">
                  <span>Item</span>
                  <span>Qty x Rate</span>
                  <span className="text-right">Amt</span>
                </div>
                {completedOrder.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between py-0.5 text-[11px]">
                    <span className="truncate max-w-[130px] font-medium">{it.skuName}</span>
                    <span>{it.quantity} x ₹{it.unitPriceInr}</span>
                    <span className="font-bold text-right">₹{it.totalInr}</span>
                  </div>
                ))}
              </div>

              <div className="py-2 border-b border-dashed border-gray-400 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{completedOrder.subtotalInr}</span>
                </div>
                {completedOrder.discountInr > 0 && (
                  <div className="flex justify-between text-emerald-800">
                    <span>Discount:</span>
                    <span>-₹{completedOrder.discountInr}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GST (Included):</span>
                  <span>₹{completedOrder.gstAmountInr}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm pt-1.5 border-t border-gray-300">
                  <span>GRAND TOTAL:</span>
                  <span>₹{completedOrder.grandTotalInr}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Paid ({completedOrder.paymentMethod}):</span>
                  <span>₹{completedOrder.amountPaidInr}</span>
                </div>
                {completedOrder.changeDueInr > 0 && (
                  <div className="flex justify-between text-[11px] font-bold text-emerald-900">
                    <span>Change Returned:</span>
                    <span>₹{completedOrder.changeDueInr}</span>
                  </div>
                )}
                {completedOrder.creditAddedInr > 0 && (
                  <div className="flex justify-between text-[11px] font-black text-red-800">
                    <span>Balance Due on Khata:</span>
                    <span>₹{completedOrder.creditAddedInr}</span>
                  </div>
                )}
              </div>

              {/* Dynamic UPI QR Code on Printed Receipt if Balance is Due */}
              {completedOrder.creditAddedInr > 0 && (
                <div className="py-2.5 border-b border-dashed border-gray-400 text-center space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-800">
                    Scan to Pay Due Balance (₹{completedOrder.creditAddedInr}):
                  </p>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`upi://pay?pa=nikhilkimasti2409@okaxis&pn=Joshi%20Mangodi%20Udyog&am=${completedOrder.creditAddedInr}&cu=INR`)}`}
                    alt="UPI Due QR Code"
                    className="w-24 h-24 mx-auto border p-1 bg-white"
                  />
                  <p className="text-[9px] font-mono text-gray-700">UPI ID: nikhilkimasti2409@okaxis</p>
                </div>
              )}

              <div className="text-center pt-2 text-[10px] text-gray-600">
                <p className="font-bold">Thank you for your visit!</p>
                <p>Traditional Handmade Taste of Rajasthan</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2 no-print">
              <button
                onClick={() => window.print()}
                className="jm-btn-secondary flex-1 !text-xs !py-3 flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Printer size={16} /> Print Receipt
              </button>
              <a
                href={generateWhatsAppLink(completedOrder)}
                target="_blank"
                rel="noreferrer"
                className="jm-btn-primary flex-1 !text-xs !py-3 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white !border-emerald-700 shadow-md"
              >
                <Share2 size={16} /> Send WhatsApp
              </a>
            </div>

            <button
              onClick={() => setIsReceiptModalOpen(false)}
              className="w-full py-3 rounded-2xl bg-[#31102A] text-white text-xs font-black hover:bg-black cursor-pointer no-print transition shadow-sm"
            >
              Start Next Bill
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
