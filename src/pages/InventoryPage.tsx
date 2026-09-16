import { useState, useMemo } from 'react';
import {
  Package,
  Search,
  SlidersHorizontal,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Calculator,
  ShieldCheck,
  Truck,
  Plus,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react';
import { useAppState, store } from '../lib/store';
import { t } from '../lib/i18n';
import { toRFC4180CSV, downloadFile } from '../lib/csv';
import type { RawMaterial } from '../types';

export default function InventoryPage() {
  const { rawMaterials, products, stockMovements } = useAppState();

  const [activeTab, setActiveTab] = useState<'FINISHED' | 'RAW' | 'MOVEMENTS' | 'EOQ_SAFETY'>('FINISHED');
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState<string>('ALL');

  // Add / Edit Raw Material Modal State
  const [isRawModalOpen, setIsRawModalOpen] = useState(false);
  const [editingRaw, setEditingRaw] = useState<RawMaterial | null>(null);
  const [rawName, setRawName] = useState('');
  const [rawNameHindi, setRawNameHindi] = useState('');
  const [rawCategory, setRawCategory] = useState<'DAL' | 'MASALA' | 'PACKAGING' | 'LABEL' | 'OTHER'>('DAL');
  const [rawUnit, setRawUnit] = useState<'KG' | 'PCS' | 'BOX' | 'BAG' | 'GM'>('KG');
  const [rawStock, setRawStock] = useState('100');
  const [rawRop, setRawRop] = useState('30');
  const [rawCost, setRawCost] = useState('92');
  const [rawSupplier, setRawSupplier] = useState('');

  // Stock Adjustment Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjIsRaw, setAdjIsRaw] = useState(false);
  const [adjItemId, setAdjItemId] = useState('');
  const [adjType, setAdjType] = useState<'IN' | 'OUT'>('IN');
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('New Purchase / Procurement');
  const [adjNotes, setAdjNotes] = useState('');

  // Analytics Selection
  const [selectedEoqRawId, setSelectedEoqRawId] = useState(rawMaterials[0]?.id || '');

  // Finished Goods Filtering
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const isLow = p.currentStockUnits <= p.reorderPointUnits;
      const matchFilter =
        filterState === 'ALL' ||
        (filterState === 'LOW' && isLow) ||
        (filterState === 'OK' && !isLow);

      const q = search.trim().toLowerCase();
      const matchSearch =
        q === '' ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q));

      return matchFilter && matchSearch;
    });
  }, [products, filterState, search]);

  // Raw Materials Filtering
  const filteredRaw = useMemo(() => {
    return rawMaterials.filter((r) => {
      const isLow = r.currentStock <= r.reorderPoint;
      const matchFilter =
        filterState === 'ALL' ||
        (filterState === 'LOW' && isLow) ||
        (filterState === 'OK' && !isLow);

      const q = search.trim().toLowerCase();
      const matchSearch =
        q === '' ||
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (r.supplierName && r.supplierName.toLowerCase().includes(q));

      return matchFilter && matchSearch;
    });
  }, [rawMaterials, filterState, search]);

  const lowStockCount = useMemo(() => {
    const pLow = products.filter((p) => p.currentStockUnits <= p.reorderPointUnits).length;
    const rLow = rawMaterials.filter((r) => r.currentStock <= r.reorderPoint).length;
    return pLow + rLow;
  }, [products, rawMaterials]);

  // Dynamic Safety Stock & EOQ Analytics
  const selectedRawMaterial = useMemo(() => {
    return rawMaterials.find((r) => r.id === selectedEoqRawId) || rawMaterials[0] || null;
  }, [rawMaterials, selectedEoqRawId]);

  const safetyStockMetrics = useMemo(() => {
    if (!selectedRawMaterial) return null;
    return store.getSafetyStockAnalytics(selectedRawMaterial.id);
  }, [selectedRawMaterial]);

  const eoqAnalysis = useMemo(() => {
    if (!selectedRawMaterial) return null;
    return store.getEOQAnalytics(selectedRawMaterial.id);
  }, [selectedRawMaterial]);

  // Raw Material Handlers
  const handleOpenAddRaw = () => {
    setEditingRaw(null);
    setRawName('');
    setRawNameHindi('');
    setRawCategory('DAL');
    setRawUnit('KG');
    setRawStock('100');
    setRawRop('30');
    setRawCost('92');
    setRawSupplier('');
    setIsRawModalOpen(true);
  };

  const handleOpenEditRaw = (r: RawMaterial) => {
    setEditingRaw(r);
    setRawName(r.name);
    setRawNameHindi(r.nameHindi || '');
    setRawCategory(r.category);
    setRawUnit(r.unit);
    setRawStock(String(r.currentStock));
    setRawRop(String(r.reorderPoint));
    setRawCost(String(r.costPerUnitInr));
    setRawSupplier(r.supplierName || '');
    setIsRawModalOpen(true);
  };

  const handleSaveRawMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawName.trim()) {
      alert('Please enter material name.');
      return;
    }

    if (editingRaw) {
      store.updateRawMaterial(editingRaw.id, {
        name: rawName.trim(),
        nameHindi: rawNameHindi.trim() || rawName.trim(),
        category: rawCategory,
        unit: rawUnit,
        currentStock: Number(rawStock) || 0,
        reorderPoint: Number(rawRop) || 0,
        costPerUnitInr: Number(rawCost) || 0,
        supplierName: rawSupplier.trim(),
      });
    } else {
      store.addRawMaterial({
        name: rawName.trim(),
        nameHindi: rawNameHindi.trim() || rawName.trim(),
        category: rawCategory,
        unit: rawUnit,
        currentStock: Number(rawStock) || 0,
        reorderPoint: Number(rawRop) || 0,
        costPerUnitInr: Number(rawCost) || 0,
        supplierName: rawSupplier.trim(),
      });
    }

    setIsRawModalOpen(false);
  };

  const handleDeleteRaw = (id: string, name: string) => {
    if (window.confirm(`Delete Raw Material "${name}"?`)) {
      store.deleteRawMaterial(id);
    }
  };

  // Stock Adjustment Handlers
  const handleOpenAdjust = (isRaw: boolean, id?: string) => {
    setAdjIsRaw(isRaw);
    setAdjItemId(id || (isRaw ? rawMaterials[0]?.id : products[0]?.id) || '');
    setAdjType('IN');
    setAdjQty('');
    setAdjReason('New Purchase / Procurement');
    setAdjNotes('');
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(adjQty);
    if (!qtyNum || qtyNum <= 0) {
      alert('Enter a valid positive quantity.');
      return;
    }

    if (!adjItemId) {
      alert('Please select an item to adjust.');
      return;
    }

    const signedQty = adjType === 'IN' ? qtyNum : -qtyNum;
    store.adjustStock(adjItemId, adjIsRaw, signedQty, `${adjReason}${adjNotes ? `: ${adjNotes}` : ''}`);
    setIsAdjustModalOpen(false);
  };

  const exportStockCSV = () => {
    const headers = ['Category', 'Item Name', 'Code/Barcode', 'Current Stock', 'Unit', 'Reorder Point (ROP)', 'Unit Cost (INR)'];
    const prodRows = products.map((p) => ['Finished Goods', p.name, p.barcode, p.currentStockUnits, 'PCS', p.reorderPointUnits, p.unitCostInr]);
    const rawRows = rawMaterials.map((r) => ['Raw Material', r.name, r.code, r.currentStock, r.unit, r.reorderPoint, r.costPerUnitInr]);

    const csv = toRFC4180CSV(headers, [...prodRows, ...rawRows]);
    downloadFile(`joshi-mangodi-inventory-${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  return (
    <div className="min-h-[calc(100vh-120px)] pb-32 md:pb-12 bg-[#FFFDFE]">
      {/* Top Banner */}
      <div className="bg-white border-b border-[#FCE7F3] px-3 sm:px-4 py-3 sm:py-4">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#31102A]">
              Stock & Inventory Control
            </h1>
            <p className="text-xs text-[#632055]">
              Finished Goods packets, raw moong dal, spices, pouches & live stock adjustment ledger
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            <button
              onClick={exportStockCSV}
              className="jm-btn-secondary !min-h-[38px] !text-xs flex items-center gap-1.5 flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleOpenAddRaw}
              className="jm-btn-secondary !min-h-[38px] !text-xs !font-bold flex items-center gap-1.5 flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <Plus size={15} />
              <span>+ Add Raw Material</span>
            </button>

            <button
              onClick={() => handleOpenAdjust(activeTab === 'RAW')}
              className="jm-btn-primary !min-h-[38px] !text-xs !font-extrabold flex items-center gap-1.5 shadow-sm flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <SlidersHorizontal size={15} />
              <span>Adjust Stock (+ / -)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="bg-white border-b border-[#FCE7F3] px-3 sm:px-4 py-2.5 sticky top-[80px] sm:top-[68px] z-20 shadow-xs">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Main Tabs */}
          <div className="flex items-center bg-[#FFF9FA] border border-[#FCE7F3] p-1 rounded-2xl overflow-x-auto">
            <button
              onClick={() => setActiveTab('FINISHED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'FINISHED'
                  ? 'bg-[#FBCFE8] text-[#31102A] shadow-xs border border-[#E5B6D3]'
                  : 'text-[#632055] hover:text-[#31102A]'
              }`}
            >
              <Package size={14} />
              <span>Finished Goods</span>
              <span className="bg-white px-1.5 py-0.2 rounded-full text-[10px] font-bold text-[#31102A]">
                {products.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('RAW')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'RAW'
                  ? 'bg-[#FEF08A] text-[#31102A] shadow-xs border border-[#FDE047]'
                  : 'text-[#632055] hover:text-[#31102A]'
              }`}
            >
              <Layers size={14} />
              <span>Raw Materials</span>
              <span className="bg-white px-1.5 py-0.2 rounded-full text-[10px] font-bold text-[#31102A]">
                {rawMaterials.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('MOVEMENTS')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'MOVEMENTS'
                  ? 'bg-[#31102A] text-white shadow-xs'
                  : 'text-[#632055] hover:text-[#31102A]'
              }`}
            >
              <RefreshCw size={14} />
              <span>Stock Ledger</span>
              <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                {stockMovements.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('EOQ_SAFETY')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'EOQ_SAFETY'
                  ? 'bg-[#31102A] text-white shadow-xs'
                  : 'text-[#632055] hover:text-[#31102A]'
              }`}
            >
              <Calculator size={14} />
              <span>Safety Stock & EOQ</span>
            </button>
          </div>

          {/* Search & Alerts Filter */}
          {(activeTab === 'FINISHED' || activeTab === 'RAW') && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-60">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#632055]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search item or code..."
                  className="jm-input !pl-9 !text-xs !min-h-[36px]"
                />
              </div>

              <div className="flex items-center gap-1">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'LOW', label: `Low (${lowStockCount})` },
                  { id: 'OK', label: 'Healthy' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterState(f.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      filterState === f.id
                        ? 'bg-[#31102A] text-white shadow-xs'
                        : 'bg-[#FFF9FA] text-[#632055] border border-[#FCE7F3]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto max-w-7xl px-3 sm:px-6 pt-5">
        {/* ==================== TAB 1: FINISHED GOODS ==================== */}
        {activeTab === 'FINISHED' && (
          <div>
            {products.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-white border border-dashed border-[#FCE7F3]">
                <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center mx-auto mb-3 text-[#9F1239]">
                  <Package size={32} />
                </div>
                <h3 className="text-base font-black text-[#31102A]">No Finished Goods Products</h3>
                <p className="text-xs text-[#632055] max-w-md mx-auto mt-1 mb-4">
                  Aap Products page par jakar apne Mangodi products upload kar sakte hain.
                </p>
                <a
                  href="/products"
                  className="jm-btn-primary !text-xs !font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Go to Products Management</span>
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 mb-8">
                {filteredProducts.map((prod) => {
                  const isLow = prod.currentStockUnits <= prod.reorderPointUnits;
                  return (
                    <div key={prod.id} className="jm-card p-4 bg-white flex flex-col justify-between border border-[#FCE7F3]">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase bg-[#FFF9FA] border border-[#FCE7F3] px-2 py-0.5 rounded-md text-[#632055]">
                            {prod.shape} · {prod.packetSizeGrams}g
                          </span>
                          {isLow ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 flex items-center gap-1">
                              <AlertTriangle size={11} /> LOW STOCK
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                              HEALTHY
                            </span>
                          )}
                        </div>

                        <div className="h-24 w-full rounded-xl bg-gradient-to-b from-[#FFF9FA] to-[#FEFCE8] flex items-center justify-center p-2 mb-3">
                          {prod.image ? (
                            <img src={prod.image} alt={prod.name} className="h-full object-contain" />
                          ) : (
                            <Package size={32} className="text-[#632055] opacity-40" />
                          )}
                        </div>

                        <h3 className="font-extrabold text-sm text-[#31102A]">
                          {prod.name}
                        </h3>
                        <p className="text-[11px] font-mono text-[#632055]">{prod.barcode}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#FCE7F3] space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-[#632055]">Current Stock:</span>
                          <span className="font-black text-sm text-[#31102A]">{prod.currentStockUnits} packs</span>
                        </div>

                        <div className="flex justify-between text-[11px] text-gray-500">
                          <span>Reorder Alert Point:</span>
                          <span className="font-bold">{prod.reorderPointUnits} packs</span>
                        </div>

                        <button
                          onClick={() => handleOpenAdjust(false, prod.id)}
                          className="jm-btn-secondary w-full !min-h-[32px] !text-xs !py-1 mt-2 cursor-pointer flex items-center justify-center gap-1"
                        >
                          <SlidersHorizontal size={12} />
                          <span>Adjust Stock</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 2: RAW MATERIALS ==================== */}
        {activeTab === 'RAW' && (
          <div>
            {rawMaterials.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-white border border-dashed border-[#FCE7F3]">
                <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-3 text-yellow-800">
                  <Layers size={32} />
                </div>
                <h3 className="text-base font-black text-[#31102A]">No Raw Materials Added Yet</h3>
                <p className="text-xs text-[#632055] max-w-md mx-auto mt-1 mb-4">
                  Moong Dal, Hing, Mathania Mirch, Zip Pouches, ya Master Carton Boxes ko yahan add karein taaki unka stock aur kharch track ho sake.
                </p>
                <button
                  onClick={handleOpenAddRaw}
                  className="jm-btn-primary !text-xs !font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={15} />
                  <span>+ Add First Raw Material</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-8">
                {filteredRaw.map((raw) => {
                  const isLow = raw.currentStock <= raw.reorderPoint;
                  return (
                    <div key={raw.id} className="jm-card p-4 bg-white flex flex-col justify-between border border-[#FCE7F3]">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase bg-[#FEF08A] text-[#31102A] px-2 py-0.5 rounded-md">
                            {raw.category}
                          </span>
                          {isLow ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 flex items-center gap-1">
                              <AlertTriangle size={11} /> REORDER NOW
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                              OK
                            </span>
                          )}
                        </div>

                        <h3 className="font-extrabold text-sm text-[#31102A]">
                          {raw.name}
                        </h3>
                        {raw.nameHindi && raw.nameHindi !== raw.name && (
                          <p className="text-xs text-[#632055] mt-0.5">{raw.nameHindi}</p>
                        )}
                        <p className="text-xs text-gray-500 font-mono mt-1">{raw.code}</p>
                        {raw.supplierName && (
                          <p className="text-[11px] text-gray-500 mt-0.5">Supplier: {raw.supplierName}</p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#FCE7F3] space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-[#632055]">Available Stock:</span>
                          <span className="font-black text-sm text-[#9F1239]">
                            {raw.currentStock} {raw.unit}
                          </span>
                        </div>

                        <div className="flex justify-between text-[11px] text-gray-500">
                          <span>Purchase Cost:</span>
                          <span className="font-bold">₹{raw.costPerUnitInr} / {raw.unit}</span>
                        </div>

                        <div className="flex justify-between text-[11px] text-gray-500">
                          <span>Reorder Alert:</span>
                          <span className="font-bold">{raw.reorderPoint} {raw.unit}</span>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            onClick={() => handleOpenAdjust(true, raw.id)}
                            className="flex-1 jm-btn-secondary !min-h-[30px] !text-xs !py-1 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <SlidersHorizontal size={12} />
                            <span>Adjust</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditRaw(raw)}
                            className="p-1.5 text-gray-500 hover:text-[#31102A] rounded-lg hover:bg-gray-100 border border-gray-200 transition cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteRaw(raw.id, raw.name)}
                            className="p-1.5 text-gray-400 hover:text-red-700 rounded-lg hover:bg-red-50 border border-red-200 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: STOCK LEDGER ==================== */}
        {activeTab === 'MOVEMENTS' && (
          <div className="jm-card p-4 sm:p-5 bg-white mb-8 border border-[#FCE7F3]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#FCE7F3] pb-3 mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#31102A]">
                  Stock Movement & Audit Ledger
                </h2>
                <p className="text-xs text-[#632055]">
                  Real-time history of sales deductions, production additions, and manual adjustments
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-[#FFF9FA] border border-[#FCE7F3] px-3 py-1 rounded-lg">
                  {stockMovements.length} Records
                </span>
                {stockMovements.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm('Clear all stock movement history records?')) {
                        store.clearStockMovements();
                      }
                    }}
                    className="jm-btn-secondary !min-h-[30px] !text-xs !py-1 text-gray-500 cursor-pointer"
                  >
                    Clear History
                  </button>
                )}
              </div>
            </div>

            {stockMovements.length === 0 ? (
              <div className="text-center py-10 text-xs text-gray-500">
                No stock movements logged yet. POS sales, production releases, and adjustments will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#FFF9FA] border-b border-[#FCE7F3] text-[#632055] font-bold">
                      <th className="p-2.5 sm:p-3">Date</th>
                      <th className="p-2.5 sm:p-3">Item Name</th>
                      <th className="p-2.5 sm:p-3">Type</th>
                      <th className="p-2.5 sm:p-3">Movement</th>
                      <th className="p-2.5 sm:p-3">Quantity</th>
                      <th className="p-2.5 sm:p-3">Reference / Reason</th>
                      <th className="p-2.5 sm:p-3 text-right">Operator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#FCE7F3]">
                    {stockMovements.map((mov) => (
                      <tr key={mov.id} className="hover:bg-[#FFF9FA]">
                        <td className="p-2.5 sm:p-3 font-mono">{mov.date}</td>
                        <td className="p-2.5 sm:p-3 font-extrabold text-[#31102A]">{mov.itemName}</td>
                        <td className="p-2.5 sm:p-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FFF9FA] border border-[#FCE7F3]">
                            {mov.itemType}
                          </span>
                        </td>
                        <td className="p-2.5 sm:p-3 font-semibold">{mov.movementType}</td>
                        <td className="p-2.5 sm:p-3">
                          <span
                            className={`font-black text-xs inline-flex items-center gap-1 ${
                              mov.qtySigned > 0 ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {mov.qtySigned > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                            {mov.qtySigned > 0 ? `+${mov.qtySigned}` : mov.qtySigned} {mov.unit}
                          </span>
                        </td>
                        <td className="p-2.5 sm:p-3 text-[11px] text-gray-600">
                          {mov.referenceNo || mov.reason || '—'}
                        </td>
                        <td className="p-2.5 sm:p-3 text-right text-gray-500 font-medium">{mov.operator}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 4: SAFETY STOCK & EOQ ==================== */}
        {activeTab === 'EOQ_SAFETY' && (
          <div className="space-y-6 mb-8">
            {rawMaterials.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-white border border-dashed border-[#FCE7F3]">
                <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3 text-purple-800">
                  <Calculator size={32} />
                </div>
                <h3 className="text-base font-black text-[#31102A]">No Raw Materials for Calculation</h3>
                <p className="text-xs text-[#632055] max-w-md mx-auto mt-1 mb-4">
                  Pehele "Raw Materials" tab me raw moong dal ya masala add karein taaki Safety Stock aur EOQ discount model run ho sake.
                </p>
                <button
                  onClick={handleOpenAddRaw}
                  className="jm-btn-primary !text-xs !font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={15} />
                  <span>+ Add Raw Material Now</span>
                </button>
              </div>
            ) : (
              <>
                <div className="jm-card p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[#FCE7F3]">
                  <div>
                    <h2 className="text-base font-black text-[#31102A]">Select Material for Optimization Analysis</h2>
                    <p className="text-xs text-[#632055]">Calculate safety stock buffer and best supplier discount tier</p>
                  </div>

                  <select
                    value={selectedEoqRawId}
                    onChange={(e) => setSelectedEoqRawId(e.target.value)}
                    className="jm-select !text-xs sm:w-72"
                  >
                    {rawMaterials.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.category})
                      </option>
                    ))}
                  </select>
                </div>

                {safetyStockMetrics && selectedRawMaterial && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Card 1 */}
                    <div className="jm-card p-5 bg-white space-y-4 border border-[#FCE7F3]">
                      <div className="flex items-center justify-between border-b border-[#FCE7F3] pb-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="text-[#9F1239]" size={20} />
                          <h3 className="font-black text-base text-[#31102A]">Dynamic Safety Stock & ROP</h3>
                        </div>
                        <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                          95% Service Level
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-[#FFF9FA] border border-[#FCE7F3]">
                          <div className="text-[10px] text-[#632055] font-bold uppercase">Avg Daily Demand</div>
                          <div className="text-lg font-black text-[#31102A] mt-0.5">{safetyStockMetrics.averageDailyDemand} kg/day</div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#FFF9FA] border border-[#FCE7F3]">
                          <div className="text-[10px] text-[#632055] font-bold uppercase">Lead Time</div>
                          <div className="text-lg font-black text-[#31102A] mt-0.5">{safetyStockMetrics.averageLeadTimeDays} days</div>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#FEFCE8] border border-[#FDE047] space-y-2 text-xs">
                        <div className="flex justify-between font-bold text-[#31102A]">
                          <span>Safety Stock Buffer (SS):</span>
                          <span className="text-base text-[#9F1239]">{safetyStockMetrics.safetyStockUnits} {selectedRawMaterial.unit}</span>
                        </div>
                        <div className="flex justify-between font-black text-sm text-[#31102A] pt-2 border-t border-[#FDE047]">
                          <span>Reorder Point (ROP):</span>
                          <span className="text-lg text-emerald-800">{safetyStockMetrics.reorderPointUnits} {selectedRawMaterial.unit}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2 */}
                    {eoqAnalysis && (
                      <div className="jm-card p-5 bg-white space-y-4 border border-[#FCE7F3]">
                        <div className="flex items-center justify-between border-b border-[#FCE7F3] pb-3">
                          <div className="flex items-center gap-2">
                            <Truck className="text-[#31102A]" size={20} />
                            <h3 className="font-black text-base text-[#31102A]">EOQ Quantity Discount Optimizer</h3>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#FFF9FA] border border-[#FCE7F3] flex justify-between items-center text-xs">
                          <div>
                            <div className="text-[10px] text-[#632055] font-bold uppercase">Optimal Procurement Size</div>
                            <div className="text-xl font-black text-emerald-800 mt-0.5">
                              {eoqAnalysis.optimalOrderQty} {selectedRawMaterial.unit}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-[#632055] font-bold uppercase">Selected Tier</div>
                            <div className="font-extrabold text-[#31102A]">{eoqAnalysis.bestTierName}</div>
                            <div className="text-[11px] font-black text-[#9F1239]">₹{eoqAnalysis.unitPriceInr} / {selectedRawMaterial.unit}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ==================== MODAL: ADD / EDIT RAW MATERIAL ==================== */}
      {isRawModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 border-2 border-[#FCE7F3] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-[#FCE7F3] pb-2">
              <h3 className="font-black text-base sm:text-lg text-[#31102A]">
                {editingRaw ? 'Edit Raw Material' : '+ Add New Raw Material'}
              </h3>
              <button onClick={() => setIsRawModalOpen(false)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRawMaterial} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  value={rawName}
                  onChange={(e) => setRawName(e.target.value)}
                  placeholder="e.g. Moong Mogar Dal (Grade A) / Mathania Mirch / 500g Pouch"
                  className="jm-input !text-xs !font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Hindi Name (Optional)</label>
                <input
                  type="text"
                  value={rawNameHindi}
                  onChange={(e) => setRawNameHindi(e.target.value)}
                  placeholder="e.g. मूंग मोगर दाल / शुद्ध हींग / प्रिंटेड पाउच"
                  className="jm-input !text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#31102A] mb-1">Category *</label>
                  <select
                    value={rawCategory}
                    onChange={(e) => setRawCategory(e.target.value as any)}
                    className="jm-select !text-xs"
                  >
                    <option value="DAL">DAL (दाल)</option>
                    <option value="MASALA">MASALA (मसाले)</option>
                    <option value="PACKAGING">PACKAGING (पाउच/बॉक्स)</option>
                    <option value="LABEL">LABEL (स्टीकर)</option>
                    <option value="OTHER">OTHER (अन्य)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#31102A] mb-1">Unit *</label>
                  <select
                    value={rawUnit}
                    onChange={(e) => setRawUnit(e.target.value as any)}
                    className="jm-select !text-xs"
                  >
                    <option value="KG">KG (किलो)</option>
                    <option value="PCS">PCS (पाउच/नग)</option>
                    <option value="BOX">BOX (पेटी/बॉक्स)</option>
                    <option value="BAG">BAG (बोरी)</option>
                    <option value="GM">GM (ग्राम)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#31102A] mb-1">Current Stock *</label>
                  <input
                    type="number"
                    required
                    value={rawStock}
                    onChange={(e) => setRawStock(e.target.value)}
                    placeholder="100"
                    className="jm-input !text-xs !font-black text-emerald-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#31102A] mb-1">Cost / Unit (₹)</label>
                  <input
                    type="number"
                    value={rawCost}
                    onChange={(e) => setRawCost(e.target.value)}
                    placeholder="92"
                    className="jm-input !text-xs !font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#31102A] mb-1">Reorder Alert</label>
                  <input
                    type="number"
                    value={rawRop}
                    onChange={(e) => setRawRop(e.target.value)}
                    placeholder="25"
                    className="jm-input !text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Supplier / Mandi Vendor (Optional)</label>
                <input
                  type="text"
                  value={rawSupplier}
                  onChange={(e) => setRawSupplier(e.target.value)}
                  placeholder="e.g. Nagaur Mandi Traders / Jaipur Pack Mills"
                  className="jm-input !text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRawModalOpen(false)}
                  className="jm-btn-secondary flex-1 cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="jm-btn-primary flex-1 !font-black cursor-pointer">
                  {editingRaw ? 'Update Material' : 'Save Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: STOCK ADJUSTMENT ==================== */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 border-2 border-[#FCE7F3] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-[#FCE7F3] pb-2">
              <h3 className="font-black text-base sm:text-lg text-[#31102A]">Manual Stock Adjustment</h3>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Stock Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjIsRaw(false);
                      setAdjItemId(products[0]?.id || '');
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                      !adjIsRaw ? 'bg-[#31102A] text-white' : 'bg-white text-[#632055] border-[#FCE7F3]'
                    }`}
                  >
                    Finished Goods ({products.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjIsRaw(true);
                      setAdjItemId(rawMaterials[0]?.id || '');
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                      adjIsRaw ? 'bg-[#31102A] text-white' : 'bg-white text-[#632055] border-[#FCE7F3]'
                    }`}
                  >
                    Raw Materials ({rawMaterials.length})
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Select Item *</label>
                <select
                  value={adjItemId}
                  onChange={(e) => setAdjItemId(e.target.value)}
                  className="jm-select !text-xs"
                >
                  {adjIsRaw
                    ? rawMaterials.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} (Current Stock: {r.currentStock} {r.unit})
                        </option>
                      ))
                    : products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Current Stock: {p.currentStockUnits} packs)
                        </option>
                      ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Adjustment Direction</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjType('IN')}
                    className={`py-2 rounded-xl text-xs font-black border cursor-pointer flex items-center justify-center gap-1 ${
                      adjType === 'IN'
                        ? 'bg-emerald-700 text-white border-emerald-800'
                        : 'bg-white text-emerald-800 border-emerald-200'
                    }`}
                  >
                    <ArrowUpRight size={14} />
                    <span>+ Add Stock (Inbound)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType('OUT')}
                    className={`py-2 rounded-xl text-xs font-black border cursor-pointer flex items-center justify-center gap-1 ${
                      adjType === 'OUT'
                        ? 'bg-red-700 text-white border-red-800'
                        : 'bg-white text-red-800 border-red-200'
                    }`}
                  >
                    <ArrowDownRight size={14} />
                    <span>- Deduct Stock (Out / Loss)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Quantity *</label>
                <input
                  type="number"
                  required
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  placeholder="e.g. 50"
                  className="jm-input !text-xs !font-black text-[#31102A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Reason / Reference Code *</label>
                <select
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="jm-select !text-xs"
                >
                  <option value="New Purchase / Procurement">New Purchase / Procurement (नया माल आया)</option>
                  <option value="Production Consumption">Production Consumption (उत्पादन में लगा)</option>
                  <option value="Waste / Spoilage">Waste / Spoilage (खराबी या वेस्ट)</option>
                  <option value="Packaging Breakage">Packaging Breakage (पैकिंग में नुकसान)</option>
                  <option value="Sample / Tasting">Sample / Tasting (सैंपलिंग)</option>
                  <option value="Physical Count Audit">Physical Count Audit (गिनती में संशोधन)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Notes / Description (Optional)</label>
                <input
                  type="text"
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  placeholder="e.g. Mandi invoice #441 / Physical godown count"
                  className="jm-input !text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="jm-btn-secondary flex-1 cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="jm-btn-primary flex-1 !font-black cursor-pointer">
                  Save Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
