"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  Search,
  Filter,
  Grid3X3,
  List,
  Heart,
  MoreVertical,
  Trash2,
  Sparkles,
  Upload,
  X,
  Check,
  Shirt,
  Info,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import clsx from "clsx";
import { useWardrobe } from "@/context/wardrobe-context";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_SINGLE,
  VTON_CATEGORIES,
  type GarmentCategory,
  type GarmentPhotoType,
  type Garment,
} from "@/lib/types";

export default function WardrobePage() {
  const {
    garments,
    isLoadingGarments,
    refreshGarments,
    toggleFavoriteGarment,
    deleteGarment,
  } = useWardrobe();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name" | "favorite">("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Filtered and sorted garments
  const filteredGarments = useMemo(() => {
    return garments
      .filter((g) => {
        if (activeCategory !== "all" && g.category !== activeCategory) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = g.name.toLowerCase().includes(q);
          const matchColor = g.color?.toLowerCase().includes(q);
          const matchType = g.type?.toLowerCase().includes(q);
          const matchCat = g.category.toLowerCase().includes(q);
          if (!matchName && !matchColor && !matchType && !matchCat) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "oldest") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === "name") {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === "favorite") {
          return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [garments, activeCategory, searchQuery, sortBy]);

  return (
    <div className="flex-1 p-6 sm:p-8 md:p-10 max-w-7xl mx-auto w-full page-enter">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            My Wardrobe
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-sm text-ink-soft">
              {garments.length} {garments.length === 1 ? "garment" : "garments"} cataloged locally
            </p>
            {garments.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-flame/10 border border-flame/20 px-2 py-0.5 text-[10px] font-bold text-flame">
                {garments.filter(g => ["tops","bottoms","one-pieces"].includes(g.category)).length} VTON Ready
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-bone shadow-md transition-all duration-200 hover:bg-flame hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          <span>Add Clothing</span>
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar border-b border-line">
        <button
          onClick={() => setActiveCategory("all")}
          className={clsx(
            "rounded-full px-4 py-1.5 text-xs font-semibold tracking-tight transition-all duration-200 whitespace-nowrap",
            activeCategory === "all"
              ? "bg-ink text-bone shadow-sm"
              : "bg-paper text-ink-soft hover:bg-bone-deep hover:text-ink"
          )}
        >
          All Pieces ({garments.length})
        </button>

        {CATEGORIES.map((cat) => {
          const count = garments.filter((g) => g.category === cat).length;
          const isVton = VTON_CATEGORIES.includes(cat as any);
          const isSelected = activeCategory === cat;

          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={clsx(
                "rounded-full px-4 py-1.5 text-xs font-semibold tracking-tight transition-all duration-200 whitespace-nowrap flex items-center gap-1.5",
                isSelected
                  ? "bg-ink text-bone shadow-sm"
                  : "bg-paper text-ink-soft hover:bg-bone-deep hover:text-ink"
              )}
            >
              <span>{CATEGORY_LABEL[cat]}</span>
              <span
                className={clsx(
                  "text-[10px] px-1.5 py-0.2 rounded-full",
                  isSelected ? "bg-bone/20 text-bone" : "bg-bone-deep text-ink-soft"
                )}
              >
                {count}
              </span>
              {isVton && (
                <span
                  className={clsx(
                    "h-1.5 w-1.5 rounded-full",
                    isSelected ? "bg-flame" : "bg-flame/60"
                  )}
                  title="Virtual Try-On Compatible"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Search, Filter & View Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-8">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
          <input
            type="text"
            placeholder="Search wardrobe (e.g. black, hoodie, jeans)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-line bg-paper pl-10 pr-4 py-2.5 text-xs sm:text-sm text-ink placeholder:text-ink-soft/70 focus:border-ink focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink-soft hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>

        {/* Sort & View Mode Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs font-medium text-ink focus:outline-none"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="name">Sort: Name (A-Z)</option>
              <option value="favorite">Sort: Favorites</option>
            </select>
          </div>

          <div className="flex items-center rounded-lg border border-line bg-paper p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={clsx(
                "p-1.5 rounded-md text-ink transition-colors",
                viewMode === "grid" ? "bg-bone shadow-xs text-ink" : "text-ink-soft hover:text-ink"
              )}
              aria-label="Grid View"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={clsx(
                "p-1.5 rounded-md text-ink transition-colors",
                viewMode === "list" ? "bg-bone shadow-xs text-ink" : "text-ink-soft hover:text-ink"
              )}
              aria-label="List View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Clothing Grid / List */}
      {isLoadingGarments ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <div key={n} className="flex flex-col overflow-hidden rounded-2xl border border-line">
              <div className="aspect-[3/4] animate-shimmer" />
              <div className="p-3 space-y-1.5">
                <div className="h-3 rounded animate-shimmer" />
                <div className="h-2.5 w-2/3 rounded animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredGarments.length === 0 ? (
        /* Empty State */
        <div className="rounded-3xl border-2 border-dashed border-line bg-paper/50 p-12 text-center max-w-lg mx-auto my-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-bone-deep mb-4">
            <Shirt className="h-8 w-8 text-ink-soft" />
          </div>
          <h3 className="font-display text-xl font-bold text-ink">
            {searchQuery || activeCategory !== "all"
              ? "No garments match your filter"
              : "Your wardrobe is empty"}
          </h3>
          <p className="mt-2 text-sm text-ink-soft leading-relaxed max-w-sm mx-auto">
            {searchQuery || activeCategory !== "all"
              ? "Try adjusting your search keywords or switching category tabs."
              : "Start building your digital wardrobe by uploading your first garment photo."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {searchQuery || activeCategory !== "all" ? (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                }}
                className="rounded-full border border-line bg-bone px-5 py-2.5 text-xs font-semibold text-ink hover:bg-bone-deep transition-colors"
              >
                Reset Filters
              </button>
            ) : (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="btn-primary inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-xs font-bold text-bone hover:bg-flame transition-colors shadow-md"
              >
                <Plus className="h-4 w-4" />
                <span>Add Your First Garment</span>
              </button>
            )}
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {filteredGarments.map((garment) => {
            const isVton = VTON_CATEGORIES.includes(garment.category as any);

            return (
              <div
                key={garment.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              >
                {/* Image Container */}
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-bone-deep">
                  <img
                    src={garment.image}
                    alt={garment.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Favorite Button */}
                  <button
                    onClick={() => toggleFavoriteGarment(garment.id)}
                    className="absolute top-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-paper/85 backdrop-blur-md shadow-xs transition-transform hover:scale-110 active:scale-95"
                    aria-label="Toggle favorite"
                  >
                    <Heart
                      className={clsx(
                        "h-3.5 w-3.5 transition-colors",
                        garment.favorite
                          ? "fill-flame text-flame"
                          : "text-ink-soft hover:text-ink"
                      )}
                    />
                  </button>

                  {/* Badges */}
                  <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-mono uppercase text-bone backdrop-blur-md">
                      {garment.category}
                    </span>
                    {isVton && (
                      <span className="rounded-full bg-flame/90 px-1.5 py-0.5 text-[9px] font-mono text-bone backdrop-blur-md">
                        VTON
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Card */}
                <div className="p-3.5 flex flex-col justify-between flex-1">
                  <div>
                    <h3 className="font-semibold text-xs text-ink truncate">
                      {garment.name}
                    </h3>
                    <p className="text-[11px] text-ink-soft mt-0.5 truncate">
                      {garment.color || garment.type || "Catalog piece"}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5">
                    {isVton ? (
                      <Link
                        href={`/try-on?garmentId=${garment.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-flame hover:underline"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Try On</span>
                      </Link>
                    ) : (
                      <span className="text-[10px] text-ink-soft/70">
                        Reference only
                      </span>
                    )}

                    <button
                      onClick={() => {
                        if (confirm(`Remove "${garment.name}" from your wardrobe?`)) {
                          deleteGarment(garment.id);
                        }
                      }}
                      className="text-ink-soft/50 hover:text-red-500 p-1 rounded-md transition-colors"
                      title="Delete garment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {filteredGarments.map((garment) => {
            const isVton = VTON_CATEGORIES.includes(garment.category as any);

            return (
              <div
                key={garment.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-paper p-3.5 transition-all duration-200 hover:shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={garment.image}
                    alt={garment.name}
                    className="h-16 w-14 rounded-xl border border-line object-cover"
                  />
                  <div>
                    <h3 className="font-semibold text-sm text-ink">
                      {garment.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-ink-soft">
                      <span className="capitalize">{garment.category}</span>
                      <span>•</span>
                      <span>{garment.color || "Standard"}</span>
                      {garment.type && (
                        <>
                          <span>•</span>
                          <span>{garment.type}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isVton && (
                    <Link
                      href={`/try-on?garmentId=${garment.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-flame/10 px-3 py-1.5 text-xs font-semibold text-flame transition-colors hover:bg-flame hover:text-bone"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Try On</span>
                    </Link>
                  )}

                  <button
                    onClick={() => toggleFavoriteGarment(garment.id)}
                    className="p-2 text-ink-soft hover:text-flame transition-colors"
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        garment.favorite ? "fill-flame text-flame" : ""
                      }`}
                    />
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Remove "${garment.name}"?`)) {
                        deleteGarment(garment.id);
                      }
                    }}
                    className="p-2 text-ink-soft hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Clothing Modal */}
      <AddGarmentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCreated={() => {
          refreshGarments();
          setIsAddModalOpen(false);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Clothing Modal Component
// ---------------------------------------------------------------------------

function AddGarmentModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<GarmentCategory>("tops");
  const [photoType, setPhotoType] = useState<GarmentPhotoType>("flat-lay");
  const [color, setColor] = useState("");
  const [type, setType] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick Preset Samples to pick from
  const PRESET_SAMPLES = [
    { label: "White Crewneck", url: "/samples/garment.webp", category: "tops", color: "Ivory" },
    { label: "Vintage Jeans", url: "/samples/baggy-jeans.jpg", category: "bottoms", color: "Denim Blue" },
    { label: "Black Cargo", url: "/samples/black-cargo-pants.png", category: "bottoms", color: "Black" },
    { label: "Silk Slip Dress", url: "/samples/silk-slip-dress.jpg", category: "one-pieces", color: "Noir" },
    { label: "Chelsea Boots", url: "/samples/chelsea-boots.jpg", category: "shoes", color: "Black Leather" },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, WebP).");
      return;
    }

    setFileToUpload(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewImage(reader.result as string);
      if (!name) {
        const guessedName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
        setName(guessedName);
      }
    };
    reader.readAsDataURL(file);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a name for this garment.");
      return;
    }
    if (!previewImage && !fileToUpload) {
      setError("Please upload an image of the garment.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (fileToUpload) {
        const formData = new FormData();
        formData.append("name", name.trim());
        formData.append("category", category);
        formData.append("photoType", photoType);
        formData.append("color", color.trim());
        formData.append("type", type.trim());
        formData.append("image", fileToUpload);

        const res = await fetch("/api/garments", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to upload garment");
        }
      } else if (previewImage) {
        const res = await fetch("/api/garments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            category,
            photoType,
            color: color.trim(),
            type: type.trim(),
            image: previewImage,
          }),
        });

        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to save garment");
        }
      }

      onCreated();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-xl rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-2xl my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line mb-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink">
              Add New Garment
            </h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Images stay 100% on your device
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-ink-soft hover:bg-bone-deep hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Helpful Tip Callout */}
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-line bg-bone p-4">
          <Info className="h-4 w-4 text-flame shrink-0 mt-0.5" />
          <p className="text-xs text-ink-soft leading-relaxed">
            <strong className="text-ink font-semibold">Pro tip for AI try-on:</strong>{" "}
            For best virtual try-on results, upload a clear product shot or flat-lay showing
            the entire garment against a neutral background. The garment does not need to be worn by a person.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Image Upload Area */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-2">
              Garment Photography
            </label>

            {previewImage ? (
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-bone-deep">
                <img
                  src={previewImage}
                  alt="Garment Preview"
                  className="h-full w-full object-contain p-4"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPreviewImage(null);
                    setFileToUpload(null);
                  }}
                  className="absolute top-3 right-3 rounded-full bg-ink/80 p-1.5 text-bone hover:bg-flame transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-bone p-8 text-center cursor-pointer transition-colors hover:border-ink hover:bg-bone-deep/50"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-paper border border-line shadow-xs group-hover:scale-105 transition-transform mb-3">
                    <Upload className="h-5 w-5 text-flame" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-ink">
                    Click or drag & drop garment photo
                  </p>
                  <p className="text-[11px] text-ink-soft mt-1">
                    PNG, JPG, or WebP (flat-lay or product catalog photo)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {/* Or Pick a Quick Preset */}
                <div className="mt-3">
                  <p className="text-[11px] font-medium text-ink-soft mb-2">
                    Or select a pre-loaded studio piece:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_SAMPLES.map((sample) => (
                      <button
                        key={sample.label}
                        type="button"
                        onClick={() => {
                          setPreviewImage(sample.url);
                          setName(sample.label);
                          setCategory(sample.category as GarmentCategory);
                          setColor(sample.color);
                        }}
                        className="rounded-full border border-line bg-bone px-3 py-1 text-[11px] font-medium text-ink hover:bg-bone-deep hover:border-ink transition-colors"
                      >
                        + {sample.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Garment Name */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              Garment Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Minimalist Cashmere Sweater"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-line bg-bone px-3.5 py-2.5 text-sm text-ink focus:border-ink focus:outline-none"
            />
          </div>

          {/* Category & Photo Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as GarmentCategory)}
                className="w-full rounded-xl border border-line bg-bone px-3.5 py-2.5 text-sm text-ink focus:border-ink focus:outline-none"
              >
                <option value="tops">Tops (T-shirts, Sweaters, Jackets) [VTON]</option>
                <option value="bottoms">Bottoms (Pants, Jeans, Skirts) [VTON]</option>
                <option value="one-pieces">One-Pieces (Dresses, Jumpsuits) [VTON]</option>
                <option value="shoes">Shoes</option>
                <option value="accessories">Accessories</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                Garment Photo Style
              </label>
              <select
                value={photoType}
                onChange={(e) => setPhotoType(e.target.value as GarmentPhotoType)}
                className="w-full rounded-xl border border-line bg-bone px-3.5 py-2.5 text-sm text-ink focus:border-ink focus:outline-none"
              >
                <option value="flat-lay">Flat-lay / Product Shot (Clean)</option>
                <option value="model">Worn by Model / Person</option>
              </select>
            </div>
          </div>

          {/* Color & Subtype */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                Color (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Charcoal, Ivory, Navy"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full rounded-xl border border-line bg-bone px-3.5 py-2.5 text-sm text-ink focus:border-ink focus:outline-none"
              >
              </input>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                Garment Type (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Hoodie, Denim, Trench"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-xl border border-line bg-bone px-3.5 py-2.5 text-sm text-ink focus:border-ink focus:outline-none"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-line bg-bone px-5 py-2.5 text-xs font-semibold text-ink hover:bg-bone-deep transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-xs font-semibold text-bone hover:bg-flame disabled:opacity-50 transition-colors shadow-md"
            >
              {isSubmitting ? (
                <span>Saving piece...</span>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save to Wardrobe</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
