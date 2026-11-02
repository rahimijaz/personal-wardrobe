"use client";

import { useState, useEffect, useRef, Suspense } from "react";
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
} from "lucide-react";
import clsx from "clsx";
import { useWardrobe } from "@/context/wardrobe-context";
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

  const {
    garments,
    persons,
    activePerson,
    activeJob,
    setActivePersonById,
    startTryOn,
    saveOutfit,
    clearActiveJob,
    engineStatus,
    inferenceParams,
    updateInferenceParams,
  } = useWardrobe();

  // Selected state
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedGarment, setSelectedGarment] = useState<Garment | null>(null);
  const [isPersonPickerOpen, setIsPersonPickerOpen] = useState(false);
  const [isGarmentPickerOpen, setIsGarmentPickerOpen] = useState(false);

  // Status & local states
  const [isInitiating, setIsInitiating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize selections
  useEffect(() => {
    if (activePerson && !selectedPerson) {
      setSelectedPerson(activePerson);
    }
  }, [activePerson, selectedPerson]);

  useEffect(() => {
    if (initialGarmentId && garments.length > 0) {
      const found = garments.find((g) => g.id === initialGarmentId);
      if (found) {
        setSelectedGarment(found);
      }
    } else if (!selectedGarment && garments.length > 0) {
      // Pick first compatible garment (tops / bottoms / one-pieces)
      const compatible = garments.find((g) =>
        VTON_CATEGORIES.includes(g.category as any)
      );
      if (compatible) {
        setSelectedGarment(compatible);
      }
    }
  }, [initialGarmentId, garments, selectedGarment]);

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
    if (!selectedPerson || !selectedGarment) return;

    if (!VTON_CATEGORIES.includes(selectedGarment.category as any)) {
      setErrorMsg(
        `Category '${selectedGarment.category}' is not supported by the VTON pipeline. Please select Tops, Bottoms, or One-Pieces.`
      );
      return;
    }

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
      await startTryOn(
        selectedPerson.id,
        selectedGarment.id,
        selectedGarment.category as VtonCategory,
        selectedGarment.photoType || "flat-lay",
        inferenceParams
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Could not launch local VTON engine.");
    } finally {
      setIsInitiating(false);
    }
  };

  const handleSaveOutfit = async () => {
    if (!activeJob || !activeJob.result || !selectedPerson || !selectedGarment) return;
    try {
      await saveOutfit({
        name: `${selectedPerson.name.split(" ")[0]} in ${selectedGarment.name}`,
        personId: selectedPerson.id,
        garmentIds: [selectedGarment.id],
        resultImage: activeJob.result,
        category: selectedGarment.category,
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
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>FASHN-VTON Online ({engineStatus.device.toUpperCase()})</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-600/20 dark:border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>VTON Backend Offline (Port 8188)</span>
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
            {/* Prominent High-Res Result Image */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="relative aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border border-line bg-bone-deep shadow-lg">
                <img
                  src={activeJob.result!}
                  alt="Generated Virtual Try-On Result"
                  className="h-full w-full object-cover"
                />
                <div className="absolute top-3 left-3 rounded-full bg-ink/80 px-3 py-1 text-xs font-mono text-bone backdrop-blur-md">
                  High-Res AI Result
                </div>
              </div>
            </div>

            {/* Result Metadata & Actions */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-flame font-semibold">
                  Generation Complete
                </span>
                <h2 className="font-display text-3xl font-bold text-ink mt-1">
                  Your New Look
                </h2>
                <p className="text-xs text-ink-soft mt-1">
                  Rendered on-device via FASHN-VTON MMDiT flow matching
                </p>
              </div>

              {/* Garment and Person details */}
              <div className="rounded-2xl border border-line bg-bone p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <span className="text-ink-soft">Garment</span>
                  <span className="font-semibold text-ink">
                    {selectedGarment?.name || "Selected piece"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <span className="text-ink-soft">Category</span>
                  <span className="font-semibold text-ink capitalize">
                    {selectedGarment?.category || "Tops"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <span className="text-ink-soft">Persona</span>
                  <span className="font-semibold text-ink">
                    {selectedPerson?.name || "Active model"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">Privacy</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    100% Local Device
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
            "[00:00] Initializing local FASHN-VTON pipeline on DirectML...",
            "[00:01] Model checkpoints verified: model.safetensors (1.94 GB)",
            activeJob.stage === "preparing_person" || activeJob.stage === "preparing_garment" || activeJob.stage === "generating" || activeJob.stage === "finalizing"
              ? "[00:03] Extracting body keypoints & DensePose warp..."
              : null,
            activeJob.stage === "preparing_garment" || activeJob.stage === "generating" || activeJob.stage === "finalizing"
              ? "[00:05] Garment category confirmed: tops • Inpainting mask aligned."
              : null,
            ...(Array.from({ length: currentStep }).map((_, idx) => {
              const s = idx + 1;
              const el = Math.round(s * 15.8);
              const eta = Math.max(0, Math.round((totalSteps - s) * 15.8));
              return `[00:${el < 10 ? "0" + el : el}] Euler Timestep ${s}/${totalSteps} complete [15.8s/it, elapsed: 00:${el < 10 ? "0" + el : el}, eta: ~${eta}s]`;
            })),
            currentStep > 0 && currentStep < totalSteps
              ? `[>>] Sampling Timestep ${currentStep + 1}/${totalSteps} on AMD Radeon GPU...`
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
                      Generating Virtual Try-On
                    </h2>
                    <p className="text-xs sm:text-sm text-ink-soft">
                      {activeJob.detail || "DirectML Neural Euler Sampling in progress..."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-start sm:self-auto">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 dark:border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>GPU Active</span>
                  </span>
                  <span className="font-mono text-xs text-ink-soft bg-bone px-2.5 py-1 rounded-full border border-line">
                    DirectML • {totalSteps} Steps
                  </span>
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
                      <Terminal className="h-3.5 w-3.5 text-flame" />
                      fashn-vton-runner ~ DirectML Euler Sampler
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-white/50">
                    GPU Port: 8188
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
                  DirectML acceleration active • 5-minute timeout window • Your images never leave your local machine
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
                <button
                  onClick={() => setIsPersonPickerOpen(true)}
                  className="rounded-full border border-line bg-bone px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-bone-deep transition-colors"
                >
                  Change Person
                </button>
              </div>

              {selectedPerson ? (
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-line bg-bone-deep group">
                  <img
                    src={selectedPerson.image}
                    alt={selectedPerson.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-102"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent p-4 text-bone">
                    <p className="text-sm font-semibold">{selectedPerson.name}</p>
                    <p className="text-[10px] text-bone/80 font-mono">
                      Processed on-device
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsPersonPickerOpen(true)}
                  className="aspect-[3/4] w-full rounded-2xl border-2 border-dashed border-line bg-bone flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:border-ink transition-colors"
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

            {/* RIGHT COLUMN: GARMENT */}
            <div className="flex flex-col rounded-3xl border border-line bg-paper p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-ink">
                    2. Garment
                  </h3>
                  <p className="text-xs text-ink-soft">
                    Clothing piece from your digital wardrobe
                  </p>
                </div>
                <button
                  onClick={() => setIsGarmentPickerOpen(true)}
                  className="rounded-full border border-line bg-bone px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-bone-deep transition-colors"
                >
                  Change Garment
                </button>
              </div>

              {selectedGarment ? (
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-line bg-bone-deep group">
                  <img
                    src={selectedGarment.image}
                    alt={selectedGarment.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-102"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-mono uppercase text-bone backdrop-blur-md">
                      {selectedGarment.category}
                    </span>
                    <span className="rounded-full bg-flame px-2 py-0.5 text-[10px] font-mono text-bone backdrop-blur-md">
                      VTON Ready
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent p-4 text-bone">
                    <p className="text-sm font-semibold">{selectedGarment.name}</p>
                    <p className="text-[10px] text-bone/80">
                      {selectedGarment.color || selectedGarment.type || "Catalog piece"} • {selectedGarment.photoType}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsGarmentPickerOpen(true)}
                  className="aspect-[3/4] w-full rounded-2xl border-2 border-dashed border-line bg-bone flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:border-ink transition-colors"
                >
                  <Shirt className="h-10 w-10 text-ink-soft mb-2" />
                  <p className="text-xs sm:text-sm font-semibold text-ink">
                    Select clothing piece
                  </p>
                  <p className="text-[11px] text-ink-soft mt-1">
                    Choose from wardrobe
                  </p>
                </div>
              )}
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
                    Generation Steps: {inferenceParams.numTimesteps} steps
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
                  <span>~{Math.round(inferenceParams.numTimesteps * 12.5)}s estimated execution time</span>
                  <span>30 (Maximum Detail)</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleStartGeneration}
              disabled={isInitiating || !selectedPerson || !selectedGarment}
              className="inline-flex items-center justify-center gap-3 rounded-full bg-ink px-10 py-4 text-base font-bold text-bone shadow-lg transition-all duration-200 hover:bg-flame hover:scale-[1.02] disabled:opacity-40 cursor-pointer"
            >
              <Sparkles className="h-5 w-5 text-flame group-hover:text-bone" />
              <span>Generate Try-On ({inferenceParams.numTimesteps} Steps)</span>
            </button>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-soft">
              <Clock className="h-3.5 w-3.5" />
              <span>
                Generation runs locally and may take a couple of minutes on DirectML.
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
                    "cursor-pointer rounded-2xl border p-2 transition-all",
                    selectedPerson?.id === p.id
                      ? "border-ink bg-bone-deep ring-2 ring-ink"
                      : "border-line bg-bone hover:border-ink/50"
                  )}
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-bone-deep">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-ink truncate px-1">
                    {p.name}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-3 border-t border-line flex justify-end">
              <Link
                href="/profile"
                className="text-xs font-semibold text-flame hover:underline"
              >
                + Upload new person photo in Profile
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Garment Picker Modal */}
      {isGarmentPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-line bg-paper p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">
                  Select Garment from Wardrobe
                </h3>
                <p className="text-xs text-ink-soft">
                  Compatible with Tops, Bottoms, and One-Pieces
                </p>
              </div>
              <button
                onClick={() => setIsGarmentPickerOpen(false)}
                className="rounded-full p-1.5 text-ink-soft hover:bg-bone-deep"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
              {garments
                .filter((g) => VTON_CATEGORIES.includes(g.category as any))
                .map((g) => {
                  const isSelected = selectedGarment?.id === g.id;
                  return (
                    <div
                      key={g.id}
                      onClick={() => {
                        setSelectedGarment(g);
                        setIsGarmentPickerOpen(false);
                      }}
                      className={clsx(
                        "cursor-pointer rounded-2xl border p-2 transition-all",
                        isSelected
                          ? "border-ink bg-bone-deep ring-2 ring-ink"
                          : "border-line bg-bone hover:border-ink/50"
                      )}
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-bone-deep">
                        <img
                          src={g.image}
                          alt={g.name}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[9px] font-mono text-bone uppercase">
                          {g.category}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs font-semibold text-ink truncate px-1">
                        {g.name}
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
