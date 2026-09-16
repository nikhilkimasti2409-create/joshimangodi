# जोशी मंगोड़ी (Joshi Mangodi Ops) - Unified Full-Stack Platform

Ek unified, high-performance, 5-page interconnected web platform jo **"Joshi Mangodi"** (Fatehpur, Sikar) ke pure manufacturing, point-of-sale, customer khata ledger, batch traceability, inventory aur finance operations ko ek single app me integrate karta hai.

---

## 🌟 5 Interconnected Modules (5 मुख्य पृष्ठ)

### 1. 🛒 POS & Counter Billing (`/pos`)
* **Touch-First Billing**: 8+ Authentic mangodi products (Lambi Plain, Gol Plain, Masala Mangodi, Palak, Lehsun, Chai Masala, Besan Gatte) 250g, 500g, 1kg sizes me.
* **Pricing Tiers**: Automatic repricing between **Retail (₹200-220/kg)**, **Wholesale Tier 1 (₹175/kg)**, aur **Wholesale Tier 2 (₹165/kg)**.
* **Customer Attachment**: Walk-in counter sale ya customer search karke attach karein.
* **Payment Modes**: Cash (quick note buttons: ₹100, ₹200, ₹500, exact change calculator), UPI QR code generator, Card, aur Udhar/Khata (Credit).
* **Thermal Receipt & WhatsApp**: Instant 80mm/A5 thermal print receipt aur 1-click WhatsApp bill send link.
* **Auto-Sync**: Har bill par Finished Goods inventory auto-deduct hoti hai aur Stock Ledger me audit log ban jata hai.

### 2. 👥 Customers & Khata Ledger (`/customers`)
* **Phone-First Directory**: Mobile number ke last 4 digits ya naam se ultra-fast search.
* **Khata & Udhar Ledger**: Har customer ka live outstanding balance, past purchase bills (+) aur jama payments (-).
* **Record Jama (Payment)**: Cash/UPI/Bank se aayi payment record karein.
* **WhatsApp Khata Reminder**: 1-click friendly reminder message with UPI ID.
* **1-Click POS Billing**: Kisi bhi customer ke profile se direct POS bill generate karein.
* **Contacts Ingest**: Phone/Google Contacts (`Contacts.vcf` ya CSV) ko automatically import karein with deduplication.

### 3. 🏭 Production & Batching Wizard (`/production`)
* **5-Step Batch Creation Wizard**:
  1. **Dal Lot Selection**: Raw Moong Dal lot select karein, dry vs wet paste ratio (2.18x) check karein.
  2. **Sun-Drying & Shrinkage**: Dhoop me sukhne ke baad dried output weight enter karein; mathematical shrinkage % aur yield variance auto-calculate hota hai.
  3. **Worker Piece-Rate Payouts**: Karigaron (Sunita Devi, Kamla Bai, Ramesh) ko output kg assign karein aur ₹25-₹30/kg ke hisaab se instant majdoori calculate karein.
  4. **Quality Control (QC) Gate**: Moisture, color, taste aur breakage % (<8%) verify karein.
  5. **Release to Stock & COGS**: Dal + Masale + Pisai + Majdoori = Exact COGS per kg & per pouch roll-up, +180 days expiry date ke sath stock lot release.
* **Bi-directional Traceability Graph**: Raw Dal Mandi Purchase Lot ➔ Production Batch ➔ Finished Stock Lot ➔ POS Customer Order tracking.

### 4. 📦 Inventory & Stock Ledger (`/inventory`)
* **Segmented View**:
  * **Raw Materials (कच्चा माल)**: Moong Mogar Dal, Pure Hing, Mathania Chili, Packaging Pouches (500g/1kg), Outer Master Cartons.
  * **Finished Goods (तैयार माल)**: All packaged Mangodi SKUs.
* **ROP Alerts**: Low stock & Reorder Point alerts.
* **Append-Only Movement Ledger**: Procurement, Production release, POS sale consumption, aur Adjustments ka immutable audit trail.
* **Stock Adjustments**: Waste, Sampling, Breakage, aur Count Audit ke reason codes ke sath stock adjust karein.

### 5. 💰 Finance, Cash Drawer & Logistics (`/finance`)
* **Real-time P&L Statement**: Gross Revenue (B2B vs B2C), COGS, Operating Expenses, aur Net Profit Margin.
* **Daily Cash Drawer Reconciliation (दैनिक गल्ला रोकड़)**:
  * Morning Opening Float + Today Cash Sales - Today Cash Expenses = Expected Cash.
  * Note counter (₹500, ₹200, ₹100, ₹50, ₹20, ₹10, Coins) ke sath physical count vs expected cash variance calculation.
  * Day-end drawer close & archive history.
* **Operational Expense Logger**: Dal Pisai, Freight/Tempo Transport, Packaging spares, Electricity, etc.
* **Logistics Board**: Outbound delivery routes, driver/vehicle tracking, aur Inbound supplier shipments.
* **GST & Data Export**: RFC-4180 compliant GSTR-1 CSV (B2B & B2C), Expenses CSV, aur Full offline JSON backup & restore.

---

## 🚀 Run & Develop (चलाने के निर्देश)

Project directory me jayein:
```bash
cd "/home/nikhilkimasti2409/Joshi mangodi (1)/website/joshi-mangodi-ops"
```

Development server start karein:
```bash
npm run dev
```

Production build test karein:
```bash
npm run build
npm run preview
```

---

## 🎨 Design Tokens & Accessibility (WCAG AAA)
* **Background (`--jm-surface`)**: `#FFF9FA` (Ultra-light warm pink)
* **Elevated Cards (`--jm-surface-alt`)**: `#FEFCE8` (Light yellow)
* **Primary Text (`--jm-ink`)**: `#31102A` (Deep dark plum for AAA contrast)
* **Secondary Text (`--jm-ink-soft`)**: `#632055` (Muted dark plum)
* **Primary Buttons (`--jm-primary`)**: `#FBCFE8` (Warm interactive pink)
* **Focus / Active (`--jm-focus`)**: `#FEF08A` (Vivid yellow)
* **Bilingual Engine**: Hindi (हिन्दी) aur English toggle available on top navigation.
