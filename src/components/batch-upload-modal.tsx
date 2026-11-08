"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  X,
  Check,
  Loader2,
  Wand2,
  Sparkles,
  AlertCircle,
  Trash2,
  Play,
  RotateCcw,
  Plus,
  Shirt,
  Layers,
  Sliders,
  Eye,
  CheckCircle2,
} from "lucide-react";
import clsx from "clsx";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_SINGLE,
  type GarmentCategory,
  type GarmentPhotoType,
  type Garment,
} from "@/lib/types";
import { inferGarmentMetaFromFilename } from "@/lib/garment-utils";

export interface BatchItem {
  id: string;
  file: File;
  previewUrl: string; // Object URL or data URI for thumbnail
  dataUrl?: string; // Base64 data URI
  name: string;
  category: GarmentCategory;
  photoType: GarmentPhotoType;
  status: "idle" | "removing_bg" | "saving" | "completed" | "failed";
  progressMessage?: string;
  error?: string;
  resultGarment?: Garment;
  cutoutPreview?: string;
}

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFiles?: File[];
  onGarmentsAdded: () => Promise<void>;
}

export function BatchUploadModal({
  isOpen,
  onClose,
  initialFiles = [],
  onGarmentsAdded,
}: BatchUploadModalProps) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [autoRemoveBg, setAutoRemoveBg] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<string>("keep");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAbortedRef = useRef(false);

  // Helper to convert File to BatchItem
  const addFilesToQueue = useCallback((files: File[]) => {
    const validImageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (validImageFiles.length === 0) return;

    const newItems: BatchItem[] = validImageFiles.map((file) => {
      const meta = inferGarmentMetaFromFilename(file.name);
      return {
        id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        name: meta.name,
        category: meta.category,
        photoType: meta.photoType,
        status: "idle",
      };
    });

    setItems((prev) => [...prev, ...newItems]);

    // Read files into base64 dataUrls asynchronously
    newItems.forEach((item) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, dataUrl } : it))
        );
      };
      reader.readAsDataURL(item.file);
    });
  }, []);

  // When initialFiles change (e.g. from page drag-and-drop), add them
  useEffect(() => {
    if (initialFiles.length > 0 && isOpen) {
      addFilesToQueue(initialFiles);
    }
  }, [initialFiles, isOpen, addFilesToQueue]);

  // Handle bulk category assignment
  const handleBulkCategoryChange = (cat: string) => {
    setBulkCategory(cat);
    if (cat === "keep") return;
    setItems((prev) =>
      prev.map((it) =>
        it.status === "idle" || it.status === "failed"
          ? { ...it, category: cat as GarmentCategory }
          : it
      )
    );
  };

  // Drag and drop handlers for the modal dropzone
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(Array.from(e.dataTransfer.files));
    }
  };

  // Remove single item from queue
  const removeItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((it) => it.id === id);
      if (item?.previewUrl && item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((it) => it.id !== id);
    });
  };

  // Clear all idle/failed items
  const clearQueue = () => {
    items.forEach((it) => {
      if (it.previewUrl && it.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(it.previewUrl);
      }
    });
    setItems([]);
  };

  // Convert File to Base64 promise helper if not yet loaded
  const getFileDataUrl = (item: BatchItem): Promise<string> => {
    if (item.dataUrl) return Promise.resolve(item.dataUrl);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(item.file);
    });
  };

  // Process a single item
  const processItem = async (item: BatchItem): Promise<boolean> => {
    try {
      // 1. Prepare Base64 Image
      const originalDataUrl = await getFileDataUrl(item);
      let imageToSave = originalDataUrl;
      let cutoutUrl: string | undefined = undefined;

      // 2. Background Removal via RMBG-1.4 (if selected)
      if (autoRemoveBg) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: "removing_bg",
                  progressMessage: "Isolating fabric silhouette (RMBG-1.4)...",
                }
              : it
          )
        );

        try {
          const bgRes = await fetch("/api/garments/remove-bg", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: originalDataUrl }),
          });

          if (bgRes.ok) {
            const bgData = await bgRes.json();
            if (bgData.image) {
              imageToSave = bgData.image;
              cutoutUrl = bgData.image;
            }
          } else {
            console.warn("Background removal notice: Proceeding with original photo");
          }
        } catch (bgErr) {
          console.warn("Background removal notice:", bgErr);
          // Fall back gracefully to original image
        }
      }

      if (isAbortedRef.current) return false;

      // 3. Save garment & extract palette via Sharp
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                status: "saving",
                cutoutPreview: cutoutUrl,
                progressMessage: "Extracting color palette & saving...",
              }
            : it
        )
      );

      const saveRes = await fetch("/api/garments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name.trim() || "Wardrobe Piece",
          category: item.category,
          photoType: item.photoType,
          image: imageToSave,
        }),
      });

      if (!saveRes.ok) {
        const errData = await saveRes.json();
        throw new Error(errData.error || "Failed to save garment");
      }

      const saveData = await saveRes.json();

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                status: "completed",
                resultGarment: saveData.garment,
                progressMessage: "Added to wardrobe",
              }
            : it
        )
      );

      // Trigger real-time background refresh of wardrobe catalog
      await onGarmentsAdded();
      return true;
    } catch (err: any) {
      console.error(`Failed to process ${item.name}:`, err);
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                status: "failed",
                error: err.message || "Failed to process image",
                progressMessage: undefined,
              }
            : it
        )
      );
      return false;
    }
  };

  // Start sequential batch processing queue
  const handleStartQueue = async () => {
    setIsProcessing(true);
    isAbortedRef.current = false;

    // Get all items that are pending (idle or failed)
    const pendingItems = items.filter(
      (it) => it.status === "idle" || it.status === "failed"
    );

    for (let i = 0; i < pendingItems.length; i++) {
      if (isAbortedRef.current) {
        break;
      }
      const item = pendingItems[i];
      await processItem(item);
    }

    setIsProcessing(false);
  };

  // Cancel/stop queue
  const handleStopQueue = () => {
    isAbortedRef.current = true;
    setIsProcessing(false);
  };

  // Calculate statistics
  const totalCount = items.length;
  const completedCount = items.filter((it) => it.status === "completed").length;
  const failedCount = items.filter((it) => it.status === "failed").length;
  const pendingCount = items.filter(
    (it) => it.status === "idle" || it.status === "removing_bg" || it.status === "saving"
  ).length;

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-3xl rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-2xl my-6 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-flame/10 text-flame">
                <UploadCloud className="h-4 w-4" />
              </div>
              <h2 className="font-display text-2xl font-bold text-ink">
                Batch Wardrobe Ingestion
              </h2>
            </div>
            <p className="text-xs text-ink-soft mt-1">
              Drop multiple clothing photos to isolate backgrounds with RMBG-1.4, extract color palettes, and bulk catalog.
            </p>
          </div>
          <button
            onClick={() => {
              if (isProcessing) {
                if (confirm("Stop queue processing and close?")) {
                  handleStopQueue();
                  onClose();
                }
              } else {
                onClose();
              }
            }}
            className="rounded-full p-2 text-ink-soft hover:bg-bone-deep hover:text-ink transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Global Queue Controls & Dropzone Bar */}
        <div className="py-4 space-y-4">
          {/* Multi-File Dropzone Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              "relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer group text-center",
              isDragOver
                ? "border-flame bg-flame/10 scale-[1.01]"
                : "border-line hover:border-flame/50 bg-bone/40 hover:bg-bone/80"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/jpg"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  addFilesToQueue(Array.from(e.target.files));
                }
                e.target.value = "";
              }}
            />

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-paper shadow-sm border border-line text-flame mb-2 group-hover:scale-110 transition-transform">
              <UploadCloud className="h-6 w-6" />
            </div>
            <span className="text-sm font-semibold text-ink">
              Drop clothing photos here, or <span className="text-flame underline">browse files</span>
            </span>
            <span className="text-xs text-ink-soft mt-1">
              Supports PNG, JPG, WebP • Multi-selection supported
            </span>
          </div>

          {/* Bulk Controls Options */}
          {items.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-line bg-bone text-xs">
              <div className="flex flex-wrap items-center gap-4">
                {/* Auto Remove BG Switch */}
                <label className="flex items-center gap-2 font-medium text-ink cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRemoveBg}
                    disabled={isProcessing}
                    onChange={(e) => setAutoRemoveBg(e.target.checked)}
                    className="h-4 w-4 rounded border-line text-flame focus:ring-flame/40 cursor-pointer accent-[#ff5b36]"
                  />
                  <span className="flex items-center gap-1.5">
                    <Wand2 className="h-3.5 w-3.5 text-flame" />
                    <span>Auto-Isolate Garments (RMBG-1.4)</span>
                  </span>
                </label>

                {/* Bulk Category Setter */}
                <div className="flex items-center gap-1.5 text-ink-soft">
                  <Sliders className="h-3.5 w-3.5 text-ink-soft" />
                  <span>Category:</span>
                  <select
                    value={bulkCategory}
                    disabled={isProcessing}
                    onChange={(e) => handleBulkCategoryChange(e.target.value)}
                    className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs text-ink font-semibold focus:outline-none focus:border-flame cursor-pointer"
                  >
                    <option value="keep">Auto-Detected per file</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        All {CATEGORY_LABEL[cat]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Clear button */}
              {!isProcessing && (
                <button
                  type="button"
                  onClick={clearQueue}
                  className="inline-flex items-center gap-1.5 text-ink-soft hover:text-red-600 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear Queue</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Items List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[160px] max-h-[380px] scrollbar-thin">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-ink-soft space-y-2">
              <Shirt className="h-10 w-10 text-ink-soft/40 stroke-[1.5]" />
              <p className="text-sm font-medium">No clothes in queue yet</p>
              <p className="text-xs text-ink-soft max-w-sm">
                Drag multiple images of shirts, pants, jackets, or dresses into the box above to start processing.
              </p>
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.id}
                className={clsx(
                  "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border transition-all",
                  item.status === "completed"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : item.status === "failed"
                    ? "border-red-500/30 bg-red-500/5"
                    : item.status === "removing_bg" || item.status === "saving"
                    ? "border-flame/40 bg-flame/5 ring-1 ring-flame/30"
                    : "border-line bg-paper"
                )}
              >
                {/* Left: Thumbnail & Name / Category fields */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Thumbnail */}
                  <div className="relative h-14 w-14 shrink-0 rounded-xl border border-line bg-bone-deep overflow-hidden flex items-center justify-center">
                    <img
                      src={item.cutoutPreview || item.previewUrl}
                      alt={item.name}
                      className="h-full w-full object-contain"
                    />
                    {item.status === "completed" && (
                      <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-[1px] flex items-center justify-center text-emerald-400">
                        <Check className="h-5 w-5 stroke-[3]" />
                      </div>
                    )}
                    {(item.status === "removing_bg" || item.status === "saving") && (
                      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[1px] flex items-center justify-center text-flame">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Title & Inputs */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-ink-soft">
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={item.name}
                        disabled={isProcessing || item.status === "completed"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItems((prev) =>
                            prev.map((it) => (it.id === item.id ? { ...it, name: val } : it))
                          );
                        }}
                        placeholder="Garment Name"
                        className="text-xs font-semibold text-ink bg-transparent border-b border-transparent hover:border-line focus:border-flame focus:outline-none transition-colors w-full truncate"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {/* Category selector */}
                      <select
                        value={item.category}
                        disabled={isProcessing || item.status === "completed"}
                        onChange={(e) => {
                          const val = e.target.value as GarmentCategory;
                          setItems((prev) =>
                            prev.map((it) => (it.id === item.id ? { ...it, category: val } : it))
                          );
                        }}
                        className="rounded-md border border-line bg-bone px-2 py-0.5 text-[11px] font-medium text-ink focus:outline-none cursor-pointer"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {CATEGORY_SINGLE[cat]}
                          </option>
                        ))}
                      </select>

                      {/* Photo Type */}
                      <select
                        value={item.photoType}
                        disabled={isProcessing || item.status === "completed"}
                        onChange={(e) => {
                          const val = e.target.value as GarmentPhotoType;
                          setItems((prev) =>
                            prev.map((it) => (it.id === item.id ? { ...it, photoType: val } : it))
                          );
                        }}
                        className="rounded-md border border-line bg-bone px-2 py-0.5 text-[11px] font-medium text-ink-soft focus:outline-none cursor-pointer"
                      >
                        <option value="flat-lay">Flat Lay</option>
                        <option value="model">On Model</option>
                      </select>

                      {/* Completed Details (Hex & Label) */}
                      {item.resultGarment?.colorHex && (
                        <div className="flex items-center gap-1.5 rounded-full border border-line bg-bone px-2 py-0.5 text-[10px] font-mono text-ink">
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-black/20"
                            style={{ backgroundColor: item.resultGarment.colorHex }}
                          />
                          <span>{item.resultGarment.color || item.resultGarment.colorHex}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Status badge & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-line/60">
                  {/* Status Indicator */}
                  {item.status === "completed" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Ready</span>
                    </span>
                  ) : item.status === "failed" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600" title={item.error}>
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[120px]">{item.error || "Failed"}</span>
                    </span>
                  ) : item.status === "removing_bg" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-flame animate-pulse">
                      <Wand2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Isolating cutout...</span>
                    </span>
                  ) : item.status === "saving" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-flame animate-pulse">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving & colors...</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-ink-soft font-mono">
                      Queued
                    </span>
                  )}

                  {/* Individual Remove / Retry button */}
                  {!isProcessing && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1 rounded-full text-ink-soft hover:bg-bone hover:text-ink transition-colors cursor-pointer"
                      title="Remove from batch"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions & Overall Progress Bar */}
        <div className="pt-4 border-t border-line mt-4 space-y-3">
          {/* Progress HUD if items exist */}
          {items.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-ink-soft">
                  Progress: {completedCount}/{totalCount} processed {failedCount > 0 && `(${failedCount} failed)`}
                </span>
                <span className="font-bold text-flame">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-bone border border-line">
                <motion.div
                  className="h-full bg-flame"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ ease: "easeOut", duration: 0.3 }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-ink-soft">
              {completedCount > 0
                ? `${completedCount} new garment${completedCount === 1 ? "" : "s"} live in your wardrobe`
                : `${items.length} item${items.length === 1 ? "" : "s"} ready to process`}
            </span>

            <div className="flex items-center gap-2">
              {isProcessing ? (
                <button
                  type="button"
                  onClick={handleStopQueue}
                  className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-500/20 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Pause Queue</span>
                </button>
              ) : completedCount === totalCount && totalCount > 0 ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer shadow-md"
                >
                  <Check className="h-4 w-4" />
                  <span>Done — View Wardrobe</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-line bg-bone px-4 py-2 text-xs font-semibold text-ink hover:bg-bone-deep transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={items.length === 0 || pendingCount === 0}
                    onClick={handleStartQueue}
                    className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-xs font-semibold text-bone hover:bg-flame disabled:opacity-50 transition-all cursor-pointer shadow-md hover:scale-[1.02]"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Import {pendingCount} {pendingCount === 1 ? "Piece" : "Pieces"}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

