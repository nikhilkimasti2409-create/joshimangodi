import { useState, useMemo } from 'react';
import {
  Factory,
  Plus,
  Scale,
  Sun,
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  TrendingDown,
  Users,
  IndianRupee,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  TrendingUp,
  Cpu,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useAppState, store } from '../lib/store';
import {
  calculateBatchYieldMetrics,
  calculateLaborPayouts,
  calculateDynamicCOGS,
  calculateBOMBackflushDeductions,
} from '../lib/domain';
import type { ProductionBatch } from '../types';

export default function ProductionPage() {
  const { productionBatches, dalLots, workers, products, rawMaterials } = useAppState();

  const [activeTab, setActiveTab] = useState<'BATCHES' | 'FORECAST_MPS'>('BATCHES');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedTraceBatch, setSelectedTraceBatch] = useState<ProductionBatch | null>(null);
  const [wizardStep, setWizardStep] = useState(1);

  // Wizard Form State
  const [prodType, setProdType] = useState('Lambi Plain Moong Mangodi');
  const [shape, setShape] = useState<'LAMBI' | 'GOL' | 'MASALA' | 'SPECIAL'>('LAMBI');
  const [selectedDalLotId, setSelectedDalLotId] = useState(dalLots[0]?.id || '');
  const [rawDalWeight, setRawDalWeight] = useState('100');
  const [wetWeight, setWetWeight] = useState('218');
  const [driedWeight, setDriedWeight] = useState('96.5');

  // Labor allocations (workerId -> kg)
  const [workerKgs, setWorkerKgs] = useState<{ [id: string]: string }>({
    'wrk-01': '50',
    'wrk-02': '46.5',
  });

  // QC Checks
  const [qcMoisture, setQcMoisture] = useState(true);
  const [qcColor, setQcColor] = useState(true);
  const [qcTaste, setQcTaste] = useState(true);
  const [qcBreakage, setQcBreakage] = useState('2.5');
  const [qcNotes, setQcNotes] = useState('Golden crisp texture, ideal drying.');

  // Output Lots
  const [pack500Count, setPack500Count] = useState('113');
  const [pack1000Count, setPack1000Count] = useState('40');

  // Mathematical derivations
  const rawDalNum = Number(rawDalWeight) || 0;
  const wetNum = Number(wetWeight) || 0;
  const driedNum = Number(driedWeight) || 0;
  const breakageNum = Number(qcBreakage) || 0;

  const currentDalLot = useMemo(() => {
    return dalLots.find((l) => l.id === selectedDalLotId) || dalLots[0];
  }, [dalLots, selectedDalLotId]);

  // Domain Yield Metrics Calculation
  const liveYieldAnalysis = useMemo(() => {
    return calculateBatchYieldMetrics(rawDalNum, wetNum, driedNum, 96.0);
  }, [rawDalNum, wetNum, driedNum]);

  // Domain Labor Cost Calculation
  const liveLabor = useMemo(() => {
    const rawEntries = Object.entries(workerKgs).map(([wId, kgStr]) => {
      const wrk = workers.find((w) => w.id === wId);
      return {
        workerId: wId,
        workerName: wrk?.name || 'Worker',
        driedKg: Number(kgStr) || 0,
        ratePerKgInr: wrk?.pieceRatePerKgInr || 25,
      };
    });
    return calculateLaborPayouts(rawEntries);
  }, [workerKgs, workers]);

  // Domain Dynamic COGS Rollup
  const liveCogs = useMemo(() => {
    return calculateDynamicCOGS(
      rawDalNum,
      currentDalLot?.ratePerKgInr || 92,
      driedNum,
      liveLabor.totalLaborCostInr,
      shape === 'MASALA',
      6.0,
      0
    );
  }, [rawDalNum, currentDalLot, driedNum, liveLabor, shape]);

  // Domain BOM Backflush Preview
  const liveBOMDeductions = useMemo(() => {
    const packs = [
      { packetSizeGrams: 500, quantity: Number(pack500Count) || 0 },
      { packetSizeGrams: 1000, quantity: Number(pack1000Count) || 0 },
    ];
    return calculateBOMBackflushDeductions(shape, driedNum, packs);
  }, [shape, driedNum, pack500Count, pack1000Count]);

  // Demand Forecast & MPS
  const forecastData = useMemo(() => {
    return store.getDemandForecast();
  }, []);

  const handleCreateBatch = () => {
    const labourEntries = Object.entries(workerKgs)
      .filter(([_, kgStr]) => Number(kgStr) > 0)
      .map(([wId, kgStr]) => ({
        workerId: wId,
        driedKg: Number(kgStr),
      }));

    const matched500Sku = products.find((p) => p.shape === shape && p.packetSizeGrams === 500) || products[0];
    const matched1000Sku = products.find((p) => p.shape === shape && p.packetSizeGrams === 1000) || products[1] || products[0];

    const outputLots = [];
    if (matched500Sku && (Number(pack500Count) || 0) > 0) {
      outputLots.push({ skuId: matched500Sku.id, packagesCount: Number(pack500Count) || 0 });
    }
    if (matched1000Sku && (Number(pack1000Count) || 0) > 0) {
      outputLots.push({ skuId: matched1000Sku.id, packagesCount: Number(pack1000Count) || 0 });
    }

    store.createProductionBatch({
      productType: prodType,
      shape,
      dalLotId: currentDalLot.id,
      rawDalWeightKg: rawDalNum,
      wetMixtureWeightKg: wetNum,
      driedYieldKg: driedNum,
      labourEntries,
      qcChecks: {
        moisturePassed: qcMoisture,
        colorPassed: qcColor,
        tastePassed: qcTaste,
        breakagePct: breakageNum,
        qcNotes,
      },
      outputLots,
    });

    setIsWizardOpen(false);
    setWizardStep(1);
  };

  return (
    <div className="min-h-[calc(100vh-120px)] pb-32 md:pb-12">
      {/* Top Banner */}
      <div className="bg-white border-b border-[#FCE7F3] px-3 sm:px-4 py-3 sm:py-4">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#31102A]">
              Manufacturing & Production Intelligence
            </h1>
            <p className="text-xs text-[#632055]">
              Moong dal batching, dynamic COGS rollup, BOM backflushing & Holt-Winters demand forecasting
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setWizardStep(1);
                setIsWizardOpen(true);
              }}
              className="jm-btn-primary !min-h-[40px] !text-xs !font-extrabold flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={16} />
              <span>+ Start New Batch</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="bg-white border-b border-[#FCE7F3] px-3 sm:px-4 py-2 sticky top-[80px] sm:top-[68px] z-20 shadow-xs">
        <div className="mx-auto max-w-7xl flex items-center gap-2">
          <button
            onClick={() => setActiveTab('BATCHES')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'BATCHES'
                ? 'bg-[#31102A] text-white shadow-xs'
                : 'bg-[#FFF9FA] text-[#632055] hover:bg-[#FEFCE8] border border-[#FCE7F3]'
            }`}
          >
            <Factory size={14} />
            <span>Batches & Traceability</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
              {productionBatches.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('FORECAST_MPS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'FORECAST_MPS'
                ? 'bg-[#31102A] text-white shadow-xs'
                : 'bg-[#FFF9FA] text-[#632055] hover:bg-[#FEFCE8] border border-[#FCE7F3]'
            }`}
          >
            <TrendingUp size={14} />
            <span>Holt-Winters Forecast & MPS</span>
            <span className="bg-[#FEF08A] text-[#31102A] px-1.5 py-0.2 rounded-full text-[10px] font-bold">
              AI Math
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Areas */}
      <div className="mx-auto max-w-7xl px-3 sm:px-6 pt-4">
        {activeTab === 'BATCHES' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
              <div className="jm-card p-3.5 sm:p-4 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-[#632055]">Total Batches</span>
                  <Factory size={17} className="text-[#9F1239]" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#31102A] mt-1.5">
                  {productionBatches.length}
                </div>
                <div className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold mt-0.5">
                  {productionBatches.filter((b) => b.status === 'RELEASED').length} released to stock
                </div>
              </div>

              <div className="jm-card p-3.5 sm:p-4 bg-[#FFF9FA]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-[#632055]">Avg Shrinkage</span>
                  <Sun size={17} className="text-amber-600" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#9F1239] mt-1.5">55.8%</div>
                <div className="text-[10px] sm:text-[11px] text-[#632055] font-semibold mt-0.5">
                  Sun-drying moisture loss
                </div>
              </div>

              <div className="jm-card p-3.5 sm:p-4 bg-[#FEFCE8]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-[#632055]">Avg COGS / kg</span>
                  <IndianRupee size={17} className="text-[#31102A]" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#31102A] mt-1.5">₹131.74</div>
                <div className="text-[10px] sm:text-[11px] text-[#632055] font-semibold mt-0.5">
                  Dal + Labor + Spices + Pisai
                </div>
              </div>

              <div className="jm-card p-3.5 sm:p-4 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-[#632055]">Active Workers</span>
                  <Users size={17} className="text-purple-700" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#31102A] mt-1.5">{workers.length}</div>
                <div className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold mt-0.5">
                  ₹25–₹30 / kg piece rate
                </div>
              </div>
            </div>

            {/* Batches Table */}
            <div className="jm-card p-4 sm:p-5 bg-white">
              <div className="flex items-center justify-between border-b border-[#FCE7F3] pb-3 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#31102A]">
                    Production Batches & Traceability
                  </h2>
                  <p className="text-xs text-[#632055]">
                    Bi-directional traceability from raw dal lot to POS orders
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#FFF9FA] border-b border-[#FCE7F3] text-[#632055] font-bold">
                      <th className="p-2.5 sm:p-3">Batch Code</th>
                      <th className="p-2.5 sm:p-3">Product Variant</th>
                      <th className="p-2.5 sm:p-3">Dal Lot</th>
                      <th className="p-2.5 sm:p-3">Raw / Dried Kg</th>
                      <th className="p-2.5 sm:p-3">Shrinkage %</th>
                      <th className="p-2.5 sm:p-3">COGS / kg</th>
                      <th className="p-2.5 sm:p-3">QC Status</th>
                      <th className="p-2.5 sm:p-3 text-right">Traceability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#FCE7F3]">
                    {productionBatches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-[#FFF9FA] transition">
                        <td className="p-2.5 sm:p-3 font-mono font-bold text-[#31102A]">{batch.batchCode}</td>
                        <td className="p-2.5 sm:p-3">
                          <div className="font-extrabold text-[#31102A]">{batch.productType}</div>
                          <div className="text-[10px] text-[#632055]">{batch.shape}</div>
                        </td>
                        <td className="p-2.5 sm:p-3 font-mono text-[11px] text-[#632055]">{batch.dalLotNo}</td>
                        <td className="p-2.5 sm:p-3">
                          <span className="font-bold text-[#31102A]">{batch.rawDalWeightKg} kg</span>
                          <span className="text-gray-400 mx-1">→</span>
                          <span className="font-extrabold text-emerald-800">{batch.driedYieldKg} kg</span>
                        </td>
                        <td className="p-2.5 sm:p-3">
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-bold">
                            {batch.shrinkagePct}%
                          </span>
                        </td>
                        <td className="p-2.5 sm:p-3 font-black text-[#9F1239]">₹{batch.costPerKgInr}</td>
                        <td className="p-2.5 sm:p-3">
                          {batch.status === 'RELEASED' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold text-[11px]">
                              <CheckCircle2 size={12} /> RELEASED
                            </span>
                          ) : batch.status === 'REJECTED' ? (
                            <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 font-bold text-[11px]">
                              <XCircle size={12} /> REJECTED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-bold text-[11px]">
                              <AlertTriangle size={12} /> {batch.status}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 sm:p-3 text-right">
                          <button
                            onClick={() => setSelectedTraceBatch(batch)}
                            className="jm-btn-secondary !min-h-[30px] !text-[11px] !py-1 !px-2.5 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <History size={12} />
                            <span>Trace</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Worker Ledger */}
            <div className="jm-card p-4 sm:p-5 bg-white">
              <h2 className="text-base sm:text-lg font-black text-[#31102A] mb-3">
                Worker Piece-Rate Payouts Ledger
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {workers.map((w) => (
                  <div key={w.id} className="p-3.5 sm:p-4 rounded-xl border border-[#FCE7F3] bg-[#FFF9FA]">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-sm text-[#31102A]">{w.name}</h3>
                      <span className="text-[10px] font-bold bg-[#FEF08A] px-2 py-0.5 rounded-md text-[#31102A]">
                        ₹{w.pieceRatePerKgInr}/kg
                      </span>
                    </div>
                    <div className="text-xs text-[#632055] mt-1 font-mono">{w.phone}</div>

                    <div className="mt-3 pt-2 border-t border-[#FCE7F3] flex items-center justify-between">
                      <div>
                        <div className="text-[9px] text-gray-500 uppercase font-bold">Produced</div>
                        <div className="text-sm font-black text-[#31102A]">{w.totalKgProduced} kg</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] text-gray-500 uppercase font-bold">Total Paid</div>
                        <div className="text-sm font-black text-emerald-700">
                          ₹{w.totalEarnedInr.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'FORECAST_MPS' && (
          <div className="space-y-6">
            {/* Forecast Overview Card */}
            <div className="jm-card p-5 sm:p-6 bg-gradient-to-r from-purple-900 to-[#31102A] text-white">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-amber-300" size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider text-pink-200">
                      Predictive Demand Engine
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black mt-1">
                    Holt-Winters Multiplicative Triple Exponential Smoothing
                  </h2>
                  <p className="text-xs text-pink-100 max-w-2xl mt-1">
                    Continuously learns seasonal patterns and demand velocity from {forecastData.demandHistoryDates.length} historical sales days.
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-2xl border border-white/20">
                  <div className="text-center px-2">
                    <div className="text-[10px] text-pink-200 font-bold">Model</div>
                    <div className="text-xs font-mono font-black">{forecastData.forecastResult.modelType}</div>
                  </div>
                  <div className="h-8 w-px bg-white/20" />
                  <div className="text-center px-2">
                    <div className="text-[10px] text-pink-200 font-bold">MAPE Error</div>
                    <div className="text-xs font-mono font-black text-emerald-300">{forecastData.forecastResult.mapePct}%</div>
                  </div>
                  <div className="h-8 w-px bg-white/20" />
                  <div className="text-center px-2">
                    <div className="text-[10px] text-pink-200 font-bold">Params (α, β, γ)</div>
                    <div className="text-[11px] font-mono font-black">
                      {forecastData.forecastResult.alpha}, {forecastData.forecastResult.beta}, {forecastData.forecastResult.gamma}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 7-Day Forecast Cards */}
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-[#31102A] mb-3 flex items-center gap-2">
                <Calendar size={16} className="text-[#9F1239]" />
                <span>Next 7-Day Predicted Demand (kg)</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {forecastData.mpsSchedule.slice(0, 7).map((slot, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                      slot.isBelowSafetyStock
                        ? 'bg-red-50 border-red-200'
                        : 'bg-white border-[#FCE7F3]'
                    }`}
                  >
                    <div>
                      <div className="text-[10px] font-bold text-[#632055] uppercase">
                        Day +{slot.dayIndex} ({slot.dateStr.slice(5)})
                      </div>
                      <div className="text-xl font-black text-[#31102A] mt-1">
                        {slot.forecastDemandKg} <span className="text-xs font-medium">kg</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-100">
                      <div className="text-[10px] text-gray-500">Ending PAB:</div>
                      <div className={`text-xs font-black ${slot.endingPABKg < slot.safetyStockKg ? 'text-red-700' : 'text-emerald-700'}`}>
                        {slot.endingPABKg} kg
                      </div>
                      {slot.recommendedBatchKg > 0 && (
                        <div className="mt-1 text-[10px] font-black text-red-900 bg-red-100 px-1.5 py-0.5 rounded">
                          Batch: +{slot.recommendedBatchKg}kg
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Master Production Schedule (MPS) Table */}
            <div className="jm-card p-4 sm:p-5 bg-white">
              <div className="flex items-center justify-between border-b border-[#FCE7F3] pb-3 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#31102A]">
                    Master Production Schedule (MPS) & Projected Available Balance (PAB)
                  </h2>
                  <p className="text-xs text-[#632055]">
                    Autonomous trigger recommendations based on safety stock threshold (80 kg)
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#FFF9FA] border-b border-[#FCE7F3] text-[#632055] font-bold">
                      <th className="p-2.5 sm:p-3">Timeline</th>
                      <th className="p-2.5 sm:p-3">Starting PAB (kg)</th>
                      <th className="p-2.5 sm:p-3">Forecast Demand (kg)</th>
                      <th className="p-2.5 sm:p-3">Planned Receipts (kg)</th>
                      <th className="p-2.5 sm:p-3">Ending PAB (kg)</th>
                      <th className="p-2.5 sm:p-3">Safety Stock Buffer</th>
                      <th className="p-2.5 sm:p-3 text-right">Production Trigger</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#FCE7F3]">
                    {forecastData.mpsSchedule.map((slot) => (
                      <tr key={slot.dayIndex} className="hover:bg-[#FFF9FA]">
                        <td className="p-2.5 sm:p-3 font-mono font-bold text-[#31102A]">
                          Day {slot.dayIndex} ({slot.dateStr})
                        </td>
                        <td className="p-2.5 sm:p-3 font-medium">{slot.startingPABKg} kg</td>
                        <td className="p-2.5 sm:p-3 font-bold text-[#9F1239]">{slot.forecastDemandKg} kg</td>
                        <td className="p-2.5 sm:p-3 font-medium text-emerald-700">+{slot.plannedProductionReceiptKg} kg</td>
                        <td className="p-2.5 sm:p-3 font-black text-[#31102A]">{slot.endingPABKg} kg</td>
                        <td className="p-2.5 sm:p-3 font-mono text-[11px] text-[#632055]">{slot.safetyStockKg} kg</td>
                        <td className="p-2.5 sm:p-3 text-right">
                          {slot.recommendedBatchKg > 0 ? (
                            <span className="px-2.5 py-1 rounded-md bg-red-100 text-red-900 font-extrabold text-[11px] inline-flex items-center gap-1">
                              <AlertTriangle size={12} /> Schedule {slot.recommendedBatchKg}kg Batch
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-bold text-[11px]">
                              Stock Adequate ✓
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5-Step Batch Creation Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 border-2 border-[#FCE7F3] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-[#FCE7F3] pb-3">
              <div>
                <h3 className="font-black text-base sm:text-lg text-[#31102A]">
                  Production Batch Wizard
                </h3>
                <p className="text-xs text-[#632055]">
                  Step {wizardStep} of 4: {
                    wizardStep === 1
                      ? 'Raw Dal Lot Selection'
                      : wizardStep === 2
                      ? 'Sun-Drying & Shrinkage Math'
                      : wizardStep === 3
                      ? 'Worker Piece-Rate Allocation'
                      : 'QC & Release to Stock'
                  }
                </p>
              </div>
              <button onClick={() => setIsWizardOpen(false)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center justify-between mb-6 px-2">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center gap-1.5 sm:gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition ${
                      wizardStep === s
                        ? 'bg-[#31102A] text-white shadow-sm'
                        : wizardStep > s
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-500 border border-gray-300'
                    }`}
                  >
                    {wizardStep > s ? '✓' : s}
                  </div>
                  {s < 4 && <div className={`w-8 sm:w-20 h-1 rounded-full ${wizardStep > s ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>

            {/* Step 1: Raw Dal Selection */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#31102A] mb-1">Product Variant</label>
                  <select
                    value={prodType}
                    onChange={(e) => {
                      setProdType(e.target.value);
                      if (e.target.value.includes('Masala')) setShape('MASALA');
                      else if (e.target.value.includes('Gol')) setShape('GOL');
                      else setShape('LAMBI');
                    }}
                    className="jm-select !text-xs"
                  >
                    <option value="Lambi Plain Moong Mangodi">Lambi Plain Moong Mangodi</option>
                    <option value="Gol Plain Moong Mangodi">Gol Plain Moong Mangodi</option>
                    <option value="Spiced Masala Moong Mangodi">Spiced Masala Moong Mangodi</option>
                    <option value="Palak Moong Mangodi Special">Palak Moong Mangodi Special</option>
                    <option value="Lehsun Moong Mangodi Special">Lehsun Moong Mangodi Special</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#31102A] mb-1">Select Dal Lot</label>
                  <select
                    value={selectedDalLotId}
                    onChange={(e) => setSelectedDalLotId(e.target.value)}
                    className="jm-select !text-xs"
                  >
                    {dalLots.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.lotNo} ({l.supplierName}) · Available: {l.availableWeightKg} kg · Rate: ₹{l.ratePerKgInr}/kg
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#31102A] mb-1">Dry Dal Weight (kg) *</label>
                    <input
                      type="number"
                      value={rawDalWeight}
                      onChange={(e) => setRawDalWeight(e.target.value)}
                      className="jm-input !text-xs !font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#31102A] mb-1">Wet Paste Weight (kg)</label>
                    <input
                      type="number"
                      value={wetWeight}
                      onChange={(e) => setWetWeight(e.target.value)}
                      className="jm-input !text-xs !font-bold"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#FFF9FA] border border-[#FCE7F3] text-xs flex justify-between items-center">
                  <span className="text-[#632055] font-semibold">Moisture Ratio:</span>
                  <span className="font-black text-[#31102A]">{liveYieldAnalysis.moistureRatio}x (Standard: ~2.18x)</span>
                </div>
              </div>
            )}

            {/* Step 2: Drying & Shrinkage */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#31102A] mb-1">Post Sun-Drying Yield (kg) *</label>
                  <input
                    type="number"
                    value={driedWeight}
                    onChange={(e) => setDriedWeight(e.target.value)}
                    className="jm-input !text-lg !font-black text-emerald-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="text-[10px] uppercase font-bold text-amber-900">Shrinkage %</div>
                    <div className="text-xl font-black text-amber-900">{liveYieldAnalysis.shrinkagePct}%</div>
                    <div className="text-[10px] text-amber-800 mt-0.5">Moisture loss in sun drying</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-[10px] uppercase font-bold text-emerald-900">Actual Yield</div>
                    <div className="text-xl font-black text-emerald-900">{liveYieldAnalysis.actualYieldPct}%</div>
                    <div className="text-[10px] text-emerald-800 mt-0.5">Variance: {liveYieldAnalysis.yieldVariancePct > 0 ? '+' : ''}{liveYieldAnalysis.yieldVariancePct}%</div>
                  </div>
                </div>

                {/* Live Diagnosis Badge */}
                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  liveYieldAnalysis.status === 'OPTIMAL'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : liveYieldAnalysis.status === 'WARNING_LOW_YIELD'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}>
                  {liveYieldAnalysis.diagnosisMessage}
                </div>
              </div>
            )}

            {/* Step 3: Piece-Rate Labor Allocation */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-[#FFF9FA] border border-[#FCE7F3] text-xs flex justify-between items-center">
                  <span className="font-bold text-[#31102A]">Total Dried Output to Distribute:</span>
                  <span className="font-black text-emerald-800 text-sm">{driedNum} kg</span>
                </div>

                <div className="space-y-2.5">
                  {workers.map((w) => (
                    <div key={w.id} className="p-3 rounded-xl border border-[#FCE7F3] bg-white flex items-center justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-xs text-[#31102A]">{w.name}</div>
                        <div className="text-[10px] text-[#632055]">Rate: ₹{w.pieceRatePerKgInr}/kg</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="kg"
                          value={workerKgs[w.id] || ''}
                          onChange={(e) => setWorkerKgs({ ...workerKgs, [w.id]: e.target.value })}
                          className="w-20 px-2 py-1 border border-[#FCE7F3] rounded-lg text-xs font-bold text-right"
                        />
                        <span className="text-xs font-black text-[#9F1239] w-16 text-right">
                          ₹{((Number(workerKgs[w.id]) || 0) * w.pieceRatePerKgInr).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-[#FEFCE8] border border-[#FDE047] flex justify-between items-center text-xs">
                  <span className="font-bold text-[#31102A]">Total Labor Cost:</span>
                  <span className="font-black text-[#9F1239] text-sm">₹{liveLabor.totalLaborCostInr.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

            {/* Step 4: QC Gates & Cost Roll-up + BOM Backflush Preview */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-[#FCE7F3] bg-[#FFF9FA] space-y-2">
                  <h4 className="font-extrabold text-xs text-[#31102A]">Quality Checklist (QC Gates)</h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={qcMoisture} onChange={(e) => setQcMoisture(e.target.checked)} />
                      <span>Moisture OK</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={qcColor} onChange={(e) => setQcColor(e.target.checked)} />
                      <span>Color OK</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={qcTaste} onChange={(e) => setQcTaste(e.target.checked)} />
                      <span>Taste OK</span>
                    </label>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs">
                    <span>Breakage %:</span>
                    <input
                      type="number"
                      value={qcBreakage}
                      onChange={(e) => setQcBreakage(e.target.value)}
                      className="w-20 px-2 py-1 border border-[#FCE7F3] rounded-md text-xs font-bold text-right"
                    />
                  </div>
                </div>

                {/* BOM Backflush Preview Table */}
                <div className="p-4 rounded-xl border border-[#FCE7F3] bg-white space-y-2">
                  <h4 className="font-extrabold text-xs text-[#31102A]">Automated BOM Backflushing Deductions</h4>
                  <div className="space-y-1 text-[11px]">
                    {liveBOMDeductions.map((req, idx) => (
                      <div key={idx} className="flex justify-between py-0.5 border-b border-gray-100">
                        <span className="text-gray-700">{req.rawMaterialName}:</span>
                        <span className="font-bold text-[#31102A]">
                          -{req.quantityRequired} {req.unit} (₹{req.totalCostInr})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Final Cost Rollup */}
                <div className="p-4 rounded-xl bg-[#FEFCE8] border border-[#FDE047] space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Dal Cost ({rawDalNum}kg @ ₹{currentDalLot?.ratePerKgInr}/kg):</span>
                    <span className="font-bold">₹{liveCogs.dalCostInr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Labor Payouts:</span>
                    <span className="font-bold">₹{liveCogs.laborCostInr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Grinding (Pisai) & Spices:</span>
                    <span className="font-bold">₹{liveCogs.grindingCostInr + liveCogs.masalaCostInr}</span>
                  </div>
                  <div className="flex justify-between font-black text-sm text-[#9F1239] pt-2 border-t border-[#FDE047]">
                    <span>Total Batch COGS:</span>
                    <span>₹{liveCogs.totalBatchCostInr} (₹{liveCogs.bulkCostPerKgInr}/kg)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between gap-3 mt-6 pt-3 border-t border-[#FCE7F3]">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((s) => s - 1)}
                  className="jm-btn-secondary !text-xs"
                >
                  ← Previous
                </button>
              ) : <div />}

              {wizardStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((s) => s + 1)}
                  className="jm-btn-primary !text-xs !font-bold"
                >
                  Next Step →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateBatch}
                  className="jm-btn-primary !text-xs !font-black bg-emerald-600 hover:bg-emerald-700 text-white !border-emerald-700 shadow-md"
                >
                  Release Batch to Stock ✓
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Traceability Graph Modal */}
      {selectedTraceBatch && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 border-2 border-[#FCE7F3] shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-[#FCE7F3] pb-2">
              <h3 className="font-black text-base text-[#31102A]">Batch Traceability Graph</h3>
              <button onClick={() => setSelectedTraceBatch(null)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#FFF9FA] border border-[#FCE7F3]">
                <div className="font-bold text-[#9F1239] text-[11px] uppercase">1. Dal Procurement</div>
                <div className="font-extrabold text-sm text-[#31102A] mt-0.5">{selectedTraceBatch.dalLotNo}</div>
                <div className="text-[#632055]">Supplier: Nagaur Mandi Traders</div>
              </div>

              <div className="text-center font-bold text-gray-400">↓</div>

              <div className="p-3 rounded-xl bg-[#FEFCE8] border border-[#FDE047]">
                <div className="font-bold text-[#31102A] text-[11px] uppercase">2. Batching & Sun Drying</div>
                <div className="font-black text-sm text-[#31102A] mt-0.5">{selectedTraceBatch.batchCode} ({selectedTraceBatch.productType})</div>
                <div className="text-[#632055]">
                  Dal: {selectedTraceBatch.rawDalWeightKg}kg → Dried: {selectedTraceBatch.driedYieldKg}kg (Shrinkage: {selectedTraceBatch.shrinkagePct}%)
                </div>
                <div className="text-[#632055] mt-1 font-semibold">
                  Workers: {selectedTraceBatch.labourEntries.map((l) => `${l.workerName} (${l.driedKg}kg)`).join(', ')}
                </div>
              </div>

              <div className="text-center font-bold text-gray-400">↓</div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="font-bold text-emerald-900 text-[11px] uppercase">3. Released Stock Lots</div>
                <div className="space-y-1 mt-1">
                  {selectedTraceBatch.outputLots.map((ol, idx) => (
                    <div key={idx} className="flex justify-between font-bold text-emerald-950">
                      <span>{ol.skuName} ({ol.packagesCount} packs)</span>
                      <span className="font-mono text-[10px]">{ol.lotNumber}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-emerald-800 mt-1">Expiry Date: +180 days ({selectedTraceBatch.expiryDate})</div>
              </div>
            </div>

            <button
              onClick={() => setSelectedTraceBatch(null)}
              className="w-full mt-4 jm-btn-secondary !text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
