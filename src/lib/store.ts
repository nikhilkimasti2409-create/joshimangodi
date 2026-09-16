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

const STORAGE_KEY = 'joshi_mangodi_ops_state_v3';

// Empty default products as requested - User will manually upload products
export const INITIAL_PRODUCTS: ProductSKU[] = [];

// Sample preset products if user wants to restore examples
export const PRESET_SAMPLE_PRODUCTS: ProductSKU[] = [
  {
    id: 'sku-plain-lambi-500',
    name: 'Lambi Plain Moong Mangodi (500g)',
    nameHindi: 'लंबी सादी मूंग मंगोड़ी (500 ग्राम)',
    category: 'PLAIN_MANGODI',
    shape: 'LAMBI',
    packetSizeGrams: 500,
    barcode: '8906001230011',
    mrpInr: 120,
    retailPriceInr: 110,
    wholesaleT1PriceInr: 87.5, // ₹175/kg rate
    wholesaleT2PriceInr: 82.5, // ₹165/kg rate
    currentStockUnits: 145,
    reorderPointUnits: 40,
    unitCostInr: 64.5,
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
    barcode: '8906001230028',
    mrpInr: 230,
    retailPriceInr: 210,
    wholesaleT1PriceInr: 175,
    wholesaleT2PriceInr: 165,
    currentStockUnits: 88,
    reorderPointUnits: 25,
    unitCostInr: 129.0,
    image: '/assets/sadi mangodi.jpeg',
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
    barcode: '8906001230035',
    mrpInr: 120,
    retailPriceInr: 110,
    wholesaleT1PriceInr: 87.5,
    wholesaleT2PriceInr: 82.5,
    currentStockUnits: 92,
    reorderPointUnits: 30,
    unitCostInr: 64.5,
    image: '/assets/Gemini_Generated_Image_5bth1z5bth1z5bth-removebg-preview.png',
    gstRate: 5,
    hsnCode: '21069099',
  },
  {
    id: 'sku-masala-500',
    name: 'Spiced Masala Moong Mangodi (500g)',
    nameHindi: 'मसालेदार मूंग मंगोड़ी (500 ग्राम)',
    category: 'MASALA_MANGODI',
    shape: 'MASALA',
    packetSizeGrams: 500,
    barcode: '8906001230042',
    mrpInr: 130,
    retailPriceInr: 120,
    wholesaleT1PriceInr: 92.5,
    wholesaleT2PriceInr: 87.5,
    currentStockUnits: 64,
    reorderPointUnits: 25,
    unitCostInr: 72.0,
    image: '/assets/masala mangodi bg.png',
    gstRate: 5,
    hsnCode: '21069099',
  },
  {
    id: 'sku-masala-1000',
    name: 'Spiced Masala Moong Mangodi (1kg)',
    nameHindi: 'मसालेदार मूंग मंगोड़ी (1 किग्रा)',
    category: 'MASALA_MANGODI',
    shape: 'MASALA',
    packetSizeGrams: 1000,
    barcode: '8906001230059',
    mrpInr: 250,
    retailPriceInr: 230,
    wholesaleT1PriceInr: 185,
    wholesaleT2PriceInr: 175,
    currentStockUnits: 42,
    reorderPointUnits: 15,
    unitCostInr: 144.0,
    image: '/assets/masala mangodi bg.png',
    gstRate: 5,
    hsnCode: '21069099',
  },
  {
    id: 'sku-palak-500',
    name: 'Palak Moong Mangodi Special (500g)',
    nameHindi: 'पालक मूंग मंगोड़ी स्पेशल (500 ग्राम)',
    category: 'SPECIALTY',
    shape: 'SPECIAL',
    packetSizeGrams: 500,
    barcode: '8906001230066',
    mrpInr: 140,
    retailPriceInr: 130,
    wholesaleT1PriceInr: 100,
    wholesaleT2PriceInr: 95,
    currentStockUnits: 35,
    reorderPointUnits: 15,
    unitCostInr: 76.0,
    image: '/assets/Gemini_Generated_Image_t0fxott0fxott0fx-Photoroom.png',
    gstRate: 5,
    hsnCode: '21069099',
  },
  {
    id: 'sku-lehsun-500',
    name: 'Lehsun Moong Mangodi Special (500g)',
    nameHindi: 'लहसुन मूंग मंगोड़ी स्पेशल (500 ग्राम)',
    category: 'SPECIALTY',
    shape: 'SPECIAL',
    packetSizeGrams: 500,
    barcode: '8906001230073',
    mrpInr: 140,
    retailPriceInr: 130,
    wholesaleT1PriceInr: 100,
    wholesaleT2PriceInr: 95,
    currentStockUnits: 28,
    reorderPointUnits: 15,
    unitCostInr: 76.0,
    image: '/assets/bg removed.png',
    gstRate: 5,
    hsnCode: '21069099',
  },
  {
    id: 'sku-chai-masala-100',
    name: 'Shahi Royal Chai Masala (100g)',
    nameHindi: 'शाही चाय मसाला (100 ग्राम)',
    category: 'SPICES_GATTE',
    shape: 'POWDER',
    packetSizeGrams: 100,
    barcode: '8906001230080',
    mrpInr: 90,
    retailPriceInr: 80,
    wholesaleT1PriceInr: 65,
    wholesaleT2PriceInr: 60,
    currentStockUnits: 55,
    reorderPointUnits: 20,
    unitCostInr: 42.0,
    image: '/assets/50802493-1d0f-4293-9a47-a6cbb41ebc72.jpeg',
    gstRate: 12,
    hsnCode: '09109100',
  },
  {
    id: 'sku-besan-gatte-500',
    name: 'Traditional Rajasthani Gatte (500g)',
    nameHindi: 'पारंपरिक राजस्थानी गट्टे (500 ग्राम)',
    category: 'SPICES_GATTE',
    shape: 'SPECIAL',
    packetSizeGrams: 500,
    barcode: '8906001230097',
    mrpInr: 110,
    retailPriceInr: 100,
    wholesaleT1PriceInr: 80,
    wholesaleT2PriceInr: 75,
    currentStockUnits: 40,
    reorderPointUnits: 15,
    unitCostInr: 54.0,
    image: '/assets/Screenshot 2026-09-14 18.55.30.png',
    gstRate: 5,
    hsnCode: '21069099',
  },
];

// Seed Customers from Excel
export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-01',
    name: 'Shri Shyam Bikana Pvt Ltd',
    phone: '9829012345',
    customerType: 'wholesale',
    area: 'Sikar Mandi',
    address: 'Shop 14, Grain Market, Sikar',
    gstin: '08AAACS1234F1Z8',
    creditLimitInr: 50000,
    totalOutstandingInr: 14500,
    totalOrdersCount: 18,
    lifetimeValueInr: 182000,
    lastOrderDate: '2026-09-14',
    createdAt: '2026-01-10',
  },
  {
    id: 'cust-02',
    name: 'Ss Brothers FMCG Distributors',
    phone: '9414056789',
    customerType: 'wholesale',
    area: 'Fatehpur',
    address: 'Near Post Office, Fatehpur, Sikar',
    gstin: '08BBFPS5678G2Z1',
    creditLimitInr: 40000,
    totalOutstandingInr: 8200,
    totalOrdersCount: 14,
    lifetimeValueInr: 126000,
    lastOrderDate: '2026-09-12',
    createdAt: '2026-01-15',
  },
  {
    id: 'cust-03',
    name: 'Rekha Sharma (Faridabad)',
    phone: '8178793392',
    customerType: 'retail',
    area: 'Faridabad / Delhi NCR',
    address: 'Sector 21B, Faridabad',
    creditLimitInr: 5000,
    totalOutstandingInr: 0,
    totalOrdersCount: 6,
    lifetimeValueInr: 8400,
    lastOrderDate: '2026-09-10',
    createdAt: '2026-03-05',
  },
  {
    id: 'cust-04',
    name: 'Shiv Prakash Joshi',
    phone: '9721458333',
    customerType: 'retail',
    area: 'Fatehpur',
    creditLimitInr: 3000,
    totalOutstandingInr: 1200,
    totalOrdersCount: 9,
    lifetimeValueInr: 12400,
    lastOrderDate: '2026-09-15',
    createdAt: '2026-02-18',
  },
  {
    id: 'cust-05',
    name: 'Sulochana Taiji Nai',
    phone: '9784081564',
    customerType: 'retail',
    area: 'Fatehpur Local',
    creditLimitInr: 2000,
    totalOutstandingInr: 450,
    totalOrdersCount: 11,
    lifetimeValueInr: 7800,
    lastOrderDate: '2026-09-13',
    createdAt: '2026-02-01',
  },
  {
    id: 'cust-06',
    name: 'Shilpa Hemant',
    phone: '7597599900',
    customerType: 'retail',
    area: 'Jaipur',
    creditLimitInr: 5000,
    totalOutstandingInr: 0,
    totalOrdersCount: 4,
    lifetimeValueInr: 6500,
    lastOrderDate: '2026-09-08',
    createdAt: '2026-04-12',
  },
  {
    id: 'cust-07',
    name: 'Monu Joshi',
    phone: '9257673822',
    customerType: 'retail',
    area: 'Fatehpur',
    creditLimitInr: 2000,
    totalOutstandingInr: 600,
    totalOrdersCount: 7,
    lifetimeValueInr: 5900,
    lastOrderDate: '2026-09-11',
    createdAt: '2026-03-20',
  },
];

// Seed Raw Materials
export const INITIAL_RAW_MATERIALS: RawMaterial[] = [
  {
    id: 'raw-dal-01',
    code: 'RM-DAL-MOGAR',
    name: 'Moong Mogar Dal (Grade A)',
    nameHindi: 'मूंग मोगर दाल (ग्रेड A)',
    category: 'DAL',
    unit: 'KG',
    currentStock: 680,
    reorderPoint: 250,
    costPerUnitInr: 92,
    supplierName: 'Nagaur Mandi Traders',
    lastRestockedDate: '2026-09-10',
  },
  {
    id: 'raw-hing-01',
    code: 'RM-SPICE-HING',
    name: 'Asafoetida / Pure Hing',
    nameHindi: 'शुद्ध हींग (Hing)',
    category: 'MASALA',
    unit: 'KG',
    currentStock: 12.5,
    reorderPoint: 4,
    costPerUnitInr: 1800,
    supplierName: 'Hathras Hing Company',
    lastRestockedDate: '2026-08-20',
  },
  {
    id: 'raw-chili-01',
    code: 'RM-SPICE-CHILI',
    name: 'Mathania Red Chili Flakes',
    nameHindi: 'मथानिया लाल मिर्च कुटी',
    category: 'MASALA',
    unit: 'KG',
    currentStock: 34,
    reorderPoint: 15,
    costPerUnitInr: 260,
    supplierName: 'Jodhpur Spices Depot',
    lastRestockedDate: '2026-09-01',
  },
  {
    id: 'raw-pouch-500',
    code: 'RM-PKG-P500',
    name: 'Printed Zip Pouch 500g (Food Grade)',
    nameHindi: 'प्रिंटेड पाउच 500 ग्राम',
    category: 'PACKAGING',
    unit: 'PCS',
    currentStock: 1850,
    reorderPoint: 500,
    costPerUnitInr: 3.8,
    supplierName: 'Jaipur Polymers & Pack',
    lastRestockedDate: '2026-09-05',
  },
  {
    id: 'raw-pouch-1000',
    code: 'RM-PKG-P1000',
    name: 'Printed Zip Pouch 1kg (Food Grade)',
    nameHindi: 'प्रिंटेड पाउच 1 किग्रा',
    category: 'PACKAGING',
    unit: 'PCS',
    currentStock: 1100,
    reorderPoint: 300,
    costPerUnitInr: 5.2,
    supplierName: 'Jaipur Polymers & Pack',
    lastRestockedDate: '2026-09-05',
  },
  {
    id: 'raw-box-carton',
    code: 'RM-PKG-BOX20',
    name: 'Outer Corrugated Carton Box (20kg)',
    nameHindi: 'मास्टर कार्टन बॉक्स (20 किग्रा)',
    category: 'PACKAGING',
    unit: 'BOX',
    currentStock: 120,
    reorderPoint: 30,
    costPerUnitInr: 28,
    supplierName: 'Sikar Packaging Mills',
    lastRestockedDate: '2026-08-25',
  },
];

// Seed Dal Lots
export const INITIAL_DAL_LOTS: DalLot[] = [
  {
    id: 'dl-2026-089',
    lotNo: 'DL-2026-089',
    supplierName: 'Nagaur Mandi Traders',
    purchaseDate: '2026-09-10',
    initialWeightKg: 500,
    availableWeightKg: 320,
    ratePerKgInr: 92,
  },
  {
    id: 'dl-2026-081',
    lotNo: 'DL-2026-081',
    supplierName: 'Bikaner Grain Supply',
    purchaseDate: '2026-08-28',
    initialWeightKg: 400,
    availableWeightKg: 95,
    ratePerKgInr: 90,
  },
];

// Seed Workers / Kaarigar
export const INITIAL_WORKERS: Worker[] = [
  {
    id: 'wrk-01',
    name: 'Sunita Devi',
    phone: '9829112233',
    pieceRatePerKgInr: 25,
    totalKgProduced: 340,
    totalEarnedInr: 8500,
  },
  {
    id: 'wrk-02',
    name: 'Kamla Bai',
    phone: '9784223344',
    pieceRatePerKgInr: 25,
    totalKgProduced: 295,
    totalEarnedInr: 7375,
  },
  {
    id: 'wrk-03',
    name: 'Anjali Bai',
    phone: '9414334455',
    pieceRatePerKgInr: 25,
    totalKgProduced: 240,
    totalEarnedInr: 6000,
  },
  {
    id: 'wrk-04',
    name: 'Ramesh Sharma (Master)',
    phone: '9602445566',
    pieceRatePerKgInr: 30,
    totalKgProduced: 410,
    totalEarnedInr: 12300,
  },
];

// Seed Production Batches
export const INITIAL_BATCHES: ProductionBatch[] = [
  {
    id: 'batch-20260912-01',
    batchCode: 'B-2026-09-12-01',
    productType: 'Lambi Plain Moong Mangodi',
    shape: 'LAMBI',
    dalLotId: 'dl-2026-081',
    dalLotNo: 'DL-2026-081',
    rawDalWeightKg: 100,
    wetMixtureWeightKg: 218,
    moistureRatio: 2.18,
    driedYieldKg: 96.5,
    shrinkagePct: 55.73,
    expectedYieldBaselinePct: 96.0,
    yieldVariancePct: 0.5,
    labourEntries: [
      { workerId: 'wrk-01', workerName: 'Sunita Devi', driedKg: 50, ratePerKgInr: 25, payoutInr: 1250 },
      { workerId: 'wrk-02', workerName: 'Kamla Bai', driedKg: 46.5, ratePerKgInr: 25, payoutInr: 1162.5 },
    ],
    totalLaborCostInr: 2412.5,
    dalCostInr: 9000,
    masalaCostInr: 500,
    grindingCostInr: 600,
    totalBatchCostInr: 12512.5,
    costPerKgInr: 129.66,
    qcChecks: {
      moisturePassed: true,
      colorPassed: true,
      tastePassed: true,
      breakagePct: 2.2,
      qcNotes: 'Golden yellow crisp color, ideal sun drying in 32°C weather.',
    },
    status: 'RELEASED',
    releaseDate: '2026-09-14',
    expiryDate: '2027-03-13',
    outputLots: [
      { skuId: 'sku-plain-lambi-500', skuName: 'Lambi Plain 500g', packetSizeGrams: 500, packagesCount: 113, lotNumber: 'LOT-L500-0914' },
      { skuId: 'sku-plain-lambi-1000', skuName: 'Lambi Plain 1kg', packetSizeGrams: 1000, packagesCount: 40, lotNumber: 'LOT-L1000-0914' },
    ],
    createdAt: '2026-09-12T08:00:00.000Z',
  },
];

// Seed Expenses
export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp-01',
    date: '2026-09-16',
    category: 'PISAI',
    note: 'Dal grinding (Pisai) 120kg at mill',
    vendor: 'Kanhaiya Flour & Dal Mill',
    paymentMethod: 'Cash',
    amountInr: 720,
    createdAt: '2026-09-16T09:15:00.000Z',
  },
  {
    id: 'exp-02',
    date: '2026-09-15',
    category: 'TRANSPORT',
    note: 'Tempo freight delivery to Sikar Mandi wholesale shops',
    vendor: 'Rajasthan Roadways Local Tempo',
    paymentMethod: 'UPI',
    amountInr: 650,
    createdAt: '2026-09-15T14:20:00.000Z',
  },
];

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
      return {
        products: parsed.products || [],
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
        activeChannel: parsed.activeChannel || 'RETAIL',
        activeCustomer: parsed.activeCustomer || null,
        cart: parsed.cart || [],
        openingCashFloat: parsed.openingCashFloat ?? 5000,
      };
    }
  } catch (e) {
    console.error('Failed to load local state:', e);
  }

  return {
    products: [],
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
    openingCashFloat: 5000,
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
      return {
        ...item,
        unitPriceInr: priceRes.unitPriceInr,
        totalInr: priceRes.totalInr,
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
      return {
        ...item,
        unitPriceInr: priceRes.unitPriceInr,
        totalInr: priceRes.totalInr,
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

    if (existing) {
      existing.quantity = targetQty;
      existing.unitPriceInr = priceRes.unitPriceInr;
      existing.totalInr = priceRes.totalInr;
    } else {
      globalState.cart.push({
        sku,
        quantity: targetQty,
        unitPriceInr: priceRes.unitPriceInr,
        totalInr: priceRes.totalInr,
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
        item.quantity = quantity;
        item.unitPriceInr = priceRes.unitPriceInr;
        item.totalInr = priceRes.totalInr;
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
      const tax = calculateTaxBreakdown(c.totalInr, c.sku.gstRate || 5, customerGstin);
      return {
        skuId: c.sku.id,
        skuName: c.sku.name,
        skuNameHindi: c.sku.nameHindi,
        shape: c.sku.shape,
        packetSizeGrams: c.sku.packetSizeGrams,
        quantity: c.quantity,
        unitPriceInr: c.unitPriceInr,
        totalInr: c.totalInr,
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
    return calculateDynamicSafetyStock(
      [65, 80, 50, 95, 70, 110, 85, 75, 90, 60],
      [3, 4, 3, 5, 2, 4],
      rm.currentStock,
      '95%'
    );
  },

  getEOQAnalytics: (rawMaterialId?: string) => {
    const rm = globalState.rawMaterials.find((r) => (!rawMaterialId ? r.category === 'DAL' : r.id === rawMaterialId)) || globalState.rawMaterials[0];
    return calculateEOQWithDiscounts(
      24000,
      500,
      18,
      [
        { tierName: 'Small Lot (< 500kg)', minQty: 0, unitPriceInr: rm.costPerUnitInr + 3 },
        { tierName: 'Standard Mandi Lot (500kg+)', minQty: 500, unitPriceInr: rm.costPerUnitInr },
        { tierName: 'Bulk Direct Mill Truck (1000kg+)', minQty: 1000, unitPriceInr: Math.max(70, rm.costPerUnitInr - 4) },
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
