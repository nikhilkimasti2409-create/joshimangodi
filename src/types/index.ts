export type SalesChannel = 'RETAIL' | 'WHOLESALE_T1' | 'WHOLESALE_T2';
export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Credit';
export type CustomerType = 'retail' | 'wholesale';

export interface ProductSKU {
  id: string;
  name: string;
  nameHindi: string;
  category: 'PLAIN_MANGODI' | 'MASALA_MANGODI' | 'SPECIALTY' | 'SPICES_GATTE';
  shape: 'LAMBI' | 'GOL' | 'MASALA' | 'SPECIAL' | 'POWDER';
  packetSizeGrams: number; // e.g. 250, 500, 1000
  barcode: string;
  mrpInr: number;
  retailPriceInr: number;
  wholesaleT1PriceInr: number; // Tier 1: ₹175/kg rate
  wholesaleT2PriceInr: number; // Tier 2: ₹165/kg rate
  currentStockUnits: number;
  reorderPointUnits: number;
  unitCostInr: number; // COGS
  image?: string;
  gstRate: number; // e.g. 5 for Mangodi, 12 for Masala
  hsnCode: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  customerType: CustomerType;
  area?: string;
  address?: string;
  gstin?: string;
  creditLimitInr: number;
  totalOutstandingInr: number;
  totalOrdersCount: number;
  lifetimeValueInr: number;
  lastOrderDate?: string;
  contractPricePerKg?: number; // Custom price override
  createdAt: string;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  amountInr: number;
  paymentMethod: PaymentMethod;
  referenceNo?: string;
  notes?: string;
  date: string;
  createdAt: string;
}

export interface CartItem {
  sku: ProductSKU;
  quantity: number;
  unitPriceInr: number;
  totalInr: number;
}

export interface OrderLineItem {
  skuId: string;
  skuName: string;
  skuNameHindi?: string;
  shape: string;
  packetSizeGrams: number;
  quantity: number;
  unitPriceInr: number;
  totalInr: number;
  gstRate: number;
  gstAmount: number;
  batchLotId?: string;
}

export interface Order {
  id: string;
  billNo: string;
  channel: SalesChannel;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerGstin?: string | null;
  items: OrderLineItem[];
  subtotalInr: number;
  discountInr: number;
  gstAmountInr: number;
  grandTotalInr: number;
  paymentMethod: PaymentMethod;
  amountPaidInr: number;
  creditAddedInr: number;
  changeDueInr: number;
  notes?: string;
  date: string;
  createdAt: string;
  isVoid?: boolean;
  voidReason?: string;
}

// Production & Manufacturing Domain
export interface DalLot {
  id: string;
  lotNo: string;
  supplierName: string;
  purchaseDate: string;
  initialWeightKg: number;
  availableWeightKg: number;
  ratePerKgInr: number;
  dalType?: string;
  notes?: string;
}

export interface Worker {
  id: string;
  name: string;
  phone: string;
  role?: string; // e.g. "Mangodi Belan / Extrusion", "Dal Soaking & Grinding", "Sun-Drying & Quality Sorting", "Packaging & Sealing", "Master Supervisor"
  pieceRatePerKgInr: number; // e.g. ₹25/kg
  dailyWageInr?: number;
  totalKgProduced: number;
  totalEarnedInr: number;
  status?: 'ACTIVE' | 'INACTIVE';
  joinedDate?: string;
  notes?: string;
}

export interface WorkerLaborEntry {
  workerId: string;
  workerName: string;
  driedKg: number;
  ratePerKgInr: number;
  payoutInr: number;
}

export type BatchStatus = 'DRYING' | 'QC_CHECK' | 'CURING' | 'RELEASED' | 'REJECTED';

export interface ProductionBatch {
  id: string;
  batchCode: string; // e.g. B-2026-09-16-01
  productType: string;
  shape: 'LAMBI' | 'GOL' | 'MASALA' | 'SPECIAL';
  dalLotId: string;
  dalLotNo: string;
  rawDalWeightKg: number;
  wetMixtureWeightKg: number;
  moistureRatio: number; // Wet / Dry
  driedYieldKg: number;
  shrinkagePct: number; // % shrinkage during sun drying
  expectedYieldBaselinePct: number; // ~95%
  yieldVariancePct: number;
  labourEntries: WorkerLaborEntry[];
  totalLaborCostInr: number;
  dalCostInr: number;
  masalaCostInr: number;
  grindingCostInr: number; // Pisai
  totalBatchCostInr: number;
  costPerKgInr: number;
  qcChecks: {
    moisturePassed: boolean;
    colorPassed: boolean;
    tastePassed: boolean;
    breakagePct: number;
    qcNotes?: string;
  };
  status: BatchStatus;
  releaseDate?: string;
  expiryDate?: string; // +180 days
  outputLots: {
    skuId: string;
    skuName: string;
    packetSizeGrams: number;
    packagesCount: number;
    lotNumber: string;
  }[];
  createdAt: string;
}

// Inventory & Stock Domain
export interface RawMaterial {
  id: string;
  code: string;
  name: string;
  nameHindi: string;
  category: 'DAL' | 'MASALA' | 'PACKAGING' | 'LABEL' | 'OTHER';
  unit: 'KG' | 'PCS' | 'BOX' | 'BAG' | 'GM';
  currentStock: number;
  reorderPoint: number;
  costPerUnitInr: number;
  supplierName: string;
  lastRestockedDate: string;
}

export type MovementType = 'PROCUREMENT' | 'PRODUCTION_IN' | 'PRODUCTION_CONSUMED' | 'POS_SALE' | 'ADJUSTMENT' | 'VOID_RESTOCK';

export interface StockMovement {
  id: string;
  date: string;
  itemId: string;
  itemName: string;
  itemType: 'FINISHED_GOODS' | 'RAW_MATERIAL';
  movementType: MovementType;
  qtySigned: number; // positive = added, negative = deducted
  unit: string;
  referenceNo?: string;
  reason?: string; // 'Waste', 'Broken', 'Sample', 'Audit correction'
  operator: string;
  createdAt: string;
}

// Finance & Cash Drawer Domain
export interface Expense {
  id: string;
  date: string;
  category: 'PISAI' | 'TRANSPORT' | 'PACKAGING' | 'LABOR' | 'ENERGY' | 'MISC';
  note: string;
  vendor: string;
  paymentMethod: PaymentMethod;
  amountInr: number;
  createdAt: string;
}

export interface CashDenominations {
  n500: number;
  n200: number;
  n100: number;
  n50: number;
  n20: number;
  n10: number;
  coins: number;
}

export interface CashDrawerReconciliation {
  id: string;
  date: string;
  openingFloatInr: number;
  cashSalesInr: number;
  cashExpensesInr: number;
  expectedCashInr: number;
  countedCashInr: number;
  varianceInr: number;
  denominations: CashDenominations;
  nextDayFloatInr: number;
  operator: string;
  notes?: string;
  closedAt: string;
}

// Logistics Domain
export interface DispatchTicket {
  id: string;
  ticketNo: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  destinationArea: string;
  status: 'pending' | 'in-transit' | 'delivered';
  totalKg: number;
  stops: {
    id: string;
    orderNo: string;
    customerName: string;
    customerAddress: string;
    kg: number;
    amountInr: number;
    status: 'pending' | 'delivered';
  }[];
  date: string;
  notes?: string;
}

export interface InboundShipment {
  id: string;
  shipmentNo: string;
  supplierName: string;
  rawMaterialName: string;
  orderedKg: number;
  receivedKg?: number;
  ratePerKgInr: number;
  vehicleInfo: string;
  driverName: string;
  status: 'pending' | 'in-transit' | 'delivered';
  date: string;
  notes?: string;
}
