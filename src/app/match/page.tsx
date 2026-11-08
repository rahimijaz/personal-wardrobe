"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Shuffle,
  Shirt,
  ArrowRight,
  Bookmark,
  Check,
  Compass,
  SlidersHorizontal,
  TrendingUp,
  Layers,
  Palette,
  CheckCircle2,
} from "lucide-react";
import clsx from "clsx";
import { useWardrobe } from "@/context/wardrobe-context";
import {
  getRecommendedFits,
  getMatchesForGarment,
  type RecommendedFit,
  type OutfitVibe,
} from "@/lib/recommendations";
import type { Garment } from "@/lib/types";

const VIBE_DEFINITIONS: Array<{ id: OutfitVibe; label: string; desc: string }> = [
  { id: "all", label: "All Fits", desc: "Every combination scored by balance" },
  { id: "streetwear", label: "Streetwear", desc: "Relaxed silhouettes & utility wear" },
  { id: "smart-casual", label: "Smart Casual", desc: "Elevated linen, shirts & tailored pieces" },
  { id: "high-contrast", label: "High Contrast", desc: "Crisp light tops with dark bottoms" },
  { id: "minimal", label: "Minimal", desc: "Clean cuts & solid essentials" },
  { id: "casual", label: "Casual", desc: "Everyday easy-going staples" },
  { id: "monochrome", label: "Monochrome", desc: "Tonal & single-palette cohesion" },
];

export default function MatchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 p-8 max-w-7xl mx-auto w-full flex items-center justify-center min-h-[50vh]">
          <div className="flex items-center gap-3 text-ink-soft font-mono text-sm">
            <span className="h-3 w-3 rounded-full bg-flame animate-ping" />
            <span>Loading Recommender Studio...</span>
          </div>
        </div>
      }
    >
      <MatchContent />
    </Suspense>
  );
}

function MatchContent() {
  const searchParams = useSearchParams();
  const initialPieceId = searchParams.get("pieceId") || searchParams.get("anchor");

  const { garments, saveOutfit, isLoadingGarments } = useWardrobe();

  // Mode: "single" (Style a specific piece with matching counterparts) vs "all" (Browse all combinations in closet)
  // Default to "single" because users specifically want to pick their top and see only matching bottoms!
  const [mode, setMode] = useState<"single" | "all">("single");
  const [selectedVibe, setSelectedVibe] = useState<OutfitVibe>("all");
  const [sortBy, setSortBy] = useState<"score" | "contrast" | "harmony">("score");

  // Category of the anchor piece: "tops" or "bottoms"
  const [anchorCategory, setAnchorCategory] = useState<"tops" | "bottoms">("tops");
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(initialPieceId || null);

  const [savedFitIds, setSavedFitIds] = useState<Set<string>>(new Set());
  const [shuffleSeed, setShuffleSeed] = useState(0);

  const tops = useMemo(() => garments.filter((g) => g.category === "tops"), [garments]);
  const bottoms = useMemo(() => garments.filter((g) => g.category === "bottoms"), [garments]);

  // Synchronize anchor with pieceId query param if present
  useEffect(() => {
    if (initialPieceId && garments.length > 0) {
      const found = garments.find((g) => g.id === initialPieceId);
      if (found) {
        setSelectedAnchorId(found.id);
        if (found.category === "bottoms") {
          setAnchorCategory("bottoms");
        } else {
          setAnchorCategory("tops");
        }
        setMode("single");
      }
    }
  }, [initialPieceId, garments]);

  // Active anchor piece (guaranteed to match the active category)
  const activeAnchor = useMemo<Garment | null>(() => {
    const list = anchorCategory === "tops" ? tops : bottoms;
    if (list.length === 0) return null;
    if (selectedAnchorId) {
      const found = list.find((g) => g.id === selectedAnchorId);
      if (found) return found;
    }
    return list[0];
  }, [anchorCategory, tops, bottoms, selectedAnchorId]);

  // Matches for ONLY the selected anchor piece:
  // If activeAnchor is a Top, this returns ONLY [Active Top + Bottom 1], [Active Top + Bottom 2], etc.
  // If activeAnchor is a Bottom, this returns ONLY [Top 1 + Active Bottom], [Top 2 + Active Bottom], etc.
  const singlePieceMatches = useMemo(() => {
    if (!activeAnchor) return [];
    return getMatchesForGarment(activeAnchor, garments, selectedVibe, 12);
  }, [activeAnchor, garments, selectedVibe]);

  // All combinations in closet
  const allCuratedFits = useMemo(() => {
    return getRecommendedFits(garments, selectedVibe, sortBy);
  }, [garments, selectedVibe, sortBy]);

  // Count fits matching each vibe
  const vibeCounts = useMemo(() => {
    const rawFits = getRecommendedFits(garments, "all");
    const counts: Record<OutfitVibe, number> = {
      all: rawFits.length,
      streetwear: 0,
      "smart-casual": 0,
      "high-contrast": 0,
      minimal: 0,
      casual: 0,
      monochrome: 0,
    };
    for (const fit of rawFits) {
      for (const v of fit.vibe) {
        if (counts[v] !== undefined) counts[v]++;
      }
    }
    return counts;
  }, [garments]);

  // Handle shuffle for all-fits mode
  const curatedFits = useMemo(() => {
    if (shuffleSeed === 0) return allCuratedFits;
    const shuffled = [...allCuratedFits];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (i * 31 + shuffleSeed * 17) % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [allCuratedFits, shuffleSeed]);

  const handleSaveFit = async (fit: RecommendedFit) => {
    if (savedFitIds.has(fit.id)) return;
    try {
      await saveOutfit({
        name: `${fit.top.name} + ${fit.bottom.name}`,
        personId: "person-elena",
        garmentIds: [fit.top.id, fit.bottom.id],
        resultImage: fit.top.image,
        category: fit.vibe.find((v) => v !== "all") || "casual",
      });
      setSavedFitIds((prev) => new Set([...prev, fit.id]));
    } catch {
      // silent
    }
  };

  return (
    <div className="flex-1 p-6 sm:p-8 md:p-10 max-w-7xl mx-auto w-full page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-ink-soft uppercase tracking-wider mb-1">
            <Link href="/" className="hover:text-ink">
              Studio
            </Link>
            <span>/</span>
            <span className="text-ink font-semibold">Outfit Recommender</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Outfit Recommender
          </h1>
          <p className="text-sm text-ink-soft mt-1 max-w-xl">
            Select any piece to see its best matching counterparts, or explore full wardrobe pairings.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/harmony"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-xs font-semibold text-ink shadow-xs hover:border-flame/50 hover:bg-bone transition-colors cursor-pointer"
            title="Interactive Color Harmony Wheel"
          >
            <Palette className="h-3.5 w-3.5 text-flame" />
            <span>Color Wheel</span>
          </Link>
          <button
            onClick={() => setShuffleSeed((s) => s + 1)}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-xs font-semibold text-ink shadow-xs hover:border-ink/40 transition-colors cursor-pointer"
          >
            <Shuffle className="h-3.5 w-3.5 text-flame" />
            <span>Shuffle Fits</span>
          </button>
          <Link
            href="/try-on"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-bone hover:bg-flame transition-colors shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-flame" />
            <span>Open Studio</span>
          </Link>
        </div>
      </div>

      {/* Mode Selector & Vibe Filter Navigation */}
      <div className="space-y-4 mb-8 border-b border-line pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Mode Switcher */}
          <div className="inline-flex rounded-2xl border border-line bg-paper p-1 shadow-xs">
            <button
              onClick={() => {
                setMode("single");
              }}
              className={clsx(
                "rounded-xl px-5 py-2 text-xs font-semibold transition-all duration-200 cursor-pointer",
                mode === "single"
                  ? "bg-ink text-bone shadow-xs"
                  : "text-ink-soft hover:text-ink"
              )}
            >
              Style A Piece (Selected Piece + Matches)
            </button>
            <button
              onClick={() => {
                setMode("all");
              }}
              className={clsx(
                "rounded-xl px-5 py-2 text-xs font-semibold transition-all duration-200 cursor-pointer",
                mode === "all"
                  ? "bg-ink text-bone shadow-xs"
                  : "text-ink-soft hover:text-ink"
              )}
            >
              All Closet Outfits ({allCuratedFits.length})
            </button>
          </div>

          {/* Quick Sort Dropdown (in all mode) */}
          {mode === "all" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-ink-soft flex items-center gap-1 font-mono text-[11px] uppercase">
                <SlidersHorizontal className="h-3.5 w-3.5 text-flame" />
                Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-xl border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink shadow-2xs focus:outline-hidden focus:border-ink cursor-pointer"
              >
                <option value="score">Overall Fit Score</option>
                <option value="contrast">Highest Contrast</option>
                <option value="harmony">Color Harmony</option>
              </select>
            </div>
          )}
        </div>

        {/* Vibe Filter Buttons (Works in BOTH modes!) */}
        <div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {VIBE_DEFINITIONS.map((v) => {
              const count = vibeCounts[v.id] ?? 0;
              const isActive = selectedVibe === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVibe(v.id)}
                  className={clsx(
                    "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 border cursor-pointer",
                    isActive
                      ? "bg-flame text-white border-flame shadow-xs scale-102"
                      : "border-line bg-paper text-ink-soft hover:text-ink hover:border-ink/40"
                  )}
                  title={v.desc}
                >
                  <span>{v.label}</span>
                  {count > 0 && (
                    <span
                      className={clsx(
                        "rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                        isActive ? "bg-white/20 text-white" : "bg-bone-deep text-ink-soft"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      {isLoadingGarments ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 rounded-3xl border border-line bg-paper animate-pulse p-6" />
          ))}
        </div>
      ) : tops.length === 0 || bottoms.length === 0 ? (
        /* Empty State */
        <div className="rounded-3xl border border-line bg-paper p-12 text-center max-w-lg mx-auto my-12 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-flame/10 text-flame mb-4">
            <Shirt className="h-7 w-7" />
          </div>
          <h3 className="font-display text-xl font-bold text-ink">
            {tops.length === 0 && bottoms.length === 0
              ? "No wardrobe pieces yet"
              : tops.length === 0
              ? "Add a Top to get started"
              : "Add a Bottom to get started"}
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-ink-soft leading-relaxed">
            The recommender needs at least one top and one bottom in your collection to calculate matching outfits.
          </p>
          <div className="mt-6">
            <Link
              href="/wardrobe"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-xs font-semibold text-bone hover:bg-flame transition-colors shadow-sm"
            >
              <span>Add Pieces to Wardrobe</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : mode === "single" ? (
        /* ═══════════════════════════════════════════════════════════════════
           STYLE A PIECE MODE: ONLY SHOWS THE SELECTED PIECE + OTHER COUNTERPARTS
           ═══════════════════════════════════════════════════════════════════ */
        <div className="space-y-8">
          {/* Step 1: Piece Selector Bar */}
          <div className="rounded-3xl border border-line bg-paper p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">
                  1. Click a Piece to Style
                </h3>
                <p className="text-xs text-ink-soft">
                  Click any piece below. The outfits below will update to show <strong>ONLY</strong> this piece paired with all matching {anchorCategory === "tops" ? "bottoms" : "tops"}.
                </p>
              </div>

              {/* Category Switcher: Tops vs Bottoms */}
              <div className="inline-flex rounded-xl border border-line bg-bone p-1 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setAnchorCategory("tops");
                    setSelectedAnchorId(tops[0]?.id || null);
                  }}
                  className={clsx(
                    "rounded-lg px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                    anchorCategory === "tops"
                      ? "bg-paper text-ink shadow-xs"
                      : "text-ink-soft hover:text-ink"
                  )}
                >
                  Tops ({tops.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAnchorCategory("bottoms");
                    setSelectedAnchorId(bottoms[0]?.id || null);
                  }}
                  className={clsx(
                    "rounded-lg px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                    anchorCategory === "bottoms"
                      ? "bg-paper text-ink shadow-xs"
                      : "text-ink-soft hover:text-ink"
                  )}
                >
                  Bottoms ({bottoms.length})
                </button>
              </div>
            </div>

            {/* Clickable Grid of Garments */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
              {(anchorCategory === "tops" ? tops : bottoms).map((g) => {
                const isSelected = activeAnchor?.id === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setSelectedAnchorId(g.id);
                    }}
                    className={clsx(
                      "group relative flex flex-col rounded-2xl border p-2.5 text-left transition-all duration-200 cursor-pointer",
                      isSelected
                        ? "border-flame ring-3 ring-flame/30 bg-flame/10 shadow-sm"
                        : "border-line bg-bone/40 hover:border-ink/40 hover:bg-bone"
                    )}
                  >
                    {isSelected ? (
                      <span className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-flame px-2 py-0.5 text-[9px] font-bold text-white shadow-xs">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                        <span>ACTIVE</span>
                      </span>
                    ) : (
                      <span className="absolute top-2 right-2 z-10 rounded-full bg-bone px-1.5 py-0.5 text-[9px] font-mono text-ink-soft opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to Style
                      </span>
                    )}

                    <div className="aspect-square w-full rounded-xl overflow-hidden bg-bone-deep mb-2 p-1 flex items-center justify-center">
                      <img
                        src={g.image}
                        alt={g.name}
                        className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105"
                      />
                    </div>
                    <span className="block truncate text-xs font-semibold text-ink leading-tight">
                      {g.name}
                    </span>
                    <span className="block font-mono text-[10px] text-ink-soft mt-0.5 truncate">
                      {g.color || g.type || g.category}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: EXCLUSIVELY SHOWS PAIRINGS FOR THE ACTIVE ANCHOR PIECE */}
          {activeAnchor && (
            <div className="space-y-6">
              {/* Active Selection Focus Banner */}
              <div className="rounded-2xl border border-flame/20 bg-flame/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl border border-line bg-bone p-1 shrink-0 flex items-center justify-center">
                    <img
                      src={activeAnchor.image}
                      alt={activeAnchor.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-flame font-bold block">
                      Currently Styling ({activeAnchor.category === "tops" ? "Top" : "Bottom"}):
                    </span>
                    <h4 className="text-sm sm:text-base font-bold text-ink">
                      {activeAnchor.name}
                    </h4>
                  </div>
                </div>

                <div className="text-xs text-ink-soft">
                  Showing <strong>{singlePieceMatches.length}</strong> matching {activeAnchor.category === "tops" ? "bottoms" : "tops"} from your wardrobe
                </div>
              </div>

              {singlePieceMatches.length === 0 ? (
                <div className="rounded-2xl border border-line bg-paper p-8 text-center text-xs text-ink-soft">
                  No matching {activeAnchor.category === "tops" ? "bottoms" : "tops"} found matching the "{selectedVibe}" vibe filter.
                  <button
                    onClick={() => setSelectedVibe("all")}
                    className="ml-2 text-flame font-bold hover:underline"
                  >
                    Show all matching pieces
                  </button>
                </div>
              ) : (
                /* The Matching Pairs List — ONLY CONTAINS THE SELECTED PIECE WITH OTHER COUNTERPARTS */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {singlePieceMatches.map((fit, idx) => {
                    const counterPiece = activeAnchor.category === "tops" ? fit.bottom : fit.top;
                    return (
                      <motion.div
                        key={fit.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="rounded-3xl border border-line bg-paper p-5 sm:p-6 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
                      >
                        <div>
                          {/* Header */}
                          <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                <span>{fit.score}% Match</span>
                              </span>
                              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft bg-bone px-2 py-0.5 rounded-full border border-line">
                                {fit.relation}
                              </span>
                            </div>

                            <button
                              onClick={() => handleSaveFit(fit)}
                              className={clsx(
                                "rounded-full p-2 transition-colors cursor-pointer",
                                savedFitIds.has(fit.id)
                                  ? "bg-emerald-500/15 text-emerald-700"
                                  : "text-ink-soft hover:bg-bone hover:text-ink"
                              )}
                              title={savedFitIds.has(fit.id) ? "Saved to Outfits" : "Save Outfit"}
                            >
                              {savedFitIds.has(fit.id) ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Bookmark className="h-4 w-4" />
                              )}
                            </button>
                          </div>

                          {/* 2-Piece Visual Comparison (Your Selected Piece + Match) */}
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            {/* Your Selected Piece */}
                            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border-2 border-flame/40 bg-flame/5 flex flex-col justify-between p-3">
                              <span className="relative z-10 self-start rounded-full bg-flame text-[9px] font-mono uppercase font-bold text-white px-2 py-0.5 shadow-2xs">
                                Selected {activeAnchor.category === "tops" ? "Top" : "Bottom"}
                              </span>
                              <img
                                src={activeAnchor.image}
                                alt={activeAnchor.name}
                                className="absolute inset-0 h-full w-full object-contain p-2"
                              />
                              <div className="relative z-10 bg-gradient-to-t from-paper via-paper/90 to-transparent p-2 -mx-3 -mb-3 rounded-b-2xl border-t border-line/60">
                                <p className="text-xs font-bold text-ink truncate">{activeAnchor.name}</p>
                                <p className="text-[10px] text-ink-soft font-mono truncate">{activeAnchor.color || "Primary"}</p>
                              </div>
                            </div>

                            {/* Matching Counterpiece */}
                            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-line bg-bone flex flex-col justify-between p-3">
                              <span className="relative z-10 self-start rounded-full bg-paper/90 backdrop-blur-xs px-2 py-0.5 text-[9px] font-mono uppercase font-semibold text-ink-soft border border-line">
                                Matching {counterPiece.category === "tops" ? "Top" : "Bottom"}
                              </span>
                              <img
                                src={counterPiece.image}
                                alt={counterPiece.name}
                                className="absolute inset-0 h-full w-full object-contain p-2"
                              />
                              <div className="relative z-10 bg-gradient-to-t from-paper via-paper/90 to-transparent p-2 -mx-3 -mb-3 rounded-b-2xl border-t border-line/60">
                                <p className="text-xs font-semibold text-ink truncate">{counterPiece.name}</p>
                                <p className="text-[10px] text-ink-soft font-mono truncate">{counterPiece.color || "Primary"}</p>
                              </div>
                            </div>
                          </div>

                          {/* Stylist Note */}
                          <div className="rounded-2xl border border-line bg-bone/60 p-3 mb-4">
                            <p className="text-xs text-ink-soft leading-relaxed">
                              <strong className="text-ink font-semibold">Stylist Note:</strong>{" "}
                              {fit.stylistNote}
                            </p>
                          </div>
                        </div>

                        {/* Action Bar */}
                        <div className="pt-2 flex items-center justify-between border-t border-line">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-3 w-3 rounded-full border border-line inline-block"
                              style={{ backgroundColor: fit.palette[0] }}
                            />
                            <span className="text-[10px] text-ink-soft">×</span>
                            <span
                              className="h-3 w-3 rounded-full border border-line inline-block"
                              style={{ backgroundColor: fit.palette[1] }}
                            />
                          </div>

                          <Link
                            href={`/try-on?topId=${fit.top.id}&bottomId=${fit.bottom.id}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-bone hover:bg-flame transition-colors"
                          >
                            <span>Try On This Look</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════════════
           ALL CLOSET COMBINATIONS MODE
           ═══════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span className="font-semibold text-ink">
              {selectedVibe === "all" ? (
                `Showing all ${curatedFits.length} wardrobe combinations`
              ) : (
                <>
                  Showing {curatedFits.length} {selectedVibe.replace("-", " ")} combinations
                  <button
                    onClick={() => setSelectedVibe("all")}
                    className="ml-2 text-flame hover:underline font-normal"
                  >
                    (Clear filter)
                  </button>
                </>
              )}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              Ranked by {sortBy === "contrast" ? "Contrast" : sortBy === "harmony" ? "Harmony" : "Fit Score"}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {curatedFits.map((fit, idx) => (
              <motion.div
                key={fit.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.25 }}
                className="group flex flex-col rounded-3xl border border-line bg-paper p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 justify-between"
              >
                <div>
                  {/* Fit Card Header */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span>{fit.score}% Match</span>
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft bg-bone px-2 py-0.5 rounded-full border border-line">
                        {fit.relation}
                      </span>
                      {fit.vibe
                        .filter((v) => v !== "all")
                        .slice(0, 2)
                        .map((v) => (
                          <span
                            key={v}
                            className="font-mono text-[9px] uppercase tracking-wider text-flame bg-flame/10 px-2 py-0.5 rounded-full border border-flame/20"
                          >
                            {v}
                          </span>
                        ))}
                    </div>

                    <button
                      onClick={() => handleSaveFit(fit)}
                      className={clsx(
                        "rounded-full p-2 transition-colors cursor-pointer",
                        savedFitIds.has(fit.id)
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "text-ink-soft hover:bg-bone hover:text-ink"
                      )}
                      title={savedFitIds.has(fit.id) ? "Saved to Outfits" : "Save Outfit"}
                    >
                      {savedFitIds.has(fit.id) ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* 2-Piece Visual Comparison */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Top Garment */}
                    <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-line bg-bone flex flex-col justify-between p-3 group/item">
                      <img
                        src={fit.top.image}
                        alt={fit.top.name}
                        className="absolute inset-0 h-full w-full object-contain p-2 transition-transform duration-300 group-hover/item:scale-105"
                      />
                      <span className="relative z-10 self-start rounded-full bg-paper/90 backdrop-blur-xs px-2 py-0.5 text-[9px] font-mono uppercase font-semibold text-ink-soft border border-line">
                        Top
                      </span>
                      <div className="relative z-10 bg-gradient-to-t from-paper/95 via-paper/80 to-transparent p-2 -mx-3 -mb-3 rounded-b-2xl">
                        <p className="text-xs font-semibold text-ink truncate">{fit.top.name}</p>
                        <p className="text-[10px] text-ink-soft font-mono truncate">{fit.top.color || "Primary"}</p>
                      </div>
                    </div>

                    {/* Bottom Garment */}
                    <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-line bg-bone flex flex-col justify-between p-3 group/item">
                      <img
                        src={fit.bottom.image}
                        alt={fit.bottom.name}
                        className="absolute inset-0 h-full w-full object-contain p-2 transition-transform duration-300 group-hover/item:scale-105"
                      />
                      <span className="relative z-10 self-start rounded-full bg-paper/90 backdrop-blur-xs px-2 py-0.5 text-[9px] font-mono uppercase font-semibold text-ink-soft border border-line">
                        Bottom
                      </span>
                      <div className="relative z-10 bg-gradient-to-t from-paper/95 via-paper/80 to-transparent p-2 -mx-3 -mb-3 rounded-b-2xl">
                        <p className="text-xs font-semibold text-ink truncate">{fit.bottom.name}</p>
                        <p className="text-[10px] text-ink-soft font-mono truncate">{fit.bottom.color || "Primary"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stylist Note */}
                  <div className="rounded-2xl border border-line bg-bone/60 p-3 mb-4">
                    <p className="text-xs text-ink-soft leading-relaxed">
                      <strong className="text-ink font-semibold">Stylist Note:</strong>{" "}
                      {fit.stylistNote}
                    </p>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-2 flex items-center justify-between border-t border-line">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-3 w-3 rounded-full border border-line inline-block"
                      style={{ backgroundColor: fit.palette[0] }}
                      title={`Top: ${fit.palette[0]}`}
                    />
                    <span className="text-[10px] text-ink-soft">×</span>
                    <span
                      className="h-3 w-3 rounded-full border border-line inline-block"
                      style={{ backgroundColor: fit.palette[1] }}
                      title={`Bottom: ${fit.palette[1]}`}
                    />
                  </div>

                  <Link
                    href={`/try-on?topId=${fit.top.id}&bottomId=${fit.bottom.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-bone hover:bg-flame transition-colors"
                  >
                    <span>Try On This Look</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
