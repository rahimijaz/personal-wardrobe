"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers,
  Heart,
  Trash2,
  Sparkles,
  Download,
  Calendar,
  X,
  ExternalLink,
  Plus,
} from "lucide-react";
import clsx from "clsx";
import { useWardrobe } from "@/context/wardrobe-context";
import type { Outfit } from "@/lib/types";
import { LookbookModal } from "@/components/lookbook-modal";

export default function OutfitsPage() {
  const {
    outfits,
    isLoadingOutfits,
    toggleFavoriteOutfit,
    deleteOutfit,
  } = useWardrobe();

  const [selectedOutfit, setSelectedOutfit] = useState<Outfit | null>(null);
  const [lookbookOutfit, setLookbookOutfit] = useState<Outfit | null>(null);
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (selectedOutfit) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedOutfit]);

  const favoritesCount = outfits.filter((o) => o.favorite).length;
  const displayedOutfits = filter === "favorites" ? outfits.filter((o) => o.favorite) : outfits;

  return (
    <div className="flex-1 p-6 sm:p-8 md:p-10 max-w-7xl mx-auto w-full page-enter">
      {/* Page Header with Favorites Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            My Outfits
          </h1>
          <p className="text-sm text-ink-soft mt-1">
            Gallery of your styled virtual try-on looks and personal fits
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View All vs Favorites Filter Buttons */}
          <div className="inline-flex items-center rounded-full border border-line bg-bone p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                filter === "all"
                  ? "bg-ink text-bone shadow-sm"
                  : "text-ink-soft hover:text-ink"
              )}
            >
              <span>All Looks</span>
              <span
                className={clsx(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                  filter === "all" ? "bg-bone/20 text-bone" : "bg-bone-deep text-ink-muted"
                )}
              >
                {outfits.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilter("favorites")}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                filter === "favorites"
                  ? "bg-flame text-white shadow-sm"
                  : "text-ink-soft hover:text-ink"
              )}
            >
              <Heart
                className={clsx(
                  "h-3.5 w-3.5",
                  filter === "favorites" ? "fill-white text-white" : "fill-flame text-flame"
                )}
              />
              <span>Favorites</span>
              {favoritesCount > 0 && (
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold",
                    filter === "favorites" ? "bg-white/25 text-white" : "bg-flame/15 text-flame"
                  )}
                >
                  {favoritesCount}
                </span>
              )}
            </button>
          </div>

          <Link
            href="/try-on"
            className="btn-primary inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bone hover:bg-flame transition-colors shadow-md shrink-0"
          >
            <Sparkles className="h-4 w-4 text-flame" />
            <span className="hidden sm:inline">New Try-On Look</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>
      </div>

      {isLoadingOutfits ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex flex-col overflow-hidden rounded-3xl border border-line bg-paper">
              <div className="aspect-[2/3] animate-shimmer" />
              <div className="p-4 space-y-2 border-t border-line">
                <div className="h-3.5 rounded animate-shimmer" />
                <div className="h-2.5 w-1/2 rounded animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : outfits.length === 0 ? (
        /* Empty Outfits State */
        <div className="rounded-3xl border border-line bg-paper p-12 text-center max-w-lg mx-auto my-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-bone-deep text-ink-soft mb-4">
            <Layers className="h-7 w-7" />
          </div>
          <h3 className="font-display text-xl font-bold text-ink">
            No saved outfits yet
          </h3>
          <p className="mt-2 text-sm text-ink-soft leading-relaxed">
            Generate your first virtual try-on look and save it to your outfit archive.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/try-on"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-xs font-semibold text-bone hover:bg-flame transition-colors shadow-md"
            >
              <Sparkles className="h-4 w-4 text-flame" />
              <span>Create Your First Look</span>
            </Link>
          </div>
        </div>
      ) : displayedOutfits.length === 0 ? (
        /* Empty Favorites State */
        <div className="rounded-3xl border border-line bg-paper p-12 text-center max-w-lg mx-auto my-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-flame/10 text-flame mb-4 border border-flame/20">
            <Heart className="h-7 w-7 fill-flame" />
          </div>
          <h3 className="font-display text-xl font-bold text-ink">
            No favorite outfits yet
          </h3>
          <p className="mt-2 text-sm text-ink-soft leading-relaxed">
            Tap the heart icon on any outfit card to save your favorite styling looks here.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-xs font-semibold text-bone hover:bg-flame transition-colors shadow-md cursor-pointer"
            >
              <span>View All Looks</span>
            </button>
          </div>
        </div>
      ) : (
        /* Outfits Gallery Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedOutfits.map((outfit) => (
            <div
              key={outfit.id}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-paper shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            >
              {/* Card Header: Date & Favorite outside photo so face is 100% unobstructed */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-paper border-b border-line">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-ink-soft">
                  <Calendar className="h-3 w-3 text-ink-muted" />
                  {new Date(outfit.createdAt).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavoriteOutfit(outfit.id);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-bone transition-transform hover:scale-110 cursor-pointer"
                  title={outfit.favorite ? "Unfavorite" : "Favorite"}
                >
                  <Heart
                    className={clsx(
                      "h-4 w-4 transition-colors",
                      outfit.favorite
                        ? "fill-flame text-flame"
                        : "text-ink-soft hover:text-ink"
                    )}
                  />
                </button>
              </div>

              {/* Natural 2:3 Frame with Seamless Studio Fill - Never zooms in or cuts off any photo */}
              <div
                onClick={() => setSelectedOutfit(outfit)}
                className="relative aspect-[2/3] w-full cursor-pointer overflow-hidden bg-[#fafafa] flex items-center justify-center"
              >
                <img
                  src={outfit.resultImage}
                  alt={outfit.name}
                  className="h-full w-full object-contain"
                />
              </div>

              {/* Card Footer */}
              <div className="p-4 flex flex-col gap-3 bg-paper border-t border-line">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3
                      onClick={() => setSelectedOutfit(outfit)}
                      className="font-display font-bold text-sm text-ink cursor-pointer hover:text-flame transition-colors truncate"
                    >
                      {outfit.name}
                    </h3>
                    <p className="text-xs text-ink-soft mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{outfit.person?.name || "Model"}</span>
                      <span>•</span>
                      <span>{outfit.garments?.length || outfit.garmentIds.length} pieces</span>
                      {outfit.person?.calibration?.bodySilhouette && (
                        <>
                          <span>•</span>
                          <span className="capitalize font-mono text-[10px] text-ink-soft bg-bone px-1.5 py-0.2 rounded border border-line">
                            {outfit.person.calibration.bodySilhouette}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLookbookOutfit(outfit);
                      }}
                      className="rounded-full border border-flame/30 bg-flame/10 px-2.5 py-1 text-xs font-semibold text-flame hover:bg-flame hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer"
                      title="Export social fit card & lookbook"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Fit Card</span>
                    </button>

                    <button
                      onClick={() => setSelectedOutfit(outfit)}
                      className="rounded-full border border-line bg-bone px-2.5 py-1 text-xs font-semibold text-ink hover:bg-bone-deep transition-colors cursor-pointer"
                    >
                      View
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Delete "${outfit.name}"?`)) {
                          deleteOutfit(outfit.id);
                        }
                      }}
                      className="p-1 text-ink-soft hover:text-red-500 transition-colors cursor-pointer"
                      title="Delete outfit"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Garment Thumbs Preview */}
                {outfit.garments && outfit.garments.length > 0 && (
                  <div className="flex items-center gap-2 border-t border-line/60 pt-2.5">
                    <span className="text-[11px] text-ink-soft">Garments:</span>
                    <div className="flex items-center -space-x-2">
                      {outfit.garments.map((g) => (
                        <img
                          key={g.id}
                          src={g.image}
                          alt={g.name}
                          title={g.name}
                          className="h-7 w-7 rounded-full border border-paper object-cover shadow-xs"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Outfit Detail Modal (Portaled to document.body to center on screen) */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {selectedOutfit && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-hidden">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative w-full max-w-3xl rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
                >
              <div className="flex items-center justify-between pb-4 border-b border-line mb-6">
                <div>
                  <h2 className="font-display text-2xl font-bold text-ink">
                    {selectedOutfit.name}
                  </h2>
                  <p className="text-xs text-ink-soft mt-0.5">
                    Created on {new Date(selectedOutfit.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOutfit(null)}
                  className="rounded-full p-2 text-ink-soft hover:bg-bone-deep hover:text-ink"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                {/* Large Result Image - Natural 2:3 Edge-to-Edge Portrait Framing */}
                <div className="md:col-span-6 flex flex-col items-center">
                  <div className="w-full max-w-sm rounded-3xl border border-line bg-paper overflow-hidden shadow-xl card-shadow">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-paper border-b border-line">
                      <span className="badge-flame text-[10px] py-0.5 px-2">
                        <Sparkles className="h-2.5 w-2.5" />
                        Virtual Try-On Look
                      </span>
                      <span className="text-[10px] font-mono text-ink-soft">
                        1024 × 1536 HD
                      </span>
                    </div>
                    <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#fafafa] flex items-center justify-center">
                      <img
                        src={selectedOutfit.resultImage}
                        alt={selectedOutfit.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </div>
                </div>

                {/* Garments Used & Actions */}
                <div className="md:col-span-6 space-y-6">
                  {/* Persona Model Info */}
                  {selectedOutfit.person && (
                    <div className="flex items-center gap-3 rounded-2xl border border-line bg-bone p-3">
                      <div className="relative aspect-[2/3] h-12 overflow-hidden rounded-xl border border-line bg-bone-deep shrink-0">
                        <img
                          src={selectedOutfit.person.image}
                          alt={selectedOutfit.person.name}
                          className="h-full w-full object-cover object-top"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-ink">
                            {selectedOutfit.person.name}
                          </h4>
                          <span className="badge-flame text-[9px] py-0 px-1.5">
                            Active Persona
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-soft mt-0.5">
                          {selectedOutfit.person.calibration?.heightCm
                            ? `${selectedOutfit.person.calibration.heightCm} cm`
                            : "175 cm"}
                          {" • "}
                          <span className="capitalize font-mono">
                            {selectedOutfit.person.calibration?.bodySilhouette || "Athletic"}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-ink-soft mb-3">
                      Garments in this Look
                    </h3>

                    <div className="space-y-3">
                      {selectedOutfit.garments && selectedOutfit.garments.length > 0 ? (
                        selectedOutfit.garments.map((g) => (
                          <div
                            key={g.id}
                            className="flex items-center gap-3 rounded-2xl border border-line bg-bone p-3"
                          >
                            <img
                              src={g.image}
                              alt={g.name}
                              className="h-12 w-12 rounded-xl object-cover border border-line"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-semibold text-ink truncate">
                                {g.name}
                              </h4>
                              <p className="text-[11px] text-ink-soft capitalize">
                                {g.category} • {g.color || "Standard"}
                              </p>
                            </div>
                            <Link
                              href={`/try-on?garmentId=${g.id}`}
                              className="text-xs font-semibold text-flame hover:underline"
                            >
                              Try On
                            </Link>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-ink-soft">
                          Original garments cataloged in wardrobe
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2.5 pt-4 border-t border-line">
                    <Link
                      href={
                        selectedOutfit.garments?.[0]?.id
                          ? `/try-on?garmentId=${selectedOutfit.garments[0].id}`
                          : "/try-on"
                      }
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-xs font-semibold text-bone hover:bg-flame transition-colors shadow-sm"
                    >
                      <Sparkles className="h-4 w-4 text-flame" />
                      <span>Try Look Again with Another Persona</span>
                    </Link>

                    <button
                      onClick={() => setLookbookOutfit(selectedOutfit)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-flame/40 bg-flame/10 hover:bg-flame hover:text-white px-5 py-3 text-xs font-bold text-flame transition-all shadow-xs cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Export Social Fit Card & Lookbook</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = selectedOutfit.resultImage;
                          a.download = `outfit-${selectedOutfit.id}.png`;
                          a.click();
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-bone px-4 py-2.5 text-xs font-semibold text-ink hover:bg-bone-deep transition-colors cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Raw Image</span>
                      </button>

                      <button
                        onClick={() => {
                          toggleFavoriteOutfit(selectedOutfit.id);
                          setSelectedOutfit((prev) =>
                            prev ? { ...prev, favorite: !prev.favorite } : null
                          );
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-bone px-4 py-2.5 text-xs font-semibold text-ink hover:bg-bone-deep transition-colors cursor-pointer"
                      >
                        <Heart
                          className={`h-3.5 w-3.5 ${
                            selectedOutfit.favorite
                              ? "fill-flame text-flame"
                              : "text-ink-soft"
                          }`}
                        />
                        <span>{selectedOutfit.favorite ? "Favorited" : "Favorite"}</span>
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        if (confirm(`Delete "${selectedOutfit.name}"?`)) {
                          deleteOutfit(selectedOutfit.id);
                          setSelectedOutfit(null);
                        }
                      }}
                      className="w-full text-center text-xs text-ink-soft hover:text-red-500 py-1 transition-colors cursor-pointer"
                    >
                      Delete this outfit
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}

      {/* Social Fit Card & Lookbook Modal */}
      <LookbookModal
        isOpen={Boolean(lookbookOutfit)}
        onClose={() => setLookbookOutfit(null)}
        outfit={lookbookOutfit}
      />
    </div>
  );
}
