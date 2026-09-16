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
  Users,
  IndianRupee,
  Calendar,
  Sparkles,
  TrendingUp,
  UserPlus,
  Edit2,
  Trash2,
  DollarSign,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useAppState, store } from '../lib/store';
import { showToast } from '../components/common/Toast';
import {
  calculateBatchYieldMetrics,
  calculateLaborPayouts,
  calculateDynamicCOGS,
  calculateBOMBackflushDeductions,
} from '../lib/domain';
import type { ProductionBatch, Worker, DalLot, BatchStatus } from '../types';

export default function ProductionPage() {
  const { productionBatches, dalLots, workers, products, rawMaterials } = useAppState();

  const [activeTab, setActiveTab] = useState<'BATCHES' | 'WORKERS' | 'DAL_LOTS' | 'FORECAST_MPS'>('BATCHES');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedTraceBatch, setSelectedTraceBatch] = useState<ProductionBatch | null>(null);
  const [wizardStep, setWizardStep] = useState(1);

  // Status Change Modal
  const [statusBatch, setStatusBatch] = useState<ProductionBatch | null>(null);
  const [newStatus, setNewStatus] = useState<BatchStatus>('RELEASED');

  // Worker Modal State
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [workerRole, setWorkerRole] = useState('Mangodi Belan & Extrusion');
  const [workerRate, setWorkerRate] = useState('25');
  const [workerDailyWage, setWorkerDailyWage] = useState('');
  const [workerNotes, setWorkerNotes] = useState('');

  // Worker Payout Modal State
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutWorkerId, setPayoutWorkerId] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutKg, setPayoutKg] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'Cash' | 'UPI'>('Cash');

  // Dal Lot Modal State
  const [isDalLotModalOpen, setIsDalLotModalOpen] = useState(false);
  const [lotNo, setLotNo] = useState('');
  const [lotSupplier, setLotSupplier] = useState('');
  const [lotDalType, setLotDalType] = useState('Moong Mogar Dal (Grade A)');
  const [lotWeight, setLotWeight] = useState('');
  const [lotRate, setLotRate] = useState('');
  const [lotDate, setLotDate] = useState(new Date().toISOString().split('T')[0]);
  const [lotNotes, setLotNotes] = useState('');

  // Wizard Form State
  const [prodType, setProdType] = useState('Lambi Plain Moong Mangodi');
  const [shape, setShape] = useState<'LAMBI' | 'GOL' | 'MASALA' | 'SPECIAL'>('LAMBI');
  const [selectedDalLotId, setSelectedDalLotId] = useState(dalLots[0]?.id || '');
  const [customDalSupplier, setCustomDalSupplier] = useState('Nagaur Mandi Dal');
  const [customDalRate, setCustomDalRate] = useState('92');
  const [rawDalWeight, setRawDalWeight] = useState('100');
  const [wetWeight, setWetWeight] = useState('218');
  const [driedWeight, setDriedWeight] = useState('96.5');

  // Labor allocations (workerId -> kg)
  const [workerKgs, setWorkerKgs] = useState<{ [id: string]: string }>({});

  // QC Checks
  const [qcMoisture, setQcMoisture] = useState(true);
  const [qcColor, setQcColor] = useState(true);
  const [qcTaste, setQcTaste] = useState(true);
  const [qcBreakage, setQcBreakage] = useState('2.5');
  const [qcNotes, setQcNotes] = useState('Golden crisp texture, ideal drying.');

  // Output Lots
  const [pack250Count, setPack250Count] = useState('');
  const [pack500Count, setPack500Count] = useState('113');
  const [pack1000Count, setPack1000Count] = useState('40');

  // Mathematical derivations
  const rawDalNum = Number(rawDalWeight) || 0;
  const wetNum = Number(wetWeight) || 0;
  const driedNum = Number(driedWeight) || 0;
  const breakageNum = Number(qcBreakage) || 0;

  const currentDalLot = useMemo(() => {
    return dalLots.find((l) => l.id === selectedDalLotId) || null;
  }, [dalLots, selectedDalLotId]);

  const effectiveDalRate = currentDalLot ? currentDalLot.ratePerKgInr : (Number(customDalRate) || 92);

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
        workerName: wrk?.name || 'Kaarigar',
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
      effectiveDalRate,
      driedNum,
      liveLabor.totalLaborCostInr,
      shape === 'MASALA',
      6.0,
      0
    );
  }, [rawDalNum, effectiveDalRate, driedNum, liveLabor, shape]);

  // Domain BOM Backflush Preview
  const liveBOMDeductions = useMemo(() => {
    const packs = [
      { packetSizeGrams: 250, quantity: Number(pack250Count) || 0 },
      { packetSizeGrams: 500, quantity: Number(pack500Count) || 0 },
      { packetSizeGrams: 1000, quantity: Number(pack1000Count) || 0 },
    ].filter((p) => p.quantity > 0);
    return calculateBOMBackflushDeductions(shape, driedNum, packs);
  }, [shape, driedNum, pack250Count, pack500Count, pack1000Count]);

  // Demand Forecast & MPS
  const forecastData = useMemo(() => {
    return store.getDemandForecast();
  }, []);

  // Worker Modal Handlers
  const handleOpenAddWorker = () => {
    setEditingWorker(null);
    setWorkerName('');
    setWorkerPhone('');
    setWorkerRole('Mangodi Belan & Extrusion');
    setWorkerRate('25');
    setWorkerDailyWage('');
    setWorkerNotes('');
    setIsWorkerModalOpen(true);
  };

  const handleOpenEditWorker = (w: Worker) => {
    setEditingWorker(w);
    setWorkerName(w.name);
    setWorkerPhone(w.phone || '');
    setWorkerRole(w.role || 'Mangodi Belan & Extrusion');
    setWorkerRate(String(w.pieceRatePerKgInr || 25));
    setWorkerDailyWage(w.dailyWageInr ? String(w.dailyWageInr) : '');
    setWorkerNotes(w.notes || '');
    setIsWorkerModalOpen(true);
  };

  const handleSaveWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim()) {
      showToast('Name Required', 'Please enter worker name.', 'warning');
      return;
    }

    if (editingWorker) {
      store.updateWorker(editingWorker.id, {
        name: workerName.trim(),
        phone: workerPhone.trim(),
        role: workerRole,
        pieceRatePerKgInr: Number(workerRate) || 25,
        dailyWageInr: Number(workerDailyWage) || 0,
        notes: workerNotes,
      });
      showToast('Worker Updated', `${workerName.trim()}'s profile updated.`, 'success');
    } else {
      store.addWorker({
        name: workerName,
        phone: workerPhone,
        role: workerRole,
        pieceRatePerKgInr: Number(workerRate) || 25,
        dailyWageInr: Number(workerDailyWage) || 0,
        notes: workerNotes,
      });
      showToast('Worker Added', `${workerName} added to kaarigar ledger.`, 'success');
    }

    setIsWorkerModalOpen(false);
  };

  const handleDeleteWorker = (workerId: string, name: string) => {
    store.deleteWorker(workerId);
    showToast('Worker Removed', `Worker "${name}" removed.`, 'info');
  };

  // Worker Payout Handlers
  const handleOpenPayout = (w: Worker) => {
    setPayoutWorkerId(w.id);
    setPayoutAmount('');
    setPayoutKg('');
    setPayoutNotes('');
    setPayoutMethod('Cash');
    setIsPayoutModalOpen(true);
  };

  const handleSavePayout = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(payoutAmount);
    if (!amt || amt <= 0) {
      showToast('Invalid Amount', 'Please enter a valid payout amount.', 'warning');
      return;
    }

    store.recordWorkerPayout({
      workerId: payoutWorkerId,
      amountInr: amt,
      kgProduced: Number(payoutKg) || undefined,
      notes: payoutNotes,
      paymentMethod: payoutMethod,
    });

    showToast('Payout Recorded', `₹${amt} labor payout recorded.`, 'success');
    setIsPayoutModalOpen(false);
  };

  // Dal Lot Modal Handlers
  const handleOpenAddDalLot = () => {
    const today = new Date().toISOString().split('T')[0];
    const seq = dalLots.length + 1;
    setLotNo(`DL-${today.replace(/-/g, '').slice(2)}-${String(seq).padStart(2, '0')}`);
    setLotSupplier('Nagaur Mandi Traders');
    setLotDalType('Moong Mogar Dal (Grade A)');
    setLotWeight('500');
    setLotRate('92');
    setLotDate(today);
    setLotNotes('');
    setIsDalLotModalOpen(true);
  };

  const handleSaveDalLot = (e: React.FormEvent) => {
    e.preventDefault();
    const weightNum = Number(lotWeight);
    const rateNum = Number(lotRate);

    if (!lotNo.trim() || !weightNum || weightNum <= 0) {
      showToast('Invalid Input', 'Please enter a valid Lot Number and Weight.', 'warning');
      return;
    }

    const newLot = store.addDalLot({
      lotNo,
      supplierName: lotSupplier,
      dalType: lotDalType,
      initialWeightKg: weightNum,
      ratePerKgInr: rateNum || 90,
      purchaseDate: lotDate,
      notes: lotNotes,
    });

    showToast('Dal Lot Added', `Lot ${newLot.lotNo} (${newLot.initialWeightKg}kg) recorded.`, 'success');
    setSelectedDalLotId(newLot.id);
    setIsDalLotModalOpen(false);
  };

  const handleDeleteDalLot = (lotId: string, lotName: string) => {
    if (window.confirm(`Delete Dal Lot "${lotName}"?`)) {
      store.deleteDalLot(lotId);
    }
  };

  // Batch Wizard Handlers
  const handleOpenBatchWizard = () => {
    setWizardStep(1);
    if (dalLots.length > 0 && !selectedDalLotId) {
      setSelectedDalLotId(dalLots[0].id);
    }
    // Pre-initialize worker kgs
    const initialKgs: { [id: string]: string } = {};
    workers.forEach((w) => {
      initialKgs[w.id] = '';
    });
    setWorkerKgs(initialKgs);
    setIsWizardOpen(true);
  };

  const handleCreateBatch = () => {
    const labourEntries = Object.entries(workerKgs)
      .filter(([_, kgStr]) => Number(kgStr) > 0)
      .map(([wId, kgStr]) => ({
        workerId: wId,
        driedKg: Number(kgStr),
      }));

    const matched250Sku = products.find((p) => p.shape === shape && p.packetSizeGrams === 250) || products[0];
    const matched500Sku = products.find((p) => p.shape === shape && p.packetSizeGrams === 500) || products[1] || products[0];
    const matched1000Sku = products.find((p) => p.shape === shape && p.packetSizeGrams === 1000) || products[2] || products[0];

    const outputLots = [];
    if (matched250Sku && (Number(pack250Count) || 0) > 0) {
      outputLots.push({ skuId: matched250Sku.id, packagesCount: Number(pack250Count) || 0 });
    }
    if (matched500Sku && (Number(pack500Count) || 0) > 0) {
      outputLots.push({ skuId: matched500Sku.id, packagesCount: Number(pack500Count) || 0 });
    }
    if (matched1000Sku && (Number(pack1000Count) || 0) > 0) {
      outputLots.push({ skuId: matched1000Sku.id, packagesCount: Number(pack1000Count) || 0 });
    }

    // If no dal lots existed, create a dummy or real Dal lot
    let lotId = selectedDalLotId;
    if (!lotId && dalLots.length === 0) {
      const createdLot = store.addDalLot({
        lotNo: `DL-${Date.now().toString().slice(-4)}`,
        supplierName: customDalSupplier || 'Direct Mandi Purchase',
        dalType: 'Moong Mogar Dal (Grade A)',
        initialWeightKg: rawDalNum,
        ratePerKgInr: Number(customDalRate) || 92,
      });
      lotId = createdLot.id;
    }

    store.createProductionBatch({
      productType: prodType,
      shape,
      dalLotId: lotId,
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

  const handleUpdateStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (statusBatch) {
      store.updateBatchStatus(statusBatch.id, newStatus);
      setStatusBatch(null);
    }
  };

  const handleDeleteBatch = (batchId: string, code: string) => {
    if (window.confirm(`Are you sure you want to delete Batch "${code}"?`)) {
      store.deleteProductionBatch(batchId);
    }
  };

  return (
    <div className="min-h-[calc(100vh-120px)] pb-32 md:pb-12 bg-[#FFFDFE]">
      {/* Top Banner */}
      <div className="bg-white border-b border-[#FCE7F3] px-3 sm:px-4 py-3 sm:py-4">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#31102A]">
              Manufacturing & Production Intelligence
            </h1>
            <p className="text-xs text-[#632055]">
              Moong dal batching, kaarigar piece-rate payouts, shrinkage analytics & Holt-Winters forecasting
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            <button
              onClick={handleOpenAddWorker}
              className="jm-btn-secondary !min-h-[40px] !text-xs !font-bold flex items-center gap-1.5 flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <UserPlus size={15} />
              <span>+ Add Worker</span>
            </button>

            <button
              onClick={handleOpenAddDalLot}
              className="jm-btn-secondary !min-h-[40px] !text-xs !font-bold flex items-center gap-1.5 flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <Layers size={15} />
              <span>+ Add Dal Lot</span>
            </button>

            <button
              onClick={handleOpenBatchWizard}
              className="jm-btn-primary !min-h-[40px] !text-xs !font-extrabold flex items-center gap-1.5 shadow-sm flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <Plus size={16} />
              <span>+ Start New Batch</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="bg-white border-b border-[#FCE7F3] px-3 sm:px-4 py-2 sticky top-[80px] sm:top-[68px] z-20 shadow-xs">
        <div className="mx-auto max-w-7xl flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('BATCHES')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
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
            onClick={() => setActiveTab('WORKERS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'WORKERS'
                ? 'bg-[#31102A] text-white shadow-xs'
                : 'bg-[#FFF9FA] text-[#632055] hover:bg-[#FEFCE8] border border-[#FCE7F3]'
            }`}
          >
            <Users size={14} />
            <span>Kaarigar & Workers Ledger</span>
            <span className="bg-pink-100 text-[#31102A] px-1.5 py-0.2 rounded-full text-[10px] font-bold">
              {workers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('DAL_LOTS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'DAL_LOTS'
                ? 'bg-[#31102A] text-white shadow-xs'
                : 'bg-[#FFF9FA] text-[#632055] hover:bg-[#FEFCE8] border border-[#FCE7F3]'
            }`}
          >
            <Layers size={14} />
            <span>Dal Lots & Procurement</span>
            <span className="bg-yellow-100 text-[#31102A] px-1.5 py-0.2 rounded-full text-[10px] font-bold">
              {dalLots.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('FORECAST_MPS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'FORECAST_MPS'
                ? 'bg-[#31102A] text-white shadow-xs'
                : 'bg-[#FFF9FA] text-[#632055] hover:bg-[#FEFCE8] border border-[#FCE7F3]'
            }`}
          >
            <TrendingUp size={14} />
            <span>Demand Forecast & MPS</span>
            <span className="bg-[#FEF08A] text-[#31102A] px-1.5 py-0.2 rounded-full text-[10px] font-bold">
              AI Math
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto max-w-7xl px-3 sm:px-6 pt-5">
        {/* ==================== TAB 1: BATCHES & TRACEABILITY ==================== */}
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
                  <span className="text-[11px] sm:text-xs font-bold text-[#632055]">Sun Drying Yield</span>
                  <Sun size={17} className="text-amber-600" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#9F1239] mt-1.5">
                  {productionBatches.length > 0
                    ? `${(productionBatches.reduce((a, b) => a + b.shrinkagePct, 0) / productionBatches.length).toFixed(1)}%`
                    : '55.8%'}
                </div>
                <div className="text-[10px] sm:text-[11px] text-[#632055] font-semibold mt-0.5">
                  Standard moisture shrinkage
                </div>
              </div>

              <div className="jm-card p-3.5 sm:p-4 bg-[#FEFCE8]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-[#632055]">Active Workers</span>
                  <Users size={17} className="text-[#31102A]" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#31102A] mt-1.5">
                  {workers.length}
                </div>
                <div className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold mt-0.5">
                  Registered Kaarigar staff
                </div>
              </div>

              <div className="jm-card p-3.5 sm:p-4 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-[#632055]">Dal Lots In Stock</span>
                  <Layers size={17} className="text-purple-700" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#31102A] mt-1.5">
                  {dalLots.length}
                </div>
                <div className="text-[10px] sm:text-[11px] text-[#632055] font-semibold mt-0.5">
                  {dalLots.reduce((acc, l) => acc + l.availableWeightKg, 0)} kg available
                </div>
              </div>
            </div>

            {/* Batches Table or Empty State */}
            <div className="jm-card p-4 sm:p-5 bg-white">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#FCE7F3] pb-3 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#31102A]">
                    Production Batches & Traceability
                  </h2>
                  <p className="text-xs text-[#632055]">
                    Bi-directional traceability from raw dal lot to final customer dispatch
                  </p>
                </div>
                <button
                  onClick={handleOpenBatchWizard}
                  className="jm-btn-primary !min-h-[34px] !text-xs !font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>+ Start Batch</span>
                </button>
              </div>

              {productionBatches.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl bg-[#FFF9FA] border border-dashed border-[#FCE7F3]">
                  <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center mx-auto mb-3 text-[#9F1239]">
                    <Factory size={32} />
                  </div>
                  <h3 className="text-base font-black text-[#31102A]">No Production Batches Created Yet</h3>
                  <p className="text-xs text-[#632055] max-w-md mx-auto mt-1 mb-4">
                    Jab bhi aap moong dal ki mangodi ka naya batch taiyar karein, "+ Start New Batch" par click karke dal ka weight, drying yield aur kaarigar piece-rate enter karein.
                  </p>
                  <button
                    onClick={handleOpenBatchWizard}
                    className="jm-btn-primary !text-xs !font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>+ Start First Production Batch</span>
                  </button>
                </div>
              ) : (
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
                        <th className="p-2.5 sm:p-3">Status</th>
                        <th className="p-2.5 sm:p-3 text-right">Actions</th>
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
                            <button
                              onClick={() => {
                                setStatusBatch(batch);
                                setNewStatus(batch.status);
                              }}
                              className="cursor-pointer"
                              title="Click to change status"
                            >
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
                            </button>
                          </td>
                          <td className="p-2.5 sm:p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedTraceBatch(batch)}
                                className="jm-btn-secondary !min-h-[28px] !text-[11px] !py-1 !px-2 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <History size={12} />
                                <span>Trace</span>
                              </button>
                              <button
                                onClick={() => handleDeleteBatch(batch.id, batch.batchCode)}
                                className="p-1.5 text-gray-400 hover:text-red-700 rounded-lg hover:bg-red-50 transition cursor-pointer"
                                title="Delete batch"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: KAARIGAR & WORKERS ==================== */}
        {activeTab === 'WORKERS' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#FCE7F3]">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#31102A]">
                  Kaarigar & Worker Piece-Rate Management
                </h2>
                <p className="text-xs text-[#632055]">
                  Apne karigaron ko add karein, unka kaam define karein aur ₹/kg rate ya daily wage track karein
                </p>
              </div>
              <button
                onClick={handleOpenAddWorker}
                className="jm-btn-primary !min-h-[38px] !text-xs !font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus size={15} />
                <span>+ Add Kaarigar / Worker</span>
              </button>
            </div>

            {workers.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-white border border-dashed border-[#FCE7F3]">
                <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3 text-purple-700">
                  <Users size={32} />
                </div>
                <h3 className="text-base font-black text-[#31102A]">No Kaarigar or Workers Added Yet</h3>
                <p className="text-xs text-[#632055] max-w-md mx-auto mt-1 mb-4">
                  Mangodi banane wale, daal peesne wale aur packing karne wale karigaron ko yahan add karein taaki unki banayi hui mangodi aur piece-rate ledger maintain rahe.
                </p>
                <button
                  onClick={handleOpenAddWorker}
                  className="jm-btn-primary !text-xs !font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus size={15} />
                  <span>+ Add First Kaarigar / Worker</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {workers.map((w) => (
                  <div key={w.id} className="jm-card p-4 bg-white flex flex-col justify-between border border-[#FCE7F3]">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-extrabold text-sm text-[#31102A]">{w.name}</h3>
                          <span className="inline-block mt-0.5 text-[11px] font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                            {w.role || 'Mangodi Belan & Extrusion'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black bg-[#FEF08A] text-[#31102A] px-2 py-0.5 rounded-md">
                            ₹{w.pieceRatePerKgInr}/kg
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-[#632055] font-mono mt-1">
                        {w.phone ? `📞 ${w.phone}` : 'No phone entered'}
                      </div>

                      {w.notes && (
                        <p className="text-[11px] text-gray-500 mt-2 bg-[#FFF9FA] p-2 rounded-lg border border-pink-100">
                          {w.notes}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#FCE7F3] space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-[#FFF9FA] p-2 rounded-lg border border-[#FCE7F3]">
                          <div className="text-[9px] text-gray-500 uppercase font-bold">Produced</div>
                          <div className="text-sm font-black text-[#31102A]">{w.totalKgProduced} kg</div>
                        </div>
                        <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                          <div className="text-[9px] text-emerald-800 uppercase font-bold">Total Paid</div>
                          <div className="text-sm font-black text-emerald-700">
                            ₹{w.totalEarnedInr.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          onClick={() => handleOpenPayout(w)}
                          className="flex-1 jm-btn-primary !min-h-[30px] !text-[11px] !py-1 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <DollarSign size={13} />
                          <span>+ Record Payout</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditWorker(w)}
                          className="p-1.5 text-gray-500 hover:text-[#31102A] rounded-lg hover:bg-gray-100 border border-gray-200 transition cursor-pointer"
                          title="Edit worker"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteWorker(w.id, w.name)}
                          className="p-1.5 text-gray-400 hover:text-red-700 rounded-lg hover:bg-red-50 border border-red-200 transition cursor-pointer"
                          title="Delete worker"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: DAL LOTS & PROCUREMENT ==================== */}
        {activeTab === 'DAL_LOTS' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#FCE7F3]">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#31102A]">
                  Moong Dal Lots & Procurement Ledger
                </h2>
                <p className="text-xs text-[#632055]">
                  Mandi se khareedi hui kacchi moong daal ke lots aur bachi hui available quantity track karein
                </p>
              </div>
              <button
                onClick={handleOpenAddDalLot}
                className="jm-btn-primary !min-h-[38px] !text-xs !font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Layers size={15} />
                <span>+ Register New Dal Lot</span>
              </button>
            </div>

            {dalLots.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-white border border-dashed border-[#FCE7F3]">
                <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-3 text-yellow-800">
                  <Layers size={32} />
                </div>
                <h3 className="text-base font-black text-[#31102A]">No Dal Lots Registered Yet</h3>
                <p className="text-xs text-[#632055] max-w-md mx-auto mt-1 mb-4">
                  Jab bhi aap mandi ya supplier se Moong Dal mangwayein, "+ Register New Dal Lot" par click karke uska weight aur rate enter karein.
                </p>
                <button
                  onClick={handleOpenAddDalLot}
                  className="jm-btn-primary !text-xs !font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Layers size={15} />
                  <span>+ Register First Dal Lot</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {dalLots.map((lot) => (
                  <div key={lot.id} className="jm-card p-4 bg-white flex flex-col justify-between border border-[#FCE7F3]">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="font-mono font-black text-xs text-[#31102A] bg-amber-100 px-2 py-0.5 rounded">
                            {lot.lotNo}
                          </span>
                          <h3 className="font-extrabold text-sm text-[#31102A] mt-1.5">{lot.dalType || 'Moong Mogar Dal'}</h3>
                        </div>
                        <span className="text-xs font-black text-[#9F1239]">
                          ₹{lot.ratePerKgInr}/kg
                        </span>
                      </div>

                      <p className="text-xs text-[#632055]">Supplier: <span className="font-bold">{lot.supplierName}</span></p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Purchased: {lot.purchaseDate}</p>

                      {lot.notes && (
                        <p className="text-[11px] text-gray-600 mt-2 bg-[#FFF9FA] p-2 rounded border border-pink-100">
                          {lot.notes}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#FCE7F3] space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-[#FFF9FA] p-2 rounded-lg border border-[#FCE7F3]">
                          <div className="text-[9px] text-gray-500 uppercase font-bold">Initial Weight</div>
                          <div className="text-sm font-black text-[#31102A]">{lot.initialWeightKg} kg</div>
                        </div>
                        <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                          <div className="text-[9px] text-emerald-800 uppercase font-bold">Available Balance</div>
                          <div className="text-sm font-black text-emerald-700">{lot.availableWeightKg} kg</div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleDeleteDalLot(lot.id, lot.lotNo)}
                          className="p-1.5 text-gray-400 hover:text-red-700 rounded-lg hover:bg-red-50 border border-red-200 transition cursor-pointer"
                          title="Delete lot"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 4: DEMAND FORECAST & MPS ==================== */}
        {activeTab === 'FORECAST_MPS' && (
          <div className="space-y-6">
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
          </div>
        )}
      </div>

      {/* ==================== MODAL: ADD / EDIT WORKER ==================== */}
      {isWorkerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 border-2 border-[#FCE7F3] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-[#FCE7F3] pb-2">
              <h3 className="font-black text-base sm:text-lg text-[#31102A]">
                {editingWorker ? 'Edit Kaarigar / Worker' : '+ Add New Kaarigar / Worker'}
              </h3>
              <button onClick={() => setIsWorkerModalOpen(false)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveWorker} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Worker Name *</label>
                <input
                  type="text"
                  required
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  placeholder="e.g. Ramesh Bhai / Sunita Devi"
                  className="jm-input !text-xs !font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={workerPhone}
                  onChange={(e) => setWorkerPhone(e.target.value)}
                  placeholder="e.g. 9829112233"
                  className="jm-input !text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Work Role / Kaam ka Prakar *</label>
                <select
                  value={workerRole}
                  onChange={(e) => setWorkerRole(e.target.value)}
                  className="jm-select !text-xs"
                >
                  <option value="Mangodi Belan & Extrusion">Mangodi Belan & Extrusion (मंगोड़ी तोड़ना/बेलना)</option>
                  <option value="Moong Dal Soaking & Grinding">Moong Dal Soaking & Grinding (दाल भिगोना व पिसाई)</option>
                  <option value="Sun-Drying & Quality Sorting">Sun-Drying & Quality Sorting (धूप में सुखाना व छंटाई)</option>
                  <option value="Packaging & Pouch Sealing">Packaging & Pouch Sealing (पैकिंग व सीलिंग)</option>
                  <option value="Master Chef / Factory Supervisor">Master Chef / Factory Supervisor (मास्टर कारीगर)</option>
                  <option value="General Helper">General Helper (सामान्य सहायक)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#31102A] mb-1">Piece Rate (₹ / kg) *</label>
                  <input
                    type="number"
                    required
                    value={workerRate}
                    onChange={(e) => setWorkerRate(e.target.value)}
                    placeholder="e.g. 25"
                    className="jm-input !text-xs !font-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#31102A] mb-1">Daily Wage (Optional)</label>
                  <input
                    type="number"
                    value={workerDailyWage}
                    onChange={(e) => setWorkerDailyWage(e.target.value)}
                    placeholder="e.g. 400"
                    className="jm-input !text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Notes / Address (Optional)</label>
                <input
                  type="text"
                  value={workerNotes}
                  onChange={(e) => setWorkerNotes(e.target.value)}
                  placeholder="e.g. Fatehpur resident, expert in thin lambi shape"
                  className="jm-input !text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWorkerModalOpen(false)}
                  className="jm-btn-secondary flex-1 cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="jm-btn-primary flex-1 !font-black cursor-pointer">
                  {editingWorker ? 'Update Worker' : 'Save Worker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: RECORD WORKER PAYOUT ==================== */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 border-2 border-[#FCE7F3] shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-[#FCE7F3] pb-2">
              <h3 className="font-black text-base sm:text-lg text-[#31102A]">Record Kaarigar Payout / Wage</h3>
              <button onClick={() => setIsPayoutModalOpen(false)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePayout} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Select Kaarigar / Worker *</label>
                <select
                  value={payoutWorkerId}
                  onChange={(e) => setPayoutWorkerId(e.target.value)}
                  className="jm-select !text-xs"
                >
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.role}) · Rate: ₹{w.pieceRatePerKgInr}/kg
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#31102A] mb-1">Payout Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="e.g. 1500"
                    className="jm-input !text-xs !font-black text-emerald-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#31102A] mb-1">Kg Produced (Optional)</label>
                  <input
                    type="number"
                    value={payoutKg}
                    onChange={(e) => {
                      setPayoutKg(e.target.value);
                      const wrk = workers.find((w) => w.id === payoutWorkerId);
                      if (wrk && Number(e.target.value) > 0) {
                        setPayoutAmount(String(Number(e.target.value) * wrk.pieceRatePerKgInr));
                      }
                    }}
                    placeholder="e.g. 60"
                    className="jm-input !text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Cash', 'UPI'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayoutMethod(m)}
                      className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                        payoutMethod === m ? 'bg-[#31102A] text-white' : 'bg-white text-[#632055] border-[#FCE7F3]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Notes / Description (Optional)</label>
                <input
                  type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="e.g. Weekly wage for 60kg lambi plain batch"
                  className="jm-input !text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="jm-btn-secondary flex-1 cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="jm-btn-primary flex-1 !font-black cursor-pointer">
                  Save Payout Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADD DAL LOT ==================== */}
      {isDalLotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 border-2 border-[#FCE7F3] shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-[#FCE7F3] pb-2">
              <h3 className="font-black text-base sm:text-lg text-[#31102A]">+ Register New Dal Lot</h3>
              <button onClick={() => setIsDalLotModalOpen(false)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDalLot} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Lot Number / Code *</label>
                <input
                  type="text"
                  required
                  value={lotNo}
                  onChange={(e) => setLotNo(e.target.value)}
                  placeholder="e.g. DL-2026-001"
                  className="jm-input !text-xs !font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Supplier / Mandi Trader *</label>
                <input
                  type="text"
                  required
                  value={lotSupplier}
                  onChange={(e) => setLotSupplier(e.target.value)}
                  placeholder="e.g. Nagaur Mandi Traders / Bikaner Depot"
                  className="jm-input !text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Dal Variety *</label>
                <select
                  value={lotDalType}
                  onChange={(e) => setLotDalType(e.target.value)}
                  className="jm-select !text-xs"
                >
                  <option value="Moong Mogar Dal (Grade A)">Moong Mogar Dal (Grade A - Premium Yellow)</option>
                  <option value="Moong Mogar Dal (Standard)">Moong Mogar Dal (Standard)</option>
                  <option value="Moong Chilka Dal">Moong Chilka Dal</option>
                  <option value="Chana Dal Special">Chana Dal Special</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#31102A] mb-1">Initial Weight (kg) *</label>
                  <input
                    type="number"
                    required
                    value={lotWeight}
                    onChange={(e) => setLotWeight(e.target.value)}
                    placeholder="e.g. 500"
                    className="jm-input !text-xs !font-black text-emerald-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#31102A] mb-1">Rate (₹ / kg) *</label>
                  <input
                    type="number"
                    required
                    value={lotRate}
                    onChange={(e) => setLotRate(e.target.value)}
                    placeholder="e.g. 92"
                    className="jm-input !text-xs !font-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={lotDate}
                  onChange={(e) => setLotDate(e.target.value)}
                  className="jm-input !text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={lotNotes}
                  onChange={(e) => setLotNotes(e.target.value)}
                  placeholder="e.g. 10 bags of 50kg each, high protein moisture < 10%"
                  className="jm-input !text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDalLotModalOpen(false)}
                  className="jm-btn-secondary flex-1 cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="jm-btn-primary flex-1 !font-black cursor-pointer">
                  Save Dal Lot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: CHANGE BATCH STATUS ==================== */}
      {statusBatch && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border-2 border-[#FCE7F3] shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-[#FCE7F3] pb-2">
              <h3 className="font-black text-base text-[#31102A]">Update Batch Status</h3>
              <button onClick={() => setStatusBatch(null)} className="text-gray-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-3.5">
              <div className="text-xs text-[#632055]">
                Batch: <span className="font-mono font-bold text-[#31102A]">{statusBatch.batchCode}</span> ({statusBatch.productType})
              </div>

              <div>
                <label className="block text-xs font-bold text-[#31102A] mb-1">Select New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as BatchStatus)}
                  className="jm-select !text-xs"
                >
                  <option value="DRYING">DRYING (धूप में सुखाना चालू है)</option>
                  <option value="QC_CHECK">QC_CHECK (क्वालिटी व मॉइस्चर जांच)</option>
                  <option value="CURING">CURING (कूलिंग व सेट होना)</option>
                  <option value="RELEASED">RELEASED (स्टॉक में पास होकर ऐड करें ✓)</option>
                  <option value="REJECTED">REJECTED (खारिज)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusBatch(null)}
                  className="jm-btn-secondary flex-1 cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="jm-btn-primary flex-1 !font-black cursor-pointer">
                  Update Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== 5-STEP BATCH CREATION WIZARD ==================== */}
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
                  <label className="block text-xs font-bold text-[#31102A] mb-1">Product Variant *</label>
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

                {dalLots.length > 0 ? (
                  <div>
                    <label className="block text-xs font-bold text-[#31102A] mb-1">Select Dal Lot *</label>
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
                ) : (
                  <div className="p-3.5 bg-yellow-50 rounded-xl border border-yellow-200 space-y-2">
                    <div className="text-xs font-bold text-yellow-900">Direct Dal Purchase Entry:</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Supplier / Mandi name"
                        value={customDalSupplier}
                        onChange={(e) => setCustomDalSupplier(e.target.value)}
                        className="jm-input !text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Rate ₹/kg"
                        value={customDalRate}
                        onChange={(e) => setCustomDalRate(e.target.value)}
                        className="jm-input !text-xs"
                      />
                    </div>
                  </div>
                )}

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

                {workers.length === 0 ? (
                  <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200 text-xs">
                    <p className="text-yellow-900 font-bold mb-2">No workers registered yet.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsWorkerModalOpen(true);
                      }}
                      className="jm-btn-secondary !text-xs cursor-pointer"
                    >
                      + Add Worker Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto">
                    {workers.map((w) => (
                      <div key={w.id} className="p-3 rounded-xl border border-[#FCE7F3] bg-white flex items-center justify-between gap-3">
                        <div>
                          <div className="font-extrabold text-xs text-[#31102A]">{w.name}</div>
                          <div className="text-[10px] text-[#632055]">{w.role || 'Kaarigar'} · Rate: ₹{w.pieceRatePerKgInr}/kg</div>
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
                )}

                <div className="p-3 rounded-xl bg-[#FEFCE8] border border-[#FDE047] flex justify-between items-center text-xs">
                  <span className="font-bold text-[#31102A]">Total Labor Cost:</span>
                  <span className="font-black text-[#9F1239] text-sm">₹{liveLabor.totalLaborCostInr.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

            {/* Step 4: QC Gates & Packaging Lots */}
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

                {/* Packaging Distribution */}
                <div className="p-4 rounded-xl border border-[#FCE7F3] bg-white space-y-2">
                  <h4 className="font-extrabold text-xs text-[#31102A]">Packaging Output Quantity</h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">250g Packs</label>
                      <input
                        type="number"
                        value={pack250Count}
                        onChange={(e) => setPack250Count(e.target.value)}
                        placeholder="0"
                        className="jm-input !text-xs !py-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">500g Packs</label>
                      <input
                        type="number"
                        value={pack500Count}
                        onChange={(e) => setPack500Count(e.target.value)}
                        placeholder="0"
                        className="jm-input !text-xs !py-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">1kg Packs</label>
                      <input
                        type="number"
                        value={pack1000Count}
                        onChange={(e) => setPack1000Count(e.target.value)}
                        placeholder="0"
                        className="jm-input !text-xs !py-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Final Cost Rollup */}
                <div className="p-4 rounded-xl bg-[#FEFCE8] border border-[#FDE047] space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Dal Cost ({rawDalNum}kg @ ₹{effectiveDalRate}/kg):</span>
                    <span className="font-bold">₹{liveCogs.dalCostInr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Labor Payouts:</span>
                    <span className="font-bold">₹{liveCogs.laborCostInr}</span>
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
                  className="jm-btn-secondary !text-xs cursor-pointer"
                >
                  ← Previous
                </button>
              ) : <div />}

              {wizardStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((s) => s + 1)}
                  className="jm-btn-primary !text-xs !font-bold cursor-pointer"
                >
                  Next Step →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateBatch}
                  className="jm-btn-primary !text-xs !font-black bg-emerald-600 hover:bg-emerald-700 text-white !border-emerald-700 shadow-md cursor-pointer"
                >
                  Release Batch to Stock ✓
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TRACEABILITY MODAL ==================== */}
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
              </div>

              <div className="text-center font-bold text-gray-400">↓</div>

              <div className="p-3 rounded-xl bg-[#FEFCE8] border border-[#FDE047]">
                <div className="font-bold text-[#31102A] text-[11px] uppercase">2. Batching & Sun Drying</div>
                <div className="font-black text-sm text-[#31102A] mt-0.5">{selectedTraceBatch.batchCode} ({selectedTraceBatch.productType})</div>
                <div className="text-[#632055]">
                  Dal: {selectedTraceBatch.rawDalWeightKg}kg → Dried: {selectedTraceBatch.driedYieldKg}kg (Shrinkage: {selectedTraceBatch.shrinkagePct}%)
                </div>
                <div className="text-[#632055] mt-1 font-semibold">
                  Workers: {selectedTraceBatch.labourEntries.length > 0 ? selectedTraceBatch.labourEntries.map((l) => `${l.workerName} (${l.driedKg}kg)`).join(', ') : 'Direct Master Batch'}
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
              className="w-full mt-4 jm-btn-secondary !text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
