import { useState, useMemo } from 'react';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';
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
    <div className="min-h-[calc(100vh-8rem)] pb-32 md:pb-12 bg-surface">
      <PageHeader
        title="Manufacturing & Production Intelligence"
        subtitle="Moong dal batching, kaarigar piece-rate payouts, shrinkage analytics & Holt-Winters forecasting"
        actions={
          <>
            <button
              onClick={handleOpenAddWorker}
              className="jm-btn-secondary flex items-center gap-1.5 flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <UserPlus size={15} />
              <span>Add Worker</span>
            </button>
            <button
              onClick={handleOpenAddDalLot}
              className="jm-btn-secondary flex items-center gap-1.5 flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <Layers size={15} />
              <span>Add Dal Lot</span>
            </button>
            <button
              onClick={handleOpenBatchWizard}
              className="jm-btn-primary !font-semibold flex items-center gap-1.5 shadow-sm flex-1 sm:flex-none justify-center cursor-pointer"
            >
              <Plus size={16} />
              <span>Start New Batch</span>
            </button>
          </>
        }
      />

      {/* Navigation Sub-Tabs */}
      <div className="bg-surface border-b border-border px-3 sm:px-4 py-2 sticky top-0 z-20 shadow-xs">
        <div className="mx-auto max-w-7xl flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('BATCHES')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'BATCHES'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-card border-border text-ink-muted'
            }`}
          >
            <Factory size={14} />
            <span>Batches & Traceability</span>
            <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[11px] font-bold">
              {productionBatches.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('WORKERS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'WORKERS'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-card border-border text-ink-muted'
            }`}
          >
            <Users size={14} />
            <span>Kaarigar & Workers Ledger</span>
            <span className="bg-primary-soft text-ink px-1.5 py-0.5 rounded-full text-[11px] font-bold">
              {workers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('DAL_LOTS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'DAL_LOTS'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-card border-border text-ink-muted'
            }`}
          >
            <Layers size={14} />
            <span>Dal Lots & Procurement</span>
            <span className="bg-warning-soft text-ink px-1.5 py-0.5 rounded-full text-[11px] font-bold">
              {dalLots.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('FORECAST_MPS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'FORECAST_MPS'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-card border-border text-ink-muted'
            }`}
          >
            <TrendingUp size={14} />
            <span>Demand Forecast & MPS</span>
            <span className="bg-surface text-ink px-1.5 py-0.5 rounded-full text-[11px] font-bold">
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
            {productionBatches.length > 0 && (<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
              <div className="jm-card p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-ink-muted">Total Batches</span>
                  <Factory size={17} className="text-primary" />
                </div>
                <div className="text-xl font-bold text-ink mt-1.5">
                  {productionBatches.length}
                </div>
                <div className="text-[11px] sm:text-[11px] text-success font-semibold mt-0.5">
                  {productionBatches.filter((b) => b.status === 'RELEASED').length} released to stock
                </div>
              </div>

              <div className="jm-card p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-ink-muted">Sun Drying Yield</span>
                  <Sun size={17} className="text-warning" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-primary mt-1.5">
                  {productionBatches.length > 0
                    ? `${(productionBatches.reduce((a, b) => a + b.shrinkagePct, 0) / productionBatches.length).toFixed(1)}%`
                    : '55.8%'}
                </div>
                <div className="text-[11px] sm:text-[11px] text-ink-muted font-semibold mt-0.5">
                  Standard moisture shrinkage
                </div>
              </div>

              <div className="jm-card p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-ink-muted">Active Workers</span>
                  <Users size={17} className="text-ink" />
                </div>
                <div className="text-xl font-bold text-ink mt-1.5">
                  {workers.length}
                </div>
                <div className="text-[11px] sm:text-[11px] text-success font-semibold mt-0.5">
                  Registered Kaarigar staff
                </div>
              </div>

              <div className="jm-card p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-ink-muted">Dal Lots In Stock</span>
                  <Layers size={17} className="text-primary" />
                </div>
                <div className="text-xl font-bold text-ink mt-1.5">
                  {dalLots.length}
                </div>
                <div className="text-[11px] sm:text-[11px] text-ink-muted font-semibold mt-0.5">
                  {dalLots.reduce((acc, l) => acc + l.availableWeightKg, 0)} kg available
                </div>
              </div>
            </div>

            )}
            {/* Batches Table or Empty State */}
            <div className="jm-card p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border pb-3 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-ink">
                    Production Batches & Traceability
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Bi-directional traceability from raw dal lot to final customer dispatch
                  </p>
                </div>
                <button
                  onClick={handleOpenBatchWizard}
                  className="jm-btn-primary flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>+ Start Batch</span>
                </button>
              </div>

              {productionBatches.length === 0 ? (
                <EmptyState
                  icon={<Factory size={24} />}
                  title="No Production Batches Created Yet"
                  description={'Jab bhi aap moong dal ki mangodi ka naya batch taiyar karein, "+ Start New Batch" par click karke dal ka weight, drying yield aur kaarigar piece-rate enter karein.'}
                  action={
                    <button className="jm-btn-primary" onClick={handleOpenBatchWizard}>
                      <Plus size={16} /> Start First Production Batch
                    </button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs font-semibold text-ink-muted uppercase tracking-wide border-b border-border">
                      <tr>
                        <th scope="col" className="p-3">Batch Code</th>
                        <th scope="col" className="p-3">Product Variant</th>
                        <th scope="col" className="p-3">Dal Lot</th>
                        <th scope="col" className="p-3">Raw / Dried Kg</th>
                        <th scope="col" className="p-3">Shrinkage %</th>
                        <th scope="col" className="p-3">COGS / kg</th>
                        <th scope="col" className="p-3">Status</th>
                        <th scope="col" className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-border">
                      {productionBatches.map((batch) => (
                        <tr key={batch.id} className="even:bg-surface hover:bg-surface transition">
                          <td className="p-2.5 sm:p-3 font-mono font-bold text-ink">{batch.batchCode}</td>
                          <td className="p-2.5 sm:p-3">
                            <div className="font-semibold text-ink">{batch.productType}</div>
                            <div className="text-[11px] text-ink-muted">{batch.shape}</div>
                          </td>
                          <td className="p-2.5 sm:p-3 font-mono text-[11px] text-ink-muted">{batch.dalLotNo}</td>
                          <td className="p-2.5 sm:p-3">
                            <span className="font-bold text-ink">{batch.rawDalWeightKg} kg</span>
                            <span className="text-ink-faint mx-1">→</span>
                            <span className="font-semibold text-success">{batch.driedYieldKg} kg</span>
                          </td>
                          <td className="p-2.5 sm:p-3">
                            <span className="px-2 py-0.5 rounded-lg bg-warning-soft text-warning border border-warning font-bold">
                              {batch.shrinkagePct}%
                            </span>
                          </td>
                          <td className="p-2.5 sm:p-3 font-bold text-primary"><span className="font-mono">₹</span>{batch.costPerKgInr}</td>
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
                                <StatusBadge status="success" label="RELEASED" icon={CheckCircle2} />
                              ) : batch.status === 'REJECTED' ? (
                                <StatusBadge status="danger" label="REJECTED" icon={XCircle} />
                              ) : (
                                <StatusBadge status="warning" label={batch.status} icon={AlertTriangle} />
                              )}
                            </button>
                          </td>
                          <td className="p-2.5 sm:p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedTraceBatch(batch)}
                                className="jm-btn-secondary !text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <History size={12} />
                                <span>Trace</span>
                              </button>
                              <button
                                onClick={() => handleDeleteBatch(batch.id, batch.batchCode)}
                                className="p-1.5 text-ink-faint hover:text-danger rounded-lg hover:bg-danger-soft transition cursor-pointer"
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-border">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-ink">
                  Kaarigar & Worker Piece-Rate Management
                </h2>
                <p className="text-xs text-ink-muted">
                  Apne karigaron ko add karein, unka kaam define karein aur ₹/kg rate ya daily wage track karein
                </p>
              </div>
              <button
                onClick={handleOpenAddWorker}
                className="jm-btn-primary flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus size={15} />
                <span>+ Add Kaarigar / Worker</span>
              </button>
            </div>

            {workers.length === 0 ? (
              <EmptyState
                icon={<Users size={24} />}
                title="No Kaarigar or Workers Added Yet"
                description="Mangodi banane wale, daal peesne wale aur packing karne wale karigaron ko yahan add karein taaki unki banayi hui mangodi aur piece-rate ledger maintain rahe."
                action={
                  <button className="jm-btn-primary" onClick={handleOpenAddWorker}>
                    <UserPlus size={16} /> Add First Kaarigar / Worker
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {workers.map((w) => (
                  <div key={w.id} className="jm-card p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-semibold text-sm text-ink">{w.name}</h3>
                          <span className="inline-block mt-0.5 text-[11px] font-bold text-primary bg-primary-soft px-2 py-0.5 rounded-lg border border-primary">
                            {w.role || 'Mangodi Belan & Extrusion'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold bg-surface text-ink px-2 py-0.5 rounded-lg">
                            <span className="font-mono">₹</span>{w.pieceRatePerKgInr}/kg
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-ink-muted font-mono mt-1">
                        {w.phone ? `📞 ${w.phone}` : 'No phone entered'}
                      </div>

                      {w.notes && (
                        <p className="text-[11px] text-ink-muted mt-2 bg-surface p-2 rounded-lg border border-border">
                          {w.notes}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-border space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-surface p-2 rounded-lg border border-border">
                          <div className="text-[11px] text-ink-muted uppercase font-bold">Produced</div>
                          <div className="text-sm font-bold text-ink">{w.totalKgProduced} kg</div>
                        </div>
                        <div className="bg-success-soft p-2 rounded-lg border border-success">
                          <div className="text-[11px] text-success uppercase font-bold">Total Paid</div>
                          <div className="text-sm font-bold text-success">
                            <span className="font-mono">₹</span>{w.totalEarnedInr.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          onClick={() => handleOpenPayout(w)}
                          className="flex-1 jm-btn-primary !text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <DollarSign size={13} />
                          <span>+ Record Payout</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditWorker(w)}
                          className="p-1.5 text-ink-muted hover:text-ink rounded-lg hover:bg-surface border border-border transition cursor-pointer"
                          title="Edit worker"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteWorker(w.id, w.name)}
                          className="p-1.5 text-ink-faint hover:text-danger rounded-lg hover:bg-danger-soft border border-danger transition cursor-pointer"
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-border">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-ink">
                  Moong Dal Lots & Procurement Ledger
                </h2>
                <p className="text-xs text-ink-muted">
                  Mandi se khareedi hui kacchi moong daal ke lots aur bachi hui available quantity track karein
                </p>
              </div>
              <button
                onClick={handleOpenAddDalLot}
                className="jm-btn-primary flex items-center gap-1.5 cursor-pointer"
              >
                <Layers size={15} />
                <span>+ Register New Dal Lot</span>
              </button>
            </div>

            {dalLots.length === 0 ? (
              <EmptyState
                icon={<Layers size={24} />}
                title="No Dal Lots Registered Yet"
                description={'Jab bhi aap mandi ya supplier se Moong Dal mangwayein, "+ Register New Dal Lot" par click karke uska weight aur rate enter karein.'}
                action={
                  <button className="jm-btn-primary" onClick={handleOpenAddDalLot}>
                    <Layers size={16} /> Register First Dal Lot
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {dalLots.map((lot) => (
                  <div key={lot.id} className="jm-card p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="font-mono font-bold text-xs text-ink bg-warning-soft px-2 py-0.5 rounded">
                            {lot.lotNo}
                          </span>
                          <h3 className="font-semibold text-sm text-ink mt-1.5">{lot.dalType || 'Moong Mogar Dal'}</h3>
                        </div>
                        <span className="text-xs font-bold text-primary">
                          <span className="font-mono">₹</span>{lot.ratePerKgInr}/kg
                        </span>
                      </div>

                      <p className="text-xs text-ink-muted">Supplier: <span className="font-bold">{lot.supplierName}</span></p>
                      <p className="text-[11px] text-ink-muted mt-0.5">Purchased: {lot.purchaseDate}</p>

                      {lot.notes && (
                        <p className="text-[11px] text-ink-muted mt-2 bg-surface p-2 rounded border border-border">
                          {lot.notes}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-border space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-surface p-2 rounded-lg border border-border">
                          <div className="text-[11px] text-ink-muted uppercase font-bold">Initial Weight</div>
                          <div className="text-sm font-bold text-ink">{lot.initialWeightKg} kg</div>
                        </div>
                        <div className="bg-success-soft p-2 rounded-lg border border-success">
                          <div className="text-[11px] text-success uppercase font-bold">Available Balance</div>
                          <div className="text-sm font-bold text-success">{lot.availableWeightKg} kg</div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleDeleteDalLot(lot.id, lot.lotNo)}
                          className="p-1.5 text-ink-faint hover:text-danger rounded-lg hover:bg-danger-soft border border-danger transition cursor-pointer"
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
            <div className="jm-card p-5 sm:p-6  bg-ink text-white">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-amber-300" size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-faint">
                      Predictive Demand Engine
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold mt-1">
                    Holt-Winters Multiplicative Triple Exponential Smoothing
                  </h2>
                  <p className="text-xs text-primary max-w-2xl mt-1">
                    Continuously learns seasonal patterns and demand velocity from {forecastData.demandHistoryDates.length} historical sales days.
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl border border-white/20">
                  <div className="text-center px-2">
                    <div className="text-[11px] text-ink-faint font-bold">Model</div>
                    <div className="text-xs font-mono font-bold">{forecastData.forecastResult.modelType}</div>
                  </div>
                  <div className="h-8 w-px bg-white/20" />
                  <div className="text-center px-2">
                    <div className="text-[11px] text-ink-faint font-bold">MAPE Error</div>
                    <div className="text-xs font-mono font-bold text-emerald-300">{forecastData.forecastResult.mapePct}%</div>
                  </div>
                  <div className="h-8 w-px bg-white/20" />
                  <div className="text-center px-2">
                    <div className="text-[11px] text-ink-faint font-bold">Params (α, β, γ)</div>
                    <div className="text-[11px] font-mono font-bold">
                      {forecastData.forecastResult.alpha}, {forecastData.forecastResult.beta}, {forecastData.forecastResult.gamma}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 7-Day Forecast Cards */}
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-ink mb-3 flex items-center gap-2">
                <Calendar size={16} className="text-primary" />
                <span>Next 7-Day Predicted Demand (kg)</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {forecastData.mpsSchedule.slice(0, 7).map((slot, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                      slot.isBelowSafetyStock
                        ? 'bg-danger-soft border-danger'
                        : 'bg-white border-border'
                    }`}
                  >
                    <div>
                      <div className="text-[11px] font-bold text-ink-muted uppercase">
                        Day +{slot.dayIndex} ({slot.dateStr.slice(5)})
                      </div>
                      <div className="text-xl font-bold text-ink mt-1">
                        {slot.forecastDemandKg} <span className="text-xs font-medium">kg</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-border">
                      <div className="text-[11px] text-ink-muted">Ending PAB:</div>
                      <div className={`text-xs font-bold ${slot.endingPABKg < slot.safetyStockKg ? 'text-danger' : 'text-success'}`}>
                        {slot.endingPABKg} kg
                      </div>
                      {slot.recommendedBatchKg > 0 && (
                        <div className="mt-1 text-[11px] font-bold text-danger bg-danger-soft px-1.5 py-0.5 rounded">
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
      <Modal id="worker-form" isOpen={isWorkerModalOpen} onClose={() => setIsWorkerModalOpen(false)} title={editingWorker ? 'Edit Kaarigar / Worker' : '+ Add New Kaarigar / Worker'}>
        <form onSubmit={handleSaveWorker} className="space-y-3.5">
              <div>
                <label htmlFor="workername_id" className="block text-xs font-bold text-ink mb-1">Worker Name *</label>
                <input id="workername_id" type="text"
                  required
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  placeholder="e.g. Ramesh Bhai / Sunita Devi"
                  className="jm-input "
                />
              </div>

              <div>
                <label htmlFor="phonenumberoptional_id" className="block text-xs font-bold text-ink mb-1">Phone Number (Optional)</label>
                <input id="phonenumberoptional_id" type="tel"
                  value={workerPhone}
                  onChange={(e) => setWorkerPhone(e.target.value)}
                  placeholder="e.g. 9829112233"
                  className="jm-input font-mono"
                />
              </div>

              <div>
                <label htmlFor="workrolekaamkaprakar_id" className="block text-xs font-bold text-ink mb-1">Work Role / Kaam ka Prakar *</label>
                <select id="workrolekaamkaprakar_id"
                  value={workerRole}
                  onChange={(e) => setWorkerRole(e.target.value)}
                  className="jm-select "
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
                  <label htmlFor="pieceratekg_id" className="block text-xs font-bold text-ink mb-1">Piece Rate (₹ / kg) *</label>
                <input id="pieceratekg_id" type="number"
                    required
                    value={workerRate}
                    onChange={(e) => setWorkerRate(e.target.value)}
                    placeholder="e.g. 25"
                    className="jm-input "
                  />
                </div>
                <div>
                  <label htmlFor="dailywageoptional_id" className="block text-xs font-bold text-ink mb-1">Daily Wage (Optional)</label>
                <input id="dailywageoptional_id" type="number"
                    value={workerDailyWage}
                    onChange={(e) => setWorkerDailyWage(e.target.value)}
                    placeholder="e.g. 400"
                    className="jm-input "
                  />
                </div>
              </div>

              <div>
                <label htmlFor="notesaddressoptional_id" className="block text-xs font-bold text-ink mb-1">Notes / Address (Optional)</label>
                <input id="notesaddressoptional_id" type="text"
                  value={workerNotes}
                  onChange={(e) => setWorkerNotes(e.target.value)}
                  placeholder="e.g. Fatehpur resident, expert in thin lambi shape"
                  className="jm-input "
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
                <button type="submit" className="jm-btn-primary flex-1 cursor-pointer">
                  {editingWorker ? 'Update Worker' : 'Save Worker'}
                </button>
              </div>
            </form>
      </Modal>

      {/* ==================== MODAL: RECORD WORKER PAYOUT ==================== */}
      <Modal id="worker-payout" isOpen={isPayoutModalOpen} onClose={() => setIsPayoutModalOpen(false)} title="Record Kaarigar Payout / Wage">
        <form onSubmit={handleSavePayout} className="space-y-3.5">
              <div>
                <label htmlFor="selectkaarigarworker_id" className="block text-xs font-bold text-ink mb-1">Select Kaarigar / Worker *</label>
                <select id="selectkaarigarworker_id"
                  value={payoutWorkerId}
                  onChange={(e) => setPayoutWorkerId(e.target.value)}
                  className="jm-select "
                >
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.role}) · Rate: <span className="font-mono">₹</span>{w.pieceRatePerKgInr}/kg
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="payoutamount_id" className="block text-xs font-bold text-ink mb-1">Payout Amount (₹) *</label>
                <input id="payoutamount_id" type="number"
                    required
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="e.g. 1500"
                    className="jm-input text-success"
                  />
                </div>
                <div>
                  <label htmlFor="kgproducedoptional_id" className="block text-xs font-bold text-ink mb-1">Kg Produced (Optional)</label>
                <input id="kgproducedoptional_id" type="number"
                    value={payoutKg}
                    onChange={(e) => {
                      setPayoutKg(e.target.value);
                      const wrk = workers.find((w) => w.id === payoutWorkerId);
                      if (wrk && Number(e.target.value) > 0) {
                        setPayoutAmount(String(Number(e.target.value) * wrk.pieceRatePerKgInr));
                      }
                    }}
                    placeholder="e.g. 60"
                    className="jm-input "
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Cash', 'UPI'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayoutMethod(m)}
                      className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                        payoutMethod === m ? 'bg-[ink] text-white' : 'bg-white text-ink-muted border-border'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="notesdescriptionoptional_id" className="block text-xs font-bold text-ink mb-1">Notes / Description (Optional)</label>
                <input id="notesdescriptionoptional_id" type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="e.g. Weekly wage for 60kg lambi plain batch"
                  className="jm-input "
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
                <button type="submit" className="jm-btn-primary flex-1 cursor-pointer">
                  Save Payout Entry
                </button>
              </div>
            </form>
      </Modal>

      {/* ==================== MODAL: ADD DAL LOT ==================== */}
      <Modal id="dal-lot-form" isOpen={isDalLotModalOpen} onClose={() => setIsDalLotModalOpen(false)} title="+ Register New Dal Lot">
        <form onSubmit={handleSaveDalLot} className="space-y-3.5">
              <div>
                <label htmlFor="lotnumbercode_id" className="block text-xs font-bold text-ink mb-1">Lot Number / Code *</label>
                <input id="lotnumbercode_id" type="text"
                  required
                  value={lotNo}
                  onChange={(e) => setLotNo(e.target.value)}
                  placeholder="e.g. DL-2026-001"
                  className="jm-input font-mono"
                />
              </div>

              <div>
                <label htmlFor="suppliermanditrader_id" className="block text-xs font-bold text-ink mb-1">Supplier / Mandi Trader *</label>
                <input id="suppliermanditrader_id" type="text"
                  required
                  value={lotSupplier}
                  onChange={(e) => setLotSupplier(e.target.value)}
                  placeholder="e.g. Nagaur Mandi Traders / Bikaner Depot"
                  className="jm-input "
                />
              </div>

              <div>
                <label htmlFor="dalvariety_id" className="block text-xs font-bold text-ink mb-1">Dal Variety *</label>
                <select id="dalvariety_id"
                  value={lotDalType}
                  onChange={(e) => setLotDalType(e.target.value)}
                  className="jm-select "
                >
                  <option value="Moong Mogar Dal (Grade A)">Moong Mogar Dal (Grade A - Premium Yellow)</option>
                  <option value="Moong Mogar Dal (Standard)">Moong Mogar Dal (Standard)</option>
                  <option value="Moong Chilka Dal">Moong Chilka Dal</option>
                  <option value="Chana Dal Special">Chana Dal Special</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="initialweightkg_id" className="block text-xs font-bold text-ink mb-1">Initial Weight (kg) *</label>
                <input id="initialweightkg_id" type="number"
                    required
                    value={lotWeight}
                    onChange={(e) => setLotWeight(e.target.value)}
                    placeholder="e.g. 500"
                    className="jm-input text-success"
                  />
                </div>
                <div>
                  <label htmlFor="ratekg_id" className="block text-xs font-bold text-ink mb-1">Rate (₹ / kg) *</label>
                <input id="ratekg_id" type="number"
                    required
                    value={lotRate}
                    onChange={(e) => setLotRate(e.target.value)}
                    placeholder="e.g. 92"
                    className="jm-input "
                  />
                </div>
              </div>

              <div>
                <label htmlFor="purchasedate_id" className="block text-xs font-bold text-ink mb-1">Purchase Date</label>
                <input id="purchasedate_id" type="date"
                  value={lotDate}
                  onChange={(e) => setLotDate(e.target.value)}
                  className="jm-input font-mono"
                />
              </div>

              <div>
                <label htmlFor="notesoptional_id" className="block text-xs font-bold text-ink mb-1">Notes (Optional)</label>
                <input id="notesoptional_id" type="text"
                  value={lotNotes}
                  onChange={(e) => setLotNotes(e.target.value)}
                  placeholder="e.g. 10 bags of 50kg each, high protein moisture < 10%"
                  className="jm-input "
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
                <button type="submit" className="jm-btn-primary flex-1 cursor-pointer">
                  Save Dal Lot
                </button>
              </div>
            </form>
      </Modal>

      {/* ==================== MODAL: CHANGE BATCH STATUS ==================== */}
      <Modal id="batch-status" isOpen={!!statusBatch} onClose={() => setStatusBatch(null)} title="Update Batch Status">
        <form onSubmit={handleUpdateStatus} className="space-y-3.5">
              <div className="text-xs text-ink-muted">
                Batch: <span className="font-mono font-bold text-ink">{statusBatch.batchCode}</span> ({statusBatch.productType})
              </div>

              <div>
                <label htmlFor="selectnewstatus_id" className="block text-xs font-bold text-ink mb-1">Select New Status</label>
                <select id="selectnewstatus_id"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as BatchStatus)}
                  className="jm-select "
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
                <button type="submit" className="jm-btn-primary flex-1 cursor-pointer">
                  Update Status
                </button>
              </div>
            </form>
      </Modal>

      {/* ==================== 5-STEP BATCH CREATION WIZARD ==================== */}
      <Modal id="batch-wizard" isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} title="Production Batch Wizard" size="2xl">
        <p className="text-xs text-ink-muted mb-4">
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
        {/* Step Indicators */}
            <div className="flex items-center justify-between mb-6 px-2">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center gap-1.5 sm:gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                      wizardStep === s
                        ? 'bg-primary text-white shadow-sm'
                        : wizardStep > s
                        ? 'bg-primary text-white'
                        : 'bg-card text-ink-muted border border-border'
                    }`}
                  >
                    {wizardStep > s ? '✓' : s}
                  </div>
                  {s < 4 && <div className={`w-8 sm:w-20 h-1 rounded-full ${wizardStep > s ? 'bg-primary' : 'bg-surface'}`} />}
                </div>
              ))}
            </div>

            {/* Step 1: Raw Dal Selection */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="productvariant_id" className="block text-xs font-bold text-ink mb-1">Product Variant *</label>
                <select id="productvariant_id"
                    value={prodType}
                    onChange={(e) => {
                      setProdType(e.target.value);
                      if (e.target.value.includes('Masala')) setShape('MASALA');
                      else if (e.target.value.includes('Gol')) setShape('GOL');
                      else setShape('LAMBI');
                    }}
                    className="jm-select "
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
                    <label htmlFor="selectdallot_id" className="block text-xs font-bold text-ink mb-1">Select Dal Lot *</label>
                <select id="selectdallot_id"
                      value={selectedDalLotId}
                      onChange={(e) => setSelectedDalLotId(e.target.value)}
                      className="jm-select "
                    >
                      {dalLots.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.lotNo} ({l.supplierName}) · Available: {l.availableWeightKg} kg · Rate: <span className="font-mono">₹</span>{l.ratePerKgInr}/kg
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="p-3.5 bg-warning-soft rounded-xl border border-warning space-y-2">
                    <div className="text-xs font-bold text-warning">Direct Dal Purchase Entry:</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Supplier / Mandi name"
                        value={customDalSupplier}
                        onChange={(e) => setCustomDalSupplier(e.target.value)}
                        className="jm-input "
                      />
                      <input
                        type="number"
                        placeholder="Rate ₹/kg"
                        value={customDalRate}
                        onChange={(e) => setCustomDalRate(e.target.value)}
                        className="jm-input "
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="drydalweightkg_id" className="block text-xs font-bold text-ink mb-1">Dry Dal Weight (kg) *</label>
                <input id="drydalweightkg_id" type="number"
                      value={rawDalWeight}
                      onChange={(e) => setRawDalWeight(e.target.value)}
                      className="jm-input "
                    />
                  </div>
                  <div>
                    <label htmlFor="wetpasteweightkg_id" className="block text-xs font-bold text-ink mb-1">Wet Paste Weight (kg)</label>
                <input id="wetpasteweightkg_id" type="number"
                      value={wetWeight}
                      onChange={(e) => setWetWeight(e.target.value)}
                      className="jm-input "
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-border text-xs flex justify-between items-center">
                  <span className="text-ink-muted font-semibold">Moisture Ratio:</span>
                  <span className="font-bold text-ink">{liveYieldAnalysis.moistureRatio}x (Standard: ~2.18x)</span>
                </div>
              </div>
            )}

            {/* Step 2: Drying & Shrinkage */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="postsundryingyieldkg_id" className="block text-xs font-bold text-ink mb-1">Post Sun-Drying Yield (kg) *</label>
                <input id="postsundryingyieldkg_id" type="number"
                    value={driedWeight}
                    onChange={(e) => setDriedWeight(e.target.value)}
                    className="jm-input !text-lg text-success"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-warning-soft border border-warning">
                    <div className="text-[11px] uppercase font-bold text-warning">Shrinkage %</div>
                    <div className="text-xl font-bold text-warning">{liveYieldAnalysis.shrinkagePct}%</div>
                    <div className="text-[11px] text-warning mt-0.5">Moisture loss in sun drying</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-success-soft border border-success">
                    <div className="text-[11px] uppercase font-bold text-success">Actual Yield</div>
                    <div className="text-xl font-bold text-success">{liveYieldAnalysis.actualYieldPct}%</div>
                    <div className="text-[11px] text-success mt-0.5">Variance: {liveYieldAnalysis.yieldVariancePct > 0 ? '+' : ''}{liveYieldAnalysis.yieldVariancePct}%</div>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  liveYieldAnalysis.status === 'OPTIMAL'
                    ? 'bg-success-soft border-success text-success'
                    : liveYieldAnalysis.status === 'WARNING_LOW_YIELD'
                    ? 'bg-warning-soft border-warning text-warning'
                    : 'bg-danger-soft border-danger text-danger'
                }`}>
                  {liveYieldAnalysis.diagnosisMessage}
                </div>
              </div>
            )}

            {/* Step 3: Piece-Rate Labor Allocation */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-surface border border-border text-xs flex justify-between items-center">
                  <span className="font-bold text-ink">Total Dried Output to Distribute:</span>
                  <span className="font-bold text-success text-sm">{driedNum} kg</span>
                </div>

                {workers.length === 0 ? (
                  <div className="p-4 bg-warning-soft rounded-xl border border-warning text-xs">
                    <p className="text-warning font-bold mb-2">No workers registered yet.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsWorkerModalOpen(true);
                      }}
                      className="jm-btn-secondary cursor-pointer"
                    >
                      + Add Worker Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto">
                    {workers.map((w) => (
                      <div key={w.id} className="p-3 rounded-xl border border-border bg-white flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-xs text-ink">{w.name}</div>
                          <div className="text-[11px] text-ink-muted">{w.role || 'Kaarigar'} · Rate: <span className="font-mono">₹</span>{w.pieceRatePerKgInr}/kg</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="kg"
                            value={workerKgs[w.id] || ''}
                            onChange={(e) => setWorkerKgs({ ...workerKgs, [w.id]: e.target.value })}
                            className="w-20 px-2 py-1 border border-border rounded-lg text-xs font-bold text-right"
                          />
                          <span className="text-xs font-bold text-primary w-16 text-right">
                            <span className="font-mono">₹</span>{((Number(workerKgs[w.id]) || 0) * w.pieceRatePerKgInr).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-3 rounded-xl bg-surface border border-border flex justify-between items-center text-xs">
                  <span className="font-bold text-ink">Total Labor Cost:</span>
                  <span className="font-bold text-primary text-sm"><span className="font-mono">₹</span>{liveLabor.totalLaborCostInr.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

            {/* Step 4: QC Gates & Packaging Lots */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
                  <h4 className="font-semibold text-xs text-ink">Quality Checklist (QC Gates)</h4>
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
                      className="w-20 px-2 py-1 border border-border rounded-lg text-xs font-bold text-right"
                    />
                  </div>
                </div>

                {/* Packaging Distribution */}
                <div className="p-4 rounded-xl border border-border bg-white space-y-2">
                  <h4 className="font-semibold text-xs text-ink">Packaging Output Quantity</h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-ink-muted mb-1">250g Packs</label>
                      <input
                        type="number"
                        value={pack250Count}
                        onChange={(e) => setPack250Count(e.target.value)}
                        placeholder="0"
                        className="jm-input "
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-ink-muted mb-1">500g Packs</label>
                      <input
                        type="number"
                        value={pack500Count}
                        onChange={(e) => setPack500Count(e.target.value)}
                        placeholder="0"
                        className="jm-input "
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-ink-muted mb-1">1kg Packs</label>
                      <input
                        type="number"
                        value={pack1000Count}
                        onChange={(e) => setPack1000Count(e.target.value)}
                        placeholder="0"
                        className="jm-input "
                      />
                    </div>
                  </div>
                </div>

                {/* Final Cost Rollup */}
                <div className="p-4 rounded-xl bg-surface border border-border space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Dal Cost ({rawDalNum}kg @ <span className="font-mono">₹</span>{effectiveDalRate}/kg):</span>
                    <span className="font-bold"><span className="font-mono">₹</span>{liveCogs.dalCostInr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Labor Payouts:</span>
                    <span className="font-bold"><span className="font-mono">₹</span>{liveCogs.laborCostInr}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-primary pt-2 border-t border-border">
                    <span>Total Batch COGS:</span>
                    <span><span className="font-mono">₹</span>{liveCogs.totalBatchCostInr} (<span className="font-mono">₹</span>{liveCogs.bulkCostPerKgInr}/kg)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between gap-3 mt-6 pt-3 border-t border-border">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((s) => s - 1)}
                  className="jm-btn-secondary cursor-pointer"
                >
                  ← Previous
                </button>
              ) : <div />}

              {wizardStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((s) => s + 1)}
                  className="jm-btn-primary cursor-pointer"
                >
                  Next Step →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateBatch}
                  className="jm-btn-primary bg-success hover:bg-success text-white !border-success shadow-md cursor-pointer"
                >
                  Release Batch to Stock ✓
                </button>
              )}
            </div>
      </Modal>

      {/* ==================== TRACEABILITY MODAL ==================== */}
      <Modal id="traceability" isOpen={!!selectedTraceBatch} onClose={() => setSelectedTraceBatch(null)} title="Batch Traceability Graph">
        <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-surface border border-border">
                <div className="font-bold text-primary text-[11px] uppercase">1. Dal Procurement</div>
                <div className="font-semibold text-sm text-ink mt-0.5">{selectedTraceBatch.dalLotNo}</div>
              </div>

              <div className="text-center font-bold text-ink-faint">↓</div>

              <div className="p-3 rounded-xl bg-surface border border-border">
                <div className="font-bold text-ink text-[11px] uppercase">2. Batching & Sun Drying</div>
                <div className="font-bold text-sm text-ink mt-0.5">{selectedTraceBatch.batchCode} ({selectedTraceBatch.productType})</div>
                <div className="text-ink-muted">
                  Dal: {selectedTraceBatch.rawDalWeightKg}kg → Dried: {selectedTraceBatch.driedYieldKg}kg (Shrinkage: {selectedTraceBatch.shrinkagePct}%)
                </div>
                <div className="text-ink-muted mt-1 font-semibold">
                  Workers: {selectedTraceBatch.labourEntries.length > 0 ? selectedTraceBatch.labourEntries.map((l) => `${l.workerName} (${l.driedKg}kg)`).join(', ') : 'Direct Master Batch'}
                </div>
              </div>

              <div className="text-center font-bold text-ink-faint">↓</div>

              <div className="p-3 rounded-xl bg-success-soft border border-success">
                <div className="font-bold text-success text-[11px] uppercase">3. Released Stock Lots</div>
                <div className="space-y-1 mt-1">
                  {selectedTraceBatch.outputLots.map((ol, idx) => (
                    <div key={idx} className="flex justify-between font-bold text-success">
                      <span>{ol.skuName} ({ol.packagesCount} packs)</span>
                      <span className="font-mono text-[11px]">{ol.lotNumber}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-success mt-1">Expiry Date: +180 days ({selectedTraceBatch.expiryDate})</div>
              </div>
            </div>

            <button
              onClick={() => setSelectedTraceBatch(null)}
              className="w-full mt-4 jm-btn-secondary cursor-pointer"
            >
              Close
            </button>
      </Modal>
    </div>
  );
}
