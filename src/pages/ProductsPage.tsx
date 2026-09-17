import { useState, useMemo, useRef } from 'react';
import {
  Tag,
  Plus,
  Search,
  Upload,
  Download,
  Trash2,
  Edit,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  Sparkles,
  FileSpreadsheet,
  X,
  Image as ImageIcon,
  RotateCcw,
  BarChart3,
  Percent,
  BadgeIndianRupee,
  HelpCircle,
  Eye,
  Grid,
  List,
} from 'lucide-react';
import { useAppState, store, PRESET_SAMPLE_PRODUCTS } from '../lib/store';
import { toRFC4180CSV, downloadFile, parseCSV } from '../lib/csv';
import { round2, calculateTaxBreakdown } from '../lib/domain';
import { showToast } from '../components/common/Toast';
import type { ProductSKU } from '../types';

import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';

// Built-in asset gallery images
const BUILTIN_ASSET_IMAGES = [
  { label: 'Sadi Plain Mangodi (Bowl)', url: '/assets/sadi mangodi.jpeg' },
  { label: 'Sadi Plain Mangodi (Transparent BG)', url: '/assets/sadi mangodi bg.png' },
  { label: 'Masala Spiced Mangodi', url: '/assets/masala mangodi bg.png' },
  { label: 'Moong Dal Mangodi Isolated', url: '/assets/Gemini_Generated_Image_5bth1z5bth1z5bth-removebg-preview.png' },
  { label: 'Raw Moong Dal & Mangodi', url: '/assets/WhatsApp Image 2026-09-15 at 09.27.48.jpeg' },
  { label: 'Joshi Mangodi Pack', url: '/assets/50802493-1d0f-4293-9a47-a6cbb41ebc72.jpeg' },
  { label: 'Joshi Brand Logo', url: '/assets/brand logo.png' },
];

const PRESET_GRAM_OPTIONS = [200, 250, 400, 500, 1000, 2000, 5000];

interface ProductFormData {
  id?: string;
  name: string;
  nameHindi: string;
  category: ProductSKU['category'];
  shape: ProductSKU['shape'];
  packetSizeGrams: number;
  barcode: string;
  mrpInr: number;
  retailPriceInr: number;
  wholesaleT1PriceInr: number;
  wholesaleT2PriceInr: number;
  currentStockUnits: number;
  reorderPointUnits: number;
  unitCostInr: number;
  image: string;
  gstRate: number;
  hsnCode: string;
}

const DEFAULT_FORM: ProductFormData = {
  name: '',
  nameHindi: '',
  category: 'PLAIN_MANGODI',
  shape: 'LAMBI',
  packetSizeGrams: 500,
  barcode: '',
  mrpInr: 120,
  retailPriceInr: 110,
  wholesaleT1PriceInr: 87.5,
  wholesaleT2PriceInr: 82.5,
  currentStockUnits: 50,
  reorderPointUnits: 20,
  unitCostInr: 65,
  image: '/assets/sadi mangodi.jpeg',
  gstRate: 5,
  hsnCode: '21069099',
};

export default function ProductsPage() {
  const { products } = useAppState();

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [shapeFilter, setShapeFilter] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(DEFAULT_FORM);

  // Bulk CSV Modal states
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFileContent, setCsvFileContent] = useState<string>('');
  const [csvPreviewRows, setCsvPreviewRows] = useState<Array<Omit<ProductSKU, 'id'>>>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  // Image selection tab in product modal
  const [imageTab, setImageTab] = useState<'BUILTIN' | 'UPLOAD' | 'URL'>('BUILTIN');

  // Filtered products calculation
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = categoryFilter === 'ALL' || p.category === categoryFilter;
      const matchShape = shapeFilter === 'ALL' || p.shape === shapeFilter;
      const isLow = p.currentStockUnits <= p.reorderPointUnits;
      const matchStock =
        stockFilter === 'ALL' ||
        (stockFilter === 'LOW' && isLow) ||
        (stockFilter === 'OUT' && p.currentStockUnits === 0) ||
        (stockFilter === 'OK' && !isLow && p.currentStockUnits > 0);

      const q = search.trim().toLowerCase();
      const matchSearch =
        q === '' ||
        p.name.toLowerCase().includes(q) ||
        (p.nameHindi && p.nameHindi.toLowerCase().includes(q)) ||
        p.barcode.includes(q) ||
        p.hsnCode.includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.shape.toLowerCase().includes(q);

      return matchCat && matchShape && matchStock && matchSearch;
    });
  }, [products, categoryFilter, shapeFilter, stockFilter, search]);

  // Catalog metrics
  const totalStockUnits = useMemo(() => products.reduce((s, p) => s + p.currentStockUnits, 0), [products]);
  const totalStockKg = useMemo(
    () => products.reduce((s, p) => s + (p.currentStockUnits * p.packetSizeGrams) / 1000, 0),
    [products]
  );
  const totalValuationCost = useMemo(
    () => products.reduce((s, p) => s + p.currentStockUnits * p.unitCostInr, 0),
    [products]
  );
  const totalValuationRetail = useMemo(
    () => products.reduce((s, p) => s + p.currentStockUnits * p.retailPriceInr, 0),
    [products]
  );
  const lowStockCount = useMemo(
    () => products.filter((p) => p.currentStockUnits <= p.reorderPointUnits).length,
    [products]
  );

  // Helper: auto generate EAN-13 barcode
  const generateRandomBarcode = () => {
    const prefix = '890600'; // Standard Indian FMCG prefix
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    const barcode12 = prefix + randomDigits;
    // Calculate Luhn / EAN-13 checksum
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(barcode12[i], 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return barcode12 + checkDigit.toString();
  };

  // Open modal for new product
  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingProductId(null);
    setFormData({
      ...DEFAULT_FORM,
      barcode: generateRandomBarcode(),
    });
    setImageTab('BUILTIN');
    setIsFormModalOpen(true);
  };

  // Open modal for editing product
  const handleOpenEdit = (product: ProductSKU) => {
    setIsEditing(true);
    setEditingProductId(product.id);
    setFormData({
      name: product.name,
      nameHindi: product.nameHindi || '',
      category: product.category,
      shape: product.shape,
      packetSizeGrams: product.packetSizeGrams,
      barcode: product.barcode,
      mrpInr: product.mrpInr,
      retailPriceInr: product.retailPriceInr,
      wholesaleT1PriceInr: product.wholesaleT1PriceInr,
      wholesaleT2PriceInr: product.wholesaleT2PriceInr,
      currentStockUnits: product.currentStockUnits,
      reorderPointUnits: product.reorderPointUnits,
      unitCostInr: product.unitCostInr,
      image: product.image || '/assets/sadi mangodi.jpeg',
      gstRate: product.gstRate,
      hsnCode: product.hsnCode,
    });
    setImageTab(product.image?.startsWith('data:') ? 'UPLOAD' : 'BUILTIN');
    setIsFormModalOpen(true);
  };

  // Duplicate a product (convenient for making variations)
  const handleDuplicate = (product: ProductSKU) => {
    setIsEditing(false);
    setEditingProductId(null);
    setFormData({
      ...product,
      name: `${product.name} (Copy)`,
      nameHindi: product.nameHindi || '',
      image: product.image || '/assets/sadi mangodi.jpeg',
      barcode: generateRandomBarcode(),
    });
    setIsFormModalOpen(true);
  };

  // Auto-calculate Tier prices based on standard per-kg wholesale rates
  const handleAutoCalcWholesale = (grams: number) => {
    const kg = grams / 1000;
    const ws1 = round2(kg * 175); // ₹175/kg rate
    const ws2 = round2(kg * 165); // ₹165/kg rate
    const mrp = round2(kg * 240); // ~₹240/kg MRP
    const retail = round2(kg * 220); // ~₹220/kg Retail
    const cost = round2(kg * 130); // ~₹130/kg COGS

    setFormData((prev) => ({
      ...prev,
      packetSizeGrams: grams,
      mrpInr: mrp,
      retailPriceInr: retail,
      wholesaleT1PriceInr: ws1,
      wholesaleT2PriceInr: ws2,
      unitCostInr: cost,
    }));
  };

  // Handle image file upload (converts to base64 Data URL)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Image Too Large', 'Please select an image smaller than 2MB.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormData((prev) => ({ ...prev, image: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit Add / Edit Form
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast('Name Required', 'Product Name is required.', 'warning');
      return;
    }
    if (formData.retailPriceInr <= 0) {
      showToast('Invalid Price', 'Retail price must be greater than ₹0.', 'warning');
      return;
    }

    const productPayload: Omit<ProductSKU, 'id'> = {
      name: formData.name.trim(),
      nameHindi: formData.nameHindi.trim() || formData.name.trim(),
      category: formData.category,
      shape: formData.shape,
      packetSizeGrams: Number(formData.packetSizeGrams) || 500,
      barcode: formData.barcode.trim() || generateRandomBarcode(),
      mrpInr: Number(formData.mrpInr) || Number(formData.retailPriceInr),
      retailPriceInr: Number(formData.retailPriceInr),
      wholesaleT1PriceInr: Number(formData.wholesaleT1PriceInr) || Number(formData.retailPriceInr) * 0.8,
      wholesaleT2PriceInr: Number(formData.wholesaleT2PriceInr) || Number(formData.retailPriceInr) * 0.75,
      currentStockUnits: Math.max(0, Number(formData.currentStockUnits) || 0),
      reorderPointUnits: Math.max(0, Number(formData.reorderPointUnits) || 10),
      unitCostInr: Number(formData.unitCostInr) || 0,
      image: formData.image || '/assets/sadi mangodi.jpeg',
      gstRate: Number(formData.gstRate) || 5,
      hsnCode: formData.hsnCode.trim() || '21069099',
    };

    if (isEditing && editingProductId) {
      store.updateProduct(editingProductId, productPayload);
      showToast('Product Updated', `${formData.name.trim()} updated successfully.`, 'success');
    } else {
      store.addProduct(productPayload);
      showToast('Product Added', `${formData.name.trim()} added to catalog.`, 'success');
    }

    setIsFormModalOpen(false);
  };

  // Delete product
  const handleDeleteProduct = (product: ProductSKU) => {
    store.deleteProduct(product.id);
    showToast('Product Deleted', `"${product.name}" deleted from catalog.`, 'info');
  };

  // Clear all products
  const handleClearAll = () => {
    if (products.length === 0) return;
    store.clearAllProducts();
    showToast('Catalog Cleared', 'All products deleted from catalog.', 'info');
  };

  // Export current catalog to CSV
  const handleExportCSV = () => {
    if (products.length === 0) {
      showToast('No Products', 'No products in catalog to export.', 'warning');
      return;
    }
    const headers = [
      'Name',
      'NameHindi',
      'Category',
      'Shape',
      'PacketSizeGrams',
      'Barcode',
      'MRP_INR',
      'RetailPrice_INR',
      'WholesaleT1_INR',
      'WholesaleT2_INR',
      'CurrentStock',
      'ReorderPoint',
      'UnitCost_INR',
      'GSTRate_Pct',
      'HSNCode',
      'ImageURL',
    ];

    const rows = products.map((p) => [
      p.name,
      p.nameHindi || '',
      p.category,
      p.shape,
      p.packetSizeGrams,
      p.barcode,
      p.mrpInr,
      p.retailPriceInr,
      p.wholesaleT1PriceInr,
      p.wholesaleT2PriceInr,
      p.currentStockUnits,
      p.reorderPointUnits,
      p.unitCostInr,
      p.gstRate,
      p.hsnCode,
      p.image || '',
    ]);

    const csvStr = toRFC4180CSV(headers, rows);
    downloadFile(`joshi-mangodi-products-${new Date().toISOString().split('T')[0]}.csv`, csvStr);
  };

  // Download sample CSV template
  const handleDownloadTemplate = () => {
    const headers = [
      'Name',
      'NameHindi',
      'Category',
      'Shape',
      'PacketSizeGrams',
      'Barcode',
      'MRP_INR',
      'RetailPrice_INR',
      'WholesaleT1_INR',
      'WholesaleT2_INR',
      'CurrentStock',
      'ReorderPoint',
      'UnitCost_INR',
      'GSTRate_Pct',
      'HSNCode',
      'ImageURL',
    ];

    const sampleRows = [
      [
        'Lambi Plain Moong Mangodi (500g)',
        'लंबी सादी मूंग मंगोड़ी (500 ग्राम)',
        'PLAIN_MANGODI',
        'LAMBI',
        500,
        '8906001230011',
        120,
        110,
        87.5,
        82.5,
        100,
        30,
        64.5,
        5,
        '21069099',
        '/assets/sadi mangodi.jpeg',
      ],
      [
        'Spiced Masala Moong Mangodi (500g)',
        'मसालेदार मूंग मंगोड़ी (500 ग्राम)',
        'MASALA_MANGODI',
        'MASALA',
        500,
        '8906001230042',
        130,
        120,
        92.5,
        87.5,
        80,
        25,
        71.0,
        12,
        '21069099',
        '/assets/masala mangodi bg.png',
      ],
      [
        'Gol Plain Moong Mangodi (1kg)',
        'गोल सादी मूंग मंगोड़ी (1 किग्रा)',
        'PLAIN_MANGODI',
        'GOL',
        1000,
        '8906001230059',
        230,
        210,
        175.0,
        165.0,
        50,
        15,
        129.0,
        5,
        '21069099',
        '/assets/sadi mangodi.jpeg',
      ],
    ];

    const csvStr = toRFC4180CSV(headers, sampleRows);
    downloadFile('joshi-mangodi-products-template.csv', csvStr);
  };

  // Handle CSV file selection and parsing
  const handleCsvFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setCsvFileContent(text);
      processCsvText(text);
    };
    reader.readAsText(file);
  };

  const processCsvText = (text: string) => {
    const rows = parseCSV(text);
    if (rows.length < 2) {
      setCsvErrors(['CSV file is empty or missing data rows.']);
      setCsvPreviewRows([]);
      return;
    }

    const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    const parsed: Array<Omit<ProductSKU, 'id'>> = [];
    const errors: string[] = [];

    // Helper to find column index
    const colIdx = (names: string[]) => {
      return headers.findIndex((h) => names.some((n) => h.includes(n.toLowerCase().replace(/[^a-z0-9]/g, ''))));
    };

    const nameIdx = colIdx(['name', 'productname', 'title']);
    const hindiIdx = colIdx(['namehindi', 'hindiname', 'hindi']);
    const catIdx = colIdx(['category', 'cat', 'type']);
    const shapeIdx = colIdx(['shape', 'mangodishape']);
    const gramsIdx = colIdx(['packetsizegrams', 'grams', 'weight', 'size']);
    const barcodeIdx = colIdx(['barcode', 'sku', 'code']);
    const mrpIdx = colIdx(['mrpinr', 'mrp']);
    const retailIdx = colIdx(['retailpriceinr', 'retailprice', 'retail', 'price']);
    const ws1Idx = colIdx(['wholesalet1', 'ws1', 'tier1']);
    const ws2Idx = colIdx(['wholesalet2', 'ws2', 'tier2']);
    const stockIdx = colIdx(['currentstockunits', 'stock', 'qty', 'quantity']);
    const ropIdx = colIdx(['reorderpointunits', 'reorderpoint', 'rop']);
    const costIdx = colIdx(['unitcostinr', 'cost', 'cogs']);
    const gstIdx = colIdx(['gstrate', 'gst', 'tax']);
    const hsnIdx = colIdx(['hsncode', 'hsn']);
    const imgIdx = colIdx(['imageurl', 'image', 'photo']);

    if (nameIdx === -1) {
      errors.push('Required header "Name" or "Product Name" not found in CSV.');
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0 || (row.length === 1 && !row[0])) continue;

      const name = nameIdx !== -1 ? row[nameIdx] : '';
      if (!name) {
        errors.push(`Row ${i + 1}: Missing Product Name, skipping.`);
        continue;
      }

      const rawGrams = gramsIdx !== -1 ? Number(row[gramsIdx]) : 500;
      const packetSizeGrams = isNaN(rawGrams) || rawGrams <= 0 ? 500 : rawGrams;

      const rawRetail = retailIdx !== -1 ? Number(row[retailIdx]) : 110;
      const retailPriceInr = isNaN(rawRetail) || rawRetail <= 0 ? 110 : rawRetail;

      const rawMrp = mrpIdx !== -1 ? Number(row[mrpIdx]) : retailPriceInr * 1.1;
      const mrpInr = isNaN(rawMrp) ? retailPriceInr : rawMrp;

      const rawWs1 = ws1Idx !== -1 ? Number(row[ws1Idx]) : retailPriceInr * 0.8;
      const wholesaleT1PriceInr = isNaN(rawWs1) ? retailPriceInr * 0.8 : rawWs1;

      const rawWs2 = ws2Idx !== -1 ? Number(row[ws2Idx]) : retailPriceInr * 0.75;
      const wholesaleT2PriceInr = isNaN(rawWs2) ? retailPriceInr * 0.75 : rawWs2;

      const rawStock = stockIdx !== -1 ? Number(row[stockIdx]) : 0;
      const currentStockUnits = isNaN(rawStock) ? 0 : rawStock;

      const rawRop = ropIdx !== -1 ? Number(row[ropIdx]) : 20;
      const reorderPointUnits = isNaN(rawRop) ? 20 : rawRop;

      const rawCost = costIdx !== -1 ? Number(row[costIdx]) : retailPriceInr * 0.6;
      const unitCostInr = isNaN(rawCost) ? 0 : rawCost;

      const rawGst = gstIdx !== -1 ? Number(row[gstIdx]) : 5;
      const gstRate = isNaN(rawGst) ? 5 : rawGst;

      let cat: ProductSKU['category'] = 'PLAIN_MANGODI';
      if (catIdx !== -1 && row[catIdx]) {
        const cStr = row[catIdx].toUpperCase();
        if (cStr.includes('MASALA')) cat = 'MASALA_MANGODI';
        else if (cStr.includes('SPECIAL')) cat = 'SPECIALTY';
        else if (cStr.includes('SPICE') || cStr.includes('GATTE')) cat = 'SPICES_GATTE';
      }

      let shape: ProductSKU['shape'] = 'LAMBI';
      if (shapeIdx !== -1 && row[shapeIdx]) {
        const sStr = row[shapeIdx].toUpperCase();
        if (sStr.includes('GOL')) shape = 'GOL';
        else if (sStr.includes('MASALA')) shape = 'MASALA';
        else if (sStr.includes('SPECIAL')) shape = 'SPECIAL';
        else if (sStr.includes('POWDER')) shape = 'POWDER';
      }

      parsed.push({
        name,
        nameHindi: hindiIdx !== -1 && row[hindiIdx] ? row[hindiIdx] : name,
        category: cat,
        shape,
        packetSizeGrams,
        barcode: barcodeIdx !== -1 && row[barcodeIdx] ? row[barcodeIdx] : generateRandomBarcode(),
        mrpInr,
        retailPriceInr,
        wholesaleT1PriceInr,
        wholesaleT2PriceInr,
        currentStockUnits,
        reorderPointUnits,
        unitCostInr,
        image: imgIdx !== -1 && row[imgIdx] ? row[imgIdx] : '/assets/sadi mangodi.jpeg',
        gstRate,
        hsnCode: hsnIdx !== -1 && row[hsnIdx] ? row[hsnIdx] : '21069099',
      });
    }

    setCsvPreviewRows(parsed);
    setCsvErrors(errors);
  };

  const handleCommitCsvImport = () => {
    if (csvPreviewRows.length === 0) return;
    const addedCount = store.importProductsBulk(csvPreviewRows);
    showToast('Import Complete', `Successfully imported ${addedCount} products into your catalog!`, 'success');
    setIsCsvModalOpen(false);
    setCsvPreviewRows([]);
    setCsvErrors([]);
    setCsvFileContent('');
  };

  // Calculations for live preview in the modal
  const modalRetailMarginInr = round2(formData.retailPriceInr - formData.unitCostInr);
  const modalRetailMarginPct = formData.retailPriceInr > 0 ? round2((modalRetailMarginInr / formData.retailPriceInr) * 100) : 0;
  const modalWs1MarginInr = round2(formData.wholesaleT1PriceInr - formData.unitCostInr);
  const modalWs1MarginPct = formData.wholesaleT1PriceInr > 0 ? round2((modalWs1MarginInr / formData.wholesaleT1PriceInr) * 100) : 0;
  const modalTax = calculateTaxBreakdown(formData.retailPriceInr, formData.gstRate);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-white via-surface to-warning-soft p-6 rounded-xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary-soft border border-border flex items-center justify-center text-primary">
              <Tag size={22} strokeWidth={2.3} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold font-black text-ink">
                Product Catalog & Upload
              </h1>
              <p className="text-xs sm:text-sm text-ink-muted font-medium mt-0.5">
                Add, manage, and bulk upload Moong Dal Mangodi SKUs with automated 4-tier pricing
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-extrabold text-xs sm:text-sm shadow-md hover:bg-primary-hover active:scale-95 transition cursor-pointer"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Add New Product</span>
          </button>

          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border text-ink font-bold text-xs hover:bg-warning-soft active:scale-95 transition cursor-pointer shadow-xs"
          >
            <Upload size={16} />
            <span>Bulk CSV Upload</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border text-ink-muted font-bold text-xs hover:bg-warning-soft active:scale-95 transition cursor-pointer shadow-xs"
            title="Export products to CSV"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {products.length === 0 ? (
            <button
              onClick={() => {
                if (confirm('Load sample preset products to quickly explore the catalog?')) {
                  store.loadSampleProducts();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-warning-soft border border-warning-soft text-ink font-extrabold text-xs hover:bg-warning-soft active:scale-95 transition cursor-pointer"
            >
              <Sparkles size={15} />
              <span>Load Demo SKUs</span>
            </button>
          ) : (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-danger-soft border border-danger/20 text-danger font-bold text-xs hover:bg-danger-soft/80 transition cursor-pointer"
              title="Delete all products"
            >
              <Trash2 size={15} />
              <span className="hidden sm:inline">Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics Strip (Airy & Open) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="jm-card p-4 sm:p-5 flex items-center justify-between bg-card border border-border">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Total Catalog SKUs</div>
            <div className="text-2xl sm:text-3xl font-bold font-black text-ink mt-1">
              {products.length}
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">Active Products</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-primary">
            <Package size={24} />
          </div>
        </div>

        <div className="jm-card p-4 sm:p-5 flex items-center justify-between bg-card border border-border">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Total Inventory</div>
            <div className="text-2xl sm:text-3xl font-bold font-black text-ink mt-1">
              {totalStockUnits.toLocaleString('en-IN')} <span className="text-sm font-sans font-bold text-ink-muted">pkts</span>
            </div>
            <div className="text-[11px] text-success font-bold mt-0.5">
              ~{totalStockKg.toFixed(1)} kg total weight
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-success-soft border border-border flex items-center justify-center text-success">
            <Layers size={24} />
          </div>
        </div>

        <div className="jm-card p-4 sm:p-5 flex items-center justify-between bg-card border border-border">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Stock Asset Value</div>
            <div className="text-2xl sm:text-3xl font-bold font-black text-primary mt-1">
              ₹{totalValuationRetail.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              Cost: ₹{totalValuationCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-primary">
            <BadgeIndianRupee size={24} />
          </div>
        </div>

        <div className="jm-card p-4 sm:p-5 flex items-center justify-between bg-card border border-border">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Stock Health</div>
            <div className="text-2xl sm:text-3xl font-bold font-black text-ink mt-1">
              {lowStockCount > 0 ? (
                <span className="text-warning">{lowStockCount} Low</span>
              ) : (
                <span className="text-success">Healthy</span>
              )}
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              {lowStockCount > 0 ? 'Need production replenishment' : 'All SKUs above ROP'}
            </div>
          </div>
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${
            lowStockCount > 0 ? 'bg-warning-soft border-border text-warning' : 'bg-success-soft border-border text-success'
          }`}>
            {lowStockCount > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-card p-4 sm:p-5 rounded-xl border border-border shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              id="product-search"
              placeholder="Search by Product Name, Barcode (EAN), Shape, HSN Code..."
              className="jm-input pl-10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-muted cursor-pointer text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <div className="flex items-center bg-surface border border-border rounded-xl p-1">
              <button
                onClick={() => setViewMode('GRID')}
                className={`p-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'GRID' ? 'bg-card text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
                }`}
                title="Grid Card View"
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`p-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'TABLE' ? 'bg-card text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
                }`}
                title="Operations Table View"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border text-xs">
          <span className="font-extrabold text-ink-muted mr-1">Categories:</span>
          {[
            { id: 'ALL', label: 'All Categories' },
            { id: 'PLAIN_MANGODI', label: 'Sadi Plain Mangodi' },
            { id: 'MASALA_MANGODI', label: 'Masala Spiced' },
            { id: 'SPECIALTY', label: 'Specialty / Heeng' },
            { id: 'SPICES_GATTE', label: 'Spices & Gatte' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                categoryFilter === cat.id
                  ? 'bg-ink text-white shadow-xs'
                  : 'bg-surface text-ink-muted border border-border hover:bg-warning-soft'
              }`}
            >
              {cat.label}
            </button>
          ))}

          <span className="font-extrabold text-ink-muted ml-3 mr-1">Shape:</span>
          {['ALL', 'LAMBI', 'GOL', 'MASALA', 'SPECIAL'].map((sh) => (
            <button
              key={sh}
              onClick={() => setShapeFilter(sh)}
              className={`px-2.5 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                shapeFilter === sh
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface text-ink-muted border border-border hover:bg-warning-soft'
              }`}
            >
              {sh}
            </button>
          ))}
        </div>
      </div>

      {/* Main Catalog Area */}
      {products.length === 0 ? (
        /* Empty State (When user has deleted all products and is ready to upload) */
        <div className="bg-card border-2 border-dashed border-primary-soft rounded-xl p-10 sm:p-16 text-center space-y-5">
          <div className="w-20 h-20 mx-auto rounded-xl bg-gradient-to-br from-surface to-warning-soft border border-border flex items-center justify-center text-primary shadow-inner">
            <Package size={38} strokeWidth={1.8} />
          </div>

          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-bold font-black text-ink">
              Your Product Catalog is Empty
            </h2>
            <p className="text-sm text-ink-muted mt-2 leading-relaxed">
              All initial sample products have been cleared. You can now manually add your custom Mangodi SKUs by hand or upload a batch CSV spreadsheet.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-extrabold text-sm shadow-md hover:bg-primary-hover active:scale-95 transition cursor-pointer"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>Add Your First Product Manually</span>
            </button>

            <button
              onClick={() => setIsCsvModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-card border border-border text-ink font-bold text-sm hover:bg-warning-soft active:scale-95 transition cursor-pointer"
            >
              <Upload size={18} />
              <span>Import via CSV Spreadsheet</span>
            </button>

            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface border border-border text-ink-muted font-bold text-sm hover:bg-warning-soft transition cursor-pointer"
            >
              <Download size={16} />
              <span>Download CSV Template</span>
            </button>

            <button
              onClick={() => {
                if (confirm('Restore preset sample demo products?')) {
                  store.loadSampleProducts();
                }
              }}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-warning-soft border border-warning-soft text-ink font-extrabold text-xs hover:bg-warning-soft transition cursor-pointer"
            >
              <Sparkles size={15} />
              <span>Load Preset Demo Products</span>
            </button>
          </div>
        </div>
      ) : filteredProducts.length === 0 ? (
        /* Filter Empty State */
        <div className="jm-card p-12 text-center bg-card border border-border text-ink-muted">
          <Search size={42} className="mx-auto mb-2 opacity-30" />
          <h3 className="text-lg font-bold text-ink">No products match the selected filters</h3>
          <p className="text-xs text-ink-muted mt-1">Try clearing your search query or selecting "All Categories".</p>
          <button
            onClick={() => {
              setSearch('');
              setCategoryFilter('ALL');
              setShapeFilter('ALL');
              setStockFilter('ALL');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-surface border border-border text-xs font-bold hover:bg-warning-soft cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'GRID' ? (
        /* GRID VIEW (Modern, Spacious & Clean Cards) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredProducts.map((prod) => {
            const isLowStock = prod.currentStockUnits <= prod.reorderPointUnits;
            const isOutOfStock = prod.currentStockUnits === 0;
            const retailProfit = round2(prod.retailPriceInr - prod.unitCostInr);
            const retailMargin = prod.retailPriceInr > 0 ? round2((retailProfit / prod.retailPriceInr) * 100) : 0;

            return (
              <div
                key={prod.id}
                className="jm-card bg-card border border-border p-4 flex flex-col justify-between hover:shadow-lg transition-all duration-200 group rounded-xl"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-1.5 mb-2.5">
                    <span className="text-[10px] uppercase font-black text-ink-muted tracking-wider bg-surface border border-border px-2.5 py-0.5 rounded-lg">
                      {prod.shape} · {prod.packetSizeGrams >= 1000 ? `${prod.packetSizeGrams / 1000}kg` : `${prod.packetSizeGrams}g`}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                        isOutOfStock
                          ? 'bg-danger-soft text-danger border border-danger/20'
                          : isLowStock
                          ? 'bg-warning-soft text-warning border border-warning/20'
                          : 'bg-success-soft text-success border border-success/20'
                      }`}
                    >
                      {isOutOfStock ? 'Out of Stock' : `${prod.currentStockUnits} pkts`}
                    </span>
                  </div>

                  {/* Product Photo Box */}
                  <div className="relative h-40 w-full rounded-xl bg-gradient-to-b from-surface to-warning-soft flex items-center justify-center p-3 mb-3 overflow-hidden border border-border/60 group-hover:border-primary-soft transition">
                    <img
                      src={prod.image || '/assets/sadi mangodi.jpeg'}
                      alt={prod.name}
                      className="max-h-full max-w-full object-contain filter drop-shadow-md group-hover:scale-105 transition duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/assets/brand logo.png';
                      }}
                    />
                    <span className="absolute bottom-2 left-2 text-[9px] font-mono font-bold bg-card/90 backdrop-blur-xs text-ink-muted px-2 py-0.5 rounded-md border border-border shadow-2xs">
                      {prod.barcode}
                    </span>
                    <span className="absolute top-2 right-2 text-[9px] font-bold bg-ink text-white px-2 py-0.5 rounded-md">
                      GST {prod.gstRate}%
                    </span>
                  </div>

                  {/* Name & Details */}
                  <div>
                    <h3 className="font-extrabold text-sm text-ink leading-snug line-clamp-2">
                      {prod.name}
                    </h3>
                    {prod.nameHindi && prod.nameHindi !== prod.name && (
                      <p className="text-[11px] text-ink-muted font-medium mt-0.5 line-clamp-1">
                        {prod.nameHindi}
                      </p>
                    )}
                  </div>

                  {/* 4-Tier Pricing Block */}
                  <div className="mt-3.5 p-3 rounded-xl bg-surface border border-border space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-muted font-medium">Retail Price:</span>
                      <div className="text-right">
                        <span className="font-black text-ink text-sm">₹{prod.retailPriceInr}</span>
                        {prod.mrpInr > prod.retailPriceInr && (
                          <span className="text-[10px] text-ink-muted line-through ml-1.5 font-mono">
                            ₹{prod.mrpInr}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border">
                      <span className="text-ink-muted font-bold">WS Tier 1 (Bulk):</span>
                      <span className="font-extrabold text-ink">₹{prod.wholesaleT1PriceInr}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-ink-muted font-bold">WS Tier 2 (Dist.):</span>
                      <span className="font-extrabold text-ink">₹{prod.wholesaleT2PriceInr}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border text-ink-muted">
                      <span>COGS Unit Cost:</span>
                      <span className="font-mono font-bold text-ink-muted">₹{prod.unitCostInr} ({retailMargin}% margin)</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Bar */}
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(prod)}
                      className="p-2 rounded-xl bg-surface border border-border text-ink hover:bg-warning-soft active:scale-95 transition cursor-pointer"
                      title="Edit SKU"
                    >
                      <Edit size={14} />
                    </button>

                    <button
                      onClick={() => handleDuplicate(prod)}
                      className="p-2 rounded-xl bg-surface border border-border text-ink-muted hover:bg-warning-soft active:scale-95 transition cursor-pointer"
                      title="Duplicate SKU (Create Variant)"
                    >
                      <Copy size={14} />
                    </button>

                    <button
                      onClick={() => handleDeleteProduct(prod)}
                      className="p-2 rounded-xl bg-danger-soft border border-danger-soft text-danger hover:bg-danger-soft active:scale-95 transition cursor-pointer"
                      title="Delete SKU"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      store.addToCart(prod, 1);
                      showToast('Added to Cart', `Added 1 packet of "${prod.name}" to POS cart.`, 'success', 1200);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-primary-soft border border-border text-ink font-extrabold text-[11px] hover:bg-primary-hover active:scale-95 transition cursor-pointer"
                  >
                    + Add POS
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW (Dense Operations Grid) */
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface border-b border-border text-ink-muted font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="p-4">SKU Product</th>
                  <th className="p-4">Category / Shape</th>
                  <th className="p-4">Packet Weight</th>
                  <th className="p-4">Barcode / HSN</th>
                  <th className="p-4 text-right">Stock</th>
                  <th className="p-4 text-right">MRP</th>
                  <th className="p-4 text-right">Retail Price</th>
                  <th className="p-4 text-right">WS Tier 1</th>
                  <th className="p-4 text-right">WS Tier 2</th>
                  <th className="p-4 text-right">Cost (COGS)</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((prod) => {
                  const isLow = prod.currentStockUnits <= prod.reorderPointUnits;
                  return (
                    <tr key={prod.id} className="hover:bg-warning-soft/40 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={prod.image || '/assets/sadi mangodi.jpeg'}
                            alt={prod.name}
                            className="w-10 h-10 object-contain rounded-xl border border-border bg-card p-0.5"
                          />
                          <div>
                            <div className="font-extrabold text-ink text-sm">{prod.name}</div>
                            {prod.nameHindi && (
                              <div className="text-[11px] text-ink-muted">{prod.nameHindi}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-ink-muted">{prod.category}</span>
                        <div className="text-[10px] text-ink-muted">Shape: {prod.shape}</div>
                      </td>
                      <td className="p-4 font-bold text-ink">
                        {prod.packetSizeGrams >= 1000 ? `${prod.packetSizeGrams / 1000} kg` : `${prod.packetSizeGrams} g`}
                      </td>
                      <td className="p-4 font-mono text-[11px] text-ink-muted">
                        <div>{prod.barcode}</div>
                        <div className="text-[10px] text-ink-muted">HSN: {prod.hsnCode} (GST {prod.gstRate}%)</div>
                      </td>
                      <td className="p-4 text-right">
                        <span
                          className={`font-black px-2 py-0.5 rounded-full text-xs ${
                            prod.currentStockUnits === 0
                              ? 'bg-danger-soft text-danger'
                              : isLow
                              ? 'bg-warning-soft text-warning'
                              : 'bg-success-soft text-success'
                          }`}
                        >
                          {prod.currentStockUnits}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-ink-muted">₹{prod.mrpInr}</td>
                      <td className="p-4 text-right font-black text-ink text-sm">₹{prod.retailPriceInr}</td>
                      <td className="p-4 text-right font-extrabold text-ink-muted">₹{prod.wholesaleT1PriceInr}</td>
                      <td className="p-4 text-right font-extrabold text-ink-muted">₹{prod.wholesaleT2PriceInr}</td>
                      <td className="p-4 text-right font-mono text-ink-muted">₹{prod.unitCostInr}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(prod)}
                            className="p-1.5 rounded-lg border border-border hover:bg-warning-soft text-ink cursor-pointer"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDuplicate(prod)}
                            className="p-1.5 rounded-lg border border-border hover:bg-warning-soft text-ink-muted cursor-pointer"
                            title="Duplicate"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(prod)}
                            className="p-1.5 rounded-lg bg-danger-soft text-danger hover:bg-danger-soft cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 🌟 MODAL: ADD / EDIT PRODUCT (Rich, Comprehensive Form) */}
      {/* ============================================================ */}
            <Modal
        open={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={isEditing ? 'Edit Product' : 'Add New Product'}
        id="product-form"
        size="xl"
      >
        <form onSubmit={handleSubmitForm} className="space-y-6 flex-1 text-xs sm:text-sm p-1">
              {/* Section 1: Basic Information */}
              <div className="space-y-3">
                <div className="text-xs font-black uppercase text-ink-muted tracking-wider flex items-center gap-2">
                  <Package size={14} /> 1. Basic Product Info
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-extrabold text-ink mb-1">
                      Product Name (English) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Lambi Plain Moong Mangodi (500g)"
                      className="jm-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-ink mb-1">
                      Hindi Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.nameHindi}
                      onChange={(e) => setFormData({ ...formData, nameHindi: e.target.value })}
                      placeholder="e.g. लंबी सादी मूंग मंगोड़ी"
                      className="jm-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-ink mb-1">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as ProductSKU['category'] })}
                      className="jm-input"
                    >
                      <option value="PLAIN_MANGODI">Sadi Plain Mangodi</option>
                      <option value="MASALA_MANGODI">Spiced Masala Mangodi</option>
                      <option value="SPECIALTY">Specialty / Heeng Mangodi</option>
                      <option value="SPICES_GATTE">Spices & Rajasthani Gatte</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-ink mb-1">
                      Shape / Variety
                    </label>
                    <select
                      value={formData.shape}
                      onChange={(e) => setFormData({ ...formData, shape: e.target.value as ProductSKU['shape'] })}
                      className="jm-input"
                    >
                      <option value="LAMBI">LAMBI (Finger shape)</option>
                      <option value="GOL">GOL (Round shape)</option>
                      <option value="MASALA">MASALA (Spiced)</option>
                      <option value="SPECIAL">SPECIAL (Heeng / Hand-pinched)</option>
                      <option value="POWDER">POWDER / CHURA</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-ink mb-1">
                      Packet Size (Weight in Grams) *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.packetSizeGrams}
                        onChange={(e) => {
                          const g = Number(e.target.value);
                          setFormData({ ...formData, packetSizeGrams: g });
                        }}
                        className="jm-input"
                      />
                    </div>
                    {/* Quick Gram Presets */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {PRESET_GRAM_OPTIONS.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => handleAutoCalcWholesale(g)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                            formData.packetSizeGrams === g
                              ? 'bg-ink text-white'
                              : 'bg-card border border-border text-ink-muted hover:bg-warning-soft'
                          }`}
                        >
                          {g >= 1000 ? `${g / 1000}kg` : `${g}g`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Barcode & Tax Codes */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="text-xs font-black uppercase text-ink-muted tracking-wider flex items-center gap-2">
                  <BarChart3 size={14} /> 2. Barcode & GST Tax Classification
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-ink mb-1">
                      Barcode (EAN-13 / SKU Code)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        placeholder="8906001230011"
                        className="jm-input"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, barcode: generateRandomBarcode() })}
                        className="px-2.5 py-2.5 rounded-xl bg-surface border border-border text-primary font-bold text-xs hover:bg-warning-soft cursor-pointer"
                        title="Auto-generate Barcode"
                      >
                        <Sparkles size={14} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-ink mb-1">
                      GST Tax Rate (%)
                    </label>
                    <select
                      value={formData.gstRate}
                      onChange={(e) => setFormData({ ...formData, gstRate: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface text-xs font-bold text-ink focus:bg-card focus:outline-hidden focus:border-primary"
                    >
                      <option value={5}>5% (Standard Mangodi / Moong Bari)</option>
                      <option value={12}>12% (Prepared Spices / Mixtures)</option>
                      <option value={0}>0% (Exempt / Loose Raw)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-ink mb-1">
                      HSN Code
                    </label>
                    <input
                      type="text"
                      value={formData.hsnCode}
                      onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                      placeholder="21069099"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface text-xs font-mono font-bold text-ink focus:bg-card focus:outline-hidden focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: 4-Tier Pricing Engine & Unit Cost */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase text-ink-muted tracking-wider flex items-center gap-2">
                    <BadgeIndianRupee size={14} /> 3. 4-Tier Pricing Structure & Margins
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAutoCalcWholesale(formData.packetSizeGrams)}
                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles size={12} /> Auto-suggest ₹175/kg rates
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-ink-muted mb-1">
                      MRP (₹)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.mrpInr}
                      onChange={(e) => setFormData({ ...formData, mrpInr: Number(e.target.value) })}
                      className="jm-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-ink mb-1">
                      Retail Price (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={formData.retailPriceInr}
                      onChange={(e) => setFormData({ ...formData, retailPriceInr: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-primary bg-card text-sm font-black text-primary focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-ink-muted mb-1">
                      Wholesale T1 (₹)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.wholesaleT1PriceInr}
                      onChange={(e) => setFormData({ ...formData, wholesaleT1PriceInr: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-warning-soft text-sm font-black text-ink focus:bg-card"
                    />
                    <span className="text-[9px] text-ink-muted">₹175/kg bulk</span>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-ink-muted mb-1">
                      Wholesale T2 (₹)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.wholesaleT2PriceInr}
                      onChange={(e) => setFormData({ ...formData, wholesaleT2PriceInr: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-warning-soft text-sm font-black text-ink focus:bg-card"
                    />
                    <span className="text-[9px] text-ink-muted">₹165/kg dist.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-ink-muted mb-1">
                      Unit Cost / COGS (₹)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.unitCostInr}
                      onChange={(e) => setFormData({ ...formData, unitCostInr: Number(e.target.value) })}
                      className="jm-input"
                    />
                    <span className="text-[9px] text-ink-muted">Raw + Labor</span>
                  </div>
                </div>

                {/* Live Margin Calculation Card */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-surface to-warning-soft border border-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-ink-muted text-[10px] uppercase font-bold">Retail Profit</div>
                    <div className="font-extrabold text-success text-sm">
                      ₹{modalRetailMarginInr} <span className="text-[11px]">({modalRetailMarginPct}%)</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-ink-muted text-[10px] uppercase font-bold">WS-1 Profit</div>
                    <div className="font-extrabold text-success text-sm">
                      ₹{modalWs1MarginInr} <span className="text-[11px]">({modalWs1MarginPct}%)</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-ink-muted text-[10px] uppercase font-bold">Tax Base (Excl GST)</div>
                    <div className="font-mono font-bold text-ink text-sm">₹{modalTax.taxableBaseInr}</div>
                  </div>
                  <div>
                    <div className="text-ink-muted text-[10px] uppercase font-bold">CGST + SGST</div>
                    <div className="font-mono font-bold text-primary text-sm">
                      ₹{modalTax.cgstInr} + ₹{modalTax.sgstInr}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Stock & Inventory Levels */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="text-xs font-black uppercase text-ink-muted tracking-wider flex items-center gap-2">
                  <Layers size={14} /> 4. Inventory & Reorder Rules
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-ink mb-1">
                      Current Stock (Number of Packets)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.currentStockUnits}
                      onChange={(e) => setFormData({ ...formData, currentStockUnits: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface text-sm font-bold text-ink focus:bg-card"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-ink mb-1">
                      Minimum Reorder Point (ROP Alert Level)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.reorderPointUnits}
                      onChange={(e) => setFormData({ ...formData, reorderPointUnits: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface text-sm font-bold text-ink focus:bg-card"
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Product Image / Photo Selector */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="text-xs font-black uppercase text-ink-muted tracking-wider flex items-center gap-2">
                  <ImageIcon size={14} /> 5. Product Image & Photo
                </div>

                {/* Image Option Tabs */}
                <div className="flex items-center gap-2 bg-surface border border-border p-1 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setImageTab('BUILTIN')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      imageTab === 'BUILTIN' ? 'bg-ink text-white shadow-xs' : 'text-ink-muted'
                    }`}
                  >
                    Preset Gallery
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageTab('UPLOAD')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      imageTab === 'UPLOAD' ? 'bg-ink text-white shadow-xs' : 'text-ink-muted'
                    }`}
                  >
                    Upload from Device
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageTab('URL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      imageTab === 'URL' ? 'bg-ink text-white shadow-xs' : 'text-ink-muted'
                    }`}
                  >
                    Image URL
                  </button>
                </div>

                {imageTab === 'BUILTIN' && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {BUILTIN_ASSET_IMAGES.map((img) => (
                      <div
                        key={img.url}
                        onClick={() => setFormData({ ...formData, image: img.url })}
                        className={`p-2 rounded-xl border-2 transition cursor-pointer flex flex-col items-center justify-between text-center ${
                          formData.image === img.url
                            ? 'border-primary bg-surface shadow-xs'
                            : 'border-border bg-card hover:bg-warning-soft'
                        }`}
                      >
                        <div className="h-16 w-full flex items-center justify-center overflow-hidden mb-1">
                          <img src={img.url} alt={img.label} className="max-h-full object-contain" />
                        </div>
                        <span className="text-[10px] font-bold text-ink line-clamp-1">{img.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {imageTab === 'UPLOAD' && (
                  <div className="p-4 rounded-xl border-2 border-dashed border-primary-soft bg-surface text-center">
                    <input
                      ref={imageFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ImageIcon size={32} className="text-primary" />
                      <div className="font-bold text-xs text-ink">Select photo from your phone or computer</div>
                      <p className="text-[10px] text-ink-muted">Supports JPG, PNG, WebP (Max 2MB)</p>
                      <button
                        type="button"
                        onClick={() => imageFileInputRef.current?.click()}
                        className="mt-1 px-4 py-2 rounded-xl bg-primary text-white font-extrabold text-xs cursor-pointer hover:bg-primary-hover"
                      >
                        Browse Image File
                      </button>
                    </div>
                  </div>
                )}

                {imageTab === 'URL' && (
                  <div>
                    <input
                      type="url"
                      value={formData.image}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      placeholder="https://example.com/product-photo.png"
                      className="jm-input"
                    />
                  </div>
                )}

                {/* Selected Image Preview */}
                {formData.image && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border">
                    <div className="w-14 h-14 rounded-xl bg-card border border-border flex items-center justify-center p-1 overflow-hidden shrink-0">
                      <img src={formData.image} alt="Preview" className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="flex-1 truncate">
                      <div className="text-xs font-bold text-ink">Selected Image Preview</div>
                      <div className="text-[10px] text-ink-muted font-mono truncate">{formData.image.slice(0, 60)}...</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-border bg-card text-ink-muted font-bold text-xs hover:bg-warning-soft cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-primary text-white font-extrabold text-xs sm:text-sm shadow-md hover:bg-primary-hover active:scale-95 transition cursor-pointer"
                >
                  {isEditing ? 'Save Changes' : 'Create & Add Product'}
                </button>
              </div>
            </form>
      </Modal>

      {/* ============================================================ */}
      {/* 🌟 MODAL: BULK CSV UPLOAD */}
      {/* ============================================================ */}
            <Modal
        open={isCsvModalOpen}
        onClose={() => {
          setIsCsvModalOpen(false);
          setCsvPreviewRows([]);
          setCsvErrors([]);
        }}
        title="Bulk CSV Upload"
        id="csv-upload"
        size="xl"
      >
        <div className="space-y-5 flex-1 text-xs sm:text-sm p-1">
              {/* Step 1: Template Download Banner */}
              <div className="p-4 rounded-xl bg-surface border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="font-extrabold text-ink text-xs sm:text-sm">Need the CSV format spreadsheet?</div>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    Download our ready-made CSV template with all required columns (MRP, Retail, WS-1, Stock, HSN, etc.)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-2 rounded-xl bg-card border border-border text-primary font-extrabold text-xs flex items-center gap-1.5 hover:bg-warning-soft cursor-pointer shrink-0"
                >
                  <Download size={14} /> Download Template (.csv)
                </button>
              </div>

              {/* Step 2: File Dropzone */}
              <div className="p-6 rounded-xl border-2 border-dashed border-primary-soft bg-surface text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileSelected}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <Upload size={36} className="text-primary" />
                  <div className="font-extrabold text-sm text-ink">Choose your .CSV file to import</div>
                  <p className="text-xs text-ink-muted">Supports standard comma-delimited CSV exported from Excel or Google Sheets</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-white font-extrabold text-xs cursor-pointer hover:bg-primary-hover shadow-sm"
                  >
                    Select CSV File
                  </button>
                </div>
              </div>

              {/* Errors & Validation */}
              {csvErrors.length > 0 && (
                <div className="p-4 rounded-xl bg-warning-soft border border-warning/20 space-y-1">
                  <div className="font-bold text-xs text-warning flex items-center gap-1.5">
                    <AlertTriangle size={15} /> CSV Validation Notes:
                  </div>
                  {csvErrors.map((err, idx) => (
                    <p key={idx} className="text-[11px] text-ink-muted">• {err}</p>
                  ))}
                </div>
              )}

              {/* Step 3: Parsed Preview */}
              {csvPreviewRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold text-xs text-ink">
                      Parsed Preview: <span className="text-primary font-black">{csvPreviewRows.length} Products Found</span>
                    </div>
                    <span className="text-[11px] text-success font-bold flex items-center gap-1">
                      <CheckCircle2 size={13} /> Ready to import
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto rounded-xl border border-border bg-card">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-surface border-b border-border text-[10px] uppercase font-bold text-ink-muted">
                        <tr>
                          <th className="p-2.5">Product Name</th>
                          <th className="p-2.5">Weight</th>
                          <th className="p-2.5">Retail (₹)</th>
                          <th className="p-2.5">WS-1 (₹)</th>
                          <th className="p-2.5">Stock</th>
                          <th className="p-2.5">Barcode</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {csvPreviewRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-surface">
                            <td className="p-2.5 font-bold text-ink">{row.name}</td>
                            <td className="p-2.5">{row.packetSizeGrams}g</td>
                            <td className="p-2.5 font-black text-primary">₹{row.retailPriceInr}</td>
                            <td className="p-2.5 font-extrabold text-ink-muted">₹{row.wholesaleT1PriceInr}</td>
                            <td className="p-2.5 font-mono">{row.currentStockUnits}</td>
                            <td className="p-2.5 font-mono text-ink-muted">{row.barcode}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 sm:p-6 border-t border-border bg-surface flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsCsvModalOpen(false);
                  setCsvPreviewRows([]);
                  setCsvErrors([]);
                }}
                className="px-5 py-2.5 rounded-xl border border-border bg-card text-ink-muted font-bold text-xs hover:bg-warning-soft cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={csvPreviewRows.length === 0}
                onClick={handleCommitCsvImport}
                className="px-6 py-2.5 rounded-xl bg-primary text-white font-extrabold text-xs sm:text-sm shadow-md hover:bg-primary-hover active:scale-95 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import {csvPreviewRows.length} Products
              </button>
            </div>
      </Modal>
    </div>
  );
}
