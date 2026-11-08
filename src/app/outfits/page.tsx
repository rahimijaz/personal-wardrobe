"use client";

import { useState } from "react";
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

  return (
    <div className="flex-1 p-6 sm:p-8 md:p-10 max-w-7xl mx-auto w-full page-enter">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            My Outfits
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-sm text-ink-soft">
              Gallery of your saved virtual try-on looks
            </p>
            {outfits.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-flame/10 border border-flame/20 px-2 py-0.5 text-[10px] font-bold text-flame">
                {outfits.filter(o => o.favorite).length} Favorited
              </span>
            )}
          </div>
        </div>

        <Link
          href="/try-on"
          className="btn-primary inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bone hover:bg-flame transition-colors shadow-md"
        >
          <Sparkles className="h-4 w-4 text-flame" />
          <span>New Try-On Look</span>
        </Link>
      </div>

      {isLoadingOutfits ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex flex-col overflow-hidden rounded-3xl border border-line">
              <div className="aspect-[3/4] animate-shimmer" />
              <div className="p-4 space-y-2">
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
      ) : (
        /* Outfits Gallery Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {outfits.map((outfit) => (
            <div
              key={outfit.id}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-paper p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            >
              {/* Result Preview */}
              <div
                onClick={() => setSelectedOutfit(outfit)}
                className="relative aspect-[3/4] w-full cursor-pointer overflow-hidden rounded-2xl bg-bone-deep"
              >
                <img
                  src={outfit.resultImage}
                  alt={outfit.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-103"
                />

                {/* Favorite Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavoriteOutfit(outfit.id);
                  }}
                  className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-paper/85 backdrop-blur-md shadow-xs transition-transform hover:scale-110"
                >
                  <Heart
                    className={clsx(
                      "h-4 w-4",
                      outfit.favorite
                        ? "fill-flame text-flame"
                        : "text-ink-soft hover:text-ink"
                    )}
                  />
                </button>

                <div className="absolute bottom-3 left-3 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-mono text-bone backdrop-blur-md flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(outfit.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <h3
                    onClick={() => setSelectedOutfit(outfit)}
                    className="font-semibold text-sm text-ink cursor-pointer hover:text-flame transition-colors truncate"
                  >
                    {outfit.name}
                  </h3>
                  <p className="text-xs text-ink-soft mt-0.5">
                    {outfit.garments?.length || outfit.garmentIds.length} paired garments
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
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
                    className="p-1.5 text-ink-soft hover:text-red-500 transition-colors cursor-pointer"
                    title="Delete outfit"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Garment Thumbs Preview */}
              {outfit.garments && outfit.garments.length > 0 && (
                <div className="mt-3 flex items-center gap-2 border-t border-line/60 pt-3">
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
          ))}
        </div>
      )}

      {/* Outfit Detail Modal */}
      <AnimatePresence>
        {selectedOutfit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/65 p-4 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-3xl rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-2xl my-8"
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
                {/* Large Result Image */}
                <div className="md:col-span-6 flex flex-col items-center">
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-line bg-bone-deep shadow-md">
                    <img
                      src={selectedOutfit.resultImage}
                      alt={selectedOutfit.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>

                {/* Garments Used & Actions */}
                <div className="md:col-span-6 space-y-6">
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
      </AnimatePresence>

      {/* Social Fit Card & Lookbook Modal */}
      <LookbookModal
        isOpen={Boolean(lookbookOutfit)}
        onClose={() => setLookbookOutfit(null)}
        outfit={lookbookOutfit}
      />
    </div>
  );
}
