"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Shirt,
  User,
  Check,
  RefreshCw,
  Download,
  BookmarkPlus,
  AlertCircle,
  X,
  Loader2,
  Clock,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Terminal,
  Activity,
  Cpu,
  Sliders,
  Plus,
  Layers,
  Scissors,
  Compass,
  TrendingUp,
} from "lucide-react";
import clsx from "clsx";
import { useWardrobe } from "@/context/wardrobe-context";
import { getMatchesForGarment, scorePair } from "@/lib/recommendations";
import {
  VTON_CATEGORIES,
  CATEGORY_LABEL,
  type Garment,
  type Person,
  type VtonCategory,
  type GarmentPhotoType,
} from "@/lib/types";

export default function TryOnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-ink-soft" />
        </div>
      }
    >
      <TryOnContent />
    </Suspense>
  );
}

function TryOnContent() {
  const searchParams = useSearchParams();
  const initialGarmentId = searchParams.get("garmentId");
  const initialTopId = searchParams.get("topId");
  const initialBottomId = searchParams.get("bottomId");

  const {
    garments,
    persons,
    activePerson,
    activeJob,
    setActivePersonById,
    startTryOn,
    cancelActiveJob,
    saveOutfit,
    clearActiveJob,
    engineStatus,
    inferenceParams,
    updateInferenceParams,
  } = useWardrobe();

  // Selected state: Support choosing Top, Bottom, or both
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedTop, setSelectedTop] = useState<Garment | null>(null);
  const [selectedBottom, setSelectedBottom] = useState<Garment | null>(null);
  const [pickerSlot, setPickerSlot] = useState<"top" | "bottom">("top");
  const [isPersonPickerOpen, setIsPersonPickerOpen] = useState(false);
  const [isGarmentPickerOpen, setIsGarmentPickerOpen] = useState(false);
  const [pickerFilterCategory, setPickerFilterCategory] = useState<string>("all");

  // Status & local states
  const [isInitiating, setIsInitiating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize selections
  useEffect(() => {
    if (activePerson && !selectedPerson) {
      setSelectedPerson(activePerson);
    }
  }, [activePerson, selectedPerson]);

  useEffect(() => {
    if (garments.length === 0) return;

    if (initialTopId || initialBottomId) {
      if (initialTopId) {
        const foundTop = garments.find((g) => g.id === initialTopId);
        if (foundTop) setSelectedTop(foundTop);
      }
      if (initialBottomId) {
        const foundBottom = garments.find((g) => g.id === initialBottomId);
        if (foundBottom) setSelectedBottom(foundBottom);
      }
      return;
    }

    if (initialGarmentId) {
      const found = garments.find((g) => g.id === initialGarmentId);
      if (found) {
        if (found.category === "bottoms") {
          setSelectedBottom(found);
        } else {
          setSelectedTop(found);
        }
      }
      return;
    }

    if (!selectedTop && !selectedBottom) {
      // Pick first compatible top and bottom as convenient starting points
      const defaultTop = garments.find((g) => g.category === "tops" || g.category === "one-pieces");
      const defaultBottom = garments.find((g) => g.category === "bottoms");
      if (defaultTop) setSelectedTop(defaultTop);
      if (defaultBottom) setSelectedBottom(defaultBottom);
    }
  }, [initialGarmentId, initialTopId, initialBottomId, garments]);

  // Computed match suggestion for active selection
  const matchSuggestions = useMemo(() => {
    if (selectedTop && !selectedBottom) {
      return getMatchesForGarment(selectedTop, garments, "all", 4);
    }
    if (selectedBottom && !selectedTop) {
      return getMatchesForGarment(selectedBottom, garments, "all", 4);
    }
    return [];
  }, [selectedTop, selectedBottom, garments]);

  const activePairScore = useMemo(() => {
    if (selectedTop && selectedBottom) {
      return scorePair(selectedTop, selectedBottom);
    }
    return null;
  }, [selectedTop, selectedBottom]);

  // Array of active garments selected for try-on (0, 1, or 2)
  const selectedGarments = [selectedTop, selectedBottom].filter(Boolean) as Garment[];

  // Check if active job belongs to current selection
  const isJobRunning =
    activeJob && (activeJob.status === "processing" || activeJob.status === "queued");

  const terminalLogsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalLogsRef.current) {
      terminalLogsRef.current.scrollTop = terminalLogsRef.current.scrollHeight;
    }
  }, [activeJob?.logs, activeJob?.step, activeJob?.stage]);

  const isJobCompleted = activeJob && activeJob.status === "completed" && activeJob.result;
  const isJobFailed = activeJob && activeJob.status === "failed";

  const handleStartGeneration = async () => {
    if (!selectedPerson || selectedGarments.length === 0) return;

    if (engineStatus && !engineStatus.online) {
      setErrorMsg(
        "Local VTON service is currently offline. Please start it in a separate terminal using: .\\.venv-fashn\\Scripts\\python.exe vton-service\\server.py"
      );
      return;
    }

    setIsInitiating(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      const garmentIds = selectedGarments.map((g) => g.id);
      await startTryOn(
        selectedPerson.id,
        garmentIds,
        selectedGarments[0].category as VtonCategory,
        selectedGarments[0].photoType || "flat-lay",
        inferenceParams
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Could not launch local VTON engine.");
    } finally {
      setIsInitiating(false);
    }
  };

  const handleSaveOutfit = async () => {
    if (!activeJob || !activeJob.result || !selectedPerson || selectedGarments.length === 0) return;
    try {
      const outfitTitle =
        selectedGarments.length > 1
          ? `${selectedPerson.name.split(" ")[0]}'s Full Look: ${selectedTop?.name} + ${selectedBottom?.name}`
          : `${selectedPerson.name.split(" ")[0]} in ${selectedGarments[0].name}`;

      await saveOutfit({
        name: outfitTitle,
        personId: selectedPerson.id,
        garmentIds: selectedGarments.map((g) => g.id),
        resultImage: activeJob.result,
        category: selectedGarments.length > 1 ? "one-pieces" : selectedGarments[0].category,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert("Failed to save outfit: " + err.message);
    }
  };

  const handleDownload = () => {
    if (!activeJob?.result) return;
    const a = document.createElement("a");
    a.href = activeJob.result;
    a.download = `personal-wardrobe-tryon-${Date.now()}.png`;
    a.click();
  };

  const formatTqdmBar = (step: number, total: number, width: number = 20) => {
    if (total <= 0) return "░".repeat(width);
    const ratio = Math.min(1, Math.max(0, step / total));
    const filled = Math.round(width * ratio);
    const empty = width - filled;
    return "█".repeat(filled) + "░".repeat(Math.max(0, empty));
  };

  const formatDuration = (seconds?: number) => {
    if (seconds === undefined || isNaN(seconds) || seconds < 0) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Generation stages indicator
  const stages = [
    { id: "preparing_person", label: "Preparing person & pose" },
    { id: "preparing_garment", label: "Preparing garment cloth" },
    { id: "generating", label: "Generating try-on (diffusion)" },
    { id: "finalizing", label: "Finalizing high-res result" },
  ];

  const currentStageIndex = () => {
    if (!activeJob?.stage) return 0;
    const idx = stages.findIndex((s) => s.id === activeJob.stage);
    return idx >= 0 ? idx : 0;
  };

  return (
    <div className="flex-1 p-6 sm:p-8 md:p-10 max-w-6xl mx-auto w-full page-enter">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-ink-soft uppercase tracking-wider mb-1">
            <Link href="/" className="hover:text-ink">
              Studio
            </Link>
            <span>/</span>
            <span className="text-ink font-semibold">Virtual Try-On</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Virtual Try-On Studio
          </h1>
        </div>

        {engineStatus?.online ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-600/20 dark:border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            <span>Studio Ready</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-600/20 dark:border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>Studio Offline</span>
          </div>
        )}
      </div>

      {/* Error Callout */}
      {(errorMsg || isJobFailed) && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-900 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm flex-1">
            <p className="font-bold">Try-on failed</p>
            <p className="mt-0.5 text-red-800/90 leading-relaxed">
              {errorMsg ||
                activeJob?.error ||
                "The local VTON engine couldn't complete this generation."}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleStartGeneration}
                className="rounded-lg bg-red-800 px-3.5 py-1.5 text-xs font-semibold text-bone hover:bg-red-900 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  setErrorMsg(null);
                  clearActiveJob();
                }}
                className="text-xs font-medium text-red-800 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Primary Display: RESULT VIEW vs GENERATION vs INPUT SELECTION */}
      {isJobCompleted ? (
        /* Result View */
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-sm mb-10"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Prominent High-Res Result Image - Natural 2:3 Edge-to-Edge Portrait Framing */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="w-full max-w-sm rounded-3xl border border-line bg-paper overflow-hidden shadow-xl card-shadow">
                <div className="flex items-center justify-between px-4 py-2.5 bg-paper border-b border-line">
                  <span className="badge-flame text-[10px] py-0.5 px-2">
                    <Sparkles className="h-2.5 w-2.5" />
                    Tailored Result
                  </span>
                  <span className="text-[10px] font-mono text-ink-soft">
                    1024 × 1536 HD
                  </span>
                </div>
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#fafafa] flex items-center justify-center">
                  <img
                    src={activeJob.result!}
                    alt="Generated Virtual Try-On Result"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Result Metadata & Actions */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-flame font-semibold">
                  Fitting Complete
                </span>
                <h2 className="font-display text-3xl font-bold text-ink mt-1">
                  Your New Look
                </h2>
                <p className="text-xs text-ink-soft mt-1">
                  Rendered with precision in your personal studio
                </p>
              </div>

              {/* Garments and Person details */}
              <div className="rounded-2xl border border-line bg-bone p-4 space-y-3 text-xs">
                <div className="border-b border-line pb-2.5 space-y-2">
                  <span className="text-[11px] font-mono uppercase text-ink-soft block font-bold">
                    {activeJob.garments && activeJob.garments.length > 1
                      ? "Pieces Styled (2-Piece Ensemble)"
                      : "Piece Styled"}
                  </span>
                  {activeJob.garments && activeJob.garments.length > 0 ? (
                    activeJob.garments.map((g) => (
                      <div key={g.id} className="flex items-center justify-between text-ink">
                        <span className="flex items-center gap-2">
                          <span className="h-6 w-6 rounded-md overflow-hidden bg-bone-deep inline-block border border-line shrink-0">
                            <img src={g.image} alt={g.name} className="h-full w-full object-cover" />
                          </span>
                          <span className="font-semibold truncate max-w-[170px]">{g.name}</span>
                        </span>
                        <span className="font-mono text-[10px] uppercase bg-paper px-2 py-0.5 rounded border border-line text-ink-soft">
                          {g.category}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="font-semibold text-ink">{selectedTop?.name || selectedBottom?.name || "Wardrobe Piece"}</span>
                  )}
                </div>
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <span className="text-ink-soft">Persona</span>
                  <span className="font-semibold text-ink">
                    {selectedPerson?.name || "Active model"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">Studio Mode</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    High Resolution
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                <button
                  onClick={handleSaveOutfit}
                  className={clsx(
                    "w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-200 shadow-md",
                    saveSuccess
                      ? "bg-emerald-600 text-bone"
                      : "bg-ink text-bone hover:bg-flame hover:scale-[1.01]"
                  )}
                >
                  {saveSuccess ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Saved to Outfits!</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="h-4 w-4 text-flame" />
                      <span>Save Outfit</span>
                    </>
                  )}
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-bone px-4 py-2.5 text-xs font-semibold text-ink hover:bg-bone-deep transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>

                  <button
                    onClick={() => {
                      clearActiveJob();
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-bone px-4 py-2.5 text-xs font-semibold text-ink hover:bg-bone-deep transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Try Again</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    clearActiveJob();
                    setIsGarmentPickerOpen(true);
                  }}
                  className="w-full text-center text-xs font-semibold text-flame hover:underline py-1"
                >
                  Change Garment →
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      ) : isJobRunning ? (
        /* Asynchronous Generation Progress State with Terminal HUD */
        (() => {
          const totalSteps = activeJob.total_steps || inferenceParams?.numTimesteps || 8;
          const currentStep = activeJob.step || 0;
          const percentVal = activeJob.percent !== undefined
            ? activeJob.percent
            : Math.min(100, Math.round((currentStep / totalSteps) * 100));
          const elapsedStr = formatDuration(activeJob.elapsed_sec);
          const etaStr = formatDuration(activeJob.eta_sec);
          const sPerItStr = activeJob.sec_per_it
            ? `${activeJob.sec_per_it.toFixed(1)}s/it`
            : currentStep > 0
            ? "~15.8s/it"
            : "-- s/it";
          const tqdmBar = formatTqdmBar(currentStep, totalSteps, 22);

          const defaultLogs = [
            "[00:00] Initializing personal studio session...",
            "[00:01] Preparing garment texture & silhouette...",
            activeJob.stage === "preparing_person" || activeJob.stage === "preparing_garment" || activeJob.stage === "generating" || activeJob.stage === "finalizing"
              ? "[00:03] Mapping silhouette contours and posture..."
              : null,
            activeJob.stage === "preparing_garment" || activeJob.stage === "generating" || activeJob.stage === "finalizing"
              ? "[00:05] Fitting garment drape to model frame..."
              : null,
            ...(Array.from({ length: currentStep }).map((_, idx) => {
              const s = idx + 1;
              const el = Math.round(s * 15.8);
              const eta = Math.max(0, Math.round((totalSteps - s) * 15.8));
              return `[00:${el < 10 ? "0" + el : el}] Refining fabric drape & details (${s}/${totalSteps}) [elapsed: 00:${el < 10 ? "0" + el : el}, eta: ~${eta}s]`;
            })),
            currentStep > 0 && currentStep < totalSteps
              ? `[>>] Styling fabric textures (${currentStep + 1}/${totalSteps})...`
              : null,
          ].filter(Boolean) as string[];

          const displayLogs = activeJob.logs && activeJob.logs.length > 0 ? activeJob.logs : defaultLogs;

          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-3xl border border-line bg-paper p-6 sm:p-8 md:p-10 max-w-4xl mx-auto shadow-md mb-10 space-y-6"
            >
              {/* Header Title & Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
                <div className="flex items-center gap-4">
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-flame/10">
                    <Loader2 className="h-7 w-7 animate-spin text-flame" />
                    <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-ink animate-pulse" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
                      Tailoring Virtual Look
                    </h2>
                    <p className="text-xs sm:text-sm text-ink-soft">
                      {activeJob.detail || "Rendering fabrics and silhouette in studio..."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-start sm:self-auto">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 dark:border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Rendering</span>
                  </span>
                  <span className="font-mono text-xs text-ink-soft bg-bone px-2.5 py-1 rounded-full border border-line">
                    Studio • {totalSteps} Steps
                  </span>
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={async () => {
                      if (confirm("Cancel virtual try-on generation? This will stop the local AI engine and free the GPU immediately.")) {
                        setIsCancelling(true);
                        try {
                          await cancelActiveJob();
                        } finally {
                          setIsCancelling(false);
                        }
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-400 px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    title="Abort virtual try-on job immediately"
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Aborting...</span>
                      </>
                    ) : (
                      <>
                        <X className="h-3.5 w-3.5 stroke-[2.5]" />
                        <span>Cancel</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* TIMESTEP PROGRESS HUD: Discrete Step Badges */}
              <div className="rounded-2xl border border-line bg-bone p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-flame" />
                    <span className="text-xs font-bold uppercase tracking-wider text-ink">
                      Euler Timestep Sequence
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-flame">
                    Step {currentStep} of {totalSteps} ({percentVal}%)
                  </span>
                </div>

                {/* Discrete Timestep Blocks */}
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {Array.from({ length: totalSteps }).map((_, idx) => {
                    const stepNum = idx + 1;
                    const isStepDone = stepNum <= currentStep;
                    const isStepActive =
                      stepNum === currentStep + 1 &&
                      (activeJob.stage === "generating" || activeJob.stage === "preparing_garment");

                    return (
                      <div
                        key={stepNum}
                        className={clsx(
                          "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all duration-300",
                          isStepDone
                            ? "border-emerald-600/30 dark:border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 shadow-xs"
                            : isStepActive
                            ? "border-flame bg-flame/10 text-flame ring-2 ring-flame/30 scale-102 shadow-sm"
                            : "border-line bg-paper/60 text-ink-soft opacity-60"
                        )}
                      >
                        <span className="text-[10px] font-mono uppercase tracking-widest block font-bold">
                          Step {stepNum}
                        </span>
                        <div className="mt-1 flex items-center justify-center text-xs">
                          {isStepDone ? (
                            <div className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300">
                              <Check className="h-3.5 w-3.5 stroke-[3] text-emerald-600 dark:text-emerald-300" />
                              <span className="text-[10px] font-mono">Done</span>
                            </div>
                          ) : isStepActive ? (
                            <div className="flex items-center gap-1 font-bold text-flame">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span className="text-[10px] font-mono animate-pulse">Run</span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-mono text-ink-soft">Wait</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* TERMINAL EMULATOR / TQDM STREAM WINDOW */}
              <div className="overflow-hidden rounded-2xl border border-line bg-[#0d0c0a] text-[#f5f2eb] shadow-xl">
                {/* Terminal Window Header Bar */}
                <div className="flex items-center justify-between border-b border-white/10 bg-[#161412] px-4 py-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#ff5f56] inline-block" />
                    <span className="h-3 w-3 rounded-full bg-[#ffbd2e] inline-block" />
                    <span className="h-3 w-3 rounded-full bg-[#27c93f] inline-block" />
                    <span className="ml-2 font-mono text-[11px] text-white/70 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-flame" />
                      Studio Renderer ~ Live Progression
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-white/50">
                    High Resolution
                  </div>
                </div>

                {/* TQDM Status Line */}
                <div className="border-b border-white/10 bg-[#12100e] px-4 py-3 font-mono text-xs sm:text-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-emerald-400 font-semibold mb-1">
                    <span>
                      Sampling: {percentVal}% | {currentStep}/{totalSteps} steps completed
                    </span>
                    <span className="text-white/60 text-xs">
                      [{elapsedStr} elapsed &lt; {etaStr} ETA, {sPerItStr}]
                    </span>
                  </div>
                  {/* ASCII Progress Bar */}
                  <div className="font-mono text-xs sm:text-sm tracking-tight text-flame select-none overflow-x-auto whitespace-pre">
                    Sampling: {percentVal.toString().padStart(3, " ")}%|{tqdmBar}| {currentStep}/{totalSteps} [{elapsedStr}&lt;{etaStr}, {sPerItStr}]
                  </div>
                </div>

                {/* Live Streaming Console Logs */}
                <div
                  ref={terminalLogsRef}
                  className="max-h-48 overflow-y-auto p-4 font-mono text-xs text-white/80 space-y-1.5 scrollbar-thin select-text"
                >
                  {displayLogs.map((log, lIdx) => (
                    <div key={lIdx} className="leading-relaxed flex items-start gap-2">
                      <span className="text-flame/70 select-none">&gt;</span>
                      <span
                        className={clsx(
                          log.includes("complete") || log.includes("Done")
                            ? "text-emerald-400 font-medium"
                            : log.includes("running") || log.includes("Euler") || log.includes(">>")
                            ? "text-amber-300"
                            : "text-white/80"
                        )}
                      >
                        {log}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1 text-flame animate-pulse pt-1">
                    <span className="select-none">&gt;</span>
                    <span className="inline-block h-3.5 w-2 bg-flame" />
                  </div>
                </div>
              </div>

              {/* 4-Stage Workflow Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                {stages.map((stage, idx) => {
                  const activeIdx = currentStageIndex();
                  const isDone = idx < activeIdx;
                  const isCurrent = idx === activeIdx;

                  return (
                    <div
                      key={stage.id}
                      className={clsx(
                        "flex flex-col justify-between rounded-xl p-3 border transition-colors",
                        isCurrent
                          ? "border-flame/40 bg-flame/5 text-ink font-semibold"
                          : isDone
                          ? "border-emerald-600/20 dark:border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-300"
                          : "border-line bg-bone/40 text-ink-soft opacity-60"
                      )}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono text-[10px] uppercase">
                          Stage {idx + 1}/4
                        </span>
                        {isDone ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                        ) : isCurrent ? (
                          <span className="flex h-2 w-2 rounded-full bg-flame animate-ping" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-ink-soft/40" />
                        )}
                      </div>
                      <span className="text-xs font-semibold leading-tight line-clamp-1">
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Footer note */}
              <div className="pt-2 text-center text-xs text-ink-soft flex items-center justify-center gap-2">
                <Clock className="h-3.5 w-3.5 text-ink-soft shrink-0" />
                <span>
                  Crafted in your personal studio • Private session
                </span>
              </div>
            </motion.div>
          );
        })()
      ) : (
        /* Two-Column Selection Interface */
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* LEFT COLUMN: PERSON */}
            <div className="flex flex-col rounded-3xl border border-line bg-paper p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-ink">
                    1. Person
                  </h3>
                  <p className="text-xs text-ink-soft">
                    Reference model or your personal photo
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={selectedPerson ? `/profile?calibrate=${selectedPerson.id}` : "/profile"}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bone px-3 py-1.5 text-xs font-semibold text-ink hover:bg-bone-deep hover:border-flame/40 transition-colors"
                    title="Calibrate posture, framing & proportions"
                  >
                    <Sliders className="h-3 w-3 text-flame" />
                    <span>Calibrate</span>
                  </Link>
                  <button
                    onClick={() => setIsPersonPickerOpen(true)}
                    className="rounded-full border border-line bg-bone px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-bone-deep transition-colors"
                  >
                    Change Person
                  </button>
                </div>
              </div>

              {selectedPerson ? (
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-line bg-bone-deep group">
                  <img
                    src={selectedPerson.image}
                    alt={selectedPerson.name}
                    style={
                      selectedPerson.calibration?.zoom
                        ? {
                            transform: `scale(${selectedPerson.calibration.zoom}) translate(${selectedPerson.calibration.xOffset || 0}%, ${selectedPerson.calibration.yOffset || 0}%)`,
                            transformOrigin: "center center",
                          }
                        : undefined
                    }
                    className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-102"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent p-4 text-bone">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{selectedPerson.name}</p>
                      {selectedPerson.calibration?.score && (
                        <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300">
                          {selectedPerson.calibration.score}% Calibrated
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-bone/80 font-mono mt-1">
                      {selectedPerson.calibration?.heightCm
                        ? `${selectedPerson.calibration.heightCm} cm`
                        : "175 cm"}{" "}
                      •{" "}
                      {selectedPerson.calibration?.bodySilhouette
                        ? selectedPerson.calibration.bodySilhouette.charAt(0).toUpperCase() +
                          selectedPerson.calibration.bodySilhouette.slice(1)
                        : "Athletic"}{" "}
                      Silhouette • DensePose Ready
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsPersonPickerOpen(true)}
                  className="aspect-[2/3] w-full rounded-2xl border-2 border-dashed border-line bg-bone flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:border-ink transition-colors"
                >
                  <User className="h-10 w-10 text-ink-soft mb-2" />
                  <p className="text-xs sm:text-sm font-semibold text-ink">
                    Select a persona
                  </p>
                  <p className="text-[11px] text-ink-soft mt-1">
                    Click to choose model
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: 2 GARMENTS SLOTS (TOP & BOTTOM) */}
            <div className="flex flex-col rounded-3xl border border-line bg-paper p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-ink">
                    2. Garments & Outfit
                  </h3>
                  <p className="text-xs text-ink-soft">
                    Choose a Top, a Bottom, or both for a full 2-piece try-on
                  </p>
                </div>
                {/* Mode Indicator Badge */}
                <span
                  className={clsx(
                    "rounded-full px-3 py-1 text-[11px] font-mono font-semibold uppercase tracking-wider border",
                    selectedTop && selectedBottom
                      ? "bg-flame/15 text-flame border-flame/30"
                      : selectedTop || selectedBottom
                      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-bone-deep text-ink-soft border-line"
                  )}
                >
                  {selectedTop && selectedBottom
                    ? "2-Piece Outfit"
                    : selectedTop
                    ? "Top Only"
                    : selectedBottom
                    ? "Bottom Only"
                    : "No Garment"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                {/* SLOT A: TOP GARMENT */}
                <div className="flex flex-col rounded-2xl border border-line bg-bone p-3.5 relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-ink-soft flex items-center gap-1.5">
                      <Shirt className="h-3.5 w-3.5 text-flame" />
                      Top Garment
                    </span>
                    {selectedTop && (
                      <button
                        onClick={() => setSelectedTop(null)}
                        className="text-[11px] text-ink-soft hover:text-red-600 transition-colors cursor-pointer flex items-center gap-0.5"
                        title="Clear top selection"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>

                  {selectedTop ? (
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-line bg-bone-deep group">
                        <img
                          src={selectedTop.image}
                          alt={selectedTop.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-102"
                        />
                        <span className="absolute top-2 left-2 rounded-full bg-ink/85 px-2 py-0.5 text-[9px] font-mono text-bone uppercase">
                          {selectedTop.category}
                        </span>
                      </div>
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-ink truncate">{selectedTop.name}</p>
                        <p className="text-[10px] text-ink-soft truncate">
                          {selectedTop.color || selectedTop.type || "Catalog piece"} • {selectedTop.photoType}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setPickerSlot("top");
                          setIsGarmentPickerOpen(true);
                        }}
                        className="mt-2.5 w-full py-1.5 rounded-lg border border-line bg-paper text-xs font-semibold text-ink hover:bg-bone-deep transition-colors text-center cursor-pointer"
                      >
                        Change Top
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setPickerSlot("top");
                        setIsGarmentPickerOpen(true);
                      }}
                      className="flex-1 min-h-[220px] rounded-xl border-2 border-dashed border-line bg-paper/60 hover:border-flame/50 flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-colors group"
                    >
                      <div className="h-10 w-10 rounded-full bg-bone-deep flex items-center justify-center mb-2 group-hover:bg-flame/10">
                        <Plus className="h-5 w-5 text-ink-soft group-hover:text-flame transition-colors" />
                      </div>
                      <span className="text-xs font-semibold text-ink">Choose Top</span>
                      <span className="text-[10px] text-ink-soft mt-0.5">Tops, shirts, jackets</span>
                    </div>
                  )}
                </div>

                {/* SLOT B: BOTTOM GARMENT */}
                <div className="flex flex-col rounded-2xl border border-line bg-bone p-3.5 relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-ink-soft flex items-center gap-1.5">
                      <Scissors className="h-3.5 w-3.5 text-flame" />
                      Bottom Garment
                    </span>
                    {selectedBottom && (
                      <button
                        onClick={() => setSelectedBottom(null)}
                        className="text-[11px] text-ink-soft hover:text-red-600 transition-colors cursor-pointer flex items-center gap-0.5"
                        title="Clear bottom selection"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>

                  {selectedBottom ? (
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-line bg-bone-deep group">
                        <img
                          src={selectedBottom.image}
                          alt={selectedBottom.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-102"
                        />
                        <span className="absolute top-2 left-2 rounded-full bg-ink/85 px-2 py-0.5 text-[9px] font-mono text-bone uppercase">
                          {selectedBottom.category}
                        </span>
                      </div>
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-ink truncate">{selectedBottom.name}</p>
                        <p className="text-[10px] text-ink-soft truncate">
                          {selectedBottom.color || selectedBottom.type || "Catalog piece"} • {selectedBottom.photoType}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setPickerSlot("bottom");
                          setIsGarmentPickerOpen(true);
                        }}
                        className="mt-2.5 w-full py-1.5 rounded-lg border border-line bg-paper text-xs font-semibold text-ink hover:bg-bone-deep transition-colors text-center cursor-pointer"
                      >
                        Change Bottom
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setPickerSlot("bottom");
                        setIsGarmentPickerOpen(true);
                      }}
                      className="flex-1 min-h-[220px] rounded-xl border-2 border-dashed border-line bg-paper/60 hover:border-flame/50 flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-colors group"
                    >
                      <div className="h-10 w-10 rounded-full bg-bone-deep flex items-center justify-center mb-2 group-hover:bg-flame/10">
                        <Plus className="h-5 w-5 text-ink-soft group-hover:text-flame transition-colors" />
                      </div>
                      <span className="text-xs font-semibold text-ink">Choose Bottom</span>
                      <span className="text-[10px] text-ink-soft mt-0.5">Jeans, trousers, skirts</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Smart Pairing Recommendation Bar */}
              {activePairScore ? (
                <div className="mt-4 rounded-2xl border border-line bg-bone/70 p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 shrink-0">
                      <TrendingUp className="h-3 w-3" />
                      {activePairScore.score}% Match
                    </span>
                    <span className="text-ink-soft truncate text-[11px]">
                      {activePairScore.relation} • {activePairScore.stylistNote}
                    </span>
                  </div>
                  <Link
                    href="/match"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-flame hover:underline shrink-0 ml-2"
                  >
                    <span>More Fits</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ) : matchSuggestions.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-line bg-bone/70 p-3 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-ink flex items-center gap-1.5 text-[11px]">
                      <Compass className="h-3.5 w-3.5 text-flame" />
                      Recommended {selectedTop ? "bottoms" : "tops"} for this piece:
                    </span>
                    <Link
                      href="/match"
                      className="text-[10px] font-bold text-ink-soft hover:text-ink flex items-center gap-0.5"
                    >
                      <span>All Fits</span>
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                    {matchSuggestions.map((m) => {
                      const piece = selectedTop ? m.bottom : m.top;
                      return (
                        <button
                          key={piece.id}
                          type="button"
                          onClick={() => {
                            if (selectedTop) setSelectedBottom(piece);
                            else setSelectedTop(piece);
                          }}
                          className="shrink-0 flex items-center gap-2 rounded-xl border border-line bg-paper px-2.5 py-1.5 text-left hover:border-flame hover:scale-[1.02] transition-all cursor-pointer shadow-2xs"
                        >
                          <img
                            src={piece.image}
                            alt={piece.name}
                            className="h-7 w-7 rounded-lg object-contain bg-bone shrink-0 p-0.5 border border-line"
                          />
                          <div className="min-w-0 max-w-[120px]">
                            <p className="truncate text-[11px] font-medium text-ink leading-none">{piece.name}</p>
                            <p className="text-[9px] text-emerald-700 dark:text-emerald-400 font-bold mt-1">
                              {m.score}% Match
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-center justify-between text-xs text-ink-soft rounded-2xl border border-line bg-bone/40 px-3.5 py-2">
                  <span className="text-[11px]">Need inspiration? Explore curated outfit pairings</span>
                  <Link
                    href="/match"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-flame hover:underline"
                  >
                    <span>Open Fit Recommender</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {/* Status helper banner */}
              <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-[11px] text-ink-soft">
                <span>
                  {selectedTop && selectedBottom
                    ? "✓ Both selected: Automatically executes sequential 2-pass try-on (Top → Bottom)."
                    : selectedTop
                    ? "✓ Top piece selected: Runs single-pass try-on for the upper body."
                    : selectedBottom
                    ? "✓ Bottom piece selected: Runs single-pass try-on for the lower body."
                    : "Select a top, bottom, or both to enable try-on."}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Action Button Bar */}
          <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8 flex flex-col items-center text-center shadow-sm">
            {/* Quick Inference Steps Selector */}
            <div className="mb-6 w-full max-w-xl rounded-2xl border border-line bg-bone p-4 text-left">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-flame" />
                  <span className="text-xs font-bold text-ink uppercase tracking-wider">
                    Generation Steps: {inferenceParams.numTimesteps} steps per pass
                  </span>
                </div>
                <Link
                  href="/settings"
                  className="text-[11px] font-semibold text-flame hover:underline"
                >
                  Advanced Settings →
                </Link>
              </div>

              {/* Step Presets */}
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 mb-3">
                {[
                  { steps: 4, label: "4 Fast" },
                  { steps: 8, label: "8 Default" },
                  { steps: 12, label: "12 Crisp" },
                  { steps: 16, label: "16 Studio" },
                  { steps: 20, label: "20 Max" },
                ].map((preset) => (
                  <button
                    key={preset.steps}
                    type="button"
                    onClick={() => updateInferenceParams({ numTimesteps: preset.steps })}
                    className={clsx(
                      "py-1.5 px-2 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer text-center",
                      inferenceParams.numTimesteps === preset.steps
                        ? "bg-flame text-white shadow-xs"
                        : "bg-paper border border-line text-ink hover:bg-bone-deep"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Slider for fine adjustment */}
              <div className="space-y-1">
                <input
                  type="range"
                  min="4"
                  max="30"
                  step="1"
                  value={inferenceParams.numTimesteps}
                  onChange={(e) => updateInferenceParams({ numTimesteps: Number(e.target.value) })}
                  className="w-full accent-flame h-1.5 bg-bone-deep rounded-lg cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] font-mono text-ink-soft">
                  <span>4 (Fastest)</span>
                  <span>
                    {selectedTop && selectedBottom
                      ? `~${Math.round(inferenceParams.numTimesteps * 25)}s estimated for 2-pass outfit`
                      : `~${Math.round(inferenceParams.numTimesteps * 12.5)}s estimated for 1-pass`}
                  </span>
                  <span>30 (Maximum Detail)</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleStartGeneration}
              disabled={isInitiating || !selectedPerson || selectedGarments.length === 0}
              className="inline-flex items-center justify-center gap-3 rounded-full bg-ink px-10 py-4 text-base font-bold text-bone shadow-lg transition-all duration-200 hover:bg-flame hover:scale-[1.02] disabled:opacity-40 cursor-pointer"
            >
              <Sparkles className="h-5 w-5 text-flame group-hover:text-bone" />
              <span>
                {selectedTop && selectedBottom
                  ? `Generate Full Outfit (2 Passes • 2x ${inferenceParams.numTimesteps} Steps)`
                  : selectedTop
                  ? `Generate Try-On Top (${inferenceParams.numTimesteps} Steps)`
                  : selectedBottom
                  ? `Generate Try-On Bottom (${inferenceParams.numTimesteps} Steps)`
                  : "Select Top or Bottom to Begin"}
              </span>
            </button>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-soft">
              <Clock className="h-3.5 w-3.5" />
              <span>
                Styling renders with high-precision detail in about 1-2 minutes.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Person Picker Modal */}
      {isPersonPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-paper p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
              <h3 className="font-display text-lg font-bold text-ink">
                Choose Person Profile
              </h3>
              <button
                onClick={() => setIsPersonPickerOpen(false)}
                className="rounded-full p-1.5 text-ink-soft hover:bg-bone-deep"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {persons.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedPerson(p);
                    setActivePersonById(p.id);
                    setIsPersonPickerOpen(false);
                  }}
                  className={clsx(
                    "cursor-pointer rounded-2xl border p-2 transition-all group",
                    selectedPerson?.id === p.id
                      ? "border-ink bg-bone-deep ring-2 ring-ink"
                      : "border-line bg-bone hover:border-ink/50"
                  )}
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-bone-deep">
                    <img
                      src={p.image}
                      alt={p.name}
                      style={
                        p.calibration?.zoom
                          ? {
                              transform: `scale(${p.calibration.zoom}) translate(${p.calibration.xOffset || 0}%, ${p.calibration.yOffset || 0}%)`,
                              transformOrigin: "center center",
                            }
                          : undefined
                      }
                      className="h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
                    />
                    {p.calibration?.score && (
                      <div className="absolute bottom-1.5 right-1.5 rounded-md bg-ink/80 px-1.5 py-0.5 text-[9px] font-mono text-bone backdrop-blur-xs">
                        {p.calibration.score}%
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-ink truncate px-1">
                    {p.name}
                  </p>
                  <p className="text-[10px] text-ink-soft truncate px-1 font-mono">
                    {p.calibration?.heightCm ? `${p.calibration.heightCm} cm` : "175 cm"} •{" "}
                    {p.calibration?.bodySilhouette || "Athletic"}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-3 border-t border-line flex items-center justify-between text-xs">
              <Link
                href="/profile"
                className="font-semibold text-ink hover:text-flame flex items-center gap-1.5"
              >
                <Sliders className="h-3.5 w-3.5 text-flame" />
                <span>Open Calibration Studio</span>
              </Link>
              <Link
                href="/profile"
                className="font-semibold text-flame hover:underline"
              >
                + Register New Persona
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Garment Picker Modal */}
      {isGarmentPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-line bg-paper p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2">
                  {pickerSlot === "top" ? (
                    <>
                      <Shirt className="h-4 w-4 text-flame" />
                      <span>Choose Top Garment</span>
                    </>
                  ) : (
                    <>
                      <Scissors className="h-4 w-4 text-flame" />
                      <span>Choose Bottom Garment</span>
                    </>
                  )}
                </h3>
                <p className="text-xs text-ink-soft">
                  {pickerSlot === "top"
                    ? "Select a shirt, hoodie, jacket, or one-piece from your wardrobe"
                    : "Select pants, jeans, cargo trousers, or skirts from your wardrobe"}
                </p>
              </div>
              <button
                onClick={() => setIsGarmentPickerOpen(false)}
                className="rounded-full p-1.5 text-ink-soft hover:bg-bone-deep"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Filter Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-line mb-3">
              <div className="flex items-center gap-1.5">
                {[
                  { id: "all", label: "All Pieces" },
                  ...(pickerSlot === "top"
                    ? [
                        { id: "tops", label: "Tops & Layers" },
                        { id: "one-pieces", label: "One-Pieces" },
                      ]
                    : [{ id: "bottoms", label: "Bottoms & Pants" }]),
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPickerFilterCategory(tab.id)}
                    className={clsx(
                      "px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer",
                      pickerFilterCategory === tab.id
                        ? "bg-ink text-bone shadow-xs"
                        : "bg-bone border border-line text-ink-soft hover:text-ink"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Clear slot option */}
              <button
                type="button"
                onClick={() => {
                  if (pickerSlot === "top") setSelectedTop(null);
                  else setSelectedBottom(null);
                  setIsGarmentPickerOpen(false);
                }}
                className="text-xs text-ink-soft hover:text-red-600 transition-colors cursor-pointer underline"
              >
                Clear this slot
              </button>
            </div>

            <div className="overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
              {garments
                .filter((g) => VTON_CATEGORIES.includes(g.category as any))
                .filter((g) => {
                  if (pickerFilterCategory === "all") {
                    if (pickerSlot === "top") {
                      return g.category === "tops" || g.category === "one-pieces";
                    } else {
                      return g.category === "bottoms";
                    }
                  }
                  return g.category === pickerFilterCategory;
                })
                .map((g) => {
                  const isCurrent =
                    pickerSlot === "top"
                      ? selectedTop?.id === g.id
                      : selectedBottom?.id === g.id;

                  return (
                    <div
                      key={g.id}
                      onClick={() => {
                        if (pickerSlot === "top") {
                          setSelectedTop(g);
                        } else {
                          setSelectedBottom(g);
                        }
                        setIsGarmentPickerOpen(false);
                      }}
                      className={clsx(
                        "cursor-pointer rounded-2xl border p-2 transition-all group",
                        isCurrent
                          ? "border-flame bg-flame/5 ring-2 ring-flame"
                          : "border-line bg-bone hover:border-ink/50"
                      )}
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-bone-deep">
                        <img
                          src={g.image}
                          alt={g.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-102"
                        />
                        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[9px] font-mono text-bone uppercase">
                          {g.category}
                        </span>
                        {isCurrent && (
                          <span className="absolute top-1.5 right-1.5 rounded-full bg-flame text-white p-1 shadow-md">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs font-semibold text-ink truncate px-1">
                        {g.name}
                      </p>
                      <p className="text-[10px] text-ink-soft truncate px-1">
                        {g.color || g.type || "Catalog piece"}
                      </p>
                    </div>
                  );
                })}
            </div>

            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs">
              <span className="text-ink-soft">
                Showing VTON-compatible pieces
              </span>
              <Link
                href="/wardrobe"
                className="font-semibold text-flame hover:underline"
              >
                + Add new garment in Wardrobe
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
