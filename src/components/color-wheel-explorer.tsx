"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Check,
  Palette,
  TrendingUp,
  Zap,
  Feather,
  Shield,
  Layers,
  CheckCircle2,
  Info,
  X,
  Shirt,
  Upload,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  ArrowLeftRight,
  RotateCcw,
} from "lucide-react";
import clsx from "clsx";
import { useWardrobe } from "@/context/wardrobe-context";
import type { GarmentCategory } from "@/lib/types";
import {
  hslOfHex,
  isNeutralHex,
  harmonyScore,
  relationName,
  nearestColorName,
  hueDistance,
} from "@/lib/colors";
import { safeHex } from "@/lib/recommendations";

export type FriendlyVibe = "contrast" | "soft" | "monochrome" | "neutral" | "creative";

interface VibeOption {
  id: FriendlyVibe;
  label: string;
  tagline: string;
  desc: string;
  icon: any;
  color: string;
}

const VIBE_OPTIONS: VibeOption[] = [
  {
    id: "contrast",
    label: "Bold Contrast",
    tagline: "Eye-catching pop",
    desc: "Pairs opposite colors on the wheel so both pieces stand out with crisp energy.",
    icon: Zap,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
  },
  {
    id: "soft",
    label: "Soft & Matching",
    tagline: "Calm & harmonious",
    desc: "Blends neighboring shades for an easy-going, cohesive aesthetic that feels effortless.",
    icon: Feather,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
  },
  {
    id: "monochrome",
    label: "Tonal Monochrome",
    tagline: "Clean & elevated",
    desc: "Uses shades from the exact same color family with varying light and dark tones.",
    icon: Layers,
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30",
  },
  {
    id: "neutral",
    label: "Classic Neutral",
    tagline: "Timeless & safe",
    desc: "Pairs your piece with essential blacks, whites, creams, or dark onyx trousers.",
    icon: Shield,
    color: "text-stone-500 bg-stone-500/10 border-stone-500/30",
  },
  {
    id: "creative",
    label: "Playful Triad",
    tagline: "Dynamic 3-way balance",
    desc: "Rich, expressive color balance connecting three complementary hue spectrums.",
    icon: Palette,
    color: "text-rose-500 bg-rose-500/10 border-rose-500/30",
  },
];

/* ───────────────────────── Wheel geometry ───────────────────────── */

const SEGMENTS = 12; // one slice per 30° of hue
const CX = 200;
const CY = 200;
const R_OUT = 158;
const R_IN = 102;
const R_BADGE = 180;
const R_MARK = (R_OUT + R_IN) / 2;

const SEGMENT_NAMES = [
  "Red", "Orange", "Yellow", "Lime", "Green", "Mint",
  "Cyan", "Azure", "Blue", "Violet", "Magenta", "Rose",
];

const segOf = (hue: number) => Math.round((((hue % 360) + 360) % 360) / 30) % SEGMENTS;

const pt = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)]; // 0° at top, clockwise
};

const segmentPath = (i: number) => {
  const a0 = i * 30 - 15 + 1.2;
  const a1 = i * 30 + 15 - 1.2;
  const [x1, y1] = pt(R_OUT, a0);
  const [x2, y2] = pt(R_OUT, a1);
  const [x3, y3] = pt(R_IN, a1);
  const [x4, y4] = pt(R_IN, a0);
  return `M${x1} ${y1}A${R_OUT} ${R_OUT} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${R_IN} ${R_IN} 0 0 0 ${x4} ${y4}Z`;
};

const isWearablePair = (catA: GarmentCategory, catB: GarmentCategory): boolean => {
  // Tops & outerwear pair strictly with Bottoms
  if ((catA === "tops" || catA === "outerwear") && catB === "bottoms") return true;
  if (catA === "bottoms" && (catB === "tops" || catB === "outerwear")) return true;

  // One-pieces / Dresses pair with shoes, accessories, or outerwear layers
  if (
    (catA === "one-pieces" || catA === "dresses") &&
    (catB === "shoes" || catB === "accessories" || catB === "outerwear")
  )
    return true;
  if (
    (catA === "shoes" || catA === "accessories" || catA === "outerwear") &&
    (catB === "one-pieces" || catB === "dresses")
  )
    return true;

  // Shoes & Accessories can pair with Tops or Bottoms
  if (
    (catA === "shoes" || catA === "accessories") &&
    (catB === "tops" || catB === "bottoms")
  )
    return true;
  if (
    (catA === "tops" || catA === "bottoms") &&
    (catB === "shoes" || catB === "accessories")
  )
    return true;

  return false;
};

const getTargetCategoryLabel = (anchorCat?: GarmentCategory): string => {
  if (!anchorCat) return "Bottoms";
  if (anchorCat === "tops" || anchorCat === "outerwear") return "Bottoms";
  if (anchorCat === "bottoms") return "Tops";
  if (anchorCat === "one-pieces" || anchorCat === "dresses") return "Layers & Accessories";
  return "Pieces";
};

export function ColorWheelExplorer() {
  const { garments } = useWardrobe();

  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(
    garments[0]?.id || null
  );
  const [activeVibe, setActiveVibe] = useState<FriendlyVibe>("contrast");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  // Wheel filter: a hue segment index, "neutral", or null (show everything)
  const [hueFilter, setHueFilter] = useState<number | "neutral" | null>(null);

  // Companion pairing filter: wearable outfit combos (tops with bottoms) vs all items
  const [pairFilter, setPairFilter] = useState<"wearable" | "all">("wearable");

  // Hover state for segment live label
  const [hoveredSeg, setHoveredSeg] = useState<number | null>(null);

  const [showTheoryGuide, setShowTheoryGuide] = useState(false);

  // Rack category filter
  const filteredRack = useMemo(() => {
    if (filterCategory === "all") return garments;
    return garments.filter((g) => g.category === filterCategory);
  }, [garments, filterCategory]);

  // Horizontal scroll controls for Step 1 rack
  const rackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = rackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const t = setTimeout(updateScrollButtons, 120);
    const handleResize = () => updateScrollButtons();
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", handleResize);
    };
  }, [updateScrollButtons, filteredRack]);

  const scrollRack = (direction: "left" | "right") => {
    const el = rackRef.current;
    if (!el) return;
    const scrollAmount = Math.max(260, Math.floor(el.clientWidth * 0.72));
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
    setTimeout(updateScrollButtons, 350);
  };

  const garmentNodes = useMemo(
    () =>
      garments.map((g) => {
        const hex = safeHex(g.colorHex, g.name);
        const hsl = hslOfHex(hex);
        const isNeutral = isNeutralHex(hex);
        return { garment: g, hex, hsl, isNeutral, seg: isNeutral ? -1 : segOf(hsl.h) };
      }),
    [garments]
  );

  const activeAnchor = useMemo(() => {
    if (!selectedGarmentId) return garmentNodes[0] || null;
    return garmentNodes.find((n) => n.garment.id === selectedGarmentId) || garmentNodes[0] || null;
  }, [selectedGarmentId, garmentNodes]);

  // Which hue slices work with the chosen piece for the chosen vibe
  const targetSegs = useMemo(() => {
    const set = new Set<number>();
    if (!activeAnchor || activeVibe === "neutral") return set;
    if (activeAnchor.isNeutral) {
      // Neutral anchors go with every hue
      for (let i = 0; i < SEGMENTS; i++) set.add(i);
      return set;
    }
    const h = activeAnchor.hsl.h;
    const hues =
      activeVibe === "contrast"
        ? [h + 180]
        : activeVibe === "soft"
          ? [h - 30, h + 30]
          : activeVibe === "monochrome"
            ? [h]
            : [h + 120, h + 240];
    hues.forEach((x) => set.add(segOf(x)));
    return set;
  }, [activeAnchor, activeVibe]);

  // Evaluated matches with Wearable Pair Priority
  const matchResults = useMemo(() => {
    if (!activeAnchor) return [];
    return garmentNodes
      .filter((n) => n.garment.id !== activeAnchor.garment.id)
      .map((node) => {
        const score = harmonyScore(activeAnchor.hex, node.hex);
        const relation = relationName(activeAnchor.hex, node.hex);
        const hDist = hueDistance(activeAnchor.hsl.h, node.hsl.h);
        const wearable = isWearablePair(activeAnchor.garment.category, node.garment.category);

        let matchesVibe = false;
        if (activeVibe === "neutral") matchesVibe = node.isNeutral;
        else if (activeVibe === "monochrome") matchesVibe = hDist <= 24;
        else if (activeVibe === "contrast") matchesVibe = hDist >= 140;
        else if (activeVibe === "soft") matchesVibe = hDist <= 45 && hDist >= 12;
        else if (activeVibe === "creative") matchesVibe = Math.abs(hDist - 120) <= 30;

        return { node, score, relation, matchesVibe, wearable };
      })
      .sort((a, b) => {
        if (a.matchesVibe !== b.matchesVibe) return a.matchesVibe ? -1 : 1;
        // Prioritize wearable combinations (e.g. Tops + Bottoms) over same-category pieces
        if (a.wearable !== b.wearable) return a.wearable ? -1 : 1;
        return b.score - a.score;
      });
  }, [activeAnchor, garmentNodes, activeVibe]);

  // Selected pairing preview (strictly enforces wearable pairs e.g. Bottoms for Tops)
  const activeMatch = useMemo(() => {
    // 1. If user explicitly clicked a match card, check if it fits the active pairing filter
    if (selectedMatchId) {
      const found = matchResults.find((m) => m.node.garment.id === selectedMatchId);
      if (found) {
        if (pairFilter !== "wearable" || found.wearable) return found;
      }
    }

    // 2. In wearable mode: strictly pick the best matching opposite category item (e.g. Bottoms for Tops)
    if (pairFilter === "wearable") {
      const bestWearableVibe = matchResults.find((m) => m.wearable && m.matchesVibe);
      if (bestWearableVibe) return bestWearableVibe;

      const anyWearable = matchResults.find((m) => m.wearable);
      if (anyWearable) return anyWearable;

      return null;
    }

    // 3. In "all" mode: pick vibe match or first match
    return (
      matchResults.find((m) => m.matchesVibe) ||
      matchResults[0] ||
      null
    );
  }, [selectedMatchId, matchResults, pairFilter]);

  // Filtered match list (narrowed by slice click and wearable toggle)
  const visibleMatches = useMemo(() => {
    let list = matchResults;

    if (pairFilter === "wearable") {
      // STRICT FILTER: Only show true wearable pairs (Tops match with Bottoms, Bottoms match with Tops)
      list = list.filter((m) => m.wearable);
    }

    if (hueFilter === null) return list;
    if (hueFilter === "neutral") return list.filter((m) => m.node.isNeutral);
    return list.filter((m) => !m.node.isNeutral && m.node.seg === hueFilter);
  }, [matchResults, hueFilter, pairFilter]);

  // Closet pieces per slice (excluding the chosen piece)
  const segCounts = useMemo(() => {
    const counts = new Array(SEGMENTS).fill(0) as number[];
    let neutral = 0;
    // In wearable mode, the wheel slices and badges count the pieces you can actually wear with this item
    const pool = pairFilter === "wearable" ? matchResults.filter((m) => m.wearable) : matchResults;
    pool.forEach(({ node }) => {
      if (node.isNeutral) neutral++;
      else counts[node.seg]++;
    });
    return { counts, neutral };
  }, [matchResults, pairFilter]);

  const stylistTip = useMemo(() => {
    if (!activeAnchor || !activeMatch) return "";
    const a = activeAnchor.garment.color || nearestColorName(activeAnchor.hex);
    const m = activeMatch.node.garment.color || nearestColorName(activeMatch.node.hex);
    switch (activeVibe) {
      case "contrast":
        return `${a} and ${m} sit opposite each other on the color wheel, creating crisp, intentional contrast that highlights both garments.`;
      case "soft":
        return `${a} and ${m} are neighbors on the color spectrum, blending naturally together for a cohesive, relaxed outfit.`;
      case "monochrome":
        return `${a} and ${m} come from the same color family. Distinct light and dark tones keep the layered look clean and elevated.`;
      case "neutral":
        return `${a} takes center stage while ${m} provides a classic, versatile foundation.`;
      default:
        return `${a} and ${m} hit a balanced triadic harmony on the wheel, delivering dynamic visual energy.`;
    }
  }, [activeAnchor, activeMatch, activeVibe]);

  // Try-on Deep Link URL: accurately maps slots based on categories
  const tryOnHref = useMemo(() => {
    if (!activeAnchor || !activeMatch) return "/try-on";
    const g1 = activeAnchor.garment;
    const g2 = activeMatch.node.garment;

    if (g1.category === "tops" && g2.category === "bottoms") {
      return `/try-on?topId=${g1.id}&bottomId=${g2.id}`;
    }
    if (g1.category === "bottoms" && g2.category === "tops") {
      return `/try-on?topId=${g2.id}&bottomId=${g1.id}`;
    }
    if (g1.category === "tops" && g2.category !== "bottoms") {
      return `/try-on?topId=${g1.id}`;
    }
    if (g2.category === "tops" && g1.category !== "bottoms") {
      return `/try-on?topId=${g2.id}`;
    }
    if (g1.category === "bottoms") {
      return `/try-on?bottomId=${g1.id}`;
    }
    if (g1.category === "one-pieces" || g2.category === "one-pieces") {
      const dress = g1.category === "one-pieces" ? g1 : g2;
      return `/try-on?garmentId=${dress.id}`;
    }
    return `/try-on?garmentId=${g1.id}`;
  }, [activeAnchor, activeMatch]);

  const targetCatLabel = getTargetCategoryLabel(activeAnchor?.garment.category);
  const vibe = VIBE_OPTIONS.find((v) => v.id === activeVibe)!;
  const anchorSeg = activeAnchor && !activeAnchor.isNeutral ? activeAnchor.seg : -1;
  const matchSeg = activeMatch && !activeMatch.node.isNeutral ? activeMatch.node.seg : -1;
  const neutralVibe = activeVibe === "neutral";
  const anchorIsNeutral = !!activeAnchor?.isNeutral;

  // Harmony chord / polygon through the inside of the ring
  const shapePoints = useMemo(() => {
    if (anchorSeg < 0 || anchorIsNeutral) return [] as [number, number][];
    const segs = [anchorSeg, ...Array.from(targetSegs).filter((s) => s !== anchorSeg)];
    if (segs.length < 2 || segs.length > 3) return [];
    return segs.map((s) => pt(R_IN - 6, s * 30));
  }, [anchorSeg, targetSegs, anchorIsNeutral]);

  const pickAnchor = (id: string) => {
    setSelectedGarmentId(id);
    setSelectedMatchId(null);
    setHueFilter(null);
  };

  const pickRandomAnchor = () => {
    if (garments.length === 0) return;
    const pool = filteredRack.length > 0 ? filteredRack : garments;
    const randomIndex = Math.floor(Math.random() * pool.length);
    pickAnchor(pool[randomIndex].id);
  };

  const swapAnchorAndMatch = () => {
    if (activeMatch) {
      pickAnchor(activeMatch.node.garment.id);
    }
  };

  const filterLabel =
    hueFilter === null
      ? null
      : hueFilter === "neutral"
        ? "Neutrals"
        : SEGMENT_NAMES[hueFilter];

  // Empty Wardrobe State
  if (garments.length === 0) {
    return (
      <div className="rounded-3xl border border-line bg-paper p-12 text-center max-w-lg mx-auto space-y-4 shadow-sm">
        <div className="h-14 w-14 rounded-2xl bg-bone-deep flex items-center justify-center mx-auto text-ink-soft border border-line">
          <Palette className="h-7 w-7 text-flame" />
        </div>
        <h2 className="font-display text-xl font-bold text-ink">Your Wardrobe is Empty</h2>
        <p className="text-xs text-ink-soft leading-relaxed">
          Upload your garments first to visualize their color spectra, discover Flattering color harmonies, and preview outfit combinations.
        </p>
        <Link
          href="/wardrobe"
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-xs font-semibold text-bone hover:bg-flame transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          <span>Add Clothes in Wardrobe</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── STEP 1: PICK A CLOTHING PIECE ── */}
      <div className="rounded-3xl border border-line bg-paper p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-flame text-white font-mono text-xs font-bold">
              1
            </span>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-ink">
                Choose the piece you want to wear today
              </h2>
              <p className="text-xs text-ink-soft">
                Pick a Top to find matching Bottoms, or pick a Bottom to find matching Tops
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {["all", "tops", "bottoms", "one-pieces", "shoes"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={clsx(
                    "rounded-full px-3 py-1 text-xs font-semibold capitalize transition-all cursor-pointer whitespace-nowrap",
                    filterCategory === cat
                      ? "bg-ink text-bone"
                      : "bg-bone text-ink-soft hover:bg-bone-deep hover:text-ink"
                  )}
                >
                  {cat === "all" ? "All Pieces" : cat}
                </button>
              ))}
            </div>

            {/* Surprise Me & Header Arrow Navigation */}
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-line shrink-0">
              <button
                type="button"
                onClick={pickRandomAnchor}
                className="inline-flex items-center gap-1.5 rounded-full border border-flame/30 bg-flame/10 px-2.5 py-1 text-xs font-semibold text-flame hover:bg-flame hover:text-white transition-all cursor-pointer shadow-2xs"
                title="Shuffle: Pick a random piece from your closet"
              >
                <Shuffle className="h-3 w-3" />
                <span className="hidden sm:inline">Surprise Me</span>
              </button>

              <button
                type="button"
                onClick={() => scrollRack("left")}
                disabled={!canScrollLeft}
                aria-label="Scroll rack left"
                title="Scroll left"
                className={clsx(
                  "flex h-7 w-7 items-center justify-center rounded-full border transition-all",
                  canScrollLeft
                    ? "bg-bone text-ink border-line hover:bg-bone-deep hover:text-flame cursor-pointer shadow-2xs"
                    : "bg-bone/40 text-ink/20 border-line/30 cursor-not-allowed opacity-50"
                )}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollRack("right")}
                disabled={!canScrollRight}
                aria-label="Scroll rack right"
                title="Scroll right"
                className={clsx(
                  "flex h-7 w-7 items-center justify-center rounded-full border transition-all",
                  canScrollRight
                    ? "bg-bone text-ink border-line hover:bg-bone-deep hover:text-flame cursor-pointer shadow-2xs"
                    : "bg-bone/40 text-ink/20 border-line/30 cursor-not-allowed opacity-50"
                )}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Clothing Rack Carousel with Left/Right Arrows */}
        <div className="relative group/rack">
          {/* Floating Left Arrow */}
          {canScrollLeft && (
            <>
              <button
                type="button"
                onClick={() => scrollRack("left")}
                aria-label="Scroll clothes left"
                title="Scroll left"
                className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-paper/95 backdrop-blur-md border border-line shadow-lg text-ink hover:bg-bone hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <div className="pointer-events-none absolute left-0 top-0 bottom-2 w-14 bg-gradient-to-r from-paper via-paper/85 to-transparent z-10 rounded-l-2xl" />
            </>
          )}

          <div
            ref={rackRef}
            onScroll={updateScrollButtons}
            className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 no-scrollbar scroll-smooth"
          >
            {filteredRack.map((g) => {
              const isSelected = activeAnchor?.garment.id === g.id;
              const hex = safeHex(g.colorHex, g.name);
              return (
                <button
                  key={g.id}
                  onClick={() => pickAnchor(g.id)}
                  className={clsx(
                    "group relative shrink-0 flex flex-col items-center p-2.5 rounded-2xl border text-center transition-all duration-200 cursor-pointer w-28 sm:w-32",
                    isSelected
                      ? "border-flame bg-flame/5 ring-2 ring-flame shadow-md"
                      : "border-line bg-bone hover:border-flame/40 hover:bg-bone-deep"
                  )}
                >
                  <div className="relative h-20 w-20 rounded-xl overflow-hidden bg-bone-deep border border-line mb-2 flex items-center justify-center">
                    <img
                      src={g.image}
                      alt={g.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute bottom-1 right-1 flex items-center -space-x-1">
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-black/20 z-10 shadow-xs"
                        style={{ backgroundColor: hex }}
                      />
                      {g.secondaryColorHex && (
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/20 shadow-xs"
                          style={{ backgroundColor: g.secondaryColorHex }}
                        />
                      )}
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 left-1 bg-flame text-white rounded-full p-0.5 shadow-xs">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-ink truncate w-full text-center leading-tight">
                    {g.name}
                  </span>
                  <span className="text-[10px] text-ink-soft capitalize mt-0.5 truncate w-full">
                    {g.color || nearestColorName(hex)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Floating Right Arrow */}
          {canScrollRight && (
            <>
              <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-14 bg-gradient-to-l from-paper via-paper/85 to-transparent z-10 rounded-r-2xl" />
              <button
                type="button"
                onClick={() => scrollRack("right")}
                aria-label="Scroll clothes right"
                title="Scroll right"
                className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-paper/95 backdrop-blur-md border border-line shadow-lg text-ink hover:bg-bone hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── 2-COLUMN UNIFIED STUDIO GRID: VIBE + WHEEL (Left) | OUTFIT MATCH & CLOSET (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: COLOR HARMONY ENGINE (Vibe Selector + Color Wheel) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-3xl border border-line bg-paper p-5 sm:p-6 shadow-sm space-y-4">
            {/* Engine Header */}
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-flame text-white font-mono text-xs font-bold">
                  2
                </span>
                <h3 className="font-display text-base font-bold text-ink">
                  Styling Mood &amp; Wheel
                </h3>
              </div>
              <span className="text-[10px] font-mono font-semibold text-ink-soft bg-bone px-2 py-0.5 rounded-full border border-line">
                Tap slice to filter
              </span>
            </div>

            {/* Compact Vibe Selector Pill Strip */}
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-1 p-1 bg-bone rounded-2xl border border-line">
                {VIBE_OPTIONS.map((v) => {
                  const Icon = v.icon;
                  const isSelected = activeVibe === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setActiveVibe(v.id);
                        setSelectedMatchId(null);
                        setHueFilter(null);
                      }}
                      className={clsx(
                        "flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all cursor-pointer",
                        isSelected
                          ? "bg-paper text-ink shadow-2xs border border-line font-bold"
                          : "text-ink-soft hover:text-ink hover:bg-bone-deep"
                      )}
                      title={`${v.label} - ${v.desc}`}
                    >
                      <Icon className={clsx("h-3.5 w-3.5 mb-1", isSelected ? "text-flame" : "text-ink-soft")} />
                      <span className="text-[10px] sm:text-[11px] font-semibold leading-tight truncate w-full">
                        {v.label.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic 1-line Vibe Explainer */}
              <div className="flex items-center justify-between text-[11px] px-1 text-ink-soft leading-tight">
                <span className="truncate">
                  <strong className="text-ink font-semibold">{vibe.label}:</strong> {vibe.desc}
                </span>
                <span className="text-flame font-mono text-[10px] font-bold uppercase shrink-0 ml-2">
                  {vibe.tagline}
                </span>
              </div>
            </div>

            {/* The SVG Color Wheel */}
            <div className="mx-auto w-full max-w-[340px]">
              <svg
                viewBox="0 0 400 400"
                className="w-full h-auto select-none overflow-visible"
                role="img"
                aria-label="Color wheel showing which hues match the chosen piece"
              >
                <defs>
                  {/* Circular clip path for the center garment photo */}
                  <clipPath id="center-photo-clip">
                    <circle cx={CX} cy={CY} r="64" />
                  </clipPath>
                </defs>

                {/* Hue slices */}
                {Array.from({ length: SEGMENTS }, (_, i) => {
                  const isTarget = targetSegs.has(i);
                  const isAnchorSeg = i === anchorSeg;
                  const isMatchSlice = i === matchSeg;
                  const lit = isTarget || isAnchorSeg;
                  const isFiltered = hueFilter === i;
                  const dim = !lit && !(anchorIsNeutral && !neutralVibe);
                  return (
                    <path
                      key={i}
                      d={segmentPath(i)}
                      fill={`hsl(${i * 30} 72% 54%)`}
                      opacity={dim ? 0.2 : 1}
                      stroke={isFiltered ? "var(--color-ink, #111)" : isMatchSlice ? "#059669" : "none"}
                      strokeWidth={isFiltered ? 3.5 : isMatchSlice ? 2.5 : 0}
                      className="cursor-pointer transition-opacity duration-200 hover:opacity-100"
                      onClick={() => setHueFilter((p) => (p === i ? null : i))}
                      onMouseEnter={() => setHoveredSeg(i)}
                      onMouseLeave={() => setHoveredSeg(null)}
                    >
                      <title>{`${SEGMENT_NAMES[i]} · ${segCounts.counts[i]} piece${segCounts.counts[i] === 1 ? "" : "s"}`}</title>
                    </path>
                  );
                })}

                {/* Harmony chord/polygon through the middle */}
                {shapePoints.length === 2 && (
                  <line
                    x1={shapePoints[0][0]}
                    y1={shapePoints[0][1]}
                    x2={shapePoints[1][0]}
                    y2={shapePoints[1][1]}
                    stroke="currentColor"
                    className="text-ink/30"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                    pointerEvents="none"
                  />
                )}
                {shapePoints.length === 3 && (
                  <polygon
                    points={shapePoints.map((p) => p.join(",")).join(" ")}
                    fill="none"
                    stroke="currentColor"
                    className="text-ink/30"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                    pointerEvents="none"
                  />
                )}

                {/* Target checkmark markers on matching slices */}
                {Array.from(targetSegs).map((i) => {
                  if (anchorIsNeutral || neutralVibe || i === anchorSeg || i === matchSeg) return null;
                  const [x, y] = pt(R_MARK, i * 30);
                  return (
                    <g key={`t${i}`} pointerEvents="none">
                      <circle cx={x} cy={y} r="10" fill="#fff" className="shadow-xs" />
                      <path
                        d={`M${x - 4} ${y} l2.8 3 l5.2 -5.8`}
                        fill="none"
                        stroke="#059669"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                })}

                {/* Active Match Piece Indicator on the Wheel */}
                {matchSeg >= 0 && matchSeg !== anchorSeg && (() => {
                  const [x, y] = pt(R_MARK, matchSeg * 30);
                  return (
                    <g key="match-indicator" pointerEvents="none">
                      <circle
                        cx={x}
                        cy={y}
                        r="14"
                        fill="rgba(5, 150, 105, 0.25)"
                        stroke="#059669"
                        strokeWidth="2.5"
                        className="animate-pulse"
                      />
                      <circle
                        cx={x}
                        cy={y}
                        r="8"
                        fill={activeMatch!.node.hex}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                    </g>
                  );
                })()}

                {/* Anchor piece dot on its slice */}
                {anchorSeg >= 0 && (() => {
                  const [x, y] = pt(R_MARK, anchorSeg * 30);
                  return (
                    <g key="anchor-indicator" pointerEvents="none">
                      <circle cx={x} cy={y} r="12" fill="#fff" className="shadow-xs" />
                      <circle
                        cx={x}
                        cy={y}
                        r="7"
                        fill={activeAnchor!.hex}
                        stroke="var(--color-ink, #111)"
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                })()}

                {/* Closet count badges outside the ring */}
                {segCounts.counts.map((n, i) => {
                  if (n === 0) return null;
                  const [x, y] = pt(R_BADGE, i * 30);
                  const isFiltered = hueFilter === i;
                  return (
                    <g
                      key={`b${i}`}
                      className="cursor-pointer"
                      onClick={() => setHueFilter((p) => (p === i ? null : i))}
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r="12"
                        className={isFiltered ? "fill-ink" : "fill-bone"}
                        stroke="currentColor"
                        strokeWidth="1"
                        style={{ color: "rgba(0,0,0,0.18)" }}
                      />
                      <text
                        x={x}
                        y={y + 4}
                        textAnchor="middle"
                        className={clsx("text-[12px] font-bold", isFiltered ? "fill-bone" : "fill-ink")}
                        pointerEvents="none"
                      >
                        {n}
                      </text>
                    </g>
                  );
                })}

                {/* Center Hub: The Chosen Garment Photo & Color Swatch */}
                {activeAnchor && (
                  <g pointerEvents="none">
                    {/* Outer border ring */}
                    <circle
                      cx={CX}
                      cy={CY}
                      r="80"
                      fill="var(--color-paper, #ffffff)"
                      stroke={activeAnchor.hex}
                      strokeWidth="4"
                      className="shadow-sm"
                    />

                    {/* Garment Photo or Fallback Color */}
                    {activeAnchor.garment.image ? (
                      <image
                        href={activeAnchor.garment.image}
                        x={CX - 64}
                        y={CY - 64}
                        width={128}
                        height={128}
                        clipPath="url(#center-photo-clip)"
                        preserveAspectRatio="xMidYMid slice"
                      />
                    ) : (
                      <circle cx={CX} cy={CY} r="64" fill={activeAnchor.hex} />
                    )}

                    {/* Frosted tag badge over the bottom of the photo */}
                    <rect
                      x={CX - 48}
                      y={CY + 36}
                      width="96"
                      height="22"
                      rx="11"
                      fill="rgba(17, 17, 17, 0.85)"
                      stroke="rgba(255, 255, 255, 0.2)"
                      strokeWidth="1"
                    />
                    <circle
                      cx={CX - 34}
                      cy={CY + 47}
                      r="4.5"
                      fill={activeAnchor.hex}
                      stroke="#ffffff"
                      strokeWidth="1"
                    />
                    <text
                      x={CX + 8}
                      y={CY + 51}
                      textAnchor="middle"
                      className="text-[9px] font-mono font-bold fill-white uppercase tracking-wider"
                    >
                      {(activeAnchor.garment.color || nearestColorName(activeAnchor.hex)).slice(0, 10)}
                    </text>
                  </g>
                )}
              </svg>
            </div>

            {/* Hovered segment indicator bar */}
            <div className="h-5 flex items-center justify-center text-[11px] text-ink-soft">
              {hoveredSeg !== null && (
                <span className="inline-flex items-center gap-1.5 font-medium animate-fadeIn">
                  <span
                    className="h-2.5 w-2.5 rounded-full inline-block"
                    style={{ backgroundColor: `hsl(${hoveredSeg * 30} 72% 54%)` }}
                  />
                  <span>
                    {SEGMENT_NAMES[hoveredSeg]} Family · {segCounts.counts[hoveredSeg]}{" "}
                    {pairFilter === "wearable"
                      ? targetCatLabel.toLowerCase()
                      : "piece" + (segCounts.counts[hoveredSeg] === 1 ? "" : "s")}{" "}
                    in closet
                  </span>
                </span>
              )}
            </div>

            {/* Neutrals chip */}
            <div className="mt-2 flex items-center justify-center">
              <button
                onClick={() => setHueFilter((p) => (p === "neutral" ? null : "neutral"))}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                  hueFilter === "neutral"
                    ? "border-ink bg-ink text-bone"
                    : neutralVibe
                      ? "border-emerald-500 bg-emerald-500/10 text-ink ring-1 ring-emerald-500/30"
                      : "border-line bg-bone text-ink hover:bg-bone-deep"
                )}
              >
                <span className="flex -space-x-1">
                  {["#111111", "#8a8a85", "#f4f1ea"].map((c) => (
                    <span
                      key={c}
                      className="h-3.5 w-3.5 rounded-full border border-black/20"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
                <span>
                  Neutrals · {segCounts.neutral}{" "}
                  {pairFilter === "wearable" ? targetCatLabel.toLowerCase() : ""}
                </span>
                {neutralVibe && <Check className="h-3.5 w-3.5 text-emerald-600" />}
              </button>
            </div>

            {/* Clean Legend */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-3.5 w-3.5 rounded-full border-2 border-ink"
                  style={{ backgroundColor: activeAnchor?.hex }}
                />
                Your piece
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3]" />
                Harmonizing hue
              </span>
              {activeMatch && !activeMatch.node.isNeutral && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-3.5 w-3.5 rounded-full ring-2 ring-emerald-600"
                    style={{ backgroundColor: activeMatch.node.hex }}
                  />
                  Best match
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-full bg-bone-deep border border-line text-[9px] font-bold text-ink flex items-center justify-center">
                  #
                </span>
                Pieces you own
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: PREVIEW & MATCHES */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Featured Outfit Pairing Card */}
          {activeAnchor && activeMatch && (
            <div className="rounded-3xl border border-line bg-paper p-5 sm:p-6 shadow-md space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-line">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>{activeMatch.score}% harmony match</span>
                  <span>·</span>
                  <span>{activeMatch.relation}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={swapAnchorAndMatch}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bone px-2.5 py-1 text-xs font-semibold text-ink hover:bg-bone-deep hover:text-flame transition-colors cursor-pointer shadow-2xs"
                    title="Make this match your new anchor piece to see what goes with it"
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                    <span>Swap Anchor</span>
                  </button>
                  <span className="text-xs text-ink-soft hidden sm:inline">Outfit preview</span>
                </div>
              </div>

              {/* Side-by-side Top & Bottom Cards */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    n: activeAnchor,
                    label: `Your piece (${activeAnchor.garment.category})`,
                    tone: "border-line bg-bone",
                    lc: "text-flame",
                  },
                  {
                    n: activeMatch.node,
                    label: `Matching ${activeMatch.wearable ? targetCatLabel.slice(0, -1).toLowerCase() : "piece"} (${activeMatch.node.garment.category})`,
                    tone: "border-emerald-500/30 bg-emerald-500/5",
                    lc: "text-emerald-700 dark:text-emerald-300",
                  },
                ].map(({ n, label, tone, lc }) => (
                  <div
                    key={label}
                    className={clsx("p-3.5 rounded-2xl border flex flex-col items-center text-center", tone)}
                  >
                    <div className="relative aspect-square w-24 rounded-xl overflow-hidden bg-bone-deep border border-line mb-2 shadow-xs">
                      <img
                        src={n.garment.image}
                        alt={n.garment.name}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute bottom-1 right-1 flex items-center -space-x-1">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/20 z-10 shadow-xs"
                          style={{ backgroundColor: n.hex }}
                        />
                        {n.garment.secondaryColorHex && (
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-black/20 shadow-xs"
                            style={{ backgroundColor: n.garment.secondaryColorHex }}
                          />
                        )}
                      </div>
                    </div>
                    <span className={clsx("text-[11px] font-bold uppercase tracking-wider", lc)}>
                      {label}
                    </span>
                    <p className="text-xs font-bold text-ink truncate w-full mt-0.5">
                      {n.garment.name}
                    </p>
                    <p className="text-[11px] text-ink-soft capitalize">
                      {n.garment.color || nearestColorName(n.hex)} · {n.garment.category}
                    </p>
                  </div>
                ))}
              </div>

              {/* Stylist Explanation */}
              <div className="p-3.5 rounded-2xl border border-line bg-bone text-xs leading-relaxed text-ink-soft">
                {stylistTip}
              </div>

              {/* Deep-link to Try-on Studio */}
              <Link
                href={tryOnHref}
                className="w-full inline-flex items-center justify-center gap-2.5 rounded-full bg-ink px-6 py-3 text-sm font-bold text-bone hover:bg-flame transition-colors shadow-xs"
              >
                <Sparkles className="h-4 w-4" />
                <span>Try this look on your model</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {activeAnchor && !activeMatch && (
            <div className="rounded-3xl border border-line bg-paper p-6 text-center space-y-3 shadow-xs">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-bone text-ink-soft mx-auto">
                <Sparkles className="h-6 w-6 text-flame" />
              </div>
              <h3 className="font-display text-base font-bold text-ink">
                No matching {targetCatLabel.toLowerCase()} found
              </h3>
              <p className="text-xs text-ink-soft max-w-sm mx-auto">
                You don’t currently have any {targetCatLabel.toLowerCase()} in your wardrobe to pair with this {activeAnchor.garment.category.replace(/s$/, "")}. Try switching to &ldquo;All items&rdquo; or add new pieces in your closet!
              </p>
            </div>
          )}

          {/* More Matches List */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-ink">
                {filterLabel
                  ? `${filterLabel} ${pairFilter === "wearable" ? targetCatLabel.toLowerCase() : "pieces"} in your closet`
                  : `Matching ${pairFilter === "wearable" ? targetCatLabel.toLowerCase() : "pieces"} in your closet`}
              </h3>

              <div className="flex items-center gap-2">
                {/* Wearable vs All toggle */}
                <div className="inline-flex rounded-full border border-line bg-bone p-0.5 text-xs">
                  <button
                    onClick={() => setPairFilter("wearable")}
                    className={clsx(
                      "px-3 py-1 rounded-full font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                      pairFilter === "wearable"
                        ? "bg-ink text-bone shadow-2xs"
                        : "text-ink-soft hover:text-ink"
                    )}
                  >
                    {pairFilter === "wearable" && <Check className="h-3 w-3" />}
                    <span>Wearable pairs ({targetCatLabel})</span>
                  </button>
                  <button
                    onClick={() => setPairFilter("all")}
                    className={clsx(
                      "px-3 py-1 rounded-full font-semibold transition-all cursor-pointer",
                      pairFilter === "all"
                        ? "bg-ink text-bone shadow-2xs"
                        : "text-ink-soft hover:text-ink"
                    )}
                  >
                    All items
                  </button>
                </div>

                {filterLabel && (
                  <button
                    onClick={() => setHueFilter(null)}
                    className="inline-flex items-center gap-1 rounded-full bg-bone px-2.5 py-1 text-xs font-semibold text-ink hover:bg-bone-deep cursor-pointer"
                  >
                    Show all <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {visibleMatches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-6 text-center text-xs text-ink-soft space-y-2">
                <p>
                  You don’t own any matching{" "}
                  <span className="font-semibold text-ink">
                    {pairFilter === "wearable" ? targetCatLabel.toLowerCase() : "pieces"}
                  </span>{" "}
                  in {filterLabel ? `the ${filterLabel} color spectrum` : "this category"} yet.
                </p>
                {hueFilter !== null && (
                  <button
                    onClick={() => setHueFilter(null)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-bone border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-bone-deep cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>View all {pairFilter === "wearable" ? targetCatLabel.toLowerCase() : "colors"}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {visibleMatches.map(({ node, score, relation, matchesVibe }) => {
                  const isSelected = activeMatch?.node.garment.id === node.garment.id;
                  return (
                    <button
                      key={node.garment.id}
                      onClick={() => setSelectedMatchId(node.garment.id)}
                      className={clsx(
                        "flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer",
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40"
                          : matchesVibe
                            ? "border-emerald-500/30 bg-paper hover:bg-emerald-500/5"
                            : "border-line bg-paper hover:bg-bone opacity-70"
                      )}
                    >
                      <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-bone-deep border border-line shrink-0">
                        <img
                          src={node.garment.image}
                          alt={node.garment.name}
                          className="h-full w-full object-cover"
                        />
                        <div
                          className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-black/20"
                          style={{ backgroundColor: node.hex }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-ink truncate">{node.garment.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-ink-soft">
                          <span className="capitalize">{node.garment.category}</span>
                          <span>·</span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {score}% {relation}
                          </span>
                        </div>
                      </div>
                      {matchesVibe && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── QUICK COLOR GUIDE ── */}
      <div className="rounded-3xl border border-line bg-paper p-5 sm:p-6 shadow-xs">
        <button
          onClick={() => setShowTheoryGuide(!showTheoryGuide)}
          className="flex items-center justify-between w-full text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-flame" />
            <span className="font-display text-sm font-bold text-ink">
              How color matching works (the 60-30-10 rule)
            </span>
          </div>
          <span className="text-xs text-flame font-semibold">
            {showTheoryGuide ? "Hide" : "Read more"}
          </span>
        </button>

        {showTheoryGuide && (
          <div className="mt-4 pt-4 border-t border-line grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-ink-soft leading-relaxed">
            <div>
              <p className="font-bold text-ink mb-1">60% base</p>
              <p>
                Usually trousers, a coat, or a jacket. Stick to neutrals (black, navy, charcoal, stone) or soft muted tones that give a steady canvas.
              </p>
            </div>
            <div>
              <p className="font-bold text-ink mb-1">30% secondary</p>
              <p>
                Your shirt, knit, or sweater. This piece sets the vibe: bold contrast pop or soft tone-on-tone cohesion.
              </p>
            </div>
            <div>
              <p className="font-bold text-ink mb-1">10% accent</p>
              <p>
                Shoes, scarves, watches, or accessories. Add a complementary or triadic color pop for deliberate personality.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
