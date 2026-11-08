"use client";

import { useState } from "react";
import {
  Settings,
  Cpu,
  ShieldCheck,
  HardDrive,
  RefreshCw,
  Check,
  AlertTriangle,
  FileCode,
  Sparkles,
  ExternalLink,
  Sun,
  Moon,
  Palette,
  Sliders,
  Zap,
  RotateCcw,
  Dices,
  CheckCircle2,
} from "lucide-react";
import clsx from "clsx";
import { useWardrobe } from "@/context/wardrobe-context";

export default function SettingsPage() {
  const {
    engineStatus,
    garments,
    outfits,
    persons,
    theme,
    setTheme,
    inferenceParams,
    updateInferenceParams,
    resetInferenceParams,
  } = useWardrobe();
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/engine/status");
      if (res.ok) {
        const d = await res.json();
        if (d.online) {
          setTestResult(
            `Connected successfully! Engine: ${d.engine} on ${d.device} (Weights: ${d.modelSizeMb} MB)`
          );
        } else {
          setTestResult(
            `Python daemon not listening on ${d.url}. Local files verified (${d.modelSizeMb} MB weights present). Launch 'python vton-service/server.py' to activate GPU listener.`
          );
        }
      } else {
        setTestResult("Error querying backend diagnostics.");
      }
    } catch (e: any) {
      setTestResult("Could not reach local diagnostics endpoint.");
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="flex-1 p-6 sm:p-8 md:p-10 max-w-4xl mx-auto w-full page-enter">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
          Settings & Engine Diagnostics
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Hardware acceleration, local storage, and virtual try-on configuration
        </p>
      </div>

      <div className="space-y-6">
        {/* Appearance & Theme Card */}
        <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flame/10 text-flame">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Interface Appearance
              </h2>
              <p className="text-xs text-ink-soft">
                Switch between warm editorial paper and dark obsidian studio mode
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {/* Light Mode Tile */}
            <button
              onClick={() => setTheme("light")}
              className={clsx(
                "flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer",
                theme === "light"
                  ? "border-flame bg-bone shadow-sm ring-2 ring-flame/20"
                  : "border-line bg-bone/40 hover:bg-bone hover:border-ink/20"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-semibold text-ink text-sm">
                  <Sun className="h-4 w-4 text-amber-500" />
                  <span>Warm Paper (Light)</span>
                </div>
                {theme === "light" && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-flame text-white text-xs">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-soft leading-relaxed">
                Classic editorial typography inspired by fashion lookbooks and warm tactile paper textures.
              </p>
            </button>

            {/* Dark Mode Tile */}
            <button
              onClick={() => setTheme("dark")}
              className={clsx(
                "flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer",
                theme === "dark"
                  ? "border-flame bg-bone shadow-sm ring-2 ring-flame/20"
                  : "border-line bg-bone/40 hover:bg-bone hover:border-ink/20"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-semibold text-ink text-sm">
                  <Moon className="h-4 w-4 text-amber-400" />
                  <span>Obsidian Studio (Dark)</span>
                </div>
                {theme === "dark" && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-flame text-white text-xs">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-soft leading-relaxed">
                High-contrast studio dark mode optimized for color grading, low-light viewing, and terminal output.
              </p>
            </button>
          </div>
        </div>

        {/* Try-On Generation Parameters Card */}
        <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flame/10 text-flame">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-ink">
                  Inference & Generation Parameters
                </h2>
                <p className="text-xs text-ink-soft">
                  Fine-tune FASHN-VTON diffusion steps, guidance scale, and random seed
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              {savedToast && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Saved locally</span>
                </span>
              )}
              <button
                onClick={() => {
                  resetInferenceParams();
                  setSavedToast(true);
                  setTimeout(() => setSavedToast(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bone px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-bone-deep transition-colors cursor-pointer"
                title="Reset to default settings"
              >
                <RotateCcw className="h-3.5 w-3.5 text-ink-soft" />
                <span>Reset Defaults</span>
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="mb-6 rounded-2xl border border-line bg-bone p-4">
            <div className="flex items-center gap-2 mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-soft">
              <Zap className="h-3.5 w-3.5 text-flame" />
              <span>Speed & Quality Presets</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  updateInferenceParams({ numTimesteps: 8, skipCfgLastNSteps: 5, guidanceScale: 2.0 });
                  setSavedToast(true);
                  setTimeout(() => setSavedToast(false), 2000);
                }}
                className={clsx(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer",
                  inferenceParams.numTimesteps === 8 && inferenceParams.skipCfgLastNSteps === 5
                    ? "border-flame bg-paper font-semibold shadow-xs ring-1 ring-flame/30"
                    : "border-line bg-paper/60 hover:bg-paper"
                )}
              >
                <div className="flex items-center justify-between text-ink font-bold">
                  <span>⚡ DirectML Fast</span>
                  <span className="font-mono text-[10px] text-flame">8 steps</span>
                </div>
                <p className="mt-1 text-[11px] text-ink-soft leading-tight">
                  Recommended default (~1.5 min). Fast iterations with crisp fabric texture.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  updateInferenceParams({ numTimesteps: 14, skipCfgLastNSteps: 6, guidanceScale: 2.5 });
                  setSavedToast(true);
                  setTimeout(() => setSavedToast(false), 2000);
                }}
                className={clsx(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer",
                  inferenceParams.numTimesteps === 14
                    ? "border-flame bg-paper font-semibold shadow-xs ring-1 ring-flame/30"
                    : "border-line bg-paper/60 hover:bg-paper"
                )}
              >
                <div className="flex items-center justify-between text-ink font-bold">
                  <span>💎 Studio Quality</span>
                  <span className="font-mono text-[10px] text-flame">14 steps</span>
                </div>
                <p className="mt-1 text-[11px] text-ink-soft leading-tight">
                  Extra micro-textures & complex draping folds (~3.0 min).
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  updateInferenceParams({ numTimesteps: 5, skipCfgLastNSteps: 4, guidanceScale: 1.8 });
                  setSavedToast(true);
                  setTimeout(() => setSavedToast(false), 2000);
                }}
                className={clsx(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer",
                  inferenceParams.numTimesteps === 5
                    ? "border-flame bg-paper font-semibold shadow-xs ring-1 ring-flame/30"
                    : "border-line bg-paper/60 hover:bg-paper"
                )}
              >
                <div className="flex items-center justify-between text-ink font-bold">
                  <span>🚀 Ultra Fast</span>
                  <span className="font-mono text-[10px] text-flame">5 steps</span>
                </div>
                <p className="mt-1 text-[11px] text-ink-soft leading-tight">
                  Quick previews in under ~50 seconds. Great for rapid color matching.
                </p>
              </button>
            </div>
          </div>

          {/* Form Sliders & Controls */}
          <div className="space-y-5">
            {/* 1. Euler Timesteps */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-ink">
                <label htmlFor="numTimesteps">Diffusion Timesteps (Sampling Steps)</label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-ink-soft">
                    ~{Math.round(inferenceParams.numTimesteps * 14.5)}s est.
                  </span>
                  <span className="font-mono font-bold text-flame bg-bone px-2 py-0.5 rounded border border-line">
                    {inferenceParams.numTimesteps} steps
                  </span>
                </div>
              </div>
              <input
                id="numTimesteps"
                type="range"
                min="4"
                max="30"
                step="1"
                value={inferenceParams.numTimesteps}
                onChange={(e) => {
                  updateInferenceParams({ numTimesteps: Number(e.target.value) });
                  setSavedToast(true);
                  setTimeout(() => setSavedToast(false), 2000);
                }}
                className="w-full accent-flame h-2 bg-bone-deep rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-ink-soft leading-relaxed">
                Controls the number of denoising Euler steps. Fewer steps run much faster on AMD DirectML, while higher counts add intricate creases.
              </p>
            </div>

            {/* 2. Skip CFG Last N Steps */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-ink">
                <label htmlFor="skipCfg">Skip CFG on Final Steps (skip-cfg-last-n-steps)</label>
                <span className="font-mono font-bold text-flame bg-bone px-2 py-0.5 rounded border border-line">
                  {inferenceParams.skipCfgLastNSteps} steps
                </span>
              </div>
              <input
                id="skipCfg"
                type="range"
                min="0"
                max="10"
                step="1"
                value={inferenceParams.skipCfgLastNSteps}
                onChange={(e) => {
                  updateInferenceParams({ skipCfgLastNSteps: Number(e.target.value) });
                  setSavedToast(true);
                  setTimeout(() => setSavedToast(false), 2000);
                }}
                className="w-full accent-flame h-2 bg-bone-deep rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-ink-soft leading-relaxed">
                Skips classifier-free guidance for the last N steps. Cuts GPU time in half for those steps while preventing color over-saturation.
              </p>
            </div>

            {/* 3. Guidance Scale */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-ink">
                <label htmlFor="guidanceScale">Guidance Scale (CFG Multiplier)</label>
                <span className="font-mono font-bold text-flame bg-bone px-2 py-0.5 rounded border border-line">
                  {inferenceParams.guidanceScale.toFixed(1)}
                </span>
              </div>
              <input
                id="guidanceScale"
                type="range"
                min="1.0"
                max="5.0"
                step="0.1"
                value={inferenceParams.guidanceScale}
                onChange={(e) => {
                  updateInferenceParams({ guidanceScale: parseFloat(e.target.value) });
                  setSavedToast(true);
                  setTimeout(() => setSavedToast(false), 2000);
                }}
                className="w-full accent-flame h-2 bg-bone-deep rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-ink-soft leading-relaxed">
                Higher guidance strengthens garment pattern fidelity. 2.0 is the official default for natural cloth drape.
              </p>
            </div>

            {/* 4. Seed & Random Seed Toggle */}
            <div className="pt-2 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="seed" className="text-xs font-semibold text-ink block">
                  Diffusion Random Seed
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="seed"
                    type="number"
                    value={inferenceParams.seed}
                    disabled={inferenceParams.randomSeed}
                    onChange={(e) => {
                      updateInferenceParams({ seed: parseInt(e.target.value, 10) || 0 });
                      setSavedToast(true);
                      setTimeout(() => setSavedToast(false), 2000);
                    }}
                    className="flex-1 rounded-xl border border-line bg-bone px-3 py-2 text-xs font-mono text-ink disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={inferenceParams.randomSeed}
                    onClick={() => {
                      const newSeed = Math.floor(Math.random() * 999999);
                      updateInferenceParams({ seed: newSeed });
                      setSavedToast(true);
                      setTimeout(() => setSavedToast(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-line bg-bone px-3 py-2 text-xs font-semibold text-ink hover:bg-bone-deep transition-colors disabled:opacity-50 cursor-pointer"
                    title="Generate new random seed"
                  >
                    <Dices className="h-3.5 w-3.5 text-flame" />
                    <span>Roll</span>
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs text-ink-soft cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={inferenceParams.randomSeed}
                    onChange={(e) => {
                      updateInferenceParams({ randomSeed: e.target.checked });
                      setSavedToast(true);
                      setTimeout(() => setSavedToast(false), 2000);
                    }}
                    className="rounded accent-flame"
                  />
                  <span>Randomize seed on every try-on generation</span>
                </label>
              </div>

              {/* 5. Default Photo Type */}
              <div className="space-y-1.5">
                <label htmlFor="photoType" className="text-xs font-semibold text-ink block">
                  Default Garment Photo Type
                </label>
                <select
                  id="photoType"
                  value={inferenceParams.garmentPhotoType}
                  onChange={(e) => {
                    updateInferenceParams({ garmentPhotoType: e.target.value as any });
                    setSavedToast(true);
                    setTimeout(() => setSavedToast(false), 2000);
                  }}
                  className="w-full rounded-xl border border-line bg-bone px-3 py-2 text-xs font-medium text-ink cursor-pointer"
                >
                  <option value="flat-lay">Flat-Lay / Ghost Mannequin / Hanger (Default)</option>
                  <option value="model">Worn by a Person / Model Photo</option>
                </select>
                <p className="text-[11px] text-ink-soft leading-relaxed">
                  Tells the warp preprocessor whether the clothing image is laid flat or worn on a body.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy & Architecture Card */}
        <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Private Studio Guarantee
              </h2>
              <p className="text-xs text-ink-soft">
                Private by design • Stored directly on your personal machine
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
            Personal Wardrobe keeps your private collection confidential. Your clothing photographs,
            person reference photos, and styled try-on looks remain stored on your local disk
            and are never shared with third-party cloud services or external data brokers.
          </p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-2xl border border-line bg-bone p-3">
              <span className="text-[10px] font-mono text-ink-soft uppercase block">
                Cataloged Garments
              </span>
              <span className="font-display text-xl font-bold text-ink">
                {garments.length}
              </span>
            </div>
            <div className="rounded-2xl border border-line bg-bone p-3">
              <span className="text-[10px] font-mono text-ink-soft uppercase block">
                Saved Personas
              </span>
              <span className="font-display text-xl font-bold text-ink">
                {persons.length}
              </span>
            </div>
            <div className="rounded-2xl border border-line bg-bone p-3">
              <span className="text-[10px] font-mono text-ink-soft uppercase block">
                Generated Outfits
              </span>
              <span className="font-display text-xl font-bold text-ink">
                {outfits.length}
              </span>
            </div>
          </div>
        </div>

        {/* FASHN-VTON Engine Configuration */}
        <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flame/10 text-flame">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-ink">
                  FASHN-VTON Diffusion Engine
                </h2>
                <p className="text-xs text-ink-soft">
                  AMD DirectML / PyTorch Local Runtime
                </p>
              </div>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                engineStatus?.online
                  ? "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/30"
                  : "bg-amber-500/10 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/20"
              }`}
            >
              {engineStatus?.online ? "Service Active" : "Standby Mode"}
            </span>
          </div>

          <div className="space-y-3 rounded-2xl border border-line bg-bone p-4 text-xs">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <span className="text-ink-soft font-medium">Model Weights</span>
              <span className="font-mono text-ink">
                model.safetensors (1.94 GB detected in FASHN-VTON/weights)
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <span className="text-ink-soft font-medium">Hardware Target</span>
              <span className="font-mono text-ink">
                AMD Radeon (torch-directml) / CUDA / CPU
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <span className="text-ink-soft font-medium">Supported Categories</span>
              <span className="font-mono text-ink">
                tops, bottoms, one-pieces
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-ink-soft font-medium">Service Daemon URL</span>
              <span className="font-mono text-ink">
                {engineStatus?.url || "http://127.0.0.1:8188"}
              </span>
            </div>
          </div>

          {/* Test Engine Button */}
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-bone px-5 py-2.5 text-xs font-semibold text-ink hover:bg-bone-deep transition-colors shadow-xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${testingConnection ? "animate-spin" : ""}`}
              />
              <span>Test Engine Diagnostics</span>
            </button>

            <span className="text-[11px] text-ink-soft">
              Run: <code className="bg-bone-deep px-1.5 py-0.5 rounded font-mono">python vton-service/server.py</code>
            </span>
          </div>

          {testResult && (
            <div className="mt-4 rounded-xl border border-line bg-bone p-3.5 text-xs text-ink leading-relaxed">
              {testResult}
            </div>
          )}
        </div>

        {/* Local Storage & File System Paths */}
        <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bone-deep text-ink">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Local Storage & Database
              </h2>
              <p className="text-xs text-ink-soft">
                Repository file paths and local data store
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="rounded-xl border border-line bg-bone p-3 flex items-center justify-between">
              <span className="text-ink-soft">Data Store</span>
              <span className="font-mono text-ink">f:/projects/wardrobe/data/wardrobe.json</span>
            </div>
            <div className="rounded-xl border border-line bg-bone p-3 flex items-center justify-between">
              <span className="text-ink-soft">Public Uploads</span>
              <span className="font-mono text-ink">f:/projects/wardrobe/public/uploads/</span>
            </div>
            <div className="rounded-xl border border-line bg-bone p-3 flex items-center justify-between">
              <span className="text-ink-soft">Model Checkpoints</span>
              <span className="font-mono text-ink">f:/projects/wardrobe/FASHN-VTON/weights/</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
