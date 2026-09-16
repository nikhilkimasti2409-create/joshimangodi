import { useState, useEffect } from 'react';
import type {
  ProductSKU,
  Customer,
  CustomerPayment,
  Order,
  OrderLineItem,
  CartItem,
  DalLot,
  Worker,
  ProductionBatch,
  RawMaterial,
  StockMovement,
  Expense,
  CashDrawerReconciliation,
  DispatchTicket,
  InboundShipment,
  SalesChannel,
  CashDenominations,
  BatchStatus,
} from '../types';

import {
  round2,
  resolveSKUPrice,
  calculateTaxBreakdown,
  calculateOrderFinancials,
  calculateBatchYieldMetrics,
  calculateLaborPayouts,
  calculateDynamicCOGS,
  calculateFinishedUnitCOGS,
  calculateBOMBackflushDeductions,
  runHoltWintersForecast,
  calculateMasterProductionSchedule,
  calculateDynamicSafetyStock,
  calculateEOQWithDiscounts,
  reconcileCashDrawer,
  calculateProfitAndLoss,
  generateTallySalesXml,
} from './domain';

import historicalOrdersData from './historicalOrders.json';
import realCustomersData from './realCustomers.json';

const STORAGE_KEY = 'joshi_mangodi_ops_state_v7';

// Real product catalog matching Joshi Mangodi fixed sales sheet (₹200/kg retail rate, ₹170/kg wholesale rate)
export const INITIAL_PRODUCTS: ProductSKU[] = [
  {
    id: 'sku-plain-lambi-250',
    name: 'Lambi Plain Moong Mangodi (250g)',
    nameHindi: 'लंबी सादी मूंग मंगोड़ी (250 ग्राम)',
    category: 'PLAIN_MANGODI',
    shape: 'LAMBI',
    packetSizeGrams: 250,
    barcode: '8906001230011',
    mrpInr: 60,
    retailPriceInr: 50,
    wholesaleT1PriceInr: 42.5,
    wholesaleT2PriceInr: 40.0,
    currentStockUnits: 65,
    reorderPointUnits: 20,
    unitCostInr: 32.5,
    image: '/assets/sadi mangodi.jpeg',
    gstRate: 5,
    hsnCode: '21069099',
  },
  {
    id: 'sku-plain-lambi-400',
    name: 'Lambi Plain Moong Mangodi (400g)',
    nameHindi: 'लंबी सादी मूंग मंगोड़ी (400 ग्राम)',
    category: 'PLAIN_MANGODI',
    shape: 'LAMBI',
    packetSizeGrams: 400,
    barcode: '8906001230018',
    mrpInr: 95,
    retailPriceInr: 80,
    wholesaleT1PriceInr: 68.0,
    wholesaleT2PriceInr: 65.0,
    currentStockUnits: 45,
    reorderPointUnits: 15,
    unitCostInr: 52.0,
    image: '/assets/sadi mangodi.jpeg',
    gstRate: 5,
    hsnCode: '21069099',
  },
  {
    id: 'sku-plain-lambi-500',
    name: 'Lambi Plain Moong Mangodi (500g)',
    nameHindi: 'लंबी सादी मूंग मंगोड़ी (500 ग्राम)',
    category: 'PLAIN_MANGODI',
    shape: 'LAMBI',
    packetSizeGrams: 500,
    barcode: '8906001230025',
    mrpInr: 120,
    retailPriceInr: 100,
    wholesaleT1PriceInr: 85.0,
    wholesaleT2PriceInr: 80.0,
    currentStockUnits: 90,
    reorderPointUnits: 30,
    unitCostInr: 65.0,
    image: '/assets/sadi mangodi.jpeg',
    gstRate: 5,
    hsnCode: '21069099',
  },
  {
    id: 'sku-plain-lambi-1000',
    name: 'Lambi Plain Moong Mangodi (1kg)',
    nameHindi: 'लंबी सादी मूंग मंगोड़ी (1 किग्रा)',
    category: 'PLAIN_MANGODI',
    shape: 'LAMBI',
    packetSizeGrams: 1000,
    barcode: '8906001230032',
    mrpInr: 230,
    retailPriceInr: 200,
    wholesaleT1PriceInr: 170.0,
    wholesaleT2PriceInr: 165.0,
    currentStockUnits: 60,
    reorderPointUnits: 20,
    unitCostInr: 130.0,
    image: '/assets/sadi mangodi.jpeg',
    gstRate: 5,
    hsnCode: '21069099',
  },
  {
    id: 'sku-plain-gol-250',
    name: 'Gol Plain Moong Mangodi (250g)',
    nameHindi: 'गोल सादी मूंग मंगोड़ी (250 ग्राम)',
    category: 'PLAIN_MANGODI',
    shape: 'GOL',
    packetSizeGrams: 250,
    barcode: '8906001230049',
    mrpInr: 60,
    retailPriceInr: 50,
    wholesaleT1PriceInr: 42.5,
    wholesaleT2PriceInr: 40.0,
    currentStockUnits: 50,
    reorderPointUnits: 15,
    unitCostInr: 32.5,
    image: '/assets/Gemini_Generated_Image_5bth1z5bth1z5bth-removebg-preview.png',
    gstRate: 5,
    hsnCode: '21069099',
  },
  {
    id: 'sku-plain-gol-400',
    name: 'Gol Plain Moong Mangodi (400g)',
    nameHindi: 'गोल सादी मूंग मंगोड़ी (400 ग्राम)',
    category: 'PLAIN_MANGODI',
    shape: 'GOL',
    packetSizeGrams: 400,
    barcode: '8906001230056',
    mrpInr: 95,
    retailPriceInr: 80,
    wholesaleT1PriceInr: 68.0,
    wholesaleT2PriceInr: 65.0,
    currentStockUnits: 40,
    reorderPointUnits: 15,
    unitCostInr: 52.0,
    image: '/assets/Gemini_Generated_Image_5bth1z5bth1z5bth-removebg-preview.png',
    gstRate: 5,
    hsnCode: '21069099',
  },
  {
    id: 'sku-plain-gol-500',
    name: 'Gol Plain Moong Mangodi (500g)',
    nameHindi: 'गोल सादी मूंग मंगोड़ी (500 ग्राम)',
    category: 'PLAIN_MANGODI',
    shape: 'GOL',
    packetSizeGrams: 500,
    barcode: '8906001230063',
    mrpInr: 120,
    retailPriceInr: 100,
    wholesaleT1PriceInr: 85.0,
    wholesaleT2PriceInr: 80.0,
    currentStockUnits: 75,
    reorderPointUnits: 25,
    unitCostInr: 65.0,
    image: '/assets/Gemini_Generated_Image_5bth1z5bth1z5bth-removebg-preview.png',
    gstRate: 5,
    hsnCode: '21069099',
  },
  {
    id: 'sku-plain-gol-1000',
    name: 'Gol Plain Moong Mangodi (1kg)',
    nameHindi: 'गोल सादी मूंग मंगोड़ी (1 किग्रा)',
    category: 'PLAIN_MANGODI',
    shape: 'GOL',
    packetSizeGrams: 1000,
    barcode: '8906001230070',
    mrpInr: 230,
    retailPriceInr: 200,
    wholesaleT1PriceInr: 170.0,
    wholesaleT2PriceInr: 165.0,
    currentStockUnits: 45,
    reorderPointUnits: 15,
    unitCostInr: 130.0,
    image: '/assets/Gemini_Generated_Image_5bth1z5bth1z5bth-removebg-preview.png',
    gstRate: 5,
    hsnCode: '21069099',
  },
  {
    id: 'sku-masala-lambi-250',
    name: 'Lambi Masala Moong Mangodi (250g)',
    nameHindi: 'लंबी मसाला मूंग मंगोड़ी (250 ग्राम)',
    category: 'MASALA_MANGODI',
    shape: 'LAMBI',
    packetSizeGrams: 250,
    barcode: '8906001230087',
    mrpInr: 65,
    retailPriceInr: 55,
    wholesaleT1PriceInr: 47.5,
    wholesaleT2PriceInr: 45.0,
    currentStockUnits: 35,
    reorderPointUnits: 15,
    unitCostInr: 36.0,
    image: '/assets/masala mangodi bg.png',
    gstRate: 12,
    hsnCode: '21069099',
  },
  {
    id: 'sku-masala-lambi-500',
    name: 'Lambi Masala Moong Mangodi (500g)',
    nameHindi: 'लंबी मसाला मूंग मंगोड़ी (500 ग्राम)',
    category: 'MASALA_MANGODI',
    shape: 'LAMBI',
    packetSizeGrams: 500,
    barcode: '8906001230094',
    mrpInr: 130,
    retailPriceInr: 110,
    wholesaleT1PriceInr: 95.0,
    wholesaleT2PriceInr: 90.0,
    currentStockUnits: 55,
    reorderPointUnits: 20,
    unitCostInr: 72.0,
    image: '/assets/masala mangodi bg.png',
    gstRate: 12,
    hsnCode: '21069099',
  },
  {
    id: 'sku-masala-lambi-1000',
    name: 'Lambi Masala Moong Mangodi (1kg)',
    nameHindi: 'लंबी मसाला मूंग मंगोड़ी (1 किग्रा)',
    category: 'MASALA_MANGODI',
    shape: 'LAMBI',
    packetSizeGrams: 1000,
    barcode: '8906001230100',
    mrpInr: 250,
    retailPriceInr: 220,
    wholesaleT1PriceInr: 185.0,
    wholesaleT2PriceInr: 175.0,
    currentStockUnits: 30,
    reorderPointUnits: 10,
    unitCostInr: 144.0,
    image: '/assets/masala mangodi bg.png',
    gstRate: 12,
    hsnCode: '21069099',
  },
  {
    id: 'sku-masala-gol-500',
    name: 'Gol Masala Moong Mangodi (500g)',
    nameHindi: 'गोल मसाला मूंग मंगोड़ी (500 ग्राम)',
    category: 'MASALA_MANGODI',
    shape: 'GOL',
    packetSizeGrams: 500,
    barcode: '8906001230117',
    mrpInr: 130,
    retailPriceInr: 110,
    wholesaleT1PriceInr: 95.0,
    wholesaleT2PriceInr: 90.0,
    currentStockUnits: 40,
    reorderPointUnits: 15,
    unitCostInr: 72.0,
    image: '/assets/masala mangodi bg.png',
    gstRate: 12,
    hsnCode: '21069099',
  },
  {
    id: 'sku-masala-gol-1000',
    name: 'Gol Masala Moong Mangodi (1kg)',
    nameHindi: 'गोल मसाला मूंग मंगोड़ी (1 किग्रा)',
    category: 'MASALA_MANGODI',
    shape: 'GOL',
    packetSizeGrams: 1000,
    barcode: '8906001230124',
    mrpInr: 250,
    retailPriceInr: 220,
    wholesaleT1PriceInr: 185.0,
    wholesaleT2PriceInr: 175.0,
    currentStockUnits: 25,
    reorderPointUnits: 10,
    unitCostInr: 144.0,
    image: '/assets/masala mangodi bg.png',
    gstRate: 12,
    hsnCode: '21069099',
  },
];

export const PRESET_SAMPLE_PRODUCTS: ProductSKU[] = [...INITIAL_PRODUCTS];

// Authentic CRM Customers from real sales sheet & Contacts.vcf
export const INITIAL_CUSTOMERS: Customer[] = realCustomersData as Customer[];

// Initial Empty States for Production, Workers, Batches, Lots & Materials (100% Manual Management)
export const INITIAL_RAW_MATERIALS: RawMaterial[] = [];
export const INITIAL_DAL_LOTS: DalLot[] = [];
export const INITIAL_WORKERS: Worker[] = [];
export const INITIAL_BATCHES: ProductionBatch[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_DISPATCHES: DispatchTicket[] = [];
export const INITIAL_INBOUND: InboundShipment[] = [];
export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [];
export const INITIAL_PAYMENTS: CustomerPayment[] = [];

export interface AppState {
  products: ProductSKU[];
  customers: Customer[];
  customerPayments: CustomerPayment[];
  orders: Order[];
  dalLots: DalLot[];
  workers: Worker[];
  productionBatches: ProductionBatch[];
  rawMaterials: RawMaterial[];
  stockMovements: StockMovement[];
  expenses: Expense[];
  reconciliations: CashDrawerReconciliation[];
  dispatchTickets: DispatchTicket[];
  inboundShipments: InboundShipment[];
  activeChannel: SalesChannel;
  activeCustomer: Customer | null;
  cart: CartItem[];
  openingCashFloat: number;
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const loadedChannel: SalesChannel = parsed.activeChannel || 'RETAIL';
      const loadedCustomer: Customer | null = parsed.activeCustomer || null;
      const rawCart: CartItem[] = Array.isArray(parsed.cart) ? parsed.cart : [];

      const sanitizedCart: CartItem[] = rawCart.map((item) => {
        if (!item || !item.sku) return item;
        const priceRes = resolveSKUPrice(
          item.sku,
          item.quantity || 1,
          loadedChannel,
          loadedCustomer
        );
        const unitPrice = Number(item.unitPriceInr) > 0 ? Number(item.unitPriceInr) : priceRes.unitPriceInr;
        const total = Number(item.totalInr) > 0 ? Number(item.totalInr) : (priceRes.totalInr > 0 ? priceRes.totalInr : unitPrice * (item.quantity || 1));
        return {
          ...item,
          quantity: item.quantity || 1,
          unitPriceInr: unitPrice,
          totalInr: total,
        };
      }).filter(Boolean);

      return {
        products: parsed.products || INITIAL_PRODUCTS,
        customers: parsed.customers || INITIAL_CUSTOMERS,
        customerPayments: parsed.customerPayments || INITIAL_PAYMENTS,
        orders: parsed.orders || (historicalOrdersData as Order[]),
        dalLots: parsed.dalLots || INITIAL_DAL_LOTS,
        workers: parsed.workers || INITIAL_WORKERS,
        productionBatches: parsed.productionBatches || INITIAL_BATCHES,
        rawMaterials: parsed.rawMaterials || INITIAL_RAW_MATERIALS,
        stockMovements: parsed.stockMovements || INITIAL_STOCK_MOVEMENTS,
        expenses: parsed.expenses || INITIAL_EXPENSES,
        reconciliations: parsed.reconciliations || [],
        dispatchTickets: parsed.dispatchTickets || INITIAL_DISPATCHES,
        inboundShipments: parsed.inboundShipments || INITIAL_INBOUND,
        activeChannel: loadedChannel,
        activeCustomer: loadedCustomer,
        cart: sanitizedCart,
        openingCashFloat: parsed.openingCashFloat ?? 0,
      };
    }
  } catch (e) {
    console.error('Failed to load local state:', e);
  }

  return {
    products: INITIAL_PRODUCTS,
    customers: INITIAL_CUSTOMERS,
    customerPayments: INITIAL_PAYMENTS,
    orders: historicalOrdersData as Order[],
    dalLots: INITIAL_DAL_LOTS,
    workers: INITIAL_WORKERS,
    productionBatches: INITIAL_BATCHES,
    rawMaterials: INITIAL_RAW_MATERIALS,
    stockMovements: INITIAL_STOCK_MOVEMENTS,
    expenses: INITIAL_EXPENSES,
    reconciliations: [],
    dispatchTickets: INITIAL_DISPATCHES,
    inboundShipments: INITIAL_INBOUND,
    activeChannel: 'RETAIL',
    activeCustomer: null,
    cart: [],
    openingCashFloat: 0,
  };
}

let globalState = loadState();
const stateListeners: Array<(state: AppState) => void> = [];

function emitChange() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
  stateListeners.forEach((listener) => listener({ ...globalState }));
}

export function useAppState() {
  const [state, setState] = useState<AppState>(globalState);

  useEffect(() => {
    setState(globalState);
    const listener = (nextState: AppState) => setState(nextState);
    stateListeners.push(listener);
    return () => {
      const idx = stateListeners.indexOf(listener);
      if (idx >= 0) stateListeners.splice(idx, 1);
    };
  }, []);

  return state;
}

// Global store with full CRUD for Products
export const store = {
  getState: () => globalState,

  resetToDefaults: () => {
    localStorage.removeItem(STORAGE_KEY);
    globalState = loadState();
    emitChange();
  },

  // Product Catalog CRUD
  addProduct: (productData: Omit<ProductSKU, 'id'>) => {
    const slug = productData.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    const newProduct: ProductSKU = {
      ...productData,
      id: `sku-${slug}-${Date.now()}`,
    };
    globalState.products.unshift(newProduct);
    emitChange();
    return newProduct;
  },

  updateProduct: (productId: string, updatedFields: Partial<ProductSKU>) => {
    const idx = globalState.products.findIndex((p) => p.id === productId);
    if (idx >= 0) {
      globalState.products[idx] = {
        ...globalState.products[idx],
        ...updatedFields,
      };
      emitChange();
    }
  },

  deleteProduct: (productId: string) => {
    globalState.products = globalState.products.filter((p) => p.id !== productId);
    globalState.cart = globalState.cart.filter((c) => c.sku.id !== productId);
    emitChange();
  },

  clearAllProducts: () => {
    globalState.products = [];
    globalState.cart = [];
    emitChange();
  },

  loadSampleProducts: () => {
    globalState.products = [...PRESET_SAMPLE_PRODUCTS];
    emitChange();
  },

  importProductsBulk: (newProductsList: Array<Omit<ProductSKU, 'id'>>) => {
    let count = 0;
    for (const p of newProductsList) {
      const slug = p.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
      globalState.products.push({
        ...p,
        id: `sku-${slug}-${Date.now()}-${count}`,
      });
      count++;
    }
    emitChange();
    return count;
  },

  setChannel: (channel: SalesChannel) => {
    globalState.activeChannel = channel;
    globalState.cart = globalState.cart.map((item) => {
      const priceRes = resolveSKUPrice(
        item.sku,
        item.quantity,
        channel,
        globalState.activeCustomer
      );
      const unitPrice = priceRes.unitPriceInr > 0 ? priceRes.unitPriceInr : (Number(item.sku.retailPriceInr) || 0);
      const total = priceRes.totalInr > 0 ? priceRes.totalInr : unitPrice * item.quantity;
      return {
        ...item,
        unitPriceInr: unitPrice,
        totalInr: total,
      };
    });
    emitChange();
  },

  setActiveCustomer: (customer: Customer | null) => {
    globalState.activeCustomer = customer;
    if (customer && customer.customerType === 'wholesale') {
      globalState.activeChannel = 'WHOLESALE_T1';
    }
    globalState.cart = globalState.cart.map((item) => {
      const priceRes = resolveSKUPrice(
        item.sku,
        item.quantity,
        globalState.activeChannel,
        customer
      );
      const unitPrice = priceRes.unitPriceInr > 0 ? priceRes.unitPriceInr : (Number(item.sku.retailPriceInr) || 0);
      const total = priceRes.totalInr > 0 ? priceRes.totalInr : unitPrice * item.quantity;
      return {
        ...item,
        unitPriceInr: unitPrice,
        totalInr: total,
      };
    });
    emitChange();
  },

  // Cart operations
  addToCart: (sku: ProductSKU, quantity: number = 1) => {
    const existing = globalState.cart.find((item) => item.sku.id === sku.id);
    const targetQty = (existing?.quantity || 0) + quantity;
    const priceRes = resolveSKUPrice(
      sku,
      targetQty,
      globalState.activeChannel,
      globalState.activeCustomer
    );
    const unitPrice = priceRes.unitPriceInr > 0 ? priceRes.unitPriceInr : (Number(sku.retailPriceInr) || 0);
    const total = priceRes.totalInr > 0 ? priceRes.totalInr : unitPrice * targetQty;

    if (existing) {
      existing.quantity = targetQty;
      existing.unitPriceInr = unitPrice;
      existing.totalInr = total;
    } else {
      globalState.cart.push({
        sku,
        quantity: targetQty,
        unitPriceInr: unitPrice,
        totalInr: total,
      });
    }
    emitChange();
  },

  updateCartQty: (skuId: string, quantity: number) => {
    if (quantity <= 0) {
      globalState.cart = globalState.cart.filter((item) => item.sku.id !== skuId);
    } else {
      const item = globalState.cart.find((i) => i.sku.id === skuId);
      if (item) {
        const priceRes = resolveSKUPrice(
          item.sku,
          quantity,
          globalState.activeChannel,
          globalState.activeCustomer
        );
        const unitPrice = priceRes.unitPriceInr > 0 ? priceRes.unitPriceInr : (Number(item.sku.retailPriceInr) || 0);
        const total = priceRes.totalInr > 0 ? priceRes.totalInr : unitPrice * quantity;
        item.quantity = quantity;
        item.unitPriceInr = unitPrice;
        item.totalInr = total;
      }
    }
    emitChange();
  },

  removeFromCart: (skuId: string) => {
    globalState.cart = globalState.cart.filter((item) => item.sku.id !== skuId);
    emitChange();
  },

  clearCart: () => {
    globalState.cart = [];
    emitChange();
  },

  // Orders creation
  createOrder: (orderPayload: {
    paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Credit';
    amountPaidInr: number;
    discountInr: number;
    notes?: string;
  }): Order => {
    const today = new Date().toISOString().split('T')[0];
    const billSequence = globalState.orders.length + 1;
    const billNo = `JM-${today.replace(/-/g, '').slice(2)}-${String(billSequence).padStart(3, '0')}`;

    const customerGstin = globalState.activeCustomer?.gstin || undefined;
    const lineItems: OrderLineItem[] = globalState.cart.map((c) => {
      const priceRes = resolveSKUPrice(
        c.sku,
        c.quantity,
        globalState.activeChannel,
        globalState.activeCustomer
      );
      const unitPrice = Number(c.unitPriceInr) > 0 ? Number(c.unitPriceInr) : (priceRes.unitPriceInr > 0 ? priceRes.unitPriceInr : (Number(c.sku.retailPriceInr) || 0));
      const total = Number(c.totalInr) > 0 ? Number(c.totalInr) : (priceRes.totalInr > 0 ? priceRes.totalInr : unitPrice * c.quantity);
      const tax = calculateTaxBreakdown(total, c.sku.gstRate || 5, customerGstin);
      return {
        skuId: c.sku.id,
        skuName: c.sku.name,
        skuNameHindi: c.sku.nameHindi,
        shape: c.sku.shape,
        packetSizeGrams: c.sku.packetSizeGrams,
        quantity: c.quantity,
        unitPriceInr: unitPrice,
        totalInr: total,
        gstRate: c.sku.gstRate || 5,
        gstAmount: tax.totalGstInr,
      };
    });

    const summary = calculateOrderFinancials(
      lineItems,
      orderPayload.discountInr || 0,
      orderPayload.amountPaidInr || 0,
      orderPayload.paymentMethod,
      customerGstin
    );

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      billNo,
      channel: globalState.activeChannel,
      customerId: globalState.activeCustomer?.id || null,
      customerName: globalState.activeCustomer?.name || 'Walk-in Customer',
      customerPhone: globalState.activeCustomer?.phone || null,
      customerGstin: globalState.activeCustomer?.gstin || null,
      items: lineItems,
      subtotalInr: summary.grossSubtotalInr,
      discountInr: summary.discountInr,
      gstAmountInr: summary.totalGstInr,
      grandTotalInr: summary.grandTotalInr,
      paymentMethod: orderPayload.paymentMethod,
      amountPaidInr: summary.amountPaidInr,
      creditAddedInr: summary.creditAddedInr,
      changeDueInr: summary.changeDueInr,
      notes: orderPayload.notes,
      date: today,
      createdAt: new Date().toISOString(),
    };

    // 1. Save order
    globalState.orders.unshift(newOrder);

    // 2. Decrement Finished Goods stock and record movement
    for (const item of lineItems) {
      const prod = globalState.products.find((p) => p.id === item.skuId);
      if (prod) {
        prod.currentStockUnits = Math.max(0, prod.currentStockUnits - item.quantity);
      }
      globalState.stockMovements.unshift({
        id: `sm-${Date.now()}-${item.skuId}`,
        date: today,
        itemId: item.skuId,
        itemName: item.skuName,
        itemType: 'FINISHED_GOODS',
        movementType: 'POS_SALE',
        qtySigned: -item.quantity,
        unit: 'PCS',
        referenceNo: billNo,
        operator: 'Anjali B. (Owner)',
        createdAt: new Date().toISOString(),
      });
    }

    // 3. Update customer ledger & lifetime metrics
    if (globalState.activeCustomer) {
      const cust = globalState.customers.find((c) => c.id === globalState.activeCustomer?.id);
      if (cust) {
        if (summary.creditAddedInr > 0) {
          cust.totalOutstandingInr = round2(cust.totalOutstandingInr + summary.creditAddedInr);
        }
        cust.totalOrdersCount += 1;
        cust.lifetimeValueInr = round2(cust.lifetimeValueInr + summary.grandTotalInr);
        cust.lastOrderDate = today;
      }
    }

    // 4. Clear cart
    globalState.cart = [];
    emitChange();
    return newOrder;
  },

  voidOrder: (orderId: string, reason: string) => {
    const ord = globalState.orders.find((o) => o.id === orderId);
    if (!ord || ord.isVoid) return;
    ord.isVoid = true;
    ord.voidReason = reason;

    for (const item of ord.items) {
      const prod = globalState.products.find((p) => p.id === item.skuId);
      if (prod) {
        prod.currentStockUnits += item.quantity;
      }
      globalState.stockMovements.unshift({
        id: `sm-void-${Date.now()}-${item.skuId}`,
        date: new Date().toISOString().split('T')[0],
        itemId: item.skuId,
        itemName: item.skuName,
        itemType: 'FINISHED_GOODS',
        movementType: 'VOID_RESTOCK',
        qtySigned: item.quantity,
        unit: 'PCS',
        referenceNo: `VOID:${ord.billNo}`,
        reason,
        operator: 'Anjali B. (Owner)',
        createdAt: new Date().toISOString(),
      });
    }

    if (ord.customerId && ord.creditAddedInr > 0) {
      const cust = globalState.customers.find((c) => c.id === ord.customerId);
      if (cust) {
        cust.totalOutstandingInr = Math.max(0, round2(cust.totalOutstandingInr - ord.creditAddedInr));
        cust.lifetimeValueInr = Math.max(0, round2(cust.lifetimeValueInr - ord.grandTotalInr));
      }
    }

    emitChange();
  },

  // Customers
  addCustomer: (customer: Omit<Customer, 'id' | 'totalOutstandingInr' | 'totalOrdersCount' | 'lifetimeValueInr' | 'createdAt'>) => {
    const newCust: Customer = {
      ...customer,
      id: `cust-${Date.now()}`,
      totalOutstandingInr: 0,
      totalOrdersCount: 0,
      lifetimeValueInr: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    globalState.customers.unshift(newCust);
    emitChange();
    return newCust;
  },

  updateCustomer: (customerId: string, fields: Partial<Customer>) => {
    const idx = globalState.customers.findIndex((c) => c.id === customerId);
    if (idx >= 0) {
      globalState.customers[idx] = {
        ...globalState.customers[idx],
        ...fields,
      };
      if (globalState.activeCustomer?.id === customerId) {
        globalState.activeCustomer = { ...globalState.activeCustomer, ...fields };
      }
      emitChange();
    }
  },

  deleteCustomer: (customerId: string) => {
    globalState.customers = globalState.customers.filter((c) => c.id !== customerId);
    if (globalState.activeCustomer?.id === customerId) {
      globalState.activeCustomer = null;
    }
    emitChange();
  },

  setOpeningCashFloat: (amount: number) => {
    globalState.openingCashFloat = Math.max(0, Number(amount) || 0);
    emitChange();
  },

  recordCustomerPayment: (payment: {
    customerId: string;
    amountInr: number;
    paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Credit';
    referenceNo?: string;
    notes?: string;
  }) => {
    const today = new Date().toISOString().split('T')[0];
    const newPay: CustomerPayment = {
      id: `pay-${Date.now()}`,
      customerId: payment.customerId,
      amountInr: payment.amountInr,
      paymentMethod: payment.paymentMethod,
      referenceNo: payment.referenceNo,
      notes: payment.notes,
      date: today,
      createdAt: new Date().toISOString(),
    };

    globalState.customerPayments.unshift(newPay);

    const cust = globalState.customers.find((c) => c.id === payment.customerId);
    if (cust) {
      cust.totalOutstandingInr = Math.max(0, round2(cust.totalOutstandingInr - payment.amountInr));
    }
    emitChange();
  },

  importCustomersBulk: (contacts: Array<{ name: string; phone: string; type: 'retail' | 'wholesale'; area?: string }>) => {
    let imported = 0;
    for (const c of contacts) {
      const cleanPhone = c.phone.replace(/[^\d]/g, '').slice(-10);
      if (cleanPhone.length !== 10) continue;
      const exists = globalState.customers.some((x) => x.phone.replace(/[^\d]/g, '').slice(-10) === cleanPhone);
      if (!exists) {
        globalState.customers.push({
          id: `cust-imp-${Date.now()}-${imported}`,
          name: c.name.trim(),
          phone: cleanPhone,
          customerType: c.type,
          area: c.area || 'Fatehpur',
          creditLimitInr: c.type === 'wholesale' ? 25000 : 3000,
          totalOutstandingInr: 0,
          totalOrdersCount: 0,
          lifetimeValueInr: 0,
          createdAt: new Date().toISOString().split('T')[0],
        });
        imported++;
      }
    }
    emitChange();
    return imported;
  },

  // Production Batches
  createProductionBatch: (batchData: {
    productType: string;
    shape: 'LAMBI' | 'GOL' | 'MASALA' | 'SPECIAL';
    dalLotId: string;
    rawDalWeightKg: number;
    wetMixtureWeightKg: number;
    driedYieldKg: number;
    labourEntries: Array<{ workerId: string; driedKg: number }>;
    qcChecks: {
      moisturePassed: boolean;
      colorPassed: boolean;
      tastePassed: boolean;
      breakagePct: number;
      qcNotes?: string;
    };
    outputLots: Array<{ skuId: string; packagesCount: number }>;
  }) => {
    const today = new Date().toISOString().split('T')[0];
    const batchSeq = globalState.productionBatches.length + 1;
    const batchCode = `B-${today.replace(/-/g, '')}-${String(batchSeq).padStart(2, '0')}`;

    const dalLot = globalState.dalLots.find((l) => l.id === batchData.dalLotId);
    const dalLotNo = dalLot?.lotNo || 'DL-GENERIC';
    const dalRate = dalLot?.ratePerKgInr || 92;

    const yieldMetrics = calculateBatchYieldMetrics(
      batchData.rawDalWeightKg,
      batchData.wetMixtureWeightKg,
      batchData.driedYieldKg,
      96.0
    );

    const rawLaborEntries = batchData.labourEntries.map((le) => {
      const wrk = globalState.workers.find((w) => w.id === le.workerId);
      return {
        workerId: le.workerId,
        workerName: wrk?.name || 'Kaarigar',
        driedKg: le.driedKg,
        ratePerKgInr: wrk?.pieceRatePerKgInr || 25,
      };
    });
    const laborResults = calculateLaborPayouts(rawLaborEntries);

    for (const le of laborResults.processedEntries) {
      const wrk = globalState.workers.find((w) => w.id === le.workerId);
      if (wrk) {
        wrk.totalKgProduced = round2(wrk.totalKgProduced + le.driedKg);
        wrk.totalEarnedInr = round2(wrk.totalEarnedInr + le.payoutInr);
      }
    }

    const cogsBreakdown = calculateDynamicCOGS(
      batchData.rawDalWeightKg,
      dalRate,
      batchData.driedYieldKg,
      laborResults.totalLaborCostInr,
      batchData.shape === 'MASALA',
      6.0,
      0
    );

    if (dalLot) {
      dalLot.availableWeightKg = Math.max(0, round2(dalLot.availableWeightKg - batchData.rawDalWeightKg));
    }

    const backflushDeductions = calculateBOMBackflushDeductions(
      batchData.shape,
      batchData.driedYieldKg,
      batchData.outputLots.map((ol) => {
        const prod = globalState.products.find((p) => p.id === ol.skuId);
        return { packetSizeGrams: prod?.packetSizeGrams || 500, quantity: ol.packagesCount };
      })
    );

    for (const req of backflushDeductions) {
      const rm = globalState.rawMaterials.find((r) => r.code === req.rawMaterialCode);
      if (rm) {
        rm.currentStock = Math.max(0, round2(rm.currentStock - req.quantityRequired));
        globalState.stockMovements.unshift({
          id: `sm-bom-${Date.now()}-${rm.code}`,
          date: today,
          itemId: rm.id,
          itemName: rm.name,
          itemType: 'RAW_MATERIAL',
          movementType: 'PRODUCTION_CONSUMED',
          qtySigned: -req.quantityRequired,
          unit: rm.unit,
          referenceNo: batchCode,
          reason: `BOM Backflush for Batch ${batchCode}`,
          operator: 'Anjali B. (Owner)',
          createdAt: new Date().toISOString(),
        });
      }
    }

    const isRejected =
      batchData.qcChecks.breakagePct > 8.0 ||
      !batchData.qcChecks.moisturePassed ||
      yieldMetrics.status === 'WARNING_HIGH_MOISTURE';

    const status = isRejected ? 'REJECTED' : 'RELEASED';
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 180);

    const generatedOutputLots = batchData.outputLots.map((ol) => {
      const prod = globalState.products.find((p) => p.id === ol.skuId);
      const pkgGrams = prod?.packetSizeGrams || 500;
      const lotNumber = `LOT-${prod?.shape || 'MN'}-${pkgGrams}-${today.replace(/-/g, '').slice(4)}`;

      if (!isRejected && prod) {
        prod.currentStockUnits += ol.packagesCount;
        prod.unitCostInr = calculateFinishedUnitCOGS(
          cogsBreakdown.bulkCostPerKgInr,
          pkgGrams,
          pkgGrams === 1000 ? 5.2 : 3.8,
          28,
          20
        );

        globalState.stockMovements.unshift({
          id: `sm-prod-${Date.now()}-${ol.skuId}`,
          date: today,
          itemId: prod.id,
          itemName: prod.name,
          itemType: 'FINISHED_GOODS',
          movementType: 'PRODUCTION_IN',
          qtySigned: ol.packagesCount,
          unit: 'PCS',
          referenceNo: batchCode,
          operator: 'Anjali B. (Owner)',
          createdAt: new Date().toISOString(),
        });
      }

      return {
        skuId: ol.skuId,
        skuName: prod?.name || 'Mangodi Pack',
        packetSizeGrams: pkgGrams,
        packagesCount: ol.packagesCount,
        lotNumber,
      };
    });

    const newBatch: ProductionBatch = {
      id: `batch-${Date.now()}`,
      batchCode,
      productType: batchData.productType,
      shape: batchData.shape,
      dalLotId: batchData.dalLotId,
      dalLotNo,
      rawDalWeightKg: batchData.rawDalWeightKg,
      wetMixtureWeightKg: batchData.wetMixtureWeightKg,
      moistureRatio: yieldMetrics.moistureRatio,
      driedYieldKg: batchData.driedYieldKg,
      shrinkagePct: yieldMetrics.shrinkagePct,
      expectedYieldBaselinePct: 96.0,
      yieldVariancePct: yieldMetrics.yieldVariancePct,
      labourEntries: laborResults.processedEntries,
      totalLaborCostInr: laborResults.totalLaborCostInr,
      dalCostInr: cogsBreakdown.dalCostInr,
      masalaCostInr: cogsBreakdown.masalaCostInr,
      grindingCostInr: cogsBreakdown.grindingCostInr,
      totalBatchCostInr: cogsBreakdown.totalBatchCostInr,
      costPerKgInr: cogsBreakdown.bulkCostPerKgInr,
      qcChecks: batchData.qcChecks,
      status,
      releaseDate: !isRejected ? today : undefined,
      expiryDate: !isRejected ? expiryDate.toISOString().split('T')[0] : undefined,
      outputLots: generatedOutputLots,
      createdAt: new Date().toISOString(),
    };

    globalState.productionBatches.unshift(newBatch);
    emitChange();
    return newBatch;
  },

  // Worker / Kaarigar Management CRUD
  addWorker: (workerData: {
    name: string;
    phone?: string;
    role?: string;
    pieceRatePerKgInr?: number;
    dailyWageInr?: number;
    notes?: string;
  }) => {
    const newWorker: Worker = {
      id: `wrk-${Date.now()}`,
      name: workerData.name.trim(),
      phone: workerData.phone?.trim() || '',
      role: workerData.role || 'Mangodi Belan & Extrusion',
      pieceRatePerKgInr: Number(workerData.pieceRatePerKgInr) || 25,
      dailyWageInr: Number(workerData.dailyWageInr) || 0,
      totalKgProduced: 0,
      totalEarnedInr: 0,
      status: 'ACTIVE',
      joinedDate: new Date().toISOString().split('T')[0],
      notes: workerData.notes,
    };
    globalState.workers.push(newWorker);
    emitChange();
    return newWorker;
  },

  updateWorker: (workerId: string, fields: Partial<Worker>) => {
    const idx = globalState.workers.findIndex((w) => w.id === workerId);
    if (idx >= 0) {
      globalState.workers[idx] = { ...globalState.workers[idx], ...fields };
      emitChange();
    }
  },

  deleteWorker: (workerId: string) => {
    globalState.workers = globalState.workers.filter((w) => w.id !== workerId);
    emitChange();
  },

  recordWorkerPayout: (payout: {
    workerId: string;
    amountInr: number;
    kgProduced?: number;
    notes?: string;
    paymentMethod?: 'Cash' | 'UPI';
  }) => {
    const wrk = globalState.workers.find((w) => w.id === payout.workerId);
    if (wrk) {
      if (payout.kgProduced) {
        wrk.totalKgProduced = round2(wrk.totalKgProduced + payout.kgProduced);
      }
      wrk.totalEarnedInr = round2(wrk.totalEarnedInr + payout.amountInr);
      store.logExpense({
        date: new Date().toISOString().split('T')[0],
        category: 'LABOR',
        note: `Wage / Piece-rate payout to ${wrk.name}${payout.notes ? ` (${payout.notes})` : ''}`,
        vendor: wrk.name,
        paymentMethod: payout.paymentMethod || 'Cash',
        amountInr: payout.amountInr,
      });
    }
    emitChange();
  },

  // Dal Lots CRUD
  addDalLot: (lotData: {
    lotNo: string;
    supplierName: string;
    dalType?: string;
    initialWeightKg: number;
    ratePerKgInr: number;
    purchaseDate?: string;
    notes?: string;
  }) => {
    const newLot: DalLot = {
      id: `dl-${Date.now()}`,
      lotNo: lotData.lotNo.trim() || `DL-${Date.now().toString().slice(-4)}`,
      supplierName: lotData.supplierName.trim() || 'Mandi Supplier',
      dalType: lotData.dalType || 'Moong Mogar Dal (Grade A)',
      purchaseDate: lotData.purchaseDate || new Date().toISOString().split('T')[0],
      initialWeightKg: Number(lotData.initialWeightKg) || 0,
      availableWeightKg: Number(lotData.initialWeightKg) || 0,
      ratePerKgInr: Number(lotData.ratePerKgInr) || 90,
      notes: lotData.notes,
    };
    globalState.dalLots.unshift(newLot);

    // Sync Raw Material stock if matching DAL category exists
    const existingDalRM = globalState.rawMaterials.find((r) => r.category === 'DAL');
    if (existingDalRM) {
      existingDalRM.currentStock = round2(existingDalRM.currentStock + newLot.initialWeightKg);
    }
    emitChange();
    return newLot;
  },

  updateDalLot: (lotId: string, fields: Partial<DalLot>) => {
    const idx = globalState.dalLots.findIndex((l) => l.id === lotId);
    if (idx >= 0) {
      globalState.dalLots[idx] = { ...globalState.dalLots[idx], ...fields };
      emitChange();
    }
  },

  deleteDalLot: (lotId: string) => {
    globalState.dalLots = globalState.dalLots.filter((l) => l.id !== lotId);
    emitChange();
  },

  // Raw Materials CRUD
  addRawMaterial: (rmData: {
    name: string;
    nameHindi?: string;
    code?: string;
    category: 'DAL' | 'MASALA' | 'PACKAGING' | 'LABEL' | 'OTHER';
    unit: 'KG' | 'PCS' | 'BOX' | 'BAG' | 'GM';
    currentStock: number;
    reorderPoint: number;
    costPerUnitInr: number;
    supplierName?: string;
  }) => {
    const code = rmData.code?.trim() || `RM-${rmData.category.slice(0, 3)}-${Date.now().toString().slice(-4)}`;
    const newRM: RawMaterial = {
      id: `rm-${Date.now()}`,
      code,
      name: rmData.name.trim(),
      nameHindi: rmData.nameHindi?.trim() || rmData.name.trim(),
      category: rmData.category,
      unit: rmData.unit,
      currentStock: Number(rmData.currentStock) || 0,
      reorderPoint: Number(rmData.reorderPoint) || 0,
      costPerUnitInr: Number(rmData.costPerUnitInr) || 0,
      supplierName: rmData.supplierName?.trim() || '',
      lastRestockedDate: new Date().toISOString().split('T')[0],
    };
    globalState.rawMaterials.unshift(newRM);

    if (newRM.currentStock > 0) {
      globalState.stockMovements.unshift({
        id: `sm-rm-init-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        itemId: newRM.id,
        itemName: newRM.name,
        itemType: 'RAW_MATERIAL',
        movementType: 'PROCUREMENT',
        qtySigned: newRM.currentStock,
        unit: newRM.unit,
        reason: 'Initial raw material stock',
        operator: 'Admin',
        createdAt: new Date().toISOString(),
      });
    }
    emitChange();
    return newRM;
  },

  updateRawMaterial: (id: string, fields: Partial<RawMaterial>) => {
    const idx = globalState.rawMaterials.findIndex((r) => r.id === id);
    if (idx >= 0) {
      globalState.rawMaterials[idx] = { ...globalState.rawMaterials[idx], ...fields };
      emitChange();
    }
  },

  deleteRawMaterial: (id: string) => {
    globalState.rawMaterials = globalState.rawMaterials.filter((r) => r.id !== id);
    emitChange();
  },

  // Batch Updates & Deletion
  updateProductionBatch: (batchId: string, fields: Partial<ProductionBatch>) => {
    const idx = globalState.productionBatches.findIndex((b) => b.id === batchId);
    if (idx >= 0) {
      globalState.productionBatches[idx] = { ...globalState.productionBatches[idx], ...fields };
      emitChange();
    }
  },

  updateBatchStatus: (batchId: string, status: BatchStatus) => {
    const b = globalState.productionBatches.find((x) => x.id === batchId);
    if (b) {
      b.status = status;
      if (status === 'RELEASED' && !b.releaseDate) {
        b.releaseDate = new Date().toISOString().split('T')[0];
      }
      emitChange();
    }
  },

  deleteProductionBatch: (batchId: string) => {
    globalState.productionBatches = globalState.productionBatches.filter((b) => b.id !== batchId);
    emitChange();
  },

  // Stock Adjustments
  adjustStock: (itemId: string, isRaw: boolean, qtySigned: number, reason: string) => {
    const today = new Date().toISOString().split('T')[0];
    if (isRaw) {
      const raw = globalState.rawMaterials.find((r) => r.id === itemId);
      if (raw) {
        raw.currentStock = Math.max(0, round2(raw.currentStock + qtySigned));
        globalState.stockMovements.unshift({
          id: `sm-adj-${Date.now()}`,
          date: today,
          itemId: raw.id,
          itemName: raw.name,
          itemType: 'RAW_MATERIAL',
          movementType: 'ADJUSTMENT',
          qtySigned,
          unit: raw.unit,
          reason,
          operator: 'Anjali B. (Owner)',
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      const prod = globalState.products.find((p) => p.id === itemId);
      if (prod) {
        prod.currentStockUnits = Math.max(0, prod.currentStockUnits + qtySigned);
        globalState.stockMovements.unshift({
          id: `sm-adj-${Date.now()}`,
          date: today,
          itemId: prod.id,
          itemName: prod.name,
          itemType: 'FINISHED_GOODS',
          movementType: 'ADJUSTMENT',
          qtySigned,
          unit: 'PCS',
          reason,
          operator: 'Anjali B. (Owner)',
          createdAt: new Date().toISOString(),
        });
      }
    }
    emitChange();
  },

  clearStockMovements: () => {
    globalState.stockMovements = [];
    emitChange();
  },

  // Expenses & Cash Drawer
  logExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    const newExp: Expense = {
      ...expense,
      id: `exp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    globalState.expenses.unshift(newExp);
    emitChange();
    return newExp;
  },

  deleteExpense: (id: string) => {
    globalState.expenses = globalState.expenses.filter((e) => e.id !== id);
    emitChange();
  },

  closeCashDrawer: (recData: Omit<CashDrawerReconciliation, 'id' | 'closedAt'>) => {
    const reconCalc = reconcileCashDrawer(
      recData.openingFloatInr,
      globalState.orders,
      globalState.customerPayments,
      globalState.expenses,
      recData.denominations,
      recData.nextDayFloatInr
    );

    const newRec: CashDrawerReconciliation = {
      id: `rec-${Date.now()}`,
      date: recData.date,
      openingFloatInr: reconCalc.openingFloatInr,
      cashSalesInr: reconCalc.cashSalesInr,
      cashExpensesInr: reconCalc.cashExpensesInr,
      expectedCashInr: reconCalc.expectedCashInr,
      countedCashInr: reconCalc.countedCashInr,
      varianceInr: reconCalc.varianceInr,
      denominations: recData.denominations,
      nextDayFloatInr: recData.nextDayFloatInr,
      operator: recData.operator,
      notes: recData.notes,
      closedAt: new Date().toISOString(),
    };

    globalState.reconciliations.unshift(newRec);
    globalState.openingCashFloat = recData.nextDayFloatInr;
    emitChange();
    return newRec;
  },

  // Logistics & Inbound
  createDispatchTicket: (ticket: Omit<DispatchTicket, 'id'>) => {
    const newTicket: DispatchTicket = {
      ...ticket,
      id: `dt-${Date.now()}`,
    };
    globalState.dispatchTickets.unshift(newTicket);
    emitChange();
    return newTicket;
  },

  updateDispatchStopStatus: (ticketId: string, stopId: string, status: 'pending' | 'delivered') => {
    const t = globalState.dispatchTickets.find((x) => x.id === ticketId);
    if (t) {
      const stop = t.stops.find((s) => s.id === stopId);
      if (stop) {
        stop.status = status;
        const allDelivered = t.stops.every((s) => s.status === 'delivered');
        t.status = allDelivered ? 'delivered' : 'in-transit';
      }
    }
    emitChange();
  },

  createInboundShipment: (shipment: Omit<InboundShipment, 'id'>) => {
    const newShip: InboundShipment = {
      ...shipment,
      id: `inb-${Date.now()}`,
    };
    globalState.inboundShipments.unshift(newShip);
    emitChange();
    return newShip;
  },

  receiveInboundDelivery: (shipmentId: string, receivedKg: number) => {
    const s = globalState.inboundShipments.find((x) => x.id === shipmentId);
    if (s) {
      s.receivedKg = receivedKg;
      s.status = 'delivered';

      const dal = globalState.rawMaterials.find((r) => r.category === 'DAL');
      if (dal) {
        dal.currentStock = round2(dal.currentStock + receivedKg);
        globalState.stockMovements.unshift({
          id: `sm-inb-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          itemId: dal.id,
          itemName: dal.name,
          itemType: 'RAW_MATERIAL',
          movementType: 'PROCUREMENT',
          qtySigned: receivedKg,
          unit: 'KG',
          referenceNo: s.shipmentNo,
          operator: 'Anjali B. (Owner)',
          createdAt: new Date().toISOString(),
        });
      }
    }
    emitChange();
  },

  // Analytical & Mathematical Engine Getters
  getDemandForecast: (productSkuId?: string) => {
    const dailyMap: Record<string, number> = {};
    for (const ord of globalState.orders) {
      if (ord.isVoid) continue;
      const day = ord.date;
      for (const item of ord.items) {
        if (!productSkuId || item.skuId === productSkuId) {
          const itemKg = (item.quantity * (item.packetSizeGrams || 500)) / 1000;
          dailyMap[day] = (dailyMap[day] || 0) + itemKg;
        }
      }
    }

    const sortedDates = Object.keys(dailyMap).sort();
    const demandSeries = sortedDates.map((d) => dailyMap[d]);

    const forecastResult = runHoltWintersForecast(
      demandSeries.length >= 4 ? demandSeries : [40, 55, 65, 48, 70, 85, 90, 45, 60, 72, 52, 68, 88, 95],
      7,
      7
    );

    const totalCurrentStockKg = globalState.products.reduce((acc, p) => {
      if (!productSkuId || p.id === productSkuId) {
        return acc + (p.currentStockUnits * p.packetSizeGrams) / 1000;
      }
      return acc;
    }, 0);

    const mpsSchedule = calculateMasterProductionSchedule(
      totalCurrentStockKg,
      80.0,
      forecastResult.forecastHorizon,
      [],
      [],
      80.0
    );

    return {
      forecastResult,
      mpsSchedule,
      demandHistoryDates: sortedDates,
      demandHistorySeries: demandSeries,
    };
  },

  getSafetyStockAnalytics: (rawMaterialId?: string) => {
    const rm = globalState.rawMaterials.find((r) => (!rawMaterialId ? r.category === 'DAL' : r.id === rawMaterialId)) || globalState.rawMaterials[0];
    const stock = rm ? rm.currentStock : 0;
    return calculateDynamicSafetyStock(
      [65, 80, 50, 95, 70, 110, 85, 75, 90, 60],
      [3, 4, 3, 5, 2, 4],
      stock,
      '95%'
    );
  },

  getEOQAnalytics: (rawMaterialId?: string) => {
    const rm = globalState.rawMaterials.find((r) => (!rawMaterialId ? r.category === 'DAL' : r.id === rawMaterialId)) || globalState.rawMaterials[0];
    const cost = rm ? rm.costPerUnitInr : 90;
    return calculateEOQWithDiscounts(
      24000,
      500,
      18,
      [
        { tierName: 'Small Lot (< 500kg)', minQty: 0, unitPriceInr: cost + 3 },
        { tierName: 'Standard Mandi Lot (500kg+)', minQty: 500, unitPriceInr: cost },
        { tierName: 'Bulk Direct Mill Truck (1000kg+)', minQty: 1000, unitPriceInr: Math.max(70, cost - 4) },
      ]
    );
  },

  getProfitAndLossReport: () => {
    return calculateProfitAndLoss(globalState.orders, globalState.products, globalState.expenses);
  },

  exportTallyXmlString: () => {
    return generateTallySalesXml(globalState.orders);
  },
};
