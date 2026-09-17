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
  X,
  CheckCircle2,
} from 'lucide-react';
import { useAppState, store } from '../lib/store';
import { t } from '../lib/i18n';
import { showToast } from '../components/common/Toast';
import { toRFC4180CSV, downloadFile } from '../lib/csv';
import type { RawMaterial } from '../types';

import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';

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
  }, [selectedRawMaterial, rawMaterials]);

  const eoqAnalysis = useMemo(() => {
    if (!selectedRawMaterial) return null;
    return store.getEOQAnalytics(selectedRawMaterial.id);
  }, [selectedRawMaterial, rawMaterials]);

  // Raw Material Handlers
  const handleOpenAddRaw = () => {
    setEditingRaw(null);
    setRawName('');
    setRawNameHindi('');
    setRawCategory('DAL');
    setRawUnit('KG');
    setRawStock('100');
    setRawRop('20');
    setRawCost('90');
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
      showToast('Name Required', 'Please enter material name.', 'warning');
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
      showToast('Material Updated', `${rawName.trim()} updated.`, 'success');
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
      showToast('Material Added', `${rawName.trim()} added to inventory.`, 'success');
    }

    setIsRawModalOpen(false);
  };

  const handleDeleteRaw = (id: string, name: string) => {
    store.deleteRawMaterial(id);
    showToast('Material Removed', `Raw Material "${name}" deleted.`, 'info');
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
      showToast('Invalid Quantity', 'Enter a valid positive quantity.', 'warning');
      return;
    }

    if (!adjItemId) {
      showToast('Selection Required', 'Please select an item to adjust.', 'warning');
      return;
    }

    const signedQty = adjType === 'IN' ? qtyNum : -qtyNum;
    store.adjustStock(adjItemId, adjIsRaw, signedQty, `${adjReason}${adjNotes ? `: ${adjNotes}` : ''}`);
    showToast('Stock Adjusted', `Stock adjusted by ${signedQty > 0 ? `+${signedQty}` : signedQty}`, 'success');
    setIsAdjustModalOpen(false);
  };

  const exportStockCSV = () => {
    const headers = ['Category', 'Item Name', 'Code/Barcode', 'Current Stock', 'Unit', 'Reorder Point (ROP)', 'Unit Cost (INR)'];
    const prodRows = products.map((p) => ['Finished Goods', p.name, p.barcode, p.currentStockUnits, 'PCS', p.reorderPointUnits, p.unitCostInr]);
    const rawRows = rawMaterials.map((r) => ['Raw Material', r.name, r.code, r.currentStock, r.unit, r.reorderPoint, r.costPerUnitInr]);

    const csv = toRFC4180CSV(headers, [...prodRows, ...rawRows]);
    downloadFile(`joshi-mangodi-inventory-${new Date().toISOString().split('T')[0]}.csv`, csv);
    showToast('Download Complete', 'Inventory CSV exported successfully.', 'success');
  };

  return (
    <div className="min-h-[calc(100vh-120px)] pb-32 md:pb-12 bg-surface">
      <PageHeader
        title="Stock & Inventory Control"
        subtitle="Finished Goods packets, raw moong dal, spices, pouches & live stock adjustment ledger"
        actions={
          <>
            <button
              onClick={exportStockCSV}
              className="jm-btn-secondary flex items-center gap-1.5 flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleOpenAddRaw}
              className="jm-btn-secondary flex items-center gap-1.5 flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <Plus size={15} />
              <span>+ Add Raw Material</span>
            </button>
            <button
              onClick={() => handleOpenAdjust(activeTab === 'RAW')}
              className="jm-btn-primary flex items-center gap-1.5 shadow-sm flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <SlidersHorizontal size={15} />
              <span>Adjust Stock (+ / -)</span>
            </button>
          </>
        }
      />

      {/* Navigation Sub-Tabs */}
      <div className="bg-card border-b border-border px-4 sm:px-6 py-2.5 sticky top-[80px] sm:top-[68px] z-20 shadow-sm">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Main Tabs */}
          <div className="flex items-center bg-surface border border-border p-1 rounded-xl overflow-x-auto" role="tablist">
            <button
              onClick={() => setActiveTab('FINISHED')}
              role="tab"
              aria-selected={activeTab === 'FINISHED'}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'FINISHED'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Package size={14} />
              <span>Finished Goods</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${activeTab === 'FINISHED' ? 'bg-white/20' : 'bg-surface border border-border'}`}>
                {products.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('RAW')}
              role="tab"
              aria-selected={activeTab === 'RAW'}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'RAW'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Layers size={14} />
              <span>Raw Materials</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${activeTab === 'RAW' ? 'bg-white/20' : 'bg-surface border border-border'}`}>
                {rawMaterials.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('MOVEMENTS')}
              role="tab"
              aria-selected={activeTab === 'MOVEMENTS'}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'MOVEMENTS'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <RefreshCw size={14} />
              <span>Stock Ledger</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${activeTab === 'MOVEMENTS' ? 'bg-white/20' : 'bg-surface border border-border'}`}>
                {stockMovements.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('EOQ_SAFETY')}
              role="tab"
              aria-selected={activeTab === 'EOQ_SAFETY'}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'EOQ_SAFETY'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Calculator size={14} />
              <span>Safety Stock & EOQ</span>
            </button>
          </div>

          {/* Search & Alerts Filter */}
          {(activeTab === 'FINISHED' || activeTab === 'RAW') && (
            <div className="flex items-center gap-4">
              <div className="relative flex-1 sm:w-60">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search item or code..."
                  aria-label="Search inventory"
                  className="jm-input pl-9"
                />
              </div>

              <div className="flex items-center gap-2">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'LOW', label: `Low (${lowStockCount})` },
                  { id: 'OK', label: 'Healthy' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterState(f.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                      filterState === f.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-surface text-ink-muted border border-border'
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-5">
        {/* ==================== TAB 1: FINISHED GOODS ==================== */}
        {activeTab === 'FINISHED' && (
          <div>
            {products.length === 0 ? (
              <EmptyState
                icon={<Package size={24} />}
                title="No Finished Goods Products"
                description="Aap Products page par jakar apne Mangodi products upload kar sakte hain."
                action={
                  <button className="jm-btn-primary" onClick={() => window.location.href = '/products'}>
                    Go to Products Management
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                {filteredProducts.map((prod) => {
                  const isLow = prod.currentStockUnits <= prod.reorderPointUnits;
                  return (
                    <div key={prod.id} className="bg-card border border-border rounded-lg p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-semibold uppercase bg-surface border border-border px-2 py-0.5 rounded-md text-ink-muted">
                            {prod.shape} · {prod.packetSizeGrams}g
                          </span>
                          {isLow ? (
                            <StatusBadge variant="warning" label="Low Stock" />
                          ) : (
                            <StatusBadge variant="success" label="In Stock" />
                          )}
                        </div>

                        <div className="h-24 w-full rounded-lg bg-surface flex items-center justify-center p-2 mb-4">
                          {prod.image ? (
                            <img src={prod.image} alt={prod.name} className="h-full object-contain" />
                          ) : (
                            <Package size={32} className="text-ink-muted opacity-40" />
                          )}
                        </div>

                        <h3 className="font-semibold text-sm text-ink">
                          {prod.name}
                        </h3>
                        <p className="text-[11px] font-mono text-ink-faint mt-1">{prod.barcode}</p>
                      </div>

                      <div className="mt-4 pt-4 border-t border-border space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-ink-muted">Current Stock:</span>
                          <span className="font-semibold text-ink font-mono">{prod.currentStockUnits} packs</span>
                        </div>

                        <div className="flex justify-between items-center text-xs text-ink-faint">
                          <span>Reorder Alert Point:</span>
                          <span className="font-medium font-mono">{prod.reorderPointUnits} packs</span>
                        </div>

                        <button
                          onClick={() => handleOpenAdjust(false, prod.id)}
                          className="jm-btn-secondary w-full mt-3 cursor-pointer flex items-center justify-center gap-2"
                        >
                          <SlidersHorizontal size={14} />
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
              <EmptyState
                icon={<Layers size={24} />}
                title="No Raw Materials Added Yet"
                description="Moong Dal, Hing, Mathania Mirch, Zip Pouches, ya Master Carton Boxes ko yahan add karein taaki unka stock aur kharch track ho sake."
                action={
                  <button className="jm-btn-primary" onClick={handleOpenAddRaw}>
                    + Add First Raw Material
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {filteredRaw.map((raw) => {
                  const isLow = raw.currentStock <= raw.reorderPoint;
                  return (
                    <div key={raw.id} className="bg-card border border-border rounded-lg p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-semibold uppercase bg-surface text-ink px-2 py-0.5 rounded-md border border-border">
                            {raw.category}
                          </span>
                          {isLow ? (
                            <StatusBadge variant="warning" label="Low Stock" />
                          ) : (
                            <StatusBadge variant="success" label="In Stock" />
                          )}
                        </div>

                        <h3 className="font-semibold text-sm text-ink">
                          {raw.name}
                        </h3>
                        {raw.nameHindi && raw.nameHindi !== raw.name && (
                          <p className="text-xs text-ink-muted mt-1">{raw.nameHindi}</p>
                        )}
                        <p className="text-[11px] text-ink-faint font-mono mt-1.5">{raw.code}</p>
                        {raw.supplierName && (
                          <p className="text-[11px] text-ink-muted mt-1">Supplier: {raw.supplierName}</p>
                        )}
                      </div>

                      <div className="mt-4 pt-4 border-t border-border space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-ink-muted">Available Stock:</span>
                          <span className="font-semibold text-primary font-mono">
                            {raw.currentStock} {raw.unit}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs text-ink-muted">
                          <span>Purchase Cost:</span>
                          <span className="font-medium font-mono">₹{raw.costPerUnitInr} / {raw.unit}</span>
                        </div>

                        <div className="flex justify-between items-center text-xs text-ink-muted">
                          <span>Reorder Alert:</span>
                          <span className="font-medium font-mono">{raw.reorderPoint} {raw.unit}</span>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={() => handleOpenAdjust(true, raw.id)}
                            className="flex-1 jm-btn-secondary flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <SlidersHorizontal size={14} />
                            <span>Adjust</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditRaw(raw)}
                            className="p-2 text-ink-muted hover:text-ink rounded-lg hover:bg-surface border border-transparent hover:border-border transition cursor-pointer"
                            title="Edit"
                            aria-label="Edit raw material"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteRaw(raw.id, raw.name)}
                            className="p-2 text-ink-muted hover:text-danger rounded-lg hover:bg-danger-soft border border-transparent hover:border-danger transition cursor-pointer"
                            title="Delete"
                            aria-label="Delete raw material"
                          >
                            <Trash2 size={16} />
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
          <div className="bg-card rounded-lg p-5 sm:p-6 mb-8 border border-border">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4 mb-4">
              <div>
                <h2 className="text-base font-semibold text-ink">
                  Stock Movement & Audit Ledger
                </h2>
                <p className="text-sm text-ink-muted mt-1">
                  Real-time history of sales deductions, production additions, and manual adjustments
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold bg-surface border border-border px-3 py-1.5 rounded-lg text-ink">
                  {stockMovements.length} Records
                </span>
                {stockMovements.length > 0 && (
                  <button
                    onClick={() => {
                      const confirmed = window.confirm('Clear all stock movement history records?');
                      if (confirmed) {
                        store.clearStockMovements();
                      }
                    }}
                    className="jm-btn-secondary text-ink-muted cursor-pointer"
                  >
                    Clear History
                  </button>
                )}
              </div>
            </div>

            {stockMovements.length === 0 ? (
              <div className="text-center py-10 text-sm text-ink-muted">
                No stock movements logged yet. POS sales, production releases, and adjustments will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm" aria-label="Stock Movement Audit Ledger">
                  <thead>
                    <tr className="bg-surface border-b border-border text-xs font-semibold text-ink-muted uppercase tracking-wide">
                      <th scope="col" className="p-3">Date</th>
                      <th scope="col" className="p-3">Item Name</th>
                      <th scope="col" className="p-3">Type</th>
                      <th scope="col" className="p-3">Movement</th>
                      <th scope="col" className="p-3">Quantity</th>
                      <th scope="col" className="p-3">Reference / Reason</th>
                      <th scope="col" className="p-3 text-right">Operator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stockMovements.map((mov) => (
                      <tr key={mov.id} className="even:bg-surface hover:bg-surface">
                        <td className="p-3 font-mono text-ink">{mov.date}</td>
                        <td className="p-3 font-semibold text-ink">{mov.itemName}</td>
                        <td className="p-3">
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface border border-border text-ink-muted">
                            {mov.itemType}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-ink">{mov.movementType}</td>
                        <td className="p-3">
                          <span
                            className={`font-semibold font-mono text-sm inline-flex items-center gap-1.5 ${
                              mov.qtySigned > 0 ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {mov.qtySigned > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            {mov.qtySigned > 0 ? `+${mov.qtySigned}` : mov.qtySigned} {mov.unit}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-ink-muted">
                          {mov.referenceNo || mov.reason || '—'}
                        </td>
                        <td className="p-3 text-right text-ink-muted font-medium">{mov.operator}</td>
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
              <EmptyState
                icon={<Calculator size={24} />}
                title="No Raw Materials for Calculation"
                description="Pehele 'Raw Materials' tab me raw moong dal ya masala add karein taaki Safety Stock aur EOQ discount model run ho sake."
                action={
                  <button className="jm-btn-primary" onClick={handleOpenAddRaw}>
                    + Add Raw Material Now
                  </button>
                }
              />
            ) : (
              <>
                <div className="bg-card border border-border rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-ink">Select Material for Optimization Analysis</h2>
                    <p className="text-sm text-ink-muted mt-1">Calculate safety stock buffer and best supplier discount tier</p>
                  </div>

                  <select
                    value={selectedEoqRawId}
                    onChange={(e) => setSelectedEoqRawId(e.target.value)}
                    aria-label="Select raw material for EOQ"
                    className="jm-select sm:w-72"
                  >
                    {rawMaterials.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.category})
                      </option>
                    ))}
                  </select>
                </div>

                {safetyStockMetrics && selectedRawMaterial && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Card 1 */}
                    <div className="bg-card border border-border rounded-lg p-6 space-y-5">
                      <div className="flex items-center justify-between border-b border-border pb-4">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="text-primary" size={20} />
                          <h3 className="font-semibold text-base text-ink">Dynamic Safety Stock & ROP</h3>
                        </div>
                        <span className="text-[11px] font-medium bg-success-soft text-success px-2 py-0.5 rounded-full">
                          95% Service Level
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-4 rounded-lg bg-surface border border-border">
                          <div className="text-[11px] text-ink-muted font-semibold uppercase tracking-wide">Avg Daily Demand</div>
                          <div className="text-lg font-bold text-ink mt-1 font-mono">{safetyStockMetrics.averageDailyDemand} kg/day</div>
                        </div>

                        <div className="p-4 rounded-lg bg-surface border border-border">
                          <div className="text-[11px] text-ink-muted font-semibold uppercase tracking-wide">Lead Time</div>
                          <div className="text-lg font-bold text-ink mt-1 font-mono">{safetyStockMetrics.averageLeadTimeDays} days</div>
                        </div>
                      </div>

                      <div className="p-5 rounded-lg bg-warning-soft border border-warning/20 space-y-3 text-sm">
                        <div className="flex justify-between items-center font-medium text-ink">
                          <span>Safety Stock Buffer (SS):</span>
                          <span className="text-base text-warning font-mono font-semibold">{safetyStockMetrics.safetyStockUnits} {selectedRawMaterial.unit}</span>
                        </div>
                        <div className="flex justify-between items-center font-semibold text-base text-ink pt-3 border-t border-warning/20">
                          <span>Reorder Point (ROP):</span>
                          <span className="text-lg text-success font-mono font-bold">{safetyStockMetrics.reorderPointUnits} {selectedRawMaterial.unit}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2 */}
                    {eoqAnalysis && (
                      <div className="bg-card border border-border rounded-lg p-6 space-y-5">
                        <div className="flex items-center justify-between border-b border-border pb-4">
                          <div className="flex items-center gap-3">
                            <Truck className="text-primary" size={20} />
                            <h3 className="font-semibold text-base text-ink">EOQ Quantity Discount Optimizer</h3>
                          </div>
                        </div>

                        <div className="p-5 rounded-lg bg-surface border border-border flex justify-between items-center text-sm">
                          <div>
                            <div className="text-[11px] text-ink-muted font-semibold uppercase tracking-wide">Optimal Procurement Size</div>
                            <div className="text-xl font-bold text-success mt-1 font-mono">
                              {eoqAnalysis.optimalOrderQty} {selectedRawMaterial.unit}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-ink-muted font-semibold uppercase tracking-wide">Selected Tier</div>
                            <div className="font-semibold text-ink mt-1">{eoqAnalysis.bestTierName}</div>
                            <div className="text-xs font-semibold text-primary font-mono mt-0.5">₹{eoqAnalysis.unitPriceInr} / {selectedRawMaterial.unit}</div>
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
      <Modal
        isOpen={isRawModalOpen}
        onClose={() => setIsRawModalOpen(false)}
        title={editingRaw ? 'Edit Raw Material' : '+ Add New Raw Material'}
        id="raw-material-form"
      >
        <form onSubmit={handleSaveRawMaterial} className="space-y-4">
              <div>
                <label htmlFor="rawName" className="block text-sm font-medium text-ink mb-1.5">Item Name *</label>
                <input
                  id="rawName"
                  type="text"
                  required
                  value={rawName}
                  onChange={(e) => setRawName(e.target.value)}
                  placeholder="e.g. Moong Mogar Dal (Grade A) / Mathania Mirch / 500g Pouch"
                  className="jm-input"
                />
              </div>

              <div>
                <label htmlFor="rawNameHindi" className="block text-sm font-medium text-ink mb-1.5">Hindi Name (Optional)</label>
                <input
                  id="rawNameHindi"
                  type="text"
                  value={rawNameHindi}
                  onChange={(e) => setRawNameHindi(e.target.value)}
                  placeholder="e.g. मूंग मोगर दाल / शुद्ध हींग / प्रिंटेड पाउच"
                  className="jm-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rawCategory" className="block text-sm font-medium text-ink mb-1.5">Category *</label>
                  <select
                    id="rawCategory"
                    value={rawCategory}
                    onChange={(e) => setRawCategory(e.target.value as any)}
                    className="jm-select"
                  >
                    <option value="DAL">DAL (दाल)</option>
                    <option value="MASALA">MASALA (मसाले)</option>
                    <option value="PACKAGING">PACKAGING (पाउच/बॉक्स)</option>
                    <option value="LABEL">LABEL (स्टीकर)</option>
                    <option value="OTHER">OTHER (अन्य)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="rawUnit" className="block text-sm font-medium text-ink mb-1.5">Unit *</label>
                  <select
                    id="rawUnit"
                    value={rawUnit}
                    onChange={(e) => setRawUnit(e.target.value as any)}
                    className="jm-select"
                  >
                    <option value="KG">KG (किलो)</option>
                    <option value="PCS">PCS (पाउच/नग)</option>
                    <option value="BOX">BOX (पेटी/बॉक्स)</option>
                    <option value="BAG">BAG (बोरी)</option>
                    <option value="GM">GM (ग्राम)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="rawStock" className="block text-xs font-medium text-ink mb-1.5">Current Stock *</label>
                  <input
                    id="rawStock"
                    type="number"
                    required
                    value={rawStock}
                    onChange={(e) => setRawStock(e.target.value)}
                    placeholder="100"
                    className="jm-input font-mono text-success"
                  />
                </div>

                <div>
                  <label htmlFor="rawCost" className="block text-xs font-medium text-ink mb-1.5">Cost / Unit (₹)</label>
                  <input
                    id="rawCost"
                    type="number"
                    value={rawCost}
                    onChange={(e) => setRawCost(e.target.value)}
                    placeholder="92"
                    className="jm-input font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="rawRop" className="block text-xs font-medium text-ink mb-1.5">Reorder Alert</label>
                  <input
                    id="rawRop"
                    type="number"
                    value={rawRop}
                    onChange={(e) => setRawRop(e.target.value)}
                    placeholder="25"
                    className="jm-input font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="rawSupplier" className="block text-sm font-medium text-ink mb-1.5">Supplier / Mandi Vendor (Optional)</label>
                <input
                  id="rawSupplier"
                  type="text"
                  value={rawSupplier}
                  onChange={(e) => setRawSupplier(e.target.value)}
                  placeholder="e.g. Nagaur Mandi Traders / Jaipur Pack Mills"
                  className="jm-input"
                />
              </div>

              <div className="flex gap-4 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRawModalOpen(false)}
                  className="jm-btn-secondary flex-1 cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="jm-btn-primary flex-1 cursor-pointer">
                  {editingRaw ? 'Update Material' : 'Save Material'}
                </button>
              </div>
            </form>
      </Modal>

      {/* ==================== MODAL: STOCK ADJUSTMENT ==================== */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Manual Stock Adjustment"
        id="stock-adjustment"
      >
        <form onSubmit={handleSaveAdjustment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Stock Category</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjIsRaw(false);
                      setAdjItemId(products[0]?.id || '');
                    }}
                    className={`py-2 rounded-lg text-sm font-medium border cursor-pointer transition ${
                      !adjIsRaw ? 'bg-primary text-white border-primary' : 'bg-surface text-ink-muted border-border hover:bg-surface/80'
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
                    className={`py-2 rounded-lg text-sm font-medium border cursor-pointer transition ${
                      adjIsRaw ? 'bg-primary text-white border-primary' : 'bg-surface text-ink-muted border-border hover:bg-surface/80'
                    }`}
                  >
                    Raw Materials ({rawMaterials.length})
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="adjItemId" className="block text-sm font-medium text-ink mb-1.5">Select Item *</label>
                <select
                  id="adjItemId"
                  value={adjItemId}
                  onChange={(e) => setAdjItemId(e.target.value)}
                  className="jm-select"
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
                <label className="block text-sm font-medium text-ink mb-1.5">Adjustment Direction</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdjType('IN')}
                    className={`py-2 rounded-lg text-sm font-semibold border cursor-pointer flex items-center justify-center gap-2 transition ${
                      adjType === 'IN'
                        ? 'bg-success text-white border-success'
                        : 'bg-surface text-success border-success/30 hover:bg-success-soft'
                    }`}
                  >
                    <ArrowUpRight size={16} />
                    <span>+ Add Stock</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType('OUT')}
                    className={`py-2 rounded-lg text-sm font-semibold border cursor-pointer flex items-center justify-center gap-2 transition ${
                      adjType === 'OUT'
                        ? 'bg-danger text-white border-danger'
                        : 'bg-surface text-danger border-danger/30 hover:bg-danger-soft'
                    }`}
                  >
                    <ArrowDownRight size={16} />
                    <span>- Deduct Stock</span>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="adjQty" className="block text-sm font-medium text-ink mb-1.5">Quantity *</label>
                <input
                  id="adjQty"
                  type="number"
                  required
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  placeholder="e.g. 50"
                  className="jm-input font-mono text-ink font-semibold"
                />
              </div>

              <div>
                <label htmlFor="adjReason" className="block text-sm font-medium text-ink mb-1.5">Reason / Reference Code *</label>
                <select
                  id="adjReason"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="jm-select"
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
                <label htmlFor="adjNotes" className="block text-sm font-medium text-ink mb-1.5">Notes / Description (Optional)</label>
                <input
                  id="adjNotes"
                  type="text"
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  placeholder="e.g. Mandi invoice #441 / Physical godown count"
                  className="jm-input"
                />
              </div>

              <div className="flex gap-4 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="jm-btn-secondary flex-1 cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="jm-btn-primary flex-1 cursor-pointer">
                  Save Adjustment
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
}
