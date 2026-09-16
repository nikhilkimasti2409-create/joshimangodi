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
  TrendingDown,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import { useAppState, store } from '../lib/store';
import { t } from '../lib/i18n';
import { toRFC4180CSV, downloadFile } from '../lib/csv';
import {
  calculateDynamicSafetyStock,
  calculateEOQWithDiscounts,
  allocateBatchesFEFO,
} from '../lib/domain';

export default function InventoryPage() {
  const { rawMaterials, products, stockMovements, productionBatches } = useAppState();

  const [activeTab, setActiveTab] = useState<'FINISHED' | 'RAW' | 'EOQ_SAFETY'>('FINISHED');
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState<string>('ALL');
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedEoqRawId, setSelectedEoqRawId] = useState(rawMaterials[0]?.id || '');

  // Adjustment Modal State
  const [adjIsRaw, setAdjIsRaw] = useState(false);
  const [adjItemId, setAdjItemId] = useState('');
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('Waste');
  const [adjNotes, setAdjNotes] = useState('');

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
        p.barcode.includes(q);

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
        r.code.toLowerCase().includes(q);

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
    return rawMaterials.find((r) => r.id === selectedEoqRawId) || rawMaterials[0];
  }, [rawMaterials, selectedEoqRawId]);

  const safetyStockMetrics = useMemo(() => {
    return store.getSafetyStockAnalytics(selectedRawMaterial?.id);
  }, [selectedRawMaterial]);

  const eoqAnalysis = useMemo(() => {
    return store.getEOQAnalytics(selectedRawMaterial?.id);
  }, [selectedRawMaterial]);

  const handleOpenAdjust = (isRaw: boolean, id?: string) => {
    setAdjIsRaw(isRaw);
    setAdjItemId(id || (isRaw ? rawMaterials[0]?.id : products[0]?.id) || '');
    setAdjQty('');
    setAdjReason('Waste');
    setAdjNotes('');
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(adjQty);
    if (!qtyNum) {
      alert('Enter a valid non-zero adjustment quantity.');
      return;
    }

    store.adjustStock(adjItemId, adjIsRaw, qtyNum, `${adjReason}: ${adjNotes}`);
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
    <div className="min-h-[calc(100vh-120px)] pb-32 md:pb-12">
      {/* Top Banner */}
      <div className="bg-white border-b border-[#FCE7F3] px-3 sm:px-4 py-3 sm:py-4">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#31102A]">
              Inventory & Procurement Mathematics
            </h1>
            <p className="text-xs text-[#632055]">
              Real-time stock ledger, dynamic safety stock (ROP) & EOQ all-units quantity discounts
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={exportStockCSV}
              className="jm-btn-secondary !min-h-[38px] !text-xs flex items-center gap-1.5 flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              <span>Export Stock CSV</span>
            </button>

            <button
              onClick={() => handleOpenAdjust(activeTab === 'RAW')}
              className="jm-btn-primary !min-h-[38px] !text-xs !font-extrabold flex items-center gap-1.5 shadow-sm flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <SlidersHorizontal size={15} />
              <span>Adjust Stock</span>
            </button>
          </div>
        </div>
      </div>

      {/* Segmented Controls & Search Bar */}
      <div className="bg-white border-b border-[#FCE7F3] px-3 sm:px-4 py-2.5 sticky top-[80px] sm:top-[68px] z-20 shadow-xs">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Main Segmented Tab */}
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
              onClick={() => setActiveTab('EOQ_SAFETY')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'EOQ_SAFETY'
                  ? 'bg-[#31102A] text-white shadow-xs'
                  : 'text-[#632055] hover:text-[#31102A]'
              }`}
            >
              <Calculator size={14} />
              <span>Safety Stock & EOQ Math</span>
              <span className="bg-[#FEF08A] text-[#31102A] px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                Optimized
              </span>
            </button>
          </div>

          {/* Search & Alerts Filter (When in Finished or Raw tabs) */}
          {activeTab !== 'EOQ_SAFETY' && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-60">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#632055]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search SKU or code..."
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

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-3 sm:px-6 pt-4">
        {activeTab === 'FINISHED' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 mb-8">
            {filteredProducts.map((prod) => {
              const isLow = prod.currentStockUnits <= prod.reorderPointUnits;
              return (
                <div key={prod.id} className="jm-card p-4 bg-white flex flex-col justify-between">
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
                      <span>Reorder Point (ROP):</span>
                      <span className="font-bold">{prod.reorderPointUnits} packs</span>
                    </div>

                    <button
                      onClick={() => handleOpenAdjust(false, prod.id)}
                      className="jm-btn-secondary w-full !min-h-[32px] !text-xs !py-1 mt-2 cursor-pointer"
                    >
                      Adjust Stock
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'RAW' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-8">
            {filteredRaw.map((raw) => {
              const isLow = raw.currentStock <= raw.reorderPoint;
              return (
                <div key={raw.id} className="jm-card p-4 bg-white flex flex-col justify-between">
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
                    <p className="text-xs text-[#632055] font-mono mt-0.5">{raw.code}</p>
                    <p className="text-[11px] text-gray-500 mt-1">Supplier: {raw.supplierName}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#FCE7F3] space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#632055]">Available Stock:</span>
                      <span className="font-black text-sm text-[#9F1239]">
                        {raw.currentStock} {raw.unit}
                      </span>
                    </div>

                    <div className="flex justify-between text-[11px] text-gray-500">
                      <span>Purchase Rate:</span>
                      <span className="font-bold">₹{raw.costPerUnitInr} / {raw.unit}</span>
                    </div>

                    <button
                      onClick={() => handleOpenAdjust(true, raw.id)}
                      className="jm-btn-secondary w-full !min-h-[32px] !text-xs !py-1 mt-2 cursor-pointer"
                    >
                      Adjust Stock
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'EOQ_SAFETY' && (
          <div className="space-y-6">
            {/* Raw Material Picker */}
            <div className="jm-card p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

            {/* Safety Stock Calculus & ROP Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Card 1: Safety Stock with Dual Uncertainty */}
              <div className="jm-card p-5 bg-white space-y-4">
                <div className="flex items-center justify-between border-b border-[#FCE7F3] pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-[#9F1239]" size={20} />
                    <h3 className="font-black text-base text-[#31102A]">Dynamic Safety Stock & ROP</h3>
                  </div>
                  <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                    95% Service Level (Z=1.65)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#FFF9FA] border border-[#FCE7F3]">
                    <div className="text-[10px] text-[#632055] font-bold uppercase">Avg Daily Demand (D)</div>
                    <div className="text-lg font-black text-[#31102A] mt-0.5">{safetyStockMetrics.averageDailyDemand} kg/day</div>
                    <div className="text-[10px] text-gray-500">Std Dev (σD): ±{safetyStockMetrics.demandStdDev}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#FFF9FA] border border-[#FCE7F3]">
                    <div className="text-[10px] text-[#632055] font-bold uppercase">Supplier Lead Time (L)</div>
                    <div className="text-lg font-black text-[#31102A] mt-0.5">{safetyStockMetrics.averageLeadTimeDays} days</div>
                    <div className="text-[10px] text-gray-500">Std Dev (σL): ±{safetyStockMetrics.leadTimeStdDev} days</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FEFCE8] border border-[#FDE047] space-y-2 text-xs">
                  <div className="flex justify-between font-bold text-[#31102A]">
                    <span>Safety Stock Buffer (SS):</span>
                    <span className="text-base text-[#9F1239]">{safetyStockMetrics.safetyStockUnits} {selectedRawMaterial.unit}</span>
                  </div>
                  <div className="flex justify-between font-black text-sm text-[#31102A] pt-2 border-t border-[#FDE047]">
                    <span>Reorder Point Trigger (ROP):</span>
                    <span className="text-lg text-emerald-800">{safetyStockMetrics.reorderPointUnits} {selectedRawMaterial.unit}</span>
                  </div>
                  <p className="text-[10px] text-[#632055] pt-1">
                    Formula: <code className="font-mono font-bold">SS = Z × √(L·σD² + D²·σL²)</code>
                  </p>
                </div>
              </div>

              {/* Card 2: EOQ All-Units Quantity Discounts */}
              <div className="jm-card p-5 bg-white space-y-4">
                <div className="flex items-center justify-between border-b border-[#FCE7F3] pb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="text-[#31102A]" size={20} />
                    <h3 className="font-black text-base text-[#31102A]">EOQ Quantity Discount Optimizer</h3>
                  </div>
                  <span className="text-[11px] font-bold bg-[#FEF08A] text-[#31102A] px-2 py-0.5 rounded">
                    18% Holding Cost
                  </span>
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

                <div className="space-y-1.5 text-xs">
                  <h4 className="font-bold text-[#31102A] text-[11px] uppercase tracking-wider">All-Units Discount Curve Evaluation:</h4>
                  {eoqAnalysis.tierEvaluations.map((t, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        t.tierName === eoqAnalysis.bestTierName
                          ? 'bg-emerald-50 border-emerald-300 font-bold'
                          : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      <div>
                        <div className="text-xs">{t.tierName} (Min {t.minQty}kg @ ₹{t.unitPriceInr})</div>
                        <div className="text-[10px] text-gray-500">Feasible Qty: {t.feasibleOrderQty}kg</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black">₹{t.totalCostInr.toLocaleString('en-IN')}/yr</div>
                        {t.tierName === eoqAnalysis.bestTierName && (
                          <span className="text-[10px] text-emerald-800 font-extrabold">LOWEST COST ✓</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Append-Only Stock Movements Audit Ledger */}
        <div className="jm-card p-4 sm:p-5 bg-white mt-8">
          <div className="flex items-center justify-between border-b border-[#FCE7F3] pb-3 mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#31102A]">
                Stock Movement Ledger
              </h2>
              <p className="text-xs text-[#632055]">
                Immutable audit trail for all inventory transactions
              </p>
            </div>
            <span className="text-xs font-bold bg-[#FFF9FA] border border-[#FCE7F3] px-3 py-1 rounded-lg">
              {stockMovements.length} Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#FFF9FA] border-b border-[#FCE7F3] text-[#632055] font-bold">
                  <th className="p-2.5 sm:p-3">Date</th>
                  <th className="p-2.5 sm:p-3">Item Name</th>
                  <th className="p-2.5 sm:p-3">Type</th>
                  <th className="p-2.5 sm:p-3">Movement</th>
                  <th className="p-2.5 sm:p-3">Qty Signed</th>
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
                        className={`font-black text-xs ${
                          mov.qtySigned > 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
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
        </div>
      </div>

      {/* Stock Adjustment Modal */}
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
                <label className="block text-xs font-bold text-[#31102A] mb-1">Category</label>
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
                    Finished Goods
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
                    Raw Materials
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Select Item</label>
                <select
                  value={adjItemId}
                  onChange={(e) => setAdjItemId(e.target.value)}
                  className="jm-select !text-xs"
                >
                  {adjIsRaw
                    ? rawMaterials.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} (Stock: {r.currentStock} {r.unit})
                        </option>
                      ))
                    : products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stock: {p.currentStockUnits} packs)
                        </option>
                      ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Quantity Change (+ or -) *</label>
                <input
                  type="number"
                  required
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  placeholder="e.g. -5 for waste, +10 for count check"
                  className="jm-input !text-xs !font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Reason Code *</label>
                <select
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="jm-select !text-xs"
                >
                  <option value="Waste">Waste / Damaged</option>
                  <option value="Sampling">Marketing Sample</option>
                  <option value="Breakage">Breakage during packing</option>
                  <option value="Count Audit">Count Audit Correction</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  placeholder="e.g. Broken in godown transit"
                  className="jm-input !text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="jm-btn-secondary flex-1 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button type="submit" className="jm-btn-primary flex-1 !font-black cursor-pointer">
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
