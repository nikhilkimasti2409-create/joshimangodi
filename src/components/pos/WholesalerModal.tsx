import { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Check,
  Package,
  Clock,
  Send,
  Printer,
  ChevronRight,
  ArrowLeft,
  X,
  AlertCircle,
  Truck,
  IndianRupee,
  Phone,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import Modal from '../common/Modal';
import { useAppState, store } from '../../lib/store';
import { round2 } from '../../lib/domain/precision';
import { showToast } from '../common/Toast';
import type { Customer, ProductSKU, PaymentMethod, Order } from '../../types';

interface WholesalerModalProps {
  open: boolean;
  onClose: () => void;
  onOrderCompleted?: (order: Order) => void;
}

export default function WholesalerModal({ open, onClose, onOrderCompleted }: WholesalerModalProps) {
  const { customers, products } = useAppState();

  // Navigation steps: 1 = Wholesaler Selection/Creation, 2 = Order Requirements, 3 = Confirmation & WhatsApp
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeTab, setActiveTab] = useState<'select' | 'add'>('select');
  const [wholesalerSearch, setWholesalerSearch] = useState('');

  // Selected or newly created wholesaler
  const [selectedWholesaler, setSelectedWholesaler] = useState<Customer | null>(null);

  // New Wholesaler Form State (Name, Phone, Address are mandatory)
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newRatePerKg, setNewRatePerKg] = useState('170');
  const [newGstin, setNewGstin] = useState('');
  const [formError, setFormError] = useState('');

  // Editing Wholesaler State
  const [editingWholesalerId, setEditingWholesalerId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editRatePerKg, setEditRatePerKg] = useState('170');

  // Step 2: Order Requirements State
  // Map of skuId -> quantity
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  // Overridable custom rate per kg for this specific order
  const [orderRatePerKg, setOrderRatePerKg] = useState<number>(170);
  const [deliveryTimeframe, setDeliveryTimeframe] = useState('Within 24 Hours');
  const [customDeliveryTime, setCustomDeliveryTime] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMethod>('Credit');
  const [amountPaid, setAmountPaid] = useState<string>('0');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderStepError, setOrderStepError] = useState('');

  // Step 3: Resulting Order
  const [recordedOrder, setRecordedOrder] = useState<Order | null>(null);
  const [whatsappSent, setWhatsappSent] = useState(false);

  // Filter saved wholesalers (customerType === 'wholesale' or has contractPricePerKg)
  const savedWholesalers = useMemo(() => {
    return customers.filter(
      (c) => c.customerType === 'wholesale' || (c.contractPricePerKg && c.contractPricePerKg > 0)
    );
  }, [customers]);

  const filteredWholesalers = useMemo(() => {
    const q = wholesalerSearch.trim().toLowerCase();
    if (!q) return savedWholesalers;
    return savedWholesalers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.phone && w.phone.includes(q)) ||
        (w.address && w.address.toLowerCase().includes(q)) ||
        (w.area && w.area.toLowerCase().includes(q))
    );
  }, [savedWholesalers, wholesalerSearch]);

  // CRITICAL REQUIREMENT:
  // "Crucially, it should only display the *mangodi* varieties currently in my inventory."
  const inStockMangodiProducts = useMemo(() => {
    return products.filter((p) => {
      const isMangodi =
        p.category === 'PLAIN_MANGODI' ||
        p.category === 'MASALA_MANGODI' ||
        p.category === 'SPECIALTY' ||
        p.name.toLowerCase().includes('mangodi');
      const inStock = Number(p.currentStockUnits) > 0;
      return isMangodi && inStock;
    });
  }, [products]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setActiveTab(savedWholesalers.length > 0 ? 'select' : 'add');
      setWholesalerSearch('');
      setSelectedWholesaler(null);
      setSelectedItems({});
      setFormError('');
      setOrderStepError('');
      setRecordedOrder(null);
      setWhatsappSent(false);
      setDeliveryTimeframe('Within 24 Hours');
      setCustomDeliveryTime('');
    }
  }, [open, savedWholesalers.length]);

  // When wholesaler is chosen, sync their custom rate
  const handleSelectWholesaler = (wholesaler: Customer) => {
    setSelectedWholesaler(wholesaler);
    const rate = Number(wholesaler.contractPricePerKg) || 170;
    setOrderRatePerKg(rate);
    setSelectedItems({});
    setOrderStepError('');
    setStep(2);
  };

  // Start editing a wholesaler
  const handleStartEdit = (wholesaler: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWholesalerId(wholesaler.id);
    setEditName(wholesaler.name);
    setEditPhone(wholesaler.phone);
    setEditAddress(wholesaler.address || wholesaler.area || '');
    setEditRatePerKg(String(wholesaler.contractPricePerKg || 170));
  };

  // Save edited wholesaler
  const handleSaveEdit = (wholesalerId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editPhone.trim() || !editAddress.trim()) {
      showToast('Name, phone, and address are mandatory.', 'error');
      return;
    }
    const rateNum = Math.max(1, Number(editRatePerKg) || 170);
    store.updateCustomer(wholesalerId, {
      name: editName.trim(),
      phone: editPhone.trim(),
      address: editAddress.trim(),
      area: editAddress.trim().split(',')[0] || editAddress.trim(),
      contractPricePerKg: rateNum,
    });
    setEditingWholesalerId(null);
    showToast('Wholesaler details updated successfully!', 'success');
  };

  // Add new wholesaler with strict mandatory validation
  const handleAddNewWholesaler = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newName.trim()) {
      setFormError('Wholesaler Name is mandatory.');
      return;
    }
    if (!newPhone.trim()) {
      setFormError('Phone Number is mandatory.');
      return;
    }
    if (!newAddress.trim()) {
      setFormError('Address / Location is mandatory.');
      return;
    }

    const rateNum = Math.max(1, Number(newRatePerKg) || 170);

    const newWholesaler = store.addCustomer({
      name: newName.trim(),
      phone: newPhone.trim(),
      address: newAddress.trim(),
      area: newArea.trim() || newAddress.trim().split(',')[0],
      customerType: 'wholesale',
      gstin: newGstin.trim() || undefined,
      contractPricePerKg: rateNum,
      creditLimitInr: 50000,
    });

    showToast(`Wholesaler "${newWholesaler.name}" registered!`, 'success');
    setSelectedWholesaler(newWholesaler);
    setOrderRatePerKg(rateNum);
    setSelectedItems({});
    setStep(2);
  };

  // Calculate item unit price based on wholesaler's rate per kg
  const calculateItemUnitPrice = (sku: ProductSKU, ratePerKg: number): number => {
    const packetGrams = Number(sku.packetSizeGrams) || 1000;
    return round2((ratePerKg * packetGrams) / 1000);
  };

  // Update item quantity in step 2
  const handleItemQtyChange = (skuId: string, qty: number, maxStock: number) => {
    const clamped = Math.max(0, Math.min(maxStock, qty));
    setSelectedItems((prev) => {
      const copy = { ...prev };
      if (clamped <= 0) {
        delete copy[skuId];
      } else {
        copy[skuId] = clamped;
      }
      return copy;
    });
  };

  // Computed Order Totals
  const orderCalculations = useMemo(() => {
    let totalPackets = 0;
    let totalWeightKg = 0;
    let subtotalInr = 0;

    const items: Array<{
      sku: ProductSKU;
      quantity: number;
      unitPriceInr: number;
      totalInr: number;
    }> = [];

    for (const [skuId, qty] of Object.entries(selectedItems)) {
      if (qty <= 0) continue;
      const sku = products.find((p) => p.id === skuId);
      if (!sku) continue;

      const unitPrice = calculateItemUnitPrice(sku, orderRatePerKg);
      const lineTotal = round2(unitPrice * qty);
      const packetKg = (Number(sku.packetSizeGrams) || 1000) / 1000;

      totalPackets += qty;
      totalWeightKg += packetKg * qty;
      subtotalInr += lineTotal;

      items.push({
        sku,
        quantity: qty,
        unitPriceInr: unitPrice,
        totalInr: lineTotal,
      });
    }

    const gstAmountInr = round2((subtotalInr * 5) / 105); // Mangodi standard 5% inclusive GST
    const grandTotalInr = subtotalInr;

    return {
      items,
      totalPackets,
      totalWeightKg: round2(totalWeightKg),
      subtotalInr: round2(subtotalInr),
      gstAmountInr,
      grandTotalInr,
    };
  }, [selectedItems, products, orderRatePerKg]);

  const effectiveDeliveryTimeframe = useMemo(() => {
    if (deliveryTimeframe === 'CUSTOM') {
      return customDeliveryTime.trim() || 'Prompt Dispatch';
    }
    return deliveryTimeframe;
  }, [deliveryTimeframe, customDeliveryTime]);

  // Construct Professional WhatsApp Message
  const constructWhatsAppMessage = (order: Order, wholesaler: Customer, timeframe: string) => {
    const itemsList = order.items
      .map(
        (i, idx) =>
          `${idx + 1}. *${i.skuName}*%0A   Qty: ${i.quantity} pkts (${round2(
            (i.quantity * i.packetSizeGrams) / 1000
          )} kg) @ ₹${i.unitPriceInr} = *₹${i.totalInr}*`
      )
      .join('%0A');

    const cleanAddress = wholesaler.address || wholesaler.area || 'As registered';

    let msg =
      `*JOSHI MANGODI UDYOG*%0A` +
      `*Pure Handmade Moong Dal Mangodi*%0A` +
      `Near Head Post Office, Fatehpur, Sikar (Raj.)%0A` +
      `Mob: +91 98290 12345 | GSTIN: 08AABFJ1234F1Z5%0A` +
      `----------------------------------------%0A` +
      `*WHOLESALE TAX INVOICE*%0A` +
      `*Bill No:* ${order.billNo}%0A` +
      `*Date:* ${order.date}%0A` +
      `*Wholesaler:* ${wholesaler.name}%0A` +
      `*Phone:* ${wholesaler.phone}%0A` +
      `*Delivery Address:* ${cleanAddress}%0A` +
      `🚚 *DELIVERY TIMEFRAME:* *${timeframe}*%0A` +
      `----------------------------------------%0A` +
      `*ORDERED VARIETIES:*%0A${itemsList}%0A` +
      `----------------------------------------%0A` +
      `*Total Packets:* ${order.items.reduce((s, it) => s + it.quantity, 0)} pkts%0A` +
      `*Total Weight:* ${round2(
        order.items.reduce((s, it) => s + (it.quantity * it.packetSizeGrams) / 1000, 0)
      )} kg%0A` +
      `*Agreed Rate:* ₹${orderRatePerKg}/kg%0A` +
      `*Subtotal:* ₹${order.subtotalInr}%0A` +
      `*GST (5% Included):* ₹${order.gstAmountInr}%0A` +
      `*GRAND TOTAL:* *₹${order.grandTotalInr}*%0A` +
      `*Payment Mode:* ${order.paymentMethod}%0A` +
      `*Amount Paid:* ₹${order.amountPaidInr}%0A`;

    if (order.creditAddedInr > 0) {
      msg +=
        `*Khata / Balance Due:* *₹${order.creditAddedInr}*%0A` +
        `----------------------------------------%0A` +
        `*Pay Due Online via UPI:*%0A` +
        `UPI ID: *nikhilkimasti2409@okaxis*%0A`;
    }

    msg +=
      `----------------------------------------%0A` +
      `Thank you for your valuable order! We are preparing fresh batch packaging for dispatch.%0A` +
      `For any questions, reach us at +91 98290 12345.`;

    const cleanPhone = `91${wholesaler.phone.replace(/[^\d]/g, '').slice(-10)}`;
    return `https://wa.me/${cleanPhone}?text=${msg}`;
  };

  // Submit Order & Dispatch WhatsApp
  const handleRecordOrder = () => {
    setOrderStepError('');

    if (!selectedWholesaler) {
      setOrderStepError('Please select or add a wholesaler first.');
      return;
    }

    if (orderCalculations.items.length === 0) {
      setOrderStepError('Please select at least one mangodi variety to place the order.');
      return;
    }

    if (!effectiveDeliveryTimeframe.trim()) {
      setOrderStepError('Please specify the delivery timeframe.');
      return;
    }

    const paidNum = Math.max(0, Number(amountPaid) || 0);

    // Record order in store
    const newOrder = store.createWholesaleOrder({
      wholesaler: selectedWholesaler,
      items: orderCalculations.items.map((it) => ({
        sku: it.sku,
        quantity: it.quantity,
        unitPriceInr: it.unitPriceInr,
      })),
      deliveryTimeframe: effectiveDeliveryTimeframe,
      paymentMethod: paymentMode,
      amountPaidInr: paidNum,
      notes: orderNotes.trim() || undefined,
    });

    // Update active wholesaler in store so POS reflects them
    store.setActiveCustomer(selectedWholesaler);
    store.setChannel('WHOLESALE_T1');

    setRecordedOrder(newOrder);
    setStep(3);

    // Automatically trigger WhatsApp link
    const waUrl = constructWhatsAppMessage(newOrder, selectedWholesaler, effectiveDeliveryTimeframe);
    try {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      setWhatsappSent(true);
    } catch {
      setWhatsappSent(false);
    }

    showToast(`Wholesale Order #${newOrder.billNo} recorded successfully!`, 'success');
    if (onOrderCompleted) {
      onOrderCompleted(newOrder);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-ink">
          <Truck className="text-primary" size={22} />
          <span className="font-bold text-base sm:text-lg">
            {step === 1 && 'Wholesaler Order · Select or Add Wholesaler'}
            {step === 2 && `Order Requirements · ${selectedWholesaler?.name}`}
            {step === 3 && 'Order Recorded & WhatsApp Bill Sent'}
          </span>
        </div>
      }
      size={step === 2 ? 'xl' : 'lg'}
      id="wholesaler-modal"
    >
      <div className="space-y-5">
        {/* STEP 1: Select or Add Wholesaler */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Tabs Header */}
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setActiveTab('select')}
                className={`flex-1 py-2.5 text-sm font-semibold border-b-2 text-center transition cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'select'
                    ? 'border-primary text-primary bg-primary-soft/10'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                <Users size={16} />
                <span>Select Saved Wholesaler ({savedWholesalers.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('add')}
                className={`flex-1 py-2.5 text-sm font-semibold border-b-2 text-center transition cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'add'
                    ? 'border-primary text-primary bg-primary-soft/10'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                <Plus size={16} />
                <span>Add New Wholesaler</span>
              </button>
            </div>

            {/* TAB A: Select Saved Wholesaler */}
            {activeTab === 'select' && (
              <div className="space-y-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
                  <input
                    type="text"
                    placeholder="Search saved wholesalers by name, phone, or address..."
                    value={wholesalerSearch}
                    onChange={(e) => setWholesalerSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-ink placeholder:text-ink-muted"
                    autoFocus
                  />
                  {wholesalerSearch && (
                    <button
                      onClick={() => setWholesalerSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink text-xs p-1"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Wholesalers List */}
                <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 divide-y divide-border">
                  {filteredWholesalers.length === 0 ? (
                    <div className="text-center py-8 px-4 bg-surface rounded-lg border border-dashed border-border">
                      <Users className="mx-auto text-ink-muted mb-2" size={32} />
                      <div className="text-sm font-semibold text-ink">No wholesalers found</div>
                      <p className="text-xs text-ink-muted mt-1">
                        {wholesalerSearch
                          ? 'No results match your search.'
                          : 'No wholesalers saved yet. Add a new wholesaler with custom pricing to begin.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('add')}
                        className="mt-3 jm-btn-primary text-xs py-1.5 px-3"
                      >
                        + Add Wholesaler Now
                      </button>
                    </div>
                  ) : (
                    filteredWholesalers.map((w) => {
                      const isEditing = editingWholesalerId === w.id;

                      if (isEditing) {
                        return (
                          <form
                            key={w.id}
                            onSubmit={(e) => handleSaveEdit(w.id, e)}
                            className="p-3 bg-surface rounded-lg border border-primary/40 space-y-2.5 my-1"
                          >
                            <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                              <Edit2 size={13} /> Edit Wholesaler Details
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="block text-[11px] font-semibold text-ink-muted mb-0.5">Name *</label>
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-card border border-border rounded text-ink"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-ink-muted mb-0.5">Phone *</label>
                                <input
                                  type="text"
                                  value={editPhone}
                                  onChange={(e) => setEditPhone(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-card border border-border rounded text-ink"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-ink-muted mb-0.5">Address *</label>
                                <input
                                  type="text"
                                  value={editAddress}
                                  onChange={(e) => setEditAddress(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-card border border-border rounded text-ink"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-ink-muted mb-0.5">Rate (₹/kg) *</label>
                                <input
                                  type="number"
                                  value={editRatePerKg}
                                  onChange={(e) => setEditRatePerKg(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-card border border-border rounded text-ink font-semibold"
                                  required
                                  min="1"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingWholesalerId(null)}
                                className="px-2.5 py-1 text-xs border border-border rounded text-ink-muted hover:text-ink cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-3 py-1 text-xs bg-primary text-white font-semibold rounded hover:bg-primary-soft hover:text-primary cursor-pointer transition"
                              >
                                Save Changes
                              </button>
                            </div>
                          </form>
                        );
                      }

                      return (
                        <div
                          key={w.id}
                          className="pt-2 pb-2 px-3 hover:bg-surface rounded-lg flex items-center justify-between transition cursor-pointer group"
                          onClick={() => handleSelectWholesaler(w)}
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-ink truncate">{w.name}</span>
                              <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                                ₹{w.contractPricePerKg || 170}/kg
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-ink-muted font-mono mt-0.5">
                              <span className="flex items-center gap-1">
                                <Phone size={11} /> {w.phone}
                              </span>
                              {(w.address || w.area) && (
                                <span className="flex items-center gap-1 truncate max-w-[180px]">
                                  <MapPin size={11} /> {w.address || w.area}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-ink-muted mt-1 flex items-center gap-2">
                              <span>Orders: <strong>{w.totalOrdersCount || 0}</strong></span>
                              {w.totalOutstandingInr > 0 && (
                                <span className="text-danger font-semibold">
                                  Due: ₹{w.totalOutstandingInr}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleStartEdit(w, e)}
                              title="Edit wholesaler details"
                              className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-card border border-transparent hover:border-border transition cursor-pointer"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectWholesaler(w)}
                              className="jm-btn-primary text-xs py-1.5 px-3 flex items-center gap-1 group-hover:scale-105 transition"
                            >
                              <span>Take Order</span>
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB B: Add New Wholesaler Form */}
            {activeTab === 'add' && (
              <form onSubmit={handleAddNewWholesaler} className="space-y-4 pt-1">
                {formError && (
                  <div className="p-3 bg-danger-soft/30 border border-danger/30 rounded-lg text-danger text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={15} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name (Mandatory) */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-ink mb-1">
                      Wholesaler / Business Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mittal Kirana Store / Ramesh Wholesaler"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      required
                      autoFocus
                    />
                  </div>

                  {/* Phone (Mandatory) */}
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">
                      WhatsApp Phone Number <span className="text-danger">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted font-mono">
                        +91
                      </span>
                      <input
                        type="tel"
                        placeholder="9829012345"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        className="w-full pl-11 pr-3 py-2 text-sm bg-surface border border-border rounded-lg text-ink font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        required
                      />
                    </div>
                  </div>

                  {/* Custom Rate per kg (Mandatory) */}
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1 flex items-center justify-between">
                      <span>Custom Rate (₹/kg) <span className="text-danger">*</span></span>
                      <span className="text-[10px] font-normal text-ink-muted">Tailored per wholesaler</span>
                    </label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={15} />
                      <input
                        type="number"
                        placeholder="170"
                        value={newRatePerKg}
                        onChange={(e) => setNewRatePerKg(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-border rounded-lg text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        required
                        min="1"
                      />
                    </div>
                  </div>

                  {/* Address (Mandatory) */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-ink mb-1">
                      Delivery Address / Location <span className="text-danger">*</span>
                    </label>
                    <textarea
                      placeholder="e.g. Shop #14, Main Mandi Bazar, Nawalgarh Road, Sikar"
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                      required
                    />
                  </div>

                  {/* Optional Area / City */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">
                      City / Area (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sikar, Fatehpur, Jaipur"
                      value={newArea}
                      onChange={(e) => setNewArea(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-ink"
                    />
                  </div>

                  {/* Optional GSTIN */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">
                      GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 08AABFJ1234F1Z5"
                      value={newGstin}
                      onChange={(e) => setNewGstin(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-ink font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="jm-btn-primary flex items-center justify-center gap-2 py-2.5 px-6 cursor-pointer font-bold"
                  >
                    <span>Save Wholesaler & Proceed to Order</span>
                    <ChevronRight size={17} />
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* STEP 2: Order Requirements (Mangodi Varieties In Inventory) */}
        {step === 2 && selectedWholesaler && (
          <div className="space-y-4">
            {/* Wholesaler Context Banner */}
            <div className="bg-primary-soft/20 border border-primary/20 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="p-1.5 rounded-lg bg-card border border-border hover:bg-surface text-ink cursor-pointer transition"
                  title="Change wholesaler"
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-ink">{selectedWholesaler.name}</span>
                    <span className="text-xs text-ink-muted font-mono">{selectedWholesaler.phone}</span>
                  </div>
                  <div className="text-xs text-ink-muted truncate max-w-[320px]">
                    {selectedWholesaler.address || selectedWholesaler.area || 'Direct wholesale dispatch'}
                  </div>
                </div>
              </div>

              {/* Dynamic Rate per kg setter for this order */}
              <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-lg border border-border">
                <span className="text-xs font-medium text-ink-muted">Wholesale Rate:</span>
                <div className="flex items-center font-bold text-sm text-primary">
                  <span>₹</span>
                  <input
                    type="number"
                    value={orderRatePerKg}
                    onChange={(e) => setOrderRatePerKg(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 px-1 py-0.5 text-right font-bold text-primary bg-transparent focus:outline-none focus:ring-1 focus:ring-primary rounded"
                    title="Edit wholesale rate per kg for this order"
                  />
                  <span className="text-xs font-normal text-ink-muted ml-0.5">/kg</span>
                </div>
              </div>
            </div>

            {orderStepError && (
              <div className="p-3 bg-danger-soft/30 border border-danger/30 rounded-lg text-danger text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{orderStepError}</span>
              </div>
            )}

            {/* Inventory Mangodi Varieties Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Select Mangodi Varieties Currently In Inventory ({inStockMangodiProducts.length} available)
                </div>
                <div className="text-xs text-ink-muted">
                  Showing in-stock items only
                </div>
              </div>

              {inStockMangodiProducts.length === 0 ? (
                <div className="text-center py-8 bg-surface rounded-xl border border-dashed border-border p-4">
                  <Package className="mx-auto text-ink-muted mb-2" size={32} />
                  <div className="font-bold text-sm text-ink">No Mangodi varieties currently in stock</div>
                  <p className="text-xs text-ink-muted mt-1">
                    Please log a production batch or restock mangodi inventory before taking wholesale orders.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[42vh] overflow-y-auto pr-1">
                  {inStockMangodiProducts.map((p) => {
                    const unitPrice = calculateItemUnitPrice(p, orderRatePerKg);
                    const qty = selectedItems[p.id] || 0;
                    const maxStock = p.currentStockUnits;
                    const packetKg = (Number(p.packetSizeGrams) || 1000) / 1000;

                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                          qty > 0
                            ? 'border-primary bg-primary-soft/10 ring-1 ring-primary'
                            : 'border-border bg-card hover:border-ink-muted'
                        }`}
                      >
                        {/* Product Image & Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={p.image || '/assets/sadi mangodi.jpeg'}
                            alt={p.name}
                            className="w-12 h-12 rounded-lg object-cover border border-border shrink-0 bg-surface"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/assets/brand logo.png';
                            }}
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-xs sm:text-sm text-ink truncate">{p.name}</div>
                            {p.nameHindi && (
                              <div className="text-[11px] text-ink-muted truncate">{p.nameHindi}</div>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-bold text-primary">₹{unitPrice} / pkt</span>
                              <span className="text-[10px] text-ink-muted font-mono">
                                Stock: {maxStock} pkts ({round2(maxStock * packetKg)} kg)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleItemQtyChange(p.id, qty - 1, maxStock)}
                              disabled={qty <= 0}
                              className="w-7 h-7 flex items-center justify-center rounded text-sm font-bold text-ink hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={maxStock}
                              value={qty || ''}
                              placeholder="0"
                              onChange={(e) =>
                                handleItemQtyChange(p.id, Number(e.target.value) || 0, maxStock)
                              }
                              className="w-12 text-center text-xs font-bold text-ink bg-transparent focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleItemQtyChange(p.id, qty + 1, maxStock)}
                              disabled={qty >= maxStock}
                              className="w-7 h-7 flex items-center justify-center rounded text-sm font-bold text-ink hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          {/* Quick buttons */}
                          <div className="flex gap-1">
                            {[5, 10, 20].map((stepVal) => (
                              <button
                                key={stepVal}
                                type="button"
                                onClick={() => handleItemQtyChange(p.id, qty + stepVal, maxStock)}
                                disabled={qty + stepVal > maxStock}
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface hover:bg-card border border-border text-ink-muted hover:text-ink disabled:opacity-20 cursor-pointer"
                              >
                                +{stepVal}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Delivery Timeframe & Payment Terms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border">
              {/* Delivery Timeframe */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink flex items-center gap-1.5">
                  <Clock size={14} className="text-primary" />
                  <span>Delivery Timeframe <span className="text-danger">*</span></span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['Within 24 Hours', 'Same Day Delivery', 'Tomorrow Morning', 'Within 2-3 Days'].map(
                    (opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setDeliveryTimeframe(opt);
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition cursor-pointer ${
                          deliveryTimeframe === opt
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-card text-ink-muted border-border hover:text-ink'
                        }`}
                      >
                        {opt}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => setDeliveryTimeframe('CUSTOM')}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition cursor-pointer ${
                      deliveryTimeframe === 'CUSTOM'
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-card text-ink-muted border-border hover:text-ink'
                    }`}
                  >
                    Custom Time
                  </button>
                </div>
                {deliveryTimeframe === 'CUSTOM' && (
                  <input
                    type="text"
                    placeholder="e.g. By Friday 4 PM / Dispatch with Truck #RJ-23"
                    value={customDeliveryTime}
                    onChange={(e) => setCustomDeliveryTime(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-ink mt-1"
                    autoFocus
                  />
                )}
              </div>

              {/* Payment Mode & Advance */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink flex items-center justify-between">
                  <span>Payment Terms</span>
                  <span className="text-[10px] text-ink-muted">Cash / UPI / Khata</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Credit', 'UPI', 'Cash'] as PaymentMethod[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setPaymentMode(mode);
                        if (mode === 'Credit') setAmountPaid('0');
                        else setAmountPaid(String(orderCalculations.grandTotalInr));
                      }}
                      className={`py-1 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer text-center ${
                        paymentMode === mode
                          ? 'bg-primary text-white border-primary'
                          : 'bg-card text-ink-muted border-border'
                      }`}
                    >
                      {mode === 'Credit' ? 'Khata (Udhar)' : mode}
                    </button>
                  ))}
                </div>
                {paymentMode !== 'Credit' && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-xs text-ink-muted">Amount Paid:</span>
                    <input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="w-28 px-2 py-1 text-xs bg-surface border border-border rounded text-ink font-semibold"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Order Financial Summary Bar */}
            <div className="bg-surface rounded-xl p-3.5 border border-border flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <div className="text-ink-muted">Total Packets</div>
                  <div className="font-bold text-base text-ink">{orderCalculations.totalPackets}</div>
                </div>
                <div className="border-l border-border pl-4">
                  <div className="text-ink-muted">Total Weight</div>
                  <div className="font-bold text-base text-ink">{orderCalculations.totalWeightKg} kg</div>
                </div>
                <div className="border-l border-border pl-4">
                  <div className="text-ink-muted">Subtotal</div>
                  <div className="font-bold text-base text-ink">₹{orderCalculations.subtotalInr}</div>
                </div>
                <div className="border-l border-border pl-4">
                  <div className="text-ink-muted">Grand Total</div>
                  <div className="font-bold text-base text-primary">₹{orderCalculations.grandTotalInr}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRecordOrder}
                disabled={orderCalculations.items.length === 0}
                className="jm-btn-primary w-full sm:w-auto py-2.5 px-6 font-bold flex items-center justify-center gap-2 text-sm !bg-success hover:!bg-success-soft hover:!text-success !text-white !border-success disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md transition"
              >
                <Send size={16} />
                <span>Confirm Order & Send WhatsApp Bill</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Order Recorded & WhatsApp Confirmation */}
        {step === 3 && recordedOrder && selectedWholesaler && (
          <div className="space-y-5 text-center py-2">
            <div className="w-14 h-14 bg-success/15 text-success rounded-full flex items-center justify-center mx-auto ring-8 ring-success/5">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h3 className="font-bold text-lg text-ink">Wholesale Order Recorded Successfully!</h3>
              <p className="text-xs text-ink-muted mt-1">
                Bill No: <strong>{recordedOrder.billNo}</strong> · Wholesaler: <strong>{selectedWholesaler.name}</strong>
              </p>
              <p className="text-xs text-primary font-semibold mt-0.5">
                🚚 Delivery Scheduled: {effectiveDeliveryTimeframe}
              </p>
            </div>

            {/* Bill Summary Details */}
            <div className="bg-surface rounded-xl p-4 border border-border text-left font-mono text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between pb-2 border-b border-dashed border-border font-sans font-bold text-sm">
                <span>Total Amount:</span>
                <span className="text-success">₹{recordedOrder.grandTotalInr}</span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>Items Ordered:</span>
                <span>{recordedOrder.items.length} varieties</span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>Payment Mode:</span>
                <span>{recordedOrder.paymentMethod}</span>
              </div>
              {recordedOrder.creditAddedInr > 0 && (
                <div className="flex justify-between text-danger font-semibold">
                  <span>Khata Due:</span>
                  <span>₹{recordedOrder.creditAddedInr}</span>
                </div>
              )}
              <div className="flex justify-between text-ink-muted">
                <span>WhatsApp Notification:</span>
                <span className="text-success font-semibold">
                  {whatsappSent ? 'Opened in WhatsApp' : 'Ready to Send'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <a
                href={constructWhatsAppMessage(
                  recordedOrder,
                  selectedWholesaler,
                  effectiveDeliveryTimeframe
                )}
                target="_blank"
                rel="noreferrer"
                className="jm-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 !bg-success hover:!bg-success-soft hover:!text-success !text-white !border-success cursor-pointer"
              >
                <Send size={16} />
                <span>Send WhatsApp Bill Again</span>
              </a>

              <button
                type="button"
                onClick={() => window.print()}
                className="jm-btn-secondary flex-1 flex items-center justify-center gap-2 py-2.5 cursor-pointer"
              >
                <Printer size={16} />
                <span>Print Invoice</span>
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-ink-muted hover:text-ink cursor-pointer transition underline"
              >
                Done / Return to POS
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
