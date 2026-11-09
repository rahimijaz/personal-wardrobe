"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Shirt,
  Layers,
  Heart,
  Plus,
  ShieldCheck,
  Cpu,
  Clock,
  ExternalLink,
  TrendingUp,
  Zap,
  Star,
  ArrowUpRight,
  ChevronRight,
  Compass,
  Palette,
} from "lucide-react";
import { useWardrobe } from "@/context/wardrobe-context";
import { CATEGORIES, CATEGORY_LABEL, type GarmentCategory } from "@/lib/types";

const CATEGORY_ICONS: Record<string, string> = {
  tops: "👕",
  bottoms: "👖",
  "one-pieces": "👗",
  shoes: "👟",
  accessories: "💍",
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: "easeOut" as const },
  }),
};

export default function DashboardPage() {
  const {
    garments,
    outfits,
    activePerson,
    engineStatus,
    isLoadingGarments,
    toggleFavoriteGarment,
  } = useWardrobe();

  const recentGarments = garments.slice(0, 6);
  const recentOutfits = outfits.slice(0, 3);
  const favoriteCount = garments.filter((g) => g.favorite).length;

  return (
    <div className="flex-1 page-enter">
      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden hero-gradient border-b border-line">
        {/* Decorative mesh */}
        <div className="absolute inset-0 mesh-pattern pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 md:px-10 py-10 sm:py-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            {/* Left: Headline + CTAs */}
            <div className="max-w-2xl">
              {/* Studio badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-bone-deep/50 px-3.5 py-1.5 text-[11px] font-semibold text-ink mb-5 shadow-xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-flame" />
                <span>Digital Wardrobe &amp; Styling Studio</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="font-display text-4xl sm:text-5xl md:text-[3.5rem] font-bold tracking-tight text-ink leading-[1.08]"
              >
                Your Digital Wardrobe
                <br />
                <span className="gradient-text">&amp; Styling Studio.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.45 }}
                className="mt-5 text-base sm:text-lg text-ink-soft leading-relaxed max-w-xl"
              >
                Organize your real-world collection, curate personalized styles, and render
                photorealistic try-on looks with precision detail.
              </motion.p>

              {/* Stats row */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-7 flex flex-wrap items-center gap-5"
              >
                <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper/80 backdrop-blur-sm px-4 py-2.5 shadow-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-flame/10">
                    <Shirt className="h-4 w-4 text-flame" />
                  </div>
                  <div>
                    <p className="font-display text-xl font-bold text-ink leading-none">{garments.length}</p>
                    <p className="text-[11px] text-ink-soft mt-0.5">pieces cataloged</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper/80 backdrop-blur-sm px-4 py-2.5 shadow-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sage/20">
                    <Layers className="h-4 w-4 text-sage" />
                  </div>
                  <div>
                    <p className="font-display text-xl font-bold text-ink leading-none">{outfits.length}</p>
                    <p className="text-[11px] text-ink-soft mt-0.5">looks created</p>
                  </div>
                </div>
                {favoriteCount > 0 && (
                  <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper/80 backdrop-blur-sm px-4 py-2.5 shadow-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                      <Heart className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <p className="font-display text-xl font-bold text-ink leading-none">{favoriteCount}</p>
                      <p className="text-[11px] text-ink-soft mt-0.5">favorites</p>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* CTA buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
                className="mt-8 flex flex-wrap items-center gap-3"
              >
                <Link
                  href="/try-on"
                  className="btn-primary inline-flex items-center gap-2.5 rounded-full bg-ink px-7 py-3.5 text-sm font-bold text-bone shadow-lg transition-all duration-200 hover:bg-flame hover:scale-[1.03] hover:shadow-xl"
                >
                  <Sparkles className="h-4 w-4 text-flame" />
                  <span>Create a Look</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href="/harmony"
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/90 backdrop-blur-sm px-5 py-3.5 text-sm font-semibold text-ink shadow-sm transition-all duration-200 hover:border-flame/50 hover:bg-bone-deep hover:scale-[1.02]"
                >
                  <Palette className="h-4 w-4 text-flame" />
                  <span>Color Wheel</span>
                </Link>

                <Link
                  href="/wardrobe"
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/90 backdrop-blur-sm px-5 py-3.5 text-sm font-semibold text-ink shadow-sm transition-all duration-200 hover:bg-bone-deep hover:scale-[1.02]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Clothing</span>
                </Link>
              </motion.div>
            </div>

            {/* Right: Active Persona card */}
            {activePerson ? (
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="shrink-0 w-full md:w-64"
              >
                <div className="relative overflow-hidden rounded-3xl border border-line bg-paper shadow-xl card-shadow">
                  {/* Card Header: Badges outside the photo so the user's face is 100% unobstructed */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-paper border-b border-line">
                    <span className="badge-flame text-[10px] py-0.5 px-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-flame animate-pulse" />
                      Active Persona
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-bone px-2 py-0.5 text-[10px] font-mono font-medium text-ink-soft border border-line">
                      {activePerson.calibration?.score ? `${activePerson.calibration.score}% Calibrated` : "DensePose Ready"}
                    </span>
                  </div>

                  {/* Natural 2:3 Portrait Frame: Matches the 1024x1536 model ratio edge-to-edge with zero crop */}
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-bone-deep">
                    <img
                      src={activePerson.image}
                      alt={activePerson.name}
                      className="h-full w-full object-cover object-top"
                    />
                  </div>

                  {/* Clean Footer Below Photo - never obscures the model's legs or feet */}
                  <div className="p-3.5 bg-paper border-t border-line">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-sm font-bold text-ink truncate leading-snug">
                          {activePerson.name}
                        </p>
                        <p className="text-[11px] text-ink-soft font-mono truncate mt-0.5">
                          {activePerson.calibration?.heightCm ? `${activePerson.calibration.heightCm} cm` : "175 cm"} •{" "}
                          <span className="capitalize">{activePerson.calibration?.bodySilhouette || "Athletic"}</span>
                        </p>
                      </div>
                      <Link
                        href="/profile"
                        className="shrink-0 inline-flex items-center gap-1 rounded-full border border-line bg-bone px-3 py-1 text-xs font-semibold text-ink hover:bg-bone-deep hover:text-flame transition-colors cursor-pointer shadow-2xs"
                      >
                        <span>Change</span>
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="shrink-0 w-full md:w-64"
              >
                <Link href="/profile" className="group block">
                  <div className="aspect-[2/3] w-full rounded-3xl border-2 border-dashed border-line bg-paper/60 flex flex-col items-center justify-center text-center p-6 transition-all duration-200 group-hover:border-ink group-hover:bg-bone-deep/50">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bone-deep mb-3 group-hover:scale-110 transition-transform">
                      <Plus className="h-7 w-7 text-ink-soft" />
                    </div>
                    <p className="text-sm font-semibold text-ink">Add Your Persona</p>
                    <p className="text-[11px] text-ink-soft mt-1">Upload a reference photo</p>
                  </div>
                </Link>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="mx-auto max-w-7xl px-6 sm:px-8 md:px-10 py-10 space-y-12">

        {/* ── Browse by Category ── */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Browse by Category</h2>
              <p className="text-xs text-ink-soft mt-0.5">Your local wardrobe organized by type</p>
            </div>
            <Link
              href="/wardrobe"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {CATEGORIES.map((cat, i) => {
              const count = garments.filter((g) => g.category === cat).length;
              const isVton = ["tops", "bottoms", "one-pieces"].includes(cat);

              return (
                <motion.div
                  key={cat}
                  variants={fadeUp}
                  custom={i * 0.5}
                  initial="hidden"
                  animate="visible"
                >
                  <Link
                    href={`/wardrobe?category=${cat}`}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-paper p-4 transition-all duration-250 hover:border-ink/40 hover:-translate-y-1 card-shadow"
                  >
                    {/* Hover glow */}
                    <div className="absolute inset-0 bg-gradient-to-br from-flame/0 to-flame/0 group-hover:from-flame/3 group-hover:to-transparent transition-all duration-300 rounded-2xl pointer-events-none" />

                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl">{CATEGORY_ICONS[cat] || "🧣"}</span>
                      {isVton && (
                        <span className="flex h-1.5 w-1.5 rounded-full bg-flame animate-soft-pulse" title="Try-On Ready" />
                      )}
                    </div>

                    <p className="font-display text-base font-bold text-ink group-hover:text-flame transition-colors leading-tight">
                      {CATEGORY_LABEL[cat]}
                    </p>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-ink-soft">
                        {count} {count === 1 ? "item" : "items"}
                      </span>
                      {isVton && (
                        <span className="text-[10px] font-semibold text-flame/70 bg-flame/8 px-1.5 py-0.5 rounded-full">
                          VTON
                        </span>
                      )}
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ── Recent Pieces ── */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Recent Pieces</h2>
              <p className="text-xs text-ink-soft mt-0.5">Latest additions to your digital wardrobe</p>
            </div>
            <Link
              href="/wardrobe"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-flame hover:underline"
            >
              <span>Manage Wardrobe ({garments.length})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {isLoadingGarments ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="aspect-[3/4] rounded-2xl border border-line animate-shimmer"
                />
              ))}
            </div>
          ) : recentGarments.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-line bg-paper/50 p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-bone-deep mb-4">
                <Shirt className="h-8 w-8 text-ink-soft" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">No garments yet</h3>
              <p className="text-sm text-ink-soft mt-2 max-w-xs mx-auto leading-relaxed">
                Start building your digital wardrobe by uploading your first clothing item.
              </p>
              <Link
                href="/wardrobe"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-xs font-bold text-bone hover:bg-flame transition-colors shadow-md"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Your First Piece
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {recentGarments.map((garment, i) => (
                <motion.div
                  key={garment.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.06 }}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-paper card-shadow transition-all duration-200 hover:-translate-y-1.5"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-bone-deep img-zoom">
                    <img
                      src={garment.image}
                      alt={garment.name}
                      className="h-full w-full object-cover"
                    />

                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/10 transition-colors duration-300" />

                    <button
                      onClick={() => toggleFavoriteGarment(garment.id)}
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-paper/85 backdrop-blur-md shadow-sm transition-all hover:scale-110 active:scale-95"
                      aria-label="Toggle favorite"
                    >
                      <Heart
                        className={`h-3.5 w-3.5 transition-colors ${
                          garment.favorite
                            ? "fill-flame text-flame"
                            : "text-ink-soft group-hover:text-ink"
                        }`}
                      />
                    </button>

                    <span className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-mono text-bone backdrop-blur-sm uppercase">
                      {garment.category}
                    </span>
                  </div>

                  <div className="p-3">
                    <h4 className="text-xs font-bold text-ink truncate">{garment.name}</h4>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-soft">
                      <span className="truncate">{garment.color || garment.type || "Studio"}</span>
                      <Link
                        href={`/try-on?garmentId=${garment.id}`}
                        className="text-flame font-bold hover:underline text-[10px] shrink-0 ml-1"
                      >
                        Try On →
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        {/* ── Recent AI Looks ── */}
        {recentOutfits.length > 0 && (
          <motion.section
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Recent Styled Looks</h2>
                <p className="text-xs text-ink-soft mt-0.5">Curated outfits styled in your digital studio</p>
              </div>
              <Link
                href="/outfits"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-flame hover:underline"
              >
                <span>View All Looks</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {recentOutfits.map((outfit, i) => (
                <motion.div
                  key={outfit.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="group overflow-hidden rounded-3xl border border-line bg-paper card-shadow transition-all duration-200 hover:-translate-y-1"
                >
                  {/* Card Header: Badges outside the photo so face is 100% unobstructed */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-paper border-b border-line">
                    <span className="badge-flame text-[10px] py-0.5 px-2">
                      <Sparkles className="h-2.5 w-2.5" />
                      Styled Look
                    </span>
                    <span className="text-[10px] font-mono text-ink-soft">
                      {new Date(outfit.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Natural 2:3 Portrait Frame with Seamless Studio Fill - Never zooms in or crops any photo */}
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#fafafa] flex items-center justify-center">
                    <img
                      src={outfit.resultImage}
                      alt={outfit.name}
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div className="p-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-ink truncate">{outfit.name}</h3>
                      <p className="text-[11px] text-ink-soft mt-0.5">
                        {outfit.garments?.length || outfit.garmentIds.length} pieces paired
                      </p>
                    </div>
                    <Link
                      href={`/outfits?id=${outfit.id}`}
                      className="shrink-0 ml-3 rounded-full border border-line bg-bone px-3 py-1.5 text-xs font-semibold text-ink transition-all hover:bg-ink hover:text-bone hover:border-ink"
                    >
                      Details
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── Quick Actions Grid ── */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={3}
        >
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink mb-5">Quick Actions</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                href: "/match",
                icon: Compass,
                iconColor: "text-flame",
                iconBg: "bg-flame/10",
                title: "Fit Recommender",
                desc: "Discover matching tops and bottoms paired with color harmony.",
                cta: "Explore Fits",
              },
              {
                href: "/try-on",
                icon: Sparkles,
                iconColor: "text-amber-600 dark:text-amber-400",
                iconBg: "bg-amber-500/10",
                title: "Virtual Try-On",
                desc: "Try on tops, bottoms, and complete outfits in real time.",
                cta: "Open Studio",
              },
              {
                href: "/wardrobe",
                icon: Shirt,
                iconColor: "text-ink",
                iconBg: "bg-bone-deep",
                title: "My Wardrobe",
                desc: "Browse, search, and organize your digital clothing catalog.",
                cta: "Open Wardrobe",
              },
              {
                href: "/outfits",
                icon: Layers,
                iconColor: "text-sage",
                iconBg: "bg-sage/15",
                title: "Saved Outfits",
                desc: "View your gallery of styled looks and outfit archives.",
                cta: "View Gallery",
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex flex-col rounded-3xl border border-line bg-paper p-5 transition-all duration-200 hover:border-ink/30 hover:-translate-y-1 card-shadow"
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.iconBg} mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className={`h-5 w-5 ${item.iconColor}`} />
                  </div>
                  <h3 className="font-display text-lg font-bold text-ink group-hover:text-flame transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-ink-soft mt-1.5 leading-relaxed flex-1">{item.desc}</p>
                  <div className="mt-4 flex items-center gap-1 text-xs font-bold text-ink-soft group-hover:text-ink transition-colors">
                    <span>{item.cta}</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.section>

        {/* ── Hardware Status Footer ── */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={4}
          className="rounded-2xl border border-line bg-paper/60 backdrop-blur-sm px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className={`relative flex h-10 w-10 items-center justify-center rounded-xl border border-line ${engineStatus?.online ? "bg-emerald-500/10" : "bg-bone-deep"}`}>
              <Cpu className={`h-5 w-5 ${engineStatus?.online ? "text-emerald-600 dark:text-emerald-400" : "text-flame"}`} />
              {engineStatus?.online && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-paper" />
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-ink">
                {engineStatus?.online ? "Studio Engine Online" : "Studio Ready"}
              </h4>
              <p className="text-[11px] text-ink-soft">
                {engineStatus?.online ? "Connected and ready for try-on styling." : "Local styling studio ready."}
              </p>
            </div>
          </div>

          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink transition-colors"
          >
            <span>Studio Settings</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </motion.div>

      </div>
    </div>
  );
}
