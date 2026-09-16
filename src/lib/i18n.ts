// English-first Dictionary and Constants

export const DICTIONARY = {
  // Navigation
  nav_pos: 'POS & Billing',
  nav_customers: 'Customers & Khata',
  nav_production: 'Production & Yield',
  nav_inventory: 'Stock & FEFO',
  nav_finance: 'Finance & Logistics',
  
  // Channels
  channel_retail: 'Retail Counter',
  channel_wholesale_t1: 'Wholesale Tier 1 (₹175/kg)',
  channel_wholesale_t2: 'Wholesale Tier 2 (₹165/kg)',

  // POS
  pos_title: 'Point of Sale Counter',
  pos_search_placeholder: 'Search product, SKU, barcode (F2)...',
  pos_cart: 'Current Bill',
  pos_clear_cart: 'Clear Cart',
  pos_checkout: 'Complete Bill',
  pos_total: 'Grand Total',
  pos_walk_in: 'Walk-in Customer (Counter Sale)',
  pos_select_customer: 'Attach Customer',
  
  // Customers
  cust_title: 'Customer Khata Directory',
  cust_search: 'Search by name or last 4 digits of phone...',
  cust_add_new: '+ Add Customer',
  cust_outstanding: 'Total Outstanding Khata',
  cust_record_payment: 'Record Payment (Jama)',
  cust_open_bill: 'Open Bill',
  
  // Production
  prod_title: 'Batch Manufacturing & Sun-Drying',
  prod_new_batch: '+ Start New Batch',
  prod_shrinkage: 'Shrinkage & Yield',
  prod_labor: 'Worker Piece-Rate Payouts',
  prod_qc: 'Quality Gate & Release',
  prod_trace: 'Batch Traceability Graph',

  // Inventory
  inv_title: 'Inventory Ledger & FEFO Batches',
  inv_raw: 'Raw Materials (Dal & Packaging)',
  inv_finished: 'Finished Goods (Packaged Mangodi)',
  inv_adjust: 'Adjust Stock',
  inv_low_alert: 'Low Stock Alert',
  inv_near_expiry: 'Near Expiry',

  // Finance
  fin_title: 'Business P&L & Cash Drawer',
  fin_drawer: 'Daily Cash Drawer',
  fin_expenses: 'Expense Tracker',
  fin_logistics: 'Logistics & Dispatch Board',
  fin_gst: 'GST & Day-Book Export',

  // Common
  save: 'Save',
  cancel: 'Cancel',
  print: 'Print Thermal Receipt',
  share_whatsapp: 'Send on WhatsApp',
  offline_status: 'Offline Safe (Local Storage Active)',
  online_status: 'Live & Synchronized',
};

export function t(key: keyof typeof DICTIONARY): string {
  return DICTIONARY[key] || key;
}
